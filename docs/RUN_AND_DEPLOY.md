# Desarrollo y despliegue

Requiere Node 24 y npm. La compilación local no publica nada.

~~~powershell
npm ci
npm run dev
~~~

Inglés en / y español en /es/.

~~~powershell
npm run build
npm run preview -- --port 4325 --ignore-lock
~~~

Con ese preview abierto: npm test. npm run test:analytics compila y abre su servidor aislado. npm run test:counters compila el Worker y usa D1 local. Después de esas dos pruebas, npm run test:counters:e2e conecta frontend, Worker y D1 en localhost. npm run test:native descarga o reutiliza el script público oficial e intercepta todas las mediciones.

## Publicación con GitHub y Pages

Se utiliza la conexión existente de Cloudflare con Danim0n/danimon-web, sin autorizar tokens de toda la cuenta. El flujo Workers Builds proponía permisos sobre otros servicios; no se ha confirmado. Estado remoto real en DEPLOYMENT_STATE.md.

- Proyecto Pages: danimon-web; rama main; Node 24.
- Build command: npm run build:pages; output: dist.
- PUBLIC_ANALYTICS_MODE=production; PUBLIC_COUNTERS_ORIGIN=https://danimon-web.pages.dev.
- PUBLIC_CLOUDFLARE_EXEMPTION_REVIEWED=false hasta resolver garantías jurídicas.
- wrangler.jsonc contiene COUNTERS y las variables de ejecución para Pages.

build:pages genera Astro y compila worker/index.ts sin acceso remoto mediante wrangler.bundle.jsonc. Copia el resultado a dist/_worker.js y genera _routes.json para /api/* y /cv/*. Se incluye el backend real en la publicación; no es una carga únicamente estática. El resto de assets se sirve directamente. El build de ramas distintas de main apaga los contadores.

La base danimon-counters ya existe en jurisdicción UE y contiene el esquema de migrations/0001_counters.sql. Su ID en configuración es público, no una credencial. No crear otra base al repetir el despliegue. Las consultas privadas están en queries/counters.sql.

## Retención

Pages no programa el método scheduled de _worker.js. El Worker específico danimon-counters-retention usa worker/retention.ts y la misma base, con ejecución diaria a las 03:00 UTC. No sirve estadísticas ni necesita rutas del dominio. Su configuración reproducible está en wrangler.retention.jsonc, con logs y workers.dev apagados.

Si se despliega por CLI en el futuro, usar un token limitado al recurso existente y autorizado, nunca el token amplio por defecto. No guardar credenciales en GitHub, Astro o documentación. No usar wrangler login para eludir esa limitación: su OAuth no permite limitar los permisos a un solo recurso.

## Comprobación y reversión

Tras publicar: probar acciones y filas D1, CV, idiomas, red, almacenamiento, rutas administrativas 404, logs efectivos, cron y ausencia de beacon inesperado. El preview Astro no ejecuta el endpoint de Pages.

No cambiar DNS automáticamente. La URL pages.dev permite verificar el portfolio sin conectar danimon.party. Conectar el dominio requiere autorización aparte y ajustar los dos orígenes de build/ejecución.

Para detener escrituras: COUNTERS_ENABLED=false y republicar. Para detener envíos: PUBLIC_ANALYTICS_MODE=off y recompilar. Los backups locales de código están en output/recovery; no incluyen una copia de la base alojada. No borrar bases, cuentas o recursos como parte de la reversión sin una decisión expresa.
