# Paquete Codex — portfolio danimon.party

Incluye un coordinador (hilo principal), cuatro agentes con modelos distintos, el brief del portfolio y una revisión visual específica. No contiene la web terminada.

## Uso en la aplicación de Codex para Windows
1. Extrae este ZIP en una carpeta nueva para el portfolio y ábrela como proyecto en Codex. Los archivos AGENTS.md y STATE.md deben quedar en la raíz. Incluye las carpetas .codex y .agents, aunque el explorador las oculte.
2. Comprueba en el selector principal **GPT-6.1 Sol / Medium**, velocidad estándar; evita Fast/Ultra. La disponibilidad depende de la cuenta y versión. Si no aparece, usa un modelo disponible y aplica docs/MODEL_ROUTING.md; no hace falta una cuenta/API adicional.
3. Pega el contenido de START_PROMPT.md. También puedes escribir: “Lee START_PROMPT.md y ejecútalo”. Abre una conversación nueva para cargar la configuración del proyecto. Acepta la confianza del proyecto solo tras revisar los archivos.

No es necesario volver a pegar el largo prompt de diseño: está recogido en docs/PROJECT_BRIEF.md. El paquete no modifica configuración global y no publica nada por sí solo.

## Proyecto ya empezado
No extraigas sobre archivos existentes sin revisarlos. Extrae en otra carpeta y pide a Codex fusionar AGENTS.md y .codex/config.toml conservando las instrucciones/ajustes existentes y una copia de seguridad. Mantén el código y el gestor de paquetes del proyecto. No borres el trabajo anterior para empezar de cero.

## Qué hace cada rol
- Principal: GPT-6.1 Sol / medium; coordina, implementa lo normal e integra.
- art_director: GPT-6 Astra / low (Light); dirección artística puntual.
- creative_engineer: GPT-6.1 Sol / high; 3D, animación y fallos complejos.
- skill_scout: GPT-6 Luna / high; investigación breve de skills y documentación.
- quality_reviewer: GPT-6.1 Terra / medium; revisión de capturas y pruebas.

La configuración limita a dos subagentes simultáneos, no el gasto total. Los cuatro no trabajan permanentemente. Los modelos se solicitarán de verdad a través del sistema de agentes, no por escribir sus nombres en el prompt. No se ha comprobado su disponibilidad en tu cuenta.

## Skills
La recomendación principal es frontend-design, del repositorio oficial de Anthropic. Se revisó su contenido y licencia, pero la copia externa NO se ha incluido ni instalado en tu PC.
El prompt encarga a Codex revisar e instalarla dentro de .agents/skills con el script local. No necesitas instalar find-skills para poder buscarla.
La skill original danimon-visual-quality sí está incluida. No es una skill oficial ni sustituye un navegador.
Para revisar manualmente el instalador y ejecutarlo desde PowerShell en esta carpeta:

```powershell
Get-Content .\tools\Install-FrontendSkill.ps1
.\tools\Install-FrontendSkill.ps1 -WhatIf
.\tools\Install-FrontendSkill.ps1
```

Si la política de PowerShell impide ejecutar scripts, no cambies la política global: Codex puede descargar los mismos dos archivos de texto mediante herramientas permitidas. La búsqueda/instalación fallida no debe bloquear el desarrollo. El instalador no ejecuta código descargado ni sobrescribe una skill existente.

## Permisos
El TOML propone workspace-write, aprobación on-request y red saliente para descargas/dependencias. No equivale a acceso ilimitado ni elimina permisos de la app. Los subagentes heredan las protecciones del padre; una instrucción “no editar” no es una barrera de seguridad separada.
No se autoriza publicar, modificar DNS, tocar otros subdominios/túneles, hacer push, comprar servicios, usar APIs de pago ni cambiar configuración global. Estos límites son explícitos en AGENTS.md.

## Reanudar
Tras agotarse cuota o cerrar la sesión, utiliza RESUME_PROMPT.md. No se instala un servicio ni una tarea automática que continúe al recuperar cuota.

## Validación
Se revisaron los campos contra documentación vigente y se analizaron los cinco archivos TOML. La app de Codex, PowerShell y los modelos no se han ejecutado en el ordenador del usuario. El instalador se ha revisado, pero no ejecutado aquí. Ver VALIDATION.md.
