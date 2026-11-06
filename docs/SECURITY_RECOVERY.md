# Recuperación y ajustes manuales

Estado actual: el merge `3637e7ac8a9bd44ed2d4b4733cb3cdb35adf6e0a` publicó el refuerzo desde la base funcional `5820951131cc8e5639f47b66cc2118facc39dc5e` y `f828aaa`. Su primer deployment fue `afd9dd44-725d-49b7-b3b0-cdcb03582d4d`. El arreglo de cabeceras `7a6000ec32997c6ee4367cfb1d9e78ac7da9072c` se publicó como `4ed62b29-4e69-4439-b742-2839a5317e9b`; el checker final dio cero fallos en ambos hosts, con `NEL max_age=0`, sin `Report-To` y CV atendido por Pages Function. La comparación D1 confirmó que el esquema no cambió, las filas anteriores se conservaron y los agregados no disminuyeron. No se han borrado ni restaurado datos reales.

## Rollback de la aplicación

Antes de cualquier rollback, confirmar el commit y deployment actuales en Production de Pages. El rollback de aplicación previamente publicado es el deployment `ab10999f-57f3-4b6e-9d41-e79365feb5fc`, basado en `5820951131cc8e5639f47b66cc2118facc39dc5e`. No modificar D1, DNS, cron ni servicios externos.

Si se decide revertir el código publicado en Git, revisar primero los commits posteriores al fix y revertir sus cambios de aplicación en orden inverso. Esto incluye cualquier modificación posterior del checker: evitar conflictos de modificación/borrado al revertir el archivo que añadió `7a6000e`. Los cambios de documentación por sí solos no cambian la aplicación. Después revertir la corrección desplegada y el merge original:

```powershell
git switch main
git pull --ff-only origin main
git revert 7a6000ec32997c6ee4367cfb1d9e78ac7da9072c
git revert -m 1 3637e7ac8a9bd44ed2d4b4733cb3cdb35adf6e0a
git push origin main
```

Estos comandos son instrucciones de recuperación y **no se han ejecutado**. El encargo autoriza recuperar exclusivamente esta publicación ante una regresión grave verificada; para otros casos se requiere autorización de publicación. Revisar conflictos, actualizar esta documentación y repetir build/pruebas críticas antes del push. No usar reset/force-push ni borrar historial. `-m 1` se usa solo para revertir el merge original, no para el commit ordinario de la corrección.

Para una reversión urgente de solo aplicación: Cloudflare → Workers & Pages → `danimon-web` → Deployments → seleccionar el deployment `ab10999f-57f3-4b6e-9d41-e79365feb5fc` (fuente `5820951`) → Rollback. Confirmar que es producción, no un preview. Este rollback no se ha ejecutado. Después reconciliar Git con los reverts indicados arriba para que un push posterior no reintroduzca el cambio. La reversión de assets no debe modificar D1, DNS, túneles o retención.

Los scripts y hashes CSP se regeneran juntos: no copiar hashes de otro build. Si el problema fuera exclusivamente una cabecera, revertir su cambio y compilar de nuevo. HSTS se almacena en navegadores hasta 30 días: quitar la cabecera no borra inmediatamente esa política. Solo si hay una necesidad real y autorización, servir `max-age=0` en los hosts propios afectados. Nunca usar includeSubDomains, preload o una regla global de zona en esta operación.

## D1 Time Travel: procedimiento preparado, NO ejecutado

Base exclusiva del portfolio: `danimon-counters`, ID `ccf6dfcb-d8ca-489b-b2e4-6b2326e388b2`, binding COUNTERS. La interfaz real mostró Time Travel y una ventana desde el 5 de noviembre de 2026 a las 23:18 (hora mostrada por el dashboard) hasta la revisión del día 6. Es una base reciente: la ventana observada era menor de un día. La documentación permite hasta siete días en Workers Free y 30 en Workers Paid; el plan efectivo de cuenta no se confirmó. No confundir el Free de la zona con el plan de Workers. La consulta posterior a publicar confirmó que el esquema de seis columnas coincide, las filas pasaron de 72 a 91 y las acciones agregadas de 241 a 298, con cada fila previa presente y ningún total menor. Este aumento no identifica visitantes ni permite atribuirlo a una descarga o sesión individual. No se realizó Time Travel restore. [Cloudflare indica que Time Travel está activado automáticamente y no tiene coste adicional](https://developers.cloudflare.com/d1/reference/time-travel/).

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

Cron observado: `0 3 * * *`; próxima ejecución prevista el 7/11/2026 a las 03:00 UTC. El historial revisado el 6/11/2026 no tenía ejecuciones y la fecha seguía siendo futura. No se ejecutará manualmente el scheduled handler remoto para adelantar evidencia.

Después de esa fecha, un operador autorizado puede consultar el historial del cron de `danimon-counters-retention` y ejecutar esta consulta de lectura sobre la base correcta:

```sql
SELECT COUNT(*) AS expired_rows
FROM daily_counts
WHERE day <= date('now', '-365 days');
```

Una respuesta cero sin datos antiguos no demuestra por sí sola que se ejecutara un borrado; contrastar historial del cron. El test local sí demuestra el límite UTC de 365 días y que registros recientes se conservan. No cambiar cron ni borrar producción para generar evidencia artificial.

## Estado de controles de GitHub y ajustes pendientes

- Dependency graph, Dependabot alerts y Dependabot security updates están activados. Auto-merge permanece desactivado; no se añadieron actualizaciones masivas de versiones ni un workflow.
- La regla de protección de `main` se preparó como borrador pero no se guardó: GitHub solicitó confirmar el acceso mediante email. La pestaña de entrega conserva ese borrador. El propietario debe pulsar **Verify via email** y completar la verificación directamente en GitHub; después comprobar/guardar **Protect main history**, Enforcement **Active**, Target branches **Include: Default** (la rama por defecto es `main`), sin bypass, con **Restrict deletions** y **Block force pushes**. Si el borrador caduca, recrearlo desde [Settings → Rules → Rulesets](https://github.com/Danim0n/danimon-web/settings/rules). Confirmar al final que la regla aparece guardada y activa. No activar Restrict updates, Require pull request, firmas, historial lineal o checks inexistentes: el único mantenedor debe poder publicar normalmente.
- Mantener Secret Protection y Push protection, observadas activas. Revisar Security → Secret scanning sin copiar secretos en informes. Ante un secreto real, revocarlo/rotarlo en su emisor con autorización específica; reescribir Git por sí solo no lo revoca. No se encontró uno en el escaneo local.
- La instalación de GitHub App `Cloudflare Workers and Pages` pidió reautenticación para revisar sus permisos (ID `145311944`). Abrir [Configure de la instalación](https://github.com/settings/installations/145311944), pulsar **Verify via email** y completar la verificación personalmente. Revisar Repository access y los permisos realmente mostrados; seleccionar únicamente repositorios necesarios si el control lo permite, manteniendo `Danim0n/danimon-web`. No retirar otros repositorios sin comprobar sus despliegues. Los permisos efectivos siguen sin verificarse; no se ampliaron ni se modificaron MFA o credenciales.

## Protección contra abuso: escalado si aparece un incidente real

Los límites de esta entrega son por isolate y admiten pérdida de eventos al saturarse. No presentar cifras anónimas como visitantes únicos o métricas antifraude.

La zona Free ofrece una regla WAF de rate limiting, pero no se creó: según la documentación consultada, la expresión gratuita admite Path y Verified Bot, sin Host, y el conteo usa IP. No protege el hostname Pages y una regla solo por ruta podría afectar `panel.danimon.party` u otros servicios de la zona. Bot Fight Mode/Under Attack globales tampoco son sustitutos aceptables de una protección limitada al portfolio.

La Rate Limiting API de Workers es aproximada por ubicación y Pages no la enumera entre sus bindings documentados; no se añadió una clave ignorada ni se migró la arquitectura. Si en el futuro se acredita compatibilidad real gratuita, usar una clave de recurso/host sin guardar visitantes y probarla en un entorno separado antes de desplegar. Un límite estricto global requeriría otra arquitectura y no se ha prometido en esta entrega.

Ante una ráfaga persistente que agote la cuota, la respuesta proporcional puede ser suspender solo contadores del portfolio mediante su flag, con autorización de producción, mientras la web/CV siguen accesibles. No añadir cookies, IPs completas o fingerprints como respuesta automática. No tocar reglas globales ni otros recursos.
