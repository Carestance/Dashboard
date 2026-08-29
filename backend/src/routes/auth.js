import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database/connection.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = db.prepare('SELECT id, organization_id, email, password_hash, role, display_name, is_active FROM users WHERE lower(email) = lower(?)').get(email);
  if (!user || !user.is_active || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' });
  const payload = { sub: user.id, organizationId: user.organization_id, role: user.role, name: user.display_name };
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.json({ token, user: { id: user.id, email: user.email, name: user.display_name, role: user.role, organizationId: user.organization_id } });
});
router.get('/me', requireAuth, (req, res) => res.json({ user: req.auth }));
export default router;
