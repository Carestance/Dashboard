import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(sourceDirectory, '..');

export const config = {
  port: Number(process.env.PORT || 3000),
  databasePath: path.resolve(backendDirectory, process.env.DATABASE_PATH || './data/carestance.db'),
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
