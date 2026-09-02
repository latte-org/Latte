# Start Latte with MSVC (Rust) and Node.js on PATH (Windows)
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
$yarn = Get-Command yarn -ErrorAction SilentlyContinue
if (-not $node -or -not $yarn) {
    Write-Error 'Node.js and Yarn are required. Open a terminal where both are available.'
    exit 1
}

$nodeDir = Split-Path -Parent $node.Source
$yarnDir = Split-Path -Parent $yarn.Source
$projectRoot = $PSScriptRoot

$vcvars = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat'
if (Test-Path $vcvars) {
    cmd /c "`"$vcvars`" >nul 2>&1 && set" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            Set-Item -Path "env:$($matches[1])" -Value $matches[2]
        }
    }
}

$env:Path = "$nodeDir;$yarnDir;$env:USERPROFILE\.cargo\bin;$projectRoot\node_modules\.bin;" + $env:Path
Set-Location $projectRoot

& "$projectRoot\node_modules\.bin\tauri.cmd" dev
