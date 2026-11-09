const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan, sessionToLead } = require('../scripts/backfill-crm-leads.cjs');

test('el backfill toma el último envío por correo y excluye leads ya existentes', () => {
  const sessions = [
    { id: 'old', email: 'ANA@example.com', created_at: '2026-01-01T00:00:00Z' },
    { id: 'new', email: 'ana@example.com', created_at: '2026-03-01T00:00:00Z' },
    { id: 'existing', email: 'bob@example.com', created_at: '2026-02-01T00:00:00Z' },
  ];
  const plan = buildPlan(sessions, ['BOB@example.com']);
  assert.equal(plan.unique, 2);
  assert.equal(plan.existing, 1);
  assert.deepEqual(plan.missing.map((row) => row.id), ['new']);
  assert.equal(sessionToLead({ first_name: 'Ana', last_name: 'García', email: 'ana@example.com', phone: '+34 600 000 000', school: 'Colegio', origin_city: 'Madrid', origin_country: 'España', questionnaire: {} }).curso, '');
});
