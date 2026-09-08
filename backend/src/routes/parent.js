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
router.get('/journey', (req, res) => {
  const dashboard = getParentDashboard(req.auth.sub);
  if (!dashboard) return res.status(404).json({ error:'No child is linked to this parent account.' });
  res.json({ data: { child: dashboard.child, journey: dashboard.journey, interests: dashboard.interests, skills: dashboard.skills, simulations: dashboard.simulations, roadmap: dashboard.roadmap } });
});
router.get('/insights', (req, res) => {
  const dashboard = getParentDashboard(req.auth.sub);
  if (!dashboard) return res.status(404).json({ error:'No child is linked to this parent account.' });
  res.json({ data: { child: dashboard.child, insights: dashboard.insights, achievements: dashboard.achievements, metrics: dashboard.metrics } });
});
router.get('/reports/:reportType', (req, res) => {
  const reportType = req.params.reportType;
  if (!['career', 'progress', 'monthly', 'skills', 'simulation'].includes(reportType)) return res.status(400).json({ error:'reportType must be career, progress, monthly, skills, or simulation.' });
  const dashboard = getParentDashboard(req.auth.sub);
  if (!dashboard) return res.status(404).json({ error:'No child is linked to this parent account.' });
  res.json({ data: { child: dashboard.child, reportType, report: dashboard.reports[reportType], generatedAt: new Date().toISOString() } });
});

export default router;
