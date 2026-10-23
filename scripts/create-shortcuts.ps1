param([switch]$Startup)

$ErrorActionPreference = 'Stop'
$isletRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$isletExecutable = Join-Path $isletRoot 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $isletExecutable -PathType Leaf)) {
    throw 'Electron is missing. Run npm install in the Islet folder first.'
}

$isletDestinations = @([Environment]::GetFolderPath('Desktop'))
if ($Startup) { $isletDestinations += [Environment]::GetFolderPath('Startup') }
$isletShell = New-Object -ComObject WScript.Shell
$isletShortcutArguments = '"' + $isletRoot + '"'

# Check every destination before writing either shortcut. Do not replace an
# unrelated shortcut that happens to have the same display name.
foreach ($isletDestination in $isletDestinations) {
    if (-not $isletDestination -or -not (Test-Path -LiteralPath $isletDestination -PathType Container)) {
        throw 'The Windows shortcut folder could not be found.'
    }
    $isletShortcutPath = Join-Path $isletDestination 'Islet.lnk'
    if (Test-Path -LiteralPath $isletShortcutPath) {
        $isletExisting = $isletShell.CreateShortcut($isletShortcutPath)
        if ($isletExisting.TargetPath -ne $isletExecutable -or $isletExisting.Arguments -ne $isletShortcutArguments) {
            throw ('An unrelated Islet shortcut already exists: ' + $isletShortcutPath)
        }
    }
}

foreach ($isletDestination in $isletDestinations) {
    $isletShortcutPath = Join-Path $isletDestination 'Islet.lnk'
    $isletShortcut = $isletShell.CreateShortcut($isletShortcutPath)
    $isletShortcut.TargetPath = $isletExecutable
    $isletShortcut.Arguments = $isletShortcutArguments
    $isletShortcut.WorkingDirectory = $isletRoot
    $isletShortcut.Description = 'Islet - Dynamic Island for Windows'
    $isletShortcut.IconLocation = $isletExecutable + ',0'
    $isletShortcut.WindowStyle = 1
    $isletShortcut.Save()

    $isletSaved = $isletShell.CreateShortcut($isletShortcutPath)
    if ($isletSaved.TargetPath -ne $isletExecutable -or $isletSaved.Arguments -ne $isletShortcutArguments -or $isletSaved.WorkingDirectory -ne $isletRoot) {
        throw ('Shortcut verification failed: ' + $isletShortcutPath)
    }
    Write-Output ('Created and verified: ' + $isletShortcutPath)
}
