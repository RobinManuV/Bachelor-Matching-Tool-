const test = require('node:test');
const assert = require('node:assert/strict');
const { schoolApprovalEmail } = require('../lib/school-approval-email');

test('el correo de aprobación explica el recorrido, enlaza al colegio y escapa datos externos', () => {
  const result = schoolApprovalEmail({
    contactName: 'Lucía <script>',
    schoolName: 'Colegio Horizonte',
    email: 'orientacion@example.com',
    password: 'Robin-Colegio Horizonte-2027',
    matchingUrl: 'https://rbmt.netlify.app/?school=horizonte-abc',
    panelUrl: 'https://rbmt.netlify.app/admin/',
  });
  assert.match(result.html, /diez recomendaciones/);
  assert.match(result.html, /tres opciones explicadas/);
  assert.match(result.html, /href="https:\/\/rbmt\.netlify\.app\/\?school=horizonte-abc"/);
  assert.match(result.html, /Lucía &lt;script&gt;/);
  assert.doesNotMatch(result.html, /Lucía <script>/);
  assert.match(result.html, /src="https:\/\/rbmt\.netlify\.app\/assets\/img\/logo-robin-primary\.png"/);
  assert.match(result.html, /font-family:Champion/);
  assert.match(result.html, /font-family:Almoneda/);
  assert.match(result.html, /font-family:Theinhardt/);
  assert.match(result.text, /Contraseña: Robin-Colegio Horizonte-2027/);
});

test('el correo se envía completamente en el idioma elegido', () => {
  for (const [language, expected] of [
    ['es', ['Tu colegio ya puede volar con Robin', 'Idioma', 'Contraseña:']],
    ['en', ['Your school is ready to fly with Robin', 'HOW TO USE IT WITH YOUR CLASS', 'Password:']],
    ['pt-PT', ['A tua escola já pode voar com o Robin', 'COMO UTILIZAR COM A TUA TURMA', 'Palavra-passe:']],
  ]) {
    const result = schoolApprovalEmail({
      contactName: 'Lucía', schoolName: 'Horizonte', email: 'orientacion@example.com',
      password: 'demo', matchingUrl: 'https://rbmt.netlify.app/?school=demo', panelUrl: 'https://rbmt.netlify.app/admin/', language,
    });
    assert.match(result.html, new RegExp(`<html lang="${language}"`));
    assert.equal(result.subject, expected[0]);
    assert.match(result.html, new RegExp(expected[language === 'es' ? 0 : 1]));
    assert.match(result.text, new RegExp(expected[2]));
  }
  assert.throws(() => schoolApprovalEmail({ language: 'fr' }), /Idioma de correo no válido/);
});
