(() => {
  'use strict';

  const subject = (label, value, dimensions = []) => ({ label, value, dimensions });
  const genericSubjects = [
    subject('Matemáticas', 'matematicas', ['math_level']), subject('Física', 'fisica', ['physics_level']),
    subject('Química', 'quimica', ['chemistry_level']), subject('Biología', 'biologia', ['biology_level']),
    subject('Informática / Programación', 'informatica', ['programming_level']), subject('Economía', 'economia', ['economics_level']),
    subject('Lengua y Literatura', 'lengua', ['writing_level']), subject('Historia', 'historia'),
    subject('Geografía', 'geografia'), subject('Filosofía', 'filosofia'), subject('Idiomas', 'idiomas'),
    subject('Arte y Dibujo', 'arte', ['creativity_level']), subject('Música', 'musica'),
    subject('Tecnología', 'tecnologia'), subject('Educación Física', 'efisica'),
  ];

  const systems = [
    {
      value: 'bachillerato_espanol', answer: 'Bachillerato español', label: 'Bachillerato español', subjectCount: 6, levels: [],
      tracks: ['Ciencias y Tecnología', 'Humanidades y Ciencias Sociales', 'Artes Plásticas, Imagen y Diseño', 'Música y Artes Escénicas', 'General'],
      grade: { type: 'slider', min: 0, max: 10, step: 0.1, def: 7, q: '¿Cuál es tu nota media más reciente de Bachillerato (0–10)?', hint: 'Usa tu media de Bachillerato; si todavía no la tienes, puedes omitir esta pregunta.' },
      subjects: [
        subject('Matemáticas II', 'matematicas', ['math_level']), subject('Matemáticas Aplicadas a las Ciencias Sociales II', 'matematicas_ccss', ['math_level']),
        subject('Física', 'fisica', ['physics_level']), subject('Química', 'quimica', ['chemistry_level']), subject('Biología', 'biologia', ['biology_level']),
        subject('Dibujo Técnico II', 'dibujo_tecnico', ['creativity_level']), subject('Tecnología e Ingeniería II', 'tecnologia_ingenieria', ['programming_level']),
        subject('Economía', 'economia', ['economics_level']), subject('Empresa y Diseño de Modelos de Negocio', 'empresa', ['economics_level']),
        subject('Lengua Castellana y Literatura II', 'lengua', ['writing_level']), subject('Historia de España', 'historia'),
        subject('Geografía', 'geografia'), subject('Historia de la Filosofía', 'filosofia'), subject('Historia del Arte', 'historia_arte', ['creativity_level']),
        subject('Lengua Extranjera II', 'idiomas'), subject('Dibujo Artístico II', 'arte', ['creativity_level']), subject('Música y Artes Escénicas', 'musica'),
      ],
    },
    {
      value: 'ib', answer: 'Bachillerato Internacional (IB)', label: 'Bachillerato Internacional (IB)', subjectCount: 6,
      levels: [{ value: 'sl', label: 'SL' }, { value: 'hl', label: 'HL' }], tracks: [],
      grade: { type: 'slider', min: 1, max: 7, step: 0.1, def: 5, q: '¿Cuál es tu media actual o prevista en las seis asignaturas IB (1–7)?', hint: 'Indica la media de tus asignaturas, sin los puntos de Teoría del Conocimiento ni de la Monografía. Puedes omitirla si aún no tienes notas.' },
      subjects: [
        subject('Matemáticas: Análisis y Enfoques (AA)', 'ib_matematicas_aa', ['math_level']),
        subject('Matemáticas: Aplicaciones e Interpretación (AI)', 'ib_matematicas_ai', ['math_level']),
        subject('Física', 'fisica', ['physics_level']), subject('Química', 'quimica', ['chemistry_level']), subject('Biología', 'biologia', ['biology_level']),
        subject('Informática', 'informatica', ['programming_level']), subject('Sistemas Ambientales y Sociedades', 'ib_sistemas_ambientales', ['biology_level']),
        subject('Economía', 'economia', ['economics_level']), subject('Gestión Empresarial', 'ib_gestion_empresarial', ['economics_level']),
        subject('Historia', 'historia'), subject('Geografía', 'geografia'), subject('Política Global', 'ib_politica_global'),
        subject('Psicología', 'ib_psicologia'), subject('Lengua A: Lengua y Literatura', 'ib_lengua_a', ['writing_level']),
        subject('Lengua B', 'ib_lengua_b'), subject('Artes Visuales', 'arte', ['creativity_level']), subject('Tecnología del Diseño', 'ib_diseno', ['creativity_level']),
      ],
    },
    {
      value: 'a_levels', answer: 'A-Levels (británico)', label: 'A-Levels británicos', subjectCount: 4,
      levels: [{ value: 'as', label: 'AS Level' }, { value: 'a_level', label: 'A Level' }], tracks: [],
      grade: { type: 'text', q: '¿Qué notas tienes o te predicen en tus A-Levels?', hint: 'Escribe cada asignatura y su nota, por ejemplo: Matemáticas A, Física B, Química A*. Si aún no tienes una predicción, puedes omitirla.' },
      subjects: [
        subject('Matemáticas', 'matematicas', ['math_level']), subject('Matemáticas Avanzadas (Further Mathematics)', 'a_matematicas_avanzadas', ['math_level']),
        subject('Física', 'fisica', ['physics_level']), subject('Química', 'quimica', ['chemistry_level']), subject('Biología', 'biologia', ['biology_level']),
        subject('Informática (Computer Science)', 'informatica', ['programming_level']), subject('Economía', 'economia', ['economics_level']),
        subject('Empresa (Business)', 'a_empresa', ['economics_level']), subject('Psicología', 'a_psicologia'), subject('Geografía', 'geografia'),
        subject('Historia', 'historia'), subject('Literatura Inglesa', 'a_literatura', ['writing_level']),
        subject('Arte y Diseño', 'arte', ['creativity_level']), subject('Diseño y Tecnología', 'a_diseno_tecnologia', ['creativity_level']),
        subject('Idiomas', 'idiomas'),
      ],
    },
    {
      value: 'high_school_diploma', answer: 'Sistema americano', label: 'High School Diploma estadounidense', subjectCount: 6,
      levels: [{ value: 'standard', label: 'Estándar' }, { value: 'honors', label: 'Honors' }, { value: 'ap', label: 'AP' }], tracks: [],
      grade: { type: 'slider', min: 0, max: 4, step: 0.1, def: 3, q: '¿Cuál es tu GPA no ponderado más reciente (0–4)?', hint: 'Usa el GPA no ponderado de tu expediente. Si tu colegio solo informa otro tipo de GPA, puedes omitirlo.' },
      subjects: [
        subject('Álgebra II', 'us_algebra', ['math_level']), subject('Precálculo', 'us_precalculo', ['math_level']),
        subject('Cálculo', 'us_calculo', ['math_level']), subject('Estadística', 'us_estadistica', ['math_level']),
        subject('Física', 'fisica', ['physics_level']), subject('Química', 'quimica', ['chemistry_level']), subject('Biología', 'biologia', ['biology_level']),
        subject('Informática', 'informatica', ['programming_level']), subject('Lengua y Literatura Inglesa', 'us_ingles', ['writing_level']),
        subject('Historia de Estados Unidos', 'us_historia'), subject('Gobierno y Política', 'us_gobierno'),
        subject('Economía', 'economia', ['economics_level']), subject('Idiomas', 'idiomas'), subject('Artes Visuales', 'arte', ['creativity_level']),
        subject('Música', 'musica'), subject('Ingeniería y Tecnología', 'us_ingenieria', ['programming_level']),
      ],
    },
    {
      value: 'baccalaureat_frances', answer: 'Bac francés', label: 'Baccalauréat francés', subjectCount: 5, levels: [], tracks: [],
      grade: { type: 'slider', min: 0, max: 20, step: 0.1, def: 14, q: '¿Cuál es tu media más reciente en el Baccalauréat (0–20)?', hint: 'Indica la media de tu expediente sobre 20; no hace falta convertirla.' },
      subjects: [
        subject('Matemáticas (especialidad)', 'fr_matematicas', ['math_level']), subject('Física-Química (especialidad)', 'fr_fisica_quimica', ['physics_level', 'chemistry_level']),
        subject('Ciencias de la Vida y de la Tierra (SVT)', 'fr_svt', ['biology_level']), subject('Informática (NSI)', 'fr_nsi', ['programming_level']),
        subject('Ciencias Económicas y Sociales (SES)', 'fr_ses', ['economics_level']),
        subject('Historia-Geografía, Geopolítica y Ciencias Políticas (HGGSP)', 'fr_hggsp'),
        subject('Humanidades, Literatura y Filosofía (HLP)', 'fr_hlp', ['writing_level']),
        subject('Lenguas, Literaturas y Culturas Extranjeras (LLCER)', 'fr_llcer', ['writing_level']),
        subject('Ciencias de la Ingeniería', 'fr_ingenieria', ['physics_level']), subject('Artes (especialidad)', 'arte', ['creativity_level']),
        subject('Francés', 'fr_frances', ['writing_level']), subject('Filosofía', 'filosofia'),
        subject('Historia-Geografía', 'historia'), subject('Enseñanza Científica', 'fr_cientifica'), subject('Lengua Extranjera', 'idiomas'),
      ],
    },
    {
      value: 'ensino_secundario_portugues', answer: 'Ensino Secundário português', label: 'Ensino Secundário português', subjectCount: 6, levels: [],
      tracks: ['Ciências e Tecnologias', 'Ciências Socioeconómicas', 'Línguas e Humanidades', 'Artes Visuais'],
      grade: { type: 'slider', min: 0, max: 20, step: 0.1, def: 14, q: '¿Cuál es tu media más reciente del Ensino Secundário (0–20)?', hint: 'Indica la media de tu expediente sobre 20; no hace falta convertirla.' },
      subjects: [
        subject('Portugués', 'pt_portugues', ['writing_level']), subject('Matemática A', 'pt_matematica_a', ['math_level']),
        subject('Matemática B', 'pt_matematica_b', ['math_level']), subject('Matemática Aplicada a las Ciencias Sociales (MACS)', 'pt_macs', ['math_level']),
        subject('Física y Química A', 'pt_fisica_quimica', ['physics_level', 'chemistry_level']),
        subject('Biología y Geología', 'pt_biologia_geologia', ['biology_level']), subject('Economía A', 'pt_economia_a', ['economics_level']),
        subject('Geografía A', 'pt_geografia_a'), subject('Historia A', 'pt_historia_a'), subject('Dibujo A', 'pt_dibujo_a', ['creativity_level']),
        subject('Geometría Descriptiva A', 'pt_geometria', ['creativity_level']), subject('Filosofía', 'filosofia'),
        subject('Lengua Extranjera', 'idiomas'), subject('Educación Física', 'efisica'),
        subject('Aplicaciones Informáticas B', 'pt_informatica', ['programming_level']), subject('Oficina de Artes', 'pt_artes', ['creativity_level']),
      ],
    },
    {
      value: 'otro', answer: 'Otro', label: 'Otro sistema académico', subjectCount: 5, levels: [], tracks: [],
      grade: { type: 'text', q: '¿Cuál es tu nota media y qué escala usa tu colegio?', hint: 'Escribe la nota con su escala, por ejemplo 78/100 o B+. Si aún no tienes una media, puedes omitirla.' },
      subjects: genericSubjects,
    },
  ];

  const data = { systems, genericSubjects };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  if (typeof window !== 'undefined') window.RobinAcademic = data;
})();
