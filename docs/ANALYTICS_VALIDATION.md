# Validación de estadísticas

6 de noviembre de 2026. Pruebas locales en Windows y Chromium, más publicación y recepción remota comprobadas inicialmente en danimon-web.pages.dev. El dominio danimon.party se ha asociado después mediante Pages; la revisión específica se conserva en output/qa/domain-production y output/DOMAIN_PRODUCTION_REPORT.md.

## Resultados reproducibles

| Comprobación | Resultado |
| --- | --- |
| npm run build | Once páginas; Astro check sin errores, avisos ni sugerencias |
| npm test, preview 4325 del dist actual | 10/10, idiomas, móvil, axe, contacto, CV, carrusel y demo |
| npm run test:analytics | 12/12, acciones con cuatro campos fijos y clic real de ratón; endpoint interceptado |
| npm run test:counters | 14/14, Worker y retención; ambos orígenes, Origin cruzado, previews y CV; D1 local |
| npm run test:native | 10 casos, origen HTTPS simulado y script oficial, red interceptada; apex, pages.dev y preview |
| node tools/check-counter-e2e.mjs | Frontend → Worker → D1 local, sin interceptar el endpoint |

Frontend: DNT/GPC, ausencia de cookies/IDs persistentes, limpieza selectiva de claves antiguas, cada contacto, idiomas, cuatro proyectos, drag, scroll real y errores de endpoint sin bloquear navegación. El hover y la rotación automática no suman aperturas deliberadas. El guardado funcional de la demo conserva su almacenamiento propio.

Servidor: esquema de seis columnas, 100 incrementos concurrentes sin pérdidas, separación de categorías, campos desconocidos rechazados, origen y método, límite de cuerpo, DNT/GPC, PDF 200 frente a HEAD/206, ausencia de API de consulta pública, fallo o ausencia de D1 sin romper assets y retención. Las siete consultas de informes se ejecutaron con datos sintéticos. El módulo de retención específico se comprueba también: fetch 404, apagado seguro, ausencia de binding y frontera UTC de 364/365/366 días. Las pruebas de borrado son locales.

Integración completa local: clic y respuesta de CV, cuatro proyectos, ficha, demo, idioma, Gmail, Outlook, aplicación de correo y copia seleccionada producen filas agregadas en D1. Sin peticiones externas ni errores JS. No es una prueba de la base alojada.

Beacon: la puerta jurídica desactivada produce cero cargas; habilitada solo para prueba carga una instancia del script oficial y genera RUM interceptado. DNT, GPC, query, fragmento, referente inseguro y script preexistente impiden la carga manual. Se observaron almacenamiento vacío y ninguna cookie. Esto no comprueba recepción ni datos de un panel remoto.

## Revisión visual y rendimiento

Capturas de 1440×900 y 390×844 realmente abiertas y comparadas. Fondo WebGL activo, sin errores JavaScript/consola ni desbordamiento horizontal en las condiciones probadas. Dos fotogramas separados por un segundo muestran cambios de shader y giro de tarjetas. Se corrigió la superposición nueva de Privacidad sobre LinkedIn: la tarjeta de perfil queda delante al abrirse. El dock flotante sigue cubriendo parte del contenido mientras está abierto; no se ha rediseñado su comportamiento.

La primera suite completa obtuvo 9/10 por una espera de reanudación del carrusel; el caso aislado pasó y la repetición completa final obtuvo 10/10. No se afirma que ese resultado elimine toda intermitencia futura.

Carga local fría ES, Chromium 390×844, sin limitación de CPU/red: seis módulos JavaScript solicitados, 20.804 bytes sin comprimir y suma gzip estimada 8.774 bytes. Capa de estadísticas: aproximadamente 4,2 kB gzip dentro de ese total. Ninguna solicitud externa en esa carga y sin errores observados. Son tamaños de archivos locales, no bytes negociados en Cloudflare, Core Web Vitals de usuarios ni comparación controlada de Lighthouse. El SDK anterior ya no forma parte de dependencias o bundle.

## Evidencias y límites

Evidencias locales bajo output/qa/cloudflare-only: build-final.log, counters-final.log, native-beacon.json, native-beacon-final.log, e2e-worker-d1.json, visual-check-final.json, final-network.json y capturas final-es-*.png. La suite Playwright también conserva su JSON estándar en output/qa/analytics y output/qa/text. Los archivos output son locales e ignorados por Git.

Tras autorización expresa se creó D1 danimon-counters en jurisdicción UE y se aplicó el esquema; las seis columnas se inspeccionaron en la consola real (d1-created.png). Pages publicó desde GitHub con el binding D1 real y el Worker. La consola real confirmó cuatro proyectos distintos, clic de CV y respuestas PDF, apertura de contacto, copia correcta e idioma. Son acciones de comprobación, no personas únicas ni tráfico orgánico. d1-public-summary.png/json conserva el resultado; los PDFs también se solicitaron directamente en pruebas HTTP.

Respuestas públicas inspeccionadas: 200, sin beacon ni proveedor anterior, NEL max_age 0, sin Report-To ni Set-Cookie. Pages Metrics mostró explícitamente Web Analytics disabled. No se afirma recepción del beacon nativo. El almacenamiento y las peticiones detalladas se comprobaron en las suites locales con herramientas de navegador; la API del navegador conectado no permitió leer su almacenamiento, por lo que no se afirma una inspección de DevTools remota que no ocurrió.

Worker de retención desplegado, código comparado con el bundle local, COUNTERS y variable true, cron 0 3 * * * persistente tras recargar, logs/traces/issues y ambas URLs desactivados. Siguiente ejecución: 7 de noviembre, 03:00 UTC. No se observó todavía una ejecución automática ni se pudo disparar el botón de prueba del editor, deshabilitado con la vista previa desconectada.

Capturas públicas abiertas: contacto y selector, portada, giro y shader en dos fotogramas distintos. El navegador conectado permaneció a 1920 px pese al override solicitado; se restableció y esa evidencia se etiqueta escritorio. La evidencia móvil corresponde a las pruebas locales de 390/360 px. En el navegador con extensiones se registró un aviso de canal de mensajería asíncrono cerrado; no se reproduce en las suites locales limpias, que no registraron errores. No se oculta bajo una afirmación de consola remota completamente vacía.

Regresión del ajuste de dominios: suite portfolio 10/10, frontend 12/12, Worker 14/14, beacon 10 casos, E2E local correcto y npm audit completo cero vulnerabilidades. Build Pages sin diagnósticos. Capturas móviles EN/ES de 390 px abiertas: la tarjeta flotante puede cubrir texto inferior, comportamiento previo que no se ha rediseñado. El script adicional de comprobación WebGL local no llegó a iniciar Chromium por su ruta de binario; no se presenta como prueba superada en esta revisión.

DNS modificado únicamente para el apex mediante Pages; revisión contractual sigue pendiente. Las comprobaciones públicas de rutas/recursos/TLS y la comparación D1 antes/después desde el dominio definitivo se registran en output/qa/domain-production y output/DOMAIN_PRODUCTION_REPORT.md. Detalles de asociación en DEPLOYMENT_STATE.md.

Revisión contractual del beacon y del tratamiento operativo del proveedor pendiente; PUBLIC_CLOUDFLARE_EXEMPTION_REVIEWED permanece false. No se certifica cumplimiento jurídico ni rendimiento sobre hardware móvil real.
