async function sendEmail({ to, subject, html, text }) {
  const key = String(process.env.RESEND_API_KEY || '');
  const from = process.env.RESEND_FROM || 'Project Robin <no-reply@project-robin.com>';
  if (!key) return { sent: false, reason: 'RESEND_API_KEY no configurada' };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, text }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { sent: false, reason: `Resend HTTP ${response.status}` };
  return { sent: true, id: data.id };
}

module.exports = { sendEmail };
