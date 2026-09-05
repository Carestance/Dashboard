import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildSchoolAdminDashboard, getAdminClass, getAttentionDashboard, getCareerInsights, getSchoolHierarchy, updateAttentionRules } from '../services/schoolAdmin.js';

const router = Router();
router.use(requireAuth, requireRole('school_admin'));
const optionalText = (value) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : undefined;
const classIdFrom = (value) => { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; };

router.get('/dashboard', (req, res) => res.json({ data: buildSchoolAdminDashboard({ organizationId: req.auth.organizationId }) }));
router.get('/classes', (req, res) => res.json({ data: getSchoolHierarchy({ organizationId: req.auth.organizationId, grade: optionalText(req.query.grade), section: optionalText(req.query.section) }) }));
router.get('/classes/:classId', (req, res) => {
  const classId = classIdFrom(req.params.classId); if (!classId) return res.status(400).json({ error: 'A valid class ID is required.' });
  const data = getAdminClass({ organizationId: req.auth.organizationId, classId });
  if (!data) return res.status(404).json({ error: 'Class not found in this school.' });
  res.json({ data });
});
router.get('/career-insights', (req, res) => res.json({ data: getCareerInsights({ organizationId: req.auth.organizationId }) }));
router.get('/attention', (req, res) => {
  const classId = req.query.classId ? classIdFrom(req.query.classId) : undefined;
  if (req.query.classId && !classId) return res.status(400).json({ error: 'classId must be a positive integer.' });
  res.json({ data: getAttentionDashboard({ organizationId: req.auth.organizationId, grade: optionalText(req.query.grade), section: optionalText(req.query.section), classId }) });
});
router.put('/attention/rules', (req, res) => {
  const rules = req.body?.rules;
  const allowed = new Set(['inactive_days', 'incomplete_assessments', 'roadmap_below_percent', 'missed_weekly_goals', 'low_engagement_percent']);
  if (!Array.isArray(rules) || !rules.length || rules.some((rule) => !allowed.has(rule?.key) || !Number.isInteger(rule?.threshold) || rule.threshold < 0 || typeof rule.enabled !== 'boolean')) return res.status(400).json({ error: 'rules must contain valid rule keys, non-negative integer thresholds, and enabled flags.' });
  res.json({ data: { rules: updateAttentionRules({ organizationId: req.auth.organizationId, rules }) } });
});
export default router;
