import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { migrate } from './database/migrate.js';
import authRoutes from './routes/auth.js';
import teacherRoutes from './routes/teacher.js';
import parentRoutes from './routes/parent.js';
import schoolAdminRoutes from './routes/schoolAdmin.js';

migrate();
const app = express();
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));
const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');
app.use(express.static(frontendDirectory));
app.get('/', (_req, res) => res.redirect('/login.html'));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/teacher', teacherRoutes);
app.use('/api/v1/parent', parentRoutes);
app.use('/api/v1/school-admin', schoolAdminRoutes);
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});
export default app;
