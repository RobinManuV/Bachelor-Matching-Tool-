let config;
let feedback = [];
let lastPayload;
const form = document.getElementById('form');
const status = document.getElementById('status');
const questions = document.getElementById('questions');
const areas = document.getElementById('areas');
const systemSelect = document.getElementById('academic-system');
const subjects = document.getElementById('subjects');
const results = document.getElementById('results');

function optionValue(option) { return typeof option === 'string' ? option : option.value; }
function optionLabel(option) { return typeof option === 'string' ? option : option.label; }
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderQuestion(def) {
  const wrap = el('div', 'question');
  const title = el('label', '', def.q + (def.optional ? ' (opcional)' : ''));
  wrap.append(title);
  if (def.type === 'text' || def.type === 'textarea') {
    const input = document.createElement(def.type === 'text' ? 'input' : 'textarea');
    if (def.type === 'text') input.type = 'text';
    input.dataset.id = def.id;
    input.required = !def.optional;
    wrap.append(input);
  } else if (def.type === 'slider') {
    const row = el('div', 'slider-row');
    row.append(el('span', '', def.left || String(def.min)));
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: def.min, max: def.max, step: def.step, value: def.def });
    input.dataset.id = def.id;
    const output = el('output', '', String(def.def) + (def.suffix || ''));
    input.addEventListener('input', () => { output.textContent = input.value + (def.suffix || ''); });
    row.append(input, el('span', '', def.right || String(def.max)), output);
    wrap.append(row);
  } else {
    if (def.max) wrap.append(el('span', 'hint', `Selecciona como máximo ${def.max}.`));
    const grid = el('div', 'choices');
    for (const option of def.options) {
      const label = el('label');
      const input = document.createElement('input');
      input.type = def.type === 'single' ? 'radio' : 'checkbox';
      input.name = def.id;
      input.value = optionValue(option);
      input.dataset.id = def.id;
      if (def.type === 'multi' && def.max) input.addEventListener('change', () => {
        const checked = [...grid.querySelectorAll('input:checked')];
        if (checked.length > def.max) input.checked = false;
      });
      label.append(input, document.createTextNode(optionLabel(option)));
      grid.append(label);
    }
    wrap.append(grid);
  }
  return wrap;
}

function renderBlock(block, conditional = false) {
  const section = el('section', 'panel' + (conditional ? ' conditional' : ''));
  section.dataset.area = conditional ? block.key : '';
  section.append(el('h2', '', block.title));
  if (conditional) section.append(el('p', '', 'Sección específica para el área seleccionada.'));
  for (const def of block.questions) section.append(renderQuestion(def));
  return section;
}

function selectedAreas() { return [...areas.querySelectorAll('input:checked')].map((input) => input.value); }
function updateAreas() {
  const selected = selectedAreas();
  for (const section of questions.querySelectorAll('[data-area]')) {
    if (section.dataset.area) section.hidden = !selected.includes(section.dataset.area);
  }
}

function addSubject() {
  if (subjects.children.length >= 20) return;
  const row = el('div', 'subject-row');
  const name = document.createElement('input');
  name.type = 'text'; name.placeholder = 'Nombre de la asignatura'; name.maxLength = 160;
  const level = document.createElement('select');
  const chosen = config.academicSystems.find((item) => item.value === systemSelect.value);
  level.append(new Option('Nivel', ''));
  for (const option of chosen?.levels || []) level.append(new Option(option.label, option.value));
  level.hidden = !chosen?.levels.length;
  const remove = el('button', 'secondary', 'Quitar');
  remove.type = 'button'; remove.addEventListener('click', () => row.remove());
  row.append(name, level, remove);
  subjects.append(row);
}

function collect() {
  const selected = selectedAreas();
  if (!selected.length) throw new Error('Selecciona al menos un área de interés.');
  const blocks = [config.Q_GENERAL, ...selected.map((key) => config.Q_AREAS[key]), config.Q_VOCACIONAL];
  const answers = {};
  for (const block of blocks) for (const def of block.questions) {
    const inputs = [...document.querySelectorAll(`[data-id="${def.id}"]`)];
    const value = def.type === 'multi' ? inputs.filter((input) => input.checked).map((input) => input.value)
      : def.type === 'single' ? inputs.find((input) => input.checked)?.value
      : def.type === 'slider' ? Number(inputs[0].value) : inputs[0].value.trim();
    if (!def.optional && (value == null || value === '' || (Array.isArray(value) && !value.length))) throw new Error(`Completa: ${def.q}`);
    answers[def.id] = value;
  }
  const academicSubjects = [...subjects.children].map((row) => ({ name: row.querySelector('input').value.trim(), level: row.querySelector('select').value })).filter((item) => item.name);
  if (!systemSelect.value || !academicSubjects.length) throw new Error('Selecciona el sistema y añade al menos una asignatura.');
  const chosen = config.academicSystems.find((item) => item.value === systemSelect.value);
  if (chosen.levels.length && academicSubjects.some((item) => !item.level)) throw new Error('Indica el nivel de cada asignatura.');
  return { email: form.elements.email.value.trim(), intereses: selected, answers, academic_system: systemSelect.value, academic_subjects: academicSubjects, feedback };
}

async function match(payload) {
  const button = document.getElementById('submit');
  button.disabled = true;
  status.textContent = 'Calculando recomendaciones…';
  try {
    const response = await fetch('/api/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo generar la recomendación.');
    renderResults(data.suggestions);
    status.textContent = data.suggestions.source === 'ai' ? 'Recomendación generada con Claude.' : 'Recomendación calculada con el ranking determinista.';
    results.scrollIntoView({ behavior: 'smooth' });
  } catch (error) { status.textContent = error.message; status.classList.add('error'); }
  finally { button.disabled = false; }
}

function renderResults(data) {
  results.replaceChildren(); results.hidden = false;
  results.append(el('h2', '', 'Carreras recomendadas'));
  results.append(el('p', 'meta', `${data.count} resultados · ${data.source === 'ai' ? 'Claude' : 'Cálculo determinista'} · ${config.careerCount} carreras en el catálogo`));
  const list = el('div', 'results-list');
  for (const item of data.items) {
    const card = el('article', 'result');
    const head = el('div', 'result-head');
    const title = el('h3', '', item.career_name);
    head.append(title, el('span', 'percent', `${item.compatibility}%`));
    card.append(head, el('div', 'meta', `${item.university} · ${item.city} · ${item.area}`), el('p', '', item.reason));
    if (item.strengths) card.append(el('div', 'meta', `Fortalezas: ${item.strengths}`));
    const controls = el('div', 'feedback');
    for (const [decision, text] of [['approved','Aprobar'],['rejected','Descartar']]) {
      const button = el('button', 'secondary', text); button.type = 'button';
      button.classList.toggle('active', feedback.some((entry) => entry.program_code === item.program_code && entry.decision === decision));
      if (decision === 'rejected') button.classList.add('reject');
      button.addEventListener('click', () => {
        feedback = feedback.filter((entry) => entry.program_code !== item.program_code);
        feedback.push({ program_code: item.program_code, decision });
        renderResults(data);
      });
      controls.append(button);
    }
    card.append(controls); list.append(card);
  }
  results.append(list);
  const regenerate = el('button', '', 'Regenerar con estas decisiones');
  regenerate.type = 'button';
  regenerate.addEventListener('click', () => match({ ...lastPayload, feedback }));
  results.append(regenerate);
}

async function init() {
  const response = await fetch('/api/config'); config = await response.json();
  for (const [value,label] of Object.entries(config.areaLabels)) {
    const choice = el('label'); const input = document.createElement('input');
    input.type = 'checkbox'; input.value = value; input.addEventListener('change', updateAreas);
    choice.append(input, document.createTextNode(label));
    let grid = areas.querySelector('.choices');
    if (!grid) { grid = el('div','choices'); areas.append(grid); }
    grid.append(choice);
  }
  questions.append(renderBlock(config.Q_GENERAL));
  for (const block of Object.values(config.Q_AREAS)) questions.append(renderBlock(block,true));
  questions.append(renderBlock(config.Q_VOCACIONAL));
  updateAreas();
  for (const system of config.academicSystems) systemSelect.append(new Option(system.label,system.value));
  systemSelect.addEventListener('change', () => { subjects.replaceChildren(); for (let i=0;i<(config.academicSystems.find((s)=>s.value===systemSelect.value)?.subjectCount||0);i++) addSubject(); });
  document.getElementById('add-subject').addEventListener('click',addSubject);
  form.addEventListener('submit', (event) => { event.preventDefault(); status.classList.remove('error'); try { lastPayload=collect(); match(lastPayload); } catch(error) { status.textContent=error.message; status.classList.add('error'); } });
  form.hidden = false; status.textContent = `${config.careerCount} carreras disponibles en el catálogo.`;
}
init().catch((error) => { status.textContent = error.message; status.classList.add('error'); });
