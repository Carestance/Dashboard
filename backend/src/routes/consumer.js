import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getConsumerDashboard } from '../services/consumerDashboard.js';

const router = Router();
router.use(requireAuth, requireRole('consumer'));
router.get('/dashboard', (req, res) => {
  const dashboard = getConsumerDashboard(req.auth.sub);
  if (!dashboard) return res.status(404).json({ error: 'Direct learner profile not found.' });
  res.json({ data: dashboard });
});
export default router;
