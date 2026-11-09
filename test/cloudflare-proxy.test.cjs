const assert = require('node:assert/strict');
const test = require('node:test');

const loadProxy = () => import('../infra/cloudflare/rbmt-proxy.mjs');

test('Cloudflare sirve RBMT bajo /rbmt y conserva rutas y consultas', async () => {
  const { upstreamFor } = await loadProxy();
  assert.equal(upstreamFor(new URL('https://project-robin.com/rbmt/')).href, 'https://rbmt.netlify.app/');
  assert.equal(upstreamFor(new URL('https://project-robin.com/rbmt/admin/')).href, 'https://rbmt.netlify.app/admin/');
  assert.equal(upstreamFor(new URL('https://project-robin.com/rbmt/assets/img/logo-robin.png')).href, 'https://rbmt.netlify.app/assets/img/logo-robin.png');
  assert.equal(upstreamFor(new URL('https://project-robin.com/rbmt/api/match?x=1')).href, 'https://rbmt.netlify.app/api/match?x=1');
  assert.equal(upstreamFor(new URL('https://project-robin.com/rbmt/.netlify/functions/admin?route=sessions')).href, 'https://rbmt.netlify.app/.netlify/functions/admin?route=sessions');
  assert.equal(upstreamFor(new URL('https://project-robin.com/rbmt-other')), null);
});

test('Cloudflare normaliza las rutas de páginas antes de cargar recursos relativos', async () => {
  const { default: proxy } = await loadProxy();
  for (const path of ['/rbmt', '/rbmt/admin', '/rbmt/colegios']) {
    const response = await proxy.fetch(new Request(`https://project-robin.com${path}?school=abc`));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), `https://project-robin.com${path}/?school=abc`);
  }
});

test('Cloudflare reenvía peticiones y respuestas sin salir del dominio público', async () => {
  const { default: proxy } = await loadProxy();
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (request) => {
    upstreamRequest = request;
    return new Response(null, { status: 302, headers: { location: '/admin/' } });
  };
  try {
    const response = await proxy.fetch(new Request('https://project-robin.com/rbmt/api/match?x=1', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', duplex: 'half',
    }));
    assert.equal(upstreamRequest.url, 'https://rbmt.netlify.app/api/match?x=1');
    assert.equal(upstreamRequest.method, 'POST');
    assert.equal(await upstreamRequest.text(), '{}');
    assert.equal(upstreamRequest.headers.get('origin'), 'https://rbmt.netlify.app');
    assert.equal(upstreamRequest.headers.get('x-forwarded-host'), 'project-robin.com');
    assert.equal(response.headers.get('location'), 'https://project-robin.com/rbmt/admin/');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
