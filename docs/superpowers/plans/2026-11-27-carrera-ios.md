# Recomendador de carreras para iOS — Plan de implementación

> **Para agentes implementadores:** subhabilidad requerida: usar `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans`. Seguir las tareas en orden y marcar sus casillas al completarlas.

**Objetivo:** Crear RobinRecomendator (icono de avioneta, nombre visible `Rbmt`) como app SwiftUI con cuenta de estudiante, historial privado, feedback personal y recomendaciones que también aprenden de opiniones agregadas de toda la comunidad.

**Arquitectura:** Un cliente iOS nativo con identidad Robin consulta el recomendador del backend Node. Supabase Auth verifica cuentas; funciones Netlify protegen el historial personal y generan estadísticas comunitarias agregadas de la web y la app. Ningún comentario original o identidad de otra persona se expone en recomendaciones.

**Tecnologías:** Xcode 27.2, SwiftUI, URLSession, Keychain, Node.js 20+, Netlify Functions, Supabase Auth/Postgres.

**Diseño:** `docs/superpowers/specs/2026-11-27-carrera-ios-design.md`

## Restricciones globales

- La app iOS se construye en Xcode con SwiftUI.
- El catálogo y el ranking de carreras permanecen en el servidor; no duplicar el motor en Swift.
- Reutilizar Supabase Auth y el backend Node/Netlify existentes.
- No exponer la clave de servicio de Supabase en la app.
- Un estudiante solo puede leer/modificar sus registros; las opiniones de otros influyen únicamente mediante estadísticas agregadas con al menos cinco participantes.
- La app no pide teléfono, colegio ni ubicación como condición para recomendar.
- Las sesiones web antiguas solo se asocian tras verificar el mismo correo y obtener confirmación explícita del estudiante.
- Los menores siguen una política de consentimiento determinada por los territorios de distribución; no fijar una edad universal en el cliente.
- Las opiniones de estudiantes de la app y valoraciones de la web alimentan estadísticas comunitarias por área/carrera; comentarios originales permanecen privados.
- El producto/título es `RobinRecomendator`, el nombre bajo el icono es `Rbmt` y el icono usa la avioneta Robin.
- Mantener la estética Robin (`#213765`, `#FEB546`, `#FBF7EC`) con navegación y controles nativos de iOS; no envolver la web existente.
- Mantener operativos los recorridos web y administrativos actuales.

## Foco de revisión

- **Aislamiento entre cuentas:** filtrar por el `auth.users.id` verificado en historial/opiniones personales y proteger tablas con RLS.
- **Correo no verificado y sesión expirada:** detener registro/importación/lectura privada y ofrecer el flujo de recuperación adecuado.
- **Importación de sesiones heredadas:** mostrar solo coincidencias del correo verificado; no reclamar registros ya asociados ni actualizar nada antes de confirmar.
- **Opiniones y ranking:** comentarios originales se usan en el perfil propio; votos de toda la comunidad y señales no identificables de comentarios se agregan por área/carrera, con mínimo cinco participantes, antes de influir en otras personas.
- **Menores y territorios:** no habilitar registro para un caso sin política de edad y consentimiento configurada; mantener datos mínimos.

---

### Task 1: Almacenamiento privado del estudiante

**Archivos:**
- Modificar: `supabase/schema.sql`
- Crear: `supabase/migrations/20261127_student_recommender.sql`

**Interfaces:**
- Producir tablas `student_profiles(user_id, country_code, consent_status, consented_at, consent_version, created_at, updated_at)`, `student_guardian_consents(id, user_id, guardian_email, token_hash, expires_at, confirmed_at, created_at)`, `student_recommendation_sessions(id, user_id, created_at, selected_areas, academic_system, academic_subjects, questionnaire, recommendation_source, recommendation_model, recommendations)`, `student_recommendation_feedback(id, user_id, session_id, program_code, decision, comment, created_at, updated_at)` y `career_feedback_contributions(user_id, area, program_code, decision, positive_terms, negative_terms, updated_at)`.
- Producir columna nullable `matching_sessions.student_user_id` para sesiones web reclamadas.
- Producir RLS que limite leer filas personales de estudiante a `auth.uid() = user_id`; las escrituras pasan por la API autenticada de servidor y la tabla de contribuciones comunitarias queda inaccesible a clientes.

- [x] Crear la migración con UUIDs, claves foráneas, índices por propietario/fecha, checks de decisión y límite de longitud del comentario; las sesiones de estudiante no contienen campos de lead.
- [x] Añadir estados de consentimiento `active`/`pending_guardian` al perfil y RLS owner-scoped para las tablas de estudiante; un índice parcial en `matching_sessions.student_user_id` evita reclamaciones ambiguas.
- [x] Añadir contribuciones comunitarias con clave única por cuenta/área/carrera para que una persona no multiplique su voto enviando muchas sesiones; guardar solo decisión y términos derivados, nunca comentario original.
- [x] Reflejar el esquema acumulado en `supabase/schema.sql`, manteniendo intactas las tablas y restricciones del sitio actual.

### Task 2: Autenticación, acceso a datos y API de estudiante

**Archivos:**
- Crear: `lib/student-api.cjs`
- Crear: `lib/student-store.cjs`
- Crear: `netlify/functions/student-match.cjs`
- Crear: `netlify/functions/student-history.cjs`
- Crear: `netlify/functions/student-legacy.cjs`
- Crear: `netlify/functions/student-feedback.cjs`
- Crear: `netlify/functions/student-account.cjs`
- Crear: `netlify/functions/student-config.cjs`
- Crear: `netlify/functions/student-eligibility.cjs`
- Crear: `netlify/functions/student-guardian.cjs`
- Modificar: `netlify.toml`
- Modificar: `server.cjs`

**Interfaces:**
- `requireStudent(event) -> Promise<{ userId: string, email: string, emailVerified: true }>` valida el Bearer token llamando a Supabase Auth con `SUPABASE_URL` y la clave pública del proyecto; rechaza tokens caducados, correo sin confirmar y llamadas sin token.
- `requireVerifiedUser(event) -> Promise<{ userId: string, email: string }>` valida usuario y correo para configurar elegibilidad antes de activar el perfil.
- `student-store.cjs` ofrece `saveSession`, `listSessions`, `previewLegacySessions`, `claimLegacySessions`, `saveFeedback`, `listPersonalFeedback` y `deleteStudentAccount`; todas reciben `userId` explícitamente.
- `student-store.cjs` ofrece también `saveCommunityContribution` y `listCommunityContributions(area)`; Tarea 3 combina ese resultado con los votos web y solo expone estadísticas que superen cinco participantes.
- `POST /api/student/match` recibe `{ answers, intereses, academic_system, academic_subjects }` y devuelve `{ session, suggestions }`.
- `GET /api/student/history` devuelve solo sesiones y feedback del estudiante autenticado.
- `GET /api/student/legacy` muestra sesiones web sin reclamar que coincidan con el correo verificado; `POST` en la misma ruta recibe `{ session_ids }` y las asocia solo tras una confirmación del cliente.
- `PUT /api/student/feedback` recibe `{ session_id, program_code, decision, comment }`.
- `DELETE /api/student/account` elimina la cuenta Auth, sesiones/valoraciones propias y asociaciones heredadas.
- `GET /api/student/config` entrega el cuestionario bachelor y catálogo de sistemas académicos.
- `GET /api/student/eligibility?country=<ISO-3166-1-alpha-2>` consulta edad mínima y requisito de autorización de tutor desde configuración de territorios del servidor; `POST` recibe `{ country_code, age, consent_accepted }`, crea el perfil y marca `active` o `pending_guardian`.
- `POST /api/student/guardian-consent` crea una autorización pendiente y envía por `lib/email.js` un enlace de confirmación de un solo uso al tutor; `GET` confirma el token y activa el perfil pendiente.

- [x] Implementar respuesta JSON, lectura de cuerpo y autenticación común; pasar el ID verificado al almacenamiento, nunca aceptar `user_id` del cuerpo.
- [x] Restringir `requireStudent` a cuentas verificadas con perfil `active`; usar `requireVerifiedUser` solo para preparar elegibilidad y autorización pendiente.
- [x] Implementar almacenamiento con service role únicamente en funciones del servidor; verificar propiedad antes de leer o editar una sesión/valoración.
- [x] Implementar `student-match.cjs` con `buildUser`, `generateSuggestions`, persistencia sin `lead` y sin llamada a `syncRecommenderLead`.
- [x] Añadir rutas Netlify para `/api/student/match`, `/api/student/history`, `/api/student/legacy`, `/api/student/feedback` y `/api/student/account`; conectar las mismas rutas en el servidor local.
- [x] Añadir rutas Netlify y servidor local para `/api/student/config`, `/api/student/eligibility` y `/api/student/guardian-consent`.
- [x] Permitir configurar el host del servidor local con `HOST` manteniendo `127.0.0.1` por defecto, para el acceso controlado desde iPhone en desarrollo.
- [x] Hacer la reclamación de registros condicional por email normalizado, `student_user_id IS NULL` e IDs seleccionados; una sesión reclamada no puede reasignarse.
- [x] Implementar la eliminación autenticada de la cuenta con la Admin API de Supabase, cascada para tablas nuevas y desvinculación de sesiones antiguas sin borrar el historial web original.
- [x] Bloquear match, historial e importación si `student_profiles.consent_status` no está activo.

### Task 3: Personalización por historial y opinión

**Archivos:**
- Modificar: `lib/career-suggestions.js`
- Crear: `lib/community-feedback.cjs`
- Crear: `lib/student-feedback.cjs`
- Modificar: `netlify/functions/student-feedback.cjs` (integrar con la ruta ya creada en la Tarea 2)

**Interfaces:**
- `normalizeStudentFeedback(value) -> { session_id, program_code, decision, comment }` valida que el programa pertenezca a la sesión del propietario y limita `comment` a 500 caracteres.
- `buildPersonalHistory(feedback, sessions) -> Array<{ program_code, decision, comment, signals }>` agrupa solo feedback y cuestionarios del mismo estudiante.
- `buildCommunityStats(webFeedback, studentContributions, area) -> Array<{ program_code, approved_count, rejected_count, participant_count, positive_terms, negative_terms }>` agrega web/app y omite carreras con menos de cinco participantes distintos.
- Extender `generateSuggestions(user, feedback, history, options)` con `{ personalHistory, communityFeedback }`; el modo estudiante combina preferencias personales con estadísticas comunitarias sin comentarios crudos ni identificadores ajenos.

- [x] Añadir formateo específico del historial personal: comentarios delimitados como contenido aportado por el usuario, máximo 500 caracteres y tratados en el prompt como preferencias, nunca como instrucciones.
- [x] Al guardar feedback, analizar la nota en señales estructuradas, upsert de la contribución única del estudiante y mantener la nota original solo en su fila privada de feedback.
- [x] Añadir `buildCommunityStats`: deduplicar por persona/carrera/área, combinar votos antiguos de `recommendation_feedback` y contribuciones nuevas de cuentas, y no devolver filas por debajo del umbral de cinco.
- [x] Añadir un ajuste comunitario acotado por tamaño de muestra y balance de votos; las respuestas actuales y preferencias personales siempre conservan mayor peso.
- [x] Incluir términos de opinión solo cuando cada término alcance cinco participantes distintos; no enviar comentario original a otro estudiante ni al prompt de otra persona.
- [x] Mantener el comportamiento del recomendador web para llamadas existentes sin `personalHistory: true`.
- [x] En el endpoint de estudiante, pasar historial personal y `loadCommunityFeedback` de su área al ranking; conservar el flujo actual de recomendaciones web.
- [x] Mantener consistencia: carreras rechazadas pierden prioridad, las aprobadas ganan prioridad y el texto libre matiza sin poder introducir carreras fuera del catálogo.

### Task 4: Proyecto iOS, cuenta y cliente de API

**Archivos:**
- Crear: `ios/RobinRecomendator.xcodeproj`
- Crear: `ios/RobinRecomendator/App/RobinRecomendatorApp.swift`
- Crear: `ios/RobinRecomendator/App/RootView.swift`
- Crear: `ios/RobinRecomendator/Core/APIClient.swift`
- Crear: `ios/RobinRecomendator/Core/AuthSessionStore.swift`
- Crear: `ios/RobinRecomendator/Core/Models.swift`
- Crear: `ios/RobinRecomendator/Features/Auth/AuthView.swift`
- Crear: `ios/RobinRecomendator/Features/Auth/AuthCallbackView.swift`
- Crear: `ios/RobinRecomendator/Resources/Info.plist`
- Crear: `ios/RobinRecomendator/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json`
- Crear: `ios/RobinRecomendator/Resources/Assets.xcassets/RobinPlane.imageset/Contents.json`

**Interfaces:**
- `APIClient` usa URLSession y decodifica `/api/student/config` y `/api/student/*`; añade `Authorization: Bearer <access_token>` a peticiones privadas.
- `AuthSessionStore` ofrece `signUp(email:password:)`, `signIn(email:password:)`, `sendPasswordReset(email:)`, `refreshSession()`, `signOut()` y `deleteAccount()`; conserva refresh/access tokens en Keychain.
- Tras confirmar correo, `AuthView` consulta y envía país/edad declarada a `/api/student/eligibility`; una cuenta `pending_guardian` solo puede iniciar la autorización de tutor.
- `RootView` presenta `AuthView` sin sesión válida y el contenedor principal con sesión válida.

- [x] Crear en Xcode el target/producto `RobinRecomendator`, `CFBundleDisplayName=Rbmt`, bundle ID configurable y firma automática con el equipo Robin `3S84TW36UJ`; no incluir secretos.
- [x] Configurar la URL callback de autenticación y el permiso local de red necesario para que el iPhone de desarrollo consulte el backend ejecutado en el Mac.
- [x] Añadir el icono de avioneta sin wordmark en `AppIcon.appiconset` y los recursos de bienvenida desde el avión existente; usar paleta Robin y conservar el nombre visible `Rbmt`.
- [x] Definir modelos Codable para configuración del cuestionario, cuenta, sesión, resultado, feedback y respuesta de error.
- [x] Implementar Auth con los endpoints de Supabase GoTrue por URLSession, confirmación de correo, refresh, cierre de sesión y borrado a través del endpoint propio.
- [x] Registrar y manejar el URL scheme `careerrecommender://auth-callback` para confirmación de correo y restablecimiento de contraseña.
- [x] Guardar tokens solo en Keychain; al cerrar sesión borrar tokens locales y no persistir respuestas privadas en preferencias de app.
- [x] Crear `APIClient` con URL base configurable por build configuration y errores visibles para sesión expirada, red y servicio no disponible.

### Task 5: Cuestionario nativo y nuevas recomendaciones

**Archivos:**
- Crear: `ios/RobinRecomendator/Features/Questionnaire/QuestionnaireView.swift`
- Crear: `ios/RobinRecomendator/Features/Questionnaire/QuestionView.swift`
- Crear: `ios/RobinRecomendator/Features/Results/ResultsView.swift`
- Crear: `ios/RobinRecomendator/Features/Results/CareerDetailView.swift`
- Crear: `ios/RobinRecomendator/Features/Home/HomeView.swift`
- Modificar: `ios/RobinRecomendator/App/RootView.swift`

**Interfaces:**
- `QuestionnaireView(config:onSubmit:)` renderiza desde `/api/student/config` preguntas `single`, `multi`, `slider`, `text` y `textarea`, con bloques generales, de áreas y vocacionales.
- `ResultsView(session:suggestions:onFeedback:)` muestra compatibilidad, universidad, ciudad, explicación, fortalezas y feedback.
- `CareerDetailView(career:)` presenta los detalles del catálogo y el enlace oficial.

- [x] Descargar catálogo de preguntas y etiquetas de `/api/student/config`; no duplicar las preguntas ni el catálogo de carreras en Swift.
- [x] Construir controles SwiftUI tipados por tipo de pregunta, validar requeridos, límites de selección, sliders y asignaturas antes de enviar.
- [x] Implementar envío autenticado a `/api/student/match` y estados de carga/error; solo mostrar una sesión guardada después de recibir su ID.
- [x] Mostrar la lista de carreras y una ficha de detalle nativa con porcentaje, razón, puntos fuertes y datos oficiales.
- [x] Añadir navegación Inicio/Historial/Perfil con acceso directo a iniciar un nuevo cuestionario desde Inicio.

### Task 6: Perfil, historial, importación y ciclo de feedback

**Archivos:**
- Crear: `ios/RobinRecomendator/Features/Profile/ProfileView.swift`
- Crear: `ios/RobinRecomendator/Features/History/HistoryView.swift`
- Crear: `ios/RobinRecomendator/Features/History/HistoryDetailView.swift`
- Crear: `ios/RobinRecomendator/Features/Privacy/LegacyImportView.swift`
- Crear: `ios/RobinRecomendator/Features/Privacy/AccountPrivacyView.swift`
- Crear: `ios/RobinRecomendator/Features/Privacy/GuardianConsentView.swift`
- Modificar: `ios/RobinRecomendator/Features/Results/ResultsView.swift`
- Modificar: `ios/RobinRecomendator/App/RootView.swift`

**Interfaces:**
- `HistoryView(sessions:)` ordena sesiones por fecha y muestra fecha, áreas y resumen de resultados.
- `LegacyImportView(sessions:onConfirm:)` muestra coincidencias y envía solo IDs seleccionados tras confirmación explícita.
- Feedback por resultado usa decisiones `approved`/`rejected` y un comentario opcional de hasta 500 caracteres.
- `GuardianConsentView` muestra el estado pendiente y permite registrar el email del tutor cuando lo requiere la política del territorio.

- [x] Implementar Perfil con email de cuenta, opción de cerrar sesión, política de privacidad y acceso al historial completo.
- [x] Implementar lista/detalle de sesiones y cargar feedback existente para cada recomendación.
- [x] Persistir votos y comentarios mediante `/api/student/feedback`; permitir editar valoración sin duplicar filas.
- [x] Mostrar importación heredada solo para el email verificado; explicar qué sesiones se asociarán y requerir confirmación antes de reclamar.
- [x] Tras guardar feedback, permitir volver a Inicio y generar otra recomendación usando el historial personal; actualizar Inicio y conservar las sesiones anteriores.
- [x] Implementar solicitud de borrado de cuenta y explicar el efecto sobre sesiones propias y sesiones web reclamadas.
- [x] Completar el flujo de autorización del tutor y activar el perfil al confirmar el enlace recibido.

### Task 7: Consentimiento de menores, privacidad y entrega de Xcode

**Archivos:**
- Crear: `ios/RobinRecomendator/Features/Privacy/AgeConsentView.swift`
- Crear: `ios/RobinRecomendator/Resources/PrivacyInfo.xcprivacy`
- Crear: `ios/RobinRecomendator/Resources/PrivacyPolicy.md` (o enlace de política aprobado para distribución)
- Modificar: `README.md`
- Modificar: `.env.example`
- Modificar: `docs/NETLIFY_SUPABASE.md`

**Interfaces:**
- `GET /api/student/eligibility?country=<ISO-3166-1-alpha-2>` devuelve política activa, edad mínima para consentimiento propio y si se requiere autorización verificable de tutor.
- El registro no se completa para cuentas de menores cuando no existe política configurada o no se obtuvo autorización requerida.

- [x] Implementar selección de país y declaración de edad con recolección mínima; enviar solo la edad necesaria para decidir elegibilidad y no conservar la fecha exacta de nacimiento.
- [x] Implementar el estado de autorización de tutor requerido por la política configurada y evitar crear una cuenta activa antes de completar el paso requerido.
- [x] Configurar España con consentimiento propio desde 14 años y tutor por debajo de 14 conforme a AEPD/LOPDGDD; rechazar países ausentes y guardar la autorización con hash de token de un solo uso y vencimiento. Revisar otros territorios antes de ampliar la tienda.
- [x] Mantener el registro de menores deshabilitado en territorios sin política aprobada; documentar que Apple App Store Connect debe limitar el lanzamiento a territorios configurados.
- [x] Añadir privacidad accesible dentro de la app e información sobre datos, retención, eliminación y proveedores; no habilitar analítica o anuncios de terceros en este alcance.
- [x] Añadir al README instrucciones para configurar URL del backend, Supabase Auth, `STUDENT_AGE_POLICIES_JSON`, Resend, entornos de desarrollo/producción, bundle ID, firma y territorios.
- [x] Documentar `STUDENT_AGE_POLICIES_JSON` y añadir el alcance inicial España a `.env.example` y `docs/NETLIFY_SUPABASE.md`.
- [x] Ejecutar `xcodebuild -project ios/RobinRecomendator.xcodeproj -scheme RobinRecomendator -sdk iphonesimulator build`; confirmar que el target compila para simulador.
- [x] Instalar la build firmada en el iPhone conectado con `xcrun devicectl` y lanzarla; instalada como `com.projectrobin.RobinRecomendator` en iPhone 15.

## Dependencias entre tareas

Tareas 1–3 implementan primero el almacenamiento/API y la lógica personal. Tarea 4 fija el contrato de red y el acceso; las tareas 5–7 consumen esos contratos. La revisión final debe confirmar que los cambios de backend no alteran `/api/match`, `/api/feedback` ni la experiencia web existente.
