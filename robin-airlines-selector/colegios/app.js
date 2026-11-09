(() => {
'use strict';
const form = document.querySelector('#application-form');
const panel = document.querySelector('#panel');
const errorBox = document.querySelector('#form-error');
const siteBaseUrl = new URL('../', document.currentScript?.src || location.href);

form.addEventListener('submit', async (event) => {
  event.preventDefault(); errorBox.hidden = true;
  const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Enviando…';
  const payload = Object.fromEntries(new FormData(form));
  try {
    const response = await fetch(new URL('api/school/apply', siteBaseUrl), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se ha podido enviar la solicitud');
    panel.className = 'application-panel success';
    panel.innerHTML = `<span class="success-mark">✓</span><h2>Solicitud recibida</h2><p>El equipo Robin revisará los datos del colegio. Si se aprueba, enviaremos las credenciales y el enlace para tus alumnos al correo corporativo indicado.</p><a href="${siteBaseUrl.href}">Volver al matching de carreras</a>`;
  } catch (error) {
    errorBox.textContent = error.message; errorBox.hidden = false; button.disabled = false; button.textContent = 'Enviar solicitud';
  }
});
})();
