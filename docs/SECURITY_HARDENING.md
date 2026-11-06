# Refuerzo de seguridad publicado y verificado

La integración está en `main` mediante el merge `3637e7ac8a9bd44ed2d4b4733cb3cdb35adf6e0a`, con padres `5820951131cc8e5639f47b66cc2118facc39dc5e` y `f828aaa`. El primer despliegue de producción terminó correctamente con ID `afd9dd44-725d-49b7-b3b0-cdcb03582d4d`.

La verificación posterior detectó que Pages aplicó `NEL` con `max_age:604800` y añadió `Report-To` a respuestas estáticas, aunque la configuración fuente pedía desactivarlos. La causa se corrigió en el commit `7a6000ec32997c6ee4367cfb1d9e78ac7da9072c`: el generador fusiona la regla global y evita duplicados. El despliegue `4ed62b29-4e69-4439-b742-2839a5317e9b` terminó correctamente desde ese commit, con alias `danimon.party`. La comprobación final encontró `NEL max_age=0`, sin `Report-To`, y ninguna falla en los dos hosts.

La rama ya no está pendiente de integración. La sección de abajo sobre builds y pruebas locales sigue describiendo cómo reproducirlas, no un paso previo a publicar.

## Qué cambia y por qué

| Archivos | Cambio | Justificación y prueba |
| --- | --- | --- |
| `worker/index.ts`, `worker/write-budget.ts`, `worker/request-body.ts` | Presupuestos de intentos/escrituras, concurrencia y lectura con deadline; 429/Allow; errores controlados. | Reduce trabajo y escrituras frente a ráfagas sin identificar personas. Tests de límite, stream lento, error y D1 local. No es una cuota global. |
| `src/lib/security-policy.ts`, `worker/index.ts` | Cabeceras compartidas y CSP inerte para API/CV Functions. | `_headers` no cubre esas respuestas por sí solo. Tests 200/204/206/4xx, PDF y fallo D1. |
| `astro.config.mjs`, `tools/security-headers.mjs` | Generación tras compilar de CSP con hashes reales y fusión en una sola regla global de Pages. | Evita hashes manuales obsoletos y valores de cabecera duplicados; el build falla ante reglas globales duplicadas o líneas que exceden 2.000 caracteres. |
| `src/scripts/invoice-demo/copy.ts` | Precisión de privacidad ES/EN. | Distingue OCR local y eventos agregados sin datos del documento. |
| `tools/serve-built-assets.mjs`, `tools/security-preview.mjs`, `tools/security-headers.test.mjs` | Entorno QA con `_headers` HTTP y D1 local aislada; parser local estricto ante reglas repetidas. | Evita que el servidor de pruebas oculte diferencias entre reglas duplicadas y cómo Pages combina cabeceras. |
| `tools/counter-worker.test.mjs`, `tools/write-budget.test.mjs`, `tools/security-browser-qa.mjs`, `tools/check-counter-e2e.mjs`, `tools/check-security-public.mjs`, `tools/check-security-release.mjs`, `package.json` | Cobertura de riesgos reales y scripts de ejecución. | Pruebas adversas solo locales; check de release acotado y sin eventos válidos ni GET del CV. |
| `docs/SECURITY_*.md` | Auditoría, operación y recuperación. | Distingue evidencia local, infraestructura y pasos pendientes. |

No se modifican esquema D1, cron, bindings de producción, allowlist, estilos, layout, rutas de navegación, dependencias ni tamaño de la tarjeta.

## Política HTTP desplegada y verificada

La configuración generada para los estáticos pide `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy que deshabilita cámara/micrófono/geolocalización/pagos/USB y HSTS de 30 días **solo para el host**. También pide `NEL: {"max_age":0}` y la eliminación de `Report-To`. Tras el fix, las respuestas comprobadas en `danimon.party` y `danimon-web.pages.dev` cumplen NEL=0 y no incluyen `Report-To`; las páginas conservan CSP/hashes. El CV se verificó a través de Pages Function con CSP inerte y `no-store`. Para corregir recursos antiguos se invalidaron únicamente cuatro URLs exactas: el CV, los dos CSS de Portfolio y el JavaScript `FluidBackground` con hash `Uz6VGmFA`. No se purgó la zona completa ni se cambió TTL.

La CSP usa `default-src 'none'`; scripts locales y hashes de inline legítimos; `wasm-unsafe-eval` para compilar el OCR en su Worker local. No autoriza `unsafe-eval` JavaScript ni `unsafe-inline` en scripts. Los handlers HTML inline se prohíben. Estilos locales y hashes; se permiten atributos de estilo necesarios para CSS 3D/variables y el resaltado OCR. Fuentes, conexiones y Workers son locales; imágenes locales/data para el favicon. No hay iframes, plugins, formularios que se envíen a otro destino ni receptores de reportes CSP.

El conjunto de hashes es común a las páginas compiladas; se regenera en cada build. Los artefactos de evidencia quedan en `output/`, nunca dentro del directorio público. En API/CV se usa una política más pequeña sin ejecución de scripts. El OCR conserva su descarga JSON Blob sin autorizar scripts Blob.

La CSP actual no permite Cloudflare Insights ni otros servicios externos. Activarlos en el futuro requiere una revisión explícita y probar de nuevo la política. No cambiar la CSP solo para silenciar errores de consola.

## Ejecutar y comprobar localmente

Requisitos: Node 24, dependencias del lockfile instaladas con `npm ci`, Chromium de Playwright disponible en `.cache/ms-playwright`. Los recursos y librerías existentes se conservan.

Desde PowerShell, sin desplegar:

```powershell
$env:WRANGLER_SEND_METRICS='false'
$env:WRANGLER_LOG_PATH='./output/qa/security-audit/wrangler'
npm run build:pages
npm run test:counters
npm run preview:security
```

El último comando mantiene abierto `http://127.0.0.1:4325/` con el Worker y una D1 desechable exclusivamente local. Usa 4325 libre; no pares otros servidores del propietario. Desde otra terminal:

```powershell
npm test
npm run test:security
npm run test:analytics
npm run test:counters:e2e
npm run test:native
```

`test:counters:e2e` utiliza el build `output/analytics-test-dist` generado por `test:analytics` y la compilación Worker generada por `test:counters`. Todos esos tests usan contextos/datos locales; las solicitudes externas del test de beacon están interceptadas. El servidor normal de desarrollo sigue siendo `npm run dev`; para validar seguridad HTTP usa `preview:security`.

Para repetir compatibilidad Report-Only, inicia en una tercera terminal:

```powershell
$env:SECURITY_PREVIEW_PORT='4336'
$env:SECURITY_CSP_REPORT_ONLY='true'
npm run preview:security
```

Y en la terminal de pruebas:

```powershell
$env:SECURITY_REPORT_ONLY_URL='http://127.0.0.1:4336'
npm run test:security
```

No existe endpoint de informes ni recopilación externa. El script verifica violaciones mediante eventos de navegador. Ctrl+C detiene los servidores locales. Los directorios D1 de prueba solo contienen fixtures, nunca son el binding remoto.

La comprobación pública opcional `node tools/check-security-public.mjs` hace solo 20 solicitudes pequeñas controladas entre los dos hosts: HEAD, JSON inválido/esquema inválido y Origin ajeno. No envía un evento válido, no descarga el CV por GET ni ejecuta fuzzing/carga. No debe sustituirse por una prueba de ráfagas en producción.

## Estado de comprobación

El análisis de regresión encontró que el helper local ocultaba la semántica de Pages: si una misma cabecera se aplica más de una vez, Pages une sus valores con coma. El generador ahora emite una única regla global y hay tres pruebas locales de fusión, hashes y rechazo de reglas duplicadas.

La verificación final hizo 40 solicitudes acotadas: dos TLS válidos, 22 páginas/404, seis HEAD, seis POST inválidos con respuestas esperadas y cuerpo vacío, y seis recursos same-host; cero fallos. No envió eventos válidos ni descargó el CV por GET. Los headers completos están en `output/qa/security-deployment/release-http-followup.json`. La comparación de D1 confirmó esquema sin cambios y agregados que no disminuyeron; ver [SECURITY_AUDIT.md](SECURITY_AUDIT.md). No se requirieron migraciones ni cambios en D1 o DNS. Para recuperación, consultar [SECURITY_RECOVERY.md](SECURITY_RECOVERY.md).
