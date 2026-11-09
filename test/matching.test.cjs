const test = require('node:test');
const assert = require('node:assert/strict');
const { loadData, buildUser, buildAirlinesUser } = require('../server.cjs');
const rec = require('../lib/careers-recommender');
const { generateSuggestions, prepareCandidates, buildHistoricalAdjustments, formatHistoricalFeedback, signalTokens } = require('../lib/career-suggestions');
const { chatCompletion } = require('../lib/anthropic-chat');
const { analyzeOpenResponses, fallbackAnalysis, scoreCareerOpenText } = require('../lib/open-text-signals');
const { normalizeLead, saveMatchSession } = require('../lib/match-storage');
const { schoolPassword, schoolAccessCode, validateSchoolApplication, sessionForRole } = require('../lib/admin-access');
const { normalizeFeedback, saveRecommendationFeedback } = require('../lib/recommendation-feedback');

test('el catálogo y el motor copiados conservan los candidatos', () => {
  assert.equal(rec.CAREERS.length, 229);
  const candidates = rec.getCandidates(['ingenierias'], {}, 35);
  assert.equal(candidates.length, 23);
  assert.ok(candidates.every((career) => career.area === 'Engineering'));
});

test('el proyecto genera una recomendación determinista completa sin clave', async () => {
  const source = require('../src/questionnaire-data.cjs');
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
    locale: 'pt-PT',
    intereses: ['ingenierias'],
    answers: {
      g_colegio: 'Colegio de prueba', g_sistema: 'Bachillerato español',
      modalidad: 'Ciencias – tecnológico', g_nota: 8, g_fav: ['matematicas', 'fisica'],
      g_menos: ['historia'], g_estilo: 3, g_valora: ['innovacion'], g_rasgos: ['analitico', 'curioso'],
      g_algo: 'Me interesa especialmente construir prototipos.',
      v_trabajo10: 'Quiero diseñar sistemas aeroespaciales.', v_prioridad: 'Pasión', v_paises: ['Países Bajos'],
      i_rama: ['Aeroespacial'], i_construir: 'Diseñar', i_matefis: 9, i_tecnico: 3,
    },
    academic_subjects: [{ name: 'Matemáticas', level: '' }, { name: 'Física', level: '' }],
  });
  assert.equal(user.academic_system, 'bachillerato_espanol');
  assert.equal(user.locale, 'pt-PT');
  assert.equal(user.questionnaire.locale, 'pt-PT');
  assert.deepEqual(user.questionnaire.signals.areas, ['ingenierias']);
  assert.deepEqual(user.questionnaire.signals.asignaturas_fav, ['matematicas', 'fisica']);
  assert.equal(user.questionnaire.signals.open_responses.g_algo.answer, 'Me interesa especialmente construir prototipos.');
  assert.equal(user.questionnaire.signals.open_responses.v_trabajo10.answer, 'Quiero diseñar sistemas aeroespaciales.');
  const questions = user.questionnaire.blocks.flatMap((block) => block.items.map((item) => item.q));
  assert.ok(questions.includes('¿Qué modalidad de bachillerato cursas?'));
  assert.ok(!questions.includes('Ciudad y país donde resides actualmente'));
  assert.ok(!questions.includes('¿Te atrae más la investigación o la industria?'));
  assert.match(rec.fallbackRanking(rec.getCandidates(['ingenierias'], {}, 1), 'en')[0].reason, /matches your area of interest/);
});

test('las respuestas abiertas vagas no pesan y las concretas generan señales útiles', () => {
  const vague = fallbackAnalysis({
    v_trabajo10: { question: 'Trabajo en 10 años', answer: 'No lo sé, algo que me guste.' },
  });
  const concrete = fallbackAnalysis({
    v_trabajo10: { question: 'Trabajo en 10 años', answer: 'Quiero diseñar motores de aviones y trabajar en investigación aeroespacial.' },
  });
  assert.ok(vague.informativeness < 0.25);
  assert.ok(concrete.informativeness >= 0.7);
  assert.ok(concrete.positive_terms.includes('aerospace engineering'));
  assert.ok(concrete.positive_terms.includes('mechanical engineering'));

  const aerospace = rec.findCareer('tud-aerospace-engineering');
  const unrelated = rec.CAREERS.find((career) => career.area === 'Business & Economics');
  assert.ok(scoreCareerOpenText(aerospace, concrete) > scoreCareerOpenText(unrelated, concrete));
});

test('una respuesta abierta concreta amplía candidatos sin sustituir el área elegida', () => {
  const analysis = {
    informativeness: 0.95,
    positive_terms: ['aerospace engineering', 'aircraft propulsion', 'research'],
    negative_terms: [], constraints: [], source_fields: ['v_trabajo10'], method: 'ai',
  };
  const candidates = prepareCandidates(['business'], { areas: ['business'], open_text_analysis: analysis }, [], [], 35);
  assert.ok(candidates.slice(0, 10).some((career) => career.program_code === 'tud-aerospace-engineering'));
  assert.ok(candidates.slice(0, 10).some((career) => career.area === 'Business & Economics'));
  assert.ok(signalTokens({ open_text_analysis: analysis }).has('open:aerospace engineering'));
});

test('Claude puede estructurar respuestas abiertas sin inventar señales', async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const previousFetch = global.fetch;
  process.env.ANTHROPIC_API_KEY = 'clave_de_prueba';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      model: 'modelo_de_prueba',
      content: [{ type: 'text', text: JSON.stringify({
        informativeness: 0.92,
        summary: 'Objetivo aeroespacial concreto.',
        positive_terms: ['aerospace engineering', 'research'],
        negative_terms: [], constraints: [], source_fields: ['v_trabajo10'],
      }) }],
    }),
  });
  try {
    const analysis = await analyzeOpenResponses({
      v_trabajo10: { question: 'Trabajo en 10 años', answer: 'Quiero investigar sistemas de propulsión para aviones.' },
    }, 'es');
    assert.equal(analysis.method, 'ai');
    assert.equal(analysis.informativeness, 0.92);
    assert.deepEqual(analysis.positive_terms, ['aerospace engineering', 'research']);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});

test('el análisis abierto llega al ranking final y queda guardado como señal', async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const previousFetch = global.fetch;
  const analysis = {
    informativeness: 0.95, summary: 'Objetivo aeroespacial concreto.',
    positive_terms: ['aerospace engineering', 'research'], negative_terms: [], constraints: [], source_fields: ['v_trabajo10'],
  };
  const signals = {
    areas: ['business'],
    open_responses: { v_trabajo10: { question: 'Trabajo en 10 años', answer: 'Quiero investigar sistemas aeroespaciales.' } },
  };
  const selected = prepareCandidates(['business'], { ...signals, open_text_analysis: analysis }, [], [], 35).slice(0, 10);
  let requestCount = 0;
  process.env.ANTHROPIC_API_KEY = 'clave_de_prueba';
  global.fetch = async () => {
    requestCount += 1;
    const text = requestCount === 1
      ? JSON.stringify(analysis)
      : JSON.stringify(selected.map((career, index) => ({
        program_code: career.program_code, compatibility: 90 - index,
        reason: 'Encaje comprobado.', strengths: ['perfil', 'objetivo'],
      })));
    return { ok: true, json: async () => ({ model: 'modelo_de_prueba', content: [{ type: 'text', text }] }) };
  };
  try {
    const result = await generateSuggestions({
      intereses: ['business'], locale: 'es',
      questionnaire: { locale: 'es', signals, blocks: [{ title: 'Vocacional', items: [{ q: 'Trabajo en 10 años', a: 'Quiero investigar sistemas aeroespaciales.' }] }] },
    });
    assert.equal(requestCount, 2);
    assert.equal(result.source, 'ai');
    assert.equal(signals.open_text_analysis.method, 'ai');
    assert.ok(result.items.some((career) => career.program_code === 'tud-aerospace-engineering'));
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousKey;
  }
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
    return { ok: true, status: 201, json: async () => [{ id: '11111111-1111-4111-8111-111111111111' }] };
  };

  try {
    const result = await saveMatchSession({
      lead: {
        nombre: 'Ana', apellidos: 'García', email: 'ANA@example.com', telefono: '+34 600 000 000',
        colegio: 'Colegio Robin', curso: '2º de Bachillerato', ciudad: 'Madrid', pais: 'España', consent: true,
      },
      user: {
        intereses: ['ingenierias'], academic_system: 'bachillerato_espanol',
        academic_subjects: [{ name: 'Matemáticas', level: '' }], questionnaire: { version: 1 },
      },
      suggestions: { source: 'fallback', model: null, items: [{ program_code: 'TEST' }] },
    });
    assert.deepEqual(result, { saved: true, id: '11111111-1111-4111-8111-111111111111' });
    assert.equal(request.url, 'https://proyecto.supabase.co/rest/v1/matching_sessions?select=id');
    assert.equal(request.options.headers.apikey, 'sb_secret_prueba');
    assert.equal(request.options.headers.authorization, undefined);
    assert.equal(JSON.parse(request.options.body).email, 'ana@example.com');
    assert.equal(JSON.parse(request.options.body).questionnaire.course, '2º de Bachillerato');
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSecret;
  }
});

test('las valoraciones se validan y generan una señal histórica por perfil', () => {
  const feedback = normalizeFeedback({
    session_id: '11111111-1111-4111-8111-111111111111',
    program_code: 'tud-aerospace-engineering',
    decision: 'approved',
  });
  assert.equal(feedback.decision, 'approved');
  assert.throws(() => normalizeFeedback({
    session_id: feedback.matching_session_id,
    program_code: feedback.program_code,
    decision: 'maybe',
  }), /valoración/);

  const signals = {
    asignaturas_fav: ['matematicas', 'fisica'], rasgos: ['analitico'], prioridad: 'Pasión',
    open_text_analysis: { informativeness: 0.9, positive_terms: ['aerospace engineering'], negative_terms: [] },
  };
  const history = [
    { program_code: 'tud-aerospace-engineering', decision: 'approved', signals },
    { program_code: 'tud-computer-science-and-engineering', decision: 'rejected', signals },
  ];
  const adjustments = buildHistoricalAdjustments(signals, history);
  assert.ok(adjustments.get('tud-aerospace-engineering') > 0);
  assert.ok(adjustments.get('tud-computer-science-and-engineering') < 0);
  assert.match(formatHistoricalFeedback(history), /SI: tud-aerospace-engineering/);
});

test('la valoración del alumno se guarda una sola vez por sesión y carrera', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  const previousFetch = global.fetch;
  const requests = [];
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_prueba';
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (requests.length === 1) return {
      ok: true,
      json: async () => [{
        id: '11111111-1111-4111-8111-111111111111',
        recommendations: [{ program_code: 'tud-aerospace-engineering' }],
      }],
    };
    return { ok: true };
  };
  try {
    const result = await saveRecommendationFeedback({
      session_id: '11111111-1111-4111-8111-111111111111',
      program_code: 'tud-aerospace-engineering',
      decision: 'approved',
    });
    assert.equal(result.saved, true);
    assert.match(requests[1].url, /on_conflict=matching_session_id,program_code/);
    assert.equal(requests[1].options.headers.prefer, 'resolution=merge-duplicates,return=minimal');
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previousSecret;
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
