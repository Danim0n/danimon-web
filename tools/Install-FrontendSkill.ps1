#Requires -Version 5.1
<#
Instala solo SKILL.md y LICENSE.txt desde el repositorio oficial de Anthropic.
No ejecuta contenido descargado, no cambia políticas ni configuración global.
Revisar antes de ejecutar. No sobrescribe una instalación existente.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$skillsRoot = Join-Path $projectRoot '.agents/skills'
$destination = Join-Path $skillsRoot 'frontend-design'
if (Test-Path -LiteralPath $destination) {
    throw "Ya existe $destination. Revisa su procedencia y reutilizalo; no se sobrescribira."
}
$sourceRoot = 'https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design'
$sourceFiles = @('SKILL.md', 'LICENSE.txt')
if (-not $PSCmdlet.ShouldProcess($destination, 'Descargar SKILL.md y LICENSE.txt oficiales, sin ejecutar codigo')) { return }

# La carpeta temporal no usa el nombre SKILL.md hasta completar la descarga,
# para no publicar una skill a medio instalar al detector del proyecto.
$tempRoot = Join-Path $projectRoot ('.frontend-skill-staging-' + [Guid]::NewGuid().ToString('N'))
$oldProtocol = [Net.ServicePointManager]::SecurityProtocol
try {
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    }
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    foreach ($file in $sourceFiles) {
        $target = Join-Path $tempRoot ($file + '.download')
        Invoke-WebRequest -Uri ($sourceRoot + '/' + $file) -OutFile $target -UseBasicParsing -TimeoutSec 30
        $length = (Get-Item -LiteralPath $target).Length
        if ($length -lt 50 -or $length -gt 262144) {
            throw "Tamano inesperado en $file ($length bytes). No se instalara."
        }
    }
    $skillText = Get-Content -LiteralPath (Join-Path $tempRoot 'SKILL.md.download') -Raw -Encoding UTF8
    $licenseText = Get-Content -LiteralPath (Join-Path $tempRoot 'LICENSE.txt.download') -Raw -Encoding UTF8
    if ($skillText -notmatch '(?ms)\A---\s*\r?\n.*?^name:\s*frontend-design\s*\r?$.*?^---\s*\r?$') {
        throw 'La descarga no contiene el frontmatter esperado de frontend-design.'
    }
    if ($licenseText -notmatch 'Apache License' -or $licenseText -notmatch 'Version 2\.0') {
        throw 'La licencia descargada no coincide con la revisada. Requiere inspeccion.'
    }
    foreach ($file in $sourceFiles) {
        Rename-Item -LiteralPath (Join-Path $tempRoot ($file + '.download')) -NewName $file
    }
    $manifest = [ordered]@{
        source_repository = 'https://github.com/anthropics/skills'
        source_ref = 'main (contenido verificado por hash local; no commit fijado)'
        fetched_at_utc = [DateTime]::UtcNow.ToString('o')
        note = 'Hash de integridad local, no prueba de seguridad. Leer SKILL.md antes de usarlo.'
        files = @($sourceFiles | ForEach-Object {
            [ordered]@{
                name = $_
                url = $sourceRoot + '/' + $_
                sha256 = (Get-FileHash -LiteralPath (Join-Path $tempRoot $_) -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        })
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText((Join-Path $tempRoot 'SOURCE.json'), ($manifest | ConvertTo-Json -Depth 5), $utf8)
    if (-not (Test-Path -LiteralPath $skillsRoot)) {
        New-Item -ItemType Directory -Path $skillsRoot | Out-Null
    }
    if (Test-Path -LiteralPath $destination) { throw 'La carpeta de destino ha aparecido durante la descarga. No se sobrescribe.' }
    Move-Item -LiteralPath $tempRoot -Destination $destination
    Write-Output "Instalada en $destination. Lee SKILL.md y confirma que Codex la detecta antes de afirmar que la has usado."
}
finally {
    [Net.ServicePointManager]::SecurityProtocol = $oldProtocol
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
