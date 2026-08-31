import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildTeacherDashboard } from '../services/teacherDashboard.js';
import { addTeacherNote, getClassRoster, getStudentProfile } from '../services/teacherStudents.js';
import { generateCareerGrowthMap, setGrowthMapTaskCompletion } from '../services/careerGrowthMaps.js';
import { createAssessment, createEvent, createTask, getClassAssessments, getClassWork } from '../services/teacherWork.js';

const text = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

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
router.get('/classes/:classId/work', (req, res) => {
  const data = getClassWork({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, classId:Number(req.params.classId) });
  if (!data) return res.status(404).json({ error:'Class not found or not assigned to this teacher.' });
  res.json({ data });
});
router.post('/classes/:classId/tasks', (req, res) => {
  const title = text(req.body?.title); const type = text(req.body?.type, 40) || 'weekly_goal'; const dueAt = req.body?.dueAt;
  if (!title || !validDate(dueAt)) return res.status(400).json({ error:'A title and valid due date are required.' });
  const data = createTask({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, classId:Number(req.params.classId), title, type, dueAt });
  if (!data) return res.status(404).json({ error:'Class not found or not assigned to this teacher.' });
  res.status(201).json({ data });
});
router.post('/classes/:classId/events', (req, res) => {
  const title = text(req.body?.title); const eventType = text(req.body?.eventType, 40) || 'event'; const { startsAt, endsAt } = req.body || {};
  if (!title || !validDate(startsAt) || (endsAt && !validDate(endsAt))) return res.status(400).json({ error:'A title and valid start time are required.' });
  const data = createEvent({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, classId:Number(req.params.classId), title, eventType, startsAt, endsAt:endsAt || null });
  if (!data) return res.status(404).json({ error:'Class not found or not assigned to this teacher.' });
  res.status(201).json({ data });
});
router.get('/classes/:classId/assessments', (req, res) => {
  const data = getClassAssessments({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, classId:Number(req.params.classId) });
  if (!data) return res.status(404).json({ error:'Class not found or not assigned to this teacher.' });
  res.json({ data });
});
router.post('/classes/:classId/assessments', (req, res) => {
  const title = text(req.body?.title); const dueAt = req.body?.dueAt;
  if (!title || !validDate(dueAt)) return res.status(400).json({ error:'An assessment title and valid due date are required.' });
  const data = createAssessment({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, classId:Number(req.params.classId), title, dueAt });
  if (!data) return res.status(404).json({ error:'Class not found or not assigned to this teacher.' });
  res.status(201).json({ data });
});
router.get('/students/:studentId', (req, res) => {
  const profile = getStudentProfile({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, studentId:Number(req.params.studentId) });
  if (!profile) return res.status(404).json({ error:'Student not found or not assigned to this teacher.' });
  res.json({ data:profile });
});
router.post('/students/:studentId/growth-maps', (req, res) => {
  const studentId = Number(req.params.studentId);
  const profile = getStudentProfile({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, studentId });
  if (!profile) return res.status(404).json({ error:'Student not found or not assigned to this teacher.' });
  const careerArea = typeof req.body?.careerArea === 'string' ? req.body.careerArea.trim() : '';
  if (!careerArea || careerArea.length > 80) return res.status(400).json({ error:'A career between 1 and 80 characters is required.' });
  const map = generateCareerGrowthMap({ studentId, careerArea });
  res.status(201).json({ data:map });
});
router.patch('/students/:studentId/growth-map-tasks/:taskId', (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!getStudentProfile({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, studentId })) return res.status(404).json({ error:'Student not found or not assigned to this teacher.' });
  if (typeof req.body?.completed !== 'boolean') return res.status(400).json({ error:'completed must be true or false.' });
  const data = setGrowthMapTaskCompletion({ taskId:Number(req.params.taskId), studentId, completed:req.body.completed });
  if (!data) return res.status(404).json({ error:'Growth-map task not found for this student.' });
  res.json({ data });
});
router.post('/students/:studentId/notes', (req, res) => {
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!note || note.length > 1000) return res.status(400).json({ error:'A note between 1 and 1000 characters is required.' });
  const saved = addTeacherNote({ teacherUserId:req.auth.sub, organizationId:req.auth.organizationId, studentId:Number(req.params.studentId), note });
  if (!saved) return res.status(404).json({ error:'Student not found or not assigned to this teacher.' });
  res.status(201).json({ data:saved });
});
export default router;
