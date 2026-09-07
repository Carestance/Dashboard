import db from '../database/connection.js';
import { getStudentCareerGrowthMaps } from './careerGrowthMaps.js';

const percent = (value, total) => total ? Math.round((value / total) * 100) : 0;
const dateDaysAgo = (value) => value ? Math.floor((Date.now() - new Date(value).getTime()) / 86400000) : null;

function getChild(parentUserId) {
  return db.prepare(`SELECT pc.relationship, s.id AS student_id, s.first_name, s.last_name, s.grade, s.section,
      c.name AS class_name, cu.id AS consumer_id, cu.display_name AS consumer_name, cp.preferred_goal
    FROM parent_children pc
    LEFT JOIN school_students s ON s.id=pc.school_student_id
    LEFT JOIN class_enrollments ce ON ce.student_id=s.id
    LEFT JOIN classes c ON c.id=ce.class_id
    LEFT JOIN users cu ON cu.id=pc.consumer_user_id
    LEFT JOIN consumer_profiles cp ON cp.user_id=cu.id
    WHERE pc.parent_user_id=? LIMIT 1`).get(parentUserId);
}

function schoolDashboard(child) {
  const studentId = child.student_id;
  const assessments = db.prepare(`SELECT a.title, aa.status, aa.score, aa.completed_at
    FROM assessment_attempts aa JOIN assessment_assignments asa ON asa.id=aa.assignment_id
    JOIN assessments a ON a.id=asa.assessment_id WHERE aa.student_id=? ORDER BY aa.completed_at DESC`).all(studentId);
  const tasks = db.prepare(`SELECT ta.id, ta.title, ta.type, ta.due_at, tc.completed_at
    FROM task_assignments ta JOIN class_enrollments ce ON ce.class_id=ta.class_id
    LEFT JOIN task_completions tc ON tc.task_assignment_id=ta.id AND tc.student_id=ce.student_id
    WHERE ce.student_id=? ORDER BY ta.due_at`).all(studentId);
  const growthMaps = getStudentCareerGrowthMaps(studentId);
  const personalizedTasks = growthMaps.flatMap((map) => map.tasks.map((task) => ({ ...task, career_area:map.career_area, personalized:true })));
  const allTasks = [...tasks, ...personalizedTasks];
  const roadmap = db.prepare('SELECT title, progress_percent, updated_at FROM roadmaps WHERE student_id=? ORDER BY updated_at DESC LIMIT 1').get(studentId);
  const interests = db.prepare('SELECT career_area, explored_at FROM career_explorations WHERE student_id=? ORDER BY explored_at DESC').all(studentId);
  const skills = db.prepare('SELECT skill_name, current_level, target_level, recommended_action FROM skill_gaps WHERE student_id=?').all(studentId);
  const simulations = db.prepare('SELECT simulation_name, result_summary, completed_at FROM simulation_history WHERE student_id=? ORDER BY completed_at DESC').all(studentId);
  const achievements = db.prepare('SELECT title, description, earned_at FROM student_achievements WHERE student_id=? ORDER BY earned_at DESC').all(studentId);
  const weeklyTasks = tasks.filter((task) => task.type === 'weekly_goal');
  const completedWeekly = weeklyTasks.filter((task) => task.completed_at).length;
  const overallProgress = Math.round(roadmap?.progress_percent || 0);
  const primaryInterest = interests[0]?.career_area || 'Not explored yet';
  const primarySkill = skills[0];
  const latestMap = growthMaps[0];
  const lastActivity = db.prepare('SELECT MAX(occurred_at) AS occurred_at FROM student_activity_events WHERE student_id=?').get(studentId)?.occurred_at;
  return {
    source:'school_student',
    child:{ id:studentId, name:`${child.first_name} ${child.last_name}`, className:child.class_name || `Grade ${child.grade}-${child.section}` },
    metrics:{ overallProgress, progressThisMonth:overallProgress, tasksCompleted:allTasks.filter((task) => task.completed_at).length, tasksTotal:allTasks.length, weeklyTasksCompleted:completedWeekly, weeklyTasksTotal:weeklyTasks.length, assessmentsCompleted:assessments.filter((item) => item.status === 'completed').length, assessmentsTotal:assessments.length },
    interests, skills, roadmap:roadmap || null, simulations, achievements,
    tasks:{ completed:allTasks.filter((task) => task.completed_at), pending:allTasks.filter((task) => !task.completed_at) },
    journey:{ currentInterest:primaryInterest, exploredCareers:[...new Set(interests.map((item) => item.career_area))], recommendedAreas:latestMap ? [latestMap.career_area] : [...new Set(interests.map((item) => item.career_area))], simulation:simulations[0]?.result_summary || 'No simulation completed yet', currentSkill:primarySkill?.current_level || 'Starting point', nextStep:primarySkill?.recommended_action || latestMap?.tasks.find((task) => !task.completed_at)?.title || 'Explore a career interest', stage:roadmap?.progress_percent >= 70 ? 'Progress' : roadmap?.progress_percent >= 40 ? 'Skill Building' : 'Exploration' },
    insights:{ summary:`Your child completed ${completedWeekly}/${weeklyTasks.length} weekly tasks and has shown interest in ${primaryInterest.toLowerCase()} activities.`, action:allTasks.find((task) => !task.completed_at)?.title ? `Encourage your child to complete “${allTasks.find((task) => !task.completed_at).title}” this week.` : 'Celebrate your child’s completed learning activities.', trend:`Overall roadmap progress is ${overallProgress}%.${lastActivity ? ` Last active ${dateDaysAgo(lastActivity)} day(s) ago.` : ''}` },
    reports:{ career:{ interests, simulations, journey:null }, progress:{ overallProgress, roadmap:roadmap || null, assessments }, monthly:{ overallProgress, weeklyTasksCompleted:completedWeekly, weeklyTasksTotal:weeklyTasks.length }, skills, simulation:simulations, achievements }
  };
}

function consumerDashboard(child) {
  return { source:'consumer', child:{ id:child.consumer_id, name:child.consumer_name, className:'Direct learner' }, metrics:{ overallProgress:0, progressThisMonth:0, tasksCompleted:0, tasksTotal:0, weeklyTasksCompleted:0, weeklyTasksTotal:0, assessmentsCompleted:0, assessmentsTotal:0 }, interests:[], skills:[], roadmap:null, simulations:[], achievements:[], tasks:{ completed:[], pending:[] }, journey:{ currentInterest:child.preferred_goal || 'Not explored yet', exploredCareers:[], recommendedAreas:[], simulation:'No simulation completed yet', currentSkill:'Starting point', nextStep:'Choose a career interest', stage:'Exploration' }, insights:{ summary:'Your child has not started any activities yet.', action:'Encourage your child to choose a career interest.', trend:'Activity will appear here as your child uses CareStance.' }, reports:{ career:{ interests:[], simulations:[], journey:null }, progress:{ overallProgress:0, roadmap:null, assessments:[] }, monthly:{ overallProgress:0, weeklyTasksCompleted:0, weeklyTasksTotal:0 }, skills:[], simulation:[], achievements:[] } };
}

export function getParentDashboard(parentUserId) {
  const child = getChild(parentUserId);
  if (!child) return null;
  return child.student_id ? schoolDashboard(child) : consumerDashboard(child);
}