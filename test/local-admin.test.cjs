const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { start } = require('../server.cjs');

test('el servidor local protege la API real de administración', async () => {
  const server = await start(0);
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/.netlify/functions/admin?route=me`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'Inicia sesión');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('el servidor local entrega la ilustración de marca como SVG', async () => {
  const server = await start(0);
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/admin/assets/robin-student.svg`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('las solicitudes de colegio locales pasan por la Function real', async () => {
  const server = await start(0);
  await once(server, 'listening');
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const get = await fetch(`${origin}/api/school/apply`);
    assert.equal(get.status, 405);
    const post = await fetch(`${origin}/api/school/apply`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(post.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
