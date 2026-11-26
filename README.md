# Bachelor Matching Tool

Selector independiente con la experiencia visual de Robin Airlines conectada al motor real de recomendaciones de Project Robin.

## Producción

- [Selector de carreras](https://project-robin.com/rbmt/)
- [Panel de administración](https://project-robin.com/rbmt/admin/), para cuentas autorizadas
- [Solicitud de acceso de colegios](https://project-robin.com/rbmt/colegios/)

Cloudflare sirve el sitio Netlify bajo `/rbmt/` en el dominio público. La [guía de publicación](docs/NETLIFY_SUPABASE.md) describe variables privadas, base de datos y despliegue. Las credenciales se configuran en los entornos privados de Netlify y Supabase.

Requiere Node.js 20 o posterior. Para instalar dependencias y comprobar el código desde la raíz:

```bash
npm ci
npm test
```

El despliegue de Netlify ejecuta `npm run deploy:setup`, que prepara el esquema y los accesos iniciales. Las nuevas altas de colegios usan `CRM_BOOTSTRAP_PASSWORD`, con el mismo valor configurado para las altas de alumnos del CRM; Supabase Auth almacena su hash. Esta política aplica a las altas nuevas; el build restablece las cuentas de bootstrap definidas por el script, incluida la cuenta de demostración. Consulta la [guía de despliegue](docs/NETLIFY_SUPABASE.md) antes de publicar.

La [guía del repositorio público](docs/PUBLIC_REPOSITORY.md) explica el flujo de datos, los límites de seguridad, la licencia y los puntos que hay que revisar antes de compartir el enlace.

## Qué contiene

- `src/questionnaire-data.cjs`: copia íntegra de las definiciones de preguntas del portal en un módulo CommonJS que Netlify puede empaquetar de forma estática. La aplicación usa la ruta bachelor: información general, áreas elegidas y perfil vocacional. El archivo copiado también conserva los bloques de máster de la fuente original.
- `src/academic-systems.cjs`: copia íntegra de los sistemas y niveles académicos del portal.
- `lib/careers-data.json`: copia íntegra del catálogo de 229 carreras y sus variables.
- `lib/careers-recommender.js`: copia íntegra de la puntuación determinista y la preparación de candidatos.
- `lib/career-suggestions.js`: copia íntegra del prompt, uso del feedback, validación de la respuesta de Claude y ranking de respaldo.
- `source-original/anthropic-chat.js`: copia íntegra del conector Claude del portal. El conector ejecutable `lib/anthropic-chat.js` usa la misma petición y modelo mediante `fetch` de Node para que este proyecto no dependa de instalar el SDK.
- `robin-airlines-selector/`: experiencia visual, cuestionario y resultados de Robin Airlines.
- `server.cjs`: sirve Robin Airlines y adapta sus respuestas al formato `questionnaire.blocks` y `questionnaire.signals` usado por el motor.
- `netlify/functions/match.cjs`: versión serverless del endpoint para Netlify.
- `netlify/functions/admin.cjs`: autenticación, alumnos, roles y aprobación de colegios.
- `netlify/functions/school-apply.cjs`: recepción de solicitudes de colegios y aviso por correo.
- `supabase/schema.sql`: tabla, índices y permisos de la base de datos.
- `supabase/seed.sql`: perfiles iniciales de administración.
- `scripts/deploy-setup.cjs`: aplica el SQL y crea en Supabase Auth los accesos iniciales durante el build.
- `docs/NETLIFY_SUPABASE.md`: guía completa de publicación y variables de entorno.

## Flujo

1. El estudiante hace el check-in y elige un área. Se muestra el bloque específico correspondiente dentro del recorrido de Robin Airlines.
2. El servidor valida las respuestas disponibles y construye el perfil y las señales sin inventar las preguntas omitidas por esta versión reducida.
3. El motor puntúa las carreras de las áreas elegidas y limita el catálogo a un máximo de 35 candidatas.
4. Claude recibe el perfil y las candidatas preseleccionadas, y devuelve hasta diez carreras. Si no hay clave o falla la llamada, se usa el ranking determinista.
5. La solicitud, el consentimiento, las respuestas y las recomendaciones se guardan en Supabase. La interfaz muestra las tres mejores con información real del catálogo y enlaces oficiales.

## Panel de administración

- `/admin/`: acceso para Robin y colegios aprobados.
- `/colegios/`: formulario de solicitud para nuevos colegios.
- Robin puede consultar todas las respuestas, las diez recomendaciones y gestionar solicitudes.
- Cada colegio recibe un enlace propio para sus alumnos. Solo puede consultar las sesiones asociadas a ese enlace y sus diez recomendaciones. El alumno ve las tres mejores al terminar el cuestionario.

El campo de sistema y asignaturas se recoge y valida como en el portal. El recomendador actual no lo incluye en el prompt ni en la fórmula: se conserva para que el formulario sea fiel al original.

Para ejecutar las comprobaciones: `npm test`.

## Leads del recomendador

Cada envío queda en `matching_sessions` de RBMT. Si su correo aún no existe en el CRM de Project Robin, se crea un lead con origen «Página web» y campaña «Recomendador». La ficha del lead consulta en RBMT el número de envíos y enlaza el último test; repetir el formulario no modifica el lead existente.

La importación histórica es una operación administrativa explícita. Usa credenciales privadas del entorno autorizado y revisa primero el resultado de la simulación:

```bash
npm run backfill:crm             # simulación sin escrituras
npm run backfill:crm -- --apply  # crea solo los correos ausentes
```

El script toma el envío más reciente de cada correo, conserva su fecha original y comprueba tanto `crm_leads` como `crm_future_leads`. Los formularios anteriores a la pregunta del curso quedan sin ese dato.

## Netlify y Supabase

La configuración de Netlify ya forma parte del repositorio. Para crear la base de datos y añadir los secretos necesarios, sigue [`docs/NETLIFY_SUPABASE.md`](docs/NETLIFY_SUPABASE.md).

## Licencia y reutilización

Este repositorio es público, pero **no está publicado bajo una licencia de código abierto**. Consulta [`LICENSE`](LICENSE) y la [guía de derechos y reutilización](docs/PUBLIC_REPOSITORY.md#licencia-y-reutilización). GitHub permite ver y bifurcar repositorios públicos; eso no concede una licencia general para reutilizar el código fuera de la plataforma. Los assets de terceros pueden tener términos distintos.

Para reportar un problema de seguridad, consulta [`SECURITY.md`](SECURITY.md); no uses una incidencia pública para enviar credenciales, datos de alumnos o detalles de vulnerabilidades sin corregir.
