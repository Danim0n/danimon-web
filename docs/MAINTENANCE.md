# Modo mantenimiento del portfolio

El Worker de Cloudflare Pages consulta la clave `mode` antes de servir páginas, archivos, CV, redirects o la API. El espacio KV `danimon-site-config` se conecta al proyecto con el binding `SITE_CONFIG`. El estado inicial es `normal`.

| Valor de `mode` | Respuesta |
| --- | --- |
| `normal` | Portfolio, recursos y API habituales. |
| `maintenance` | Página bilingüe, HTTP 503, `Retry-After: 300` y `X-Robots-Tag: noindex, nofollow`. |

## Cambiar de estado en Cloudflare

1. Abre **Storage & databases → Workers KV → danimon-site-config → KV Pairs**.
2. Edita `mode`. Escribe `maintenance` para activar el aviso o `normal` para recuperar el portfolio. Guarda el valor sin establecer un vencimiento.
3. Verifica ambos dominios activos con solicitudes nuevas. La propagación de KV puede tardar alrededor de un minuto o más según la ubicación. Después del despliegue inicial del Worker y su binding, editar esta clave no reconstruye ni redespliega la web. [Consistencia y propagación de KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

```text
curl -I https://danimon.party/
curl -I https://danimon.party/es/proyectos/eventos/
curl -I https://danimon-web.pages.dev/
```

La respuesta de mantenimiento indica cuándo conviene reintentar. Ese valor es una sugerencia HTTP de 300 segundos y la página no anuncia una fecha de reapertura. El idioma se elige por `/es`, por la preferencia del navegador o mediante el enlace de idioma del aviso. Se puede navegar con teclado y leer la página con JavaScript desactivado. La animación dura cuatro segundos y respeta la preferencia de movimiento reducido.

## Cobertura y recuperación

- El control se aplica a cualquier ruta de un despliegue construido con esta versión y enlazado a `SITE_CONFIG`. Las URLs de despliegues anteriores ejecutan sus propias versiones. Para impedir el acceso directo a esas copias mediante hashes o alias, restringe las URLs de despliegue con **Settings → General → Preview access** del proyecto y verifica los enlaces históricos de producción y de preview desde una sesión sin autenticar. La protección de previews es independiente del dominio personalizado y del `pages.dev` principal. Si un hash sigue devolviendo el portfolio, esa copia queda fuera de cobertura. [Acceso a previews de Pages](https://developers.cloudflare.com/pages/configuration/preview-deployments/).
- Para impedir que Pages sirva archivos cuando el proyecto agota la cuota de Functions, configura **Settings → Runtime → Fail open/closed → Fail closed**. Todas las rutas pasan por Functions, por lo que está sujeto a la cuota gratuita. Si se agota, Pages devuelve un error de plataforma también en modo normal. [Routing de Pages Functions](https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed).
- Si la clave falta, contiene un valor distinto de `normal` o el Worker no puede leerla, el sitio devuelve 503. Restablece `mode=normal` para corregir el estado. Si necesitas revertir el propio cambio de código, selecciona el despliegue previo de producción en **Deployments → Rollback to this deployment**. Esa versión recupera el servicio anterior y omite el interruptor. [Rollbacks de Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/).
- Una página ya abierta y las copias descargadas o conservadas por terceros pueden seguir viéndose. El control actúa sobre nuevas peticiones al proyecto.

## Prueba local

Con las dependencias del repo y Chromium de Playwright disponibles, ejecuta `npm run build:pages` y arranca el emulador en una terminal:

```sh
npx wrangler pages dev dist --ip 127.0.0.1 --port 4373 --persist-to output/maintenance-local/state
```

En otra terminal ejecuta `node tools/check-maintenance.mjs`. La prueba cambia únicamente KV local, comprueba `normal` → `maintenance` → `normal` y restaura `normal` al terminar. Guarda resultados y capturas bajo `output/qa/maintenance/`.
