Set-Location (Join-Path $PSScriptRoot '..')
$node = (Get-Command node -ErrorAction Stop).Source
& $node ./node_modules/vite/bin/vite.js
