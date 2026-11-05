# Cloudflare Web Analytics

Verificación del 5 de noviembre de 2026.

## Integración

El token público del sitio se configura con PUBLIC_CLOUDFLARE_TOKEN en el entorno de compilación. La configuración local está en .env.production.local, excluido de Git. El modo de producción solo se activa en HTTPS y el hostname exacto danimon.party.

El cargador crea el script oficial como módulo únicamente después de autorizar la categoría de estadísticas de visitas. No se añade un script estático al HTML. El rechazo y las señales de privacidad impiden su carga. Un script con data-cf-beacon ya presente evita insertar otro; cambiar o guardar de nuevo las preferencias mantiene una sola instancia. Al retirar el permiso se guarda el rechazo y se recarga para eliminar el código y sus listeners.

## Ajuste comprobado en Cloudflare

Se abrió el panel autenticado del sitio, en modo de solo lectura. Está seleccionado **Enable with JS Snippet installation**. Las opciones de inserción automática general y de inserción automática salvo UE están desmarcadas. El token del snippet del panel coincide con el facilitado.

No se modificaron ajustes, DNS ni servicios desde el panel. Esta inspección permite establecer PUBLIC_CLOUDFLARE_MANUAL_AUDITED=true en la configuración local.

public/_headers añade Cache-Control con no-transform a las rutas HTML, como protección adicional frente a transformaciones automáticas del proxy. No cambia las reglas de caché de imágenes, fuentes, JavaScript ni recursos OCR.

## Prueba del script oficial

Se descargó el JavaScript desde static.cloudflareinsights.com. La prueba reproduce el origen de producción en un servidor local y responde a todas las solicitudes de medición sin enviarlas a Cloudflare.

En EN a 1440 px y ES a 390 px se verificó:

- Ninguna solicitud de script o RUM antes de consentir.
- Ninguna solicitud después de rechazar y recargar.
- Una sola carga del módulo al activar únicamente estadísticas de visitas.
- Generación de solicitudes RUM reales del script oficial, interceptadas localmente.
- Token correcto en los datos del beacon.
- Ausencia de cargas duplicadas al guardar otra vez la misma preferencia.
- Retirada con recarga, sin nueva carga ni nuevas capturas.

La evidencia queda en output/qa/cloudflare/results.json y dashboard-audit.json. El script oficial descargado y su hash se guardan localmente, fuera del repositorio.

Para reproducir, ejecutar node tools/cloudflare-audit.mjs. El comando descarga y conserva localmente el script oficial si falta, crea un build aislado en output/cloudflare-test-dist y nunca publica la web.

## Pendiente en el dominio

Las consultas públicas de DNS del dominio no devolvieron registros de dirección A o AAAA durante la revisión. No fue posible solicitar el HTML público ni inspeccionar sus cabeceras tras un despliegue. Tampoco se ha confirmado recepción de visitas en el panel.

Por tanto, están verificados el ajuste manual de la cuenta y la integración local, pero la comprobación completa de producción sigue pendiente de que el dominio sirva el portfolio. Al publicarlo en una fase autorizada, comprobar cero beacons antes de consentir, una sola instancia después de consentir, presencia de no-transform y recepción de mediciones.

Fuentes oficiales: [activación de Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/) y [cabeceras de Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/headers/).
