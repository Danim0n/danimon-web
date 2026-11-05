# Contrato futuro para Flutter

Versión del contrato **portfolio.analytics/v1**. Este documento no crea un endpoint ni modifica Python, Flutter, Xiaomi, panel.danimon.party o su autenticación. El futuro backend privado validará la sesión de administración existente, consultará APIs oficiales con credenciales privadas de solo lectura y responderá al cliente Flutter.

## Solicitud y autorización

`GET /api/portfolio/analytics?period=7d`

Periodos admitidos propuestos: 24h, 7d, 30d. Validar la enumeración, límite de coste/tiempo y permisos existentes en servidor. Respuestas 401/403 para acceso no autorizado, 400 para periodo desconocido, 200 parcial con null para una fuente no disponible, 503 si ninguna fuente responde. Nunca aceptar consultas HogQL/GraphQL arbitrarias desde el móvil. Cache privada corta de cinco minutos y límites por cuenta para no consumir cuota innecesaria.

Consultar los siete días naturales anteriores hasta ahora en UTC. Los ejemplos incluyen fecha inclusiva de inicio y exclusiva de fin. Flutter puede presentar fechas en Europe/Madrid, con sus cambios de horario. No sumar conteos diarios de usuarios para obtener usuarios únicos del periodo.

## Respuesta

```json
{
  "schema": "portfolio.analytics/v1",
  "period": {
    "key": "7d",
    "start": "2026-10-29T00:00:00Z",
    "end": "2026-11-05T00:00:00Z",
    "timezone": "UTC",
    "end_exclusive": true
  },
  "updated_at": null,
  "partial": true,
  "sources": {
    "cloudflare": {"status": "not_configured", "fetched_at": null, "retention_days": null},
    "posthog_eu": {"status": "not_configured", "fetched_at": null, "retention_days": null}
  },
  "metrics": {
    "visits": {"value": null, "unit": "visits", "source": "cloudflare", "definition": "provider_defined_visits"},
    "page_views": {"value": null, "unit": "page_views", "source": "cloudflare"},
    "estimated_visitors": {"value": null, "unit": "estimated_visitors", "source": "cloudflare"},
    "consented_page_views": {"value": null, "unit": "events", "source": "posthog_eu", "event": "page_viewed"},
    "cv_clicks": {"value": null, "unit": "clicks", "source": "posthog_eu", "event": "cv_download_clicked"},
    "contact_clicks": {"value": null, "unit": "clicks", "source": "posthog_eu", "event": "contact_clicked", "filter": "method != chooser"},
    "linkedin_clicks": {"value": null, "unit": "clicks", "source": "posthog_eu", "event": "linkedin_clicked"},
    "three_d_sessions": {"value": null, "unit": "tab_sessions", "source": "posthog_eu", "event": "3d_first_interaction", "aggregation": "distinct_session_id"},
    "conversions": {"value": null, "unit": "tab_sessions", "source": "posthog_eu", "definition": "distinct_session_with_cv_or_contact_or_linkedin_click"},
    "conversion_rate": {"value": null, "unit": "ratio_0_1", "source": "posthog_eu", "denominator": "distinct_consented_tab_sessions_with_page_view"}
  },
  "top_projects": {"source": "posthog_eu", "items": null},
  "timeline": {"source": "posthog_eu", "bucket": "day_utc", "items": null},
  "origins": {
    "countries": {"source": "cloudflare", "items": null},
    "referrers": {"source": "cloudflare", "items": null},
    "conversion_traffic_categories": {"source": "posthog_eu", "items": null}
  },
  "performance": {
    "source": "cloudflare",
    "lcp_p75_ms": null,
    "inp_p75_ms": null,
    "cls_p75_score": null,
    "sample_count": null
  },
  "warnings": ["Providers have not been configured or queried."]
}
```

Este ejemplo representa ausencia de datos, no estadísticas reales. Valor null significa desconocido/no disponible/sin acceso. Cero solo cuando una consulta correcta confirma ausencia. Una lista vacía es una consulta correcta sin elementos; null significa que no se ha podido obtener. Eliminar mensajes sensibles antes de responder.

## Colecciones

- top_projects.items: `{project_id, detail_reveals, navigation_clicks, detail_views, unique_tab_sessions}`. Solo los cuatro IDs del catálogo web. No mezclar revelado de tarjeta con apertura de una página.
- timeline.items: `{start, end, consented_page_views, cv_clicks, contact_clicks, linkedin_clicks, converted_tab_sessions}`. Fechas ISO UTC, intervalos sin solapamiento.
- countries.items: `{country_code, page_views, estimated_visitors}`; incluir source y grado de disponibilidad del proveedor. Datos agregados, sin IP.
- referrers.items: `{hostname, page_views}` si el proveedor realmente permite una agregación segura. Suprimir paths, queries e identificadores; no inferirlos de PostHog porque no se envían.
- conversion_traffic_categories.items: `{category, converted_tab_sessions}` con direct/internal/search/social/external. La clasificación corresponde al documento observado, no necesariamente al primer contacto de marketing.

## Evitar duplicidades y falsas conversiones

Cloudflare es la fuente primaria de visitas, páginas, país y rendimiento. PostHog es la fuente de acciones consentidas. No sumar ambos pageviews ni unir usuarios por IP o huella. Las estadísticas tienen coberturas diferentes por consentimiento, bloqueo y omisión de URLs con query/hash.

Una sesión seudónima corresponde a una pestaña y caduca tras 30 minutos sin actividad. No representa una persona y puede fragmentarse entre dispositivos o pestañas. La retirada inicia una nueva identidad si se acepta de nuevo. El embudo usa sesión, ventana de 30 minutos y orden temporal: page_viewed → project_opened(action=navigate) o project_detail_viewed → clic de CV/contacto/LinkedIn. La conversión cuenta una sola vez cada sesión aunque pulse varios controles.

contact_clicked(method=chooser) indica apertura del selector. Excluirlo de las conversiones de contacto efectivo. email_copy_clicked(result=copied) puede ser otra conversión de intención con definición separada. result=selected no garantiza copia al portapapeles. Las acciones de exportar la demo y CV solo acreditan clic; no constituyen entrega HTTP completa ni lectura real.

## APIs oficiales para la fase siguiente

PostHog EU: consultas del proyecto mediante `POST https://eu.posthog.com/api/projects/{project_id}/query/`, con autorización privada de lectura adecuada. Plantillas HogQL en ANALYTICS_DASHBOARDS.md; IDs y tokens solo en el futuro servidor, nunca en el navegador o Flutter. Verificar permisos, límites y retención del plan contratado.

Cloudflare: GraphQL `https://api.cloudflare.com/client/v4/graphql`, datasets RUM/Web Analytics como `rumPageloadEventsAdaptiveGroups`, `rumPerformanceEventsAdaptiveGroups` y `rumWebVitalsEventsAdaptiveGroups` con filtros de sitio/periodo validados. Introspeccionar el esquema de la cuenta y comprobar los campos permitidos antes de desarrollar un conector.

La documentación de Cloudflare identifica estos datasets como US-only en las limitaciones de residencia de datos de GraphQL. Su disponibilidad, acceso, límites históricos, definición de visits/visitors y percentiles deben verificarse con la cuenta real. Si una métrica no está expuesta, devolver null. No derivar visitantes de IPs ni aproximar INP a partir de una duración genérica.

El futuro backend no debe enviar a Flutter tokens de proveedores, SQL/HogQL libre, errores administrativos, datos crudos de eventos, identificadores de sesión o grabaciones. Solo resultados agregados y metadatos de origen.

Fuentes oficiales: [PostHog Query API](https://posthog.com/docs/api/queries), [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/), [métricas Web Analytics](https://developers.cloudflare.com/web-analytics/data-metrics/).
