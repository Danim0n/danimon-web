# danimon-web
Web estática de texto en inglés (/) y español (/es/). Incluye perfil, formación, proyectos, tecnologías y contacto profesional.

Desde PowerShell:
~~~powershell
cd "C:\Users\dani_\Desktop\Proyectos\web_danimon"
$env:ASTRO_TELEMETRY_DISABLED = "1"
npm run dev
~~~
Abrir la dirección Local indicada por Astro. Añadir /es/ para español. Ctrl+C detiene el servidor. En una instalación nueva, ejecutar npm ci antes del primer arranque.

Para compilar: npm run build. La última versión del cartel con visera ASCII está en output/recovery/portfolio-visor-ascii-final.zip. Extraer en una carpeta vacía y ejecutar npm ci para recuperarla por separado.

## Analítica opcional

La integración permanece en modo off hasta configurarla. Guía de conexión, consentimiento y eventos en docs/ANALYTICS.md. Pruebas aisladas con npm run test:analytics. Validación en docs/ANALYTICS_VALIDATION.md y contrato futuro para Flutter en docs/ANALYTICS_MOBILE_API.md.
