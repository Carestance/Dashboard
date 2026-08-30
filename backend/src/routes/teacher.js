import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildTeacherDashboard } from '../services/teacherDashboard.js';
import { addTeacherNote, getClassRoster, getStudentProfile } from '../services/teacherStudents.js';

const router = Router();
router.use(requireAuth, requireRole('teacher'));
router.get('/dashboard', (req, res) => {
  const classId = req.query.classId ? Number(req.query.classId) : undefined;
  if (req.query.classId && (!Number.isInteger(classId) || classId < 1)) return res.status(400).json({ error: 'classId must be a positive integer.' });
  const dashboard = buildTeacherDashboard({ teacherUserId: req.auth.sub, organizationId: req.auth.organizationId, classId });
  if (!dashboard) return res.status(404).json({ error: 'Class not found or not assigned to this teacher.' });
  res.json({ data: dashboard });
});
router.get('/classes/:classId/students', (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ error:'A valid class ID is required.' });
  const roster = getClassRoster({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, classId });
  if (!roster) return res.status(404).json({ error:'Class not found or not assigned to this teacher.' });
  res.json({ data:roster });
});
router.get('/students/:studentId', (req, res) => {
  const profile = getStudentProfile({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, studentId:Number(req.params.studentId) });
  if (!profile) return res.status(404).json({ error:'Student not found or not assigned to this teacher.' });
  res.json({ data:profile });
});
router.post('/students/:studentId/notes', (req, res) => {
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!note || note.length > 1000) return res.status(400).json({ error:'A note between 1 and 1000 characters is required.' });
  const saved = addTeacherNote({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, studentId:Number(req.params.studentId), note });
  if (!saved) return res.status(404).json({ error:'Student not found or not assigned to this teacher.' });
  res.status(201).json({ data:saved });
});
export default router;
