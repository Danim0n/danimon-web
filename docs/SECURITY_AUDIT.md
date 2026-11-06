# Auditoría de seguridad de danimon.party

Fecha: 6 de noviembre de 2026. Base revisada y publicada: `5820951131cc8e5639f47b66cc2118facc39dc5e`. Rama de trabajo: `codex/security-audit`.

## Resultado y límites

No se han confirmado vulnerabilidades críticas o altas en el alcance revisado. El riesgo principal es el abuso de las escrituras de un contador deliberadamente anónimo. La rama reduce ese riesgo y añade defensa en profundidad mediante CSP y cabeceras; **las mejoras todavía no están desplegadas**. No equivale a certificar que la web sea invulnerable.

El diseño, las animaciones, el tamaño móvil de la tarjeta, los idiomas y las funcionalidades se conservan. Solo se precisa el texto de privacidad del OCR. No se han cambiado dependencias ni contratado servicios. No se han modificado DNS, reglas de zona, credenciales, panel, túneles, Xiaomi, backend administrativo, Flutter u otros repositorios/Workers.

Se revisaron fuentes, build, Worker de Pages, retención, migración y consultas D1, recursos OCR, historial Git alcanzable, dependencias, respuestas HTTP de los dos hosts y ajustes visibles de Cloudflare/GitHub. Los ataques controlados se ejecutaron exclusivamente en localhost con D1 aislada. La auditoría de infraestructura fue de lectura, incluida una consulta del esquema; no hubo restauraciones ni cambios de producción.

## Arquitectura y fronteras de confianza

El navegador recibe HTML estático Astro y recursos locales. Solo `/api/*` y `/cv/*` pasan por el Worker según `_routes.json`. El endpoint acepta eventos de catálogo fijo y escribe agregados en `daily_counts`; no ofrece lectura pública. El CV público se sirve aunque falle su contador. Un Worker distinto elimina agregados antiguos por cron. El OCR utiliza una imagen ficticia fija, Worker y modelo locales; no admite archivos del visitante.

Los encabezados `Origin`, `Sec-Fetch-Site` y CORS ayudan contra solicitudes desde otras páginas, pero un cliente automatizado puede falsificarlos. La allowlist de host no es autenticación del visitante. Los dos hosts admitidos comparten agregados intencionadamente; no hay separación de estadísticas por dominio. Los previews y otros subdominios no están admitidos para escribir.

## Inventario de hallazgos y decisiones

| ID | Clasificación | Evidencia y condiciones | Impacto, probabilidad y tratamiento |
| --- | --- | --- | --- |
| S-01 | Medio, abuso de métricas/cuota | En la base, el presupuesto permitía 1.200 solicitudes/minuto por isolate y hasta cinco incrementos por solicitud. Un cliente con el Origin esperado puede repetir eventos válidos. Pruebas locales confirman la aceptación del catálogo y sus incrementos, y la arquitectura confirma que el presupuesto se reinicia por isolate. | Falsificación de agregados y consumo de cuota D1; en Workers Free puede agotar sus 100.000 filas escritas/día documentadas. El plan efectivo de cuenta no se auditó. No permite leer datos, SQL arbitrario ni tomar control del sitio. Probabilidad moderada si alguien dirige tráfico al endpoint. Mitigado localmente con cuotas por unidades de escritura y límites de concurrencia. El ataque distribuido y la falsificación siguen siendo riesgos residuales. |
| H-01 | Informativo, defensa en profundidad | Las respuestas públicas revisadas no tenían CSP, X-Frame-Options, Permissions-Policy ni HSTS. Ya tenían `nosniff` y Referrer-Policy. No se encontró un canal XSS externo explotable. | La ausencia de CSP no es por sí sola una vulnerabilidad crítica. Se preparan hashes de scripts/estilos, restricciones de recursos, framing y permisos. Regresión principal posible: bloquear scripts o WASM legítimos; cubierta con OCR real, WebGL y pruebas de navegador. |
| H-02 | Informativo, mantenimiento | GitHub muestra Dependency graph y Dependabot alerts desactivados, y la página Branches no muestra reglas de protección. Secret Protection y Push protection están activadas. | Riesgo futuro de no recibir avisos o de integrar cambios sin revisión; requeriría una dependencia vulnerable futura, un error o acceso al repositorio. Se documentan pasos manuales, sin modificar permisos ni bloquear al único mantenedor. |
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
| Pages | Proyecto `danimon-web`, build `npm run build:pages`, salida `dist`, producción `main`, despliegues automáticos habilitados. Binding COUNTERS a `danimon-counters`; variables coinciden con la allowlist y beacon legal gate false. | La rama de auditoría no se subió. Todos los branches no productivos tienen preview automático: un push o PR sí desplegaría un preview público. |
| Pages runtime | Compatibility date 2026-08-06; Fail open. | Sin datos privados en assets. Si se alcanza la cuota Functions puede fallar el contador y continuar contenido estático; no debe usarse ese modo como control de acceso a datos privados futuros. No se cambió. |
| D1 | Base `danimon-counters`, ID `ccf6dfcb-d8ca-489b-b2e4-6b2326e388b2`; SELECT del esquema real coincide con la migración. Time Travel ofrece una ventana real desde la creación del 5/11 hasta el momento de la revisión. | Workers Free documenta un máximo de siete días; el plan de cuenta no quedó confirmado. La ventana observada era menor de un día por la edad de la base. No se ha ensayado una restauración real. |
| Retención | Solo binding a esa base; cron `0 3 * * *`; URLs workers.dev/preview desactivadas; sin dominios ni rutas; Logs, Traces e Issues desactivados. Código fetch devuelve 404. | Primera ejecución prevista: 7/11/2026 03:00 UTC. Aún no ocurrida en esta auditoría; prueba de borrado únicamente local. |
| Zona | Plan Free. Protecciones DDoS de red/SSL activas y HTTP siempre habilitada; sin overrides. Sin custom rules ni regla de rate limiting (0/1). | No se probó resistencia a DDoS. No se modificaron reglas generales. |
| GitHub | Repo público, acceso administrativo visible, Secret Protection y Push protection activadas; graph/Dependabot alerts desactivados. | Los permisos efectivos de la instalación Cloudflare requieren reautenticación de GitHub; no se envió un correo de verificación ni se modificó la instalación. No se inspeccionaron credenciales/MFA. |

## Pruebas y evidencias

| Comprobación | Resultado | Evidencia local |
| --- | --- | --- |
| Build Pages y chequeo Astro | 0 errores, warnings e hints; bundle dry-run correcto | `output/qa/security-audit/build-final.log` |
| Worker/D1 + presupuestos/stream | 25/25 | `output/qa/security-audit/counters-final.log` |
| Portfolio funcional | 11/11 bajo CSP HTTP aplicada | `output/qa/text/results.json` |
| QA de seguridad independiente | 11/11, OCR real, cuatro portadas, WASM/Worker, bloqueos CSP y Report-Only | `output/qa/security-audit/security-browser-qa.json` |
| Analítica de navegador | 12/12, DNT/GPC, catálogo, sin identificadores ni datos de factura | `output/qa/security-audit/analytics.log` |
| Beacon nativo | 10 escenarios interceptados; legal gate off conservado | `output/qa/security-audit/native.log` |
| Frontend → Worker → D1 | Correcto con assets/CSP y D1 locales | `output/qa/security-audit/counters-e2e.log` |
| HTTP público acotado | 20/20; HEAD y POST que no pueden escribir | `output/qa/security-audit/public-checks.json` |
| Cabeceras del artefacto final local | 14/14; todas las páginas, 404, API y CV | `output/qa/security-audit/final-artifact-headers.json` |
| Dependencias/historial/OCR | 0 avisos npm, 0 coincidencias de secretos, 8/8 hashes OCR | `npm-audit.json`, `git-secret-scan.json`, `ocr-asset-integrity.json` en esa carpeta |

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

Las correcciones y pruebas están en el commit local `b1f5b6d`; la documentación se conserva en el commit posterior de la misma rama, consultable con `git log main..codex/security-audit`. Los archivos, comandos de prueba y propuesta de integración están en [SECURITY_HARDENING.md](SECURITY_HARDENING.md). Restauración, rollback y ajustes manuales están en [SECURITY_RECOVERY.md](SECURITY_RECOVERY.md).

## Fuentes primarias consultadas

- [OWASP CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) y [Astro set:html](https://docs.astro.build/en/reference/directives-reference/#sethtml).
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [bindings Pages](https://developers.cloudflare.com/pages/functions/bindings/) y [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/).
- [Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) y [WAF rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/).
- [D1 precios/cuotas](https://developers.cloudflare.com/d1/platform/pricing/) y [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
- [GitHub Dependabot alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-alerts) y [seguridad de dependencias](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts).
- [MDN script-src y WASM](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).
