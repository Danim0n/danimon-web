# Consultar las estadísticas

No hay panel ni endpoint administrativo público. Usa tu cuenta Cloudflare → Storage & databases → D1 → base danimon-counters → Console. Pega una consulta de queries/counters.sql. También puedes ejecutarlas con Wrangler autorizado:

~~~powershell
npx wrangler d1 execute danimon-counters --remote --file queries/counters.sql
~~~

El archivo solo hace SELECT. Devuelve totales por botón, proyectos, serie diaria, semanas y meses, además de CV clic frente a respuesta preparada. Cambia el intervalo de 30 días si necesitas otro histórico dentro de los 365 días conservados. Las semanas empiezan en lunes UTC. Los días sin actividad pueden no aparecer.

Para comparar acciones utiliza el mismo rango, idioma y página. No sumes aperturas de tarjeta, visitas a ficha y clics de demo como si fueran personas distintas. Tampoco restes respuestas del PDF a clics: el PDF se puede abrir directamente o desde otra página. No se calculan conversiones por usuario, atribución personal ni funnels.

Cloudflare → Web Analytics mantiene su panel nativo para tráfico y rendimiento. Mientras el beacon esté apagado, no hay datos nuevos de ese origen. No se inventa una medida de personas únicas: cualquier estimación mostrada por Cloudflare pertenece a su propia definición y cobertura, no a D1.

Las credenciales de consulta permanecen en Cloudflare o en la autorización local de Wrangler. No se incorporan a Astro, JavaScript público, GitHub ni una app móvil.
