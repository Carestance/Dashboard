import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test('teacher login and dashboard pages are served by the API', async () => {
  const loginPage = await fetch(`${baseUrl}/login.html`);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /loginForm/);
  const dashboardPage = await fetch(`${baseUrl}/teachers/dashboard.html`);
  assert.equal(dashboardPage.status, 200);
  assert.match(await dashboardPage.text(), /\/api\/v1\/teacher\/dashboard/);
});

test('teacher can access only the teacher dashboard', async () => {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'simran@carestance.demo', password: 'Teacher@123' }) });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const dashboard = await fetch(`${baseUrl}/api/v1/teacher/dashboard`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(dashboard.status, 200);
  const body = await dashboard.json();
  assert.equal(body.data.class.name, 'Class 10-A');
  assert.equal(body.data.metrics.totalStudents, 10);
  assert.ok(Array.isArray(body.data.attentionStudents));
  const roster = await fetch(`${baseUrl}/api/v1/teacher/classes/${body.data.class.id}/students`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(roster.status, 200);
  const rosterBody = await roster.json();
  assert.equal(rosterBody.data.students.length, 10);
  const profile = await fetch(`${baseUrl}/api/v1/teacher/students/${rosterBody.data.students[0].id}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(profile.status, 200);
  const profileBody = await profile.json();
  assert.ok(profileBody.data.assessments.length > 0);
  assert.ok(profileBody.data.skillGaps.length > 0);
  assert.ok(profileBody.data.growthMaps.length > 0);
  const growthMap = await fetch(`${baseUrl}/api/v1/teacher/students/${rosterBody.data.students[0].id}/growth-maps`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ careerArea:'Design' })
  });
  assert.equal(growthMap.status, 201);
  const mapBody = await growthMap.json();
  assert.equal(mapBody.data.career_area, 'Design');
  assert.equal(mapBody.data.skills.length, 3);
  assert.equal(mapBody.data.tasks.length, 3);
  const firstMapTask = mapBody.data.tasks[0];
  const completedTask = await fetch(`${baseUrl}/api/v1/teacher/students/${rosterBody.data.students[0].id}/growth-map-tasks/${firstMapTask.id}`, {
    method:'PATCH', headers:{ authorization:`Bearer ${token}`, 'content-type':'application/json' }, body:JSON.stringify({ completed:true })
  });
  assert.equal(completedTask.status, 200);
  assert.equal((await completedTask.json()).data.progress_percent, 33);
  const dueAt = new Date(Date.now() + 86400000).toISOString();
  const task = await fetch(`${baseUrl}/api/v1/teacher/classes/${body.data.class.id}/tasks`, { method:'POST', headers:{ authorization:`Bearer ${token}`, 'content-type':'application/json' }, body:JSON.stringify({ title:'Interview reflection', type:'weekly_goal', dueAt }) });
  assert.equal(task.status, 201);
  const event = await fetch(`${baseUrl}/api/v1/teacher/classes/${body.data.class.id}/events`, { method:'POST', headers:{ authorization:`Bearer ${token}`, 'content-type':'application/json' }, body:JSON.stringify({ title:'Career workshop', eventType:'session', startsAt:dueAt }) });
  assert.equal(event.status, 201);
  const assessment = await fetch(`${baseUrl}/api/v1/teacher/classes/${body.data.class.id}/assessments`, { method:'POST', headers:{ authorization:`Bearer ${token}`, 'content-type':'application/json' }, body:JSON.stringify({ title:'Career research check', dueAt }) });
  assert.equal(assessment.status, 201);
  const work = await fetch(`${baseUrl}/api/v1/teacher/classes/${body.data.class.id}/work`, { headers:{ authorization:`Bearer ${token}` } });
  assert.ok((await work.json()).data.tasks.some((item) => item.title === 'Interview reflection'));
});

test('consumer identities cannot access teacher data', async () => {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'learner@carestance.demo', password: 'Consumer@123' }) });
  const { token } = await login.json();
  const response = await fetch(`${baseUrl}/api/v1/teacher/dashboard`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 403);
});
