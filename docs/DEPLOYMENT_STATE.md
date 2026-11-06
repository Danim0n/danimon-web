# Estado del despliegue

6 de noviembre de 2026. Dominio raíz asociado mediante Custom Domains de Pages al proyecto existente danimon-web. https://danimon.party/ y /es/ responden 200 con TLS válido; pages.dev sigue disponible. Se usó la conexión GitHub existente con Danim0n/danimon-web. Ningún token amplio, OAuth de cuenta ni plan de pago concedido.

El único cambio DNS autorizado es un CNAME @ → danimon-web.pages.dev, TTL Auto, creado por el flujo oficial de Pages. La zona estaba activa y delegada en damiete.ns.cloudflare.com y dora.ns.cloudflare.com. Antes solo existía panel → túnel danicore-panel; no había apex, www, A/AAAA, MX, TXT o CAA que sustituir. No se modificaron panel, túneles, correo, nameservers, reglas globales ni otros Workers. Copia previa en output/recovery/domain-production.

## Verificado

- Pages danimon-web, rama main, npm run build:pages y dist. El paquete incluye _worker.js y el binding COUNTERS real. Configuración de origen y compilación en wrangler.jsonc.
- D1 danimon-counters, ID ccf6dfcb-d8ca-489b-b2e4-6b2326e388b2, creada con jurisdicción UE y esquema de seis columnas.
- Recepción real desde la web: cuatro proyectos separados, clic de CV y respuesta PDF 200, apertura del selector de correo, copia correcta e idioma. Las comprobaciones también han añadido recargas, respuestas directas del PDF y acciones de prueba a los totales; no son tráfico orgánico ni personas únicas.
- HTML público 200 sin beacon ni proveedor anterior; Cache-Control no-transform, NEL max_age 0 y sin Report-To ni Set-Cookie en la respuesta inspeccionada.
- Pages → Metrics muestra Web Analytics disabled: no hay inserción automática. El cargador manual también está apagado por revisión contractual pendiente.
- Worker danimon-counters-retention, versión de código a8517321, vinculado solo a COUNTERS y COUNTERS_ENABLED=true. Código del editor comparado con el bundle local, salvo espacio final.
- Cron guardado y comprobado después de recargar: 0 3 * * *, siguiente ejecución 7 de noviembre de 2026 a las 03:00 UTC. Borra días UTC con antigüedad de 365 días o superior.
- Retención: workers.dev y previews desactivados, sin rutas ni dominios, logs/traces/issues apagados. El arranque temporal Hello World se sustituyó tras la autorización específica; no es el código activo.
- Pages Metrics mostró 60 solicitudes correctas y cero errores en las últimas 24 horas al inspeccionarlo. Es una lectura puntual, no una garantía de disponibilidad.

## Límites pendientes

La primera ejecución automática de retención todavía es futura. El botón de prueba programada del editor quedó deshabilitado, con la vista previa sin conexión; no se habilitaron URLs públicas para probarlo. El borrado y sus límites se verificaron contra D1 local, no mediante una purga remota ya observada.

Cloudflare Web Analytics nativo no recibe mediciones nuevas de este despliegue mientras PUBLIC_CLOUDFLARE_EXEMPTION_REVIEWED=false. No se afirma que sus métricas estén operativas; se descartan hasta acreditar las garantías descritas en CLOUDFLARE_ANALYTICS.md.

El ajuste de orígenes se publica mediante GitHub: PUBLIC_ORIGINS y PUBLIC_COUNTERS_ORIGINS contienen exactamente https://danimon.party y https://danimon-web.pages.dev; el origen principal es el apex. Los previews y otros subdominios quedan fuera. La referencia D1 previa a esta publicación contiene 43 filas y 80 interacciones: se conserva sin reiniciar ni borrar. Las comprobaciones finales de commit efectivo e incrementos desde el apex se registran en output/qa/domain-production y en el informe local output/DOMAIN_PRODUCTION_REPORT.md, después del despliegue. No confundir esa referencia previa con estadísticas de visitantes.

www no estaba configurado y no se ha añadido. No es necesario para servir el dominio raíz solicitado.

No se acreditan contractualmente todos los plazos de logs internos, transferencias ni recuperación del proveedor. La base no conserva IP/IDs, pero Cloudflare procesa datos de transporte. No se presenta la solución como certificada jurídicamente.

## Evidencias

Locales e ignoradas por Git, bajo output/qa/cloudflare-only: d1-public-summary.png/json, d1-public-rows.json, public-contact.png, public-desktop-home.png, public-motion-0.png y public-motion-1.png, public-origins-audit.json, pages-auto-beacon-disabled.png, pages-metrics.txt, retention-code.png, retention-bindings.png y retention-configured.png. Las capturas se abrieron e inspeccionaron.

La revisión del dominio añade output/qa/domain-production/http.json: rutas EN/ES, fichas, demo, privacidad/cookies, 404, robots, sitemap, canonical, hreflang y 29 assets, incluidos los motores WASM y datos OCR. La comprobación HTTPS inicial obtuvo 155 verificaciones correctas. Certificado Google Trust Services WE1 para danimon.party, válido hasta el 4 de febrero de 2027 a las 12:53:53 UTC, conexión TLS 1.3 validada. HTTP redirige con 301 a HTTPS sin bucle.

El override móvil del navegador conectado no cambió el ancho efectivo (1920 px); no se etiqueta esa captura como móvil. La validación móvil real se hizo en Chromium local a 390 y 360 px, con las capturas y pruebas detalladas en ANALYTICS_VALIDATION.md.
