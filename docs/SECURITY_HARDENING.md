# Refuerzo preparado, sin desplegar

Base funcional preservada: `5820951131cc8e5639f47b66cc2118facc39dc5e`. La rama local `codex/security-audit` contiene el commit de código y pruebas `b1f5b6d`, seguido de la documentación. No se ha subido a GitHub porque Pages despliega automáticamente los previews de todas las ramas.

## Qué cambia y por qué

| Archivos | Cambio | Justificación y prueba |
| --- | --- | --- |
| `worker/index.ts`, `worker/write-budget.ts`, `worker/request-body.ts` | Presupuestos de intentos/escrituras, concurrencia y lectura con deadline; 429/Allow; errores controlados. | Reduce trabajo y escrituras frente a ráfagas sin identificar personas. Tests de límite, stream lento, error y D1 local. No es una cuota global. |
| `src/lib/security-policy.ts`, `worker/index.ts` | Cabeceras compartidas y CSP inerte para API/CV Functions. | `_headers` no cubre esas respuestas por sí solo. Tests 200/204/206/4xx, PDF y fallo D1. |
| `astro.config.mjs`, `tools/security-headers.mjs` | Generación tras compilar de CSP con hashes de scripts y estilos inline reales. | Evita hashes manuales obsoletos; el build falla si una línea excede 2.000 caracteres. Se aplica también a 404 mediante regla global. |
| `src/scripts/invoice-demo/copy.ts` | Precisión de privacidad ES/EN. | Distingue OCR local y eventos agregados sin datos del documento. |
| `tools/serve-built-assets.mjs`, `tools/security-preview.mjs` | Entorno QA con `_headers` HTTP y D1 local aislada. | Astro preview normal no garantiza aplicar `_headers`; no basta con que compile. |
| `tools/counter-worker.test.mjs`, `tools/write-budget.test.mjs`, `tools/security-browser-qa.mjs`, `tools/check-counter-e2e.mjs`, `tools/check-security-public.mjs`, `package.json` | Cobertura de riesgos reales y scripts de ejecución. | Pruebas adversas solo locales; comprobador público acotado y sin eventos válidos. |
| `docs/SECURITY_*.md` | Auditoría, operación y recuperación. | Distingue evidencia local, infraestructura y pasos pendientes. |

No se modifican esquema D1, cron, bindings de producción, allowlist, estilos, layout, rutas de navegación, dependencias ni tamaño de la tarjeta.

## Política HTTP preparada

Los estáticos reciben `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy existente, Permissions-Policy que deshabilita cámara/micrófono/geolocalización/pagos/USB y HSTS de 30 días **solo para el host**. Se conservan caché y desactivación NEL/Report-To.

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

## Integración propuesta: requiere aprobación final independiente

1. Revisar los tres informes, diff y commits locales con `git log --oneline main..codex/security-audit` y `git diff main...codex/security-audit`.
2. Decidir explícitamente si se autoriza un preview público. Un push de esta rama o un PR lo activaría con los ajustes actuales; no se han hecho.
3. Con aprobación de producción y el árbol limpio, actualizar main desde origin, confirmar que la base esperada sigue siendo compatible y ejecutar las pruebas anteriores. Si otra persona cambió main, integrar y volver a probar antes de continuar.
4. Crear merge explícito para disponer de rollback inequívoco:

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff codex/security-audit -m "Merge validated portfolio security hardening"
git push origin main
```

Estos comandos **no se han ejecutado**. El último inicia el despliegue automático Pages. No usar `wrangler deploy` sobre `wrangler.bundle.jsonc`: ese archivo solo compila el bundle; no define los bindings de producción Pages.

5. Confirmar éxito del deployment y commit exacto en Pages. Verificar las nuevas cabeceras de HTML, 404, API y CV por HEAD; repetir un flujo normal de portada/OCR y comprobar cero bloqueos CSP legítimos en ambos hosts.
6. Si existe una regresión, seguir [SECURITY_RECOVERY.md](SECURITY_RECOVERY.md). No aplicar migraciones: esta entrega no necesita cambios de esquema.

La autorización de publicación no está implícita en la finalización de esta auditoría.
