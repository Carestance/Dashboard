CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('school', 'consumer')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, organization_id INTEGER REFERENCES organizations(id), email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('school_admin','teacher','parent','consumer')),
  display_name TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id), employee_code TEXT, title TEXT
);
CREATE TABLE IF NOT EXISTS school_students (
  id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id), user_id INTEGER REFERENCES users(id),
  admission_number TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, grade TEXT NOT NULL, section TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id, admission_number)
);
CREATE TABLE IF NOT EXISTS parent_children (
  parent_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_student_id INTEGER REFERENCES school_students(id) ON DELETE CASCADE,
  consumer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent',
  CHECK ((school_student_id IS NOT NULL AND consumer_user_id IS NULL) OR (school_student_id IS NULL AND consumer_user_id IS NOT NULL)),
  PRIMARY KEY (parent_user_id, school_student_id, consumer_user_id)
);
CREATE TABLE IF NOT EXISTS student_achievements (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT NOT NULL, earned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS consumer_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id), preferred_goal TEXT
);
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, grade TEXT NOT NULL, section TEXT NOT NULL,
  academic_year TEXT NOT NULL, UNIQUE(organization_id, name, academic_year)
);
CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  teacher_user_id INTEGER NOT NULL REFERENCES users(id), class_id INTEGER NOT NULL REFERENCES classes(id),
  PRIMARY KEY(teacher_user_id, class_id)
);
CREATE TABLE IF NOT EXISTS class_enrollments (
  class_id INTEGER NOT NULL REFERENCES classes(id), student_id INTEGER NOT NULL REFERENCES school_students(id),
  PRIMARY KEY(class_id, student_id)
);
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id), title TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS assessment_assignments (
  id INTEGER PRIMARY KEY, assessment_id INTEGER NOT NULL REFERENCES assessments(id), class_id INTEGER NOT NULL REFERENCES classes(id), due_at TEXT
);
CREATE TABLE IF NOT EXISTS assessment_attempts (
  id INTEGER PRIMARY KEY, assignment_id INTEGER NOT NULL REFERENCES assessment_assignments(id), student_id INTEGER NOT NULL REFERENCES school_students(id),
  status TEXT NOT NULL CHECK(status IN ('assigned','in_progress','completed')), score REAL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS career_explorations (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES school_students(id), career_area TEXT NOT NULL, explored_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS simulation_history (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES school_students(id), simulation_name TEXT NOT NULL,
  result_summary TEXT NOT NULL, completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS skill_gaps (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES school_students(id), skill_name TEXT NOT NULL,
  current_level TEXT NOT NULL, target_level TEXT NOT NULL, recommended_action TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roadmaps (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES school_students(id), title TEXT NOT NULL, progress_percent REAL NOT NULL DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- A growth map belongs to a learner and a specific career, not to a whole class.
CREATE TABLE IF NOT EXISTS career_growth_maps (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES school_students(id), career_area TEXT NOT NULL,
  title TEXT NOT NULL, assessment_score REAL, progress_percent REAL NOT NULL DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100),
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, career_area)
);
CREATE TABLE IF NOT EXISTS growth_map_skills (
  id INTEGER PRIMARY KEY, growth_map_id INTEGER NOT NULL REFERENCES career_growth_maps(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL, current_level TEXT NOT NULL, target_level TEXT NOT NULL,
  rationale TEXT NOT NULL, sequence INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS growth_map_tasks (
  id INTEGER PRIMARY KEY, growth_map_id INTEGER NOT NULL REFERENCES career_growth_maps(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES school_students(id), title TEXT NOT NULL, description TEXT NOT NULL,
  task_type TEXT NOT NULL, due_at TEXT, sequence INTEGER NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS task_assignments (
  id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id), title TEXT NOT NULL, type TEXT NOT NULL, due_at TEXT, created_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS task_completions (
  task_assignment_id INTEGER NOT NULL REFERENCES task_assignments(id), student_id INTEGER NOT NULL REFERENCES school_students(id), completed_at TEXT,
  PRIMARY KEY(task_assignment_id, student_id)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id), class_id INTEGER REFERENCES classes(id), title TEXT NOT NULL, event_type TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT
);
CREATE TABLE IF NOT EXISTS student_activity_events (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES school_students(id), activity_type TEXT NOT NULL, occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS teacher_notes (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES school_students(id), teacher_user_id INTEGER NOT NULL REFERENCES users(id), note TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attention_rules (
  id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id), rule_key TEXT NOT NULL,
  threshold INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, UNIQUE(organization_id, rule_key)
);
