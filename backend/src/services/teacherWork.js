import db from '../database/connection.js';
import { getTeacherClass } from './teacherDashboard.js';

function ownedClass(teacherUserId, organizationId, classId) {
  return getTeacherClass(teacherUserId, organizationId, classId);
}

export function getClassWork({ teacherUserId, organizationId, classId }) {
  const classRecord = ownedClass(teacherUserId, organizationId, classId);
  if (!classRecord) return null;
  return {
    class: classRecord,
    tasks: db.prepare('SELECT id, title, type, due_at, created_by FROM task_assignments WHERE class_id=? ORDER BY due_at').all(classId),
    events: db.prepare('SELECT id, title, event_type, starts_at, ends_at FROM events WHERE organization_id=? AND (class_id=? OR class_id IS NULL) ORDER BY starts_at').all(organizationId, classId)
  };
}

export function createTask({ teacherUserId, organizationId, classId, title, type, dueAt }) {
  if (!ownedClass(teacherUserId, organizationId, classId)) return null;
  const result = db.prepare('INSERT INTO task_assignments (class_id, title, type, due_at, created_by) VALUES (?, ?, ?, ?, ?)').run(classId, title, type, dueAt, teacherUserId);
  return db.prepare('SELECT id, title, type, due_at FROM task_assignments WHERE id=?').get(result.lastInsertRowid);
}

export function createEvent({ teacherUserId, organizationId, classId, title, eventType, startsAt, endsAt }) {
  if (!ownedClass(teacherUserId, organizationId, classId)) return null;
  const result = db.prepare('INSERT INTO events (organization_id, class_id, title, event_type, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)').run(organizationId, classId, title, eventType, startsAt, endsAt);
  return db.prepare('SELECT id, title, event_type, starts_at, ends_at FROM events WHERE id=?').get(result.lastInsertRowid);
}

export function getClassAssessments({ teacherUserId, organizationId, classId }) {
  if (!ownedClass(teacherUserId, organizationId, classId)) return null;
  return db.prepare(`SELECT a.id, a.title, a.is_active, aa.due_at, COUNT(at.id) AS assigned,
    SUM(CASE WHEN at.status='completed' THEN 1 ELSE 0 END) AS completed, AVG(at.score) AS average_score
    FROM assessments a JOIN assessment_assignments aa ON aa.assessment_id=a.id
    LEFT JOIN assessment_attempts at ON at.assignment_id=aa.id
    WHERE aa.class_id=? GROUP BY aa.id ORDER BY aa.due_at DESC`).all(classId);
}

export function createAssessment({ teacherUserId, organizationId, classId, title, dueAt }) {
  if (!ownedClass(teacherUserId, organizationId, classId)) return null;
  const save = db.transaction(() => {
    const assessmentId = db.prepare('INSERT INTO assessments (organization_id, title) VALUES (?, ?)').run(organizationId, title).lastInsertRowid;
    const assignmentId = db.prepare('INSERT INTO assessment_assignments (assessment_id, class_id, due_at) VALUES (?, ?, ?)').run(assessmentId, classId, dueAt).lastInsertRowid;
    const addAttempt = db.prepare("INSERT INTO assessment_attempts (assignment_id, student_id, status) VALUES (?, ?, 'assigned')");
    db.prepare('SELECT student_id FROM class_enrollments WHERE class_id=?').all(classId).forEach(({ student_id }) => addAttempt.run(assignmentId, student_id));
    return assessmentId;
  });
  const id = save();
  return db.prepare('SELECT id, title, is_active FROM assessments WHERE id=?').get(id);
}
