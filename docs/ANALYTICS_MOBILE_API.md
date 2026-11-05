# Consumo futuro desde una aplicación privada

No se implementa una API móvil en este proyecto. La consulta actual se realiza desde la consola autenticada de Cloudflare D1 o Wrangler; ver ANALYTICS_DASHBOARDS.md.

Si se añade una aplicación privada más adelante, su backend deberá devolver solo agregados de consultas predefinidas, verificar la autorización existente y mantener las credenciales Cloudflare exclusivamente en servidor. No aceptar SQL del cliente. No exponer listas de solicitudes, identificadores ni datos de navegación individual.

No se modifican otros proyectos, servicios, paneles ni su autenticación. Las antiguas métricas de sesiones o conversiones por persona quedan retiradas: estos contadores no permiten obtenerlas.
