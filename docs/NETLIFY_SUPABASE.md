# Publicación en Netlify y base de datos Supabase

La aplicación está preparada para publicarse como una web estática de Netlify con una Function para `/api/match`. Supabase guarda los datos del billete, las respuestas y las recomendaciones. El catálogo de carreras no se duplica en PostgreSQL: permanece en `lib/careers-data.json` y se despliega junto al motor.

## 1. Crear la base de datos

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. En **SQL Editor**, abre una consulta nueva.
3. Copia y ejecuta todo el archivo `supabase/schema.sql` de este repositorio.
4. En **Table Editor**, confirma que existen `matching_sessions`, `schools`, `school_applications` y `admin_profiles`.

La tabla tiene RLS activado y no concede acceso a `anon` ni a `authenticated`. El navegador no recibe ninguna clave de Supabase: solo la Function de Netlify puede insertar filas.

El SQL crea las tablas y relaciones de los perfiles, pero no inserta cuentas en `auth.users`. Supabase Auth debe crear esas cuentas para que las contraseñas, sesiones y tokens sean válidos. Los tres usuarios Robin se preparan con el script del paso 5; cada usuario de colegio se crea automáticamente cuando Robin aprueba su solicitud y queda asociado a su `school_id`.

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
| `SUPABASE_PUBLISHABLE_KEY` | Sí | Clave `sb_publishable_...` para iniciar sesión |
| `SUPABASE_DB_URL` | Sí | Connection string PostgreSQL de Supabase; se usa solo durante el build |
| `SITE_URL` | Sí | URL pública de Netlify, sin barra final |
| `RESEND_API_KEY` | Sí | Clave de Resend para solicitudes y credenciales |
| `RESEND_FROM` | Sí | Por ejemplo `Project Robin <no-reply@project-robin.com>` |
| `APPLICATION_NOTIFY_EMAIL` | Sí | `hello@project-robin.com` |
| `ROBIN_ADMIN_INITIAL_PASSWORD` | Sí | Contraseña inicial acordada para los tres administradores Robin |
| `ANTHROPIC_API_KEY` | No | Activa el segundo ranking con Claude |
| `ANTHROPIC_MODEL` | No | Modelo; por defecto `claude-haiku-4-5-20251001` |

No añadas estos secretos a `netlify.toml`. `SUPABASE_DB_URL` y `ROBIN_ADMIN_INITIAL_PASSWORD` deben estar disponibles para **Builds**; las claves de Supabase usadas por la aplicación deben estar disponibles para **Functions**. Después de crear o modificar una variable, haz un despliegue nuevo.

## 4. Conectar y desplegar

El repositorio ya incluye `netlify.toml`, por lo que Netlify toma automáticamente:

- Directorio publicado: `robin-airlines-selector`
- Functions: `netlify/functions`
- Ruta pública del motor: `/api/match`
- Comando de build: `npm run deploy:setup`

En Netlify, vincula el repositorio `RobinManuV/Bachelor-Matching-Tool-` y publica. Si el sitio ya estaba vinculado, el push a `main` iniciará el despliegue. El build aplica `supabase/schema.sql`, crea mediante Supabase Auth los accesos que falten y ejecuta `supabase/seed.sql`. El proceso es idempotente: no duplica cuentas ni colegios en despliegues posteriores y no cambia contraseñas de cuentas que ya existan.

## 5. Accesos iniciales

En tu archivo `.env` local añade temporalmente:

```text
ROBIN_ADMIN_INITIAL_PASSWORD=<contraseña inicial acordada>
```

El build crea automáticamente, si no existen, estos accesos:

- `manuel@project-robin.com`, `noel@project-robin.com` y `maria@project-robin.com`, con el valor de `ROBIN_ADMIN_INITIAL_PASSWORD`.
- `colegio.demo@project-robin.com`, asociado a `Colegio Demo`, con contraseña `Robin-Colegio Demo-2027`.

Para ejecutar la misma preparación manualmente desde el proyecto:

```bash
node --env-file=.env scripts/deploy-setup.cjs
```

Las contraseñas se entregan a Supabase Auth y no se guardan en las tablas públicas del proyecto.

El panel estará en `/admin/` y el formulario público para solicitar acceso de colegio en `/colegios/`.

## 6. Comprobar el despliegue

1. Completa un recorrido real desde la URL de Netlify.
2. Confirma que aparecen tres recomendaciones.
3. En Supabase, abre `matching_sessions` y confirma que se ha creado una fila.
4. Revisa que `recommendations` contiene las carreras mostradas y que `recommendation_source` indica `ai` o `fallback`.
5. Envía una solicitud desde `/colegios/`, comprueba el correo en `hello@project-robin.com` y apruébala desde `/admin/`.
6. Accede con el colegio aprobado y verifica que solo aparecen sus alumnos, tres recomendaciones visibles y siete bloqueadas.

Si faltan las variables de Supabase en Netlify, la aplicación devuelve un error y no presenta un resultado que no haya sido guardado.

## Desarrollo local

Copia `.env.example` como `.env`, rellena las credenciales y ejecuta:

```bash
node --env-file=.env server.cjs
```

Sin credenciales, el servidor local permite probar el recomendador, pero no guarda las solicitudes. Esta excepción existe solo para desarrollo; en Netlify la base de datos es obligatoria.

## Privacidad

La tabla contiene datos personales, incluido correo y teléfono. Antes de abrir el formulario al público, define quién puede consultar esos datos, durante cuánto tiempo se conservan y cómo se atienden solicitudes de acceso o borrado. El consentimiento del formulario y su fecha quedan registrados, pero eso no sustituye una política de privacidad revisada para el uso real del servicio.
