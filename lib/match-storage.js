const MAX_TEXT_LENGTH = 500;

function cleanText(value, field, minLength = 2) {
  const text = String(value || '').trim();
  if (text.length < minLength || text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Revisa el campo ${field}`);
  }
  return text;
}

function normalizeLead(value) {
  if (!value || typeof value !== 'object') throw new Error('Faltan los datos del billete');
  if (value.consent !== true) throw new Error('Debes aceptar el tratamiento de datos');

  const email = String(value.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 320) {
    throw new Error('Introduce un correo válido');
  }

  const phone = cleanText(value.telefono, 'teléfono');
  if (phone.replace(/\D/g, '').length < 9) throw new Error('Introduce un teléfono válido');

  return {
    first_name: cleanText(value.nombre, 'nombre'),
    last_name: cleanText(value.apellidos, 'apellidos'),
    email,
    phone,
    school: cleanText(value.colegio, 'colegio'),
    origin_city: cleanText(value.ciudad, 'ciudad'),
    origin_country: cleanText(value.pais, 'país'),
  };
}

function buildSessionRow({ lead, user, suggestions }) {
  const person = normalizeLead(lead);
  if (!user || !Array.isArray(user.intereses) || user.intereses.length !== 1) {
    throw new Error('Falta el área de interés');
  }
  if (!suggestions || !Array.isArray(suggestions.items) || !suggestions.items.length) {
    throw new Error('No hay recomendaciones que guardar');
  }

  return {
    ...person,
    consented_at: new Date().toISOString(),
    selected_area: user.intereses[0],
    academic_system: user.academic_system,
    academic_subjects: user.academic_subjects || [],
    questionnaire: user.questionnaire || {},
    recommendation_source: suggestions.source,
    recommendation_model: suggestions.model || null,
    recommendations: suggestions.items,
  };
}

async function saveMatchSession(input) {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const secret = String(process.env.SUPABASE_SECRET_KEY || '');
  const isNetlify = process.env.NETLIFY === 'true' || Boolean(process.env.CONTEXT);

  if (!url && !secret && !isNetlify) return { saved: false, reason: 'database_not_configured' };
  if (!url || !secret) throw new Error('La base de datos no está configurada correctamente');

  const response = await fetch(`${url}/rest/v1/matching_sessions`, {
    method: 'POST',
    headers: {
      apikey: secret,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(buildSessionRow(input)),
  });

  if (!response.ok) {
    console.error(`Supabase matching_sessions: HTTP ${response.status}`);
    throw new Error('No se ha podido guardar el formulario');
  }
  return { saved: true };
}

module.exports = { normalizeLead, buildSessionRow, saveMatchSession };
