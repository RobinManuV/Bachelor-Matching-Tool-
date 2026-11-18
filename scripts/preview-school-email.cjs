const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { schoolApprovalEmail } = require('../lib/school-approval-email');

for (const language of ['es', 'en', 'pt-PT']) {
  const preview = schoolApprovalEmail({
    contactName: 'Lucía García',
    schoolName: 'Colegio Horizonte',
    email: 'orientacion@colegio-horizonte.es',
    password: 'Robin-Colegio Horizonte-2027',
    matchingUrl: 'https://rbmt.netlify.app/?school=colegio-horizonte-EJEMPLO',
    panelUrl: 'https://rbmt.netlify.app/admin/',
    language,
  });
  const output = join(__dirname, '..', `preview-school-approval-${language}.html`);
  const localHtml = preview.html
    .replaceAll('https://rbmt.netlify.app/assets/img/logo-robin-primary.png', 'robin-airlines-selector/assets/img/logo-robin-primary.png')
    .replaceAll('https://rbmt.netlify.app/admin/fonts/', 'robin-airlines-selector/admin/fonts/');
  writeFileSync(output, localHtml);
  if (language === 'es') writeFileSync(join(__dirname, '..', 'preview-school-approval.html'), localHtml);
  console.log(output);
}
