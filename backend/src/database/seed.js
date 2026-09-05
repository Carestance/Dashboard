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
  'student_achievements', 'parent_children', 'assessment_attempts', 'assessment_assignments', 'assessments', 'events', 'class_enrollments', 'teacher_class_assignments',
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
  const parentId = db.prepare("INSERT INTO users (organization_id, email, password_hash, role, display_name) VALUES (?, ?, ?, 'parent', ?)")
    .run(schoolId, 'parent@carestance.demo', bcrypt.hashSync('Parent@123', 12), 'Demo Parent').lastInsertRowid;
  db.prepare("INSERT INTO users (organization_id, email, password_hash, role, display_name) VALUES (?, ?, ?, 'school_admin', ?)")
    .run(schoolId, 'admin@carestance.demo', bcrypt.hashSync('Admin@123', 12), 'Demo School Admin');
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
  db.prepare('INSERT INTO parent_children (parent_user_id, school_student_id, relationship) VALUES (?, ?, ?)').run(parentId, studentIds[0], 'parent');

  const assessmentId = db.prepare('INSERT INTO assessments (organization_id, title) VALUES (?, ?)').run(schoolId, 'Career Readiness Assessment').lastInsertRowid;
  const assignmentId = db.prepare('INSERT INTO assessment_assignments (assessment_id, class_id, due_at) VALUES (?, ?, ?)').run(assessmentId, classId, daysAgo(-2)).lastInsertRowid;
  studentIds.forEach((studentId, index) => db.prepare('INSERT INTO assessment_attempts (assignment_id, student_id, status, score, completed_at) VALUES (?, ?, ?, ?, ?)')
    .run(assignmentId, studentId, index < 7 ? 'completed' : 'in_progress', index < 7 ? 72 + index * 3 : null, index < 7 ? daysAgo(index % 4) : null));
  db.prepare('INSERT INTO student_achievements (student_id, title, description, earned_at) VALUES (?, ?, ?, ?)')
    .run(studentIds[0], 'Assessment finisher', 'Completed the latest career readiness assessment.', daysAgo(2));
  db.prepare('INSERT INTO student_achievements (student_id, title, description, earned_at) VALUES (?, ?, ?, ?)')
    .run(studentIds[0], 'Career explorer', 'Explored a new career area and created a growth map.', daysAgo(5));

  studentIds.forEach((studentId, index) => {
    db.prepare('INSERT INTO roadmaps (student_id, title, progress_percent, updated_at) VALUES (?, ?, ?, ?)').run(studentId, 'Career Growth Roadmap', students[index][4], daysAgo(index % 6));
    db.prepare('INSERT INTO career_explorations (student_id, career_area, explored_at) VALUES (?, ?, ?)').run(studentId, ['Engineering', 'Design', 'Medicine'][index % 3], daysAgo(index));
    seededStudentCareers.push([studentId, ['Engineering', 'Design', 'Medicine'][index % 3]]);
    db.prepare('INSERT INTO simulation_history (student_id, simulation_name, result_summary, completed_at) VALUES (?, ?, ?, ?)').run(studentId, 'Career Exploration Simulation', ['Strong analytical fit', 'Creative problem-solving fit', 'Research-oriented fit'][index % 3], daysAgo(index + 1));
    db.prepare('INSERT INTO skill_gaps (student_id, skill_name, current_level, target_level, recommended_action) VALUES (?, ?, ?, ?, ?)').run(studentId, ['Communication', 'Design Thinking', 'Data Analysis'][index % 3], index % 2 ? 'Beginner' : 'Developing', 'Proficient', 'Complete the recommended practice module');
    db.prepare('INSERT INTO student_activity_events (student_id, activity_type, occurred_at) VALUES (?, ?, ?)').run(studentId, 'dashboard_activity', daysAgo(students[index][3]));
  });

  // A school-scale, deterministic dataset makes the admin analytics useful immediately.
  // The original Class 10-A remains intentionally small for the teacher demo.
  const adminTeachers = [];
  for (let index = 0; index < 67; index += 1) {
    const id = db.prepare("INSERT INTO users (organization_id, email, password_hash, role, display_name) VALUES (?, ?, ?, 'teacher', ?)")
      .run(schoolId, `teacher${index + 2}@carestance.demo`, passwordHash, `Teacher ${index + 2}`).lastInsertRowid;
    db.prepare('INSERT INTO teacher_profiles (user_id, employee_code, title) VALUES (?, ?, ?)').run(id, `T-${1002 + index}`, 'Career Guidance Teacher');
    adminTeachers.push(id);
  }
  const supplementalCareers = [
    ...Array(214).fill('Engineering'), ...Array(170).fill('Medicine'), ...Array(93).fill('Design'),
    ...Array(81).fill('Management'), ...Array(54).fill('Law'), ...Array(155).fill('Education'),
    ...Array(155).fill('Commerce'), ...Array(154).fill('Science'), ...Array(154).fill('Arts')
  ];
  let extraStudentIndex = 0;
  for (let classIndex = 0; classIndex < 41; classIndex += 1) {
    const grade = String(8 + Math.floor(classIndex / 7));
    // Class 10-A is reserved for the teacher demo above.
    const section = classIndex === 14 ? 'H' : String.fromCharCode(65 + (classIndex % 7));
    const extraClassId = db.prepare('INSERT INTO classes (organization_id, name, grade, section, academic_year) VALUES (?, ?, ?, ?, ?)')
      .run(schoolId, `Class ${grade}-${section}`, grade, section, '2026-27').lastInsertRowid;
    db.prepare('INSERT INTO teacher_class_assignments (teacher_user_id, class_id) VALUES (?, ?)').run(adminTeachers[classIndex], extraClassId);
    const extraAssessmentId = db.prepare('INSERT INTO assessments (organization_id, title) VALUES (?, ?)').run(schoolId, `Career Readiness ${grade}-${section}`).lastInsertRowid;
    const extraAssignmentId = db.prepare('INSERT INTO assessment_assignments (assessment_id, class_id, due_at) VALUES (?, ?, ?)').run(extraAssessmentId, extraClassId, daysAgo(-2)).lastInsertRowid;
    const classSize = classIndex < 41 ? 30 : 0; // 41 x 30 plus Class 10-A's 10 = 1,240 students.
    for (let studentIndex = 0; studentIndex < classSize; studentIndex += 1) {
      const sequence = extraStudentIndex++;
      const id = db.prepare('INSERT INTO school_students (organization_id, admission_number, first_name, last_name, grade, section) VALUES (?, ?, ?, ?, ?, ?)')
        .run(schoolId, `CS-${String(sequence + 11).padStart(4, '0')}`, `Student${sequence + 11}`, `Demo${sequence + 11}`, grade, section).lastInsertRowid;
      db.prepare('INSERT INTO class_enrollments (class_id, student_id) VALUES (?, ?)').run(extraClassId, id);
      const completed = sequence < 1035;
      db.prepare('INSERT INTO assessment_attempts (assignment_id, student_id, status, score, completed_at) VALUES (?, ?, ?, ?, ?)')
        .run(extraAssignmentId, id, completed ? 'completed' : 'in_progress', completed ? 68 + (sequence % 28) : null, completed ? daysAgo(sequence % 10) : null);
      const requiresAttention = sequence < 44;
      db.prepare('INSERT INTO roadmaps (student_id, title, progress_percent, updated_at) VALUES (?, ?, ?, ?)')
        .run(id, 'Career Growth Roadmap', requiresAttention ? 40 : 63, daysAgo(requiresAttention ? 18 : sequence % 7));
      db.prepare('INSERT INTO career_explorations (student_id, career_area, explored_at) VALUES (?, ?, ?)').run(id, supplementalCareers[sequence], daysAgo(sequence % 14));
      db.prepare('INSERT INTO skill_gaps (student_id, skill_name, current_level, target_level, recommended_action) VALUES (?, ?, ?, ?, ?)')
        .run(id, ['Communication', 'Data Analysis', 'Critical Thinking', 'Digital Literacy'][sequence % 4], 'Developing', 'Proficient', 'Complete the recommended practice module');
      // Keep 968 supplemental learners active while preserving a realistic attention cohort.
      if (sequence >= 44 && sequence < 1012) db.prepare('INSERT INTO student_activity_events (student_id, activity_type, occurred_at) VALUES (?, ?, ?)').run(id, 'dashboard_activity', daysAgo(sequence % 10));
      else db.prepare('INSERT INTO student_activity_events (student_id, activity_type, occurred_at) VALUES (?, ?, ?)').run(id, 'dashboard_activity', daysAgo(20));
    }
    const goalId = db.prepare('INSERT INTO task_assignments (class_id, title, type, due_at, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(extraClassId, 'Complete career reflection', 'weekly_goal', daysAgo(-3), adminTeachers[classIndex]).lastInsertRowid;
    const enrolled = db.prepare('SELECT student_id FROM class_enrollments WHERE class_id=?').all(extraClassId);
    enrolled.forEach(({ student_id }, index) => { if (extraStudentIndex - enrolled.length + index >= 44) db.prepare('INSERT INTO task_completions (task_assignment_id, student_id, completed_at) VALUES (?, ?, ?)').run(goalId, student_id, daysAgo(index % 5)); });
  }

  const weeklyTask = db.prepare('INSERT INTO task_assignments (class_id, title, type, due_at, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(classId, 'Complete career reflection', 'weekly_goal', daysAgo(-3), teacherId).lastInsertRowid;
  studentIds.forEach((studentId, index) => { if (index !== 1 && index !== 3 && index !== 5) db.prepare('INSERT INTO task_completions (task_assignment_id, student_id, completed_at) VALUES (?, ?, ?)').run(weeklyTask, studentId, daysAgo(index % 5)); });
  [
    ['Career Simulation – Round 2', 'simulation', 9, 0], ['Roadmap Check-in', 'review', 11, 0],
    ['Weekly Goal Review', 'class_activity', 13, 30], ['Assessment Window Closing', 'reminder', 15, 0]
  ].forEach(([title, type, hour, minute]) => db.prepare('INSERT INTO events (organization_id, class_id, title, event_type, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(schoolId, classId, title, type, todayAt(hour, minute), todayAt(hour + 1, minute)));
  [['inactive_days', 14], ['incomplete_assessments', 2], ['roadmap_below_percent', 50], ['missed_weekly_goals', 1], ['low_engagement_percent', 35]].forEach(([key, threshold]) =>
    db.prepare('INSERT INTO attention_rules (organization_id, rule_key, threshold) VALUES (?, ?, ?)').run(schoolId, key, threshold));
})();

// Demonstrate the same automatic result users receive after choosing a career.
seededStudentCareers.forEach(([studentId, careerArea]) => generateCareerGrowthMap({ studentId, careerArea }));

console.log('Seed complete. Demo logins: teacher simran@carestance.demo / Teacher@123; parent parent@carestance.demo / Parent@123; school admin admin@carestance.demo / Admin@123');
