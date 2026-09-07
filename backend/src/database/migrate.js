import fs from 'node:fs';
import db from './connection.js';

export function migrate() {
  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
  // SQLite CREATE TABLE does not add columns to existing installations.
  const consumerColumns = db.prepare("PRAGMA table_info(consumer_profiles)").all().map((column) => column.name);
  if (!consumerColumns.includes('current_stage')) db.exec("ALTER TABLE consumer_profiles ADD COLUMN current_stage TEXT NOT NULL DEFAULT 'Exploration'");
}
