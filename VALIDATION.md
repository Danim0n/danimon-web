# Validación del paquete — 2026-11-03

## Comprobado en el entorno de preparación
- Cinco archivos TOML analizados sin errores por Python tomllib: configuración y cuatro agentes.
- Campos obligatorios de cada agente presentes: name, description, developer_instructions; modelos/esfuerzo explícitos.
- Configuración y campos contrastados con documentación pública actual de Codex; se omiten claves antiguas de subagentes.
- Concurrencia dos, workspace-write y on-request; sin claves API, proveedores externos ni servidores MCP añadidos.
- Frontmatter YAML de la skill original local analizado; nombre y descripción válidos.
- Archivos UTF-8, estructura de ZIP y manifiesto SHA-256 comprobados.

## No comprobado o no realizado
- No se ha ejecutado Codex ni confirmado la disponibilidad de los modelos en la cuenta del usuario.
- No hay validación de carga de configuración por la versión instalada en su PC.
- No se ha ejecutado el instalador PowerShell: este entorno no dispone de PowerShell. Su validación aquí es revisión de código, no prueba de ejecución ni análisis con el parser de PowerShell.
- La skill externa frontend-design se revisó vía web, pero no se descargó al paquete ni se instaló; esa tarea la realizará Codex en el proyecto.
- No hay implementación, pruebas de navegador, capturas o despliegue de la web todavía.

## Fuentes técnicas contrastadas
Documentación consultada el 3 de noviembre de 2026:
- https://developers.openai.com/codex/subagents
- https://developers.openai.com/codex/models
- https://learn.chatgpt.com/docs/config-file/config-reference
- https://developers.openai.com/codex/skills
- https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
- https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
- https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/LICENSE.txt

El manifiesto identifica los archivos entregados, no prueba que una web o una sesión de agentes haya funcionado.
