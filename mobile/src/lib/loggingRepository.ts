import type { ExportData, MealInput, NutritionEstimate, NutritionJob, Profile, SavedMeal } from '../types';
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

type MealRecord = Omit<SavedMeal, 'time' | 'emoji' | 'assumptions' | 'estimateModel' | 'estimateState'> & {
  estimateJson: string | null;
  jobState: NutritionJob['state'] | null;
};
type JobRecord = Omit<NutritionJob, 'input'> & { inputJson: string };

const columns = `m.id, m.name, m.portion, m.kcal, m.protein, m.fibre, m.carbs, m.fat,
  m.nutrition_status AS nutritionStatus, m.logged_date AS loggedDate, m.created_at AS createdAt,
  m.updated_at AS updatedAt, m.input_type AS inputType, m.photo_uri AS photoUri, m.revision,
  e.payload AS estimateJson, j.state AS jobState`;
const mealFrom = `FROM meals m LEFT JOIN meal_estimates e ON e.meal_id = m.id AND e.revision = m.revision AND m.nutrition_status = 'pending'
  LEFT JOIN nutrition_jobs j ON j.meal_id = m.id AND j.revision = m.revision`;
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
    estimateState: record.nutritionStatus === 'manual' ? 'manual' : estimate ? 'estimated' : jobState === 'running' ? 'running' : jobState === 'failed' ? 'failed' : 'queued',
    assumptions: estimate?.assumptions ?? [],
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
    if (version > 2) throw new Error('Local data uses a newer app version. Update the app to open it.');
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
        const pending = this.db.getAllSync<MealRecord>(`SELECT ${columns} ${mealFrom} WHERE m.nutrition_status = 'pending'`);
        for (const meal of pending) this.prepareNutrition(meal.id, 0, {
          name: meal.name, portion: meal.portion, kcal: null, protein: null, fibre: null,
          carbs: null, fat: null, inputType: 'text', photoUri: null,
        }, meal.createdAt);
        this.db.execSync('PRAGMA user_version = 2;');
      });
    }
  }

  private newId() {
    const id = this.db.getFirstSync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id')?.id;
    if (!id) throw new Error('Could not create a record ID. Please try again.');
    return id;
  }

  private getMeal(id: string): SavedMeal {
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
    return this.db.getAllSync<MealRecord>(`SELECT ${columns} ${mealFrom} WHERE m.logged_date = ? ORDER BY m.created_at, m.rowid`, day).map(toMeal);
  }

  getMealDays(): string[] {
    return this.db.getAllSync<{ day: string }>('SELECT DISTINCT logged_date AS day FROM meals ORDER BY logged_date DESC').map((row) => row.day);
  }

  getExportData(): ExportData {
    let data: ExportData = { profile: null, meals: [] };
    this.db.withTransactionSync(() => {
      data = { profile: this.getProfile(), meals: this.db.getAllSync<MealRecord>(`SELECT ${columns} ${mealFrom} ORDER BY m.logged_date, m.created_at, m.rowid`).map(toMeal) };
    });
    return data;
  }

  addMeal(input: MealInput, date = new Date()): SavedMeal {
    const meal = validateMealInput(input);
    const id = this.newId();
    const timestamp = date.toISOString();
    let saved: SavedMeal;
    this.db.withTransactionSync(() => {
      this.db.runSync(
        'INSERT INTO meals (id, name, portion, kcal, protein, fibre, carbs, fat, nutrition_status, logged_date, created_at, updated_at, input_type, photo_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, meal.name, meal.portion, meal.kcal, meal.protein, meal.fibre, meal.carbs, meal.fat,
        meal.kcal === null ? 'pending' : 'manual', localDateKey(date), timestamp, timestamp, meal.inputType, meal.photoUri,
      );
      this.prepareNutrition(id, 0, meal, timestamp);
      saved = this.getMeal(id);
    });
    return saved!;
  }

  updateMeal(id: string, input: MealInput, date = new Date()): SavedMeal {
    let saved: SavedMeal;
    this.db.withTransactionSync(() => {
      const existing = this.getMeal(id);
      const meal = validateMealInput({ ...input, inputType: input.inputType ?? existing.inputType,
        photoUri: input.photoUri === undefined ? existing.photoUri : input.photoUri });
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

  getNutritionJobs(): NutritionJob[] {
    return this.db.getAllSync<JobRecord>(`SELECT ${jobColumns} FROM nutrition_jobs ORDER BY created_at, rowid`).map(toJob);
  }

  claimNutritionJob(date = new Date()): NutritionJob | null {
    let claimed: NutritionJob | null = null;
    const timestamp = date.toISOString();
    this.db.withTransactionSync(() => {
      while (true) {
        const record = this.db.getFirstSync<JobRecord>(`SELECT ${jobColumns} FROM nutrition_jobs
          WHERE (state IN ('queued', 'failed') AND next_attempt_at <= ?) OR (state = 'running' AND lease_until <= ?)
          ORDER BY created_at, rowid LIMIT 1`, timestamp, timestamp);
        if (!record) return;
        const meal = this.getMeal(record.mealId);
        if (meal.revision !== record.revision || meal.nutritionStatus === 'manual') {
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
      if (meal.revision !== job.revision || meal.nutritionStatus === 'manual') return;
      this.finishNutrition(job, estimate, date.toISOString());
      if (job.cacheKey) this.db.runSync('INSERT INTO nutrition_cache (cache_key, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at', job.cacheKey, JSON.stringify(estimate), date.toISOString());
      applied = true;
    });
    return applied;
  }

  failNutritionJob(id: string, leaseToken: string | null, errorCode: string, date = new Date()): boolean {
    if (!['network', 'invalid_result', 'backend_not_configured', 'budget_exceeded'].includes(errorCode)) throw new Error('Invalid estimation error code.');
    let failed = false;
    this.db.withTransactionSync(() => {
      const job = this.db.getFirstSync<JobRecord>(`SELECT ${jobColumns} FROM nutrition_jobs WHERE id = ? AND state = 'running' AND lease_token = ?`, id, leaseToken);
      if (!job) return;
      const next = new Date(date.getTime() + Math.min(3600, 30 * 2 ** Math.min(job.attempts - 1, 7)) * 1000).toISOString();
      this.db.runSync("UPDATE nutrition_jobs SET state = 'failed', next_attempt_at = ?, lease_token = NULL, lease_until = NULL, error_code = ?, updated_at = ? WHERE id = ?", next, errorCode, date.toISOString(), id);
      failed = true;
    });
    return failed;
  }

  retryNutritionJob(mealId: string, date = new Date()) {
    const meal = this.getMeal(mealId);
    this.db.runSync("UPDATE nutrition_jobs SET state = 'queued', next_attempt_at = ?, error_code = NULL, updated_at = ? WHERE meal_id = ? AND revision = ? AND state = 'failed'", date.toISOString(), date.toISOString(), mealId, meal.revision);
  }
}
