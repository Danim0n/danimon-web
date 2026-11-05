# Validación de telemetría

5 de noviembre de 2026. Pruebas locales en Windows y Chromium mediante Playwright, con emulación de móvil. No se verificó hardware móvil real ni cuentas externas.

## Resultados

- Astro check sin errores, avisos ni sugerencias. Build de once páginas completado.
- Batería de privacidad y eventos con 19 pruebas correctas. Rechazo, aceptación granular, persistencia, retirada, carreras de carga, propagación entre pestañas, GPC, proveedor bloqueado, eventos inválidos, CV, scroll, carrusel, tiempo activo y teclado.
- SDK real de PostHog, con navegador humano emulado únicamente en la prueba, red interceptada y cuerpo descomprimido. Sobre validado, UUIDv7, token público de fixture, opciones de privacidad y retirada correctos. También se probó sessionStorage denegado con sesión estable en memoria.
- Axe sobre aviso y diálogo abiertos en EN/ES móvil, sin infracciones detectadas. Esto no equivale a una certificación exhaustiva de accesibilidad.
- Diez pruebas de regresión del portfolio correctas sobre el preview normal.
- Cuatro orígenes sintéticos con build production. Solo HTTPS y hostname exacto danimon.party habilitan la integración. Se interceptaron las solicitudes EU utilizando un marcador de proyecto inválido. La retirada recargó y dejó la sesión vacía. Ninguna solicitud llegó a un proveedor.
- Build normal en off, incluso tras aceptar, sin solicitud externa de analítica, sin identidad opcional y sin API de test en window.
- Escaneo del build HTML/JS/CSS/JSON sin coincidencias con los patrones seleccionados de claves privadas. No se inspeccionaron archivos privados de entorno. Este análisis no garantiza la ausencia de cualquier formato de secreto.
- npm audit de dependencias de producción sin vulnerabilidades notificadas al ejecutar la revisión.
- Aviso y preferencias inspeccionados visualmente por el coordinador, QA y dirección artística. Mismo peso visual para aceptar y rechazar. En móvil el aviso ocupa parte del primer encuadre y cubre temporalmente la tarjeta de perfil; los controles permanecen utilizables.

Resultados reproducibles en output/qa/analytics/results.json, audit.json, host-audit.json, npm-audit.json, final-build.log, regression.log y ejecucion.md. La investigación y búsqueda de skills se registran en output/qa/analytics-research.md.

## Rendimiento

Medición de una carga local fría de la portada ES, Chromium 1280×900, sin limitación de CPU/red:

- Los módulos de la capa de analítica solicitados suman aproximadamente 6,4 kB gzip.
- El JavaScript solicitado más módulos inline de esa carga suma aproximadamente 11,8 kB gzip, incluyendo código del portfolio existente.
- El chunk diferido del SDK PostHog mide aproximadamente 388 kB sin comprimir y 120 kB gzip. No se solicitó en la carga sin permiso.
- No hay medición por frame, ni coordenadas de ratón, ni observación del texto de formularios. Scroll se agrupa por frame y solo envía hitos únicos; el temporizador de atención comprueba una vez por segundo.

Son estimaciones gzip calculadas sobre archivos locales. No representan la compresión negociada en Cloudflare ni una comparación antes/después de Lighthouse o Core Web Vitals en producción. El beacon CF permanece sin cargar en el build normal.

## Límites pendientes

- Cloudflare real: acceso al sitio, token público, estado de auto-inyección de zona/Pages, beacon real, retención, campos de API y disponibilidad de datasets.
- PostHog real: proyecto EU, token público, contratos y retención de cuenta, paneles, cuotas y recepción efectiva de eventos.
- Revisión aplicable de privacidad, encargados y transferencias con las cuentas elegidas. La opción restrictiva se mantiene activa hasta completar esa revisión.
- Publicación futura y prueba de la red y los paneles sobre el dominio. No se publicó ni se modificaron DNS, servicios o el proyecto de administración.

La prueba de Cloudflare usa un simulador para consentimiento y duplicados. No puede certificar que un beacon inyectado por una zona externa respete este gestor. La comprobación de auto-inyección es un prerrequisito para activar PUBLIC_CLOUDFLARE_MANUAL_AUDITED.
