const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { generateSuggestions } = require('./lib/career-suggestions');
const { findCareer, CAREERS } = require('./lib/careers-recommender');
const { saveMatchSession } = require('./lib/match-storage');
const { ACADEMIC_SYSTEMS, sanitizeAcademicProfile } = require('./src/academic-systems.cjs');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'robin-airlines-selector');
const PORT = Number(process.env.PORT) || 3000;
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
    },
  };
  return { email, intereses, questionnaire, academic_system: academic.system, academic_subjects: academic.subjects };
}

const ACADEMIC_SYSTEM_MAP = {
  'Bachillerato español': 'bachillerato_espanol',
  'Bachillerato Internacional (IB)': 'ib',
  'A-Levels (británico)': 'a_levels',
  'Sistema americano': 'high_school_diploma',
  'Bac francés': 'baccalaureat_frances',
  Otro: 'otro',
};

function buildAirlinesUser(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Faltan respuestas');
  const email = String(payload.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Introduce un correo válido');
  const intereses = payload.intereses;
  if (!Array.isArray(intereses) || intereses.length !== 1 || !AREA_LABELS[intereses[0]]) {
    throw new Error('Selecciona un área de interés válida');
  }

  const answers = payload.answers && typeof payload.answers === 'object' ? { ...payload.answers } : {};
  const sourceBlocks = [questionnaireData.Q_GENERAL, questionnaireData.Q_AREAS[intereses[0]], questionnaireData.Q_VOCACIONAL];
  const blocks = sourceBlocks.map((block) => ({
    title: block.title,
    items: block.questions.flatMap((def) => {
      let answer = answers[def.id];
      if (answer == null || answer === '' || (Array.isArray(answer) && !answer.length)) return [];
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

  if (answers.modalidad) {
    const general = blocks[0];
    const position = Math.min(2, general.items.length);
    general.items.splice(position, 0, { q: '¿Qué modalidad de bachillerato cursas?', a: String(answers.modalidad).slice(0, 160) });
  }

  const academicSystem = ACADEMIC_SYSTEM_MAP[answers.g_sistema];
  const academic = sanitizeAcademicProfile(academicSystem, payload.academic_subjects);
  if (!academic) throw new Error('Revisa el sistema académico y las asignaturas');

  return {
    email,
    intereses,
    questionnaire: {
      version: 1,
      blocks,
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
      },
    },
    academic_system: academic.system,
    academic_subjects: academic.subjects,
  };
}

function validateFeedback(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && findCareer(entry.program_code) && ['approved', 'rejected'].includes(entry.decision))
    .map(({ program_code, decision }) => ({ program_code, decision }));
}

async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/config') {
    return send(res, 200, { ...questionnaireData, academicSystems: ACADEMIC_SYSTEMS, areaLabels: AREA_LABELS, careerCount: CAREERS.length });
  }
  if (req.method === 'POST' && url.pathname === '/api/match') {
    try {
      const payload = await readBody(req);
      const user = payload.experience === 'robin-airlines' ? buildAirlinesUser(payload) : buildUser(payload);
      const suggestions = await generateSuggestions(user, validateFeedback(payload.feedback));
      const storage = payload.experience === 'robin-airlines'
        ? await saveMatchSession({ lead: payload.lead, user, suggestions })
        : { saved: false, reason: 'legacy_experience' };
      return send(res, 200, { suggestions, storage });
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filename = path.resolve(PUBLIC, requested);
  if (filename !== PUBLIC && !filename.startsWith(PUBLIC + path.sep)) return send(res, 404, { error: 'No encontrado' });
  try {
    const content = await fs.readFile(filename);
    const extension = path.extname(filename).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
      '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
    };
    res.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream' });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return send(res, 404, { error: 'No encontrado' });
    throw error;
  }
}

async function loadData() {
  const data = await import(pathToFileURL(path.join(ROOT, 'src/questionnaire-data.mjs')).href);
  questionnaireData = { Q_GENERAL: data.Q_GENERAL, Q_AREAS: data.Q_AREAS, Q_VOCACIONAL: data.Q_VOCACIONAL };
}

async function start(port = PORT) {
  await loadData();
  const server = http.createServer((req, res) => handler(req, res).catch((error) => send(res, 500, { error: error.message })));
  server.listen(port, '127.0.0.1', () => console.log(`Bachelor Matching Tool: http://localhost:${server.address().port}`));
  return server;
}

if (require.main === module) start().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { start, buildUser, buildAirlinesUser, validateFeedback, loadData };
