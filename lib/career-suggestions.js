const { chatCompletion } = require('./anthropic-chat');
const rec = require('./careers-recommender');
const { analyzeOpenResponses, scoreCareerOpenText } = require('./open-text-signals');

/** Extrae el primer array JSON de un texto (la IA puede envolverlo en prosa). */
function extractJsonArray(text) {
  if (!text) return null;
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function signalTokens(signals) {
  const value = signals || {};
  const tokens = new Set();
  ['asignaturas_fav', 'asignaturas_menos', 'rasgos', 'valora', 'paises'].forEach((field) => {
    (Array.isArray(value[field]) ? value[field] : []).forEach((item) => tokens.add(`${field}:${item}`));
  });
  ['prioridad', 'nivel_ingles'].forEach((field) => { if (value[field]) tokens.add(`${field}:${value[field]}`); });
  if (Number.isFinite(value.estilo_aprendizaje)) tokens.add(`estilo:${Math.round(value.estilo_aprendizaje / 3)}`);
  const open = value.open_text_analysis;
  if (open && open.informativeness >= 0.35) {
    (open.positive_terms || []).slice(0, 12).forEach((term) => tokens.add(`open:${String(term).trim().toLowerCase()}`));
    (open.negative_terms || []).slice(0, 8).forEach((term) => tokens.add(`avoid:${String(term).trim().toLowerCase()}`));
  }
  return tokens;
}

function buildHistoricalAdjustments(signals, history) {
  const current = signalTokens(signals);
  const scores = new Map();
  (Array.isArray(history) ? history : []).forEach((entry) => {
    if (!entry || !rec.findCareer(entry.program_code) || !['approved', 'rejected'].includes(entry.decision)) return;
    const previous = signalTokens(entry.signals);
    let overlap = 0;
    current.forEach((token) => { if (previous.has(token)) overlap += 1; });
    const similarity = current.size && previous.size ? overlap / Math.sqrt(current.size * previous.size) : 0;
    const vote = (entry.decision === 'approved' ? 1 : -1) * (0.25 + similarity);
    scores.set(entry.program_code, (scores.get(entry.program_code) || 0) + vote);
  });
  return new Map([...scores].map(([code, score]) => [code, Math.max(-10, Math.min(10, Math.round(score * 4)))]));
}

function prepareCandidates(intereses, signals, feedback, history, limit = 35) {
  const decisions = new Map((feedback || []).map((entry) => [entry.program_code, entry.decision]));
  const approved = (feedback || [])
    .filter((entry) => entry.decision === 'approved')
    .map((entry) => rec.findCareer(entry.program_code))
    .filter(Boolean);
  const adjustments = buildHistoricalAdjustments(signals, history);
  const analysis = signals.open_text_analysis || {};
  const areaNames = (intereses || []).map((area) => rec.AREA_MAP[area]).filter(Boolean);
  const scored = rec.CAREERS.map((career) => {
    const historyAdjustment = adjustments.get(career.program_code) || 0;
    const openAdjustment = scoreCareerOpenText(career, analysis);
    const deterministic = rec.deterministicScore(career, signals, areaNames);
    return {
      ...career,
      _history: historyAdjustment,
      _open: openAdjustment,
      _det: Math.max(0, Math.min(100, deterministic + historyAdjustment + openAdjustment)),
    };
  });
  let areaPool = scored.filter((career) => !areaNames.length || areaNames.includes(career.area)).sort((a, b) => b._det - a._det);
  if (!areaPool.length) areaPool = scored.slice().sort((a, b) => b._det - a._det);
  const base = areaPool.slice(0, limit);
  if (analysis.informativeness >= 0.45 && (analysis.positive_terms || []).length) {
    const crossArea = scored
      .filter((career) => !areaNames.includes(career.area) && career._open >= 4)
      .sort((a, b) => b._open - a._open || b._det - a._det)
      .slice(0, 8);
    crossArea.forEach((career, index) => base.splice(Math.min(7 + index, base.length), 0, career));
    base.length = Math.min(base.length, limit);
  }
  const unique = new Map();
  [...approved, ...base].forEach((career) => {
    if (!career || decisions.get(career.program_code) === 'rejected' || unique.has(career.program_code)) return;
    unique.set(career.program_code, career);
  });
  return [...unique.values()].slice(0, limit);
}

function formatHistoricalFeedback(history) {
  if (!Array.isArray(history) || !history.length) return '(todavía no hay valoraciones de alumnos)';
  return history.slice(0, 60).map((entry) => {
    const pattern = [...signalTokens(entry.signals)].slice(0, 12).join(', ') || 'sin señales comparables';
    return `- ${entry.decision === 'approved' ? 'SI' : 'NO'}: ${entry.program_code} | perfil: ${pattern}`;
  }).join('\n');
}

function formatAdvisorFeedback(feedback) {
  if (!Array.isArray(feedback) || !feedback.length) return '(sin decisiones previas del asesor)';
  return feedback.map((entry) => {
    const career = rec.findCareer(entry.program_code);
    const label = career ? `${career.career_name} · ${career.university}` : entry.program_code;
    return `- ${entry.decision === 'approved' ? 'APROBADA' : 'DESCARTADA'}: ${label} (${entry.program_code})`;
  }).join('\n');
}

/** Genera las 10 carreras sugeridas para un cliente. */
async function generateSuggestions(user, feedback = [], history = []) {
  const intereses = Array.isArray(user.intereses) ? user.intereses : [];
  const questionnaire = user.questionnaire || {};
  const signals = questionnaire.signals || {};
  const locale = ['es', 'en', 'pt-PT'].includes(user.locale || questionnaire.locale) ? (user.locale || questionnaire.locale) : 'es';
  const outputLanguage = { es: 'español', en: 'English', 'pt-PT': 'português europeu' }[locale];
  const emptyReason = {
    es: 'Buen encaje con el perfil del estudiante.',
    en: 'A good match for the student profile.',
    'pt-PT': 'Boa correspondência com o perfil do aluno.',
  }[locale];

  const openTextAnalysis = await analyzeOpenResponses(signals.open_responses, locale);
  delete openTextAnalysis.responses;
  signals.open_text_analysis = openTextAnalysis;

  const candidates = prepareCandidates(intereses, signals, feedback, history, 35);
  const fallback = rec.fallbackRanking(candidates, locale);

  let items = null;
  let model = null;
  let aiOk = false;

  try {
    const profile = rec.formatStudentProfile(questionnaire, intereses);
    const catalog = candidates.map((candidate) => ({
      ...rec.compactCareer(candidate),
      historical_feedback_adjustment: candidate._history || 0,
      open_text_adjustment: candidate._open || 0,
    }));

    const system =
      'Eres un orientador academico experto en grados universitarios de ' +
      'investigacion (WO) en los Paises Bajos impartidos en ingles. Tu tarea ' +
      'es seleccionar, de un catalogo dado, las 10 carreras de MAXIMA ' +
      'compatibilidad con el perfil de un estudiante.\n\n' +
      'Reglas:\n' +
      '- Usa SOLO carreras del catalogo (campo program_code exacto).\n' +
      '- Prioriza las areas de interes que el estudiante ha elegido, pero ' +
      'valora tambien el encaje real de aptitudes, personalidad y estilo de ' +
      'aprendizaje (campos scores, ideal_for, difficulty).\n' +
      '- Usa las decisiones previas del asesor como una señal fuerte y específica ' +
      'para este estudiante. Favorece patrones similares a las aprobadas y evita ' +
      'los patrones de las descartadas. Nunca vuelvas a recomendar un program_code descartado.\n' +
      '- Usa las valoraciones históricas anónimas de alumnos como una señal adicional: ' +
      'busca coincidencias entre perfiles parecidos y sus respuestas SI/NO, sin sustituir ' +
      'el análisis académico del estudiante actual.\n' +
      '- Usa el análisis de respuestas abiertas de forma proporcional a "informativeness": ' +
      'ignóralo si es vago; si es concreto, úsalo como señal relevante pero limitada y comprueba ' +
      'que encaje con las demás respuestas. No infieras datos sensibles ni cites información privada.\n' +
      '- Devuelve EXACTAMENTE 10 carreras, ordenadas de mayor a menor ' +
      'compatibilidad.\n' +
      '- "compatibility" es un entero 0-100 realista (no todas 95+).\n' +
      `- "reason": UNA frase breve en ${outputLanguage}. "strengths": 2-4 palabras clave en ${outputLanguage}.\n` +
      '- Responde UNICAMENTE con un array JSON valido, sin texto adicional.\n' +
      'Formato de cada elemento: {"program_code":"...","compatibility":NN,' +
      '"reason":"una frase breve","strengths":"2-4 palabras clave"}';

    const userMsg =
      'PERFIL DEL ESTUDIANTE (cuestionario de onboarding):\n' +
      profile +
      '\n\n=== ANALISIS DE RESPUESTAS ABIERTAS ===\n' +
      JSON.stringify(openTextAnalysis) +
      '\n\n=== DECISIONES PREVIAS DEL ASESOR ===\n' +
      formatAdvisorFeedback(feedback) +
      '\n\n=== VALORACIONES HISTORICAS DE ALUMNOS DEL MISMO AREA ===\n' +
      formatHistoricalFeedback(history) +
      '\n\n=== CATALOGO DE CARRERAS CANDIDATAS (' + catalog.length + ') ===\n' +
      JSON.stringify(catalog) +
      '\n\nDevuelve el array JSON con las 10 mejores.';

    const { text, raw } = await chatCompletion({
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 2600,
    });
    model = (raw && raw.model) || null;

    const parsed = extractJsonArray(text);
    if (Array.isArray(parsed) && parsed.length) {
      const built = [];
      const selectedCodes = new Set();
      const permittedCodes = new Set(candidates.map((candidate) => candidate.program_code));
      parsed.forEach((p) => {
        if (!p || !p.program_code) return;
        if (!permittedCodes.has(p.program_code)) return;
        if (selectedCodes.has(p.program_code)) return;
        const c = rec.findCareer(p.program_code);
        if (!c) return;
        let comp = parseInt(p.compatibility, 10);
        if (isNaN(comp)) comp = 70;
        comp = Math.max(0, Math.min(100, comp));
        built.push({
          program_code: c.program_code,
          career_name: c.career_name,
          university: c.university,
          university_code: c.university_code,
          city: c.city,
          area: c.area,
          subarea: c.subarea,
          degree_type: c.degree_type,
          duration_years: c.duration_years,
          numerus_fixus: !!c.numerus_fixus,
          numerus_fixus_seats: c.numerus_fixus_seats || null,
          website_url: c.website_url || null,
          compatibility: comp,
          reason: String(p.reason || '').trim() || emptyReason,
          strengths: Array.isArray(p.strengths)
            ? p.strengths.join(', ')
            : String(p.strengths || '').trim(),
        });
        selectedCodes.add(c.program_code);
      });
      if (built.length) {
        fallback.forEach((item) => {
          if (built.length >= 10 || selectedCodes.has(item.program_code)) return;
          built.push(item);
          selectedCodes.add(item.program_code);
        });
        built.sort((a, b) => b.compatibility - a.compatibility);
        items = built.slice(0, 10);
        aiOk = true;
      }
    }
  } catch (e) {
    console.error('career-suggestions AI error', e.message);
  }

  if (!items || !items.length) items = fallback;

  return {
    generated_at: new Date().toISOString(),
    source: aiOk ? 'ai' : 'fallback',
    model: model,
    count: items.length,
    items: items,
  };
}

module.exports = {
  extractJsonArray, prepareCandidates, formatAdvisorFeedback, formatHistoricalFeedback,
  signalTokens, buildHistoricalAdjustments, generateSuggestions,
};
