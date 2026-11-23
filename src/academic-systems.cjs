const { systems: CURRICULA } = require('../robin-airlines-selector/academic-curricula.js');

const ACADEMIC_SYSTEMS = [
  ...CURRICULA.map(({ value, label, subjectCount, levels }) => ({ value, label, subjectCount, levels })),
  {
    value: 'abitur',
    label: 'Abitur alemán',
    subjectCount: 5,
    levels: [
      { value: 'grundkurs', label: 'Grundkurs' },
      { value: 'leistungskurs', label: 'Leistungskurs' },
    ],
  },
];

const MAX_ACADEMIC_SUBJECTS = 20;

function academicSystemByValue(value) {
  return ACADEMIC_SYSTEMS.find((system) => system.value === value) || null;
}

function academicSystemLabel(value) {
  return academicSystemByValue(value)?.label || value || '';
}

function academicLevelLabel(systemValue, levelValue) {
  const system = academicSystemByValue(systemValue);
  return system?.levels.find((level) => level.value === levelValue)?.label || levelValue || '';
}

function sanitizeAcademicProfile(systemValue, subjectsValue) {
  const system = academicSystemByValue(String(systemValue || '').trim());
  if (!system || !Array.isArray(subjectsValue)) return null;
  const allowedLevels = new Set(system.levels.map((level) => level.value));
  const subjects = subjectsValue
    .slice(0, MAX_ACADEMIC_SUBJECTS)
    .map((subject) => ({
      name: String(subject?.name || '').trim().slice(0, 160),
      level: String(subject?.level || '').trim().slice(0, 60),
    }))
    .filter((subject) => subject.name)
    .map((subject) => ({
      name: subject.name,
      level: system.levels.length ? subject.level : null,
    }));
  if (!subjects.length) return null;
  if (system.levels.length && subjects.some((subject) => !allowedLevels.has(subject.level))) return null;
  return { system: system.value, subjects };
}

function validateAcademicGrade(systemValue, rawValue) {
  if (rawValue == null || rawValue === '') return null;
  const system = CURRICULA.find((entry) => entry.value === systemValue);
  if (!system) throw new Error('Sistema académico no válido para la nota');
  const grade = system.grade;
  if (grade.type === 'text') {
    const value = String(rawValue).replace(/[\r\n]+/g, ' ').trim();
    if (value.length < 2 || value.length > 160) throw new Error('Revisa la nota y su escala');
    return { value, display: value, scale: system.label };
  }
  const value = Number(rawValue);
  const steps = (value - grade.min) / grade.step;
  if (!Number.isFinite(value) || value < grade.min || value > grade.max || Math.abs(steps - Math.round(steps)) > 1e-6) {
    throw new Error(`La nota debe estar entre ${grade.min} y ${grade.max}`);
  }
  return { value, display: `${value}/${grade.max}`, scale: `${grade.min}–${grade.max}` };
}

module.exports = {
  ACADEMIC_SYSTEMS,
  MAX_ACADEMIC_SUBJECTS,
  academicSystemByValue,
  academicSystemLabel,
  academicLevelLabel,
  sanitizeAcademicProfile,
  validateAcademicGrade,
};
