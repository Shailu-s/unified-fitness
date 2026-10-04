import type { ExportData, MealInput, Profile, SavedMeal } from '../types';
import { localDateKey, validateMealInput } from './meals.ts';

type Value = string | number | null;

interface Database {
  execSync: (sql: string) => void;
  withTransactionSync: (task: () => void) => void;
  runSync: (sql: string, ...params: Value[]) => unknown;
  getFirstSync: <T>(sql: string, ...params: Value[]) => T | null;
  getAllSync: <T>(sql: string, ...params: Value[]) => T[];
}

type MealRecord = Omit<SavedMeal, 'time' | 'emoji'>;

const columns = `id, name, portion, kcal, protein, fibre, nutrition_status AS nutritionStatus,
  logged_date AS loggedDate, created_at AS createdAt, updated_at AS updatedAt`;

function toMeal(record: MealRecord): SavedMeal {
  const date = new Date(record.createdAt);
  return {
    ...record,
    emoji: '',
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

export class LoggingRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  initialize() {
    const version = this.db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
    if (version > 1) throw new Error('Local data uses a newer app version. Update the app to open it.');
    this.db.execSync('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
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
    return this.db.getAllSync<MealRecord>(`SELECT ${columns} FROM meals WHERE logged_date = ? ORDER BY created_at, rowid`, day).map(toMeal);
  }

  getMealDays(): string[] {
    return this.db.getAllSync<{ day: string }>('SELECT DISTINCT logged_date AS day FROM meals ORDER BY logged_date DESC').map((row) => row.day);
  }

  getExportData(): ExportData {
    let data: ExportData = { profile: null, meals: [] };
    this.db.withTransactionSync(() => {
      data = {
        profile: this.getProfile(),
        meals: this.db.getAllSync<MealRecord>(`SELECT ${columns} FROM meals ORDER BY logged_date, created_at, rowid`).map(toMeal),
      };
    });
    return data;
  }

  addMeal(input: MealInput, date = new Date()): SavedMeal {
    const meal = validateMealInput(input);
    const id = this.db.getFirstSync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id')?.id;
    if (!id) throw new Error('Could not create a meal ID. Please try again.');
    const createdAt = date.toISOString();
    const record: MealRecord = {
      ...meal, id, createdAt, updatedAt: createdAt, loggedDate: localDateKey(date),
      nutritionStatus: meal.kcal === null ? 'pending' : 'manual',
    };
    this.db.runSync(
      'INSERT INTO meals (id, name, portion, kcal, protein, fibre, nutrition_status, logged_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, meal.name, meal.portion, meal.kcal, meal.protein, meal.fibre, record.nutritionStatus, record.loggedDate, createdAt, createdAt,
    );
    return toMeal(record);
  }

  updateMeal(id: string, input: MealInput, date = new Date()): SavedMeal {
    const meal = validateMealInput(input);
    const existing = this.db.getFirstSync<MealRecord>(`SELECT ${columns} FROM meals WHERE id = ?`, id);
    if (!existing) throw new Error('Meal not found.');
    const record: MealRecord = {
      ...existing, ...meal, updatedAt: date.toISOString(), nutritionStatus: meal.kcal === null ? 'pending' : 'manual',
    };
    this.db.runSync(
      'UPDATE meals SET name = ?, portion = ?, kcal = ?, protein = ?, fibre = ?, nutrition_status = ?, updated_at = ? WHERE id = ?',
      meal.name, meal.portion, meal.kcal, meal.protein, meal.fibre, record.nutritionStatus, record.updatedAt, id,
    );
    return toMeal(record);
  }
}
