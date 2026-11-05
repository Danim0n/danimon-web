# Validación de estadísticas

5 de noviembre de 2026. Implementación local en Windows y Chromium. No hay recepción de datos ni despliegue remoto verificados.

## Resultados reproducibles

| Comprobación | Resultado |
| --- | --- |
| npm run build | Once páginas; Astro check sin errores, avisos ni sugerencias |
| npm test, preview 4325 del dist actual | 10/10, idiomas, móvil, axe, contacto, CV, carrusel y demo |
| npm run test:analytics | 11/11, acciones con cuatro campos fijos; endpoint interceptado |
| npm run test:counters | 11/11, Worker compilado y D1 local con workerd/SQLite |
| npm run test:native | 8/8, origen HTTPS simulado y script oficial, red de medición interceptada |
| node tools/check-counter-e2e.mjs | Frontend → Worker → D1 local, sin interceptar el endpoint |

Frontend: DNT/GPC, ausencia de cookies/IDs persistentes, limpieza selectiva de claves antiguas, cada contacto, idiomas, cuatro proyectos, drag, scroll real y errores de endpoint sin bloquear navegación. El hover y la rotación automática no suman aperturas deliberadas. El guardado funcional de la demo conserva su almacenamiento propio.

Servidor: esquema de seis columnas, 100 incrementos concurrentes sin pérdidas, separación de categorías, campos desconocidos rechazados, origen y método, límite de cuerpo, DNT/GPC, PDF 200 frente a HEAD/206, ausencia de API de consulta pública, fallo o ausencia de D1 sin romper assets y retención. Las siete consultas de informes se ejecutaron con datos sintéticos. El cron se invoca directamente: no acredita su planificación en Cloudflare.

Integración completa local: clic y respuesta de CV, cuatro proyectos, ficha, demo, idioma, Gmail, Outlook, aplicación de correo y copia seleccionada producen filas agregadas en D1. Sin peticiones externas ni errores JS. No es una prueba de la base alojada.

Beacon: la puerta jurídica desactivada produce cero cargas; habilitada solo para prueba carga una instancia del script oficial y genera RUM interceptado. DNT, GPC, query, fragmento, referente inseguro y script preexistente impiden la carga manual. Se observaron almacenamiento vacío y ninguna cookie. Esto no comprueba recepción ni datos de un panel remoto.

## Revisión visual y rendimiento

Capturas de 1440×900 y 390×844 realmente abiertas y comparadas. Fondo WebGL activo, sin errores JavaScript/consola ni desbordamiento horizontal en las condiciones probadas. Dos fotogramas separados por un segundo muestran cambios de shader y giro de tarjetas. Se corrigió la superposición nueva de Privacidad sobre LinkedIn: la tarjeta de perfil queda delante al abrirse. El dock flotante sigue cubriendo parte del contenido mientras está abierto; no se ha rediseñado su comportamiento.

La primera suite completa obtuvo 9/10 por una espera de reanudación del carrusel; el caso aislado pasó y la repetición completa final obtuvo 10/10. No se afirma que ese resultado elimine toda intermitencia futura.

Carga local fría ES, Chromium 390×844, sin limitación de CPU/red: seis módulos JavaScript solicitados, 20.804 bytes sin comprimir y suma gzip estimada 8.774 bytes. Capa de estadísticas: aproximadamente 4,2 kB gzip dentro de ese total. Ninguna solicitud externa en esa carga y sin errores observados. Son tamaños de archivos locales, no bytes negociados en Cloudflare, Core Web Vitals de usuarios ni comparación controlada de Lighthouse. El SDK anterior ya no forma parte de dependencias o bundle.

## Evidencias y límites

Evidencias locales bajo output/qa/cloudflare-only: build-final.log, counters-final.log, native-beacon.json, native-beacon-final.log, e2e-worker-d1.json, visual-check-final.json, final-network.json y capturas final-es-*.png. La suite Playwright también conserva su JSON estándar en output/qa/analytics y output/qa/text. Los archivos output son locales e ignorados por Git.

Tras autorización expresa se creó D1 danimon-counters en jurisdicción UE y se aplicó el esquema; las seis columnas se inspeccionaron en la consola real (d1-created.png). Pendientes: publicación del Worker con acceso limitado, recepción de acciones reales en D1, cron, red, cuotas y dominio. DNS intacto. La carga estática directa fue rechazada por aprobación automática porque no incorporaba el backend configurado; no produjo un despliegue. El token amplio del formulario GitHub sigue sin aprobarse.

Revisión contractual del beacon y del tratamiento operativo del proveedor pendiente; PUBLIC_CLOUDFLARE_EXEMPTION_REVIEWED permanece false. No se certifica cumplimiento jurídico ni rendimiento sobre hardware móvil real.
