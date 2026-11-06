# Verificación de bindings de Pages

El archivo wrangler.bundle.jsonc solo compila JavaScript. Su resumen «No bindings found» no describe el entorno de Pages. El binding de ejecución COUNTERS está en el archivo raíz wrangler.jsonc, junto a pages_build_output_dir y las variables de producción.

La [documentación oficial de Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) establece ese archivo como configuración de desarrollo y despliegue; se aplica creando una publicación mediante integración Git. Las [vinculaciones D1](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases) se configuran ahí o en el panel. Los bindings no son credenciales incrustadas dentro del código compilado.

La compilación build:pages verifica que exista el binding y que las listas de orígenes de cliente y ejecución coincidan exactamente con el apex y el hostname de producción pages.dev. El paquete contiene _worker.js y _routes.json, además de los assets.

## Prueba independiente

Wrangler 4.158.0 ejecutó pages dev sobre dist, usando el archivo raíz real y una base local. Mostró explícitamente env.COUNTERS (danimon-counters), D1 Database, local, y COUNTERS_ENABLED=true. Se cambió únicamente PUBLIC_ORIGIN a localhost para la prueba.

POST /api/interactions devolvió 204; /es/ devolvió 200; el PDF devolvió 200 application/pdf y 81.918 bytes. SELECT local comprobó incrementos de cv_download_clicked y cv_response_served. Evidencia: output/qa/cloudflare-only/pages-binding-proof.md y sus registros asociados.

Esto acredita la configuración y ejecución locales de Pages, no la recepción remota. En Cloudflare ya se crearon la base real y sus seis columnas mediante el panel; comprobar la configuración efectiva y filas alojadas después de publicar. La jurisdicción UE se seleccionó al crear la base, no mediante un campo del binding: ese campo no lo admite Wrangler y se retiró.
