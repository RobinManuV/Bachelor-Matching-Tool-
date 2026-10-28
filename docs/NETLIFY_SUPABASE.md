# Publicación en Netlify y base de datos Supabase

La aplicación está preparada para publicarse como una web estática de Netlify con una Function para `/api/match`. Supabase guarda los datos del billete, las respuestas y las recomendaciones. El catálogo de carreras no se duplica en PostgreSQL: permanece en `lib/careers-data.json` y se despliega junto al motor.

## 1. Crear la base de datos

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. En **SQL Editor**, abre una consulta nueva.
3. Copia y ejecuta todo el archivo `supabase/schema.sql` de este repositorio.
4. En **Table Editor**, confirma que existe `public.matching_sessions`.

La tabla tiene RLS activado y no concede acceso a `anon` ni a `authenticated`. El navegador no recibe ninguna clave de Supabase: solo la Function de Netlify puede insertar filas.

## 2. Obtener las credenciales

En el proyecto de Supabase, abre **Settings → API Keys** y copia:

- La URL del proyecto, con formato `https://xxxxxxxx.supabase.co`.
- Una **Secret key** nueva, con formato `sb_secret_...`.

No uses una publishable key para el servidor y no pongas la Secret key en JavaScript del navegador, en variables `VITE_...` ni en el repositorio.

## 3. Variables de entorno de Netlify

En **Netlify → Project configuration → Environment variables**, crea estas variables con alcance para **Functions**:

| Variable | Obligatoria | Valor |
|---|---:|---|
| `SUPABASE_URL` | Sí | URL del proyecto de Supabase |
| `SUPABASE_SECRET_KEY` | Sí | Clave `sb_secret_...` de Supabase |
| `ANTHROPIC_API_KEY` | No | Activa el segundo ranking con Claude |
| `ANTHROPIC_MODEL` | No | Modelo; por defecto `claude-haiku-4-5-20251001` |

No añadas estos secretos a `netlify.toml`: Netlify no expone a las Functions las variables declaradas allí. Después de crear o modificar una variable, haz un despliegue nuevo.

## 4. Conectar y desplegar

El repositorio ya incluye `netlify.toml`, por lo que Netlify toma automáticamente:

- Directorio publicado: `robin-airlines-selector`
- Functions: `netlify/functions`
- Ruta pública del motor: `/api/match`

En Netlify, vincula el repositorio `RobinManuV/Bachelor-Matching-Tool-`, deja vacío el comando de build y publica. Si el sitio ya estaba vinculado, el push a `main` iniciará el despliegue.

## 5. Comprobar el despliegue

1. Completa un recorrido real desde la URL de Netlify.
2. Confirma que aparecen tres recomendaciones.
3. En Supabase, abre `matching_sessions` y confirma que se ha creado una fila.
4. Revisa que `recommendations` contiene las carreras mostradas y que `recommendation_source` indica `ai` o `fallback`.

Si faltan las variables de Supabase en Netlify, la aplicación devuelve un error y no presenta un resultado que no haya sido guardado.

## Desarrollo local

Copia `.env.example` como `.env`, rellena las credenciales y ejecuta:

```bash
node --env-file=.env server.cjs
```

Sin credenciales, el servidor local permite probar el recomendador, pero no guarda las solicitudes. Esta excepción existe solo para desarrollo; en Netlify la base de datos es obligatoria.

## Privacidad

La tabla contiene datos personales, incluido correo y teléfono. Antes de abrir el formulario al público, define quién puede consultar esos datos, durante cuánto tiempo se conservan y cómo se atienden solicitudes de acceso o borrado. El consentimiento del formulario y su fecha quedan registrados, pero eso no sustituye una política de privacidad revisada para el uso real del servicio.
