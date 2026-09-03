import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getParentDashboard } from '../services/parentDashboard.js';

const router = Router();
router.use(requireAuth, requireRole('parent'));
router.get('/dashboard', (req, res) => {
  const dashboard = getParentDashboard(req.auth.sub);
  if (!dashboard) return res.status(404).json({ error:'No child is linked to this parent account.' });
  res.json({ data:dashboard });
});

export default router;