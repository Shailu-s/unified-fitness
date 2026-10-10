import type { ExportData, MealInput, NutritionEstimate, NutritionJob, Profile, SavedMeal, VoiceJob } from '../types';
import { validateTranscript } from './voice.ts';
import { localDateKey, validateMealInput } from './meals.ts';
import { nutritionCacheKey, validateEstimate } from './nutrition.ts';

type Value = string | number | null;

interface Database {
  execSync: (sql: string) => void;
  withTransactionSync: (task: () => void) => void;
  runSync: (sql: string, ...params: Value[]) => unknown;
  getFirstSync: <T>(sql: string, ...params: Value[]) => T | null;
  getAllSync: <T>(sql: string, ...params: Value[]) => T[];
}

type MealRecord = Omit<SavedMeal, 'time' | 'emoji' | 'assumptions' | 'estimateModel' | 'estimateState' | 'foods'> & {
  estimateJson: string | null;
  jobState: NutritionJob['state'] | null;
};
type JobRecord = Omit<NutritionJob, 'input'> & { inputJson: string };

const columns = `m.id, m.name, m.portion, m.kcal, m.protein, m.fibre, m.carbs, m.fat,
  m.nutrition_status AS nutritionStatus, m.log_state AS logState, m.logged_date AS loggedDate, m.created_at AS createdAt,
  m.updated_at AS updatedAt, m.input_type AS inputType, m.photo_uri AS photoUri, m.revision,
  e.payload AS estimateJson, j.state AS jobState, j.error_code AS estimateError`;
const mealFrom = `FROM meals m LEFT JOIN meal_estimates e ON e.meal_id = m.id AND e.revision = m.revision AND m.nutrition_status = 'pending'
  LEFT JOIN nutrition_jobs j ON j.meal_id = m.id AND j.revision = m.revision`;
const voiceColumns = `id, audio_uri AS audioUri, duration_ms AS durationMs, state, transcript, meal_id AS mealId, attempts,
  next_attempt_at AS nextAttemptAt, lease_token AS leaseToken, lease_until AS leaseUntil, error_code AS errorCode,
  created_at AS createdAt, updated_at AS updatedAt`;
const jobColumns = `id, meal_id AS mealId, revision, input_json AS inputJson, cache_key AS cacheKey, state, attempts,
  next_attempt_at AS nextAttemptAt, lease_until AS leaseUntil, lease_token AS leaseToken,
  error_code AS errorCode, created_at AS createdAt, updated_at AS updatedAt`;

function toMeal(row: MealRecord): SavedMeal {
  const { estimateJson, jobState, ...record } = row;
  const estimate = estimateJson ? validateEstimate(JSON.parse(estimateJson)) : null;
  const date = new Date(record.createdAt);
  return {
    ...record,
    ...(estimate ? { kcal: estimate.kcal, protein: estimate.protein, carbs: estimate.carbs, fat: estimate.fat, fibre: estimate.fibre } : {}),
    nutritionStatus: estimate ? 'estimated' : record.nutritionStatus,
    estimateState: record.nutritionStatus === 'manual' ? 'manual' : estimate ? 'estimated' : jobState === 'running' ? 'running' : jobState === 'failed' || (record.inputType === 'photo' && !record.photoUri) ? 'failed' : 'queued',
    estimateError: record.inputType === 'photo' && !record.photoUri && !estimate && record.nutritionStatus === 'pending' ? 'photo_upload' : record.estimateError,
    assumptions: estimate?.assumptions ?? [],
    foods: estimate?.foods ?? [],
    name: record.name === 'Photo meal' && estimate?.foods?.length ? estimate.foods.map((food) => food.name).join(', ') : record.name,
    estimateModel: estimate?.model ?? null,
    emoji: '',
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

const toJob = ({ inputJson, ...record }: JobRecord): NutritionJob => ({ ...record, input: JSON.parse(inputJson) });

export class LoggingRepository {
  private db: Database;

  constructor(db: Database) { this.db = db; }

  initialize() {
    const version = this.db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
    if (version > 4) throw new Error('Local data uses a newer app version. Update the app to open it.');
    this.db.execSync('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;');
    if (version === 0) {
      this.db.withTransactionSync(() => this.db.execSync(`
        CREATE TABLE profile (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL);
        CREATE TABLE meals (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          portion TEXT NOT NULL,
          kcal REAL CHECK (kcal >= 0),
          protein REAL CHECK (protein >= 0),
          fibre REAL CHECK (fibre >= 0),
          nutrition_status TEXT NOT NULL CHECK (nutrition_status IN ('pending', 'manual')),
          logged_date TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (
            (nutrition_status = 'pending' AND kcal IS NULL AND protein IS NULL AND fibre IS NULL) OR
            (nutrition_status = 'manual' AND kcal IS NOT NULL AND protein IS NOT NULL AND fibre IS NOT NULL)
          )
        );
        CREATE INDEX meals_by_day ON meals (logged_date, created_at);
        PRAGMA user_version = 1;
      `));
    }
    if (version < 2) {
      this.db.withTransactionSync(() => {
        this.db.execSync(`
          ALTER TABLE meals ADD COLUMN carbs REAL CHECK (carbs >= 0);
          ALTER TABLE meals ADD COLUMN fat REAL CHECK (fat >= 0);
          ALTER TABLE meals ADD COLUMN input_type TEXT NOT NULL DEFAULT 'text' CHECK (input_type IN ('text', 'photo'));
          ALTER TABLE meals ADD COLUMN photo_uri TEXT;
          ALTER TABLE meals ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
          CREATE TABLE meal_estimates (meal_id TEXT PRIMARY KEY REFERENCES meals(id), revision INTEGER NOT NULL, payload TEXT NOT NULL);
          CREATE TABLE nutrition_cache (cache_key TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE nutrition_jobs (
            id TEXT PRIMARY KEY NOT NULL, meal_id TEXT NOT NULL REFERENCES meals(id), revision INTEGER NOT NULL,
            input_json TEXT NOT NULL, cache_key TEXT,
            state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'failed', 'completed', 'cancelled')),
            attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL,
            lease_until TEXT, lease_token TEXT, error_code TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (meal_id, revision)
          );
          CREATE INDEX nutrition_jobs_ready ON nutrition_jobs (state, next_attempt_at, lease_until);
        `);
        const pending = this.db.getAllSync<Pick<MealRecord, 'id' | 'name' | 'portion' | 'createdAt'>>("SELECT id, name, portion, created_at AS createdAt FROM meals WHERE nutrition_status = 'pending'");
        for (const meal of pending) this.prepareNutrition(meal.id, 0, {
          name: meal.name, portion: meal.portion, kcal: null, protein: null, fibre: null,
          carbs: null, fat: null, inputType: 'text', photoUri: null,
        }, meal.createdAt);
        this.db.execSync('PRAGMA user_version = 2;');
      });
    }
    if (version < 3) {
      this.db.withTransactionSync(() => this.db.execSync(`
        ALTER TABLE meals ADD COLUMN log_state TEXT NOT NULL DEFAULT 'saved' CHECK (log_state IN ('draft', 'saved', 'discarded'));
        PRAGMA user_version = 3;
      `));
    }
    if (version < 4) {
      this.db.withTransactionSync(() => this.db.execSync(`
        CREATE TABLE IF NOT EXISTS voice_jobs (
          id TEXT PRIMARY KEY NOT NULL, audio_uri TEXT, duration_ms REAL,
          state TEXT NOT NULL CHECK (state IN ('recording','queued','running','ready','completed','failed','discarded')),
          transcript TEXT, meal_id TEXT UNIQUE REFERENCES meals(id), attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at TEXT NOT NULL, lease_token TEXT, lease_until TEXT, error_code TEXT,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        PRAGMA user_version = 4;
      `));
    }
    this.db.runSync("UPDATE voice_jobs SET state = 'failed', error_code = 'interrupted', updated_at = ? WHERE state = 'recording'", new Date().toISOString());
  }

  private newId() {
    const id = this.db.getFirstSync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id')?.id;
    if (!id) throw new Error('Could not create a record ID. Please try again.');
    return id;
  }

  getMeal(id: string): SavedMeal {
    const record = this.db.getFirstSync<MealRecord>(`SELECT ${columns} ${mealFrom} WHERE m.id = ?`, id);
    if (!record) throw new Error('Meal not found.');
    return toMeal(record);
  }

  private prepareNutrition(mealId: string, revision: number, input: MealInput, timestamp: string) {
    if (input.kcal !== null) return;
    const cacheKey = nutritionCacheKey(input);
    const estimate = this.cachedEstimate(cacheKey);
    if (estimate) {
      this.storeEstimate(mealId, revision, estimate);
      return;
    }
    this.db.runSync(
      "INSERT INTO nutrition_jobs (id, meal_id, revision, input_json, cache_key, state, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)",
      this.newId(), mealId, revision, JSON.stringify(input), cacheKey, timestamp, timestamp, timestamp,
    );
  }

  private cachedEstimate(cacheKey: string | null): NutritionEstimate | null {
    const row = cacheKey ? this.db.getFirstSync<{ payload: string }>('SELECT payload FROM nutrition_cache WHERE cache_key = ?', cacheKey) : null;
    if (!row) return null;
    try { return validateEstimate(JSON.parse(row.payload)); }
    catch { return null; }
  }

  private finishNutrition(job: JobRecord, estimate: NutritionEstimate, timestamp: string) {
    this.storeEstimate(job.mealId, job.revision, estimate);
    this.db.runSync('UPDATE meals SET updated_at = ? WHERE id = ? AND revision = ?', timestamp, job.mealId, job.revision);
    this.db.runSync("UPDATE nutrition_jobs SET state = 'completed', lease_token = NULL, lease_until = NULL, error_code = NULL, updated_at = ? WHERE id = ?", timestamp, job.id);
  }

  private storeEstimate(mealId: string, revision: number, estimate: NutritionEstimate) {
    this.db.runSync('INSERT INTO meal_estimates (meal_id, revision, payload) VALUES (?, ?, ?) ON CONFLICT(meal_id) DO UPDATE SET revision = excluded.revision, payload = excluded.payload',
      mealId, revision, JSON.stringify(estimate));
  }

  getProfile(): Profile | null {
    const row = this.db.getFirstSync<{ data: string }>('SELECT data FROM profile WHERE id = 1');
    return row ? JSON.parse(row.data) : null;
  }

  saveProfile(profile: Profile) {
    if (!profile.name.trim()) throw new Error('Enter your name.');
    this.db.runSync('INSERT INTO profile (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', JSON.stringify(profile));
  }

  getMeals(day: string): SavedMeal[] {
    return this.db.getAllSync<MealRecord>(`SELECT ${columns} ${mealFrom} WHERE m.logged_date = ? AND m.log_state = 'saved' ORDER BY m.created_at, m.rowid`, day).map(toMeal);
  }

  getMealDays(): string[] {
    return this.db.getAllSync<{ day: string }>("SELECT DISTINCT logged_date AS day FROM meals WHERE log_state = 'saved' ORDER BY logged_date DESC").map((row) => row.day);
  }

  getExportData(): ExportData {
    let data: ExportData = { profile: null, meals: [] };
    this.db.withTransactionSync(() => {
      const drafts = this.getPhotoDrafts();
      const voice = this.getVoiceJobs();
      data = { profile: this.getProfile(), meals: this.db.getAllSync<MealRecord>(`SELECT ${columns} ${mealFrom} WHERE m.log_state = 'saved' ORDER BY m.logged_date, m.created_at, m.rowid`).map(toMeal),
        ...(drafts.length ? { drafts } : {}), ...(voice.length ? { voice } : {}) };
    });
    return data;
  }

  getPhotoDrafts(): SavedMeal[] {
    return this.db.getAllSync<MealRecord>(`SELECT ${columns} ${mealFrom} WHERE m.log_state = 'draft' ORDER BY m.created_at DESC, m.rowid DESC`).map(toMeal);
  }

  addPhotoDraft(input: MealInput, date = new Date()): SavedMeal {
    if (input.inputType !== 'photo') throw new Error('A photo is required for this draft.');
    return this.insertMeal(input, date, 'draft');
  }

  savePhotoDraft(id: string, date = new Date()): SavedMeal {
    this.db.withTransactionSync(() => {
      const meal = this.getMeal(id);
      if (meal.logState === 'discarded') throw new Error('This draft was discarded.');
      if (meal.logState === 'draft') this.db.runSync("UPDATE meals SET log_state = 'saved', updated_at = ? WHERE id = ?", date.toISOString(), id);
    });
    return this.getMeal(id);
  }

  discardPhotoDraft(id: string, date = new Date()) {
    this.db.withTransactionSync(() => {
      const meal = this.getMeal(id);
      if (meal.logState !== 'draft') throw new Error('Only an unsaved draft can be discarded.');
      this.db.runSync("UPDATE meals SET log_state = 'discarded', photo_uri = NULL, revision = revision + 1, updated_at = ? WHERE id = ?", date.toISOString(), id);
      this.db.runSync("UPDATE nutrition_jobs SET state = 'cancelled', lease_token = NULL, lease_until = NULL, updated_at = ? WHERE meal_id = ? AND state IN ('queued', 'running', 'failed')", date.toISOString(), id);
      this.db.runSync("UPDATE voice_jobs SET state = 'discarded' WHERE meal_id = ?", id);
    });
  }

  addMeal(input: MealInput, date = new Date()): SavedMeal {
    return this.insertMeal(input, date, 'saved');
  }

  private insertMeal(input: MealInput, date: Date, logState: 'draft' | 'saved'): SavedMeal {
    let saved: SavedMeal;
    this.db.withTransactionSync(() => { saved = this.writeMeal(input, date, logState); });
    return saved!;
  }

  private writeMeal(input: MealInput, date: Date, logState: 'draft' | 'saved'): SavedMeal {
    const meal = validateMealInput(input);
    const id = this.newId();
    const timestamp = date.toISOString();
    this.db.runSync(
      'INSERT INTO meals (id, name, portion, kcal, protein, fibre, carbs, fat, nutrition_status, logged_date, created_at, updated_at, input_type, photo_uri, log_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, meal.name, meal.portion, meal.kcal, meal.protein, meal.fibre, meal.carbs, meal.fat,
      meal.kcal === null ? 'pending' : 'manual', localDateKey(date), timestamp, timestamp, meal.inputType, meal.photoUri, logState,
    );
    this.prepareNutrition(id, 0, meal, timestamp);
    return this.getMeal(id);
  }

  updateMeal(id: string, input: MealInput, date = new Date()): SavedMeal {
    let saved: SavedMeal;
    this.db.withTransactionSync(() => {
      const existing = this.getMeal(id);
      if (existing.logState === 'discarded') throw new Error('This draft was discarded.');
      const meal = validateMealInput({ ...input, inputType: input.inputType ?? existing.inputType,
        photoUri: input.photoUri === undefined ? existing.photoUri : input.photoUri });
      const unchangedNutrition = existing.nutritionStatus === 'estimated'
        ? [meal.kcal, meal.protein, meal.carbs, meal.fat, meal.fibre].every((value) => value === null)
        : (['kcal', 'protein', 'carbs', 'fat', 'fibre'] as const).every((key) => meal[key] === existing[key]);
      if (unchangedNutrition && meal.name === existing.name && meal.portion === existing.portion && meal.inputType === existing.inputType && meal.photoUri === existing.photoUri) {
        saved = existing;
        return;
      }
      const revision = existing.revision + 1;
      const timestamp = date.toISOString();
      this.db.runSync(
        'UPDATE meals SET name = ?, portion = ?, kcal = ?, protein = ?, fibre = ?, carbs = ?, fat = ?, nutrition_status = ?, updated_at = ?, revision = ?, input_type = ?, photo_uri = ? WHERE id = ?',
        meal.name, meal.portion, meal.kcal, meal.protein, meal.fibre, meal.carbs, meal.fat, meal.kcal === null ? 'pending' : 'manual', timestamp, revision, meal.inputType, meal.photoUri, id,
      );
      this.db.runSync("UPDATE nutrition_jobs SET state = 'cancelled', lease_token = NULL, lease_until = NULL, updated_at = ? WHERE meal_id = ? AND state IN ('queued', 'running', 'failed')", timestamp, id);
      this.prepareNutrition(id, revision, meal, timestamp);
      saved = this.getMeal(id);
    });
    return saved!;
  }

  removePhoto(id: string): SavedMeal {
    this.db.withTransactionSync(() => {
      const meal = this.getMeal(id);
      this.db.runSync('UPDATE meals SET photo_uri = NULL, revision = revision + 1, updated_at = ? WHERE id = ?', new Date().toISOString(), id);
      this.db.runSync('UPDATE meal_estimates SET revision = ? WHERE meal_id = ? AND revision = ?', meal.revision + 1, id, meal.revision);
      this.db.runSync("UPDATE nutrition_jobs SET state = 'cancelled', lease_token = NULL, lease_until = NULL WHERE meal_id = ? AND state IN ('queued','running','failed')", id);
    });
    return this.getMeal(id);
  }

  getVoiceJobs(): VoiceJob[] {
    return this.db.getAllSync<VoiceJob>(`SELECT ${voiceColumns} FROM voice_jobs WHERE state <> 'discarded' ORDER BY created_at, rowid`);
  }

  getVoiceJob(id: string): VoiceJob {
    const job = this.db.getFirstSync<VoiceJob>(`SELECT ${voiceColumns} FROM voice_jobs WHERE id = ?`, id);
    if (!job) throw new Error('Recording not found.');
    return job;
  }

  startVoiceRecording(uri: string, date = new Date()): VoiceJob {
    if (!uri.startsWith('file:///') || !uri.endsWith('.m4a') || uri.includes('/../')) throw new Error('Use a local M4A recording.');
    const id = this.newId();
    const time = date.toISOString();
    this.db.runSync("INSERT INTO voice_jobs (id, audio_uri, state, next_attempt_at, created_at, updated_at) VALUES (?, ?, 'recording', ?, ?, ?)", id, uri, time, time, time);
    return this.getVoiceJob(id);
  }

  queueVoiceRecording(id: string, durationMs: number, date = new Date(), audioUri?: string) {
    if (!Number.isFinite(durationMs) || durationMs < 250 || durationMs > 32000) throw new Error('Record for up to 30 seconds.');
    const job = this.getVoiceJob(id);
    if (!['recording','failed'].includes(job.state) || !job.audioUri) throw new Error('Recording is not available.');
    if (audioUri !== undefined && (!audioUri.startsWith('file:///') || !audioUri.endsWith('.m4a'))) throw new Error('Use a local recording.');
    this.db.runSync("UPDATE voice_jobs SET state = 'queued', audio_uri = ?, duration_ms = ?, attempts = 0, error_code = NULL, next_attempt_at = ?, updated_at = ? WHERE id = ? AND state IN ('recording','failed')", audioUri ?? job.audioUri, durationMs, date.toISOString(), date.toISOString(), id);
  }

  failVoiceFinalization(id: string) {
    this.db.runSync("UPDATE voice_jobs SET state = 'failed', error_code = 'finalize_failed', updated_at = ? WHERE id = ? AND state = 'recording'", new Date().toISOString(), id);
  }

  interruptVoiceRecording(id: string) {
    this.db.runSync("UPDATE voice_jobs SET state = 'failed', error_code = 'interrupted', updated_at = ? WHERE id = ? AND state = 'recording'", new Date().toISOString(), id);
  }

  claimVoiceJob(date = new Date()): VoiceJob | null {
    let claimed: VoiceJob | null = null;
    const time = date.toISOString();
    this.db.withTransactionSync(() => {
      const job = this.db.getFirstSync<VoiceJob>(`SELECT ${voiceColumns} FROM voice_jobs WHERE
        (state = 'queued' AND next_attempt_at <= ?) OR (state = 'running' AND lease_until <= ?) ORDER BY created_at, rowid LIMIT 1`, time, time);
      if (!job) return;
      const token = this.newId();
      this.db.runSync("UPDATE voice_jobs SET state = 'running', attempts = attempts + 1, lease_token = ?, lease_until = ?, error_code = NULL, updated_at = ? WHERE id = ?", token, new Date(date.getTime() + 120000).toISOString(), time, job.id);
      claimed = this.getVoiceJob(job.id);
    });
    return claimed;
  }

  completeVoiceJob(id: string, lease: string | null, text: unknown, date = new Date()): boolean {
    const transcript = validateTranscript(text);
    const job = this.getVoiceJob(id);
    if (job.state !== 'running' || job.leaseToken !== lease) return false;
    this.db.runSync("UPDATE voice_jobs SET state = 'ready', transcript = ?, lease_token = NULL, lease_until = NULL, error_code = NULL, updated_at = ? WHERE id = ?", transcript, date.toISOString(), id);
    return true;
  }

  failVoiceJob(id: string, lease: string | null, code: string, date = new Date()): boolean {
    if (!['network','invalid_result','backend_not_configured','budget_exceeded','audio_invalid'].includes(code)) throw new Error('Invalid voice error.');
    const job = this.getVoiceJob(id);
    if (job.state !== 'running' || job.leaseToken !== lease) return false;
    const retry = code === 'network' && job.attempts < 3;
    this.db.runSync('UPDATE voice_jobs SET state = ?, next_attempt_at = ?, lease_token = NULL, lease_until = NULL, error_code = ?, updated_at = ? WHERE id = ?',
      retry ? 'queued' : 'failed', new Date(date.getTime() + 30000 * 2 ** Math.min(job.attempts - 1, 2)).toISOString(), code, date.toISOString(), id);
    return true;
  }

  deferVoiceJob(id: string, lease: string | null, date = new Date()) {
    this.db.runSync("UPDATE voice_jobs SET state = 'queued', lease_token = NULL, lease_until = NULL, next_attempt_at = ?, updated_at = ? WHERE id = ? AND state = 'running' AND lease_token = ?",
      new Date(date.getTime() + 5000).toISOString(), date.toISOString(), id, lease);
  }

  retryVoiceJob(id: string, date = new Date()) {
    this.db.runSync("UPDATE voice_jobs SET state = 'queued', attempts = 0, next_attempt_at = ?, error_code = NULL, updated_at = ? WHERE id = ? AND state = 'failed' AND audio_uri IS NOT NULL AND duration_ms IS NOT NULL", date.toISOString(), date.toISOString(), id);
  }

  reviewVoiceTranscript(id: string, text: string, date = new Date()): SavedMeal {
    const transcript = validateTranscript(text);
    let meal: SavedMeal;
    this.db.withTransactionSync(() => {
      const job = this.getVoiceJob(id);
      if (job.state === 'discarded') throw new Error('This recording was discarded.');
      if (job.mealId) { meal = this.getMeal(job.mealId); return; }
      if (job.state === 'recording') throw new Error('Stop recording first.');
      meal = this.writeMeal({ name: transcript, portion: '', kcal: null, protein: null, fibre: null, inputType: 'text' }, new Date(job.createdAt), 'draft');
      this.db.runSync("UPDATE voice_jobs SET state = 'completed', meal_id = ?, lease_token = NULL, lease_until = NULL, updated_at = ? WHERE id = ?", meal.id, date.toISOString(), id);
    });
    return meal!;
  }

  discardVoiceJob(id: string, date = new Date()) {
    const job = this.getVoiceJob(id);
    if (job.mealId) throw new Error('Use the meal screen for this recording.');
    this.db.runSync("UPDATE voice_jobs SET state = 'discarded', lease_token = NULL, lease_until = NULL, updated_at = ? WHERE id = ?", date.toISOString(), id);
  }

  clearVoiceAudio(id: string) {
    this.db.runSync('UPDATE voice_jobs SET audio_uri = NULL WHERE id = ? AND state IN (\'ready\',\'completed\',\'discarded\')', id);
  }

  getVoiceCleanup(): VoiceJob[] {
    return this.db.getAllSync<VoiceJob>(`SELECT ${voiceColumns} FROM voice_jobs WHERE state IN ('ready','completed','discarded') AND audio_uri IS NOT NULL`);
  }

  getNutritionJobs(): NutritionJob[] {
    return this.db.getAllSync<JobRecord>(`SELECT ${jobColumns} FROM nutrition_jobs ORDER BY created_at, rowid`).map(toJob);
  }

  claimNutritionJob(date = new Date(), inputTypes: ('text' | 'photo')[] = ['text', 'photo']): NutritionJob | null {
    if (!inputTypes.length) return null;
    let claimed: NutritionJob | null = null;
    const timestamp = date.toISOString();
    this.db.withTransactionSync(() => {
      while (true) {
        const record = this.db.getFirstSync<JobRecord>(`SELECT ${jobColumns} FROM nutrition_jobs
          WHERE (((state = 'queued' OR (state = 'failed' AND error_code = 'network' AND attempts < 3)) AND next_attempt_at <= ?) OR (state = 'running' AND lease_until <= ?))
            AND json_extract(input_json, '$.inputType') IN (${inputTypes.map(() => '?').join(',')})
          ORDER BY created_at, rowid LIMIT 1`, timestamp, timestamp, ...inputTypes);
        if (!record) return;
        const meal = this.getMeal(record.mealId);
        if (meal.logState === 'discarded' || meal.revision !== record.revision || meal.nutritionStatus === 'manual') {
          this.db.runSync("UPDATE nutrition_jobs SET state = 'cancelled', lease_token = NULL, lease_until = NULL, updated_at = ? WHERE id = ?", timestamp, record.id);
          continue;
        }
        const cached = this.cachedEstimate(record.cacheKey);
        if (cached) { this.finishNutrition(record, cached, timestamp); continue; }
        const leaseToken = this.newId();
        const leaseUntil = new Date(date.getTime() + 5 * 60 * 1000).toISOString();
        this.db.runSync("UPDATE nutrition_jobs SET state = 'running', attempts = attempts + 1, lease_until = ?, lease_token = ?, error_code = NULL, updated_at = ? WHERE id = ?", leaseUntil, leaseToken, timestamp, record.id);
        claimed = { ...toJob(record), state: 'running', attempts: record.attempts + 1, leaseToken, leaseUntil, errorCode: null, updatedAt: timestamp };
        return;
      }
    });
    return claimed;
  }

  completeNutritionJob(id: string, leaseToken: string | null, result: unknown, date = new Date()): boolean {
    const estimate = validateEstimate(result);
    let applied = false;
    this.db.withTransactionSync(() => {
      const job = this.db.getFirstSync<JobRecord>(`SELECT ${jobColumns} FROM nutrition_jobs WHERE id = ? AND state = 'running' AND lease_token = ?`, id, leaseToken);
      if (!job) return;
      const meal = this.getMeal(job.mealId);
      if (meal.logState === 'discarded' || meal.revision !== job.revision || meal.nutritionStatus === 'manual') return;
      this.finishNutrition(job, estimate, date.toISOString());
      if (job.cacheKey) this.db.runSync('INSERT INTO nutrition_cache (cache_key, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at', job.cacheKey, JSON.stringify(estimate), date.toISOString());
      applied = true;
    });
    return applied;
  }

  failNutritionJob(id: string, leaseToken: string | null, errorCode: string, date = new Date()): boolean {
    if (!['network', 'invalid_result', 'backend_not_configured', 'budget_exceeded', 'not_food', 'photo_upload'].includes(errorCode)) throw new Error('Invalid estimation error code.');
    let failed = false;
    this.db.withTransactionSync(() => {
      const job = this.db.getFirstSync<JobRecord>(`SELECT ${jobColumns} FROM nutrition_jobs WHERE id = ? AND state = 'running' AND lease_token = ?`, id, leaseToken);
      if (!job) return;
      const next = new Date(date.getTime() + Math.min(3600, 30 * 2 ** Math.min(job.attempts - 1, 7)) * 1000).toISOString();
      this.db.runSync('UPDATE nutrition_jobs SET state = ?, next_attempt_at = ?, lease_token = NULL, lease_until = NULL, error_code = ?, updated_at = ? WHERE id = ?',
        errorCode === 'network' && job.attempts < 3 ? 'queued' : 'failed', next, errorCode, date.toISOString(), id);
      failed = true;
    });
    return failed;
  }

  deferNutritionJob(id: string, leaseToken: string | null, seconds: number, date = new Date()) {
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) throw new Error('Invalid retry delay.');
    this.db.runSync("UPDATE nutrition_jobs SET state = 'queued', next_attempt_at = ?, lease_token = NULL, lease_until = NULL, error_code = NULL, updated_at = ? WHERE id = ? AND state = 'running' AND lease_token = ?",
      new Date(date.getTime() + seconds * 1000).toISOString(), date.toISOString(), id, leaseToken);
  }

  retryNutritionJob(mealId: string, date = new Date()) {
    const meal = this.getMeal(mealId);
    this.db.runSync("UPDATE nutrition_jobs SET state = 'queued', attempts = 0, next_attempt_at = ?, error_code = NULL, updated_at = ? WHERE meal_id = ? AND revision = ? AND state = 'failed'", date.toISOString(), date.toISOString(), mealId, meal.revision);
  }
}
