# Estadísticas agregadas del portfolio

Actualizado: 6 de noviembre de 2026. Arquitectura Cloudflare exclusiva: frontend → Worker del mismo origen → D1. No se conservan eventos individuales, cookies, IDs de visitante, IP, user-agent, contenido de facturas ni URLs. Cada petición contiene solamente page, language, counter y project, todos enumerados. La fecha UTC la añade el servidor.

## Estado real

Publicado y comprobado en https://danimon-web.pages.dev/ mediante Cloudflare Pages y la conexión GitHub existente: incluye el Worker compilado en _worker.js y la base real danimon-counters, creada en jurisdicción UE. Se verificaron filas remotas de proyectos, CV, contacto e idioma. DNS y planes intactos; danimon.party sigue sin conectarse a este proyecto. No se concedió un token amplio ni OAuth de cuenta. Estado remoto y límites en DEPLOYMENT_STATE.md.

El beacon nativo se conserva pero permanece desactivado por PUBLIC_CLOUDFLARE_EXEMPTION_REVIEWED=false. No se sustituye por un banner. Se descartan sus métricas hasta resolver la revisión contractual descrita en CLOUDFLARE_ANALYTICS.md. Los contadores propios pueden funcionar independientemente.

## Componentes y configuración

- src/lib/analytics/catalog.ts: catálogo cerrado y validador compartido con el servidor.
- index.ts: envío no bloqueante con keepalive, sin credenciales, referente ni cola persistente; deduplicación de 500 ms en memoria.
- instrument.ts: controles existentes, secciones, scroll real y umbrales de tiempo activo.
- worker/index.ts: validación y UPSERT atómico; sin API pública de estadísticas.
- migrations/0001_counters.sql: una tabla, seis columnas, clave compuesta.
- SitePrivacy.astro y AnalyticsLegal.astro: enlace discreto e información bilingüe.
- queries/counters.sql: consultas privadas de lectura.

PUBLIC_ANALYTICS_MODE admite off, test (solo localhost) y production (HTTPS y origen exacto PUBLIC_COUNTERS_ORIGIN). El modo off es el valor seguro por defecto de .env.example. Los valores PUBLIC se fijan al compilar; no son secretos. COUNTERS_ENABLED=true y el binding COUNTERS apuntan a la base real en wrangler.jsonc. La publicación usa danimon-web.pages.dev para no tocar DNS; se fija ese mismo origen al compilar. Esto no conecta danimon.party automáticamente. Las ramas de preview se compilan con los contadores apagados.

## Acciones medidas

| Grupo | Medición |
| --- | --- |
| Contacto | LinkedIn; abrir opciones; Gmail, Outlook, aplicación de correo y copiar/seleccionar correo por separado |
| CV | Clic de descarga y respuesta HTTP 200 del PDF, separados |
| Proyectos | Cada uno de los cuatro IDs; revelar reverso, navegar a ficha/demo y abrir ficha |
| Navegación | Cuatro secciones e idioma de destino |
| Interacción | Arrastre deliberado del carrusel; lectura, cancelación, fuente, guardado, exportación y borrado en demo |
| Uso | Secciones visibles, scroll 25/50/75/100 y tiempo activo 30/60/180 s, una vez por documento |
| Calidad | Fallo WebGL, alternativa gráfica, errores de interfaz y cambio manual de animación cuando exista |

Los ganchos de galería, vídeo, repositorio, GitHub y otros enlaces profesionales solo suman si existe realmente esa acción. No se añaden botones ficticios. El giro automático del carrusel, hover, frames, coordenadas y valores de formularios no se envían.

Los hitos en memoria desaparecen al navegar. No hay sesiones ni embudos individuales. Clics no equivalen a personas; los totales pueden incluir recargas y automatizaciones. Un 200 de PDF preparado no acredita descarga completa o lectura; HEAD, rangos 206 y errores no se cuentan. El idioma es es en ese contador porque el documento está en español.

## Privacidad, defensa y límites

DNT o GPC desactivan el envío; se comprueban también en servidor. Se eliminan únicamente las antiguas claves locales propias de consentimiento/sesión sin leer sus valores. La demo conserva su almacenamiento funcional elegido por el usuario, ajeno a las estadísticas.

El endpoint solo acepta POST JSON del mismo origen, 2 KiB como máximo, de uno a cinco eventos sin duplicados, categorías exactas y sin propiedades extra. Los valores se enlazan a SQL preparado. Presupuesto de 1.200 solicitudes/minuto por isolate, sin identificar direcciones. No es un límite global ni impide bots que falsifiquen cabeceras. No se ofrece SQL arbitrario o endpoint administrativo.

Sin console.log de solicitudes. Logs/traces/issues del Worker de retención comprobados apagados; Pages no incorpora un colector de logs propio. Cloudflare sigue viendo IP/cabeceras a nivel de transporte y puede tratar datos operativos bajo sus condiciones: no afirmar anonimato de toda la infraestructura. Retención de agregados: ventana de 365 días con cron diario 0 3 * * * guardado en danimon-counters-retention, sin URLs públicas. Primera ejecución automática futura al cierre de la comprobación. Los datos de recuperación del proveedor pueden durar adicionalmente según su contrato.

El CV debe seguir disponible aunque D1 falle: su escritura se hace en segundo plano. Agotar cuota de Functions puede afectar esa ruta; vigilar consumo y, si ocurre, retirar /cv/* del archivo _routes.json generado y recompilar para servir el PDF estático sin contador. No se activan planes de pago.

## Consulta privada y operación

Ver ANALYTICS_DASHBOARDS.md para informes, CLOUDFLARE_ANALYTICS.md para garantías jurídicas, ANALYTICS_VALIDATION.md para pruebas y RUN_AND_DEPLOY.md para pasos de publicación. README permanece orientado a presentar el portfolio.
