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

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('login resolves school and consumer organization datasets', async () => {
  const schoolParent = await login('parent@carestance.demo', 'Parent@123');
  assert.equal(schoolParent.user.role, 'parent');
  assert.equal(schoolParent.user.organizationType, 'school');

  const consumer = await login('learner@carestance.demo', 'Consumer@123');
  assert.equal(consumer.user.role, 'consumer');
  assert.equal(consumer.user.organizationType, 'consumer');
});

test('parent dashboard traverses the linked school or consumer dataset', async () => {
  const schoolParent = await login('parent@carestance.demo', 'Parent@123');
  const schoolResponse = await fetch(`${baseUrl}/api/v1/parent/dashboard`, { headers: { authorization: `Bearer ${schoolParent.token}` } });
  assert.equal(schoolResponse.status, 200);
  assert.equal((await schoolResponse.json()).data.source, 'school_student');

  const directParent = await login('direct-parent@carestance.demo', 'Parent@123');
  const directResponse = await fetch(`${baseUrl}/api/v1/parent/dashboard`, { headers: { authorization: `Bearer ${directParent.token}` } });
  assert.equal(directResponse.status, 200);
  const directBody = await directResponse.json();
  assert.equal(directBody.data.source, 'consumer');
  assert.equal(directBody.data.child.name, 'Demo Learner');
});

test('consumer dashboard reads only the direct learner dataset', async () => {
  const consumer = await login('learner@carestance.demo', 'Consumer@123');
  const response = await fetch(`${baseUrl}/api/v1/consumer/dashboard`, { headers: { authorization: `Bearer ${consumer.token}` } });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.source, 'consumer');
  assert.equal(data.child.className, 'Direct learner');
  assert.equal(data.journey.currentInterest, 'Product Design');
});