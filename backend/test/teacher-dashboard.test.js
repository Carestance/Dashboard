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
});

test('consumer identities cannot access teacher data', async () => {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'learner@carestance.demo', password: 'Consumer@123' }) });
  const { token } = await login.json();
  const response = await fetch(`${baseUrl}/api/v1/teacher/dashboard`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 403);
});
