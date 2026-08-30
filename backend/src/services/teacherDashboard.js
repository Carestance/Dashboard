import db from '../database/connection.js';

function percent(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

export function getTeacherClass(teacherUserId, organizationId, requestedClassId) {
  const base = `SELECT c.id, c.name, c.grade, c.section FROM classes c
    JOIN teacher_class_assignments tca ON tca.class_id = c.id
    WHERE tca.teacher_user_id = ? AND c.organization_id = ?`;
  const query = requestedClassId ? `${base} AND c.id = ?` : `${base} ORDER BY c.name LIMIT 1`;
  return requestedClassId
    ? db.prepare(query).get(teacherUserId, organizationId, requestedClassId)
    : db.prepare(query).get(teacherUserId, organizationId);
}

function getAttentionRules(organizationId) {
  return Object.fromEntries(db.prepare('SELECT rule_key, threshold FROM attention_rules WHERE organization_id = ? AND enabled = 1').all(organizationId).map((row) => [row.rule_key, row.threshold]));
}

export function buildTeacherDashboard({ teacherUserId, organizationId, classId }) {
  const classRecord = getTeacherClass(teacherUserId, organizationId, classId);
  if (!classRecord) return null;
  const classIdValue = classRecord.id;
  const students = db.prepare(`SELECT s.id, s.first_name, s.last_name,
    COALESCE((SELECT MAX(occurred_at) FROM student_activity_events sae WHERE sae.student_id = s.id), NULL) AS last_active_at,
    COALESCE((SELECT AVG(r.progress_percent) FROM roadmaps r WHERE r.student_id = s.id), 0) AS roadmap_progress,
    (SELECT COUNT(*) FROM assessment_attempts aa JOIN assessment_assignments asa ON asa.id = aa.assignment_id WHERE aa.student_id = s.id AND asa.class_id = ?) AS assessment_total,
    (SELECT COUNT(*) FROM assessment_attempts aa JOIN assessment_assignments asa ON asa.id = aa.assignment_id WHERE aa.student_id = s.id AND asa.class_id = ? AND aa.status = 'completed') AS assessment_completed,
    (SELECT COUNT(*) FROM task_assignments ta WHERE ta.class_id = ? AND ta.type = 'weekly_goal') AS weekly_goal_total,
    (SELECT COUNT(*) FROM task_completions tc JOIN task_assignments ta ON ta.id = tc.task_assignment_id WHERE tc.student_id = s.id AND ta.class_id = ? AND ta.type = 'weekly_goal' AND tc.completed_at IS NOT NULL) AS weekly_goal_completed
    FROM school_students s JOIN class_enrollments ce ON ce.student_id = s.id WHERE ce.class_id = ? ORDER BY s.first_name, s.last_name`).all(classIdValue, classIdValue, classIdValue, classIdValue, classIdValue);
  const rules = getAttentionRules(organizationId);
  const now = Date.now();
  const attentionStudents = students.map((student) => {
    const lastActiveDays = student.last_active_at ? Math.floor((now - new Date(student.last_active_at).getTime()) / 86400000) : Number.MAX_SAFE_INTEGER;
    const incompleteAssessments = student.assessment_total - student.assessment_completed;
    const missedGoals = student.weekly_goal_total - student.weekly_goal_completed;
    const signals = [];
    if (lastActiveDays >= (rules.inactive_days ?? 14)) signals.push(`No activity for ${lastActiveDays} days`);
    if (incompleteAssessments >= (rules.incomplete_assessments ?? 2)) signals.push(`${incompleteAssessments} incomplete assessment${incompleteAssessments === 1 ? '' : 's'}`);
    if (student.roadmap_progress < (rules.roadmap_below_percent ?? 40)) signals.push('Roadmap progress is below target');
    if (missedGoals >= (rules.missed_weekly_goals ?? 2)) signals.push(`${missedGoals} weekly goal${missedGoals === 1 ? '' : 's'} missed`);
    const status = signals.length >= 2 ? 'at_risk' : signals.length === 1 ? 'watch' : 'on_track';
    return { ...student, lastActiveDays, incompleteAssessments, missedGoals, signals, status };
  });
  const activeThisWeek = attentionStudents.filter((student) => student.lastActiveDays <= 7).length;
  const assessments = attentionStudents.reduce((sum, student) => sum + student.assessment_total, 0);
  const completedAssessments = attentionStudents.reduce((sum, student) => sum + student.assessment_completed, 0);
  const averageRoadmap = attentionStudents.length ? Math.round(attentionStudents.reduce((sum, student) => sum + student.roadmap_progress, 0) / attentionStudents.length) : 0;
  const weeklyGoals = attentionStudents.reduce((sum, student) => sum + student.weekly_goal_total, 0);
  const completedWeeklyGoals = attentionStudents.reduce((sum, student) => sum + student.weekly_goal_completed, 0);
  const careerExploration = db.prepare(`SELECT COUNT(DISTINCT ce.student_id) AS explored FROM career_explorations ce
    JOIN class_enrollments en ON en.student_id = ce.student_id WHERE en.class_id = ?`).get(classIdValue).explored;
  const activities = db.prepare(`SELECT substr(occurred_at, 1, 10) AS day, COUNT(DISTINCT student_id) AS active_students
    FROM student_activity_events WHERE student_id IN (SELECT student_id FROM class_enrollments WHERE class_id = ?)
    AND occurred_at >= datetime('now', '-6 days') GROUP BY day ORDER BY day`).all(classIdValue);
  const events = db.prepare(`SELECT id, title, event_type, starts_at, ends_at FROM events
    WHERE organization_id = ? AND (class_id = ? OR class_id IS NULL) AND date(starts_at) = date('now') ORDER BY starts_at`).all(organizationId, classIdValue);
  const attention = attentionStudents.filter((student) => student.status !== 'on_track').sort((a, b) => b.signals.length - a.signals.length || a.roadmap_progress - b.roadmap_progress);
  const assessmentCompletion = percent(completedAssessments, assessments);
  const weeklyGoalCompletion = percent(completedWeeklyGoals, weeklyGoals);
  const overallProgress = Math.round((assessmentCompletion + averageRoadmap + weeklyGoalCompletion) / 3);
  return {
    class: classRecord,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalStudents: attentionStudents.length,
      activeThisWeek,
      assessmentCompletion,
      averageProgress: overallProgress,
      engagementScore: Math.round((percent(activeThisWeek, attentionStudents.length) + weeklyGoalCompletion) / 2),
      studentsNeedingAttention: attention.length
    },
    performanceAreas: { assessments: assessmentCompletion, careerExploration: percent(careerExploration, attentionStudents.length), roadmapProgress: averageRoadmap, weeklyGoals: weeklyGoalCompletion },
    activitySeries: activities,
    upcomingEvents: events,
    attentionStudents: attention.slice(0, 8).map((student) => ({ id: student.id, name: `${student.first_name} ${student.last_name}`, status: student.status, roadmapProgress: Math.round(student.roadmap_progress), lastActiveDays: student.lastActiveDays, signals: student.signals })),
    availableClasses: db.prepare(`SELECT c.id, c.name FROM classes c JOIN teacher_class_assignments tca ON tca.class_id = c.id WHERE tca.teacher_user_id = ? AND c.organization_id = ? ORDER BY c.name`).all(teacherUserId, organizationId)
  };
}
