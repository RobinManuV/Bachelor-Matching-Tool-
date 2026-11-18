const { escapeHtml } = require('./admin-access');

const copy = {
  es: {
    subject: 'Tu colegio ya puede volar con Robin', label: 'COLEGIOS A BORDO · ACCESO APROBADO',
    title: 'Un rumbo más claro para cada alumno.', hello: 'Hola', welcome: 'El acceso de',
    intro: 'ya está listo. Sabemos que orientar a una clase entera exige conocer a cada estudiante. Robin te ayuda a iniciar esa conversación con información concreta.',
    purpose: 'En unos minutos, cada alumno responde a preguntas sobre sus asignaturas, intereses y planes. El recomendador compara sus respuestas con grados reales y le muestra',
    three: 'tres opciones explicadas', panelPurpose: 'En tu panel puedes consultar sus respuestas y',
    ten: 'las diez recomendaciones', perStudent: 'de cada alumno de tu colegio.',
    how: 'CÓMO USARLO CON TU CLASE', step1: 'Comparte el enlace de alumnos',
    step1Body: 'en clase o por correo. Su acceso queda asociado a', step2: 'Deja que hagan su vuelo.',
    step2Body: 'Cada estudiante completa el cuestionario y explora sus tres destinos principales.',
    step3: 'Abre el panel.', step3Body: 'Revisa las respuestas y diez opciones para preparar conversaciones de orientación más personales.',
    access: 'TU ACCESO AL PANEL', user: 'Usuario', password: 'Contraseña', open: 'Abrir panel del colegio →',
    share: 'Enlace para compartir con tus alumnos',
    linkNote: 'Usa este enlace específico para que sus respuestas aparezcan únicamente en el panel de tu colegio. Las recomendaciones son orientación, no una decisión de admisión.',
    help: '¿Necesitas ayuda? Escríbenos a hello@project-robin.com.',
  },
  en: {
    subject: 'Your school is ready to fly with Robin', label: 'SCHOOLS ON BOARD · ACCESS APPROVED',
    title: 'A clearer direction for every student.', hello: 'Hello', welcome: 'Access for',
    intro: 'is ready. Guiding a whole class means understanding each student. Robin helps you start that conversation with concrete information.',
    purpose: 'In a few minutes, each student answers questions about their subjects, interests and plans. The recommender compares their answers with real degrees and shows them',
    three: 'three explained options', panelPurpose: 'In your dashboard, you can review their answers and',
    ten: 'all ten recommendations', perStudent: 'for every student at your school.',
    how: 'HOW TO USE IT WITH YOUR CLASS', step1: 'Share the student link',
    step1Body: 'in class or by email. Responses are linked to', step2: 'Let them take the flight.',
    step2Body: 'Each student completes the questionnaire and explores their top three destinations.',
    step3: 'Open the dashboard.', step3Body: 'Review answers and ten options to prepare more personal guidance conversations.',
    access: 'YOUR DASHBOARD ACCESS', user: 'Username', password: 'Password', open: 'Open school dashboard →',
    share: 'Link to share with your students',
    linkNote: 'Use this school-specific link so their responses appear only in your school dashboard. Recommendations are guidance, not an admissions decision.',
    help: 'Need help? Write to us at hello@project-robin.com.',
  },
  'pt-PT': {
    subject: 'A tua escola já pode voar com o Robin', label: 'ESCOLAS A BORDO · ACESSO APROVADO',
    title: 'Um rumo mais claro para cada aluno.', hello: 'Olá', welcome: 'O acesso de',
    intro: 'já está pronto. Orientar uma turma inteira exige conhecer cada aluno. O Robin ajuda-te a iniciar essa conversa com informação concreta.',
    purpose: 'Em poucos minutos, cada aluno responde a perguntas sobre disciplinas, interesses e planos. O recomendador compara as respostas com cursos reais e apresenta',
    three: 'três opções explicadas', panelPurpose: 'No teu painel, podes consultar as respostas e',
    ten: 'as dez recomendações', perStudent: 'de cada aluno da tua escola.',
    how: 'COMO UTILIZAR COM A TUA TURMA', step1: 'Partilha o link dos alunos',
    step1Body: 'na aula ou por email. As respostas ficam associadas a', step2: 'Deixa-os fazer o voo.',
    step2Body: 'Cada aluno completa o questionário e explora os seus três destinos principais.',
    step3: 'Abre o painel.', step3Body: 'Consulta as respostas e dez opções para preparar conversas de orientação mais pessoais.',
    access: 'O TEU ACESSO AO PAINEL', user: 'Utilizador', password: 'Palavra-passe', open: 'Abrir painel da escola →',
    share: 'Link para partilhar com os teus alunos',
    linkNote: 'Usa este link específico para que as respostas apareçam apenas no painel da tua escola. As recomendações são orientação, não uma decisão de admissão.',
    help: 'Precisas de ajuda? Escreve-nos para hello@project-robin.com.',
  },
};

function schoolApprovalEmail({ contactName, schoolName, email, password, matchingUrl, panelUrl, language = 'es' }) {
  if (!Object.hasOwn(copy, language)) throw new Error('Idioma de correo no válido');
  const t = copy[language];
  const name = escapeHtml(contactName);
  const school = escapeHtml(schoolName);
  const user = escapeHtml(email);
  const secret = escapeHtml(password);
  const studentLink = escapeHtml(matchingUrl);
  const dashboardLink = escapeHtml(panelUrl);
  const assetBase = new URL('../', panelUrl);
  const logoUrl = escapeHtml(new URL('assets/img/logo-robin-primary.png', assetBase).href);
  const displayFontUrl = escapeHtml(new URL('admin/fonts/oswald-latin.woff2', assetBase).href);
  const subtitleFontUrl = escapeHtml(new URL('admin/fonts/bodonimoda-latin.woff2', assetBase).href);
  const textFontUrl = escapeHtml(new URL('admin/fonts/archivo-latin.woff2', assetBase).href);
  const subject = t.subject;
  const html = `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title>
<style>@font-face{font-family:'Robin Display';src:url('${displayFontUrl}') format('woff2')}@font-face{font-family:'Robin Subtitle';src:url('${subtitleFontUrl}') format('woff2')}@font-face{font-family:'Robin Text';src:url('${textFontUrl}') format('woff2')}</style></head>
<body style="margin:0;padding:0;background:#fefbe5;color:#2d3a64;font-family:Theinhardt,'Robin Text',Arial,Helvetica,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fefbe5;font-family:Theinhardt,'Robin Text',Arial,Helvetica,sans-serif"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;background:#fffdf8;border:1px solid #dfded2;border-radius:18px;overflow:hidden;color:#2d3a64;font-family:Theinhardt,'Robin Text',Arial,Helvetica,sans-serif">
<tr><td style="background:#fefbe5;padding:14px 34px;border-bottom:3px solid #ecb450"><img src="${logoUrl}" width="102" height="83" alt="Project Robin" style="display:block;width:102px;height:83px;object-fit:contain;border:0;color:#2d3a64;font-size:16px;font-weight:bold"></td></tr>
<tr><td style="padding:35px 34px 12px">
<p style="margin:0 0 12px;color:#875800;font-family:Champion,'Robin Display',Impact,Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px">${t.label}</p>
<h1 style="margin:0 0 20px;font-family:Champion,'Robin Display',Impact,Arial,sans-serif;font-size:36px;line-height:1.1;font-weight:700;color:#2d3a64">${t.title}</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6">${t.hello} ${name},</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${t.welcome} <strong>${school}</strong> ${t.intro}</p>
<p style="margin:0;font-size:16px;line-height:1.6">${t.purpose} <strong>${t.three}</strong>. ${t.panelPurpose} <strong>${t.ten}</strong> ${t.perStudent}</p>
</td></tr>
<tr><td style="padding:17px 34px 8px">
<p style="margin:0 0 15px;font-family:Almoneda,'Robin Subtitle',Georgia,serif;font-size:18px;font-weight:bold;color:#2d3a64">${t.how}</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td valign="top" style="width:36px;padding:0 0 17px;font-size:22px;font-weight:bold;color:#875800">01</td><td style="padding:0 0 17px;font-size:15px;line-height:1.5"><strong>${t.step1}</strong> ${t.step1Body} ${school}.</td></tr>
<tr><td valign="top" style="width:36px;padding:0 0 17px;font-size:22px;font-weight:bold;color:#875800">02</td><td style="padding:0 0 17px;font-size:15px;line-height:1.5"><strong>${t.step2}</strong> ${t.step2Body}</td></tr>
<tr><td valign="top" style="width:36px;padding:0 0 2px;font-size:22px;font-weight:bold;color:#875800">03</td><td style="padding:0 0 2px;font-size:15px;line-height:1.5"><strong>${t.step3}</strong> ${t.step3Body}</td></tr>
</table>
</td></tr>
<tr><td style="padding:23px 34px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#d6e9fa;border:1px solid #b4cde3;border-radius:12px"><tr><td style="padding:21px 22px">
<p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px">${t.access}</p>
<p style="margin:0 0 5px;font-size:14px">${t.user}: <strong>${user}</strong></p>
<p style="margin:0 0 18px;font-size:14px">${t.password}: <strong>${secret}</strong></p>
<a href="${dashboardLink}" style="display:inline-block;padding:13px 19px;border-radius:8px;background:#2d3a64;color:#fefbe5;font-size:14px;font-weight:bold;text-decoration:none">${t.open}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 34px 32px">
<p style="margin:0 0 7px;font-size:13px;font-weight:bold">${t.share}</p>
<p style="margin:0 0 9px;font-size:14px;line-height:1.5;overflow-wrap:anywhere"><a href="${studentLink}" style="color:#2e4c8a;text-decoration:underline">${studentLink}</a></p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#52618a">${t.linkNote}</p>
</td></tr>
<tr><td style="padding:19px 34px;background:#efe9da;color:#52618a;font-size:12px;line-height:1.5">Project Robin · The world is your campus<br>${t.help}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${subject}

${t.hello} ${contactName}:

${t.welcome} ${schoolName} ${t.intro}
${t.purpose} ${t.three}. ${t.panelPurpose} ${t.ten} ${t.perStudent}

${t.how}:
1. ${t.step1}: ${matchingUrl}
2. ${t.step2} ${t.step2Body}
3. ${t.step3} ${t.step3Body}

${t.access}: ${panelUrl}
${t.user}: ${email}
${t.password}: ${password}

${t.linkNote}
${t.help}
Project Robin · The world is your campus`;
  return { subject, html, text };
}

module.exports = { schoolApprovalEmail };
