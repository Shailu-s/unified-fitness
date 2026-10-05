import { DatabaseSync } from 'node:sqlite';
import { LoggingRepository } from '../src/lib/loggingRepository.ts';

export function repositoryFor(db, overrides = {}) {
  return new LoggingRepository({
    execSync: (sql) => db.exec(sql),
    runSync: (sql, ...params) => db.prepare(sql).run(...params),
    getFirstSync: (sql, ...params) => db.prepare(sql).get(...params) ?? null,
    getAllSync: (sql, ...params) => db.prepare(sql).all(...params),
    withTransactionSync: (task) => {
      db.exec('BEGIN');
      try { task(); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    ...overrides,
  });
}

export function open(path = ':memory:') {
  const db = new DatabaseSync(path);
  const repository = repositoryFor(db);
  repository.initialize();
  return { db, repository };
}
