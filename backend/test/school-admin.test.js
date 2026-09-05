import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;
let adminToken;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@carestance.demo', password: 'Admin@123' }) });
  assert.equal(response.status, 200);
  adminToken = (await response.json()).token;
});

test.after(() => server.close());
const adminRequest = (path, options = {}) => fetch(`${baseUrl}${path}`, { ...options, headers: { authorization: `Bearer ${adminToken}`, ...(options.headers || {}) } });

test('school admin receives analytical overview and distribution data', async () => {
  const response = await adminRequest('/api/v1/school-admin/dashboard');
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(data.overview, { students: 1240, teachers: 68, classes: 42, activeStudents: 978, assessmentCompletion: 84, roadmapCompletion: 62, studentsRequiringAttention: 47 });
  assert.ok(data.charts.studentEngagement.length > 0);
  assert.equal(data.charts.careerInterestDistribution[0].careerArea, 'Engineering');
  assert.equal(data.charts.careerInterestDistribution[0].students, 218);
  assert.equal(data.charts.classWisePerformance.length, 42);
});

test('school admin can drill from hierarchy to a class and attention list', async () => {
  const hierarchy = await adminRequest('/api/v1/school-admin/classes?grade=10');
  assert.equal(hierarchy.status, 200);
  const class10A = (await hierarchy.json()).data.classes.find((item) => item.name === 'Class 10-A');
  assert.ok(class10A);
  const classResponse = await adminRequest(`/api/v1/school-admin/classes/${class10A.id}`);
  assert.equal(classResponse.status, 200);
  assert.equal((await classResponse.json()).data.students.length, 10);
  const attention = await adminRequest('/api/v1/school-admin/attention');
  assert.equal(attention.status, 200);
  // Other integration tests may add class work concurrently; it can only add
  // new transparent attention signals, never remove the seeded cohort.
  assert.ok((await attention.json()).data.count >= 47);
});

test('teacher cannot access school admin data', async () => {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'simran@carestance.demo', password: 'Teacher@123' }) });
  const { token } = await login.json();
  const response = await fetch(`${baseUrl}/api/v1/school-admin/dashboard`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 403);
});
