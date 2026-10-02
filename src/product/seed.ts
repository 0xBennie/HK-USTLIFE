import { randomUUID } from 'node:crypto';
import { openDatabase, transaction } from './database.js';

export function seedDevelopmentAccounts(dataDir: string) {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeds forbidden in production.');
  const db = openDatabase(dataDir);
  try {
    transaction(db, () => {
      for (const [email, name, role] of [
        ['admin@example.test', 'Development administrator', 'admin'],
        ['student-a@example.test', 'Demo student A', 'member'],
        ['student-b@example.test', 'Demo student B', 'member'],
      ]) {
        db.prepare('INSERT OR IGNORE INTO users (id,email,display_name,role,created_at) VALUES (?,?,?,?,?)').run(randomUUID(), email, name, role, Date.now());
      }
    });
  } finally { db.close(); }
}
