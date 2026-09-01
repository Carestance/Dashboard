import db from '../database/connection.js';
import { getTeacherClass } from './teacherDashboard.js';
import { getStudentCareerGrowthMaps } from './careerGrowthMaps.js';

const percent = (value, total) => total ? Math.round((value / total) * 100) : 0;

function rosterRows(classId, organizationId) {
  return db.prepare(`SELECT s.id, s.first_name, s.last_name, s.grade, s.section,
    COALESCE((SELECT AVG(progress_percent) FROM roadmaps WHERE student_id = s.id), 0) AS roadmap_progress,
    (SELECT COUNT(*) FROM assessment_attempts aa JOIN assessment_assignments asa ON asa.id = aa.assignment_id WHERE aa.student_id=s.id AND asa.class_id=?) AS assessment_total,
    (SELECT COUNT(*) FROM assessment_attempts aa JOIN assessment_assignments asa ON asa.id = aa.assignment_id WHERE aa.student_id=s.id AND asa.class_id=? AND aa.status='completed') AS assessment_completed,
    (SELECT COUNT(*) FROM task_assignments WHERE class_id=? AND type='weekly_goal') AS weekly_total,
    (SELECT COUNT(*) FROM task_completions tc JOIN task_assignments ta ON ta.id=tc.task_assignment_id WHERE tc.student_id=s.id AND ta.class_id=? AND ta.type='weekly_goal' AND tc.completed_at IS NOT NULL) AS weekly_completed,
    (SELECT COUNT(*) FROM career_explorations WHERE student_id=s.id) AS careers_explored,
    (SELECT GROUP_CONCAT(DISTINCT career_area) FROM career_explorations WHERE student_id=s.id) AS career_areas,
    (SELECT MAX(occurred_at) FROM student_activity_events WHERE student_id=s.id) AS last_active_at
    FROM school_students s JOIN class_enrollments ce ON ce.student_id=s.id WHERE ce.class_id=? ORDER BY s.first_name, s.last_name`).all(classId, classId, classId, classId, classId).map((row) => {
      const lastActiveDays = row.last_active_at ? Math.floor((Date.now() - new Date(row.last_active_at).getTime()) / 86400000) : 999;
      const assessmentCompletion = percent(row.assessment_completed, row.assessment_total);
      const weeklyGoalCompletion = percent(row.weekly_completed, row.weekly_total);
      const signals = [];
      if (lastActiveDays >= 4) signals.push('inactive');
      if (row.roadmap_progress < 50) signals.push('roadmap');
      if (assessmentCompletion < 70) signals.push('assessment');
      if (weeklyGoalCompletion < 70) signals.push('weekly_goal');
      return { id:row.id, name:`${row.first_name} ${row.last_name}`, className:`Class ${row.grade}-${row.section}`, assessmentCompletion, roadmapProgress:Math.round(row.roadmap_progress), weeklyGoalCompletion, careerExplorationStatus:row.careers_explored ? 'Explored' : 'Not started', careerAreas:row.career_areas?.split(',') || [], lastActiveAt:row.last_active_at, lastActiveDays, attentionStatus:signals.length > 1 ? 'at_risk' : signals.length ? 'watch' : 'on_track', signals };
    });
}

export function getClassRoster({ teacherUserId, organizationId, classId }) {
  const classRecord = getTeacherClass(teacherUserId, organizationId, classId);
  if (!classRecord) return null;
  return { class:classRecord, students:rosterRows(classRecord.id, organizationId) };
}

export function getStudentProfile({ teacherUserId, organizationId, studentId }) {
  const student = db.prepare(`SELECT s.id, s.first_name, s.last_name, s.grade, s.section, c.id AS class_id, c.name AS class_name
    FROM school_students s JOIN class_enrollments ce ON ce.student_id=s.id JOIN classes c ON c.id=ce.class_id
    JOIN teacher_class_assignments tca ON tca.class_id=c.id WHERE s.id=? AND c.organization_id=? AND tca.teacher_user_id=?`).get(studentId, organizationId, teacherUserId);
  if (!student) return null;
  const assessments = db.prepare(`SELECT a.title, aa.status, aa.score, aa.completed_at FROM assessment_attempts aa JOIN assessment_assignments asa ON asa.id=aa.assignment_id JOIN assessments a ON a.id=asa.assessment_id WHERE aa.student_id=? ORDER BY aa.completed_at DESC`).all(studentId);
  const tasks = db.prepare(`SELECT ta.id, ta.title, ta.type, ta.due_at, tc.completed_at FROM task_assignments ta JOIN class_enrollments ce ON ce.class_id=ta.class_id LEFT JOIN task_completions tc ON tc.task_assignment_id=ta.id AND tc.student_id=ce.student_id WHERE ce.student_id=? ORDER BY ta.due_at`).all(studentId);
  const growthMaps = getStudentCareerGrowthMaps(studentId);
  const personalizedTasks = growthMaps.flatMap((map) => map.tasks.map((task) => ({ ...task, career_area:map.career_area, personalized:true })));
  return {
    student:{ id:student.id, name:`${student.first_name} ${student.last_name}`, className:student.class_name },
    assessments,
    careerInterests:db.prepare('SELECT career_area, explored_at FROM career_explorations WHERE student_id=? ORDER BY explored_at DESC').all(studentId),
    simulations:db.prepare('SELECT simulation_name, result_summary, completed_at FROM simulation_history WHERE student_id=? ORDER BY completed_at DESC').all(studentId),
    skillGaps:db.prepare('SELECT skill_name, current_level, target_level, recommended_action FROM skill_gaps WHERE student_id=?').all(studentId),
    roadmap:db.prepare('SELECT title, progress_percent, updated_at FROM roadmaps WHERE student_id=?').all(studentId),
    growthMaps,
    tasks:{ completed:[...tasks, ...personalizedTasks].filter((task) => task.completed_at), pending:[...tasks, ...personalizedTasks].filter((task) => !task.completed_at) },
    notes:db.prepare(`SELECT tn.id, tn.note, tn.created_at, u.display_name AS author FROM teacher_notes tn JOIN users u ON u.id=tn.teacher_user_id WHERE tn.student_id=? ORDER BY tn.created_at DESC`).all(studentId),
    timeline:db.prepare('SELECT activity_type, occurred_at FROM student_activity_events WHERE student_id=? ORDER BY occurred_at DESC LIMIT 20').all(studentId)
  };
}

export function addTeacherNote({ teacherUserId, organizationId, studentId, note }) {
  if (!getStudentProfile({ teacherUserId, organizationId, studentId })) return null;
  const result = db.prepare('INSERT INTO teacher_notes (student_id, teacher_user_id, note) VALUES (?, ?, ?)').run(studentId, teacherUserId, note.trim());
  return db.prepare(`SELECT tn.id, tn.note, tn.created_at, u.display_name AS author FROM teacher_notes tn JOIN users u ON u.id=tn.teacher_user_id WHERE tn.id=?`).get(result.lastInsertRowid);
}
