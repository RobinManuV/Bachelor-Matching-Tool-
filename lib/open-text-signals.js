const { chatCompletion } = require('./anthropic-chat');

const VAGUE = /\b(no se|no lo se|ni idea|algo que me guste|lo que sea|not sure|don t know|no idea|something i like|anything|nao sei|qualquer coisa)\b/i;
const TERM_RULES = [
  ['aerospace engineering', /\b(aeroespacial|aeronautic|aerospace|aircraft|aviones?|aviões?|propulsion)\b/i],
  ['mechanical engineering', /\b(mecanica|mecánica|mechanical|motores?|engines?)\b/i],
  ['robotics', /\b(robotica|robótica|robotics?|robots?)\b/i],
  ['computer science', /\b(informatica|informática|computer science|computing|programacion|programación|programming|software)\b/i],
  ['artificial intelligence', /\b(inteligencia artificial|artificial intelligence|machine learning|\bia\b|\bai\b)\b/i],
  ['data science', /\b(datos|data science|data analyst|analisis de datos|análisis de datos)\b/i],
  ['cybersecurity', /\b(ciberseguridad|cybersecurity|seguridad informatica|segurança informática)\b/i],
  ['medicine', /\b(medicina|medicine|medico|médico|doctor|ciruj|médica)\b/i],
  ['healthcare', /\b(salud|health|healthcare|sanitario|saude|saúde)\b/i],
  ['psychology', /\b(psicologia|psicología|psychology|psicólogo|psychologist)\b/i],
  ['biology', /\b(biologia|biología|biology|biomedic|genetic|neuroscience)\b/i],
  ['chemistry', /\b(quimica|química|chemistry|chemist)\b/i],
  ['physics', /\b(fisica|física|physics|physicist)\b/i],
  ['environment sustainability climate', /\b(medio ambiente|environment|sostenibilidad|sustentabilidade|sustainability|clima|climate)\b/i],
  ['business management', /\b(empresa|business|management|gestion|gestión|gestão)\b/i],
  ['entrepreneurship', /\b(emprender|emprendedor|startup|entrepreneur|negocio propio)\b/i],
  ['marketing', /\b(marketing|publicidad|advertising|marca|branding)\b/i],
  ['finance', /\b(finanzas|finance|financial|inversion|inversión|investment)\b/i],
  ['economics', /\b(economia|economía|economics|economist)\b/i],
  ['law', /\b(derecho|abogad|law|legal|lawyer)\b/i],
  ['politics international relations', /\b(politica|política|politics|international relations|relaciones internacionales|diplomac)\b/i],
  ['communication journalism media', /\b(comunicacion|comunicación|journalism|periodis|media|audiovisual)\b/i],
  ['design', /\b(diseño|design|designer|produto|product design)\b/i],
  ['architecture', /\b(arquitectura|architecture|architect)\b/i],
  ['arts creative', /\b(arte|arts?|creative|creativ|artist)\b/i],
  ['education teaching', /\b(educacion|educación|education|teacher|profesor|ensino|teaching)\b/i],
  ['research', /\b(investigacion|investigación|research|laboratorio|laboratory|\bi\+d\b|\br&d\b)\b/i],
  ['social impact', /\b(impacto social|social impact|ayudar a (?:la )?gente|help people|ajudar pessoas)\b/i],
];

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+&]+/g, ' ').trim();
}

function cleanList(value, limit = 16) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
    .slice(0, limit).map((item) => item.slice(0, 100));
}

function normalizeAnalysis(value, fallback) {
  const number = Number(value?.informativeness);
  const positive = cleanList(value?.positive_terms);
  const negative = cleanList(value?.negative_terms);
  const constraints = cleanList(value?.constraints, 8);
  return {
    informativeness: Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback.informativeness,
    summary: String(value?.summary || fallback.summary || '').trim().slice(0, 400),
    positive_terms: positive.length ? positive : fallback.positive_terms,
    negative_terms: negative.length ? negative : fallback.negative_terms,
    constraints: constraints.length ? constraints : fallback.constraints,
    source_fields: cleanList(value?.source_fields, 12).filter((field) => Object.hasOwn(fallback.responses, field)),
    method: value?.method === 'ai' ? 'ai' : fallback.method,
  };
}

function fallbackAnalysis(responses) {
  const entries = Object.entries(responses || {}).filter(([, item]) => String(item?.answer || '').trim());
  const text = entries.map(([, item]) => item.answer).join(' ').trim();
  if (!text) return { informativeness: 0, summary: '', positive_terms: [], negative_terms: [], constraints: [], source_fields: [], method: 'none', responses: {} };
  const words = normalized(text).split(' ').filter((word) => word.length >= 4);
  const terms = TERM_RULES.filter(([, pattern]) => pattern.test(text)).map(([term]) => term);
  let informativeness = Math.min(0.75, 0.12 + Math.max(0, new Set(words).size - 3) * 0.035 + terms.length * 0.13);
  if (VAGUE.test(normalized(text)) && terms.length === 0 && words.length < 12) informativeness = 0.08;
  if (terms.length >= 2 && words.length >= 7) informativeness = Math.max(informativeness, 0.72);
  return {
    informativeness: Math.round(informativeness * 100) / 100,
    summary: text.slice(0, 240),
    positive_terms: terms,
    negative_terms: [],
    constraints: [],
    source_fields: entries.map(([field]) => field),
    method: 'rules',
    responses,
  };
}

function extractJsonObject(text) {
  const start = String(text || '').indexOf('{');
  const end = String(text || '').lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch (_) { return null; }
}

async function analyzeOpenResponses(responses, locale = 'es') {
  const fallback = fallbackAnalysis(responses);
  if (!fallback.source_fields.length || !process.env.ANTHROPIC_API_KEY || fallback.informativeness <= 0.08) return fallback;
  try {
    const system =
      'Analyze free-text answers from a university degree questionnaire. Extract only explicit, career-relevant evidence. ' +
      'Vague answers must have very low informativeness. Concrete roles, domains, tasks or things to avoid may have high informativeness. ' +
      'Do not infer protected traits, diagnoses, ability, socioeconomic status or facts the student did not state. ' +
      'A general personal detail that cannot distinguish degrees must not influence matching. ' +
      'Return only one JSON object with: informativeness (0-1), summary (brief), positive_terms (English degree/outcome keywords), ' +
      'negative_terms (English degree/outcome keywords explicitly rejected), constraints (explicit study/career constraints), and source_fields. ' +
      'Use at most 16 positive terms, 12 negative terms and 8 constraints.';
    const { text } = await chatCompletion({
      system,
      messages: [{ role: 'user', content: `Locale: ${locale}\nAnswers:\n${JSON.stringify(responses)}` }],
      maxTokens: 700,
    });
    const parsed = extractJsonObject(text);
    if (!parsed) return fallback;
    return normalizeAnalysis({ ...parsed, method: 'ai' }, fallback);
  } catch (error) {
    console.error('open-text analysis:', error.message);
    return fallback;
  }
}

function termMatch(blob, term) {
  const phrase = normalized(term);
  if (!phrase) return 0;
  if (blob.includes(phrase)) return phrase.includes(' ') ? 2 : 1.25;
  const tokens = phrase.split(' ').filter((token) => token.length >= 4);
  if (!tokens.length) return 0;
  const hits = tokens.filter((token) => blob.includes(token)).length;
  return hits === tokens.length ? 1 : hits / tokens.length >= 0.6 ? 0.5 : 0;
}

function scoreCareerOpenText(career, analysis) {
  if (!analysis || analysis.informativeness < 0.25) return 0;
  const blob = normalized([
    career.career_name, career.area, career.subarea,
    ...(career.career_outcomes || []), ...(career.career_keywords || []),
  ].join(' '));
  const positive = (analysis.positive_terms || []).reduce((sum, term) => sum + termMatch(blob, term), 0);
  const negative = (analysis.negative_terms || []).reduce((sum, term) => sum + termMatch(blob, term), 0);
  const raw = positive * 3.5 - negative * 5;
  return Math.max(-15, Math.min(15, Math.round(raw * analysis.informativeness)));
}

module.exports = { analyzeOpenResponses, fallbackAnalysis, normalizeAnalysis, scoreCareerOpenText };
