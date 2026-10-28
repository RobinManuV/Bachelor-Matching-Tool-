const crypto = require('node:crypto');

const ROBIN_ADMIN_EMAILS = [
  'manuel@project-robin.com',
  'noel@project-robin.com',
  'maria@project-robin.com',
];

function clean(value, field, max = 160) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (text.length < 2 || text.length > max) throw new Error(`Revisa ${field}`);
  return text;
}

function normalizeSchoolName(value) {
  return clean(value, 'el nombre del colegio').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function schoolPassword(schoolName) {
  return `Robin-${clean(schoolName, 'el nombre del colegio')}-2027`;
}

function schoolAccessCode(schoolName, suffix = crypto.randomBytes(12).toString('hex')) {
  const slug = normalizeSchoolName(schoolName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42) || 'colegio';
  return `${slug}-${suffix}`;
}

function validateSchoolApplication(value) {
  if (!value || typeof value !== 'object') throw new Error('Faltan los datos de la solicitud');
  const corporateEmail = String(value.corporate_email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(corporateEmail) || corporateEmail.length > 320) {
    throw new Error('Introduce un correo corporativo válido');
  }
  return {
    school_name: clean(value.school_name, 'el nombre del colegio'),
    contact_name: clean(value.contact_name, 'el nombre'),
    job_title: clean(value.job_title, 'el puesto'),
    corporate_email: corporateEmail,
  };
}

function sessionForRole(session, profile) {
  const recommendations = Array.isArray(session.recommendations) ? session.recommendations : [];
  if (profile.role === 'robin') return { ...session, locked_recommendation_count: 0 };
  return {
    ...session,
    recommendations: recommendations.slice(0, 3),
    locked_recommendation_count: Math.max(0, recommendations.length - 3),
  };
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

module.exports = {
  ROBIN_ADMIN_EMAILS,
  normalizeSchoolName,
  schoolPassword,
  schoolAccessCode,
  validateSchoolApplication,
  sessionForRole,
  escapeHtml,
};
