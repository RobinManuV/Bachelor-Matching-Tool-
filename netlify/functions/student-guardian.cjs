const crypto = require('node:crypto');
const { sendEmail } = require('../../lib/email');
const store = require('../../lib/student-store.cjs');
const { requireVerifiedUser, readBody, json, respondError } = require('../../lib/student-api.cjs');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'POST') {
      const student = await requireVerifiedUser(event);
      const profile = await store.getStudentProfile(student.userId);
      if (profile?.consent_status !== 'pending_guardian') throw new Error('Este perfil no requiere autorización de tutor');
      const guardianEmail = String(readBody(event).guardian_email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(guardianEmail) || guardianEmail.length > 320) throw new Error('Introduce un correo válido para el tutor');
      if (guardianEmail === student.email) throw new Error('Introduce un correo distinto al del estudiante');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await store.createGuardianConsent({
        userId: student.userId,
        guardianEmail,
        tokenHash: store.tokenHash(token),
        expiresAt,
      });
      const base = String(process.env.SITE_URL || '').replace(/\/$/, '');
      if (!base) throw new Error('El enlace de autorización no está configurado');
      const link = `${base}/api/student/guardian-consent?token=${encodeURIComponent(token)}`;
      const sent = await sendEmail({
        to: guardianEmail,
        subject: 'Autoriza el perfil de RobinRecomendator',
        text: `Confirma la autorización del perfil del estudiante: ${link}\nEl enlace caduca en siete días.`,
        html: `<p>Confirma la autorización del perfil del estudiante en RobinRecomendator.</p><p><a href="${escapeHtml(link)}">Revisar y autorizar</a></p><p>El enlace caduca en siete días.</p>`,
      });
      if (!sent.sent) throw new Error('No se pudo enviar el correo de autorización');
      return json(200, { sent: true });
    }
    if (event.httpMethod === 'GET') {
      const token = String(event.queryStringParameters?.token || '');
      if (!/^[0-9a-f]{64}$/i.test(token)) throw new Error('El enlace no es válido');
      await store.confirmGuardianConsent(store.tokenHash(token));
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        body: '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Perfil autorizado</title><main><h1>Perfil autorizado</h1><p>El estudiante ya puede iniciar sesión en RobinRecomendator.</p></main></html>',
      };
    }
    return json(405, { error: 'Método no permitido' });
  } catch (error) {
    return respondError(error, 'student guardian consent');
  }
};
