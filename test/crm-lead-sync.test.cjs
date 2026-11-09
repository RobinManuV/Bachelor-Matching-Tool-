const test = require('node:test');
const assert = require('node:assert/strict');
const { syncRecommenderLead } = require('../lib/crm-lead-sync');

const lead = {
  nombre: 'Ana', apellidos: 'García', email: 'ANA@example.com', telefono: '+34 600 000 000',
  colegio: 'Colegio Robin', curso: '2º de Bachillerato', ciudad: 'Madrid', pais: 'España', consent: true,
};

test('envía el billete al CRM como lead web de la campaña Recomendador', async () => {
  let request;
  const result = await syncRecommenderLead({ lead, sessionId: 'matching-1', area: 'ingenierias' }, {
    secret: 'test-secret',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ ok: true, result: 'created', leadId: 'lead-1' }) };
    },
  });
  assert.equal(result.result, 'created');
  assert.equal(request.url, 'https://robinportals.netlify.app/api/leads/website');
  assert.equal(request.options.headers['x-robin-lead-secret'], 'test-secret');
  const body = JSON.parse(request.options.body);
  assert.equal(body.form_name, 'recomendador');
  assert.equal(body.campaign, 'Recomendador');
  assert.equal(body.createOnlyEmail, true);
  assert.equal(body.submissionId, 'matching-1');
  assert.equal(body.fields.name, 'Ana García');
  assert.equal(body.fields.email, 'ana@example.com');
  assert.equal(body.fields.phone, '+34 600 000 000');
  assert.equal(body.fields.course, '2º de Bachillerato');
  assert.equal(body.fields.colegio, 'Colegio Robin');
  assert.equal(body.fields.pais, 'España');
  assert.equal(body.fields.area, 'Ingenierías');
});

test('acepta un correo existente sin cambiar el lead y falla de forma visible si el CRM falla', async () => {
  const input = { lead, sessionId: 'matching-1', area: 'ingenierias' };
  const skipped = await syncRecommenderLead(input, {
    secret: 'test-secret', fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, result: 'skipped_existing' }) }),
  });
  assert.equal(skipped.result, 'skipped_existing');
  await assert.rejects(syncRecommenderLead(input, {
    secret: 'test-secret', fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: 'unavailable' }) }),
  }), /CRM/);
  await assert.rejects(syncRecommenderLead(input, { secret: '' }), /CRM/);
});
