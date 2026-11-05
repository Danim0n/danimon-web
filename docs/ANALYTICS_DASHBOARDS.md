# Paneles de PostHog EU

Plantillas para crear manualmente en una cuenta futura. Ningún panel real ha sido creado. Usar únicamente el proyecto europeo seleccionado y eventos schema_version=1. Ajustar el intervalo temporal en el panel y comprobar zona horaria UTC y retención antes de comparar.

## Panel general

- Tendencia de page_viewed por día y desglose por page_id.
- Tendencias de cv_download_clicked, linkedin_clicked y contact_clicked, excluyendo method=chooser para conversiones.
- Número de sesiones distintas con 3d_first_interaction.
- No rotular distinct_id como personas. Es una sesión aleatoria de una pestaña.

## Proyectos

Separar tres gráficos: project_opened(action=details), project_opened(action=navigate) y project_detail_viewed. Desglosar project_id, no el título traducido. Esto evita duplicar como visitas las revelaciones por hover y la llegada a la ficha.

## Embudo

Un embudo ordenado dentro de la misma $session_id:

1. page_viewed
2. project_opened con action=navigate, o project_detail_viewed
3. cv_download_clicked o linkedin_clicked o contact_clicked con method distinto de chooser

Ventana de conversión de 30 minutos. El denominador comprende solo sesiones consentidas. Etiquetar el resultado como intención de contacto/descarga. No supone contratación, mensaje enviado ni lectura de CV.

## Uso, idioma y procedencia

interactive_control_used desglosado por experience/control. 3d_interaction_milestone desglosado por count. page_viewed y conversiones desglosados por language. conversiones por traffic_source, una clasificación reducida del documento. No hay datos UTM ni campañas automáticas.

## Calidad

frontend_error_detected por kind y page_id, y graphics_fallback_activated por reason. Son señales oportunistas posteriores al consentimiento. Los errores anteriores al permiso no se recuperan. Rendimiento LCP/INP/CLS corresponde a Cloudflare; no está implementado como eventos PH ni debe inventarse a partir del tiempo activo.

## HogQL reutilizable

Estas consultas no requieren cambiar el frontend. Ejecutarlas solo desde la UI autorizada o el futuro backend privado. Sustituir los límites de fecha mediante parámetros del backend validados, nunca concatenando texto del móvil.

```sql
SELECT
    toStartOfDay(timestamp) AS day_utc,
    countIf(event = 'page_viewed') AS consented_page_views,
    countIf(event = 'cv_download_clicked') AS cv_clicks,
    countIf(event = 'linkedin_clicked') AS linkedin_clicks
FROM events
WHERE properties.schema_version = 1
  AND timestamp >= toDateTime('2026-10-29 00:00:00', 'UTC')
  AND timestamp < toDateTime('2026-11-05 00:00:00', 'UTC')
GROUP BY day_utc
ORDER BY day_utc
```

```sql
SELECT
    properties.project_id AS project_id,
    countIf(event = 'project_opened' AND properties.action = 'details') AS reveals,
    countIf(event = 'project_opened' AND properties.action = 'navigate') AS navigation_clicks,
    countIf(event = 'project_detail_viewed') AS detail_views
FROM events
WHERE properties.schema_version = 1
  AND timestamp >= now() - INTERVAL 7 DAY
  AND event IN ('project_opened', 'project_detail_viewed')
GROUP BY project_id
ORDER BY navigation_clicks DESC
```

```sql
SELECT uniqExact(properties.$session_id) AS converted_tab_sessions
FROM events
WHERE properties.schema_version = 1
  AND timestamp >= now() - INTERVAL 7 DAY
  AND (
    event IN ('cv_download_clicked', 'linkedin_clicked')
    OR (event = 'contact_clicked' AND properties.method != 'chooser')
  )
```

Las plantillas no han sido ejecutadas en una cuenta PostHog. Verificar sintaxis, permisos, resultados y disponibilidad de funciones en la instancia real. No copiar claves privadas a estos archivos.
