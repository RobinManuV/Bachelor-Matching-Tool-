const { getStudentProfile } = require('./student-store.cjs');

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function header(headers, name) {
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry ? String(entry[1] || '') : '';
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || '');
  if (!url || !key) throw new Error('Supabase Auth no está configurado');
  return { url, key };
}

async function requireVerifiedUser(event) {
  const authorization = header(event?.headers, 'authorization');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Inicia sesión para continuar');
    error.statusCode = 401;
    throw error;
  }
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${match[1]}` },
  });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) {
    const error = new Error('La sesión ha caducado. Inicia sesión de nuevo.');
    error.statusCode = 401;
    throw error;
  }
  if (!(user.email_confirmed_at || user.confirmed_at) || !user.email) {
    const error = new Error('Confirma tu correo antes de continuar');
    error.statusCode = 403;
    throw error;
  }
  return { userId: user.id, email: String(user.email).trim().toLowerCase() };
}

async function requireStudent(event) {
  const user = await requireVerifiedUser(event);
  const profile = await getStudentProfile(user.userId);
  if (profile?.consent_status !== 'active') {
    const error = new Error('Completa la autorización de tu perfil para continuar');
    error.statusCode = 403;
    throw error;
  }
  return { ...user, emailVerified: true, profile };
}

function readBody(event, maxLength = 1_000_000) {
  const rawBody = event?.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : String(event?.body || '');
  if (!rawBody || Buffer.byteLength(rawBody) > maxLength) throw new Error('Solicitud inválida');
  try {
    return JSON.parse(rawBody);
  } catch (_) {
    throw new Error('El contenido de la solicitud no es válido');
  }
}

function respondError(error, prefix = 'student API') {
  const statusCode = Number(error?.statusCode) || 400;
  if (statusCode >= 500) console.error(`${prefix}:`, error.message);
  return json(statusCode, { error: error.message || 'No se pudo completar la solicitud' });
}

module.exports = { json, header, requireVerifiedUser, requireStudent, readBody, respondError };
