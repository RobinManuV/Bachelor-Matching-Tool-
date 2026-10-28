# Bachelor Matching Tool

Selector independiente con la experiencia visual de Robin Airlines conectada al motor real de recomendaciones de Project Robin.

## Cómo ejecutarlo

Requiere Node.js 20 o posterior. No necesita instalar paquetes.

```bash
cd "Bachelor Matching Tool"
node server.cjs
```

Abre `http://localhost:3000`. Sin clave de Anthropic, el formulario y el recomendador funcionan con el ranking determinista de respaldo. Para activar Claude:

```bash
ANTHROPIC_API_KEY=tu_clave node server.cjs
```

Se puede cambiar el modelo con `ANTHROPIC_MODEL` y el puerto con `PORT`. Para cargar también la conexión local a Supabase, copia `.env.example` como `.env` y ejecuta `node --env-file=.env server.cjs`.

## Qué contiene

- `src/questionnaire-data.mjs`: copia íntegra de las definiciones de preguntas del portal, renombrada de `.js` a `.mjs` para que Node pueda cargarla sin compilador. La aplicación usa la ruta bachelor: información general, áreas elegidas y perfil vocacional. El archivo copiado también conserva los bloques de máster de la fuente original.
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
- `supabase/seed.sql`: colegio y perfiles iniciales, sin alumnos ficticios.
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
- Cada colegio recibe un enlace propio para sus alumnos. Solo puede consultar las sesiones asociadas a ese enlace y recibe tres recomendaciones; las siete restantes no se envían al navegador.

El campo de sistema y asignaturas se recoge y valida como en el portal. El recomendador actual no lo incluye en el prompt ni en la fórmula: se conserva para que el formulario sea fiel al original.

Para ejecutar las comprobaciones: `npm test`.

## Netlify y Supabase

La configuración de Netlify ya forma parte del repositorio. Para crear la base de datos y añadir los secretos necesarios, sigue [`docs/NETLIFY_SUPABASE.md`](docs/NETLIFY_SUPABASE.md).
