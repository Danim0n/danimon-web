# danimon-web
Portfolio desarrollado con Astro y TypeScript, en inglés (/) y español (/es/). Incluye proyectos interactivos, tecnologías, perfil profesional y analítica opcional con consentimiento.

Desde PowerShell:
~~~powershell
cd "C:\Users\dani_\Desktop\Proyectos\web_danimon"
$env:ASTRO_TELEMETRY_DISABLED = "1"
npm run dev
~~~
Abrir la dirección Local indicada por Astro. Añadir /es/ para español. Ctrl+C detiene el servidor. En una instalación nueva, ejecutar npm ci antes del primer arranque.

Para compilar: npm run build.

## Analítica opcional

La integración permanece en modo off hasta configurarla. Guía de conexión, consentimiento y eventos en docs/ANALYTICS.md. Pruebas aisladas con npm run test:analytics. Validación en docs/ANALYTICS_VALIDATION.md y contrato futuro para Flutter en docs/ANALYTICS_MOBILE_API.md.
