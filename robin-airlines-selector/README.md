# Robin Airlines · Selector de carreras

Cara visible del selector de carreras de Project Robin planteado como un vuelo: el alumno hace el check-in, elige rumbo, contesta a Robin desde la ventanilla y aterriza en sus tres destinos.

**Estado:** integrado. Recorre la ruta bachelor y envía las respuestas al motor real del proyecto padre. La interfaz muestra las tres mejores recomendaciones del catálogo de 229 carreras.

---

## Contenido

```
robin-airlines-selector/
├── index.html                       Marcado de las 4 pantallas, el zoom y el aviso de cabina
├── styles.css                       Todos los estilos
├── app.js                           Preguntas, estado, animaciones y conexión con `/api/match`
├── assets/
│   ├── fonts/d-din-exp-bold.woff2   Tipografía de titulares de la web (subconjunto latino)
│   └── img/
│       ├── avioneta-*.webp          Las 5 vistas de Robin en su avioneta + miniatura
│       ├── robin-avatar.webp        Cara de Robin (bocadillos y billete)
│       ├── logo-robin.png           Logotipo ROBIN de la cabecera
│       ├── logo-r-crema.webp        Logo R (placa de la cabina y franja final)
│       └── ciudades/*.webp          Fotos de las 9 ciudades (las de la web)
├── robin-airlines-standalone.html   Todo lo anterior en un solo archivo (para enseñarlo)
└── herramientas/
    └── generar-standalone.py        Regenera el archivo único a partir de los demás
```

## Cómo verlo

- Desde la carpeta padre, ejecuta `node server.cjs` y abre `http://localhost:3000`.
- La aplicación necesita el servidor del proyecto padre; abrir el HTML con doble clic no permite calcular recomendaciones.
- Inter e IBM Plex Mono se cargan de Google Fonts (sin conexión se usa la del sistema). D-DIN Exp va incluida.

Si cambias `index.html`, `styles.css` o `app.js`, regenera el archivo único con `python3 herramientas/generar-standalone.py`.

## Recorrido

1. **Check-in (billete):** nombre, apellidos, correo, teléfono móvil, colegio, ciudad y país de origen, consentimiento.
2. **Elige tu ruta:** una sola área de interés (7 opciones).
3. **Despegue + zoom:** Robin se acerca y, con zoom a la ventanilla, recuerda que es una prueba gratuita (texto en `zoomLine`).
4. **Escalas:** Información general → bloque del área elegida → Perfil vocacional → Asignaturas.
5. **Aviso de cabina** al empezar la escala del área (una vez).
6. **Aterrizaje** en pista y **destinos**: las tres mejores recomendaciones reales con compatibilidad, motivo, afinidades, universidad, ciudad, duración, numerus fixus y enlace oficial.

Total: 28–30 preguntas según el área y el sistema educativo.

## Datos que recoge

Todo vive en el objeto `S` de `app.js` (función `fresh()`):

| Campo | Contenido |
|---|---|
| `S.ticket` | `{ nombre, apellidos, email, telefono, colegio, ciudad, pais, consent }`. Ciudad y país son **de origen**. |
| `S.area` | Una clave: `ciencias`, `tecnologia_y_programacion`, `business`, `ciencias_de_la_salud`, `ingenierias`, `ciencias_sociales` o `artes`. Equivale a `intereses` del portal, con un solo elemento. |
| `S.answers` | Respuestas por **id del portal** (`questionnaire-data.js`): `g_*`, `c_*`, `t_*`, `b_*`, `s_*`, `i_*`, `so_*`, `a_*`, `v_*`. |
| `S.answers.asignaturas` | `[{ name, level }]`, equivale a `academic_subjects`. |

Formato de los valores:
- Selección única: el texto de la opción, igual que en el portal.
- Selección múltiple: un array. Asignaturas, rasgos y valores (`g_fav`, `g_menos`, `g_rasgos`, `g_valora`) usan el `value` del portal (`matematicas`, `analitico`…); el resto, el texto de la opción.
- Deslizadores: un número.
- Texto: un string. Las preguntas opcionales que el alumno salta no aparecen.

### Diferencias con el onboarding del portal

- **Colegio:** no se pregunta en Información general (`g_colegio`); se usa `S.ticket.colegio`.
- **Sistema académico:** se pregunta una vez (`g_sistema`). Para `academic_system` y los niveles se traduce así:

  | `g_sistema` | `academic_system` | Niveles |
  |---|---|---|
  | Bachillerato español | `bachillerato_espanol` | — |
  | Bachillerato Internacional (IB) | `ib` | `sl`, `hl` |
  | A-Levels (británico) | `a_levels` | `as`, `a_level` |
  | Sistema americano | `high_school_diploma` | `standard`, `honors`, `ap` |
  | Bac francés | `baccalaureat_frances` | — |
  | Otro | `otro` | — |

  El Abitur no está en la lista de `g_sistema`, así que esos alumnos entran por «Otro».
- **`modalidad`:** pregunta nueva que no existe en el portal. Solo aparece si `g_sistema` es Bachillerato español: Ciencias – tecnológico, Ciencias – biosanitario, Humanidades y Ciencias Sociales, Artes, General.
- **Preguntas del portal que no están** (se quitaron en el documento): `c_inv_ind`, `c_inspira`, `t_proyectos`, `t_herramientas`, `b_internacional`, `s_ayudar`, `v_carreras`.
- **Un área**, no varias. **Solo ruta bachelor** (no hay máster).

## Integración

- `land()` inicia `/api/match` al comenzar el descenso y mantiene la animación mientras el servidor calcula las recomendaciones.
- El servidor adapta el cuestionario reducido sin completar respuestas que el alumno no haya dado.
- `renderDestino()` utiliza directamente los campos devueltos por el catálogo. Las ciudades sin fotografía propia muestran una imagen neutra de Robin, no una ciudad incorrecta.
- Los botones abren el programa oficial y la página real de asesoramiento de Project Robin.

## Textos y criterios editables

- **Preguntas:** objetos `GENERAL`, `AREA_BLOCKS`, `VOCACIONAL` y `ASIGNATURAS`, con los mismos ids que el portal.
- **Mensaje del zoom:** `zoomLine()`.
- **Aviso de cabina:** marcado `#notice` en `index.html`.
- **Vista de la avioneta en cada pregunta:** campo `pose` de cada pregunta. Criterio:
  - `side`: datos y listas.
  - `three`: lo que viene.
  - `front`: preguntas sobre ti.
  - `away`: lo que dejas atrás.
  - `bank`: maniobras.

  Nunca se repite la misma vista en dos preguntas seguidas.
- **Frases de Robin al empezar cada escala:** función `line` de cada bloque.

## Notas

- Respeta `prefers-reduced-motion`: sin animaciones, el recorrido funciona igual.
- Sin dependencias ni compilación: HTML, CSS y JavaScript sin librerías.
- Si se integra en otra web, también hay que conservar un endpoint compatible con `/api/match`; los archivos estáticos por sí solos no ejecutan el recomendador.
