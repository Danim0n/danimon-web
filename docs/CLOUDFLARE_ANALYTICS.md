# Cloudflare: revisión jurídica y técnica

Revisión del 5 de noviembre de 2026. Evaluación de implementación, no certificación jurídica.

## Decisión sin banner

La [guía AEPD de audiencia](https://www.aepd.es/guias/guia-cookies-analiticas-externas.pdf) contempla mediciones mínimas diarias por página, incluidos clics, scroll y tiempo. Exige finalidad exclusiva, agregación anónima, ausencia de cruces, información y garantías del proveedor. El contrato debe impedir reutilización y separar editores. No basta con no poner cookies.

La [LSSI, art. 22.2](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) regula acceso y almacenamiento en el terminal. El [RGPD](https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807), especialmente arts. 5, 6, 13, 21, 28 y 44, exige además base, información y garantías cuando hay tratamiento personal. Son revisiones distintas.

Se adopta un contador propio exclusivamente agregado, sin estado identificador ni seguimiento, con información bilingüe accesible y oposición técnica DNT/GPC. Ponderación: conocer utilidad de contenido; necesidad de totales mínimos frente a seguimiento; impacto reducido al no conservar personas, secuencias, datos escritos o red; retención limitada y acceso privado. El interés legítimo es la base propuesta para el tránsito técnico previo a agregación, no una exención universal. El responsable debe validar esta ponderación y contrato aplicables antes de activar producción.

## Beacon nativo

Cloudflare declara que [Web Analytics](https://developers.cloudflare.com/web-analytics/about/) no recoge datos personales y documenta su [colección](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/). Eso no acredita por sí solo todas las condiciones contractuales españolas. El [DPA público](https://www.cloudflare.com/cloudflare-customer-dpa/) no permitió confirmar una prohibición específica de reutilización de estos datos en todos los supuestos.

Decisión conservadora: PUBLIC_CLOUDFLARE_EXEMPTION_REVIEWED=false. Integración conservada, beacon apagado, sin solicitar consentimiento. Antes de cambiarlo, documentar contrato vigente, roles, finalidad, no reutilización, separación, transferencias, retención y versión real del script. Si no pueden acreditarse, seguir sin estas métricas. El panel nativo permanece disponible; no hay estadísticas nuevas verificadas en él.

El cargador manual evita duplicados, usa type=module y spa=false, y excluye documentos o referentes con query, fragmento o rutas no permitidas. La revisión del panel autenticado mostró instalación manual y cero sitios con inserción automática. Pages → Metrics confirmó además Web Analytics disabled para danimon-web. Se conserva Cache-Control no-transform en HTML como defensa adicional; las respuestas públicas de pages.dev no contienen beacon. Esto no acredita el dominio danimon.party, todavía sin conectar, ni permite asumir que el cargador detendría un beacon ya inyectado por la plataforma.

## Infraestructura y costes

La cuenta revisada muestra Workers Free. Se creó danimon-counters en jurisdicción UE con autorización expresa. No se contrató nada. Estimación: 0 € mientras se permanezca dentro de cuotas; no promesa de capacidad ilimitada. [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/) ofrece 5 millones de filas leídas/día, 100.000 escritas/día y 5 GB totales. [Workers](https://developers.cloudflare.com/workers/platform/limits/) permite 100.000 solicitudes/día en Free. Un visitante puede generar varias acciones. Borrado e índices consumen filas; consultar métricas reales de D1.

Pages publica el Worker compilado junto con la web. El archivo _routes.json limita la ejecución a /api/* y /cv/*; el resto se sirve directamente. Al agotar límites Free pueden fallar los contadores o el CV interceptado; no activar un plan superior automáticamente. La retención se programa en un Worker separado, limitado al portfolio.

La configuración del Worker de retención apaga los logs de aplicación/invocación y se verificaron en la cuenta logs/traces/issues apagados. No hay logs de solicitudes en el código de Pages; NEL queda desactivado en las respuestas públicas inspeccionadas. Esto no desactiva registros internos o seguridad de Cloudflare. Queda pendiente acreditar todos los términos efectivos de DPA, subencargados, transferencias, retención operativa y recuperación D1. La jurisdicción UE se fijó al crear la base D1; no se afirma que toda la operación de Cloudflare sea exclusivamente europea.
