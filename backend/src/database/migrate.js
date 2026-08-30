import fs from 'node:fs';
import db from './connection.js';

export function migrate() {
  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
}
