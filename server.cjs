const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { generateSuggestions } = require('./lib/career-suggestions');
const { findCareer, CAREERS } = require('./lib/careers-recommender');
const { saveMatchSession } = require('./lib/match-storage');
const { syncRecommenderLead } = require('./lib/crm-lead-sync');
const { saveRecommendationFeedback, loadFeedbackHistory } = require('./lib/recommendation-feedback');
const { ACADEMIC_SYSTEMS, academicLevelLabel, sanitizeAcademicProfile, validateAcademicGrade } = require('./src/academic-systems.cjs');
const { systems: CURRICULA } = require('./robin-airlines-selector/academic-curricula.js');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'robin-airlines-selector');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const AREA_LABELS = {
  ciencias: 'Ciencias', tecnologia_y_programacion: 'Tecnología y programación',
  business: 'Business', ciencias_de_la_salud: 'Ciencias de la salud',
  ingenierias: 'Ingenierías', ciencias_sociales: 'Ciencias sociales', artes: 'Artes',
};
let questionnaireData;

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Solicitud demasiado grande');
  }
  return JSON.parse(raw);
}

function optionValue(option) { return typeof option === 'string' ? option : option.value; }
function optionLabel(options, value) {
  const option = options.find((item) => optionValue(item) === value);
  return option ? (typeof option === 'string' ? option : option.label) : value;
}
function formatSlider(def, value) {
  if (def.suffix) return String(value) + def.suffix;
  if (def.left && def.right) return `${value}/${def.max} (${def.left} ↔ ${def.right})`;
  return `${value}/${def.max}`;
}
function collectOpenResponses(blocks, answers) {
  const responses = {};
  blocks.forEach((block) => block.questions.forEach((def) => {
    const answer = String(answers[def.id] || '').trim();
    if (def.type === 'textarea' && answer) responses[def.id] = { question: def.q, answer };
  }));
  return responses;
}

function buildUser(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Faltan respuestas');
  const email = String(payload.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Introduce un correo válido');
  const intereses = payload.intereses;
  if (!Array.isArray(intereses) || !intereses.length || intereses.some((v) => !AREA_LABELS[v]) || new Set(intereses).size !== intereses.length) {
    throw new Error('Selecciona al menos un área de interés válida');
  }
  const answers = payload.answers || {};
  const blocks = [questionnaireData.Q_GENERAL, ...intereses.map((key) => questionnaireData.Q_AREAS[key]), questionnaireData.Q_VOCACIONAL];
  for (const block of blocks) for (const def of block.questions) {
    let value = answers[def.id];
    if (def.type === 'slider') {
      value = value == null ? def.def : Number(value);
      if (!Number.isFinite(value) || value < def.min || value > def.max || (value - def.min) % def.step !== 0) throw new Error(`Valor inválido: ${def.q}`);
      answers[def.id] = value;
    } else if (def.type === 'single' || def.type === 'multi') {
      const choices = def.type === 'single' ? [value] : value;
      if (!Array.isArray(choices) || (!def.optional && !choices.length) || (def.max && choices.length > def.max) || choices.some((v) => !def.options.some((o) => optionValue(o) === v))) {
        throw new Error(`Revisa la respuesta: ${def.q}`);
      }
    } else {
      value = String(value || '').trim();
      if (!def.optional && !value) throw new Error(`Completa: ${def.q}`);
      if (value.length > 3000) throw new Error(`Respuesta demasiado larga: ${def.q}`);
      answers[def.id] = value;
    }
  }
  const academic = sanitizeAcademicProfile(payload.academic_system, payload.academic_subjects);
  if (!academic) throw new Error('Revisa el sistema académico y las asignaturas');
  const questionnaire = {
    version: 1,
    blocks: blocks.map((block) => ({
      title: block.title,
      items: block.questions.map((def) => {
        let answer = answers[def.id];
        if (def.type === 'multi') answer = answer.map((v) => optionLabel(def.options, v));
        else if (def.type === 'slider') answer = formatSlider(def, answer);
        return { q: def.q, a: answer };
      }).filter((item) => Array.isArray(item.a) ? item.a.length : String(item.a || '').trim()),
    })),
    signals: {
      nota_media: answers.g_nota,
      estilo_aprendizaje: answers.g_estilo,
      independencia: answers.g_independencia,
      presupuesto_mensual: answers.g_presupuesto,
      nivel_ingles: answers.g_ingles || '',
      asignaturas_fav: answers.g_fav || [],
      asignaturas_menos: answers.g_menos || [],
      rasgos: answers.g_rasgos || [],
      valora: answers.g_valora || [],
      prioridad: answers.v_prioridad || '',
      paises: answers.v_paises || [],
      areas: intereses,
      open_responses: collectOpenResponses(blocks, answers),
    },
  };
  return { email, intereses, questionnaire, academic_system: academic.system, academic_subjects: academic.subjects };
}

const ACADEMIC_SYSTEM_MAP = Object.fromEntries(CURRICULA.map((system) => [system.answer, system.value]));

function buildAirlinesUser(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Faltan respuestas');
  const email = String(payload.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Introduce un correo válido');
  const intereses = payload.intereses;
  const locale = ['es', 'en', 'pt-PT'].includes(payload.locale) ? payload.locale : 'es';
  if (!Array.isArray(intereses) || intereses.length !== 1 || !AREA_LABELS[intereses[0]]) {
    throw new Error('Selecciona un área de interés válida');
  }

  const answers = payload.answers && typeof payload.answers === 'object' ? { ...payload.answers } : {};
  const academicSystem = ACADEMIC_SYSTEM_MAP[answers.g_sistema];
  const curriculum = CURRICULA.find((system) => system.value === academicSystem);
  if (!curriculum) throw new Error('Selecciona un sistema educativo válido');
  const grade = validateAcademicGrade(academicSystem, answers.g_nota);
  const sourceBlocks = [questionnaireData.Q_GENERAL, questionnaireData.Q_AREAS[intereses[0]], questionnaireData.Q_VOCACIONAL];
  const blocks = sourceBlocks.map((block) => ({
    title: block.title,
    items: block.questions.flatMap((def) => {
      let answer = answers[def.id];
      if (answer == null || answer === '' || (Array.isArray(answer) && !answer.length)) return [];
      if (def.id === 'g_nota') return grade ? [{ q: '¿Cuál es tu resultado académico más reciente?', a: grade.display }] : [];
      if (def.id === 'g_sistema') return [{ q: def.q, a: curriculum.label }];
      if (def.id === 'g_fav' || def.id === 'g_menos') {
        const subjectLabels = new Map(curriculum.subjects.map((subject) => [subject.value, subject.label]));
        if (!Array.isArray(answer) || answer.some((value) => !subjectLabels.has(value))) throw new Error(`Revisa la respuesta: ${def.q}`);
        return [{ q: def.q, a: answer.map((value) => subjectLabels.get(value)) }];
      }
      if (def.type === 'slider') {
        answer = Number(answer);
        if (!Number.isFinite(answer) || answer < def.min || answer > def.max || (answer - def.min) % def.step !== 0) {
          throw new Error(`Valor inválido: ${def.q}`);
        }
        answers[def.id] = answer;
        answer = formatSlider(def, answer);
      } else if (def.type === 'single' || def.type === 'multi') {
        const choices = def.type === 'single' ? [answer] : answer;
        if (!Array.isArray(choices) || (def.max && choices.length > def.max) || choices.some((value) => !def.options.some((option) => optionValue(option) === value))) {
          throw new Error(`Revisa la respuesta: ${def.q}`);
        }
        if (def.type === 'multi') answer = choices.map((value) => optionLabel(def.options, value));
      } else {
        answer = String(answer).trim();
        if (answer.length > 3000) throw new Error(`Respuesta demasiado larga: ${def.q}`);
        answers[def.id] = answer;
      }
      return [{ q: def.q, a: answer }];
    }),
  }));

  if (curriculum.tracks.length && !answers.modalidad) throw new Error('Indica el itinerario o modalidad');
  if (answers.modalidad) {
    const legacySpanishTracks = ['Ciencias – tecnológico', 'Ciencias – biosanitario', 'Humanidades y Ciencias Sociales', 'Artes', 'General'];
    if (!curriculum.tracks.includes(answers.modalidad) && !(academicSystem === 'bachillerato_espanol' && legacySpanishTracks.includes(answers.modalidad))) {
      throw new Error('Revisa el itinerario o modalidad');
    }
    const general = blocks[0];
    const position = Math.min(2, general.items.length);
    general.items.splice(position, 0, { q: '¿Qué itinerario o modalidad cursas?', a: String(answers.modalidad).slice(0, 160) });
  }

  const academic = sanitizeAcademicProfile(academicSystem, payload.academic_subjects);
  if (!academic) throw new Error('Revisa el sistema académico y las asignaturas');
  blocks.push({ title: 'Asignaturas cursadas', items: [
    { q: 'Sistema educativo', a: curriculum.label },
    { q: 'Asignaturas de este curso', a: academic.subjects.map((subject) =>
      `${subject.name}${subject.level ? ` (${academicLevelLabel(academicSystem, subject.level)})` : ''}`) },
  ] });

  return {
    email,
    intereses,
    questionnaire: {
      version: 1,
      locale,
      blocks,
      signals: {
        nota_media: grade?.display || null,
        nota_media_escala: grade?.scale || null,
        estilo_aprendizaje: answers.g_estilo,
        independencia: answers.g_independencia,
        presupuesto_mensual: answers.g_presupuesto,
        nivel_ingles: answers.g_ingles || '',
        asignaturas_fav: answers.g_fav || [],
        asignaturas_menos: answers.g_menos || [],
        rasgos: answers.g_rasgos || [],
        valora: answers.g_valora || [],
        prioridad: answers.v_prioridad || '',
        paises: answers.v_paises || [],
        areas: intereses,
        open_responses: collectOpenResponses(sourceBlocks, answers),
      },
    },
    academic_system: academic.system,
    academic_subjects: academic.subjects,
    locale,
  };
}

function validateFeedback(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && findCareer(entry.program_code) && ['approved', 'rejected'].includes(entry.decision))
    .map(({ program_code, decision }) => ({ program_code, decision }));
}

async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/student/')) {
    const routeName = url.pathname.slice('/api/student/'.length);
    const functions = {
      match: 'student-match',
      history: 'student-history',
      legacy: 'student-legacy',
      feedback: 'student-feedback',
      account: 'student-account',
      config: 'student-config',
      eligibility: 'student-eligibility',
      'guardian-consent': 'student-guardian',
    };
    const functionName = functions[routeName];
    if (!functionName) return send(res, 404, { error: 'No encontrado' });
    const { handler: studentHandler } = require(`./netlify/functions/${functionName}.cjs`);
    const result = await studentHandler({
      httpMethod: req.method,
      headers: req.headers,
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(await readBody(req)) : null,
    });
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
    return;
  }
  if (url.pathname === '/.netlify/functions/admin') {
    const { handler: adminHandler } = require('./netlify/functions/admin.cjs');
    const result = await adminHandler({
      httpMethod: req.method,
      headers: req.headers,
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: req.method === 'POST' ? JSON.stringify(await readBody(req)) : null,
    });
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
    return;
  }
  if (url.pathname === '/api/school/apply') {
    const { handler: schoolApplyHandler } = require('./netlify/functions/school-apply.cjs');
    const result = await schoolApplyHandler({
      httpMethod: req.method,
      headers: req.headers,
      body: req.method === 'POST' ? JSON.stringify(await readBody(req)) : null,
    });
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/config') {
    return send(res, 200, { ...questionnaireData, academicSystems: ACADEMIC_SYSTEMS, areaLabels: AREA_LABELS, careerCount: CAREERS.length });
  }
  if (req.method === 'POST' && url.pathname === '/api/match') {
    try {
      const payload = await readBody(req);
      const user = payload.experience === 'robin-airlines' ? buildAirlinesUser(payload) : buildUser(payload);
      const history = payload.experience === 'robin-airlines' ? await loadFeedbackHistory(user.intereses[0]) : [];
      const suggestions = await generateSuggestions(user, validateFeedback(payload.feedback), history);
      const storage = payload.experience === 'robin-airlines'
        ? await saveMatchSession({ lead: payload.lead, user, suggestions, schoolCode: payload.school_code })
        : { saved: false, reason: 'legacy_experience' };
      if (payload.experience === 'robin-airlines') {
        await syncRecommenderLead({ lead: payload.lead, sessionId: storage.id, area: user.intereses[0] });
      }
      return send(res, 200, { suggestions, storage });
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/feedback') {
    try {
      return send(res, 200, await saveRecommendationFeedback(await readBody(req)));
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  let requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  if (requested.endsWith('/') || !path.extname(requested)) requested = path.join(requested, 'index.html');
  const filename = path.resolve(PUBLIC, requested);
  if (filename !== PUBLIC && !filename.startsWith(PUBLIC + path.sep)) return send(res, 404, { error: 'No encontrado' });
  try {
    const content = await fs.readFile(filename);
    const extension = path.extname(filename).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
      '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
    };
    res.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream' });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return send(res, 404, { error: 'No encontrado' });
    throw error;
  }
}

async function loadData() {
  const data = require('./src/questionnaire-data.cjs');
  questionnaireData = { Q_GENERAL: data.Q_GENERAL, Q_AREAS: data.Q_AREAS, Q_VOCACIONAL: data.Q_VOCACIONAL };
}

function getStudentConfig() {
  if (!questionnaireData) throw new Error('El cuestionario aún no está cargado');
  return { ...questionnaireData, academicSystems: ACADEMIC_SYSTEMS, areaLabels: AREA_LABELS, careerCount: CAREERS.length };
}

async function start(port = PORT) {
  await loadData();
  const server = http.createServer((req, res) => handler(req, res).catch((error) => send(res, 500, { error: error.message })));
  server.listen(port, HOST, () => console.log(`Bachelor Matching Tool: http://${HOST}:${server.address().port}`));
  return server;
}

if (require.main === module) start().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { start, buildUser, buildAirlinesUser, validateFeedback, loadData, getStudentConfig };
