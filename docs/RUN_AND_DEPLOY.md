# Desarrollo y compilación

Requiere Node 24 y npm.

~~~powershell
npm ci
npm run dev
~~~

La dirección local muestra la versión inglesa. Añadir /es/ para español.

~~~powershell
npm run build
npm run preview -- --port 4325 --ignore-lock
~~~

El build estático se genera en dist. wrangler.jsonc configura Cloudflare Workers Static Assets. La configuración de analítica se establece en el entorno de compilación siguiendo ANALYTICS.md. La compilación no publica el sitio.

Con el preview normal abierto, npm test ejecuta las pruebas del portfolio. npm run test:analytics levanta una compilación aislada y usa proveedores simulados o peticiones interceptadas.
