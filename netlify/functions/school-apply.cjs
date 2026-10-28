const { getAdminClient } = require('../../lib/supabase-clients');
const { validateSchoolApplication, escapeHtml } = require('../../lib/admin-access');
const { sendEmail } = require('../../lib/email');

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}

function fail(status, message) {
  const error = new Error(message); error.status = status; throw error;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  try {
    const payload = JSON.parse(event.body || '{}');
    if (payload.website) return json(201, { received: true });
    const application = validateSchoolApplication(payload);
    const supabase = getAdminClient();
    const { data: duplicate } = await supabase.from('school_applications').select('id')
      .eq('corporate_email', application.corporate_email).eq('status', 'pending').maybeSingle();
    if (duplicate) return json(409, { error: 'Ya existe una solicitud pendiente para este correo' });

    const { data, error } = await supabase.from('school_applications').insert(application).select('id').single();
    if (error) throw error;
    const notify = process.env.APPLICATION_NOTIFY_EMAIL || 'hello@project-robin.com';
    const email = await sendEmail({
      to: notify,
      subject: `Solicitud de colegio · ${application.school_name}`,
      html: `<h1>Nueva solicitud de colegio</h1><p><strong>Colegio:</strong> ${escapeHtml(application.school_name)}</p><p><strong>Contacto:</strong> ${escapeHtml(application.contact_name)} · ${escapeHtml(application.job_title)}</p><p><strong>Correo:</strong> ${escapeHtml(application.corporate_email)}</p><p>Revísala en el panel de Matching de carreras.</p>`,
      text: `Nueva solicitud de colegio\nColegio: ${application.school_name}\nContacto: ${application.contact_name}\nPuesto: ${application.job_title}\nCorreo: ${application.corporate_email}`,
    });
    if (!email.sent) {
      await supabase.from('school_applications').delete().eq('id', data.id);
      fail(502, 'No se pudo enviar la solicitud. Inténtalo de nuevo en unos minutos.');
    }
    return json(201, { received: true, id: data.id, notified: true });
  } catch (error) {
    console.error('school-apply:', error.message);
    return json(error.status || 400, { error: error.message });
  }
};
