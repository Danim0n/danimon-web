# Auditoría de seguridad de danimon.party

Fecha: 6 de noviembre de 2026. Base funcional: `5820951131cc8e5639f47b66cc2118facc39dc5e`. El refuerzo se integró en `main` mediante `3637e7ac8a9bd44ed2d4b4733cb3cdb35adf6e0a` (padres `5820951` y `f828aaa`) y su primer despliegue publicado fue `afd9dd44-725d-49b7-b3b0-cdcb03582d4d`.

## Estado de publicación y verificación

El primer despliegue de seguridad terminó correctamente. La comprobación inicial encontró `NEL max_age:604800` y `Report-To` en respuestas estáticas, además de diferencias de caché en CV/recursos. El commit de corrección `7a6000ec32997c6ee4367cfb1d9e78ac7da9072c` consolidó las cabeceras y evita reglas globales duplicadas; el deployment `4ed62b29-4e69-4439-b742-2839a5317e9b` terminó con éxito. La verificación posterior confirmó en ambas raíces NEL con `max_age=0` y sin `Report-To`; CSP/hashes válidos en las 22 respuestas HTML/404; TLS válido; y el CV sin query servido por Pages Function con HTTP 200, CSP inerte, `no-store` y `BYPASS` de caché en el apex. Se purgaron solo cuatro URLs precisas: PDF de CV, dos CSS y el JS `FluidBackground`; no se purgó toda la zona ni se alteró TTL.

El informe inicial se conserva en `output/qa/security-deployment/release-http.json`; la comprobación final acotada (40 solicitudes, 0 fallos) y todos sus headers están en `release-http-followup.json`. No se enviaron eventos válidos ni se descargó el CV por GET durante el checker. La revisión final de datos D1 y la verificación funcional de navegador se completaron; se distinguen debajo los límites de interpretación.

## Resultado y límites

No se han confirmado vulnerabilidades críticas o altas en el alcance revisado. El riesgo principal es el abuso de las escrituras de un contador deliberadamente anónimo. El refuerzo de límites, CSP y cabeceras está publicado y se verificó en los dos hosts. No equivale a certificar que la web sea invulnerable.

El diseño, las animaciones, el tamaño móvil de la tarjeta, los idiomas y las funcionalidades se conservan. Se precisó el texto de privacidad del OCR. No se han cambiado dependencias ni contratado servicios. No se han modificado DNS, reglas de zona, credenciales, túneles, Xiaomi, backend administrativo, Flutter u otros repositorios/Workers. Sí se publicaron cambios de la app en Pages y se activaron controles de seguridad del repositorio GitHub, indicados más abajo.

Se revisaron fuentes, build, Worker de Pages, retención, migración y consultas D1, recursos OCR, historial Git alcanzable, dependencias, respuestas HTTP de los dos hosts y ajustes visibles de Cloudflare/GitHub. Los ataques controlados se ejecutaron exclusivamente en localhost con D1 aislada. La auditoría inicial de infraestructura fue de lectura, incluida una consulta del esquema. La publicación posterior cambió la app en Pages y controles de GitHub; no cambió D1, DNS ni reglas generales de zona.

## Arquitectura y fronteras de confianza

El navegador recibe HTML estático Astro y recursos locales. Solo `/api/*` y `/cv/*` pasan por el Worker según `_routes.json`. El endpoint acepta eventos de catálogo fijo y escribe agregados en `daily_counts`; no ofrece lectura pública. El CV público se sirve aunque falle su contador. Un Worker distinto elimina agregados antiguos por cron. El OCR utiliza una imagen ficticia fija, Worker y modelo locales; no admite archivos del visitante.

Los encabezados `Origin`, `Sec-Fetch-Site` y CORS ayudan contra solicitudes desde otras páginas, pero un cliente automatizado puede falsificarlos. La allowlist de host no es autenticación del visitante. Los dos hosts admitidos comparten agregados intencionadamente; no hay separación de estadísticas por dominio. Los previews y otros subdominios no están admitidos para escribir.

## Inventario de hallazgos y decisiones

| ID | Clasificación | Evidencia y condiciones | Impacto, probabilidad y tratamiento |
| --- | --- | --- | --- |
| S-01 | Medio, abuso de métricas/cuota | En la base, el presupuesto permitía 1.200 solicitudes/minuto por isolate y hasta cinco incrementos por solicitud. Un cliente con el Origin esperado puede repetir eventos válidos. Pruebas locales confirman la aceptación del catálogo y sus incrementos, y la arquitectura confirma que el presupuesto se reinicia por isolate. | Falsificación de agregados y consumo de cuota D1; en Workers Free puede agotar sus 100.000 filas escritas/día documentadas. El plan efectivo de cuenta no se auditó. No permite leer datos, SQL arbitrario ni tomar control del sitio. Probabilidad moderada si alguien dirige tráfico al endpoint. Mitigado localmente con cuotas por unidades de escritura y límites de concurrencia. El ataque distribuido y la falsificación siguen siendo riesgos residuales. |
| H-01 | Informativo, defensa en profundidad | Antes del primer despliegue, las respuestas públicas inspeccionadas carecían de parte de las cabeceras. En la primera publicación se detectaron NEL activo, `Report-To` y caché vieja en algunos recursos. No se encontró un canal XSS externo explotable. | El fix de reglas se desplegó y la comprobación posterior verificó NEL=0, ausencia de `Report-To`, CSP/hashes y cabeceras de CV Function en ambos hosts. La ausencia inicial de CSP no era por sí sola vulnerabilidad crítica. |
| H-02 | Informativo, mantenimiento | En la auditoría inicial, Dependency graph y Dependabot alerts estaban desactivados, y no se veía protección de rama. | Dependency graph, Dependabot alerts y security updates están ahora activados, con auto-merge desactivado. El ruleset de `main` sigue como borrador no guardado por confirmación de email de acceso; force-push y borrado aún no quedan impedidos por esa regla. |
| H-03 | Bajo, exactitud de privacidad | El OCR decía «sin llamadas a una API», pero el sitio podía enviar eventos agregados de uso. El cuerpo de esos eventos es cerrado y no contiene texto de la factura. | No se confirmó transmisión de facturas. Se corrige la afirmación en ambos idiomas para distinguir procesamiento local y recuentos agregados. Riesgo de regresión mínimo: solo texto. |

Para S-01, la modificación conserva el techo de intentos para proteger el parseo y añade 300 eventos válidos/minuto, 60 recuentos de CV/minuto, ocho batches D1 concurrentes y 16 cuerpos POST simultáneos, con 2 KiB y plazo total de 10 s. El POST excedido devuelve 429; el CV se sigue sirviendo y se omite su contador. JSON inválido no consume el presupuesto de escrituras, aunque sí el de intentos. Los recursos reservados se liberan ante fallos. No se guarda IP ni identificador alguno.

La limitación es importante: esos valores **no son una cuota global de cuenta**. Instancias nuevas o repartidas pueden multiplicarlos. Tampoco existe deduplicación de replays entre peticiones, porque añadir tokens de visitante/sesión cambiaría el diseño de privacidad. La deduplicación dentro de un lote y la prevención de dobles eventos accidentales del frontend se mantienen.

## Protecciones existentes conservadas

- Ruta exacta y sin query del endpoint; POST únicamente, Content-Type JSON, límites de tamaño tanto declarados como leídos, lotes de 1–5 eventos y esquema cerrado de cuatro propiedades. Las listas de valores fijan también las longitudes máximas efectivas.
- Host exacto y Origin coincidente; rechazo de previews, hosts ajenos y cruces entre los dos hosts. Sin CORS permisivo en la API.
- Catálogo de eventos, prohibición de enviar el contador reservado de entrega del CV, comprobación del proyecto y rechazo de duplicados dentro de un lote.
- SQL parametrizado y UPSERT atómico; siete consultas administrativas de lectura únicamente en archivos locales; sin endpoint público de estadísticas.
- Errores vacíos/controlados, sin stack, sin cookies y con `no-store`; disponibilidad de assets/CV separada del éxito de D1.
- DNT y GPC; sin PostHog, sesiones, replay ni identificadores. Cloudflare Web Analytics nativo sigue desactivado. No se añadieron destinos de informes CSP o monitorización externa.
- OCR sin subida de documentos: una sola imagen ficticia, carga diferida del modelo, salida mediante `textContent`/`.value`, validación de la revisión guardada, cancelación/timeout y terminación de Workers, revocación de Blob URLs.
- Enlaces externos con `noopener noreferrer`, CV fijo y descarga local JSON. `.env` y archivos operativos ignorados por Git.

## Revisión de código y dependencias

No se encontró una inyección SQL, XSS explotable, API administrativa pública o lectura arbitraria confirmada. `set:html` solo inserta JSON-LD con constantes controladas. Las pruebas con texto hostil en localStorage verifican representación literal; el propio test siembra esos datos, por lo que no demuestra un vector de entrada externo.

`npm audit` informó **0 vulnerabilidades conocidas**. Esto no cubre vulnerabilidades aún no publicadas. El lockfile fija resoluciones e integridad; no se hizo una actualización masiva. No había workflows GitHub Actions rastreados; no se añadieron acciones de terceros ni nuevos secretos.

Se examinaron los 13 commits y 232 blobs alcanzables con firmas de claves privadas y tokens conocidos, sin coincidencias. No se omitieron blobs por tamaño. El escaneo es heurístico, no una garantía sobre credenciales desconocidas, forks, clones o refs inaccesibles. Los antiguos agentes/skills se consideraron parte del historial revisado; no se reescribió el historial ni se recrearon esos archivos.

Los ocho assets OCR coinciden con el manifiesto SHA-256 local. Worker y variantes WASM coinciden con las distribuciones instaladas de Tesseract; el origen del modelo no se verificó mediante una segunda firma independiente. No se transmite la imagen a terceros durante los flujos comprobados.

## Infraestructura real observada

| Elemento | Observación comprobada en lectura | Pendiente o limitación |
| --- | --- | --- |
| Pages | Proyecto `danimon-web`, build `npm run build:pages`, salida `dist`, producción `main`, despliegues automáticos habilitados. Merge/deploys anotados arriba; binding COUNTERS a `danimon-counters`; variables coinciden con allowlist y beacon legal gate false. | Respuestas de ambos hosts verificadas tras el fix. La instalación de GitHub App `145311944` aún requiere reautenticación para revisar permisos. |
| Pages runtime | Compatibility date 2026-08-06; Fail open. | Sin datos privados en assets. Si se alcanza la cuota Functions puede fallar el contador y continuar contenido estático; no debe usarse ese modo como control de acceso a datos privados futuros. No se cambió. |
| D1 | Base `danimon-counters`, ID `ccf6dfcb-d8ca-489b-b2e4-6b2326e388b2`; esquema sigue siendo el mismo de seis columnas y coincide con la migración. Lectura anterior/posterior: 72 filas/241 acciones → 91 filas/298 acciones; todas las filas previas están presentes, ningún total disminuyó (`missingOrDecreased=[]`). | No hubo restauración, cambios de esquema ni escrituras manuales para generar evidencia. Los contadores son agregados anónimos, no usuarios únicos; el incremento no se atribuye a una sola sesión o descarga. Time Travel se describe según la observación histórica abajo. |
| Retención | Solo binding a esa base; cron `0 3 * * *`; URLs workers.dev/preview desactivadas; sin dominios ni rutas; Logs, Traces e Issues desactivados. Código fetch devuelve 404. | La próxima ejecución es el 7/11/2026 a las 03:00 UTC. El 6/11 a las 15:36 UTC aún era futura; el historial no tenía ejecuciones. No se ejecutará manualmente. |
| Zona | Plan Free. Protecciones DDoS de red/SSL activas y HTTP siempre habilitada; sin overrides. Sin custom rules ni regla de rate limiting (0/1). | No se probó resistencia a DDoS. No se modificaron reglas generales. |
| GitHub | Dependency graph, Dependabot alerts y security updates activados; auto-merge off. Secret Protection y Push protection activadas. | Ruleset de `main` quedó como borrador no guardado por confirmación de email. La app Cloudflare `145311944` pidió reautenticación para revisar permisos; pendiente verificar/reautenticar. No se inspeccionaron credenciales/MFA. |

En la comparación D1, los contadores de respuestas de CV en español pasaron de 6 a 8 y los clics en CV de 1 a 2; también aumentaron los eventos de guardar/exportar OCR en inglés y leer OCR en español. Son diferencias entre lecturas agregadas. No demuestran dos descargas por una misma persona ni identifican visitantes. Dos descargas muestreadas del PDF devolvieron el mismo hash SHA-256 (prefijo `91A1C757`); no se descargó el CV durante la comprobación HTTP automatizada.

## Pruebas y evidencias

| Comprobación | Resultado | Evidencia local |
| --- | --- | --- |
| Build Pages y chequeo Astro | 0 errores, warnings e hints; bundle dry-run correcto | `output/qa/security-audit/build-final.log` |
| Worker/D1 + presupuestos/stream | 25/25 | `output/qa/security-audit/counters-final.log` |
| Reglas de cabeceras Pages | 3/3: NEL + retirada de Report-To junto con CSP en una sola ruta; hashes conservados; duplicados rechazados | `tools/security-headers.test.mjs` |
| Portfolio funcional | 11/11 bajo CSP HTTP aplicada | `output/qa/text/results.json` |
| QA de seguridad independiente | 11/11, OCR real, cuatro portadas, WASM/Worker, bloqueos CSP y Report-Only | `output/qa/security-audit/security-browser-qa.json` |
| Analítica de navegador | 12/12, DNT/GPC, catálogo, sin identificadores ni datos de factura | `output/qa/security-audit/analytics.log` |
| Beacon nativo | 10 escenarios interceptados; legal gate off conservado | `output/qa/security-audit/native.log` |
| Frontend → Worker → D1 | Correcto con assets/CSP y D1 locales | `output/qa/security-audit/counters-e2e.log` |
| HTTP público del primer deployment | 40 solicitudes; encontró NEL activo/Report-To y respuestas de caché antiguas que motivaron el fix | `output/qa/security-deployment/release-http.json` |
| HTTP público tras el fix | 40 solicitudes, dos hosts, cero fallos; 22 HTML/404, seis HEAD, seis POST inválidos con respuestas vacías y seis assets; TLS válido; `NEL max_age=0`, sin `Report-To`, CSP/hashes correctos y CV Function con CSP inerte/no-store | `output/qa/security-deployment/release-http-followup.json` (headers completos) |
| Cabeceras del artefacto final local | 14/14; todas las páginas, 404, API y CV | `output/qa/security-audit/final-artifact-headers.json` |
| Dependencias/historial/OCR | 0 avisos npm, 0 coincidencias de secretos, 8/8 hashes OCR | `npm-audit.json`, `git-secret-scan.json`, `ocr-asset-integrity.json` en esa carpeta |

Las suites locales registradas al integrar cubren `npm test` funcional 11/11, seguridad 11/11, analítica 12/12, Worker/D1 25/25, e2e frontend→Worker→D1, y tres pruebas para reglas de cabeceras. La prueba nativa de analítica fue 10/10 tras un retry por `ECONNRESET`.

La comprobación del navegador público en móvil de 390 px verificó OCR real en inglés y español, guardado y exportación JSON válida, navegación de cuatro tarjetas con teclado, arrastre, cambio EN/ES y WebGL activo. Tras el fix se comprobó también en `pages.dev` la lectura OCR en inglés con tres valores correctos; consola limpia. No hubo errores de consola ni bloqueos CSP legítimos observados. Se comprobó selector de correo. En Chrome el enlace de LinkedIn abrió una pestaña nueva con el perfil correcto y mantuvo la web original. El emulador público de navegador no permitió activar `prefers-reduced-motion`; ese comportamiento se verificó en las pruebas locales, no en el navegador público. Las evidencias más recientes están en `output/qa/security-deployment/`; los resultados iniciales siguen en `output/qa/security-audit/`.

Cloudflare Pages Metrics mostró Web Analytics desactivado (captura `pages-analytics-disabled.png`). El resumen puntual de las últimas 24 horas mostró 417 solicitudes correctas y cero errores; es solo una observación del panel, no un SLA ni una medida de disponibilidad garantizada.

Las pruebas cubren métodos, JSON inválido, campos desconocidos, valores SQL/XSS rechazados, cuerpo chunked excesivo, MIME, Origin/host, query, límites, concurrencia, reanudación de presupuestos, fallos D1 y ausencia de API administrativa. Cien incrementos en grupos concurrentes de hasta ocho conservan el total exacto. Se comprueba que 429 no añade filas y que el CV sigue disponible al agotar su presupuesto.

El navegador comprueba que funcionan los scripts legítimos y que se bloquean script inline, evento HTML inline, JavaScript eval, script externo y fetch externo antes de salir a red. Pruebas ejecutadas en Chromium de Windows y viewports/touch emulados; no se presenta como prueba física de iOS/Android, Firefox/Safari o de todos los puntos de presencia de Cloudflare.

Las capturas `csp-home-es-390.png`, `csp-home-en-1440.png`, `csp-invoice-es-desktop.png` y `csp-invoice-en-mobile.png` fueron abiertas e inspeccionadas por el agente principal. El QA independiente inspeccionó además los fotogramas del carrusel. No se cambió la composición.

## Revisión independiente y recursos utilizados

Se reutilizaron dos agentes existentes de la sesión: auditor backend/Cloudflare y auditor frontend/historial/QA. La implementación CSP y su integración fueron revisadas por un agente distinto a su autor. La revisión final y sus límites se conservan en `output/qa/security-audit/independent-review.md`. No se alteraron modelos mediante TOML ni se atribuye a la sesión un modelo no comprobado por las herramientas.

Se aplicó `find-skills` para el descubrimiento. Se inspeccionaron fuentes oficiales de Cloudflare (`security-audit-skill` y `workers-best-practices`), OWASP (`secure-agent-playbook`), GitHub (`awesome-copilot/security-review`), Microsoft (`playwright-cli`) y Astro (`astro-developer`). No se instalaron ni ejecutaron paquetes de skills nuevos: sus flujos generales o dirigidos a otros repositorios no añadían una comprobación necesaria a los tests y documentación primaria ya disponibles. No se afirma haber aplicado íntegramente esas skills.

## Riesgos residuales, medidas descartadas y coste

Persisten la manipulación de estadísticas anónimas y el agotamiento distribuido de cuotas gratuitas. Un isolate compartido puede rechazar interacciones legítimas si se satura; el frontend no bloquea navegación y no reintenta con identificadores. Retención puede fallar temporalmente si D1 no está disponible; no se ha prometido borrado cron verificado hasta su ejecución real.

No se migró Pages ni se añadieron KV, Durable Objects, CAPTCHA, cuentas, IPs o fingerprints. La lista oficial de bindings Pages no documenta Rate Limiting API; no se asumió que una propiedad Wrangler de Workers fuera compatible con el proyecto real. Según la documentación consultada, WAF Free permite Path/Verified Bot en la expresión e IP para el conteo, sin filtro Host. Una regla solo por ruta podría afectar otros hosts de la zona y no cubriría el hostname Pages. No se creó.

No se activaron HSTS includeSubDomains/preload, COEP/COOP ni Trusted Types como medidas genéricas sin una necesidad demostrada. La CSP permite estilos de atributo por las transformaciones/variables CSS existentes y WASM por Tesseract, pero no JavaScript eval ni scripts inline sin hash. Un futuro beacon externo quedaría bloqueado por esta política y necesitaría una revisión separada; no se ha habilitado ahora.

Coste adicional previsto: **0 €**, sin recursos contratados ni nuevas dependencias. El bundle Worker medido con el mismo esbuild pasó de 7.130 a 10.985 bytes (gzip 2.512 → 3.655); la línea CSP ocupa 729 bytes. Las protecciones no añaden JavaScript de seguridad al navegador ni solicitudes externas, lecturas D1 o escrituras auxiliares. No se ha medido latencia real del edge, Lighthouse nuevo ni consumo en dispositivos físicos: no se promete una mejora de rendimiento no medida.

El refuerzo publicado está en el merge `3637e7ac8a9bd44ed2d4b4733cb3cdb35adf6e0a`; la corrección de reglas y el checker están en `7a6000ec32997c6ee4367cfb1d9e78ac7da9072c`. La comprobación posterior del edge está completada con cero fallos; los pendientes reales son la reautenticación de GitHub y la primera ejecución futura del cron, descritos arriba. Procedimiento reproducible en [SECURITY_HARDENING.md](SECURITY_HARDENING.md); rollback y recuperación en [SECURITY_RECOVERY.md](SECURITY_RECOVERY.md).

## Fuentes primarias consultadas

- [OWASP CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) y [Astro set:html](https://docs.astro.build/en/reference/directives-reference/#sethtml).
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [bindings Pages](https://developers.cloudflare.com/pages/functions/bindings/) y [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/).
- [Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) y [WAF rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/).
- [D1 precios/cuotas](https://developers.cloudflare.com/d1/platform/pricing/) y [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
- [GitHub Dependabot alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-alerts) y [seguridad de dependencias](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts).
- [MDN script-src y WASM](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).
