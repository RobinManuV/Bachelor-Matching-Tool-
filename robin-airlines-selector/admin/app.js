(() => {
'use strict';

const siteBaseUrl = new URL('../', document.currentScript?.src || location.href);
const adminApiUrl = new URL('.netlify/functions/admin', siteBaseUrl);
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const SESSION_KEY = 'robin_matching_admin_session';
const areaNames = { ciencias: 'Ciencias', tecnologia_y_programacion: 'Tecnología', business: 'Business', ciencias_de_la_salud: 'Salud', ingenierias: 'Ingenierías', ciencias_sociales: 'Ciencias sociales', artes: 'Artes' };

let state = { profile: null, sessions: [], applications: [], selected: null, view: 'students', query: '', session: null };

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const tr = (value) => window.RobinI18n?.t(value) || value;
const initials = (first, last = '') => `${String(first || '').charAt(0)}${String(last || '').charAt(0)}`.toUpperCase();
const formatDate = (value) => new Intl.DateTimeFormat(window.RobinI18n?.getLocale() || 'es', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const schoolOf = (profile) => Array.isArray(profile?.schools) ? profile.schools[0] : profile?.schools;

function showToast(message) {
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

async function rawApi(route, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (state.session?.access_token) headers.authorization = `Bearer ${state.session.access_token}`;
  const requestUrl = new URL(adminApiUrl);
  requestUrl.searchParams.set('route', route);
  const response = await fetch(requestUrl, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'No se pudo completar la operación'); error.status = response.status; throw error; }
  return data;
}

async function api(route, options) {
  try { return await rawApi(route, options); }
  catch (error) {
    if (error.status !== 401 || !state.session?.refresh_token || route === 'refresh') throw error;
    const fresh = await rawApi('refresh', { method: 'POST', body: { refresh_token: state.session.refresh_token } });
    state.session = { ...state.session, ...fresh }; sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
    return rawApi(route, options);
  }
}

function renderLogin(error = '') {
  app.innerHTML = `<main class="robin-login">
    <img class="robin-login-wordmark" src="../assets/img/logo-robin.png" alt="Robin">
    <div class="robin-postcard">
      <section class="robin-postcard-message" aria-labelledby="robin-login-title">
        <p class="robin-postcard-label">Tu espacio Robin</p>
        <h1 id="robin-login-title">Matching de carreras.</h1>
        <p class="robin-postcard-lead">Respuestas, perfiles y destinos académicos en un único lugar.</p>
        <div class="robin-postcard-feature"><img src="assets/robin-student.svg" alt=""><span><strong>Panel de matching</strong>Accede a tus alumnos y recomendaciones.</span></div>
      </section>
      <section class="robin-postcard-address"><div class="login-language" data-language-switcher></div>
        <div class="robin-postcard-stamp" aria-hidden="true"><img src="assets/robin-student.svg" alt=""><span>52°22′N 4°54′E</span></div>
        <h2>Acceso al panel</h2>
        <form class="form" id="login-form">
          <label class="field"><span>Correo</span><input type="email" name="email" autocomplete="username" required></label>
          <label class="field"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>
          <p class="form-error" ${error ? '' : 'hidden'} role="alert">${esc(error)}</p><button class="btn" type="submit">Entrar</button>
        </form>
      </section>
    </div>
  </main>`;
  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      const form = new FormData(event.currentTarget);
      const data = await rawApi('login', { method: 'POST', body: { email: form.get('email'), password: form.get('password') } });
      state.session = { access_token: data.access_token, refresh_token: data.refresh_token };
      state.profile = data.profile; sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
      await loadProductionData(); renderShell();
    } catch (loginError) { renderLogin(loginError.message); }
  });
}

async function loadProductionData() {
  const sessions = await api('sessions'); state.sessions = sessions.sessions || [];
  state.selected = state.sessions[0]?.id || null;
  if (state.profile.role === 'robin') { const applications = await api('applications'); state.applications = applications.applications || []; }
}

function renderShell() {
  const robin = state.profile.role === 'robin'; const school = schoolOf(state.profile);
  app.innerHTML = `<div class="shell">
    <aside class="sidebar"><div class="sidebar-brand"><img src="../assets/img/logo-robin.png" alt="Project Robin"><span>Matching de carreras</span></div>
      <div class="identity"><span class="avatar">${esc(initials(state.profile.full_name))}</span><div><strong>${esc(state.profile.full_name)}</strong><small>${robin ? 'Administración Robin' : esc(school?.name || 'Colegio')}</small></div></div>
      <nav class="nav" aria-label="Panel"><button data-view="students">Alumnos</button>${robin ? `<button data-view="applications">Solicitudes <span class="count">${state.applications.filter((x) => x.status === 'pending').length}</span></button>` : ''}</nav>
      <div class="sidebar-foot"><img src="assets/robin-student.svg" alt=""><strong>Tu espacio Robin</strong><span>Matching de carreras</span><button data-logout type="button">Cerrar sesión</button></div>
    </aside>
    <header class="topbar"><span class="topbar-title">Panel de matching</span>
      <div class="topbar-user"><div data-language-switcher></div><span>${esc(state.profile.email)}</span><span class="role-chip">${robin ? 'Robin' : 'Colegio'}</span><button class="logout-mobile" data-logout type="button">Salir</button></div>
    </header><main class="main" id="main"></main></div>`;
  document.querySelector('.nav').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (!button) return; state.view = button.dataset.view; renderView(); });
  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', () => { sessionStorage.removeItem(SESSION_KEY); state.session = null; renderLogin(); }));
  renderView();
}

function renderView() {
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
  if (state.view === 'applications' && state.profile.role === 'robin') renderApplications(); else renderStudents();
}

function filteredSessions() {
  const query = state.query.toLowerCase();
  return state.sessions.filter((session) => !query || `${session.first_name} ${session.last_name} ${session.email} ${session.school}`.toLowerCase().includes(query));
}

function renderStudents() {
  const main = document.querySelector('#main'); const school = schoolOf(state.profile); const sessions = filteredSessions();
  if (sessions.length && !sessions.some((entry) => entry.id === state.selected)) state.selected = sessions[0].id;
  const selected = state.sessions.find((entry) => entry.id === state.selected);
  const matchingUrl = school?.access_code ? new URL(`?school=${encodeURIComponent(school.access_code)}`, siteBaseUrl).href : '';
  main.innerHTML = `<header class="page-head"><div><p>${state.profile.role === 'robin' ? 'Todos los vuelos' : esc(school?.name || 'Tu colegio')}</p><h1>Manifiesto de alumnos</h1></div><div class="page-tools"><label><span class="sr">Buscar alumno</span><input class="search" id="search" type="search" placeholder="Buscar nombre, correo o colegio" value="${esc(state.query)}"></label></div></header>
    <div class="content">${matchingUrl ? `<section class="share"><h3>Enlace para tus alumnos</h3><p>Las solicitudes completadas desde este enlace quedan asociadas únicamente a tu colegio.</p><div class="share-row"><input id="school-link" readonly value="${esc(matchingUrl)}"><button class="btn" id="copy-link" type="button">Copiar enlace</button></div></section>` : ''}
    <section class="manifest"><div class="passengers"><div class="manifest-head"><span>${sessions.length} ${sessions.length === 1 ? 'alumno' : 'alumnos'}</span><span>Últimos primero</span></div>
      <div id="passenger-list">${sessions.length ? sessions.map((session) => `<button class="passenger ${session.id === state.selected ? 'active' : ''}" data-session="${esc(session.id)}"><span class="avatar">${esc(initials(session.first_name, session.last_name))}</span><span><strong>${esc(session.first_name)} ${esc(session.last_name)}</strong><small>${esc(session.school)}</small></span><time>${esc(formatDate(session.created_at))}</time></button>`).join('') : '<div class="empty">Todavía no hay alumnos asociados.</div>'}</div></div>
      <article class="dossier" id="dossier">${selected ? dossierHtml(selected) : '<div class="empty">Selecciona un alumno para abrir su expediente.</div>'}</article></section></div>`;
  document.querySelector('#search').addEventListener('input', (event) => { state.query = event.target.value; renderStudents(); const search = document.querySelector('#search'); search.focus(); search.setSelectionRange(search.value.length, search.value.length); });
  document.querySelector('#passenger-list').addEventListener('click', (event) => { const button = event.target.closest('[data-session]'); if (!button) return; state.selected = button.dataset.session; renderStudents(); });
  document.querySelector('#dossier')?.addEventListener('click', (event) => { if (event.target.closest('.locked')) showToast('Este contenido solo está disponible para administradores Robin.'); });
  document.querySelector('#copy-link')?.addEventListener('click', async () => { await navigator.clipboard.writeText(matchingUrl); showToast('Enlace copiado.'); });
}

function valueHtml(value) {
  if (Array.isArray(value)) return value.map((item) => esc(tr(item))).join(', ');
  return esc(tr(value));
}

function dossierHtml(session) {
  const blocks = session.questionnaire?.blocks || []; const recommendations = session.recommendations || [];
  const feedback = new Map((session.recommendation_feedback || []).map((item) => [item.program_code, item.decision]));
  const locked = Number(session.locked_recommendation_count || 0);
  return `<div class="dossier-top"><div><h2>${esc(session.first_name)} ${esc(session.last_name)}</h2><p>${esc(session.email)} · ${esc(session.phone)}</p></div><span class="score-stamp">${esc(areaNames[session.selected_area] || session.selected_area)}</span></div>
    <div class="facts"><div class="fact"><span>Origen</span><strong>${esc(session.origin_city)}, ${esc(tr(session.origin_country))}</strong></div><div class="fact"><span>Colegio</span><strong>${esc(session.school)}</strong></div><div class="fact"><span>Sistema</span><strong>${esc(tr(session.academic_system))}</strong></div><div class="fact"><span>Fecha</span><strong>${esc(formatDate(session.created_at))}</strong></div></div>
    <div class="dossier-body"><section class="answers"><div class="section-title"><h3>Respuestas</h3><span>${blocks.reduce((count, block) => count + (block.items?.length || 0), 0)} registradas</span></div>
      ${blocks.map((block) => `<div class="answer-block"><h4>${esc(block.title)}</h4><dl>${(block.items || []).map((item) => `<div class="qa"><dt>${esc(item.q)}</dt><dd>${valueHtml(item.a)}</dd></div>`).join('')}</dl></div>`).join('')}
      <div class="answer-block"><h4>Asignaturas</h4><dl><div class="qa"><dd>${(session.academic_subjects || []).map((subject) => esc(tr(subject.name))).join(', ') || 'Sin asignaturas registradas'}</dd></div></dl></div></section>
    <section class="recommendations"><div class="section-title"><h3>Recomendaciones</h3><span>${recommendations.length + locked} destinos</span></div><div class="rec-list">
      ${recommendations.map((item, index) => recHtml(item, index + 1, feedback.get(item.program_code))).join('')}${Array.from({ length: locked }, (_, index) => lockedRecHtml(recommendations.length + index + 1)).join('')}
    </div></section></div>`;
}

function recHtml(item, rank, decision) {
  const answer = decision ? `<small class="student-feedback ${esc(decision)}">${tr('El alumno indicó:')} ${tr(decision === 'approved' ? 'Sí' : 'No')}</small>` : '';
  return `<div class="rec"><span class="rec-rank">${rank}</span><span><strong>${esc(item.career_name)}</strong><small>${esc(item.university)} · ${esc(item.city)}</small>${answer}</span><span class="compat">${esc(item.compatibility)}%</span></div>`;
}

function lockedRecHtml(rank) {
  return `<button class="rec locked" type="button" aria-label="Recomendación ${rank}, reservada para Robin"><span class="rec-rank">${rank}</span><span><strong>Recomendación reservada</strong><small>Disponible para administradores Robin</small></span><span class="rec-lock">Solo Robin</span></button>`;
}

function renderApplications() {
  const main = document.querySelector('#main'); const pending = state.applications.filter((entry) => entry.status === 'pending').length;
  main.innerHTML = `<header class="page-head"><div><p>Acceso de colegios</p><h1>Solicitudes</h1></div></header><div class="content"><section class="applications"><div class="manifest-head"><span>${pending} pendientes</span><span>${state.applications.length} solicitudes</span></div>
    <table><thead><tr><th>Colegio</th><th>Contacto</th><th>Solicitud</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${state.applications.map((item) => `<tr><td><strong>${esc(item.school_name)}</strong></td><td><strong>${esc(item.contact_name)}</strong><small>${esc(item.job_title)} · ${esc(item.corporate_email)}</small></td><td>${esc(formatDate(item.created_at))}</td><td><span class="status ${esc(item.status)}">${item.status === 'pending' ? 'Pendiente' : item.status === 'approved' ? 'Aprobada' : 'Denegada'}</span></td><td>${item.status === 'pending' ? `<div class="actions"><button class="btn" data-decision="approve" data-id="${esc(item.id)}">Aprobar</button><button class="btn danger" data-decision="deny" data-id="${esc(item.id)}">Denegar</button></div>` : '—'}</td></tr>`).join('')}</tbody></table></section></div>`;
  main.querySelector('.applications').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-decision]'); if (!button) return;
    const action = button.dataset.decision;
    if (!confirm(action === 'approve' ? '¿Aprobar este colegio y crear sus credenciales?' : '¿Denegar esta solicitud?')) return;
    button.disabled = true;
    try {
      await api('applications/decision', { method: 'POST', body: { id: button.dataset.id, action } });
      const item = state.applications.find((entry) => entry.id === button.dataset.id);
      if (item) item.status = action === 'approve' ? 'approved' : 'denied';
      showToast(action === 'approve' ? 'Colegio aprobado y credenciales enviadas.' : 'Solicitud denegada.'); renderShell(); state.view = 'applications'; renderView();
    } catch (error) { showToast(error.message); button.disabled = false; }
  });
}

async function boot() {
  try { state.session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { state.session = null; }
  if (!state.session) { renderLogin(); return; }
  try {
    const me = await api('me'); state.profile = me.profile; await loadProductionData(); renderShell();
  } catch (_) { sessionStorage.removeItem(SESSION_KEY); state.session = null; renderLogin('La sesión ha caducado.'); }
}

boot();
window.addEventListener('robin:languagechange', () => {
  if (state.profile) renderShell(); else renderLogin();
});
})();
