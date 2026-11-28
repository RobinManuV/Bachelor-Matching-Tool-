# Diseño: recomendador de carreras para iOS

## Intención

Crear una app iOS nativa, construida en Xcode, dedicada a ayudar a cada estudiante a explorar carreras de bachelor y revisar sus recomendaciones a lo largo del tiempo. El perfil reúne todos sus cuestionarios, resultados y opiniones; el recomendador usa ese historial personal para preparar una nueva propuesta. La experiencia debe ofrecer utilidad recurrente y funciones nativas, no limitarse a presentar el sitio actual dentro de una app.

La app es un producto independiente llamado **RobinRecomendator**. El nombre visible bajo su icono es **Rbmt**. Conserva la identidad visual de Robin y usa la avioneta como marca, con navegación y controles nativos que la hacen reconocible como una app de orientación propia.

## Objetivos

- Permitir crear una cuenta e iniciar sesión desde iPhone.
- Completar el cuestionario de orientación profesional y recibir carreras compatibles del catálogo existente.
- Guardar en el perfil cada cuestionario, resultado y fecha, y poder consultar el historial completo.
- Valorar las carreras recomendadas y añadir una opinión breve sobre por qué encajan o no.
- Usar las respuestas y valoraciones anteriores de esa misma persona al generar nuevas recomendaciones.
- Mejorar recomendaciones para todas las personas a partir de patrones agregados de opiniones de la comunidad, incluidos los votos y señales anónimas extraídas de comentarios.
- Mantener los datos personales y el historial privados para cada cuenta.
- Construir una experiencia iOS coherente y sustancial, con navegación nativa, perfil e historial accesibles.

## Fuera de alcance

- Herramientas de selección de aerolíneas, CRM, administración de colegios, solicitudes institucionales y paneles internos.
- Recoger leads comerciales, teléfono, colegio o ubicación como requisito para recomendar.
- Sustituir o volver a crear el catálogo y el algoritmo de recomendación, salvo los cambios necesarios para aceptar señales personales.
- Prometer la aprobación de Apple: la decisión de App Review depende de la app completa y de su evaluación.

## Criterio de producto y regla 4.2

Apple describe la regla 4.2 como la necesidad de que la app incluya funciones, contenido e interfaz que aporten más que un sitio web empaquetado. La cuenta con historial personal, valoración de resultados y recomendaciones sucesivas forma el ciclo de uso principal. La implementación debe hacer esas tareas en pantallas y controles nativos y mantener una experiencia útil después del primer cuestionario; el cumplimiento no se puede garantizar solo por añadir un perfil.

## Estado actual y restricciones

- El repositorio tiene un catálogo de 229 programas bachelor, un motor de ranking determinista y una capa que puede añadir recomendaciones con Claude.
- El backend está en Node/Netlify y usa Supabase. Guarda cuestionarios y resultados en `matching_sessions`; `recommendation_feedback` almacena valoraciones asociadas a una sesión.
- Las sesiones actuales están orientadas al flujo de leads y al panel administrativo. No existe una cuenta de estudiante ni una consulta de historial personal.
- La adaptación histórica actual consulta feedback por área. El nuevo flujo combina por separado la historia privada de la persona con patrones comunitarios agregados por área y carrera.
- Los comentarios originales quedan privados; solo señales derivadas se incorporan a agregados cuando hay al menos cinco participantes distintos.
- La persona podrá importar sesiones antiguas si inicia sesión con el mismo correo verificado. Antes de asociarlas se mostrarán las sesiones coincidentes para que confirme la importación; nunca se reclamarán en segundo plano.
- No hay actualmente un proyecto Xcode/Swift en el repositorio. La app iOS será un cliente SwiftUI nuevo, conectado a servicios del backend existentes o ampliados.
- Mantener intactos los recorridos web y administrativos ya desplegados; los cambios de backend deben ser compatibles o introducir rutas/tablas específicas para estudiantes.

## Experiencia principal

1. La persona crea una cuenta o inicia sesión y llega a su inicio, que muestra su última recomendación y acceso al historial. Si existen sesiones con su correo verificado, puede revisarlas y confirmar cuáles importar.
2. Completa el cuestionario de bachelor. Puede elegir áreas y responder preguntas generales, específicas y vocacionales.
3. Recibe una lista de carreras recomendadas con compatibilidad, explicación y datos del catálogo.
4. Guarda una valoración por carrera y, si quiere, escribe una opinión breve. Puede volver a cambiarla desde el resultado o el historial.
5. Desde el perfil revisa sesiones anteriores y el feedback guardado. Inicia una nueva recomendación y el sistema considera el historial personal disponible, explica que está usando sus preferencias anteriores y ofrece resultados nuevos.
6. Desde ajustes, puede cerrar sesión y solicitar la eliminación de su cuenta y datos asociados.

## Datos y comportamiento

- Cada estudiante tiene una identidad de Supabase Auth y un perfil mínimo asociado.
- Cada sesión pertenece a una sola cuenta e incluye respuestas, programa/carreras recomendadas, fecha y fuente del recomendador.
- Cada valoración pertenece a una sesión y programa, con decisión (por ejemplo, me interesa / no encaja) y comentario opcional con límite de longitud.
- La generación combina el cuestionario y el historial propio con estadísticas de opiniones comunitarias agrupadas por área y carrera. No consulta ni expone comentarios originales o identificadores de otras cuentas.
- La persistencia se confirma en servidor antes de mostrar una sesión como guardada. Si falla, la app informa del fallo y permite reintentar sin duplicar la sesión.
- El estudiante puede leer solo sus propios registros. La clave de servicio de Supabase nunca se incluye en la app. Las rutas de estudiante verifican el token de acceso y la propiedad de cada registro; la base de datos aplica RLS donde corresponda.
- El nuevo flujo no exige los campos de contacto comercial del `lead` actual. El consentimiento y el aviso de privacidad se presentan antes de guardar respuestas personales.
- La app se dirige también a menores. El registro pide solo los datos necesarios; el flujo aplica la edad y el mecanismo de autorización que correspondan en cada territorio de distribución, y permite consentimiento verificable de padre, madre o tutor cuando sea requerido. La elegibilidad no se basará en una edad global fija.
- Debe existir una política de privacidad accesible en la app y en la ficha de App Store, con usos, destinatarios, conservación, retirada del consentimiento y eliminación de datos claramente descritos.

## Identidad y experiencia visual

- Nombre del producto y del target de Xcode: **RobinRecomendator**; etiqueta bajo el icono: **Rbmt**.
- La avioneta existente de Robin es el símbolo principal y debe aparecer en el icono y puntos de bienvenida. El diseño toma la paleta existente (`#213765`, `#FEB546`, `#FBF7EC`) y motivos de ruta/vuelo con moderación.
- La app usa navegación iOS nativa (barra inferior, navegación de detalle, formularios, controles, sheets y estados seguros), adaptación a safe areas, accesibilidad y gestos del sistema. No usa WKWebView como experiencia principal.
- Las pantallas usan una jerarquía y componentes propios para recomendación de carreras; no reutilizan el selector de aerolíneas como si fuera la app nueva.

## Enfoques considerados

1. **SwiftUI con cuenta e historial sincronizado (seleccionado).** App iOS nativa que consume el motor actual mediante una API autenticada, con almacenamiento privado por estudiante en Supabase. Mantiene un único motor de recomendaciones y permite consultar el perfil en varios dispositivos. Requiere una capa de identidad, endpoints y autorización por usuario.
2. **SwiftUI con perfil solo local.** Persiste respuestas y feedback en el iPhone. Reduce cambios del servidor, pero no ofrece historial sincronizado y deja las recomendaciones sin la historia completa cuando se cambia de dispositivo.
3. **Envolver la web actual con WKWebView.** Reduce tiempo inicial, pero entrega principalmente la misma web y no realiza el objetivo de una app nativa con perfil persistente; además, es un caso débil para la regla 4.2.

Se selecciona el enfoque 1 porque el usuario eligió un perfil con cuenta y porque el historial personal es el elemento central de utilidad continua.

## Restricciones

- Xcode y SwiftUI son la plataforma y el marco requeridos para el cliente iOS.
- Reutilizar el catálogo y el motor de carrera existentes en el servidor; no duplicar la puntuación en Swift.
- Usar Supabase Auth y el backend Node/Netlify existente, salvo que la inspección de implementación demuestre una incompatibilidad concreta.
- Aislar y proteger el historial de cada estudiante; los roles administrativos actuales no equivalen a cuentas de estudiante.
- La interfaz y la persistencia del perfil deben funcionar como partes principales de la app, no como enlaces a páginas web.

## Decisiones para quien implemente

- Elegir el mecanismo de acceso más simple y mantenible con Supabase para iOS (incluido inicio de sesión con Apple si se habilita), sin bloquear el diseño del perfil.
- Definir los territorios iniciales de App Store y validar allí el mecanismo de consentimiento para menores antes de publicar; la edad y los requisitos varían por jurisdicción.
- Elegir contratos concretos de API y tablas/migraciones manteniendo compatibilidad con sesiones históricas y con el sitio actual.
- Definir paginación del historial, estados de carga/error, accesibilidad, soporte de modo oscuro y localización a partir de los patrones existentes.
- Acotar la longitud y moderación del texto libre y definir cómo un feedback editado afecta a nuevas recomendaciones.
- Añadir las capacidades, identificadores, configuración de firma y archivos de proyecto necesarios en Xcode sin incluir secretos.
- Preparar la información de privacidad y revisión de App Store que corresponda a los datos realmente recogidos.

## Señales de éxito

- Una cuenta nueva completa el cuestionario, recibe resultados y encuentra la sesión en su perfil después de cerrar y volver a iniciar sesión.
- Una valoración y comentario guardados aparecen en el historial y afectan a una nueva generación para esa misma cuenta.
- Una segunda cuenta no puede leer las sesiones ni las opiniones de la primera, incluso usando llamadas directas a la API.
- El cliente iOS no necesita abrir el selector web para completar el flujo principal.
- Las rutas antiguas de la web y del panel siguen funcionando.
