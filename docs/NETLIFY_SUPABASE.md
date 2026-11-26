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

En **Netlify → Project configuration → Environment variables**, configura las variables privadas para los scopes indicados. Las claves de servicio y contraseñas deben marcarse como secretas en Netlify.

| Variable | Obligatoria | Valor |
|---|---:|---|
| `SUPABASE_URL` | Sí | URL del proyecto de Supabase |
| `SUPABASE_SECRET_KEY` | Sí | Clave `sb_secret_...` de Supabase; Builds y Functions |
| `SUPABASE_PUBLISHABLE_KEY` | Sí | Clave `sb_publishable_...` para iniciar sesión |
| `SUPABASE_DB_URL` | Sí | Connection string PostgreSQL de Supabase; Builds |
| `SITE_URL` | Sí | `https://project-robin.com/rbmt`, sin barra final |
| `RESEND_API_KEY` | Sí | Clave de Resend para solicitudes y credenciales |
| `RESEND_FROM` | Sí | Por ejemplo `Project Robin <no-reply@project-robin.com>` |
| `APPLICATION_NOTIFY_EMAIL` | Sí | `hello@project-robin.com` |
| `ROBIN_ADMIN_INITIAL_PASSWORD` | Sí | Contraseña de bootstrap de las tres cuentas administrativas Robin; Builds |
| `CRM_BOOTSTRAP_PASSWORD` | Sí | Contraseña inicial privada compartida por las altas del CRM y de colegios; Builds y Functions |
| `ANTHROPIC_API_KEY` | No | Activa el segundo ranking con Claude |
| `ANTHROPIC_MODEL` | No | Modelo; por defecto `claude-haiku-4-5-20251001` |

No añadas estos secretos a `netlify.toml`, a `.env.example` con un valor real, ni al código. Después de crear o modificar una variable, hace falta un despliegue nuevo para que Build y Functions usen la configuración actual.

## 4. Conectar y desplegar

El repositorio ya incluye `netlify.toml`, por lo que Netlify toma automáticamente:

- Directorio publicado: `robin-airlines-selector`
- Functions: `netlify/functions`
- Ruta pública del motor: `/api/match`
- Comando de build: `npm run deploy:setup`

En Netlify, vincula el repositorio `RobinManuV/Bachelor-Matching-Tool-` y publica. Si el sitio ya estaba vinculado, un push a `main` inicia un build. El script aplica `supabase/schema.sql`, prepara los perfiles con `supabase/seed.sql` y asegura las cuentas iniciales.

**El build actual restablece las credenciales de las tres cuentas administrativas Robin a `ROBIN_ADMIN_INITIAL_PASSWORD` y la de la cuenta de demostración a `CRM_BOOTSTRAP_PASSWORD` en cada ejecución.** Comprueba y acepta este comportamiento antes de publicar. El código no cambia automáticamente las contraseñas de los colegios fuera de esa cuenta de demostración. Las altas aprobadas de colegios reciben `CRM_BOOTSTRAP_PASSWORD`; la contraseña se envía al contacto del colegio por correo y Supabase Auth almacena su hash.

## 5. Accesos iniciales

En tu archivo `.env` local añade temporalmente:

```text
ROBIN_ADMIN_INITIAL_PASSWORD=<contraseña inicial acordada>
```

El build crea automáticamente, si no existen, estos accesos:

- `manuel@project-robin.com`, `noel@project-robin.com` y `maria@project-robin.com`, con el valor de `ROBIN_ADMIN_INITIAL_PASSWORD`.
El despliegue prepara tres cuentas administrativas y una cuenta de demostración configuradas en `scripts/deploy-setup.cjs`. `CRM_BOOTSTRAP_PASSWORD` debe estar disponible durante el build y en el entorno de las Functions, con el mismo valor que se usa para las altas de alumnos del CRM. El valor no se publica en Git ni se calcula a partir del nombre del colegio. Si falta o no cumple la política de 8 caracteres y un máximo de 72 bytes UTF-8, el despliegue o la aprobación falla antes de crear el acceso.

Al aprobar un colegio nuevo, Supabase Auth recibe `CRM_BOOTSTRAP_PASSWORD` y almacena el hash. Esta política aplica a las nuevas altas. No migra las contraseñas de los colegios existentes.

Para ejecutar la misma preparación manualmente desde el proyecto:

```bash
node --env-file=.env scripts/deploy-setup.cjs
```

Las contraseñas se entregan a Supabase Auth y no se guardan en las tablas públicas del proyecto.

El panel estará en `/admin/` y el formulario público para solicitar acceso de colegio en `/colegios/`.
En producción se publican bajo `https://project-robin.com/rbmt/` mediante el Worker de Cloudflare descrito en [`infra/cloudflare/README.md`](../infra/cloudflare/README.md). Configura `SITE_URL=https://project-robin.com/rbmt` en Netlify para que los correos de colegios incluyan la URL pública.

## 6. Comprobar el despliegue

1. Completa un recorrido real desde la URL de Netlify.
2. Confirma que aparecen tres recomendaciones.
3. En Supabase, abre `matching_sessions` y confirma que se ha creado una fila.
4. Revisa que `recommendations` contiene las carreras mostradas y que `recommendation_source` indica `ai` o `fallback`.
5. Envía una solicitud desde `/colegios/`, comprueba el correo en `hello@project-robin.com` y apruébala desde `/admin/`.
6. Accede con el colegio aprobado y verifica que solo aparecen sus alumnos y sus diez recomendaciones.

Si faltan las variables de Supabase en Netlify, la aplicación devuelve un error y no presenta un resultado que no haya sido guardado.

## Desarrollo local

Copia `.env.example` como `.env`, rellena las credenciales y ejecuta:

```bash
npm ci
npm run dev
```

Los entornos de desarrollo deben usar un proyecto de datos separado y cuentas de prueba. El panel publicado es [project-robin.com/rbmt/admin/](https://project-robin.com/rbmt/admin/).

Sin credenciales, el servidor local permite probar el recomendador, pero no guarda las solicitudes. Esta excepción existe solo para desarrollo; en Netlify la base de datos es obligatoria.

## Privacidad

`matching_sessions` almacena datos personales, incluido nombre, apellidos, email, teléfono, colegio, ciudad y país de origen, consentimiento, respuestas y recomendaciones. `school_applications` almacena datos de contacto profesional de la solicitud. El acceso de las Functions usa una clave de servidor; RLS no concede acceso de lectura a usuarios `anon` o `authenticated`.

El consentimiento y su fecha quedan registrados, pero eso no sustituye una política de privacidad accesible para el usuario. Este repositorio no define un plazo global de conservación ni un proceso completo de acceso, rectificación y borrado para todas las copias y proveedores. Antes de ampliar el uso público, acuerda esos responsables y procedimientos. La [guía del repositorio público](PUBLIC_REPOSITORY.md) y la [política de seguridad](../SECURITY.md) describen los límites de publicación y reporte.
