const { spawnSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const { getAdminClient } = require('../lib/supabase-clients');
const { syncRecommenderLead } = require('../lib/crm-lead-sync');

const CRM_SITE_ID = 'b6aefd5a-76e9-436b-a6e2-6fa1463f4511';
const CRM_PROJECT_HOST = 'odcjxzxfaclwwoynfqui.supabase.co';

function netlifyEnv(name) {
  const result = spawnSync('netlify', ['env:get', `ADMIN__${name}`, '--context', 'production', '--site', CRM_SITE_ID], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`No se pudo leer ${name} de Netlify`);
  return result.stdout.trim();
}

async function readAll(client, table, columns, order = 'id') {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(columns).order(order).range(offset, offset + 999);
    if (error) throw new Error(`No se pudo consultar ${table}: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < 1000) return all;
  }
}

function buildPlan(sessions, existingEmails) {
  const emails = new Set(existingEmails.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean));
  const latestByEmail = new Map();
  for (const session of [...sessions].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const email = String(session.email || '').trim().toLowerCase();
    if (email && !latestByEmail.has(email)) latestByEmail.set(email, session);
  }
  return {
    unique: latestByEmail.size,
    existing: [...latestByEmail.keys()].filter((email) => emails.has(email)).length,
    missing: [...latestByEmail].filter(([email]) => !emails.has(email)).map(([, session]) => session),
  };
}

function sessionToLead(session) {
  return {
    nombre: session.first_name,
    apellidos: session.last_name,
    email: session.email,
    telefono: session.phone,
    colegio: session.school,
    curso: session.questionnaire?.course || '',
    ciudad: session.origin_city,
    pais: session.origin_country,
    consent: true,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const crmUrl = process.env.CRM_SUPABASE_URL || netlifyEnv('ADMIN_SUPABASE_URL');
  const crmKey = process.env.CRM_SUPABASE_SERVICE_ROLE_KEY || netlifyEnv('ADMIN_SUPABASE_SERVICE_ROLE_KEY');
  if (new URL(crmUrl).hostname !== CRM_PROJECT_HOST) throw new Error('El CRM configurado no es el proyecto Supabase indicado');
  const crm = createClient(crmUrl, crmKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [sessions, leads, futureLeads] = await Promise.all([
    readAll(getAdminClient(), 'matching_sessions', 'id,created_at,first_name,last_name,email,phone,school,origin_city,origin_country,selected_area,questionnaire', 'created_at'),
    readAll(crm, 'crm_leads', 'email'),
    readAll(crm, 'crm_future_leads', 'email'),
  ]);
  const plan = buildPlan(sessions, [...leads, ...futureLeads].map((row) => row.email));
  console.log({ mode: apply ? 'apply' : 'dry-run', sessions: sessions.length, uniqueEmails: plan.unique, alreadyInCrm: plan.existing, missingLeads: plan.missing.length, historicalWithoutCourse: plan.missing.filter((row) => !row.questionnaire?.course).length });
  if (!apply || !plan.missing.length) return;
  if (!process.env.ROBIN_CRM_LEAD_SECRET) throw new Error('ROBIN_CRM_LEAD_SECRET no configurada');
  const results = { created: 0, routedFuture: 0, skippedExisting: 0, failed: 0 };
  for (const session of plan.missing) {
    try {
      const { result } = await syncRecommenderLead({
        lead: sessionToLead(session), sessionId: session.id,
        area: session.selected_area, createdAt: session.created_at,
      });
      if (result === 'created') results.created += 1;
      else if (result === 'routed_future') results.routedFuture += 1;
      else if (result === 'skipped_existing') results.skippedExisting += 1;
      else results.failed += 1;
    } catch (error) {
      results.failed += 1;
      console.error(`Un lead histórico no se pudo importar: ${error.message}`);
    }
  }
  const [updatedLeads, updatedFuture] = await Promise.all([
    readAll(crm, 'crm_leads', 'email'),
    readAll(crm, 'crm_future_leads', 'email'),
  ]);
  const remaining = buildPlan(sessions, [...updatedLeads, ...updatedFuture].map((row) => row.email)).missing.length;
  console.log({ ...results, remainingMissing: remaining });
  if (results.failed || remaining) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { buildPlan, sessionToLead };
