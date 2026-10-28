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
    # GPL-3.0: a distributed binary has to carry its licence and attribution.
    Copy-Item -LiteralPath 'LICENSE' -Destination 'artifacts/localsend/LICENSE'
    Copy-Item -LiteralPath 'docs/THIRD_PARTY_NOTICES.md' -Destination 'artifacts/localsend/THIRD_PARTY_NOTICES.md'
    Copy-Item -LiteralPath 'CUSTOM-LOCALSEND.md' -Destination 'artifacts/localsend/LOCALSEND-README.md'
    Copy-Item -LiteralPath 'CustomPreviews' -Destination 'artifacts/localsend' -Recurse -Force
    if (Test-Path -LiteralPath 'CUSTOM-AGENTS.md') {
        Copy-Item -LiteralPath 'CUSTOM-AGENTS.md' -Destination 'artifacts/localsend/AGENTS-README.md'
        New-Item -ItemType Directory -Path 'artifacts/localsend/Assets/Agents' -Force | Out-Null
        Get-ChildItem -LiteralPath 'Assets/Agents' -File | Copy-Item -Destination 'artifacts/localsend/Assets/Agents' -Force
    }
    if (Test-Path -LiteralPath 'CUSTOM-DOCK.md') {
        Copy-Item -LiteralPath 'CUSTOM-DOCK.md' -Destination 'artifacts/localsend/DOCK-README.md'
    }
    Write-Output "Built separately: $PSScriptRoot/artifacts/localsend/V-Notch.exe"
}
finally { Pop-Location }
