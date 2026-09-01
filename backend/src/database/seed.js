import bcrypt from 'bcryptjs';
import db from './connection.js';
import { migrate } from './migrate.js';
import { generateCareerGrowthMap } from '../services/careerGrowthMaps.js';

migrate();

const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 86400000).toISOString();
const todayAt = (hour, minute = 0) => {
  const value = new Date(now);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
};

const reset = [
  'teacher_notes', 'student_activity_events', 'task_completions', 'task_assignments', 'growth_map_tasks', 'growth_map_skills', 'career_growth_maps', 'roadmaps', 'skill_gaps', 'simulation_history', 'career_explorations',
  'assessment_attempts', 'assessment_assignments', 'assessments', 'events', 'class_enrollments', 'teacher_class_assignments',
  'classes', 'school_students', 'consumer_profiles', 'teacher_profiles', 'attention_rules', 'users', 'organizations'
];

const seededStudentCareers = [];
db.transaction(() => {
  reset.forEach((table) => db.prepare(`DELETE FROM ${table}`).run());
  const schoolId = db.prepare("INSERT INTO organizations (name, type) VALUES (?, 'school')").run('CareStance Demo School').lastInsertRowid;
  const consumerOrgId = db.prepare("INSERT INTO organizations (name, type) VALUES (?, 'consumer')").run('CareStance Direct').lastInsertRowid;
  const passwordHash = bcrypt.hashSync('Teacher@123', 12);
  const teacherId = db.prepare("INSERT INTO users (organization_id, email, password_hash, role, display_name) VALUES (?, ?, ?, 'teacher', ?)")
    .run(schoolId, 'simran@carestance.demo', passwordHash, 'Ms. Simran').lastInsertRowid;
  db.prepare('INSERT INTO teacher_profiles (user_id, employee_code, title) VALUES (?, ?, ?)').run(teacherId, 'T-1001', 'Career Guidance Teacher');
  db.prepare("INSERT INTO users (organization_id, email, password_hash, role, display_name) VALUES (?, ?, ?, 'consumer', ?)")
    .run(consumerOrgId, 'learner@carestance.demo', bcrypt.hashSync('Consumer@123', 12), 'Demo Learner');

  const classId = db.prepare('INSERT INTO classes (organization_id, name, grade, section, academic_year) VALUES (?, ?, ?, ?, ?)')
    .run(schoolId, 'Class 10-A', '10', 'A', '2026-27').lastInsertRowid;
  db.prepare('INSERT INTO teacher_class_assignments (teacher_user_id, class_id) VALUES (?, ?)').run(teacherId, classId);
  const students = [
    ['Rahul', 'Sharma', 'CS-001', 0, 96], ['Ananya', 'Mehta', 'CS-002', 6, 35], ['Arjun', 'Kapoor', 'CS-003', 1, 65],
    ['Neha', 'Kapoor', 'CS-004', 4, 40], ['Ishaan', 'Gupta', 'CS-005', 3, 58], ['Karan', 'Singh', 'CS-006', 5, 45],
    ['Priya', 'Verma', 'CS-007', 0, 90], ['Sanya', 'Das', 'CS-008', 0, 93], ['Tara', 'Reddy', 'CS-009', 0, 95], ['Vikram', 'Malhotra', 'CS-010', 2, 48]
  ];
  const studentIds = students.map(([firstName, lastName, admissionNumber]) => {
    const id = db.prepare('INSERT INTO school_students (organization_id, admission_number, first_name, last_name, grade, section) VALUES (?, ?, ?, ?, ?, ?)')
      .run(schoolId, admissionNumber, firstName, lastName, '10', 'A').lastInsertRowid;
    db.prepare('INSERT INTO class_enrollments (class_id, student_id) VALUES (?, ?)').run(classId, id);
    return id;
  });

  const assessmentId = db.prepare('INSERT INTO assessments (organization_id, title) VALUES (?, ?)').run(schoolId, 'Career Readiness Assessment').lastInsertRowid;
  const assignmentId = db.prepare('INSERT INTO assessment_assignments (assessment_id, class_id, due_at) VALUES (?, ?, ?)').run(assessmentId, classId, daysAgo(-2)).lastInsertRowid;
  studentIds.forEach((studentId, index) => db.prepare('INSERT INTO assessment_attempts (assignment_id, student_id, status, score, completed_at) VALUES (?, ?, ?, ?, ?)')
    .run(assignmentId, studentId, index < 7 ? 'completed' : 'in_progress', index < 7 ? 72 + index * 3 : null, index < 7 ? daysAgo(index % 4) : null));

  studentIds.forEach((studentId, index) => {
    db.prepare('INSERT INTO roadmaps (student_id, title, progress_percent, updated_at) VALUES (?, ?, ?, ?)').run(studentId, 'Career Growth Roadmap', students[index][4], daysAgo(index % 6));
    db.prepare('INSERT INTO career_explorations (student_id, career_area, explored_at) VALUES (?, ?, ?)').run(studentId, ['Engineering', 'Design', 'Medicine'][index % 3], daysAgo(index));
    seededStudentCareers.push([studentId, ['Engineering', 'Design', 'Medicine'][index % 3]]);
    db.prepare('INSERT INTO simulation_history (student_id, simulation_name, result_summary, completed_at) VALUES (?, ?, ?, ?)').run(studentId, 'Career Exploration Simulation', ['Strong analytical fit', 'Creative problem-solving fit', 'Research-oriented fit'][index % 3], daysAgo(index + 1));
    db.prepare('INSERT INTO skill_gaps (student_id, skill_name, current_level, target_level, recommended_action) VALUES (?, ?, ?, ?, ?)').run(studentId, ['Communication', 'Design Thinking', 'Data Analysis'][index % 3], index % 2 ? 'Beginner' : 'Developing', 'Proficient', 'Complete the recommended practice module');
    db.prepare('INSERT INTO student_activity_events (student_id, activity_type, occurred_at) VALUES (?, ?, ?)').run(studentId, 'dashboard_activity', daysAgo(students[index][3]));
  });

  const weeklyTask = db.prepare('INSERT INTO task_assignments (class_id, title, type, due_at, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(classId, 'Complete career reflection', 'weekly_goal', daysAgo(-3), teacherId).lastInsertRowid;
  studentIds.forEach((studentId, index) => { if (index !== 1 && index !== 3 && index !== 5) db.prepare('INSERT INTO task_completions (task_assignment_id, student_id, completed_at) VALUES (?, ?, ?)').run(weeklyTask, studentId, daysAgo(index % 5)); });
  [
    ['Career Simulation – Round 2', 'simulation', 9, 0], ['Roadmap Check-in', 'review', 11, 0],
    ['Weekly Goal Review', 'class_activity', 13, 30], ['Assessment Window Closing', 'reminder', 15, 0]
  ].forEach(([title, type, hour, minute]) => db.prepare('INSERT INTO events (organization_id, class_id, title, event_type, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(schoolId, classId, title, type, todayAt(hour, minute), todayAt(hour + 1, minute)));
  [['inactive_days', 4], ['incomplete_assessments', 1], ['roadmap_below_percent', 50], ['missed_weekly_goals', 1]].forEach(([key, threshold]) =>
    db.prepare('INSERT INTO attention_rules (organization_id, rule_key, threshold) VALUES (?, ?, ?)').run(schoolId, key, threshold));
})();

// Demonstrate the same automatic result users receive after choosing a career.
seededStudentCareers.forEach(([studentId, careerArea]) => generateCareerGrowthMap({ studentId, careerArea }));

console.log('Seed complete. Teacher login: simran@carestance.demo / Teacher@123');
