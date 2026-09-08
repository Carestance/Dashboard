import db from '../database/connection.js';

const percent = (value, total) => total ? Math.round((value / total) * 100) : 0;
const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : 0;

function rulesFor(organizationId) {
  return Object.fromEntries(db.prepare(`SELECT rule_key, threshold FROM attention_rules
    WHERE organization_id = ? AND enabled = 1`).all(organizationId).map((row) => [row.rule_key, row.threshold]));
}

function studentRows(organizationId, { grade, section, classId } = {}) {
  const conditions = ['s.organization_id = ?'];
  const values = [organizationId];
  if (grade) { conditions.push('s.grade = ?'); values.push(grade); }
  if (section) { conditions.push('s.section = ?'); values.push(section); }
  if (classId) { conditions.push('ce.class_id = ?'); values.push(classId); }
  return db.prepare(`SELECT s.id, s.first_name, s.last_name, s.grade, s.section, c.id AS class_id, c.name AS class_name,
    COALESCE((SELECT MAX(occurred_at) FROM student_activity_events WHERE student_id = s.id), NULL) AS last_active_at,
    COALESCE((SELECT AVG(progress_percent) FROM roadmaps WHERE student_id = s.id), 0) AS roadmap_progress,
    (SELECT COUNT(*) FROM assessment_attempts aa JOIN assessment_assignments asa ON asa.id = aa.assignment_id WHERE aa.student_id = s.id) AS assessment_total,
    (SELECT COUNT(*) FROM assessment_attempts aa JOIN assessment_assignments asa ON asa.id = aa.assignment_id WHERE aa.student_id = s.id AND aa.status = 'completed') AS assessment_completed,
    (SELECT AVG(score) FROM assessment_attempts WHERE student_id = s.id AND status = 'completed') AS average_score,
    (SELECT COUNT(*) FROM task_assignments ta JOIN class_enrollments e ON e.class_id = ta.class_id WHERE e.student_id = s.id AND ta.type = 'weekly_goal') AS goal_total,
    (SELECT COUNT(*) FROM task_completions tc JOIN task_assignments ta ON ta.id = tc.task_assignment_id WHERE tc.student_id = s.id AND ta.type = 'weekly_goal' AND tc.completed_at IS NOT NULL) AS goal_completed
    FROM school_students s LEFT JOIN class_enrollments ce ON ce.student_id = s.id LEFT JOIN classes c ON c.id = ce.class_id
    WHERE ${conditions.join(' AND ')} ORDER BY s.grade, s.section, s.first_name, s.last_name`).all(...values);
}

function attentionFor(rows, rules) {
  const now = Date.now();
  return rows.map((student) => {
    const lastActiveDays = student.last_active_at ? Math.max(0, Math.floor((now - new Date(student.last_active_at).getTime()) / 86400000)) : 999;
    const incompleteAssessments = student.assessment_total - student.assessment_completed;
    const missedGoals = student.goal_total - student.goal_completed;
    const engagement = Math.round((percent(lastActiveDays <= 7 ? 1 : 0, 1) + percent(student.goal_completed, student.goal_total)) / 2);
    const signals = [];
    if (lastActiveDays >= (rules.inactive_days ?? 14)) signals.push({ key: 'inactive_days', label: `No activity for ${lastActiveDays} days` });
    if (incompleteAssessments >= (rules.incomplete_assessments ?? 2)) signals.push({ key: 'incomplete_assessments', label: `${incompleteAssessments} incomplete assessments` });
    if (student.roadmap_progress < (rules.roadmap_below_percent ?? 40)) signals.push({ key: 'roadmap_below_percent', label: 'Roadmap progress is below target' });
    if (missedGoals >= (rules.missed_weekly_goals ?? 2)) signals.push({ key: 'missed_weekly_goals', label: `${missedGoals} missed goals` });
    if (engagement < (rules.low_engagement_percent ?? 35)) signals.push({ key: 'low_engagement_percent', label: 'Low engagement' });
    return { ...student, lastActiveDays, incompleteAssessments, missedGoals, engagement, signals, status: signals.length >= 2 ? 'requires_attention' : signals.length ? 'watch' : 'on_track' };
  });
}

export function buildSchoolAdminDashboard({ organizationId }) {
  const students = attentionFor(studentRows(organizationId), rulesFor(organizationId));
  const assessmentTotal = students.reduce((sum, row) => sum + row.assessment_total, 0);
  const assessmentCompleted = students.reduce((sum, row) => sum + row.assessment_completed, 0);
  const activeStudents = students.filter((row) => row.lastActiveDays <= 14).length;
  const teachers = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE organization_id = ? AND role = 'teacher' AND is_active = 1`).get(organizationId).count;
  const classes = db.prepare('SELECT COUNT(*) AS count FROM classes WHERE organization_id = ?').get(organizationId).count;
  const activitySeries = db.prepare(`SELECT substr(sae.occurred_at, 1, 10) AS date, COUNT(DISTINCT sae.student_id) AS activeStudents
    FROM student_activity_events sae JOIN school_students s ON s.id = sae.student_id
    WHERE s.organization_id = ? AND sae.occurred_at >= datetime('now', '-29 days') GROUP BY date ORDER BY date`).all(organizationId);
  const careerDistribution = db.prepare(`SELECT ce.career_area AS careerArea, COUNT(DISTINCT ce.student_id) AS students
    FROM career_explorations ce JOIN school_students s ON s.id = ce.student_id WHERE s.organization_id = ?
    GROUP BY ce.career_area ORDER BY students DESC, careerArea`).all(organizationId);
  const skillGapDistribution = db.prepare(`SELECT sg.skill_name AS skill, COUNT(DISTINCT sg.student_id) AS students
    FROM skill_gaps sg JOIN school_students s ON s.id = sg.student_id WHERE s.organization_id = ?
    GROUP BY sg.skill_name ORDER BY students DESC, skill`).all(organizationId);
  const classPerformance = db.prepare(`SELECT c.id, c.name, c.grade, c.section, COUNT(DISTINCT e.student_id) AS students,
    ROUND(AVG(COALESCE((SELECT AVG(score) FROM assessment_attempts aa WHERE aa.student_id=e.student_id AND aa.status='completed'), 0))) AS averageScore,
    ROUND(AVG(COALESCE((SELECT AVG(progress_percent) FROM roadmaps r WHERE r.student_id=e.student_id), 0))) AS roadmapCompletion
    FROM classes c LEFT JOIN class_enrollments e ON e.class_id=c.id WHERE c.organization_id=? GROUP BY c.id ORDER BY c.grade, c.section`).all(organizationId);
  const gradeParticipation = db.prepare(`SELECT s.grade, COUNT(*) AS students,
    SUM(CASE WHEN EXISTS (SELECT 1 FROM student_activity_events sae WHERE sae.student_id=s.id AND sae.occurred_at >= datetime('now', '-14 days')) THEN 1 ELSE 0 END) AS activeStudents
    FROM school_students s WHERE s.organization_id=? GROUP BY s.grade ORDER BY CAST(s.grade AS INTEGER), s.grade`).all(organizationId).map((row) => ({ ...row, participation: percent(row.activeStudents, row.students) }));
  const requiringAttention = students.filter((row) => row.status === 'requires_attention');
  return { generatedAt: new Date().toISOString(), overview: {
    students: students.length, teachers, classes, activeStudents, assessmentCompletion: percent(assessmentCompleted, assessmentTotal), roadmapCompletion: average(students.map((row) => row.roadmap_progress)), studentsRequiringAttention: requiringAttention.length
  }, charts: { studentEngagement: activitySeries, assessmentCompletion: { completed: assessmentCompleted, outstanding: Math.max(0, assessmentTotal - assessmentCompleted), percentage: percent(assessmentCompleted, assessmentTotal) }, careerInterestDistribution: careerDistribution, skillGapDistribution, classWisePerformance: classPerformance, gradeWiseParticipation: gradeParticipation } };
}

export function getSchoolHierarchy({ organizationId, grade, section }) {
  const classes = db.prepare(`SELECT c.id, c.name, c.grade, c.section, c.academic_year, u.id AS teacher_id, u.display_name AS teacher_name,
    COUNT(e.student_id) AS student_count FROM classes c LEFT JOIN teacher_class_assignments a ON a.class_id=c.id
    LEFT JOIN users u ON u.id=a.teacher_user_id LEFT JOIN class_enrollments e ON e.class_id=c.id
    WHERE c.organization_id=? ${grade ? 'AND c.grade=?' : ''} ${section ? 'AND c.section=?' : ''}
    GROUP BY c.id, u.id ORDER BY CAST(c.grade AS INTEGER), c.grade, c.section, u.display_name`).all(organizationId, ...(grade ? [grade] : []), ...(section ? [section] : []));
  const grades = new Map();
  for (const item of classes) {
    if (!grades.has(item.grade)) grades.set(item.grade, { grade: item.grade, sections: [] });
    grades.get(item.grade).sections.push({ id: item.id, name: item.name, section: item.section, academicYear: item.academic_year, teacher: item.teacher_id ? { id: item.teacher_id, name: item.teacher_name } : null, studentCount: item.student_count });
  }
  return { grades: [...grades.values()], classes };
}

export function getAdminClass({ organizationId, classId }) {
  const classRecord = db.prepare('SELECT id, name, grade, section, academic_year FROM classes WHERE id=? AND organization_id=?').get(classId, organizationId);
  if (!classRecord) return null;
  const teachers = db.prepare(`SELECT u.id, u.display_name AS name FROM users u JOIN teacher_class_assignments a ON a.teacher_user_id=u.id WHERE a.class_id=?`).all(classId);
  const rules = rulesFor(organizationId);
  const students = attentionFor(studentRows(organizationId, { classId }), rules).map((row) => ({ id: row.id, name: `${row.first_name} ${row.last_name}`, assessmentCompletion: percent(row.assessment_completed, row.assessment_total), roadmapCompletion: Math.round(row.roadmap_progress), engagement: row.engagement, lastActiveAt: row.last_active_at, status: row.status, signals: row.signals }));
  return { class: { id: classRecord.id, name: classRecord.name, grade: classRecord.grade, section: classRecord.section, academicYear: classRecord.academic_year, teachers }, students };
}

export function getCareerInsights({ organizationId }) {
  const topInterests = db.prepare(`SELECT ce.career_area AS careerArea, COUNT(DISTINCT ce.student_id) AS students FROM career_explorations ce
    JOIN school_students s ON s.id=ce.student_id WHERE s.organization_id=? GROUP BY ce.career_area ORDER BY students DESC, careerArea`).all(organizationId);
  return { topStudentCareerInterests: topInterests, totalStudentsWithInterests: topInterests.reduce((sum, item) => sum + item.students, 0) };
}

export function getAttentionDashboard({ organizationId, grade, section, classId }) {
  const rules = rulesFor(organizationId);
  const rows = attentionFor(studentRows(organizationId, { grade, section, classId }), rules);
  const students = rows.filter((row) => row.status === 'requires_attention').sort((a, b) => b.signals.length - a.signals.length || a.roadmap_progress - b.roadmap_progress)
    .map((row) => ({ id: row.id, name: `${row.first_name} ${row.last_name}`, grade: row.grade, section: row.section, classId: row.class_id, className: row.class_name, lastActiveDays: row.lastActiveDays, assessmentCompletion: percent(row.assessment_completed, row.assessment_total), roadmapCompletion: Math.round(row.roadmap_progress), engagement: row.engagement, signals: row.signals }));
  return { count: students.length, rules: Object.entries(rules).map(([key, threshold]) => ({ key, threshold })), students };
}

export function updateAttentionRules({ organizationId, rules }) {
  const allowed = new Set(['inactive_days', 'incomplete_assessments', 'roadmap_below_percent', 'missed_weekly_goals', 'low_engagement_percent']);
  const save = db.prepare(`INSERT INTO attention_rules (organization_id, rule_key, threshold, enabled) VALUES (?, ?, ?, ?)
    ON CONFLICT(organization_id, rule_key) DO UPDATE SET threshold=excluded.threshold, enabled=excluded.enabled`);
  db.transaction(() => rules.forEach((rule) => save.run(organizationId, rule.key, rule.threshold, rule.enabled ? 1 : 0)))();
  return rulesFor(organizationId);
}
