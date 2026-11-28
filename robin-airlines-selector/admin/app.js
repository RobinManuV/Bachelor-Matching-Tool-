(() => {
'use strict';

const siteBaseUrl = new URL('../', document.currentScript?.src || location.href);
const adminApiUrl = new URL('.netlify/functions/admin', siteBaseUrl);
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const SESSION_KEY = 'robin_matching_admin_session';
const areaNames = { ciencias: 'Ciencias', tecnologia_y_programacion: 'Tecnología', business: 'Business', ciencias_de_la_salud: 'Salud', ingenierias: 'Ingenierías', ciencias_sociales: 'Ciencias sociales', artes: 'Artes' };

let state = { profile: null, sessions: [], applications: [], studentActivity: [], selected: null, view: 'students', query: '', session: null };
let tourStep = 0;
let tourDemoSelectedId = 'tutorial-demo-1';
const tourCopy = {
  es: [
    ['Comparte el enlace de tu colegio', 'Envíalo a tus alumnos. Cada respuesta completada desde este enlace se asociará a tu colegio.'],
    ['Sigue sus vuelos', 'Estos dos alumnos son ficticios. Elige uno abajo para ver cómo se abre su expediente.'],
    ['Prepara una conversación mejor', 'Compara sus respuestas y diez recomendaciones ficticias. Los alumnos reales verán sus tres opciones principales.'],
  ],
  en: [
    ['Share your school link', 'Send it to your students. Every completed response from this link will be linked to your school.'],
    ['Follow their journeys', 'These two students are fictional. Choose one below to see how their profile opens.'],
    ['Prepare a better conversation', 'Compare their answers and ten fictional recommendations. Real students see their top three options.'],
  ],
  'pt-PT': [
    ['Partilha o link da tua escola', 'Envia-o aos teus alunos. Cada resposta concluída através deste link ficará associada à tua escola.'],
    ['Acompanha os seus percursos', 'Estes dois alunos são fictícios. Escolhe um abaixo para ver como se abre o seu perfil.'],
    ['Prepara uma conversa melhor', 'Compara as respostas e dez recomendações fictícias. Os alunos reais veem as suas três opções principais.'],
  ],
};
const tourActions = {
  es: { label: 'Primer vuelo por el panel', previous: 'Atrás', next: 'Siguiente', done: 'Terminar', skip: 'Saltar tutorial', examples: 'Explora los expedientes' },
  en: { label: 'Your first dashboard tour', previous: 'Back', next: 'Next', done: 'Finish', skip: 'Skip tour', examples: 'Explore the profiles' },
  'pt-PT': { label: 'Primeiro voo pelo painel', previous: 'Voltar', next: 'Seguinte', done: 'Terminar', skip: 'Saltar tutorial', examples: 'Explora os perfis' },
};
const demoProfiles = [
  { id: 'tutorial-demo-1', first_name: 'Lucía', last_name: 'Santos', origin_city: 'Lisboa', origin_country: 'Portugal', selected_area: 'ciencias' },
  { id: 'tutorial-demo-2', first_name: 'Mateo', last_name: 'Costa', origin_city: 'Porto', origin_country: 'Portugal', selected_area: 'artes' },
];
// These programmes and universities are copied from the recommender's careers-data.json catalogue.
// The student answers, rankings and compatibility scores remain fictional tutorial examples.
const demoPrograms = [
  [
    ['wur-biotechnology', 'Biotechnology', 'Wageningen University & Research', 'Wageningen'],
    ['uva-biomedical-sciences', 'Biomedical Sciences', 'University of Amsterdam', 'Amsterdam'],
    ['tud-nanobiology', 'Nanobiology', 'Delft University of Technology', 'Delft'],
    ['lei-life-science-and-technology', 'Life Science and Technology', 'Leiden University', 'Leiden'],
    ['lei-bio-pharmaceutical-sciences', 'Bio-Pharmaceutical Sciences', 'Leiden University', 'Leiden'],
    ['uu-molecular-and-biophysical-life-sciences', 'Molecular and Biophysical Life Sciences', 'Utrecht University', 'Utrecht'],
    ['wur-molecular-life-sciences', 'Molecular Life Sciences', 'Wageningen University & Research', 'Wageningen'],
    ['rad-molecular-life-sciences', 'Molecular Life Sciences', 'Radboud University', 'Nijmegen'],
    ['wur-nutrition-and-health', 'Nutrition and Health', 'Wageningen University & Research', 'Wageningen'],
    ['maa-biomedical-sciences', 'Biomedical Sciences', 'Maastricht University', 'Maastricht'],
  ],
  [
    ['tue-industrial-design', 'Industrial Design', 'Eindhoven University of Technology', 'Eindhoven'],
    ['utw-creative-technology', 'Creative Technology', 'University of Twente', 'Enschede'],
    ['utw-industrial-design-engineering', 'Industrial Design Engineering', 'University of Twente', 'Enschede'],
    ['uva-media-and-information', 'Media and Information', 'University of Amsterdam', 'Amsterdam'],
    ['tue-architecture-urbanism-and-building-sciences', 'Architecture, Urbanism and Building Sciences', 'Eindhoven University of Technology', 'Eindhoven'],
    ['eur-international-bachelor-communication-and-media', 'International Bachelor Communication and Media', 'Erasmus University Rotterdam', 'Rotterdam'],
    ['til-online-culture-art-media-and-society', 'Online Culture: Art, Media and Society', 'Tilburg University', 'Tilburg'],
    ['rug-arts-culture-and-media', 'Arts, Culture and Media', 'University of Groningen', 'Groningen'],
    ['uva-communication-science', 'Communication Science', 'University of Amsterdam', 'Amsterdam'],
    ['vu-lifestyle-informatics', 'Lifestyle Informatics', 'Vrije Universiteit Amsterdam', 'Amsterdam'],
  ],
];
const demoCopy = {
  es: {
    badge: 'EJEMPLO FICTICIO', count: '2 ejemplos ficticios', banner: 'Alumnos, respuestas, orden y porcentajes ficticios. Las carreras y universidades pertenecen al catálogo del recomendador. Solo aparecen durante el tutorial.',
    block: 'Intereses y futuro',
    students: [
      { area: 'Ciencias', system: 'Bachillerato', subjects: ['Biología', 'Matemáticas'],
        answers: [['¿Qué asignaturas disfrutas más?', 'Biología y Matemáticas'], ['¿Cómo te gusta resolver problemas?', 'Experimentando y analizando datos'], ['¿Qué trabajo imaginas en diez años?', 'Investigar tratamientos médicos'], ['¿Hay algo importante que debamos saber?', 'Me gustaría estudiar fuera y trabajar en un laboratorio.']],
      },
      { area: 'Artes', system: 'Bachillerato', subjects: ['Arte', 'Tecnología', 'Matemáticas'],
        answers: [['¿Qué asignaturas disfrutas más?', 'Arte y Tecnología'], ['¿Qué actividades te interesan?', 'Diseñar aplicaciones y objetos'], ['¿Qué trabajo imaginas en diez años?', 'Diseñar productos digitales'], ['¿Hay algo importante que debamos saber?', 'Quiero combinar creatividad y tecnología.']],
      },
    ],
  },
  en: {
    badge: 'FICTIONAL EXAMPLE', count: '2 fictional examples', banner: 'Fictional students, answers, ranking and scores. The programmes and universities are in the recommender catalogue. Shown only during the tour.',
    block: 'Interests and future',
    students: [
      { area: 'Sciences', system: 'Secondary school', subjects: ['Biology', 'Mathematics'],
        answers: [['Which subjects do you enjoy most?', 'Biology and Mathematics'], ['How do you like to solve problems?', 'By experimenting and analysing data'], ['What job do you imagine having in ten years?', 'Researching medical treatments'], ['Is there anything important we should know?', 'I would like to study abroad and work in a laboratory.']],
      },
      { area: 'Arts', system: 'Secondary school', subjects: ['Art', 'Technology', 'Mathematics'],
        answers: [['Which subjects do you enjoy most?', 'Art and Technology'], ['Which activities interest you?', 'Designing apps and objects'], ['What job do you imagine having in ten years?', 'Designing digital products'], ['Is there anything important we should know?', 'I want to combine creativity and technology.']],
      },
    ],
  },
  'pt-PT': {
    badge: 'EXEMPLO FICTÍCIO', count: '2 exemplos fictícios', banner: 'Alunos, respostas, ordem e percentagens fictícios. Os cursos e as universidades fazem parte do catálogo do recomendador. Aparecem apenas durante o tutorial.',
    block: 'Interesses e futuro',
    students: [
      { area: 'Ciências', system: 'Ensino secundário', subjects: ['Biologia', 'Matemática'],
        answers: [['De que disciplinas gostas mais?', 'Biologia e Matemática'], ['Como gostas de resolver problemas?', 'A experimentar e analisar dados'], ['Que trabalho imaginas ter daqui a dez anos?', 'Investigar tratamentos médicos'], ['Há algo importante que devamos saber?', 'Gostaria de estudar no estrangeiro e trabalhar num laboratório.']],
      },
      { area: 'Artes', system: 'Ensino secundário', subjects: ['Arte', 'Tecnologia', 'Matemática'],
        answers: [['De que disciplinas gostas mais?', 'Arte e Tecnologia'], ['Que atividades te interessam?', 'Desenhar aplicações e objetos'], ['Que trabalho imaginas ter daqui a dez anos?', 'Desenhar produtos digitais'], ['Há algo importante que devamos saber?', 'Quero combinar criatividade e tecnologia.']],
      },
    ],
  },
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const tr = (value) => window.RobinI18n?.t(value) || value;
const initials = (first, last = '') => `${String(first || '').charAt(0)}${String(last || '').charAt(0)}`.toUpperCase();
const formatDate = (value) => new Intl.DateTimeFormat(window.RobinI18n?.getLocale() || 'es', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const schoolOf = (profile) => Array.isArray(profile?.schools) ? profile.schools[0] : profile?.schools;
const tourActive = () => state.profile?.role === 'school' && !state.profile.onboarding_completed_at;

function demoSessions() {
  const copy = demoCopy[window.RobinI18n?.getLocale()] || demoCopy.es;
  const school = schoolOf(state.profile)?.name || '';
  return demoProfiles.map((profile, index) => {
    const student = copy.students[index];
    return {
      ...profile, is_demo: true, area_label: student.area, school,
      email: `${profile.first_name.toLowerCase()}.tutorial@example.invalid`, phone: '', created_at: new Date().toISOString(),
      academic_system: student.system, academic_subjects: student.subjects.map((name) => ({ name })),
      questionnaire: { blocks: [{ title: copy.block, items: student.answers.map(([q, a]) => ({ q, a })) }] },
      recommendations: demoPrograms[index].map(([program_code, career_name, university, city], rank) => ({
        program_code, career_name, university, city, compatibility: 94 - rank * 3 - index * 2,
      })),
    };
  });
}

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
      state.profile = data.profile; tourStep = 0; tourDemoSelectedId = 'tutorial-demo-1'; state.view = 'students'; sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
      await loadProductionData(); renderShell();
    } catch (loginError) { renderLogin(loginError.message); }
  });
}

async function loadProductionData() {
  const sessions = await api('sessions'); state.sessions = sessions.sessions || [];
  const linkedSession = new URLSearchParams(window.location.search).get('session');
  state.selected = state.sessions.find((entry) => entry.id === linkedSession)?.id || state.sessions[0]?.id || null;
  if (state.profile.role === 'robin') { const applications = await api('applications'); state.applications = applications.applications || []; }
}

function renderShell() {
  const robin = state.profile.role === 'robin'; const school = schoolOf(state.profile);
  app.innerHTML = `<div class="shell">
    <aside class="sidebar"><div class="sidebar-brand"><img src="../assets/img/logo-robin.png" alt="Project Robin"><span>Matching de carreras</span></div>
      <div class="identity"><span class="avatar">${esc(initials(state.profile.full_name))}</span><div><strong>${esc(state.profile.full_name)}</strong><small>${robin ? 'Administración Robin' : esc(school?.name || 'Colegio')}</small></div></div>
      <nav class="nav" aria-label="Panel"><button data-view="students">Alumnos</button>${robin ? `<button data-view="student-activity">Actividad de la app</button><button data-view="applications">Solicitudes <span class="count">${state.applications.filter((x) => x.status === 'pending').length}</span></button>` : ''}</nav>
      <div class="sidebar-foot"><img src="assets/robin-student.svg" alt=""><strong>Tu espacio Robin</strong><span>Matching de carreras</span><button data-logout type="button">Cerrar sesión</button></div>
    </aside>
    <header class="topbar"><span class="topbar-title">Panel de matching</span>
      <div class="topbar-user"><div data-language-switcher></div><span>${esc(state.profile.email)}</span><span class="role-chip">${robin ? 'Robin' : 'Colegio'}</span><button class="logout-mobile" data-logout type="button">Salir</button></div>
    </header><main class="main" id="main"></main></div>`;
  document.querySelector('.nav').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (!button) return; state.view = button.dataset.view; renderView(); });
  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY); state.session = null; state.profile = null; state.view = 'students'; tourStep = 0; tourDemoSelectedId = 'tutorial-demo-1';
    document.querySelector('.tour-backdrop')?.remove(); document.querySelector('.tour-panel')?.remove();
    renderLogin();
  }));
  renderView();
  if (!robin && !state.profile.onboarding_completed_at) requestAnimationFrame(renderTour);
}

function renderView() {
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
  if (state.view === 'applications' && state.profile.role === 'robin') renderApplications();
  else if (state.view === 'student-activity' && state.profile.role === 'robin') loadStudentActivity();
  else renderStudents();
}

async function loadStudentActivity() {
  const main = document.querySelector('#main');
  main.innerHTML = '<div class="empty">Cargando actividad de RobinRecomendator…</div>';
  try {
    const result = await api('student-activity');
    state.studentActivity = result.students || [];
    renderStudentActivity();
  } catch (error) {
    main.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }
}

function renderStudentActivity() {
  const main = document.querySelector('#main');
  const students = state.studentActivity;
  const sessions = students.reduce((count, student) => count + student.session_count, 0);
  const feedback = students.reduce((count, student) => count + student.feedback_count, 0);
  main.innerHTML = `<header class="page-head"><div><p>RobinRecomendator · solo administradores Robin</p><h1>Actividad de la app</h1></div><div class="page-tools"><button class="btn" id="refresh-activity" type="button">Actualizar</button></div></header>
    <div class="content"><section class="applications"><div class="manifest-head"><span>${students.length} cuentas · ${sessions} recomendaciones · ${feedback} valoraciones</span><span>Actualizado ${esc(formatDate(new Date().toISOString()))}</span></div>
    ${students.length ? students.map((student) => `<details class="activity-user"><summary><strong>${esc(student.name || student.email || student.user_id)}</strong><span>${esc(student.email)}</span><span>${student.session_count} recomendaciones</span><span>${student.feedback_count} opiniones · ${student.community_contribution_count} aportes</span><time>${esc(formatDate(student.last_activity_at))}</time></summary>
      <div class="activity-details"><p>Cuenta: ${esc(student.user_id)} · Creada ${esc(formatDate(student.account_created_at))} · País ${esc(student.country_code || '—')} · Consentimiento ${esc(student.consent_status)}</p>
      ${student.guardian ? `<p>Tutor: ${esc(student.guardian.email)} · ${student.guardian.confirmed_at ? `Confirmado ${esc(formatDate(student.guardian.confirmed_at))}` : `Pendiente; caduca ${esc(formatDate(student.guardian.expires_at))}`}</p>` : ''}
      ${student.sessions.length ? student.sessions.map((session, index) => `<details class="activity-session"><summary>Recomendación ${student.sessions.length - index} · ${esc(formatDate(session.created_at))} · ${esc((session.selected_areas || []).join(', '))} · ${(session.recommendations || []).length} carreras · ${session.feedback.length} opiniones</summary>
        <div class="activity-session-body"><p>Sistema académico: ${esc(session.academic_system || '—')} · Fuente: ${esc(session.recommendation_source || '—')} · Modelo: ${esc(session.recommendation_model || '—')}</p>
        <h4>Asignaturas</h4><p>${(session.academic_subjects || []).map((item) => esc(item.name || item)).join(', ') || '—'}</p>
        ${(session.questionnaire?.blocks || []).map((block) => `<h4>${esc(block.title)}</h4><dl>${(block.items || []).map((item) => `<div class="qa"><dt>${esc(item.q)}</dt><dd>${valueHtml(item.a)}</dd></div>`).join('')}</dl>`).join('')}
        <h4>Carreras recomendadas</h4><ol>${(session.recommendations || []).map((item) => `<li>${esc(item.career_name)} · ${esc(item.university)} · ${esc(item.compatibility)}%</li>`).join('')}</ol>
        <h4>Opiniones del usuario</h4>${session.feedback.length ? session.feedback.map((item) => `<p>${esc(item.program_code)} · ${item.decision === 'approved' ? 'Sí' : 'No'} · ${esc(item.comment || 'Sin comentario')} · ${esc(formatDate(item.updated_at || item.created_at))}</p>`).join('') : '<p>Sin opiniones todavía.</p>'}</div></details>`).join('') : '<p>Aún no ha generado recomendaciones.</p>'}
      ${student.community_contributions.length ? `<h4>Aportes al aprendizaje común (${student.community_contribution_count})</h4>${student.community_contributions.map((item) => `<p>${esc(item.area)} · ${esc(item.program_code)} · ${item.decision === 'approved' ? 'Sí' : 'No'} · Favorables: ${esc((item.positive_terms || []).join(', ') || '—')} · A mejorar: ${esc((item.negative_terms || []).join(', ') || '—')} · ${esc(formatDate(item.updated_at))}</p>`).join('')}` : ''}</div></details>`).join('') : '<div class="empty">Todavía no hay cuentas de la app.</div>'}</section></div>`;
  document.querySelector('#refresh-activity').addEventListener('click', loadStudentActivity);
}

function filteredSessions() {
  const query = state.query.toLowerCase();
  return state.sessions.filter((session) => !query || `${session.first_name} ${session.last_name} ${session.email} ${session.school}`.toLowerCase().includes(query));
}

function renderStudents() {
  const main = document.querySelector('#main'); const school = schoolOf(state.profile);
  const realSessions = filteredSessions(); const demos = tourActive() ? demoSessions() : [];
  const sessions = [...demos, ...realSessions];
  if (realSessions.length && !realSessions.some((entry) => entry.id === state.selected)) state.selected = realSessions[0].id;
  const selectedId = demos.length ? tourDemoSelectedId : state.selected;
  const selected = sessions.find((entry) => entry.id === selectedId);
  const demoLabels = demoCopy[window.RobinI18n?.getLocale()] || demoCopy.es;
  const matchingUrl = school?.access_code ? new URL(`?school=${encodeURIComponent(school.access_code)}`, siteBaseUrl).href : '';
  main.innerHTML = `<header class="page-head"><div><p>${state.profile.role === 'robin' ? 'Todos los vuelos' : esc(school?.name || 'Tu colegio')}</p><h1>Manifiesto de alumnos</h1></div><div class="page-tools"><label><span class="sr">Buscar alumno</span><input class="search" id="search" type="search" placeholder="Buscar nombre, correo o colegio" value="${esc(state.query)}"></label></div></header>
    <div class="content">${matchingUrl ? `<section class="share"><h3>Enlace para tus alumnos</h3><p>Las solicitudes completadas desde este enlace quedan asociadas únicamente a tu colegio.</p><div class="share-row"><input id="school-link" readonly value="${esc(matchingUrl)}"><button class="btn" id="copy-link" type="button">Copiar enlace</button></div></section>` : ''}
    <section class="manifest"><div class="passengers"><div class="manifest-head"><span>${realSessions.length} ${realSessions.length === 1 ? 'alumno' : 'alumnos'}</span><span>${demos.length ? esc(demoLabels.count) : 'Últimos primero'}</span></div>
      <div id="passenger-list">${sessions.length ? sessions.map((session) => `<button class="passenger ${session.is_demo ? 'demo' : ''} ${session.id === selectedId ? 'active' : ''}" data-session="${esc(session.id)}" ${session.is_demo ? 'aria-disabled="true" tabindex="-1"' : ''}><span class="avatar">${esc(initials(session.first_name, session.last_name))}</span><span><strong>${esc(session.first_name)} ${esc(session.last_name)}</strong><small>${session.is_demo ? esc(demoLabels.badge) : esc(session.school)}</small></span><time>${session.is_demo ? '' : esc(formatDate(session.created_at))}</time></button>`).join('') : '<div class="empty">Todavía no hay alumnos asociados.</div>'}</div></div>
      <article class="dossier" id="dossier">${selected ? dossierHtml(selected) : '<div class="empty">Selecciona un alumno para abrir su expediente.</div>'}</article></section></div>`;
  document.querySelector('#search').addEventListener('input', (event) => { state.query = event.target.value; renderStudents(); const search = document.querySelector('#search'); search.focus(); search.setSelectionRange(search.value.length, search.value.length); });
  document.querySelector('#passenger-list').addEventListener('click', (event) => { const button = event.target.closest('[data-session]'); if (!button || button.classList.contains('demo')) return; state.selected = button.dataset.session; window.history.replaceState(null, '', `?session=${encodeURIComponent(state.selected)}`); renderStudents(); });
  document.querySelector('#copy-link')?.addEventListener('click', async () => { await navigator.clipboard.writeText(matchingUrl); showToast('Enlace copiado.'); });
}

function renderTour() {
  if (!tourActive()) return;
  document.querySelector('.tour-backdrop')?.remove();
  document.querySelector('.tour-panel')?.remove();
  document.querySelectorAll('.tour-focus').forEach((element) => element.classList.remove('tour-focus'));
  const locale = window.RobinI18n?.getLocale() || 'es';
  const copy = tourCopy[locale] || tourCopy.es;
  const actions = tourActions[locale] || tourActions.es;
  const targets = [
    document.querySelector('.share'),
    document.querySelector('.passenger.active') || document.querySelector('.passengers .manifest-head'),
    document.querySelector('.recommendations'),
  ];
  const target = targets[tourStep] || document.querySelector('.dossier');
  target?.classList.add('tour-focus');
  target?.scrollIntoView({ block: tourStep === 2 ? 'start' : 'center', behavior: 'smooth' });
  const backdrop = document.createElement('div');
  backdrop.className = 'tour-backdrop';
  const panel = document.createElement('section');
  panel.className = 'tour-panel';
  panel.dataset.step = String(tourStep);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'tour-title');
  panel.innerHTML = `<div class="tour-route"><span>ROBIN AIRLINES</span><span>${tourStep + 1} / 3</span></div>
    <h2 id="tour-title">${esc(copy[tourStep][0])}</h2><p>${esc(copy[tourStep][1])}</p>
    ${tourStep ? `<div class="tour-examples" role="group" aria-label="${esc(actions.examples)}"><span>${esc(actions.examples)}</span><div>${demoProfiles.map((student) => `<button type="button" data-tour-demo="${student.id}" aria-pressed="${student.id === tourDemoSelectedId}">${esc(student.first_name)}</button>`).join('')}</div></div>` : ''}
    <div class="tour-progress" aria-label="${esc(actions.label)}">${copy.map((_, index) => `<span class="${index <= tourStep ? 'done' : ''}"></span>`).join('')}</div>
    <div class="tour-buttons"><button type="button" class="tour-skip">${esc(actions.skip)}</button>
      ${tourStep ? `<button type="button" class="tour-back">${esc(actions.previous)}</button>` : ''}
      <button type="button" class="btn tour-next">${esc(tourStep === 2 ? actions.done : actions.next)}</button></div>`;
  document.body.append(backdrop, panel);
  panel.querySelector('.tour-skip').addEventListener('click', finishTour);
  panel.querySelector('.tour-back')?.addEventListener('click', () => { tourStep--; renderTour(); });
  panel.querySelector('.tour-next').addEventListener('click', () => {
    if (tourStep === 2) finishTour(); else { tourStep++; renderTour(); }
  });
  panel.querySelectorAll('[data-tour-demo]').forEach((button) => button.addEventListener('click', () => {
    tourDemoSelectedId = button.dataset.tourDemo;
    renderStudents(); renderTour();
    [...document.querySelectorAll('[data-tour-demo]')].find((item) => item.dataset.tourDemo === tourDemoSelectedId)?.focus();
  }));
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); finishTour(); return; }
    if (event.key !== 'Tab') return;
    const buttons = [...panel.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0]; const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  panel.querySelector('.tour-next').focus();
}

async function finishTour() {
  const panel = document.querySelector('.tour-panel');
  panel?.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try {
    const result = await api('onboarding/complete', { method: 'POST' });
    state.profile.onboarding_completed_at = result.onboarding_completed_at;
    document.querySelector('.tour-backdrop')?.remove();
    panel?.remove();
    document.querySelectorAll('.tour-focus').forEach((element) => element.classList.remove('tour-focus'));
    renderStudents();
    const focusTarget = tourStep === 2 ? document.querySelector('.recommendations, #dossier') : document.querySelector('#school-link');
    if (focusTarget) {
      if (tourStep === 2) focusTarget.tabIndex = -1;
      focusTarget.focus({ preventScroll: true });
    }
  } catch (error) {
    showToast(error.message);
    panel?.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
}

function valueHtml(value) {
  if (Array.isArray(value)) return value.map((item) => esc(tr(item))).join(', ');
  return esc(tr(value));
}

function dossierHtml(session) {
  const blocks = session.questionnaire?.blocks || []; const recommendations = session.recommendations || [];
  const feedback = new Map((session.recommendation_feedback || []).map((item) => [item.program_code, item.decision]));
  const demoLabels = demoCopy[window.RobinI18n?.getLocale()] || demoCopy.es;
  return `${session.is_demo ? `<div class="demo-banner">${esc(demoLabels.banner)}</div>` : ''}<div class="dossier-top"><div><h2>${esc(session.first_name)} ${esc(session.last_name)}</h2><p>${esc(session.email)}${session.phone ? ` · ${esc(session.phone)}` : ''}</p></div><span class="score-stamp">${esc(session.area_label || areaNames[session.selected_area] || session.selected_area)}</span></div>
    <div class="facts"><div class="fact"><span>Origen</span><strong>${esc(session.origin_city)}, ${esc(tr(session.origin_country))}</strong></div><div class="fact"><span>Colegio</span><strong>${esc(session.school)}</strong></div><div class="fact"><span>Sistema</span><strong>${esc(tr(session.academic_system))}</strong></div><div class="fact"><span>Fecha</span><strong>${esc(formatDate(session.created_at))}</strong></div></div>
    <div class="dossier-body"><section class="answers"><div class="section-title"><h3>Respuestas</h3><span>${blocks.reduce((count, block) => count + (block.items?.length || 0), 0)} registradas</span></div>
      ${blocks.map((block) => `<div class="answer-block"><h4>${esc(block.title)}</h4><dl>${(block.items || []).map((item) => `<div class="qa"><dt>${esc(item.q)}</dt><dd>${valueHtml(item.a)}</dd></div>`).join('')}</dl></div>`).join('')}
      <div class="answer-block"><h4>Asignaturas</h4><dl><div class="qa"><dd>${(session.academic_subjects || []).map((subject) => esc(tr(subject.name))).join(', ') || 'Sin asignaturas registradas'}</dd></div></dl></div></section>
    <section class="recommendations"><div class="section-title"><h3>Recomendaciones</h3><span>${recommendations.length} destinos</span></div><div class="rec-list">
      ${recommendations.map((item, index) => recHtml(item, index + 1, feedback.get(item.program_code))).join('')}
    </div></section></div>`;
}

function recHtml(item, rank, decision) {
  const answer = decision ? `<small class="student-feedback ${esc(decision)}">${tr('El alumno indicó:')} ${tr(decision === 'approved' ? 'Sí' : 'No')}</small>` : '';
  return `<div class="rec"><span class="rec-rank">${rank}</span><span><strong>${esc(item.career_name)}</strong><small>${esc(item.university)} · ${esc(item.city)}</small>${answer}</span><span class="compat">${esc(item.compatibility)}%</span></div>`;
}

function renderApplications() {
  const main = document.querySelector('#main'); const pending = state.applications.filter((entry) => entry.status === 'pending').length;
  main.innerHTML = `<header class="page-head"><div><p>Acceso de colegios</p><h1>Solicitudes</h1></div></header><div class="content"><section class="applications"><div class="manifest-head"><span>${pending} pendientes</span><span>${state.applications.length} solicitudes</span></div>
    <table><thead><tr><th>Colegio</th><th>Contacto</th><th>Solicitud</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${state.applications.map((item) => `<tr><td><strong>${esc(item.school_name)}</strong></td><td><strong>${esc(item.contact_name)}</strong><small>${esc(item.job_title)} · ${esc(item.corporate_email)}</small></td><td><span class="status ${esc(item.status)}">${item.status === 'pending' ? 'Pendiente' : item.status === 'approved' ? 'Aprobada' : 'Denegada'}</span></td><td>${item.status === 'pending' ? `<div class="actions"><label class="approval-language"><span>Idioma del correo</span><select aria-label="Idioma del correo para ${esc(item.school_name)}"><option value="es">Español</option><option value="en">English</option><option value="pt-PT">Português (Portugal)</option></select></label><button class="btn" data-decision="approve" data-id="${esc(item.id)}">Aprobar</button><button class="btn danger" data-decision="deny" data-id="${esc(item.id)}">Denegar</button></div>` : '—'}</td></tr>`).join('')}</tbody></table></section></div>`;
  main.querySelector('.applications').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-decision]'); if (!button) return;
    const action = button.dataset.decision;
    const language = button.closest('tr').querySelector('.approval-language select')?.value || 'es';
    const languageName = { es: 'español', en: 'inglés', 'pt-PT': 'portugués de Portugal' }[language];
    if (!confirm(action === 'approve' ? `¿Aprobar este colegio y enviar sus credenciales en ${languageName}?` : '¿Denegar esta solicitud?')) return;
    button.disabled = true;
    try {
      await api('applications/decision', { method: 'POST', body: { id: button.dataset.id, action, language } });
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
