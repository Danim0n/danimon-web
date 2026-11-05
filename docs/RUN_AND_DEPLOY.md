# MATERIA en PowerShell

Desde la carpeta del proyecto, con Node 24 y npm:

~~~powershell
$env:ASTRO_TELEMETRY_DISABLED='1'
npm install
npm run build
npm run preview -- --port 4325 --ignore-lock
~~~

Abrir http://127.0.0.1:4325/ y http://127.0.0.1:4325/es/. Para editar con recarga automática, usar npm run dev. El servidor escucha en la máquina local.

Con preview abierto en otra terminal:

~~~powershell
$env:PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"
npx playwright install chromium
npm test
node tests/zoom.mjs
node tests/lifecycle.mjs
node tools/materia-measure.mjs
~~~

Los medios, pies y traducciones se configuran en src/data. Sustituir las dos ilustraciones conceptuales solo con material autorizado. Para vídeo, proporcionar poster, controles y texto alternativo o descripción bilingüe. Añadir CV cuando exista un archivo público real y correo cuando Dani facilite la dirección. La fuente autoalojada conserva su licencia en docs/FONT_LICENSE.txt.

Cloudflare Workers Static Assets sirve dist conforme a wrangler.jsonc. La publicación y asignación de dominio requieren autorización separada. No se han hecho cambios en la cuenta de Cloudflare.

El ZIP output/recovery/pre-materia.zip guarda código, medios, pruebas y configuración del diseño anterior. Para recuperarlo, extraer en una carpeta de proyecto vacía y reinstalar desde su lockfile. No contiene dependencias ni secretos.
