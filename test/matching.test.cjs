const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loadData, buildUser, buildAirlinesUser } = require('../server.cjs');
const rec = require('../lib/careers-recommender');
const { generateSuggestions } = require('../lib/career-suggestions');
const { chatCompletion } = require('../lib/anthropic-chat');
const { normalizeLead, saveMatchSession } = require('../lib/match-storage');
const { schoolPassword, schoolAccessCode, validateSchoolApplication, sessionForRole } = require('../lib/admin-access');

test('el catálogo y el motor copiados conservan los candidatos', () => {
  assert.equal(rec.CAREERS.length, 229);
  const candidates = rec.getCandidates(['ingenierias'], {}, 35);
  assert.equal(candidates.length, 23);
  assert.ok(candidates.every((career) => career.area === 'Engineering'));
});

test('el proyecto genera una recomendación determinista completa sin clave', async () => {
  const source = await import(pathToFileURL(path.join(__dirname, '../src/questionnaire-data.mjs')).href);
  const answers = {};
  for (const block of [source.Q_GENERAL, source.Q_AREAS.ingenierias, source.Q_VOCACIONAL]) {
    for (const question of block.questions) {
      if (question.type === 'slider') answers[question.id] = question.def;
      else if (question.type === 'multi') answers[question.id] = [typeof question.options[0] === 'string' ? question.options[0] : question.options[0].value];
      else if (question.type === 'single') answers[question.id] = typeof question.options[0] === 'string' ? question.options[0] : question.options[0].value;
      else answers[question.id] = 'Respuesta de prueba';
    }
  }
  await loadData();
  const user = buildUser({ email: 'test@example.com', intereses: ['ingenierias'], answers,
    academic_system: 'bachillerato_espanol', academic_subjects: [{ name: 'Matemáticas', level: '' }] });
  const result = await generateSuggestions(user);
  assert.equal(result.source, 'fallback');
  assert.equal(result.items.length, 10);
  assert.ok(result.items.every((item) => Number.isInteger(item.compatibility) && item.compatibility >= 0 && item.compatibility <= 100));
});

test('Robin Airlines adapta su cuestionario reducido sin inventar respuestas', async () => {
  await loadData();
  const user = buildAirlinesUser({
    email: 'vuelo@example.com',
    intereses: ['ingenierias'],
    answers: {
      g_ciudad: 'Madrid, España', g_colegio: 'Colegio de prueba', g_sistema: 'Bachillerato español',
      modalidad: 'Ciencias – tecnológico', g_nota: 8, g_fav: ['matematicas', 'fisica'],
      g_menos: ['historia'], g_estilo: 3, g_valora: ['innovacion'], g_rasgos: ['analitico', 'curioso'],
      v_trabajo10: 'Quiero diseñar sistemas aeroespaciales.', v_prioridad: 'Pasión', v_paises: ['Países Bajos'],
      i_rama: ['Aeroespacial'], i_construir: 'Diseñar', i_matefis: 9, i_tecnico: 3,
    },
    academic_subjects: [{ name: 'Matemáticas', level: '' }, { name: 'Física', level: '' }],
  });
  assert.equal(user.academic_system, 'bachillerato_espanol');
  assert.deepEqual(user.questionnaire.signals.areas, ['ingenierias']);
  assert.deepEqual(user.questionnaire.signals.asignaturas_fav, ['matematicas', 'fisica']);
  const questions = user.questionnaire.blocks.flatMap((block) => block.items.map((item) => item.q));
  assert.ok(questions.includes('¿Qué modalidad de bachillerato cursas?'));
  assert.ok(!questions.includes('¿Te atrae más la investigación o la industria?'));
});

test('el conector independiente conserva la petición a Claude', async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const previousFetch = global.fetch;
  let request;
  process.env.ANTHROPIC_API_KEY = 'clave_de_prueba';
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ model: 'modelo_de_prueba', content: [{ type: 'text', text: '[]' }] }) };
  };
  try {
    const result = await chatCompletion({ system: 'Sistema', messages: [{ role: 'user', content: 'Perfil' }], model: 'modelo_de_prueba' });
    assert.equal(result.text, '[]');
    assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(request.options.headers['anthropic-version'], '2023-06-01');
    assert.deepEqual(JSON.parse(request.options.body), {
      model: 'modelo_de_prueba', max_tokens: 2048, system: 'Sistema', messages: [{ role: 'user', content: 'Perfil' }],
    });
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});

test('la persistencia valida el consentimiento y escribe en Supabase sin exponer la clave', async () => {
  assert.throws(() => normalizeLead({}), /tratamiento de datos/);

  const previousUrl = process.env.SUPABASE_URL;
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  const previousFetch = global.fetch;
  let request;
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_prueba';
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 201 };
  };

  try {
    const result = await saveMatchSession({
      lead: {
        nombre: 'Ana', apellidos: 'García', email: 'ANA@example.com', telefono: '+34 600 000 000',
        colegio: 'Colegio Robin', ciudad: 'Madrid', pais: 'España', consent: true,
      },
      user: {
        intereses: ['ingenierias'], academic_system: 'bachillerato_espanol',
        academic_subjects: [{ name: 'Matemáticas', level: '' }], questionnaire: { version: 1 },
      },
      suggestions: { source: 'fallback', model: null, items: [{ program_code: 'TEST' }] },
    });
    assert.deepEqual(result, { saved: true });
    assert.equal(request.url, 'https://proyecto.supabase.co/rest/v1/matching_sessions');
    assert.equal(request.options.headers.apikey, 'sb_secret_prueba');
    assert.equal(request.options.headers.authorization, undefined);
    assert.equal(JSON.parse(request.options.body).email, 'ana@example.com');
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSecret;
  }
});

test('los permisos del colegio entregan solo tres recomendaciones', () => {
  const session = { recommendations: Array.from({ length: 10 }, (_, index) => ({ program_code: `career-${index}` })) };
  const schoolView = sessionForRole(session, { role: 'school' });
  const robinView = sessionForRole(session, { role: 'robin' });
  assert.equal(schoolView.recommendations.length, 3);
  assert.equal(schoolView.locked_recommendation_count, 7);
  assert.equal(robinView.recommendations.length, 10);
});

test('las solicitudes de colegio generan el acceso acordado', () => {
  const application = validateSchoolApplication({
    school_name: 'Colegio Internacional del Norte', contact_name: 'Lucía Santos',
    job_title: 'Orientadora académica', corporate_email: 'LUCIA@COLEGIO.ES',
  });
  assert.equal(application.corporate_email, 'lucia@colegio.es');
  assert.equal(schoolPassword(application.school_name), 'Robin-Colegio Internacional del Norte-2027');
  assert.equal(schoolAccessCode(application.school_name, 'abc123'), 'colegio-internacional-del-norte-abc123');
});
