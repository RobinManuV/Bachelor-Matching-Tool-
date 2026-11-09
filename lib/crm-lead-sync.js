const { normalizeLead } = require('./match-storage');

const CRM_LEAD_URL = 'https://robinportals.netlify.app/api/leads/website';
const AREA_LABELS = {
  ciencias: 'Ciencias', tecnologia_y_programacion: 'Tecnología y programación',
  business: 'Business', ciencias_de_la_salud: 'Ciencias de la salud',
  ingenierias: 'Ingenierías', ciencias_sociales: 'Ciencias sociales', artes: 'Artes',
};

async function syncRecommenderLead({ lead, sessionId, area }, { secret = process.env.ROBIN_CRM_LEAD_SECRET, fetchImpl = fetch } = {}) {
  if (!secret) throw new Error('La conexión con el CRM no está configurada');
  if (!sessionId) throw new Error('Falta la sesión para guardar el lead en el CRM');
  const person = normalizeLead(lead);
  const response = await fetchImpl(CRM_LEAD_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-robin-lead-secret': secret },
    body: JSON.stringify({
      form_name: 'recomendador', campaign: 'Recomendador', createOnlyEmail: true,
      submissionId: sessionId, page_url: 'https://project-robin.com/rbmt/',
      fields: {
        name: `${person.first_name} ${person.last_name}`, email: person.email, phone: person.phone,
        course: person.course, colegio: person.school, ciudad: person.origin_city,
        pais: person.origin_country, area: AREA_LABELS[area] || String(area || ''),
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) throw new Error('No se ha podido guardar el lead en el CRM. Inténtalo de nuevo.');
  return { result: data.result, leadId: data.leadId || null };
}

module.exports = { syncRecommenderLead };
