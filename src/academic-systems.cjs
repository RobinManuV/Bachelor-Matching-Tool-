const ACADEMIC_SYSTEMS = [
  {
    value: 'bachillerato_espanol',
    label: 'Bachillerato español',
    subjectCount: 6,
    levels: [],
  },
  {
    value: 'ib',
    label: 'Bachillerato Internacional (IB)',
    subjectCount: 6,
    levels: [
      { value: 'sl', label: 'Nivel Estándar (SL)' },
      { value: 'hl', label: 'Nivel Superior (HL)' },
    ],
  },
  {
    value: 'a_levels',
    label: 'A-Levels británicos',
    subjectCount: 4,
    levels: [
      { value: 'as', label: 'AS Level' },
      { value: 'a_level', label: 'A Level' },
    ],
  },
  {
    value: 'baccalaureat_frances',
    label: 'Baccalauréat francés',
    subjectCount: 5,
    levels: [],
  },
  {
    value: 'abitur',
    label: 'Abitur alemán',
    subjectCount: 5,
    levels: [
      { value: 'grundkurs', label: 'Grundkurs' },
      { value: 'leistungskurs', label: 'Leistungskurs' },
    ],
  },
  {
    value: 'high_school_diploma',
    label: 'High School Diploma estadounidense',
    subjectCount: 6,
    levels: [
      { value: 'standard', label: 'Estándar' },
      { value: 'honors', label: 'Honors' },
      { value: 'ap', label: 'AP' },
    ],
  },
  {
    value: 'otro',
    label: 'Otro sistema académico',
    subjectCount: 5,
    levels: [],
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

module.exports = {
  ACADEMIC_SYSTEMS,
  MAX_ACADEMIC_SUBJECTS,
  academicSystemByValue,
  academicSystemLabel,
  academicLevelLabel,
  sanitizeAcademicProfile,
};
