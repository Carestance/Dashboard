import db from '../database/connection.js';

const templates = {
  Engineering: {
    skills: ['Mathematical reasoning', 'Programming foundations', 'Systems thinking'],
    tasks: [
      ['Build a small logic challenge', 'Solve and explain a three-step logic or maths problem.', 'practice'],
      ['Create a first program', 'Build a simple calculator, quiz, or pattern program and share what you learned.', 'project'],
      ['Explore an engineering pathway', 'Compare two engineering roles and identify the skills each role uses.', 'research']
    ]
  },
  Design: {
    skills: ['Visual communication', 'Design thinking', 'User empathy'],
    tasks: [
      ['Observe a design problem', 'Find one everyday problem and record who experiences it and why.', 'research'],
      ['Sketch three solutions', 'Create three quick sketches for the problem and label the key choices.', 'practice'],
      ['Build a design case study', 'Turn your strongest solution into a short case study with feedback from one user.', 'project']
    ]
  },
  Medicine: {
    skills: ['Scientific inquiry', 'Communication and empathy', 'Evidence-based reasoning'],
    tasks: [
      ['Investigate a health topic', 'Use reliable sources to explain one health topic in your own words.', 'research'],
      ['Practise active listening', 'Conduct a respectful five-minute listening exercise and reflect on what you noticed.', 'practice'],
      ['Map a medical career pathway', 'Compare two healthcare roles, their study path, and the skills they need.', 'career_exploration']
    ]
  }
};

function templateFor(careerArea) {
  const career = String(careerArea || '').trim();
  return templates[career] || {
    skills: ['Career research', 'Communication', 'Problem solving'],
    tasks: [
      [`Research ${career || 'this career'}`, `Identify the day-to-day work, skills, and study route for ${career || 'your chosen career'}.`, 'research'],
      ['Practise a core skill', 'Complete a short practice activity that demonstrates one important career skill.', 'practice'],
      ['Complete a career mini-project', 'Create and reflect on a small project related to the selected career.', 'project']
    ]
  };
}

const levelFor = (score) => score == null ? 'Starting point' : score >= 85 ? 'Developing' : score >= 70 ? 'Foundation' : 'Beginner';

export function generateCareerGrowthMap({ studentId, careerArea }) {
  const career = String(careerArea || '').trim();
  if (!career || career.length > 80) return null;
  const assessment = db.prepare(`SELECT aa.score FROM assessment_attempts aa WHERE aa.student_id=? AND aa.status='completed' ORDER BY aa.completed_at DESC LIMIT 1`).get(studentId);
  const score = assessment?.score ?? null;
  const plan = templateFor(career);
  const existing = db.prepare('SELECT id FROM career_growth_maps WHERE student_id=? AND career_area=?').get(studentId, career);
  const now = new Date();
  const save = db.transaction(() => {
    let mapId;
    if (existing) {
      mapId = existing.id;
      db.prepare('UPDATE career_growth_maps SET title=?, assessment_score=?, progress_percent=0, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(`${career} Growth Map`, score, mapId);
      db.prepare('DELETE FROM growth_map_skills WHERE growth_map_id=?').run(mapId);
      db.prepare('DELETE FROM growth_map_tasks WHERE growth_map_id=?').run(mapId);
    } else {
      mapId = db.prepare('INSERT INTO career_growth_maps (student_id, career_area, title, assessment_score) VALUES (?, ?, ?, ?)')
        .run(studentId, career, `${career} Growth Map`, score).lastInsertRowid;
    }
    const insertSkill = db.prepare('INSERT INTO growth_map_skills (growth_map_id, skill_name, current_level, target_level, rationale, sequence) VALUES (?, ?, ?, ?, ?, ?)');
    const insertTask = db.prepare('INSERT INTO growth_map_tasks (growth_map_id, student_id, title, description, task_type, due_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)');
    plan.skills.forEach((skill, index) => insertSkill.run(mapId, skill, levelFor(score), 'Proficient', `Priority skill for ${career}`, index + 1));
    plan.tasks.forEach(([title, description, taskType], index) => {
      const due = new Date(now);
      due.setDate(due.getDate() + (index + 1) * 7);
      insertTask.run(mapId, studentId, title, description, taskType, due.toISOString(), index + 1);
    });
    return mapId;
  });
  return getCareerGrowthMap(save());
}

export function getCareerGrowthMap(mapId) {
  const map = db.prepare('SELECT id, career_area, title, assessment_score, progress_percent, generated_at, updated_at FROM career_growth_maps WHERE id=?').get(mapId);
  if (!map) return null;
  return {
    ...map,
    skills: db.prepare('SELECT id, skill_name, current_level, target_level, rationale, sequence FROM growth_map_skills WHERE growth_map_id=? ORDER BY sequence').all(mapId),
    tasks: db.prepare('SELECT id, title, description, task_type, due_at, sequence, completed_at FROM growth_map_tasks WHERE growth_map_id=? ORDER BY sequence').all(mapId)
  };
}

export function getStudentCareerGrowthMaps(studentId) {
  return db.prepare('SELECT id FROM career_growth_maps WHERE student_id=? ORDER BY updated_at DESC').all(studentId).map(({ id }) => getCareerGrowthMap(id));
}

export function setGrowthMapTaskCompletion({ taskId, studentId, completed }) {
  const task = db.prepare('SELECT gmt.id, gmt.growth_map_id FROM growth_map_tasks gmt JOIN career_growth_maps cgm ON cgm.id=gmt.growth_map_id WHERE gmt.id=? AND cgm.student_id=?').get(taskId, studentId);
  if (!task) return null;
  db.prepare('UPDATE growth_map_tasks SET completed_at=? WHERE id=?').run(completed ? new Date().toISOString() : null, taskId);
  const totals = db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS complete FROM growth_map_tasks WHERE growth_map_id=?').get(task.growth_map_id);
  const progress = totals.total ? Math.round((totals.complete / totals.total) * 100) : 0;
  db.prepare('UPDATE career_growth_maps SET progress_percent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(progress, task.growth_map_id);
  return getCareerGrowthMap(task.growth_map_id);
}
