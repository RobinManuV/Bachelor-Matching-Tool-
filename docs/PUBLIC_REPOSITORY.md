# Guía del repositorio público

Esta guía explica el selector de carreras, su entorno de producción y los límites de uso para quienes lleguen al repositorio desde GitHub o LinkedIn.

## Estado para difusión

La documentación describe el producto y sus límites, pero no certifica los derechos de cada recurso visual ni la política legal de privacidad. Antes de promover el repositorio, verifica las fotos, ilustraciones, tipografías y marcas incluidas, y publica una política de privacidad adecuada al uso real.

## Qué es este proyecto

RBMT es un selector de carreras de Project Robin. La interfaz plantea el cuestionario como un viaje y consulta el motor de recomendaciones mediante Netlify Functions. Producción se sirve en [project-robin.com/rbmt](https://project-robin.com/rbmt/), con un panel administrativo y una ruta para que los colegios soliciten acceso.

El repositorio contiene el cliente, el servidor, la lógica de recomendación, el catálogo de carreras, las Functions y el esquema de Supabase. No incluye acceso a cuentas, CRM, correo, proveedor de IA ni base de datos solo por ser público.

## Funcionamiento y datos

1. El alumno completa información de contacto, origen, colegio, consentimiento, área de interés y respuestas académicas/vocacionales.
2. La Function valida las respuestas y calcula recomendaciones usando el catálogo. Puede consultar el proveedor de IA configurado o usar el ranking determinista de respaldo.
3. Las respuestas, el consentimiento y las recomendaciones se guardan en `matching_sessions` de Supabase; la interfaz muestra las tres recomendaciones principales.
4. Los colegios aprobados acceden a las sesiones vinculadas a su código. El equipo Robin puede consultar y administrar el conjunto.

Los datos tratados incluyen nombre, apellidos, email, teléfono, colegio, ciudad y país de origen, consentimiento, respuestas del cuestionario y recomendaciones. Supabase Auth gestiona las credenciales; el navegador no recibe la clave de servicio. La sección [Privacidad](NETLIFY_SUPABASE.md#privacidad) de la guía de operación diferencia estas notas de implementación de una política legal de privacidad para usuarios.

No se documenta en este repositorio un plazo de conservación completo ni un proceso exhaustivo de ejercicio de derechos para todos los sistemas conectados. No afirmes que la mera configuración técnica constituye por sí sola cumplimiento legal.

## Cuenta inicial de colegios

Las nuevas cuentas de colegio reciben como contraseña inicial el valor de `CRM_BOOTSTRAP_PASSWORD`, la misma variable de entorno que utiliza el flujo CRM de altas de alumnos. Supabase Auth recibe la contraseña y guarda su hash. El valor no debe escribirse en el repositorio, en README, en ejemplos ni en una publicación.

Es una contraseña inicial compartida por las nuevas cuentas que usen esa configuración, no una clave única por colegio. La variable debe existir en el entorno privado de Netlify para el build y las Functions. Este cambio aplica a cuentas nuevas; no cambia automáticamente las credenciales de colegios ya existentes.

La guía de [Netlify y Supabase](NETLIFY_SUPABASE.md) cubre la configuración. El `deploy-setup` también prepara las cuentas iniciales definidas en su código; comprueba esa implementación antes de volver a desplegar porque el proceso establece las contraseñas de esas cuentas a partir de las variables configuradas.

## Seguridad y operación

- No añadas secretos, datos de clientes, exports, capturas de cuentas reales ni copias de producción al repositorio.
- Usa proyectos separados para desarrollo y producción; no ejecutes herramientas administrativas de producción como si fueran fixtures de prueba.
- La configuración se describe en [`docs/NETLIFY_SUPABASE.md`](NETLIFY_SUPABASE.md); los valores privados pertenecen a Netlify y Supabase.
- Para reportar una vulnerabilidad de forma privada, sigue [`SECURITY.md`](../SECURITY.md).
- La [documentación de Cloudflare](../infra/cloudflare/README.md) explica la ruta pública `/rbmt/`.

## Pruebas y desarrollo

Requiere Node.js 20 o posterior:

```bash
npm ci
npm test
```

El test suite no necesita conectarse a producción. Los comandos administrativos y de importación se documentan por separado y pueden realizar escrituras cuando se ejecutan con `--apply`.

## Licencia y reutilización

Este repositorio no tiene una licencia de código abierto como MIT, Apache-2.0, GPL o AGPL. El archivo [`LICENSE`](../LICENSE) reserva los derechos de los titulares correspondientes y no autoriza reutilización general. Los componentes y assets de terceros conservan sus propios términos.

Un repositorio público permite a otros usuarios ver y bifurcarlo dentro de GitHub según los términos de la plataforma. Eso no equivale a una licencia abierta para reutilizar el código fuera de GitHub. “Todos los derechos reservados” no bloquea técnicamente forks mientras el repositorio siga siendo público. Consulta [licenciar un repositorio](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) y los [Términos de GitHub, sección 5](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#5-license-grant-to-other-users).

| Tipo de licencia/política | Qué permite normalmente | ¿Evita que copien el código? |
|---|---|---|
| Sin licencia / todos los derechos reservados | No concede permisos generales de reutilización fuera de los derechos limitados de GitHub y los permitidos por ley. | Es la opción más restrictiva, pero no bloquea la visualización ni los forks que GitHub permite para repositorios públicos. |
| MIT o BSD | Copiar, modificar, distribuir e incluso usar comercialmente, conservando avisos y licencia. | No. Son licencias permisivas. |
| Apache-2.0 | Reutilizar y redistribuir, con avisos, condiciones y concesión de patentes. | No. Permite reutilización, incluso comercial, bajo sus condiciones. |
| GPL-3.0 o AGPL-3.0 | Copiar, modificar y distribuir bajo copyleft; la AGPL añade obligaciones para ciertos usos de versiones modificadas por red. | No. Exigen condiciones para distribuir/operar derivados; no prohíben copiarlos. |

La selección final depende de quién posee los derechos y qué usos se quieren conceder. No cambies a una licencia abierta sin confirmar esos derechos y revisar por separado los assets de terceros.

## Antes de enlazarlo en LinkedIn

- Revisa el contenido actual y el historial Git, no solo los archivos de `main`.
- Confirma el consentimiento y licencia de logos, fotos, fuentes, ilustraciones y recursos del selector.
- No pegues la contraseña inicial ni variables privadas en el post.
- Comprueba que los mensajes describan un repositorio propietario y un producto con rutas autenticadas, sin prometer acceso público a datos o cuentas.

Una descripción factual puede presentar RBMT como el selector de carreras conectado al recomendador de Project Robin. No lo describas como “open source”, como libre para copiar, ni prometas acceso al panel, al CRM o a datos de producción.

Esta guía no concede derechos sobre marcas, fotografías u otros recursos incluidos en el proyecto.
