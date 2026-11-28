const store = require('../../lib/student-store.cjs');
const { requireVerifiedUser, readBody, json, respondError } = require('../../lib/student-api.cjs');

function policies() {
  try {
    return JSON.parse(process.env.STUDENT_AGE_POLICIES_JSON || '{}');
  } catch (_) {
    throw new Error('La política de edad no está configurada correctamente');
  }
}

function policyFor(countryCode) {
  return policies()[String(countryCode || '').toUpperCase()] || null;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const country = event.queryStringParameters?.country || '';
      const policy = policyFor(country);
      return json(200, policy ? {
        country_code: String(country).toUpperCase(),
        minimum_consent_age: Number(policy.minimum_consent_age),
        guardian_required_below: Number(policy.guardian_required_below),
        available: true,
      } : { available: false });
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
    const student = await requireVerifiedUser(event);
    const payload = readBody(event);
    const existingProfile = await store.getStudentProfile(student.userId);
    if (existingProfile) {
      return json(200, {
        profile: existingProfile,
        guardian_required: existingProfile.consent_status === 'pending_guardian',
        already_configured: true,
      });
    }
    const countryCode = String(payload.country_code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Selecciona un país válido');
    if (payload.consent_accepted !== true) throw new Error('Acepta la política de privacidad para continuar');
    const age = Number(payload.age);
    if (!Number.isInteger(age) || age < 13 || age > 120) throw new Error('Indica una edad válida');
    const policy = policyFor(countryCode);
    if (!policy) {
      const error = new Error('El registro para este país todavía no está disponible');
      error.statusCode = 403;
      throw error;
    }
    const minimumConsentAge = Number(policy.minimum_consent_age);
    const guardianRequiredBelow = Number(policy.guardian_required_below);
    if (!Number.isInteger(minimumConsentAge) || !Number.isInteger(guardianRequiredBelow) || guardianRequiredBelow < 13 || minimumConsentAge < 13) {
      throw new Error('La política de edad de este país no está configurada correctamente');
    }
    const guardianRequired = age < Math.max(minimumConsentAge, guardianRequiredBelow);
    const profile = await store.createStudentProfile({
      userId: student.userId,
      countryCode,
      consentStatus: guardianRequired ? 'pending_guardian' : 'active',
      consentedAt: guardianRequired ? null : new Date().toISOString(),
      consentVersion: guardianRequired ? null : String(process.env.STUDENT_CONSENT_VERSION || '1'),
    });
    return json(200, { profile, guardian_required: guardianRequired });
  } catch (error) {
    return respondError(error, 'student eligibility');
  }
};
