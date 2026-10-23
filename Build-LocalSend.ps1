param([string]$DotNetExe = 'dotnet')
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $DotNetExe) { $DotNetExe = (Resolve-Path -LiteralPath $DotNetExe).Path }
else { $DotNetExe = (Get-Command $DotNetExe -ErrorAction Stop).Source }
function Invoke-DotNet([string[]]$Arguments) {
    & $DotNetExe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "dotnet failed with exit code $LASTEXITCODE" }
}
Push-Location $PSScriptRoot
try {
    Invoke-DotNet -Arguments @('restore', 'V-Notch.csproj', '--locked-mode')
    Invoke-DotNet -Arguments @('publish', 'V-Notch.csproj', '--no-restore', '-c', 'Release', '-o', 'artifacts/localsend')
    Copy-Item -LiteralPath 'CUSTOM-LOCALSEND.md' -Destination 'artifacts/localsend/LOCALSEND-README.md'
    Copy-Item -LiteralPath 'CustomPreviews' -Destination 'artifacts/localsend' -Recurse -Force
    Write-Output "Built separately: $PSScriptRoot/artifacts/localsend/V-Notch.exe"
}
finally { Pop-Location }
