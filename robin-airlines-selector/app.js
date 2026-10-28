(() => {
'use strict';

/* ================= Recursos ================= */
const CITY_IMG = {
  amsterdam:'assets/img/ciudades/amsterdam.webp', rotterdam:'assets/img/ciudades/rotterdam.webp', delft:'assets/img/ciudades/delft.webp',
  maastricht:'assets/img/ciudades/maastricht.webp', groningen:'assets/img/ciudades/groningen.webp', eindhoven:'assets/img/ciudades/eindhoven.webp',
  enschede:'assets/img/ciudades/twente.webp', utrecht:'assets/img/ciudades/utrecht.webp', 'the hague':'assets/img/ciudades/la-haya.webp',
  default:'assets/img/avioneta-perfil.webp'
};
const ICON = {
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

/* ================= Formulario completo (portal) =================
   Inicio: datos en el billete + área de interés (una sola) en la pantalla de ruta.
   Escalas: Información general → bloque del área elegida → Perfil vocacional → Asignaturas.
   Sin repetir: el colegio va en el billete y el sistema se pregunta una vez (Información general). */
const AREAS = [
  { key: 'ciencias', code: 'CIE', name: 'Ciencias', ex: 'Física, química, biología, datos' },
  { key: 'tecnologia_y_programacion', code: 'TEC', name: 'Tecnología y programación', ex: 'Programación, IA, ciberseguridad' },
  { key: 'business', code: 'BUS', name: 'Business', ex: 'Marketing, finanzas, emprender' },
  { key: 'ciencias_de_la_salud', code: 'SAL', name: 'Ciencias de la salud', ex: 'Medicina, psicología, biomedicina' },
  { key: 'ingenierias', code: 'ING', name: 'Ingenierías', ex: 'Aeroespacial, mecánica, robótica' },
  { key: 'ciencias_sociales', code: 'SOC', name: 'Ciencias sociales', ex: 'Política, derecho, comunicación' },
  { key: 'artes', code: 'ART', name: 'Artes', ex: 'Diseño, arquitectura, audiovisual' },
];
const areaBy = (k) => AREAS.find((a) => a.key === k) || null;

const Q_SUBJECTS = [
  { label: 'Matemáticas', value: 'matematicas' }, { label: 'Física', value: 'fisica' }, { label: 'Química', value: 'quimica' },
  { label: 'Biología', value: 'biologia' }, { label: 'Informática / Programación', value: 'informatica' }, { label: 'Economía', value: 'economia' },
  { label: 'Lengua y Literatura', value: 'lengua' }, { label: 'Historia', value: 'historia' }, { label: 'Geografía', value: 'geografia' },
  { label: 'Filosofía', value: 'filosofia' }, { label: 'Idiomas', value: 'idiomas' }, { label: 'Arte y Dibujo', value: 'arte' },
  { label: 'Música', value: 'musica' }, { label: 'Tecnología', value: 'tecnologia' }, { label: 'Educación Física', value: 'efisica' },
];
const Q_TRAITS = [
  { label: 'Analítico/a', value: 'analitico' }, { label: 'Creativo/a', value: 'creativo' }, { label: 'Líder', value: 'lider' },
  { label: 'Introvertido/a', value: 'introvertido' }, { label: 'Extrovertido/a', value: 'extrovertido' }, { label: 'Organizado/a', value: 'organizado' },
  { label: 'Independiente', value: 'independiente' }, { label: 'Competitivo/a', value: 'competitivo' }, { label: 'Empático/a', value: 'empatico' },
  { label: 'Curioso/a', value: 'curioso' },
];
const Q_VALORA = [
  { label: 'Salidas profesionales', value: 'salidas' }, { label: 'Pasión por la materia', value: 'pasion' }, { label: 'Prestigio académico', value: 'prestigio' },
  { label: 'Ambiente internacional', value: 'internacional' }, { label: 'Innovación', value: 'innovacion' }, { label: 'Impacto social', value: 'impacto_social' },
  { label: 'Emprender / crear algo propio', value: 'emprender' }, { label: 'Equilibrio vida-estudios', value: 'equilibrio' },
];

/* pose = la vista de la avioneta en esa pregunta (criterio en PLACE, más abajo) */
const GENERAL = { key: 'general', code: 'GEN', name: 'Información general',
  line: (n, nombre) => `${nombre ? nombre + ', primera' : 'Primera'} escala: lo básico sobre ti. Son ${n} preguntas y muchas se contestan con un toque.`,
  questions: [
    { id: 'g_ciudad', pose: 'bank', type: 'text', q: 'Ciudad y país donde resides actualmente', ph: 'Madrid, España' },
    { id: 'g_sistema', pose: 'side', type: 'single', q: '¿Qué sistema educativo estás cursando?', options: ['Bachillerato español', 'Bachillerato Internacional (IB)', 'A-Levels (británico)', 'Sistema americano', 'Bac francés', 'Otro'] },
    { id: 'modalidad', pose: 'three', type: 'single', q: '¿Qué modalidad de bachillerato cursas?', options: ['Ciencias – tecnológico', 'Ciencias – biosanitario', 'Humanidades y Ciencias Sociales', 'Artes', 'General'], when: (a) => a.g_sistema === 'Bachillerato español' },
    { id: 'g_nota', pose: 'away', type: 'slider', q: '¿Cuál es tu nota media del año pasado?', min: 0, max: 10, step: 0.5, def: 7, left: '0', right: '10', hint: 'Desliza para responder. Si tu sistema usa otra escala, pásala a nota sobre 10.' },
    { id: 'g_fav', pose: 'side', type: 'multi', q: '¿Qué asignaturas te gustan MÁS?', options: Q_SUBJECTS },
    { id: 'g_menos', pose: 'away', type: 'multi', q: '¿Qué asignaturas disfrutas MENOS?', options: Q_SUBJECTS },
    { id: 'g_estilo', pose: 'three', type: 'slider', q: '¿Cómo prefieres aprender?', min: 0, max: 10, step: 1, def: 5, left: 'Práctica', right: 'Teoría' },
    { id: 'g_valora', pose: 'side', type: 'multi', q: '¿Qué valoras MÁS en una carrera universitaria?', options: Q_VALORA, max: 3 },
    { id: 'g_ingles', pose: 'three', type: 'single', q: '¿Qué nivel de inglés tienes?', options: ['A2 o inferior', 'B1', 'B2', 'C1', 'C2 / Nativo'] },
    { id: 'g_fuera', pose: 'away', type: 'single', q: '¿Has vivido o estudiado fuera de tu país?', options: ['Sí', 'No'] },
    { id: 'g_rasgos', pose: 'front', type: 'multi', q: '¿Cómo te describirías? Elige los rasgos que más te representan', options: Q_TRAITS },
    { id: 'g_descripcion', pose: 'three', type: 'textarea', q: 'Cuéntanos algo más sobre cómo eres', optional: true },
    { id: 'g_ciudad_tipo', pose: 'bank', type: 'single', q: '¿Qué tipo de ciudad te gustaría para estudiar?', options: ['Grande', 'Mediana', 'Pequeña', 'Indiferente'] },
    { id: 'g_social', pose: 'side', type: 'single', q: '¿Qué importancia tiene para ti la vida social universitaria?', options: ['Mucha', 'Media', 'Baja'] },
    { id: 'g_independencia', pose: 'front', type: 'slider', q: '¿Qué tan independiente te consideras?', min: 0, max: 10, step: 1, def: 5, left: 'Poco', right: 'Mucho' },
    { id: 'g_futuro', pose: 'three', type: 'textarea', q: '¿Qué idea tienes ahora mismo sobre tu futuro?' },
    { id: 'g_presupuesto', pose: 'bank', type: 'slider', q: '¿Qué presupuesto contempláis al mes para estudiar fuera?', min: 0, max: 2000, step: 50, def: 800, left: '0 €', right: '2000 €', suffix: ' €' },
    { id: 'g_algo', pose: 'front', type: 'textarea', q: '¿Hay algo importante que deberíamos saber sobre ti?', optional: true },
  ] };

const AREA_BLOCKS = {
  ciencias: { key: 'ciencias', code: 'CIE', name: 'Ciencias',
    line: (n) => `Escala en Ciencias. ${n} preguntas para ver qué parte te tira más.`,
    questions: [
      { id: 'c_parte', pose: 'side', type: 'multi', q: '¿Qué parte de las ciencias te atrae más?', options: ['Física', 'Química', 'Biología', 'Matemáticas', 'Ciencias ambientales', 'Astronomía y espacio', 'Ciencia de datos', 'Geociencias'] },
      { id: 'c_lab', pose: 'three', type: 'single', q: '¿Te ves trabajando en laboratorio?', options: ['Sí, mucho', 'A veces', 'No realmente'] },
      { id: 'c_enfoque', pose: 'side', type: 'single', q: '¿Qué te interesa más?', options: ['Investigación', 'Análisis de datos', 'Descubrimiento científico'] },
      { id: 'c_estadistica', pose: 'front', type: 'slider', q: '¿Cómo de cómodo/a te sientes con la estadística y el rigor científico?', min: 0, max: 10, step: 1, def: 5, left: 'Poco', right: 'Mucho' },
    ] },
  tecnologia_y_programacion: { key: 'tecnologia_y_programacion', code: 'TEC', name: 'Tecnología y programación',
    line: (n) => `Escala en Tecnología y programación. ${n} preguntas sobre lo que te gusta construir.`,
    questions: [
      { id: 't_rama', pose: 'side', type: 'multi', q: '¿Qué te interesa más?', options: ['Programación / desarrollo', 'Inteligencia artificial', 'Datos / Data Science', 'Ciberseguridad', 'Sistemas y redes', 'Diseño de producto digital'] },
      { id: 't_motiva', pose: 'three', type: 'single', q: '¿Qué te motiva más?', options: ['Crear productos', 'Resolver problemas', 'Ambas por igual'] },
      { id: 't_logica', pose: 'front', type: 'slider', q: '¿Te gusta la lógica matemática?', min: 0, max: 10, step: 1, def: 5, left: 'Poco', right: 'Mucho' },
      { id: 't_practica', pose: 'three', type: 'slider', q: '¿Prefieres una carrera práctica y basada en proyectos?', min: 0, max: 10, step: 1, def: 5, left: 'Más teórica', right: 'Muy práctica' },
    ] },
  business: { key: 'business', code: 'BUS', name: 'Business',
    line: (n) => `Escala en Business. ${n} preguntas sobre cómo te ves trabajando.`,
    questions: [
      { id: 'b_rama', pose: 'side', type: 'multi', q: '¿Qué te atrae más?', options: ['Marketing', 'Finanzas', 'Emprendimiento', 'Estrategia', 'Recursos humanos', 'Consultoría'] },
      { id: 'b_lider', pose: 'three', type: 'single', q: '¿Te ves liderando equipos o creando empresas?', options: ['Liderar equipos', 'Crear mi propia empresa', 'Aún no lo sé'] },
      { id: 'b_negocios', pose: 'bank', type: 'textarea', q: '¿Qué tipo de negocios o sectores te interesan más?', optional: true },
      { id: 'b_perfil', pose: 'front', type: 'slider', q: '¿Te consideras más persuasivo/a o más analítico/a?', min: 0, max: 10, step: 1, def: 5, left: 'Persuasivo/a', right: 'Analítico/a' },
      { id: 'b_salario', pose: 'three', type: 'slider', q: '¿Qué importancia tiene para ti el salario futuro?', min: 0, max: 10, step: 1, def: 5, left: 'Poca', right: 'Mucha' },
    ] },
  ciencias_de_la_salud: { key: 'ciencias_de_la_salud', code: 'SAL', name: 'Ciencias de la salud',
    line: (n) => `Escala en Ciencias de la salud. ${n} preguntas sobre el trabajo que te imaginas.`,
    questions: [
      { id: 's_motiva', pose: 'three', type: 'slider', q: '¿Qué te motiva más?', min: 0, max: 10, step: 1, def: 5, left: 'Trato con personas', right: 'La parte científica' },
      { id: 's_hospital', pose: 'side', type: 'single', q: '¿Te ves trabajando en hospitales o clínicas?', options: ['Sí', 'Prefiero investigación o laboratorio', 'No estoy seguro/a'] },
      { id: 's_medicina', pose: 'three', type: 'single', q: '¿Te interesa una carrera larga y exigente como Medicina?', options: ['Sí', 'Tal vez', 'No'] },
      { id: 's_presion', pose: 'front', type: 'single', q: '¿Cómo reaccionas ante situaciones de presión?', options: ['Muy bien', 'Bien', 'Regular', 'Me cuesta'] },
      { id: 's_area', pose: 'side', type: 'multi', q: '¿Qué área de la salud te llama más la atención?', options: ['Medicina', 'Enfermería', 'Psicología', 'Farmacia', 'Nutrición', 'Fisioterapia', 'Biomedicina', 'Salud pública', 'Odontología'] },
    ] },
  ingenierias: { key: 'ingenierias', code: 'ING', name: 'Ingenierías',
    line: (n) => `Escala en Ingenierías. ${n} preguntas sobre lo que te gusta resolver.`,
    questions: [
      { id: 'i_problemas', pose: 'three', type: 'textarea', q: '¿Qué tipo de problemas disfrutas resolver?', optional: true },
      { id: 'i_rama', pose: 'side', type: 'multi', q: '¿Cuáles de estas ingenierías se acercan más a los temas que te interesan?', options: ['Mecánica', 'Civil', 'Eléctrica', 'Aeroespacial', 'Industrial', 'Química', 'Biomédica', 'Software', 'Ambiental', 'Robótica'] },
      { id: 'i_construir', pose: 'three', type: 'single', q: '¿Qué disfrutas más?', options: ['Construir', 'Diseñar', 'Optimizar sistemas'] },
      { id: 'i_matefis', pose: 'front', type: 'slider', q: '¿Te atraen las matemáticas y la física?', min: 0, max: 10, step: 1, def: 5, left: 'Poco', right: 'Mucho' },
      { id: 'i_tecnico', pose: 'side', type: 'slider', q: '¿Prefieres trabajo técnico o liderazgo de proyectos?', min: 0, max: 10, step: 1, def: 5, left: 'Técnico', right: 'Liderazgo' },
    ] },
  ciencias_sociales: { key: 'ciencias_sociales', code: 'SOC', name: 'Ciencias sociales',
    line: (n) => `Escala en Ciencias sociales. ${n} preguntas sobre los temas que te mueven.`,
    questions: [
      { id: 'so_rama', pose: 'side', type: 'multi', q: '¿Qué te interesa más?', options: ['Psicología', 'Política', 'Comunicación', 'Sociología', 'Relaciones internacionales', 'Derecho', 'Antropología', 'Educación'] },
      { id: 'so_debate', pose: 'front', type: 'slider', q: '¿Te gusta debatir y analizar temas sociales?', min: 0, max: 10, step: 1, def: 5, left: 'Poco', right: 'Mucho' },
      { id: 'so_personas', pose: 'three', type: 'single', q: '¿Te ves trabajando con personas constantemente?', options: ['Sí', 'A veces', 'Prefiero trabajo más analítico'] },
      { id: 'so_problemas', pose: 'bank', type: 'textarea', q: '¿Qué problemas sociales te gustaría ayudar a resolver?', optional: true },
      { id: 'so_internacional', pose: 'side', type: 'single', q: '¿Te interesa el mundo internacional y político?', options: ['Sí, mucho', 'Algo', 'No especialmente'] },
      { id: 'so_enfoque', pose: 'three', type: 'single', q: '¿Qué prefieres?', options: ['Investigación', 'Comunicación', 'Intervención social'] },
    ] },
  artes: { key: 'artes', code: 'ART', name: 'Artes',
    line: (n) => `Escala en Artes. ${n} preguntas sobre tu forma de crear.`,
    questions: [
      { id: 'a_creatividad', pose: 'three', type: 'single', q: '¿Qué tipo de creatividad te representa más?', options: ['Visual', 'Digital', 'Audiovisual', 'Conceptual', 'Escrita', 'Espacial / arquitectónica'] },
      { id: 'a_portfolio', pose: 'away', type: 'single', q: '¿Tienes portfolio o proyectos artísticos?', options: ['Sí', 'En proceso', 'Todavía no'] },
      { id: 'a_disciplina', pose: 'side', type: 'multi', q: '¿Qué disciplinas creativas te interesan más?', options: ['Diseño gráfico', 'Arquitectura', 'Bellas artes', 'Cine y audiovisual', 'Diseño de producto', 'Animación', 'Fotografía', 'Diseño UX/UI', 'Moda'] },
      { id: 'a_medio', pose: 'three', type: 'single', q: '¿Prefieres diseño digital, físico o audiovisual?', options: ['Digital', 'Físico', 'Audiovisual', 'Mixto'] },
      { id: 'a_trabajo', pose: 'bank', type: 'single', q: '¿Te gustaría trabajar freelance o en empresa?', options: ['Freelance', 'En empresa', 'No lo sé aún'] },
      { id: 'a_inspira', pose: 'front', type: 'textarea', q: '¿Qué artistas o marcas creativas te inspiran?', optional: true },
    ] },
};

const VOCACIONAL = { key: 'vocacional', code: 'VOC', name: 'Perfil vocacional',
  line: (n) => `Penúltima escala. ${n} preguntas sobre lo que te imaginas a futuro.`,
  questions: [
    { id: 'v_trabajo10', pose: 'three', type: 'textarea', q: '¿Qué tipo de trabajo te imaginas teniendo en 10 años?' },
    { id: 'v_prioridad', pose: 'front', type: 'single', q: '¿Qué es lo más importante para ti?', options: ['Salario', 'Pasión', 'Impacto', 'Estabilidad'] },
    { id: 'v_paises', pose: 'bank', type: 'multi', q: '¿Qué países te interesaría considerar para estudiar?', options: ['Países Bajos', 'Reino Unido', 'España', 'Estados Unidos', 'Alemania', 'Francia', 'Irlanda', 'Italia', 'Otro'] },
    { id: 'v_expectativas', pose: 'three', type: 'textarea', q: '¿Qué expectativas tienes de tu experiencia universitaria internacional?', optional: true },
  ] };

const ASIGNATURAS = { key: 'asignaturas', code: 'ASG', name: 'Asignaturas',
  line: () => 'Última escala antes de aterrizar: las asignaturas que cursas este año.',
  questions: [{ id: 'asignaturas', pose: 'side', type: 'subjects', q: '¿Qué asignaturas estás cursando este curso?' }] };

/* Sistema académico (portal) a partir de la respuesta de Información general, para los niveles de cada asignatura */
const ACADEMIC = {
  'Bachillerato español': { label: 'Bachillerato español', levels: [] },
  'Bachillerato Internacional (IB)': { label: 'Bachillerato Internacional (IB)', levels: [{ value: 'sl', label: 'SL' }, { value: 'hl', label: 'HL' }] },
  'A-Levels (británico)': { label: 'A-Levels británicos', levels: [{ value: 'as', label: 'AS Level' }, { value: 'a_level', label: 'A Level' }] },
  'Sistema americano': { label: 'High School Diploma estadounidense', levels: [{ value: 'standard', label: 'Estándar' }, { value: 'honors', label: 'Honors' }, { value: 'ap', label: 'AP' }] },
  'Bac francés': { label: 'Baccalauréat francés', levels: [] },
  'Otro': { label: 'Otro sistema académico', levels: [] },
};
const MAX_SUBJECTS = 20;

/* Códigos de aeropuerto para que el origen del billete se lea como un vuelo real */
const IATA = { madrid: 'MAD', barcelona: 'BCN', valencia: 'VLC', sevilla: 'SVQ', bilbao: 'BIO', malaga: 'AGP', zaragoza: 'ZAZ', palma: 'PMI', 'palma de mallorca': 'PMI', alicante: 'ALC', murcia: 'RMU', valladolid: 'VLL', santander: 'SDR', oviedo: 'OVD', granada: 'GRX', 'a coruna': 'LCG', 'la coruna': 'LCG', coruna: 'LCG', vigo: 'VGO', 'san sebastian': 'EAS', donostia: 'EAS', pamplona: 'PNA', 'las palmas': 'LPA', 'las palmas de gran canaria': 'LPA', tenerife: 'TFN', 'santa cruz de tenerife': 'TFN', lisboa: 'LIS', oporto: 'OPO', porto: 'OPO', 'ciudad de mexico': 'MEX', bogota: 'BOG', lima: 'LIM', 'buenos aires': 'EZE', santiago: 'SCL', miami: 'MIA' };

/* ================= Utilidades ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = (o) => (typeof o === 'string' ? { label: o, value: o } : o);
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 60) : ms));
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const destinationImage = (city) => CITY_IMG[plain(city)] || CITY_IMG.default;
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

/* ================= Estado ================= */
function fresh() {
  return { phase: 'checkin', ticket: { nombre: '', apellidos: '', email: '', telefono: '', colegio: '', ciudad: '', pais: '', consent: false },
    area: '', answers: {}, b: 0, q: -1, results: null, slide: 0, noticeShown: false };
}
let S = fresh();
let busy = false;

function questionsOf(block) { return block.questions.filter((q) => !q.when || q.when(S.answers)); }
function blocks() { return [GENERAL, ...(AREA_BLOCKS[S.area] ? [AREA_BLOCKS[S.area]] : []), VOCACIONAL, ASIGNATURAS].map((b) => Object.assign({}, b, { qs: questionsOf(b) })); }
function totalQuestions() { return blocks().reduce((n, b) => n + b.qs.length, 0) + 1; }
function originCode() {
  const c = plain(S.ticket.ciudad);
  if (!c) return '';
  if (IATA[c]) return IATA[c];
  const letters = c.replace(/[^a-z]/g, '');
  return letters.slice(0, 3).toUpperCase() || 'ORG';
}

/* ================= Fases ================= */
function show(phase) {
  S.phase = phase;
  ['checkin', 'ruta', 'vuelo', 'destino'].forEach((id) => { $('#s-' + id).hidden = id !== phase; });
  $('#route').hidden = phase !== 'vuelo';
  const el = $('#s-' + phase);
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  window.scrollTo(0, 0);
}

/* ================= Check-in ================= */
const KEYS = ['nombre', 'apellidos', 'email', 'telefono', 'colegio', 'ciudad', 'pais'];
const F = {}; KEYS.forEach((k) => { F[k] = $('#t-' + k); }); F.consent = $('#t-consent');
const now = new Date();
const boardTime = new Date(now.getTime() + 15 * 60000);
$('#p-date').textContent = now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();
$('#p-time').textContent = boardTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

function barcode(str) {
  let h = hash(str || 'robin'), x = 0; const bars = [];
  for (let i = 0; i < 70; i++) { h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; const w = 1 + (h % 3); if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="40"/>`); x += w; }
  return `<svg viewBox="0 0 ${x} 40" preserveAspectRatio="none" width="100%" height="44"><g fill="currentColor">${bars.join('')}</g></svg>`;
}
function setDD(el, value, placeholder) { el.textContent = value || placeholder; el.classList.toggle('empty', !value); }
function renderPass() {
  const t = S.ticket;
  const name = (t.apellidos || t.nombre) ? `${(t.apellidos || '—').toUpperCase()} / ${(t.nombre || '—').toUpperCase()}` : '';
  setDD($('#p-name'), name, 'APELLIDOS / NOMBRE');
  setDD($('#p-school'), t.colegio.toUpperCase(), '—');
  setDD($('#p-contact'), [t.email, t.telefono].filter(Boolean).join(' · '), 'correo · teléfono');
  const oc = originCode();
  const o = $('#p-orig'); o.textContent = oc || '···'; o.classList.toggle('empty', !oc);
  $('#p-orig-city').textContent = [t.ciudad, t.pais].filter(Boolean).join(', ') || 'Tu ciudad';
  $('#leg').textContent = oc ? ` · ${oc} → UNI` : '';
  const seed = (t.nombre + t.apellidos).trim();
  const seat = seed ? `${3 + (hash(seed) % 26)}A` : '—';
  $('#p-seat').textContent = seat; $('#cabin-seat').textContent = seat;
  $('#p-barcode').innerHTML = barcode(seed + t.email);
}
function syncFormFromState() {
  KEYS.forEach((k) => { F[k].value = S.ticket[k]; });
  F.consent.checked = !!S.ticket.consent;
  renderPass();
}
KEYS.forEach((k) => F[k].addEventListener('input', () => { S.ticket[k] = F[k].value.trim(); clearErr(k); renderPass(); }));
F.consent.addEventListener('change', () => { S.ticket.consent = F.consent.checked; clearErr('consent'); });
function clearErr(k) { const f = $(`.field[data-f="${k}"]`); if (f) f.classList.remove('invalid'); }
function ticketProblems() {
  const t = S.ticket; const bad = [];
  if (t.nombre.length < 2) bad.push('nombre');
  if (t.apellidos.length < 2) bad.push('apellidos');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.email)) bad.push('email');
  if (t.telefono.replace(/\D/g, '').length < 9) bad.push('telefono');
  if (t.colegio.length < 2) bad.push('colegio');
  if (t.ciudad.length < 2) bad.push('ciudad');
  if (t.pais.length < 2) bad.push('pais');
  if (!t.consent) bad.push('consent');
  return bad;
}
$('#ticket-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  const bad = ticketProblems();
  $$('.field[data-f]').forEach((f) => f.classList.toggle('invalid', bad.includes(f.dataset.f)));
  if (bad.length) { F[bad[0]].focus(); return; }
  busy = true;
  const stamp = $('#stamp');
  stamp.classList.remove('on'); void stamp.offsetWidth; stamp.classList.add('on');
  if (window.matchMedia('(max-width: 959px)').matches) $('#pass').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  await wait(1100);
  busy = false;
  show('ruta'); renderRuta();
});

/* ================= Ruta (pregunta 14) ================= */
function renderRuta() {
  $('#areas').innerHTML = AREAS.map((a) => `<button type="button" class="area" data-k="${a.key}" aria-pressed="${S.area === a.key}"><span class="acode">${esc(a.code)}</span><span class="aname">${esc(a.name)}</span><span class="aex">${esc(a.ex)}</span></button>`).join('');
  const bl = blocks(); const oc = originCode() || 'ORG'; const area = areaBy(S.area);
  const count = (b) => (b.key === 'asignaturas' ? '1 pantalla' : `${b.qs.length}${b.key === 'general' && !S.answers.g_sistema ? '–18' : ''} preg.`);
  const rows = [
    `<li><span class="sc">${esc(oc)}</span><span class="dot" aria-hidden="true"></span><span class="sn">${esc(S.ticket.ciudad || 'Tu ciudad')}</span><span class="sq">Origen</span></li>`,
    ...bl.map((b) => `<li class="${AREA_BLOCKS[b.key] ? 'esc' : ''}"><span class="sc">${b.code}</span><span class="dot" aria-hidden="true"></span><span class="sn">${esc(b.name)}</span><span class="sq">${count(b)}</span></li>`),
    `<li class="end"><span class="sc">UNI</span><span class="dot" aria-hidden="true"></span><span class="sn">La universidad${area ? `<small>Rumbo: ${esc(area.name)}</small>` : ''}</span><span class="sq">Destino</span></li>`,
  ];
  $('#stops').innerHTML = rows.join('');
  const total = totalQuestions();
  $('#itin-sum').innerHTML = area
    ? `<span><b>${bl.length}</b> escalas</span><span><b>${total}</b> preguntas</span><span>unos <b>${Math.max(1, Math.round(total * 15 / 60))}</b> min</span>`
    : `<span>Elige un área para fijar el rumbo.</span>`;
  $('#takeoff-btn').disabled = !area;
  $('#takeoff-btn-m').disabled = !area;
  $('#rb-sum').innerHTML = area ? `Rumbo: <b>${esc(area.name)}</b>` : 'Elige un área';
}
$('#areas').addEventListener('click', (e) => {
  const btn = e.target.closest('.area'); if (!btn) return;
  S.area = btn.dataset.k;
  renderRuta();
  const again = $(`.area[data-k="${S.area}"]`); if (again) again.focus();
});
$('#ruta-back').addEventListener('click', () => { show('checkin'); syncFormFromState(); $('#stamp').classList.remove('on'); });
const doTakeoff = () => { if (!S.area) return; S.b = 0; S.q = -1; show('vuelo'); takeoff(); };
$('#takeoff-btn').addEventListener('click', doTakeoff);
$('#takeoff-btn-m').addEventListener('click', doTakeoff);

/* ================= Ventanilla: Robin y su avioneta ================= */
const win = $('#window');
const fly = $('#robin-fly');
let chore = 0;      // cancela coreografías que se solapan
let curPose = null;
/* Cada pregunta tiene su vista (campo pose). Criterio:
   side  = de perfil, en crucero: preguntas de datos y listas
   three = tres cuartos, acercándose: lo que viene (futuro, intereses, cómo aprendes)
   front = de frente, te mira: preguntas sobre ti y anuncios de escala
   away  = se gira hacia atrás: lo que dejas atrás (notas pasadas, lo que no te gusta)
   bank  = alabeo: maniobra de posición (curso actual) */
const PLACE = {
  side:  { x: -4, y: -2 },
  three: { x: 4, y: 2, s: 1.04 },
  front: { x: 0, y: 2, s: 1.04 },
  away:  { x: 7, y: 0, s: .95 },
  bank:  { x: 0, y: -8, s: .95, r: -4 },
};
const YAW = { away: -1, side: 0, three: 1, front: 2 };   // orden de giro sobre el eje vertical
function place(o = {}, instant = false) {
  if (instant) fly.classList.add('instant');
  fly.style.setProperty('--x', (o.x || 0) + '%');
  fly.style.setProperty('--y', (o.y || 0) + '%');
  fly.style.setProperty('--s', o.s ?? 1);
  fly.style.setProperty('--r', (o.r || 0) + 'deg');
  if (instant) { void fly.offsetWidth; fly.classList.remove('instant'); }
}
/* Cambia de vista: la vista que sale gira y se desvanece mientras la nueva entra girando desde el lado contrario.
   Si interviene el alabeo, el giro es de alabeo (eje del avión); si no, de guiñada (eje vertical). */
function setPose(name, o, instant = false) {
  o = o || PLACE[name];
  const imgs = $$('.pose', fly);
  const from = imgs.find((i) => i.dataset.pose === curPose);
  const to = imgs.find((i) => i.dataset.pose === name);
  imgs.forEach((img) => img.classList.toggle('on', img === to));
  place(o, instant);
  const prev = curPose; curPose = name;
  if (instant || reduceMotion || !to.animate || !from || from === to) return;
  [from, to].forEach((img) => img.getAnimations().forEach((an) => an.cancel()));
  let outT, inT;
  if (name === 'bank' || prev === 'bank') {
    const d = name === 'bank' ? 1 : -1;
    outT = `rotate(${-28 * d}deg) scale(.9)`; inT = `rotate(${24 * d}deg) scale(.9)`;
  } else {
    const d = Math.sign(YAW[name] - YAW[prev]) || 1;
    outT = `perspective(900px) rotateY(${62 * d}deg) scale(.94)`; inT = `perspective(900px) rotateY(${-62 * d}deg) scale(.94)`;
  }
  from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: outT }], { duration: 400, easing: 'cubic-bezier(.5,0,.75,0)' });
  to.animate([{ opacity: 0, transform: inT }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 170, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'backwards' });
}
function whoosh() {
  if (reduceMotion) return;
  win.classList.remove('whoosh'); void win.offsetWidth; win.classList.add('whoosh');
  setTimeout(() => win.classList.remove('whoosh'), 700);
}
function mvQuestion(q, dir) {        // la vista fija de esa pregunta, con un pequeño cambio de sitio para que no se repita el encuadre
  ++chore;
  if (dir === 'next') whoosh();
  const k = S.q % 3; const base = PLACE[q.pose];
  setPose(q.pose, Object.assign({}, base, { x: (base.x || 0) + [-2, 0, 2][k], y: (base.y || 0) + [0, -2, 1][k] }), dir === 'none');
}
async function mvIntro() {          // alabeo y se gira hacia ti para anunciar la escala
  const id = ++chore;
  whoosh();
  setPose('bank', { x: -5, y: -9, r: -5, s: .95 });
  await wait(620); if (id !== chore) return;
  setPose('front');
}
async function mvTakeoff() {        // aparece a lo lejos, se acerca de frente, hace un alabeo y te mira
  const id = ++chore;
  setPose('front', { x: 26, y: -34, s: .14 }, true);
  await wait(80); if (id !== chore) return;
  fly.classList.add('slow');
  place({ x: 0, y: 0, s: 1 });
  await wait(1700); fly.classList.remove('slow'); if (id !== chore) return;
  setPose('bank', { x: -4, y: -8, r: -5, s: .95 });
  await wait(620); if (id !== chore) return;
  setPose('front');
}
/* ---- Aterrizaje: Robin se pone de perfil, planea hasta la pista, levanta el morro, toca tierra, frena y te saluda ---- */
const RUNWAY = .645;   // altura de la pista dentro de la ventanilla (fracción)
function timing(ms, ease) { fly.style.transitionDuration = ms ? ms + 'ms' : ''; fly.style.transitionTimingFunction = ease || ''; }
function yWheels(pose, s, frac) {   // --y (en % del contenedor) para que las ruedas queden a esa altura de la ventanilla
  const h = fly.offsetHeight, w = fly.offsetWidth, cy = fly.offsetTop;
  const img = $(`.pose[data-pose="${pose}"]`, fly);
  const ia = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.85;
  const half = Math.min(h, w / ia) / 2 * s;
  return ((win.clientHeight * frac - cy - half) / h) * 100;
}
function scrollGround(ms) {        // el suelo pasa rápido y se va frenando
  if (reduceMotion) return;
  [['.g-far', .22], ['.g-trees', .18], ['.g-dash', 1], ['.g-edge', 1], ['.g-near', 1.5]].forEach(([sel, f]) => {
    const el = $(sel, win); el.getAnimations().forEach((an) => an.cancel());
    el.animate([{ backgroundPositionX: '0px' }, { backgroundPositionX: `${1150 * f}px`, offset: .5, easing: 'cubic-bezier(.2,.65,.3,1)' }, { backgroundPositionX: `${1600 * f}px` }], { duration: ms, fill: 'forwards' });
  });
}
function touchdown() {
  const pf = $('.puffs', fly); pf.classList.remove('go'); void pf.offsetWidth; pf.classList.add('go');
  if (reduceMotion) return;
  $('.robin-drift', fly).animate([{ transform: 'none' }, { transform: 'translateY(-6%)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
  setTimeout(() => win.animate([{ transform: 'none' }, { transform: 'translateY(3px)' }, { transform: 'translateY(-1px)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' }), 650);
}
function resetCabin() {
  win.classList.remove('landing');
  fly.classList.remove('calm'); timing(0);
  $('.puffs', fly).classList.remove('go');
  $$('.ground div', win).forEach((el) => el.getAnimations().forEach((an) => an.cancel()));
}
async function mvLand() {
  const id = ++chore;
  timing(0);
  fly.classList.add('calm');                     // deja de balancearse: va a tocar tierra
  win.classList.add('landing');                  // aparece el suelo y las nubes se apartan
  scrollGround(5200);
  setPose('side', { x: 8, y: yWheels('side', .8, .42), s: .8, r: -3 });
  await wait(1100); if (id !== chore) return;
  timing(1500, 'cubic-bezier(.45,0,.4,1)');      // planeo hacia la pista, morro abajo
  place({ x: 2, y: yWheels('side', .64, .575), s: .64, r: -2.5 });
  await wait(1500); if (id !== chore) return;
  timing(460, 'ease-out');                       // recogida: morro arriba
  place({ x: -1, y: yWheels('side', .63, .62), s: .63, r: 3.5 });
  await wait(460); if (id !== chore) return;
  timing(220, 'ease-in');                        // toma de contacto
  place({ x: -2, y: yWheels('side', .63, RUNWAY), s: .63, r: 0 });
  await wait(220); if (id !== chore) return;
  touchdown();
  setBubble('En tierra', `¡Tocamos tierra${S.ticket.nombre ? ', ' + S.ticket.nombre : ''}! Ya tengo tus tres destinos.`, '');
  timing(1700, 'cubic-bezier(.15,.6,.25,1)');    // frenada por la pista
  place({ x: -13, y: yWheels('side', .63, RUNWAY), s: .63, r: 0 });
  await wait(1600); if (id !== chore) return;
  timing(0);
  setPose('front', { x: -13, y: yWheels('front', .66, RUNWAY), s: .66 });   // se gira y te saluda
  await wait(900);
}

/* ================= Zoom a la ventanilla: Robin te habla de cerca ================= */
const zoomLine = () => {
  const a = areaBy(S.area);
  return `¿Te tira algo más que ${a ? a.name : 'esta área'}? Buena señal. Hoy volamos con un solo rumbo porque es un vuelo de prueba gratuito. En el asesoramiento de Project Robin exploramos contigo todo lo que te interesa y damos con el destino que de verdad encaja contigo.`;
};
function windowClip() {
  const r = win.getBoundingClientRect(); const b = win.clientLeft;
  const top = r.top + b, left = r.left + b, w = win.clientWidth, h = win.clientHeight;
  const desk = window.matchMedia('(min-width: 900px)').matches;
  const rx = desk ? w * .4 : Math.min(68, w / 2), ry = desk ? h * .3 : Math.min(68, h / 2);
  return { top, left, w, h, clip: `inset(${top}px ${innerWidth - left - w}px ${innerHeight - top - h}px ${left}px round ${rx}px / ${ry}px)` };
}
async function robinSays(text) {
  const z = $('#zoom'), zr = $('#z-robin'), zb = $('#z-bubble'), zt = $('#z-text');
  zt.innerHTML = text.split(' ').map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
  $('#z-sr').textContent = '';
  z.hidden = false; zb.style.opacity = '0';
  document.documentElement.style.overflow = 'hidden';
  const full = 'inset(0px 0px 0px 0px round 0px / 0px)';
  const from = () => {   // dónde está Robin (vista de frente) dentro de la ventanilla pequeña
    const img = $('.pose[data-pose="front"]', fly); const fr = img.getBoundingClientRect();
    const end = zr.getBoundingClientRect();
    const sc = (fr.width * .95) / end.width;
    return `translate(calc(-50% + ${fr.left + fr.width / 2 - (end.left + end.width / 2)}px), calc(-50% + ${fr.top + fr.height / 2 - (end.top + end.height / 2)}px)) scale(${sc})`;
  };
  if (!reduceMotion) {
    const c = windowClip().clip;
    z.animate([{ clipPath: c, opacity: 0 }, { clipPath: c, opacity: 1, offset: .12 }, { clipPath: full, opacity: 1 }], { duration: 1050, easing: 'cubic-bezier(.65,0,.25,1)' });
    zr.animate([{ transform: from() }, { transform: from(), offset: .12 }, { transform: 'translate(-50%,-50%)' }], { duration: 1050, easing: 'cubic-bezier(.65,0,.25,1)' });
    await wait(1100);
    zb.animate([{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  }
  zb.style.opacity = '1';
  $('#z-sr').textContent = text;                 // lectores de pantalla: el mensaje completo de una vez
  await wait(320);
  for (const w of $$('.w', zt)) {                // el texto se escribe palabra a palabra
    w.classList.add('on');
    await wait(85 + w.textContent.length * 9 + (/[.?!:]$/.test(w.textContent) ? 260 : /,$/.test(w.textContent) ? 120 : 0));
  }
  await wait(2300);                               // tiempo para terminar de leer
  if (!reduceMotion) {
    zb.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
    await wait(240);
    const c = windowClip().clip;
    z.animate([{ clipPath: full, opacity: 1 }, { clipPath: c, opacity: 1, offset: .82 }, { clipPath: c, opacity: 0 }], { duration: 1000, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
    zr.animate([{ transform: 'translate(-50%,-50%)' }, { transform: from(), offset: .82 }, { transform: from() }], { duration: 1000, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
    await wait(1020);
  }
  [z, zr, zb].forEach((el) => el.getAnimations().forEach((an) => an.cancel()));
  z.hidden = true; zb.style.opacity = '0';
  document.documentElement.style.overflow = '';
}

/* ================= Vuelo ================= */
async function takeoff() {
  busy = true;
  win.classList.remove('open'); resetCabin();
  setPose('front', { x: 26, y: -34, s: .14 }, true);
  renderRoute();
  setBubble('Embarque completado', `Despegamos${S.ticket.nombre ? ', ' + S.ticket.nombre : ''}. Te voy preguntando desde aquí fuera: en unas preguntas eliges una opción y en otras puedes marcar varias.`, '');
  $('#answers').replaceChildren(); setActions({ none: true });
  await wait(450);
  win.classList.add('open');
  await wait(650);
  await mvTakeoff();
  await wait(450);
  await robinSays(zoomLine());         // zoom a la ventanilla: Robin recuerda que es una prueba gratuita
  busy = false;
  renderStep('takeoff');
}
function openWindowNow() { win.classList.add('open'); resetCabin(); }

function renderRoute(final) {
  const bl = blocks();
  const codes = [originCode() || 'ORG', ...bl.map((b) => b.code), 'UNI'];
  const n = codes.length - 1;
  const cur = bl[S.b];
  const within = final ? 1 : (S.q < 0 ? 0 : S.q / cur.qs.length);
  const p = final ? 1 : (S.b + within) / n;
  $('#track-nodes').innerHTML = codes.map((c, i) => {
    const state = final ? 'done' : (i <= S.b ? 'done' : (i === S.b + 1 ? 'next' : ''));
    return `<div class="node ${state}" style="left:${(i / n) * 100}%"><i></i><b>${esc(c)}</b></div>`;
  }).join('');
  $('#track-fill').style.width = `${p * 100}%`;
  $('#track-plane').style.left = `${p * 100}%`;
  $('#track').setAttribute('aria-label', final ? 'Llegando al destino' : `Rumbo a ${cur.name}, escala ${S.b + 1} de ${bl.length}`);
}
function setBubble(meta, text, hint) {
  $('#qmeta-txt').textContent = meta;
  $('#qtext').textContent = text;
  $('#qhint').textContent = hint || '';
  $('#qhint').hidden = !hint;
}
function setActions(o) {
  const next = $('#next-btn'), back = $('#back-btn'), skip = $('#skip-btn');
  back.hidden = !!o.none;
  skip.hidden = !o.skip || !!o.none;
  next.hidden = !!o.none || !!o.noNext;
  next.textContent = o.label || 'Continuar';
  next.insertAdjacentHTML('beforeend', ICON.arrow);
  next.disabled = !!o.disabled;
}
function curQ() { const b = blocks()[S.b]; return S.q >= 0 ? b.qs[S.q] : null; }
function isLastQuestion() { const bl = blocks(); return S.b === bl.length - 1 && S.q === bl[S.b].qs.length - 1; }
const nextLabel = () => (isLastQuestion() ? 'Aterrizar' : 'Continuar');

async function swap(dir, fn) {
  const pane = $('#qpane');
  if (reduceMotion || !pane.animate || dir === 'none' || dir === 'takeoff') { fn(); return; }
  const dx = dir === 'back' ? 18 : -18;
  busy = true;
  try {
    const out = pane.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${dx}px)` }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
    await out.finished.catch(() => {});
    fn();
    const a = pane.animate([{ opacity: 0, transform: `translateX(${-dx}px)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22,.7,.2,1)' });
    out.cancel();
    busy = false;
    await a.finished.catch(() => {});
  } finally { busy = false; }
}

function renderStep(dir) {
  renderRoute();
  $('#q-err').hidden = true;
  const bl = blocks(); const blk = bl[S.b];
  // Coreografía de Robin según el momento
  if (S.q < 0) { if (dir === 'none') { ++chore; setPose('front', null, true); } else if (dir !== 'takeoff') mvIntro(); }
  else mvQuestion(blk.qs[S.q], dir);
  // A mitad de vuelo (al llegar a la 2.ª escala), aviso de cabina una sola vez
  if (S.b === 1 && S.q < 0 && !S.noticeShown) setTimeout(() => { if (S.phase === 'vuelo' && S.b === 1 && S.q < 0 && !S.noticeShown) openNotice(); }, 1300);
  swap(dir, () => {
    if (S.q < 0) return renderIntro(blk, bl);
    const q = blk.qs[S.q];
    const typeHint = { single: 'Elige una opción.', multi: q.max ? `Elige hasta ${q.max}.` : 'Puedes elegir varias.', slider: 'Desliza para responder.', textarea: 'Con un par de frases basta.', text: '', subjects: '' }[q.type];
    const hint = q.hint || [q.optional ? 'Opcional.' : '', typeHint].filter(Boolean).join(' ');
    setBubble(`${blk.code} · Pregunta ${S.q + 1} de ${blk.qs.length}`, q.q, hint);
    const box = document.createElement('div');   // contenedor nuevo: los listeners no se acumulan
    $('#answers').replaceChildren(box);
    RENDER[q.type](box, q);
  });
  if (window.scrollY > 120) window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}
function renderIntro(blk, bl) {
  const n = blk.qs.length;
  setBubble(`Escala ${S.b + 1} de ${bl.length}`, blk.line(n, S.ticket.nombre), '');
  $('#answers').innerHTML = `<div class="board" role="group" aria-label="Próxima escala">
      <div class="lbl">Robin Airlines · Próxima escala</div>
      <div class="flap" aria-hidden="true">${blk.code.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</div>
      <div class="bname">${esc(blk.name)}</div>
      <div class="bmeta"><span><b>${n}</b> preguntas</span><span>unos <b>${Math.max(1, Math.round(n * 15 / 60))}</b> min</span></div>
    </div>`;
  setActions({ label: S.b === 0 ? 'Empezar' : 'Seguir volando' });
}

/* ---- Tipos de pregunta ---- */
function layoutClass(opts) {
  const n = opts.length; const maxLen = Math.max(...opts.map((o) => o.length));
  if (n % 3 === 0 && n >= 6 && maxLen <= 12) return 'grid3';
  if (n >= 6 && n % 2 === 0) return maxLen <= 14 ? 'cols2 cols2m' : 'cols2';
  return '';
}
function autoNext() { hop(); busy = true; setTimeout(() => { busy = false; next(); }, reduceMotion ? 80 : 320); }
function hop() {
  const bob = $('.robin-bob', fly);
  if (reduceMotion || !bob.animate) return;
  bob.animate([{ transform: 'none' }, { transform: 'translateY(-7%) rotate(-4deg)' }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.3,.7,.3,1)', composite: 'add' });
}
const RENDER = {
  single(box, q) {
    const opts = q.options.map(norm);
    const cur = S.answers[q.id];
    box.innerHTML = `<div class="opts ${layoutClass(opts.map((o) => o.label))}" role="group" aria-label="${esc(q.q)}">${opts.map((o) => `<button type="button" class="opt" data-v="${esc(o.value)}" aria-pressed="${cur === o.value}"><span>${esc(o.label)}</span><span class="tick">${ICON.check}</span></button>`).join('')}</div>`;
    box.querySelector('.opts').addEventListener('click', (e) => {
      const b = e.target.closest('.opt'); if (!b || busy) return;
      S.answers[q.id] = b.dataset.v;
      if (q.id === 'g_sistema') {
        if (b.dataset.v !== 'Bachillerato español') delete S.answers.modalidad;
        if (b.dataset.v !== cur && Array.isArray(S.answers.asignaturas)) S.answers.asignaturas.forEach((x) => { x.level = ''; });
      }
      $$('.opt', box).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      autoNext();
    });
    setActions({ noNext: cur === undefined, label: nextLabel() });
  },
  multi(box, q) {
    const opts = q.options.map(norm);
    const sel = new Set(S.answers[q.id] || []);
    const actions = () => setActions({ disabled: !q.optional && !sel.size, skip: q.optional && !sel.size, label: nextLabel() });
    const draw = () => {
      box.innerHTML = `<div class="chips" role="group" aria-label="${esc(q.q)}">${opts.map((o) => {
        const on = sel.has(o.value); const maxed = q.max && !on && sel.size >= q.max;
        return `<button type="button" class="chip${maxed ? ' maxed' : ''}" data-v="${esc(o.value)}" aria-pressed="${on}"${maxed ? ' aria-disabled="true"' : ''}>${ICON.check}${esc(o.label)}</button>`;
      }).join('')}</div><p class="count">${sel.size ? `${sel.size} ${sel.size === 1 ? 'elegida' : 'elegidas'}` : 'Nada elegido todavía'}${q.max ? ` · máximo ${q.max}` : ''}</p>`;
    };
    draw();
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      const v = b.dataset.v;
      if (sel.has(v)) sel.delete(v);
      else if (q.max && sel.size >= q.max) { showErr(`Puedes elegir hasta ${q.max}. Quita una para cambiarla.`); return; }
      else sel.add(v);
      if (sel.size) S.answers[q.id] = Array.from(sel); else delete S.answers[q.id];
      $('#q-err').hidden = true;
      draw();
      const again = box.querySelector(`.chip[data-v="${CSS.escape(v)}"]`); if (again) again.focus();
      actions();
    });
    actions();
  },
  slider(box, q) { renderSlider(box, q); },
  text(box, q) { textLike(box, q, false); },
  textarea(box, q) { textLike(box, q, true); },
  subjects(box, q) { renderSubjects(box, q); },
};
function renderSlider(box, q) {
  const v0 = S.answers[q.id] ?? q.def;
  const id = 'r-' + q.id;
  const fmt = (v) => (q.suffix
    ? `${Number(v).toLocaleString('es-ES')}<small>€/mes</small>`
    : `${Number(v).toLocaleString('es-ES', { minimumFractionDigits: q.step < 1 ? 1 : 0, maximumFractionDigits: 1 })}<small>/ ${q.max}</small>`);
  box.innerHTML = `<div class="slider">
      <div class="sval" id="${id}-v" aria-hidden="true">${fmt(v0)}</div>
      <label class="sr" for="${id}">${esc(q.q)}</label>
      <input type="range" id="${id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${v0}">
      <div class="ends"><span>${esc(q.left)}</span><span>${esc(q.right)}</span></div>
    </div>`;
  const r = $('#' + id, box);
  const paint = () => { r.style.setProperty('--p', `${((r.value - q.min) / (q.max - q.min)) * 100}%`); $('#' + id + '-v', box).innerHTML = fmt(r.value); r.setAttribute('aria-valuetext', q.suffix ? `${r.value} euros al mes` : `${r.value} de ${q.max}`); };
  paint();
  r.addEventListener('input', () => { S.answers[q.id] = Number(r.value); paint(); });
  setActions({ label: nextLabel() });
}
function textLike(box, q, multiline) {
  const id = 'in-' + q.id;
  const cur = S.answers[q.id] || '';
  const quickOn = q.quick && q.quick.includes(cur);
  const val = quickOn ? '' : cur;
  const input = multiline
    ? `<label class="sr" for="${id}">${esc(q.q)}</label><textarea class="tinput" id="${id}" maxlength="600" rows="3" placeholder="Escribe aquí…">${esc(val)}</textarea><div class="tcount"><span id="${id}-c">${val.length}</span>/600</div>`
    : `<label class="sr" for="${id}">${esc(q.q)}</label><input class="tinput" id="${id}" type="text" maxlength="120" value="${esc(val)}" placeholder="${esc(q.ph || 'Escribe aquí…')}" autocomplete="off">`;
  const quick = q.quick ? `<div class="quick-row"><span>o</span>${q.quick.map((t) => `<button type="button" class="chip" data-quick="${esc(t)}" aria-pressed="${cur === t}">${esc(t)}</button>`).join('')}</div>` : '';
  box.innerHTML = input + quick;
  const el = $('#' + id, box);
  const ok = () => el.value.trim().length >= (q.min || 2);
  const upd = () => {
    if (multiline) $('#' + id + '-c', box).textContent = el.value.length;
    if (el.value.trim()) { S.answers[q.id] = el.value.trim(); $$('[data-quick]', box).forEach((c) => c.setAttribute('aria-pressed', 'false')); }
    else if (!q.quick || !q.quick.includes(S.answers[q.id])) delete S.answers[q.id];
    const answered = ok() || (q.quick && q.quick.includes(S.answers[q.id]));
    setActions({ disabled: !q.optional && !answered, skip: q.optional && !answered, label: nextLabel() });
  };
  el.addEventListener('input', upd);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); if (ok() || q.optional) next(); } });
  box.addEventListener('click', (e) => {
    const c = e.target.closest('[data-quick]'); if (!c || busy) return;
    S.answers[q.id] = c.dataset.quick; el.value = '';
    $$('[data-quick]', box).forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    autoNext();
  });
  upd();
  if (window.matchMedia('(min-width: 900px)').matches) setTimeout(() => el.focus({ preventScroll: true }), 280);
}
function renderSubjects(box, q) {
  const sys = ACADEMIC[S.answers.g_sistema] || ACADEMIC['Otro'];
  if (!Array.isArray(S.answers.asignaturas)) S.answers.asignaturas = [];
  const list = S.answers.asignaturas;
  const lv = sys.levels;
  $('#qhint').hidden = false;
  $('#qhint').textContent = `${sys.label}. Toca las que cursas o añade otras${lv.length ? ' e indica el nivel de cada una' : ''}.`;
  const draw = () => {
    const names = new Set(list.map((x) => x.name));
    box.innerHTML = `
      <div class="chips" role="group" aria-label="Asignaturas frecuentes">${Q_SUBJECTS.map((x) => `<button type="button" class="chip" data-n="${esc(x.label)}" aria-pressed="${names.has(x.label)}">${ICON.check}${esc(x.label)}</button>`).join('')}</div>
      <div class="addrow"><label class="sr" for="sub-other">Otra asignatura</label><input class="tinput" id="sub-other" type="text" maxlength="160" placeholder="Otra asignatura, p. ej. Dibujo Técnico II" autocomplete="off"><button type="button" class="btn ghost" id="sub-add">Añadir</button></div>
      ${list.length ? `<ul class="sublist">${list.map((x, i) => `<li><span class="sname">${esc(x.name)}</span>${lv.length ? `<div class="seg" role="radiogroup" aria-label="Nivel de ${esc(x.name)}">${lv.map((l) => `<label><input type="radio" name="lv-${i}" value="${l.value}"${x.level === l.value ? ' checked' : ''} data-i="${i}"><span>${esc(l.label)}</span></label>`).join('')}</div>` : ''}<button type="button" class="iconbtn" data-rm="${i}" aria-label="Quitar ${esc(x.name)}">${ICON.x}</button></li>`).join('')}</ul>` : '<p class="empty-note">Añade al menos una asignatura.</p>'}
      <p class="count">${list.length} de ${MAX_SUBJECTS} como máximo</p>`;
    const ready = list.length > 0 && (!lv.length || list.every((x) => x.level));
    setActions({ disabled: !ready, label: 'Aterrizar' });
  };
  const add = (name) => {
    name = name.trim(); if (!name) return;
    if (list.some((x) => x.name.toLowerCase() === name.toLowerCase())) return;
    if (list.length >= MAX_SUBJECTS) { showErr(`Puedes añadir hasta ${MAX_SUBJECTS} asignaturas.`); return; }
    list.push({ name, level: '' });
  };
  draw();
  box.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      const n = chip.dataset.n; const i = list.findIndex((x) => x.name === n);
      if (i >= 0) list.splice(i, 1); else add(n);
      draw(); const again = box.querySelector(`.chip[data-n="${CSS.escape(n)}"]`); if (again) again.focus(); return;
    }
    if (e.target.closest('#sub-add')) { add($('#sub-other', box).value); draw(); $('#sub-other', box).focus(); return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) { list.splice(Number(rm.dataset.rm), 1); draw(); }
  });
  box.addEventListener('change', (e) => {
    if (!e.target.matches('input[type=radio][data-i]')) return;
    list[Number(e.target.dataset.i)].level = e.target.value; draw();
    const r = box.querySelector(`input[name="lv-${e.target.dataset.i}"][value="${e.target.value}"]`); if (r) r.focus();
  });
  box.addEventListener('keydown', (e) => { if (e.target.id === 'sub-other' && e.key === 'Enter') { e.preventDefault(); add(e.target.value); draw(); $('#sub-other', box).focus(); } });
}
function showErr(msg) { const el = $('#q-err'); el.textContent = msg; el.hidden = false; }

/* ---- Navegación ---- */
function next() {
  if (busy) return;
  if (S.b === 1 && S.q < 0 && !S.noticeShown) { openNotice(); return; }   // el aviso de cabina no se salta
  const bl = blocks(); const blk = bl[S.b];
  const cq = curQ(); if (cq && cq.type === 'slider' && S.answers[cq.id] === undefined) S.answers[cq.id] = cq.def;
  if (S.q < blk.qs.length - 1) S.q++;
  else if (S.b < bl.length - 1) { S.b++; S.q = -1; }
  else { land(); return; }
  renderStep('next');
}
function back() {
  if (busy) return;
  const bl = blocks();
  if (S.q > 0) S.q--;
  else if (S.q === 0) S.q = -1;
  else if (S.b > 0) { S.b--; S.q = bl[S.b].qs.length - 1; }
  else { show('ruta'); renderRuta(); return; }
  renderStep('back');
}
$('#next-btn').addEventListener('click', next);
$('#skip-btn').addEventListener('click', () => { const q = curQ(); if (q) delete S.answers[q.id]; next(); });
$('#back-btn').addEventListener('click', back);

/* ---- Aterrizaje ---- */
async function land() {
  busy = true;
  renderRoute(true);
  setBubble('Descenso', 'Iniciando el descenso. Estoy cruzando tus respuestas con el catálogo de carreras.', '');
  setActions({ none: true });
  const resultPromise = requestMatches().then((results) => ({ results }), (error) => ({ error }));
  const steps = ['Datos y situación académica leídos', 'Intereses y asignaturas cruzados', 'Catálogo real consultado'];
  $('#answers').innerHTML = `<ul class="checklist">${steps.map((s) => `<li><span class="ck">${ICON.check}</span>${esc(s)}</li>`).join('')}</ul>`;
  const items = $$('#answers .checklist li');
  const ticks = (async () => { for (const [i, li] of items.slice(0, 2).entries()) { await wait([900, 1200][i]); li.classList.add('on'); } })();
  await Promise.all([mvLand(), ticks]);
  try {
    const outcome = await resultPromise;
    if (outcome.error) throw outcome.error;
    S.results = outcome.results;
    items[2].classList.add('on');
    await wait(500);
    S.slide = 0;
    busy = false;
    show('destino'); renderDestino();
  } catch (error) {
    busy = false;
    setBubble('No hemos podido aterrizar', 'No se pudieron calcular tus destinos.', 'Comprueba la conexión y vuelve a intentarlo. Tus respuestas siguen aquí.');
    $('#answers').innerHTML = `<p class="err-inline">${esc(error.message)}</p>`;
    setActions({ label: 'Reintentar' });
  }
}

/* ================= Recomendaciones reales ================= */
async function requestMatches() {
  const answers = { ...S.answers, g_colegio: S.ticket.colegio };
  const academicSubjects = Array.isArray(answers.asignaturas) ? answers.asignaturas : [];
  delete answers.asignaturas;
  const response = await fetch('/api/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      experience: 'robin-airlines',
      lead: S.ticket,
      email: S.ticket.email,
      intereses: [S.area],
      answers,
      academic_subjects: academicSubjects,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'El recomendador no está disponible en este momento.');
  const items = data.suggestions?.items;
  if (!Array.isArray(items) || items.length < 3) throw new Error('No se han podido obtener tres recomendaciones válidas.');
  return items.slice(0, 3);
}

function renderDestino() {
  $('#dest-title').textContent = S.ticket.nombre ? `Has aterrizado, ${S.ticket.nombre}` : 'Has aterrizado';
  const res = S.results || [];
  const C = 2 * Math.PI * 52;
  $('#slides').innerHTML = res.map((r, i) => {
    const image = destinationImage(r.city);
    const genericImage = image === CITY_IMG.default;
    const strengths = String(r.strengths || '').split(',').map((value) => value.trim()).filter(Boolean);
    const numerusFixus = r.numerus_fixus
      ? `Numerus fixus${r.numerus_fixus_seats ? `: ${r.numerus_fixus_seats} plazas` : ''}`
      : 'Sin numerus fixus indicado';
    return `<div class="slide" role="group" aria-roledescription="destino" aria-label="Destino ${i + 1} de ${res.length}: ${esc(r.career_name)}">
      <article class="card">
        <div class="photo${genericImage ? ' generic' : ''}">
          <img src="${image}" alt="${genericImage ? '' : esc(r.city)}" loading="lazy">
          <span class="rank">Destino ${i + 1} de ${res.length}</span>
          <div class="scrim"><span class="ccode">${esc(r.university_code || 'UNI')}</span><span class="cname">${esc(r.city)}<br>Países Bajos</span></div>
        </div>
        <div class="cbody">
          <div>
            <h2 class="career">${esc(r.career_name)}</h2>
            <p class="uni">${esc(r.university)}</p>
            <p class="desc">${esc(areaBy(S.area)?.name || r.area)}${r.subarea ? `, especialidad en ${esc(r.subarea)}` : ''}.</p>
            <div class="facts"><span class="fact">${esc(r.duration_years)} años</span><span class="fact">${esc(r.degree_type)}</span><span class="fact">Programa en inglés</span><span class="fact">${esc(numerusFixus)}</span></div>
            <div class="notes">
              <div><h4>Por qué encaja</h4><ul><li>${esc(r.reason || 'Coincide con tu perfil general.')}</li></ul></div>
              <div class="check"><h4>Afinidades detectadas</h4><ul>${(strengths.length ? strengths : [r.subarea || r.area]).map((value) => `<li>${esc(value)}</li>`).join('')}</ul></div>
            </div>
          </div>
          <div class="score real-score">
            <div class="ring" role="img" aria-label="Compatibilidad ${r.compatibility}%">
              <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rt" cx="60" cy="60" r="52" fill="none" stroke-width="11"/><circle class="rv" cx="60" cy="60" r="52" fill="none" stroke-width="11" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C * (1 - r.compatibility / 100)).toFixed(1)}"/></svg>
              <div class="rlabel"><span class="pct">${r.compatibility}%</span><span class="pl">Compatibilidad</span></div>
            </div>
          </div>
          <div class="ccta">
            ${r.website_url ? `<a class="btn" href="${esc(r.website_url)}" target="_blank" rel="noopener">Información oficial</a>` : ''}
            <a class="btn ghost" href="https://projectrobin.study/servicios/asesoramiento-completo/" target="_blank" rel="noopener">Ver asesoramiento</a>
          </div>
        </div>
      </article>
    </div>`;
  }).join('');
  $('#dots').innerHTML = res.map((_, i) => `<button type="button" aria-label="Ver destino ${i + 1}" data-dot="${i}"></button>`).join('');
  updateSlide(0, true);
  requestAnimationFrame(() => requestAnimationFrame(() => fillSlide(0)));
}
const slidesEl = $('#slides');
function fillSlide(i) {
  const s = slidesEl.children[i]; if (!s) return;
  $$('.bt i', s).forEach((el) => { el.style.width = el.dataset.w + '%'; });
  $$('.rv', s).forEach((el) => { el.style.strokeDashoffset = el.dataset.off; });
}
function updateSlide(i, silent) {
  const n = slidesEl.children.length; if (!n) return;
  S.slide = clamp(i, 0, n - 1);
  $$('#dots button').forEach((d, k) => d.setAttribute('aria-current', String(k === S.slide)));
  $('#prev-slide').disabled = S.slide === 0;
  $('#next-slide').disabled = S.slide === n - 1;
  fillSlide(S.slide);
  if (!silent) {
    const step = slidesEl.children[0].getBoundingClientRect().width + 16;
    slidesEl.scrollTo({ left: S.slide * step, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
}
let scrollT;
slidesEl.addEventListener('scroll', () => {
  clearTimeout(scrollT);
  scrollT = setTimeout(() => {
    const first = slidesEl.children[0]; if (!first) return;
    const i = Math.round(slidesEl.scrollLeft / (first.getBoundingClientRect().width + 16));
    if (i !== S.slide) updateSlide(i, true);
  }, 90);
});
$('#prev-slide').addEventListener('click', () => updateSlide(S.slide - 1));
$('#next-slide').addEventListener('click', () => updateSlide(S.slide + 1));
$('#dots').addEventListener('click', (e) => { const d = e.target.closest('[data-dot]'); if (d) updateSlide(Number(d.dataset.dot)); });
$('#replay-btn').addEventListener('click', () => { S.b = 0; S.q = -1; show('ruta'); renderRuta(); });

/* ================= Aviso de cabina ================= */
const noticeEl = $('#notice');
let noticeReturn = null;
function openNotice() {
  if (S.noticeShown && !noticeEl.hidden) return;
  S.noticeShown = true;
  $$('.nq', noticeEl).forEach((e) => { e.textContent = totalQuestions(); });
  noticeReturn = document.activeElement;
  noticeEl.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  const sign = $('#notice-sign'); sign.classList.remove('ding'); void sign.offsetWidth; sign.classList.add('ding');
  setTimeout(() => $('#notice-ok').focus(), 60);
  document.addEventListener('keydown', noticeKeys);
}
function closeNotice() {
  noticeEl.hidden = true;
  document.documentElement.style.overflow = '';
  document.removeEventListener('keydown', noticeKeys);
  const back = noticeReturn && document.contains(noticeReturn) && !noticeReturn.closest('[hidden]') ? noticeReturn : $('#next-btn');
  if (back) back.focus({ preventScroll: true });
}
function noticeKeys(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeNotice(); return; }
  if (e.key !== 'Tab') return;
  const f = $$('button, a[href]', noticeEl).filter((x) => x.offsetParent !== null);
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
noticeEl.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeNotice(); });

/* ================= Arranque ================= */
function boot() {
  syncFormFromState();
  show('checkin');
}
boot();
})();
