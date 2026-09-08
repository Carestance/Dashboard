import db from '../database/connection.js';

const percent = (value, total) => total ? Math.round((value / total) * 100) : 0;
const daysAgo = (value) => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)) : null;

// This service deliberately reads consumer_* tables only. It is the direct-
// learner equivalent of the school-student journey, not a query across school data.
export function getConsumerDashboard(userId) {
  const learner = db.prepare(`SELECT u.id, u.display_name, cp.preferred_goal, cp.current_stage
    FROM users u JOIN consumer_profiles cp ON cp.user_id=u.id WHERE u.id=? AND u.role='consumer'`).get(userId);
  if (!learner) return null;
  const assessments = db.prepare('SELECT title, status, score, completed_at FROM consumer_assessments WHERE user_id=? ORDER BY completed_at DESC').all(userId);
  const interests = db.prepare('SELECT career_area, explored_at FROM consumer_career_explorations WHERE user_id=? ORDER BY explored_at DESC').all(userId);
  const simulations = db.prepare('SELECT simulation_name, result_summary, completed_at FROM consumer_simulation_history WHERE user_id=? ORDER BY completed_at DESC').all(userId);
  const skills = db.prepare('SELECT skill_name, current_level, target_level, recommended_action FROM consumer_skill_gaps WHERE user_id=?').all(userId);
  const roadmap = db.prepare('SELECT title, progress_percent, updated_at FROM consumer_roadmaps WHERE user_id=? ORDER BY updated_at DESC LIMIT 1').get(userId) || null;
  const tasks = db.prepare('SELECT id, title, task_type AS type, due_at, completed_at FROM consumer_tasks WHERE user_id=? ORDER BY due_at').all(userId);
  const achievements = db.prepare('SELECT title, description, earned_at FROM consumer_achievements WHERE user_id=? ORDER BY earned_at DESC').all(userId);
  const lastActivity = db.prepare('SELECT MAX(occurred_at) AS occurred_at FROM consumer_activity_events WHERE user_id=?').get(userId)?.occurred_at;
  const weekly = tasks.filter((task) => task.type === 'weekly_goal');
  const completedWeekly = weekly.filter((task) => task.completed_at).length;
  const progress = Math.round(roadmap?.progress_percent || 0);
  const currentInterest = interests[0]?.career_area || learner.preferred_goal || 'Not explored yet';
  const nextStep = skills[0]?.recommended_action || tasks.find((task) => !task.completed_at)?.title || 'Choose a career interest';
  return {
    source: 'consumer',
    child: { id: learner.id, name: learner.display_name, className: 'Direct learner' },
    metrics: { overallProgress: progress, progressThisMonth: progress, tasksCompleted: tasks.filter((task) => task.completed_at).length, tasksTotal: tasks.length, weeklyTasksCompleted: completedWeekly, weeklyTasksTotal: weekly.length, assessmentsCompleted: assessments.filter((item) => item.status === 'completed').length, assessmentsTotal: assessments.length },
    interests, skills, roadmap, simulations, achievements,
    tasks: { completed: tasks.filter((task) => task.completed_at), pending: tasks.filter((task) => !task.completed_at) },
    journey: { currentInterest, exploredCareers: [...new Set(interests.map((item) => item.career_area))], recommendedAreas: [...new Set(interests.map((item) => item.career_area))], simulation: simulations[0]?.result_summary || 'No simulation completed yet', currentSkill: skills[0]?.current_level || 'Starting point', nextStep, stage: learner.current_stage },
    insights: { summary: `Your child completed ${completedWeekly}/${weekly.length} weekly tasks and has shown interest in ${currentInterest.toLowerCase()} activities.`, action: `Encourage your child to complete “${nextStep}” this week.`, trend: `Overall roadmap progress is ${progress}%.${lastActivity ? ` Last active ${daysAgo(lastActivity)} day(s) ago.` : ''}` },
    reports: { career: { interests, simulations, journey: null }, progress: { overallProgress: progress, roadmap, assessments }, monthly: { overallProgress: progress, weeklyTasksCompleted: completedWeekly, weeklyTasksTotal: weekly.length }, skills, simulation: simulations, achievements }
  };
}
