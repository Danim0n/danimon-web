# Telemetría del portfolio

Implementación local del 5 de noviembre de 2026. El modo por defecto es **off**. No se han creado cuentas, paneles, recursos, despliegues ni credenciales. La recepción de eventos y el funcionamiento real de Cloudflare siguen pendientes de una cuenta configurada y una publicación posterior autorizada.

## Componentes

- `src/lib/analytics/events.ts` define los eventos y sus propiedades enumeradas. Cualquier campo adicional o valor no permitido invalida el evento.
- `src/lib/analytics/index.ts` controla consentimiento, entorno, deduplicación, sesión, revocación y proveedores. La API de componentes es `trackEvent(nombre, propiedades)`, con `trackOnce` para hitos únicos.
- `providers.ts` carga PostHog mediante importación dinámica del paquete oficial `posthog-js/no-external`. No importa el SDK antes de aceptar.
- `instrument.ts` escucha clics, secciones, scroll del contenedor real y tiempo activo. El carrusel comunica aperturas deliberadas y arrastres, nunca fotogramas o coordenadas. La demo informa de acciones con datos ficticios, sin valores de campos.
- `AnalyticsConsent.astro` aporta preferencias bilingües accesibles y un enlace permanente. Las páginas de privacidad y cookies están en `/privacy/`, `/cookies/`, `/es/privacidad/` y `/es/cookies/`.

## Modos y configuración pública

Copiar `.env.example` a un archivo local ignorado por Git o establecer los valores en el entorno de compilación. Leer tokens públicos en el panel del proveedor, sin compartir claves privadas en el chat. Astro incorpora las variables PUBLIC al JavaScript. Un cambio exige recompilar.

| Variable | Valor |
| --- | --- |
| PUBLIC_ANALYTICS_MODE | off, test o production |
| PUBLIC_POSTHOG_KEY | Token público de ingesta del proyecto europeo, prefijo phc_ |
| PUBLIC_CLOUDFLARE_TOKEN | Token público del beacon, 32 caracteres hexadecimales |
| PUBLIC_CLOUDFLARE_MANUAL_AUDITED | true solo tras verificar que no se inserta otro beacon |

Producción exige HTTPS y el hostname exacto `danimon.party`. Localhost, previews, subdominios, dominios de pruebas y los modos desconocidos no envían a proveedores reales. El adaptador falso solo existe operativo en modo test sobre localhost o 127.0.0.1. Nunca se habilita por parámetros de URL.

El modo test expone `window.__analyticsTest` para pruebas aisladas. La opción `useRealSdk()` usa un marcador de proyecto deliberadamente inválido y exige interceptar todas las peticiones de terceros. Sirve para inspeccionar el adaptador y no verifica una cuenta PostHog.

## Activación posterior

1. Crear o seleccionar manualmente un proyecto **EU** en PostHog. Revisar facturación, retención, acceso, contrato y subencargados. La integración no utiliza funcionalidades de pago deliberadamente. El consumo y los límites de la cuenta se deben revisar antes de publicar.
2. Mantener replay, autocapture, encuestas, perfiles de personas y excepciones automáticas desactivados. La integración vuelve a desactivarlos explícitamente. API de ingesta `https://eu.i.posthog.com`, UI `https://eu.posthog.com`.
3. Seleccionar el sitio en Cloudflare Web Analytics y obtener su token público. Workers Static Assets no equivale al toggle automático de Cloudflare Pages. Revisar **Manage Site / automatic setup**, transformaciones de zona, snippets y respuestas HTML del dominio.
4. Dejar la inserción automática de Cloudflare desactivada y utilizar exclusivamente el cargador manual consentido. Antes de aceptar, ninguna respuesta HTML debe incluir un beacon automático. Si ya hay un script, el cargador local evita duplicarlo, pero no puede impedir que el script externo ya se haya ejecutado. Si no puede verificarse este requisito, mantener `PUBLIC_CLOUDFLARE_MANUAL_AUDITED=false`.
5. Revisar residencia, transferencias, retención y textos legales con la configuración real. La decisión conservadora es pedir permiso previo a ambas herramientas. No se presupone una exención de consentimiento por ausencia de cookies.
6. Compilar con los tokens públicos y modo production. Inspeccionar el build sin publicarlo y, en un paso futuro autorizado, publicar y verificar la red antes de aceptar, después de rechazar, después de aceptar y después de retirar.
7. Confirmar eventos recibidos en PostHog y métricas en Cloudflare, comparar una única vista en cada proveedor y validar la ausencia de beacon duplicado. Esta última verificación NO se ha realizado en cuentas reales.

Cloudflare se omite en documentos con query o fragmento y en páginas desconocidas. También se omite si el referrer lleva query/hash, una ruta interna desconocida o una ruta externa que no sea la raíz, para reducir la exposición de información de navegación. Los anclajes usados después de cargar una página limpia no provocan nuevas pageviews porque `spa:false`. Los informes pueden infraestimar visitas con enlaces profundos y visitantes que rechazan, bloqueadores o fallos.

## Consentimiento y datos

La elección necesaria `danimon.analytics.consent.v1` usa localStorage y caduca a los 180 días. Se acepta un rechazo persistido. Un cambio de versión o dato inválido devuelve el estado sin consentimiento. Si el almacenamiento está bloqueado, la elección funciona en memoria durante esa página. La retirada se propaga entre pestañas.

La categoría web permite el beacon; interacciones permite PostHog. Grabación de sesiones no está ofrecida ni implementada, permanece desactivada. DNT y Global Privacy Control deshabilitan ambas categorías. No hay modo sin cookies que envíe después de rechazar.

Solo tras aceptar interacciones se crea un UUIDv7 aleatorio por pestaña en sessionStorage. Permite el embudo entre páginas de esa pestaña y se renueva después de 30 minutos sin actividad medida. No es una identificación de persona ni se reutiliza entre pestañas/dispositivos, pero constituye un dato seudónimo y exige consentimiento. No se calcula una huella de dispositivo.

PostHog usa memoria y `before_send` sustituye todas sus propiedades automáticas por el sobre validado. Se excluyen URL completa, query, hash, referrer bruto, texto DOM, datos OCR, campos, nombre del visitante, correo y trazas. El dispositivo se reduce a tres clases, el origen a cinco categorías y el idioma a dos. Los únicos identificadores de ingesta son los aleatorios de sesión y los técnicos de evento. IP y geoip están desactivados en PostHog, aunque el proveedor necesariamente recibe una IP al establecer la conexión.

No hay cola previa al consentimiento. Se descartan eventos mientras el proveedor carga o si falla. Se comprueba de nuevo la autorización al terminar la carga. La retirada cierra la puerta sincrónicamente y limpia la sesión opcional. Una petición ya iniciada no puede recuperarse. El beacon Cloudflare carece de teardown documentado; si llegó a cargarse, retirar su categoría recarga el documento después de guardar la decisión. Retirar PostHog cargado en producción también recarga para terminar listeners y cualquier reintento pendiente del SDK. La elección rechazada se conserva tras esa recarga.

Las solicitudes HTTP del PDF pertenecen a las estadísticas del servidor y no se instrumentan aquí. El nombre `cv_download_clicked` solo informa de la pulsación. Ni la recepción completa ni la lectura del PDF pueden afirmarse desde ese evento.

## Catálogo

Todas las propiedades de evento incluyen `schema_version=1`, `page_id`, `language`, `device_type` y `traffic_source`, con valores enumerados. El catálogo completo tipado y sus esquemas están en events.ts.

| Estado | Eventos | Disparador |
| --- | --- | --- |
| Operativo | page_viewed, project_detail_viewed | Una carga consentida de documento, ficha o demo |
| Operativo | section_viewed | Primera aparición real de sección con IntersectionObserver |
| Operativo | project_opened | Revelado de tarjeta action=details o enlace a proyecto action=navigate; se distinguen |
| Operativo | language_changed | Clic al otro idioma, no al activo |
| Operativo | scroll_depth_reached | 25, 50, 75 y 100% del scroll útil, únicos por página y ciclo de permiso |
| Operativo | active_time_milestone | 30, 60 y 180 segundos de página visible/enfocada, sin más de 60 s sin actividad |
| Operativo | cv_download_clicked, linkedin_clicked | Clic en controles reales del perfil |
| Operativo | contact_clicked | Selector o proveedor de correo; method distingue intención |
| Operativo | email_copy_clicked | Copia real o selección de texto como alternativa, result distingue ambas |
| Operativo | external_link_clicked | Destino enumerado, sin URL ni email |
| Operativo | interactive_experience_started, interactive_control_used | Primer uso y controles del carrusel o demo |
| Operativo | interactive_experience_completed | Solo guardado local correcto de una revisión de la demo |
| Operativo | 3d_first_interaction, 3d_interaction_milestone | Primer control deliberado y 5/10 controles, nunca rotación autónoma |
| Oportunista | animation_paused, animation_resumed | Cambio de preferencia del sistema mientras la analítica está activa |
| Oportunista | webgl_initialization_failed, graphics_fallback_activated | Fallos WebGL posteriores al consentimiento; no se recupera historial previo |
| Oportunista | frontend_error_detected | Una señal runtime/promise, sin mensaje, archivo, stack ni valor rechazado |
| Preparado | project_media_opened, project_video_started, project_video_completed | Esquemas listos; no hay visor/vídeo interactivo actual y no se crean controles |

Una firma idéntica repetida en menos de 750 ms se descarta. Los controles se limitan además a uno por tipo y segundo. Los eventos de hito se deduplican por página/ciclo consentido. Navegar a una página nueva genera otra page_viewed, no un usuario nuevo necesariamente. Retirar y volver a aceptar inicia otro ciclo y otra sesión.

## Pruebas

`npm run test:analytics` compila un build fake aislado en output/analytics-test-dist y levanta un preview exclusivo en 127.0.0.1:4330. No sobrescribe dist ni usa credenciales. El reporte queda en output/qa/analytics/results.json. La suite normal `npm test` utiliza el preview normal 4325 y excluye analytics.spec.

La suite de privacidad debe interceptar toda red externa incluso al cargar el SDK real. Verifica ausencia de peticiones antes/rechazo, autorización por categoría, retirada y carreras, bloqueo, persistencia, idioma, eventos y duplicados, teclado y móvil. Un adaptador fake no demuestra recepción real. El informe final de QA enumera lo efectivamente ejecutado.

## Fuentes oficiales

- AEPD, [guía sobre cookies](https://www.aepd.es/guias/guia-cookies.pdf).
- Cloudflare, [activación de Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/) y [datos y métricas](https://developers.cloudflare.com/web-analytics/data-metrics/).
- PostHog, [configuración JS](https://posthog.com/docs/libraries/js/config), [privacidad](https://posthog.com/docs/privacy) y [persistencia](https://posthog.com/docs/libraries/js/persistence).
- Astro, [variables de entorno](https://docs.astro.build/en/guides/environment-variables/).

Resultados consolidados y límites en [ANALYTICS_VALIDATION.md](ANALYTICS_VALIDATION.md). Contrato móvil en [ANALYTICS_MOBILE_API.md](ANALYTICS_MOBILE_API.md) y paneles/consultas en [ANALYTICS_DASHBOARDS.md](ANALYTICS_DASHBOARDS.md).

## Proyecto PostHog

El proyecto europeo indicado es 336435. La ingesta usa https://eu.i.posthog.com y el panel se consulta en https://eu.posthog.com/project/336435. El token público se configura mediante PUBLIC_POSTHOG_KEY en el entorno de compilación, fuera del repositorio. Este ID no otorga permisos de consulta.
