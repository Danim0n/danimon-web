# Recuperación y ajustes manuales

Estado al cierre de la revisión: rama de seguridad local, sin push/PR/deployment; `main` conserva el estado funcional `5820951131cc8e5639f47b66cc2118facc39dc5e`. No se han borrado ni restaurado datos reales.

## Rollback de la aplicación

Antes de cualquier despliegue aprobado, anotar el commit y deployment que aparecen en Production de Pages, y el SHA del merge de seguridad. La base funcional de esta auditoría es la indicada arriba; no asumir que seguirá siendo el último estado si el propietario publica otros cambios.

Si se integró con el merge `--no-ff` propuesto, una reversión explícita y revisable es:

```powershell
git switch main
git pull --ff-only origin main
git revert -m 1 <SHA_DEL_MERGE_DE_SEGURIDAD>
git push origin main
```

Requiere autorización de despliegue. No usar reset/force-push ni borrar historial. Si se hizo otra estrategia de integración, revisar sus commits concretos y revertirlos; no usar `-m 1` sobre un commit ordinario.

Para una reversión urgente de solo aplicación: Cloudflare → Workers & Pages → `danimon-web` → Deployments → seleccionar el deployment de producción previamente anotado (fuente `5820951` si no hubo otros cambios) → Rollback. Confirmar que es producción, no un preview. Esto tampoco se ha ejecutado. Después reconciliar Git mediante revert para que el siguiente push no reintroduzca la regresión. La reversión de assets no debe modificar D1, DNS, túneles o retención.

Los scripts y hashes CSP se regeneran juntos: no copiar hashes de otro build. Si el problema fuera exclusivamente una cabecera, revertir su cambio y compilar de nuevo. HSTS se almacena en navegadores hasta 30 días: quitar la cabecera no borra inmediatamente esa política. Solo si hay una necesidad real y autorización, servir `max-age=0` en los hosts propios afectados. Nunca usar includeSubDomains, preload o una regla global de zona en esta operación.

## D1 Time Travel: procedimiento preparado, NO ejecutado

Base exclusiva del portfolio: `danimon-counters`, ID `ccf6dfcb-d8ca-489b-b2e4-6b2326e388b2`, binding COUNTERS. La interfaz real mostró Time Travel y una ventana desde el 5 de noviembre de 2026 a las 23:18 (hora mostrada por el dashboard) hasta la revisión del día 6. Es una base reciente: la ventana observada era menor de un día. La documentación permite hasta siete días en Workers Free y 30 en Workers Paid; el plan efectivo de cuenta no se confirmó. No confundir el Free de la zona con el plan de Workers. [Cloudflare indica que Time Travel está activado automáticamente y no tiene coste adicional](https://developers.cloudflare.com/d1/reference/time-travel/).

Una restauración cambia datos de producción y pierde, en el estado restaurado, escrituras posteriores al punto elegido. Solo procede ante corrupción/error confirmado y con aprobación específica; no es parte de la validación rutinaria de esta rama.

1. Identificar en UTC el punto anterior al incidente; comprobar que esté dentro de la ventana real.
2. Coordinar una pausa limitada a las escrituras del portfolio y retención, previa aprobación. No cambiar otros servicios ni restaurar mientras siguen escribiendo sin aceptar esa pérdida.
3. Obtener y guardar el bookmark actual y, si procede, una exportación de recuperación fuera del directorio público. Revisar únicamente esta base. Ejemplos CLI cuya sintaxis se contrastó con `--help` de Wrangler instalado:

```powershell
npx wrangler d1 time-travel info danimon-counters --config wrangler.jsonc --json
npx wrangler d1 export danimon-counters --config wrangler.jsonc --remote --output output/counters-before-restore.sql
npx wrangler d1 time-travel info danimon-counters --config wrangler.jsonc --timestamp <FECHA_UTC_RFC3339> --json
```

Son instrucciones, no comandos ejecutados en esta auditoría. Los comandos Time Travel actúan sobre D1 remoto; no existe un `--local` que los convierta en un ensayo inocuo. Usar una sesión ya autorizada, sin crear ni imprimir tokens amplios. No subir exportaciones/bookmarks a Git ni dejarlos en `public/` o `dist/`.

4. Revisar el bookmark de destino devuelto y su fecha. Con aprobación concreta, restaurar SOLO esa base:

```powershell
npx wrangler d1 time-travel restore danimon-counters --config wrangler.jsonc --bookmark <BOOKMARK_REVISADO> --json
```

5. Comprobar tabla/esquema, rango de fechas y agregados mediante consultas de lectura; verificar el sitio. Conservar el bookmark previo y la respuesta de restauración para poder volver al estado anterior mientras siga disponible. Restablecer las escrituras autorizadas y documentar el intervalo perdido.

Si la ventana ya expiró y no existe exportación, no afirmar que se recuperarán los datos. La opción proporcionada para estos agregados puede ser aceptar la pérdida; no introducir backups perpetuos o datos personales sin otra necesidad.

## Comprobar retención tras su primera ejecución

Cron observado: `0 3 * * *`; primera ejecución prevista el 7/11/2026 a las 03:00 UTC. Aún no ocurrida al revisar. No se ha ejecutado manualmente el scheduled handler remoto.

Después de esa fecha, un operador autorizado puede consultar el historial del cron de `danimon-counters-retention` y ejecutar esta consulta de lectura sobre la base correcta:

```sql
SELECT COUNT(*) AS expired_rows
FROM daily_counts
WHERE day <= date('now', '-365 days');
```

Una respuesta cero sin datos antiguos no demuestra por sí sola que se ejecutara un borrado; contrastar historial del cron. El test local sí demuestra el límite UTC de 365 días y que registros recientes se conservan. No cambiar cron ni borrar producción para generar evidencia artificial.

## Ajustes de GitHub que quedan para el propietario

- Repo `Danim0n/danimon-web` → Settings → Advanced Security → activar Dependency graph y Dependabot alerts. Son controles gratuitos disponibles en este repositorio público. Verificar el estado después; no se han activado desde esta auditoría.
- Valorar Dependabot security updates sin auto-merge. Sus PR pueden iniciar previews de Pages; decidir antes si se autoriza ese comportamiento. No se añadieron actualizaciones masivas de versiones ni un workflow innecesario.
- Settings → Branches/Rulesets → crear una protección para `main` que impida force-push y borrado, y exija revisión/comprobaciones apropiadas. Confirmar cómo puede integrar cambios el único mantenedor; no imponer una aprobación imposible o checks inexistentes.
- Mantener Secret Protection y Push protection, observadas activas. Revisar Security → Secret scanning sin copiar secretos en informes. Ante un secreto real, revocarlo/rotarlo en su emisor con autorización específica; reescribir Git por sí solo no lo revoca. No se encontró uno en el escaneo local.
- Settings → GitHub Apps → Cloudflare Workers and Pages → Configure: comprobar acceso solo a los repositorios necesarios y permisos de integración. La instalación encontrada pide reautenticación; ese detalle no quedó verificado. No se han ampliado permisos, enviado correos de verificación ni tocado MFA/credenciales.

## Protección contra abuso: escalado si aparece un incidente real

Los límites de esta entrega son por isolate y admiten pérdida de eventos al saturarse. No presentar cifras anónimas como visitantes únicos o métricas antifraude.

La zona Free ofrece una regla WAF de rate limiting, pero no se creó: según la documentación consultada, la expresión gratuita admite Path y Verified Bot, sin Host, y el conteo usa IP. No protege el hostname Pages y una regla solo por ruta podría afectar `panel.danimon.party` u otros servicios de la zona. Bot Fight Mode/Under Attack globales tampoco son sustitutos aceptables de una protección limitada al portfolio.

La Rate Limiting API de Workers es aproximada por ubicación y Pages no la enumera entre sus bindings documentados; no se añadió una clave ignorada ni se migró la arquitectura. Si en el futuro se acredita compatibilidad real gratuita, usar una clave de recurso/host sin guardar visitantes y probarla en un entorno separado antes de desplegar. Un límite estricto global requeriría otra arquitectura y no se ha prometido en esta entrega.

Ante una ráfaga persistente que agote la cuota, la respuesta proporcional puede ser suspender solo contadores del portfolio mediante su flag, con autorización de producción, mientras la web/CV siguen accesibles. No añadir cookies, IPs completas o fingerprints como respuesta automática. No tocar reglas globales ni otros recursos.
