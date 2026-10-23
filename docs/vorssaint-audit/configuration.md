# Configuration appendix — Vorssaint e916961

รายการนี้ดึงจาก **@AppStorage declarations ใน UI/Settings โดยอัตโนมัติ** ไม่ใช่รายการ control ที่ยืนยันว่าแสดงพร้อมกันทั้งหมด บาง control มี dependency/permission/OS/hardware gating; key ซ้ำข้าม view เป็นเรื่องตั้งใจ และ default expression ไม่ใช่ผล runtime

พบ 474 declarations ใน 40 ไฟล์; เฉพาะไฟล์ Notch* 124 declarations

สิ่งที่เก็บผ่าน binding/service/encoded layout/defaults ที่อื่นอาจไม่อยู่ในรายการ @AppStorage นี้ ให้ดู [source map](source-map.md) ร่วมด้วย

## AppUpdatesSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.appUpdatesCheckFrequency` | `frequencyRaw` | `AppUpdatesSupport.CheckFrequency.off.rawValue` | [L9](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/AppUpdatesSettings.swift#L9) |
| `DefaultsKey.appUpdatesNotify` | `notify` | `true` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/AppUpdatesSettings.swift#L11) |
| `DefaultsKey.appUpdatesIncludeHomebrewApps` | `includeHomebrewApps` | `true` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/AppUpdatesSettings.swift#L12) |
| `DefaultsKey.appUpdatesIncludeAppStore` | `includeAppStore` | `true` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/AppUpdatesSettings.swift#L13) |
| `DefaultsKey.appUpdatesIncludeOnlineCatalog` | `includeOnlineCatalog` | `true` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/AppUpdatesSettings.swift#L14) |
| `DefaultsKey.panelUtilityAppUpdates` | `showInPanel` | `true` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/AppUpdatesSettings.swift#L16) |

## AutoQuitSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.autoQuitEnabled` | `enabled` | `false` | [L10](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/AutoQuitSettings.swift#L10) |

## ClipboardSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.pastePlainEnabled` | `pastePlainEnabled` | `false` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L13) |
| `DefaultsKey.clipboardHistoryEnabled` | `enabled` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L14) |
| `DefaultsKey.clipboardHistoryLimit` | `limit` | `50` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L15) |
| `DefaultsKey.clipboardHistoryRetentionDays` | `retentionDays` | `0` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L16) |
| `DefaultsKey.clipboardHistoryFilterSensitiveText` | `skipSensitive` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L17) |
| `DefaultsKey.clipboardHistoryIncludeImagesFiles` | `includeImagesFiles` | `true` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L18) |
| `DefaultsKey.clipboardHistoryShortcutEnabled` | `shortcutEnabled` | `true` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L19) |
| `DefaultsKey.clipboardHistoryLayout` | `historyLayout` | `ClipboardHistoryLayout.list` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L20) |
| `DefaultsKey.clipboardHistoryMenuBarPreview` | `menuBarPreview` | `false` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L21) |
| `DefaultsKey.clipboardHistoryMenuBarPreviewLength` | `menuBarPreviewLength` | `Defaults.defaultClipboardMenuBarPreviewLength` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L22) |
| `DefaultsKey.panelUtilityClipboard` | `showInPanel` | `true` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L24) |
| `DefaultsKey.finderPasteImageAsFile` | `pasteImageAsFile` | `false` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L25) |
| `DefaultsKey.clipboardAutoClearOnDelay` | `autoClearOnDelay` | `false` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L26) |
| `DefaultsKey.clipboardAutoClearDelay` | `autoClearDelay` | `Defaults.defaultClipboardAutoClearDelay` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L27) |
| `DefaultsKey.clipboardAutoClearOnSleep` | `autoClearOnSleep` | `false` | [L29](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L29) |
| `DefaultsKey.clipboardAutoClearOnDisplaySleep` | `autoClearOnDisplaySleep` | `false` | [L30](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L30) |
| `DefaultsKey.clipboardAutoClearOnScreenLock` | `autoClearOnScreenLock` | `false` | [L31](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ClipboardSettings.swift#L31) |

## CodexAccountsSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.notchAgentsCodexProfiles` | `saved` | `""` | [L9](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CodexAccountsSettings.swift#L9) |
| `DefaultsKey.notchAgentsHiddenCards` | `hiddenCards` | `""` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CodexAccountsSettings.swift#L11) |

## CommandBarAppShortcutsView.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.commandBarRowShortcuts` | `shortcutsRaw` | `""` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarAppShortcutsView.swift#L11) |
| `DefaultsKey.commandBarAliases` | `aliasesRaw` | `""` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarAppShortcutsView.swift#L12) |
| `DefaultsKey.commandBarPins` | `pinsRaw` | `""` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarAppShortcutsView.swift#L13) |

## CommandBarSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.commandBarShortcutEnabled` | `shortcutEnabled` | `false` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L11) |
| `DefaultsKey.commandBarCompactMode` | `compactMode` | `false` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L12) |
| `DefaultsKey.commandBarEmojiSkinTone` | `emojiSkinTone` | `""` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L13) |
| `DefaultsKey.commandBarASCIILayoutEnabled` | `asciiLayoutEnabled` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L14) |
| `DefaultsKey.commandBarDisabledSources` | `disabledSources` | `""` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L15) |
| `DefaultsKey.commandBarAliases` | `aliasesRaw` | `""` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L16) |
| `DefaultsKey.commandBarPins` | `pinsRaw` | `""` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L17) |
| `DefaultsKey.commandBarHidden` | `hiddenRaw` | `""` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L18) |
| `DefaultsKey.commandBarLinks` | `linksData` | `Data()` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L19) |
| `DefaultsKey.commandBarRowShortcuts` | `rowShortcutsRaw` | `""` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L20) |
| `DefaultsKey.commandBarFileScopes` | `fileScopesRaw` | `""` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L21) |
| `DefaultsKey.commandBarFileIgnores` | `fileIgnoresRaw` | `""` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CommandBarSettings.swift#L22) |

## CutPasteSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.finderCutPasteEnabled` | `enabled` | `false` | [L10](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CutPasteSettings.swift#L10) |
| `DefaultsKey.finderCutPasteShowHUD` | `showHUD` | `true` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CutPasteSettings.swift#L11) |
| `DefaultsKey.finderRenameEnabled` | `renameEnabled` | `false` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CutPasteSettings.swift#L12) |
| `DefaultsKey.finderRenameShortcut` | `renameShortcutRaw` | `GlobalShortcut.finderRenameDefault.storageValue` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/CutPasteSettings.swift#L13) |

## DisplayBrightnessShortcutControls.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.displayBrightnessShortcutsEnabled` | `enabled` | `false` | [L9](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DisplayBrightnessShortcutControls.swift#L9) |

## DockSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.dockPreviewEnabled` | `dockPreviewEnabled` | `false` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L13) |
| `DefaultsKey.dockPreviewCurrentSpaceOnly` | `dockPreviewCurrentSpaceOnly` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L14) |
| `DefaultsKey.dockPreviewBackgroundOpacity` | `dockPreviewBackgroundOpacity` | `1.0` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L15) |
| `DefaultsKey.liquidGlassEnabled` | `liquidGlassEnabled` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L16) |
| `DefaultsKey.dockPreviewOpenDelay` | `dockPreviewOpenDelay` | `DockPreviewSupport.defaultOpenDelayMilliseconds` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L18) |
| `DefaultsKey.dockPreviewQuitAppOnClose` | `dockPreviewQuitAppOnClose` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L19) |
| `DefaultsKey.dockPreviewOrderByCreation` | `dockPreviewOrderByCreation` | `false` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L20) |
| `DefaultsKey.dockPreviewKeepDockVisible` | `dockPreviewKeepDockVisible` | `false` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L21) |
| `DefaultsKey.dockClickMinimize` | `dockClickMinimize` | `false` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L23) |
| `DefaultsKey.dockClickHide` | `dockClickHide` | `false` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L24) |
| `DefaultsKey.dockClickCycleWindows` | `dockClickCycleWindows` | `false` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L25) |
| `DefaultsKey.spacesOrderEnabled` | `spacesOrderEnabled` | `false` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/DockSettings.swift#L26) |

## EnergySettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.brightnessControlEnabled` | `brightnessEnabled` | `false` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L18) |
| `DefaultsKey.brightnessKeysEnabled` | `brightnessKeysEnabled` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L19) |
| `DefaultsKey.brightnessOSDEnabled` | `brightnessOSDEnabled` | `false` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L20) |
| `DefaultsKey.brightnessKeyStep` | `brightnessKeyStep` | `BrightnessSupport.KeyStep.standard.rawValue` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L21) |
| `DefaultsKey.extraBrightnessEnabled` | `extraBrightnessEnabled` | `false` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L23) |
| `DefaultsKey.extraBrightnessLevel` | `extraBrightnessLevel` | `100` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L24) |
| `DefaultsKey.bluetoothSleepEnabled` | `bluetoothSleepEnabled` | `false` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L25) |
| `DefaultsKey.bluetoothSleepRestoreOnWake` | `bluetoothSleepRestoreOnWake` | `true` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L26) |
| `DefaultsKey.defaultDuration` | `defaultDuration` | `0` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L27) |
| `DefaultsKey.batteryLimit` | `batteryLimit` | `10` | [L28](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L28) |
| `DefaultsKey.keepAwakeAutoStart` | `keepAwakeAutoStart` | `false` | [L29](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L29) |
| `DefaultsKey.keepAwakeRightClickToggle` | `keepAwakeRightClickToggle` | `false` | [L30](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L30) |
| `DefaultsKey.keepAwakeAllowDisplaySleep` | `keepAwakeAllowDisplaySleep` | `false` | [L31](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L31) |
| `DefaultsKey.keepAwakePauseWhenLocked` | `keepAwakePauseWhenLocked` | `false` | [L32](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L32) |
| `DefaultsKey.keepAwakeAutomationRequireAll` | `keepAwakeAutomationRequireAll` | `false` | [L33](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L33) |
| `DefaultsKey.showCountdown` | `showCountdown` | `false` | [L34](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L34) |
| `DefaultsKey.keepAwakeIconTint` | `keepAwakeIconTint` | `KeepAwakeIconTint.orange.rawValue` | [L35](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L35) |
| `DefaultsKey.keepAwakeActiveIcon` | `keepAwakeActiveIcon` | `KeepAwakeActiveIcon.vorssaint.rawValue` | [L36](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L36) |
| `DefaultsKey.keepAwakeMouseJiggleEnabled` | `keepAwakeMouseJiggle` | `false` | [L37](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L37) |
| `DefaultsKey.keepAwakeMouseJiggleInterval` | `keepAwakeMouseJiggleInterval` | `5` | [L38](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/EnergySettings.swift#L38) |

## GeneralSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.hotkeyEnabled` | `hotkeyEnabled` | `true` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/GeneralSettings.swift#L19) |
| `DefaultsKey.menuBarIconSymbol` | `symbolName` | `""` | [L313](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/GeneralSettings.swift#L313) |

## GeneralToolSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.menuBarIconSymbol` | `savedName` | `""` | [L69](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/GeneralToolSettings.swift#L69) |
| `DefaultsKey.menuBarIconSymbol` | `savedName` | `""` | [L166](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/GeneralToolSettings.swift#L166) |
| `DefaultsKey.musicBlockEnabled` | `enabled` | `false` | [L233](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/GeneralToolSettings.swift#L233) |
| `DefaultsKey.musicBlockReplacementPath` | `replacementPath` | `""` | [L234](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/GeneralToolSettings.swift#L234) |
| `DefaultsKey.musicBlockPlayReplacement` | `playReplacement` | `true` | [L235](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/GeneralToolSettings.swift#L235) |

## HomebrewSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.homebrewGroupDependencies` | `homebrewGroupDependencies` | `true` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/HomebrewSettings.swift#L11) |

## KeyboardDebounceSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.keyboardDebounceEnabled` | `enabled` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/KeyboardDebounceSettings.swift#L16) |
| `DefaultsKey.keyboardDebounceWindowMs` | `globalWindow` | `Defaults.defaultKeyboardDebounceWindowMs` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/KeyboardDebounceSettings.swift#L17) |
| `DefaultsKey.keyboardDebounceKeyWindows` | `keyWindowsRaw` | `""` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/KeyboardDebounceSettings.swift#L18) |

## MonitorAlertsControls.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.monitorAlertCPU` | `alertCPU` | `false` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L11) |
| `DefaultsKey.monitorAlertCPUTemperature` | `alertCPUTemperature` | `false` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L12) |
| `DefaultsKey.monitorAlertBatteryTemperature` | `alertBatteryTemperature` | `false` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L13) |
| `DefaultsKey.monitorAlertMemory` | `alertMemory` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L14) |
| `DefaultsKey.monitorAlertDisk` | `alertDisk` | `false` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L15) |
| `DefaultsKey.monitorAlertBattery` | `alertBattery` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L16) |
| `DefaultsKey.monitorAlertCPUThreshold` | `alertCPUThreshold` | `90` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L17) |
| `DefaultsKey.monitorAlertCPUTemperatureThreshold` | `alertCPUTemperatureThreshold` | `90` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L18) |
| `DefaultsKey.monitorAlertBatteryTemperatureThreshold` | `alertBatteryTemperatureThreshold` | `40` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L19) |
| `DefaultsKey.monitorAlertDiskFreePercent` | `alertDiskFreePercent` | `10` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L20) |
| `DefaultsKey.monitorAlertBatteryPercent` | `alertBatteryPercent` | `15` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L21) |
| `DefaultsKey.monitorAlertCooldownMinutes` | `alertCooldown` | `15` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L22) |
| `DefaultsKey.temperatureUnit` | `temperatureUnit` | `TemperatureUnit.celsius.rawValue` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorAlertsControls.swift#L23) |

## MonitorPanelConfig.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.monitorShowSystem` | `showSystem` | `true` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L18) |
| `DefaultsKey.monitorSysTemps` | `sysTemps` | `true` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L19) |
| `DefaultsKey.monitorSysCPU` | `sysCPU` | `true` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L20) |
| `DefaultsKey.monitorSysCPUCores` | `sysCPUCores` | `true` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L21) |
| `DefaultsKey.monitorSysGPU` | `sysGPU` | `true` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L22) |
| `DefaultsKey.monitorPwrTemperature` | `pwrTemperature` | `true` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L23) |
| `DefaultsKey.monitorSysBattery` | `sysBattery` | `true` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L24) |
| `DefaultsKey.monitorSysMemory` | `sysMemory` | `true` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L25) |
| `DefaultsKey.monitorSysUptime` | `sysUptime` | `true` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L26) |
| `DefaultsKey.monitorSysConnectedDevices` | `sysConnectedDevices` | `true` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L27) |
| `DefaultsKey.monitorShowNetwork` | `showNetwork` | `true` | [L29](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L29) |
| `DefaultsKey.monitorNetSpeed` | `netSpeed` | `true` | [L30](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L30) |
| `DefaultsKey.monitorNetApps` | `netApps` | `true` | [L31](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L31) |
| `DefaultsKey.monitorNetTotals` | `netTotals` | `true` | [L32](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L32) |
| `DefaultsKey.monitorNetTest` | `netTest` | `true` | [L33](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L33) |
| `DefaultsKey.monitorNetAddresses` | `netAddresses` | `true` | [L34](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L34) |
| `DefaultsKey.monitorShowDisk` | `showDisk` | `true` | [L36](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L36) |
| `DefaultsKey.monitorDiskUsage` | `diskUsage` | `true` | [L37](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L37) |
| `DefaultsKey.monitorDiskActivity` | `diskActivity` | `true` | [L38](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L38) |
| `DefaultsKey.monitorDiskSMART` | `diskSMART` | `true` | [L39](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L39) |
| `DefaultsKey.monitorDiskProtection` | `diskProtection` | `true` | [L40](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L40) |
| `DefaultsKey.monitorDiskTools` | `diskTools` | `true` | [L41](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L41) |
| `DefaultsKey.monitorShowPower` | `showPower` | `true` | [L43](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L43) |
| `DefaultsKey.monitorPwrSystem` | `pwrSystem` | `true` | [L44](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L44) |
| `DefaultsKey.monitorPwrAdapter` | `pwrAdapter` | `true` | [L45](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L45) |
| `DefaultsKey.monitorPwrBattery` | `pwrBattery` | `true` | [L46](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L46) |
| `DefaultsKey.monitorPwrTimeRemaining` | `pwrTimeRemaining` | `true` | [L47](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L47) |
| `DefaultsKey.monitorPwrHealth` | `pwrHealth` | `true` | [L48](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L48) |
| `DefaultsKey.monitorPwrPeripherals` | `pwrPeripherals` | `false` | [L49](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L49) |
| `DefaultsKey.monitorShowMixer` | `showMixer` | `true` | [L51](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L51) |
| `DefaultsKey.monitorGraphCPU` | `graphCPU` | `true` | [L53](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L53) |
| `DefaultsKey.monitorGraphGPU` | `graphGPU` | `true` | [L54](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L54) |
| `DefaultsKey.monitorGraphMemory` | `graphMemory` | `true` | [L55](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L55) |
| `DefaultsKey.monitorGraphNetwork` | `graphNetwork` | `true` | [L56](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L56) |
| `DefaultsKey.monitorGraphDisk` | `graphDisk` | `true` | [L57](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L57) |
| `DefaultsKey.monitorGraphPower` | `graphPower` | `true` | [L58](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L58) |
| `DefaultsKey.monitorGraphBattery` | `graphBattery` | `true` | [L59](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorPanelConfig.swift#L59) |

## MonitorSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.menuBarCombineTemperatures` | `combineTemperatures` | `true` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L16) |
| `DefaultsKey.menuBarSeparateMetrics` | `separateMetrics` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L17) |
| `DefaultsKey.menuBarMetricSpacing` | `metricSpacing` | `"standard"` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L18) |
| `DefaultsKey.menuBarMetricAppearance` | `metricAppearance` | `"values"` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L19) |
| `DefaultsKey.menuBarHideIconWithMetrics` | `hideIconWithMetrics` | `false` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L20) |
| `DefaultsKey.monitorInterval` | `interval` | `2` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L21) |
| `DefaultsKey.monitorGraphScale` | `graphScale` | `true` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L22) |
| `DefaultsKey.temperatureUnit` | `temperatureUnit` | `TemperatureUnit.celsius.rawValue` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L23) |
| `DefaultsKey.networkSpeedUnit` | `networkSpeedUnit` | `NetworkSpeedUnit.bytes` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L24) |
| `DefaultsKey.monitorMemoryMetric` | `memoryMetric` | `"used"` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L25) |
| `DefaultsKey.panelShowFanControl` | `showFanControl` | `true` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L26) |
| `DefaultsKey.menuBarMetricOrder` | `metricOrder` | `""` | [L353](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L353) |
| `DefaultsKey.menuBarMemoryStyle` | `memoryStyle` | `"percent"` | [L394](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L394) |
| `DefaultsKey.menuBarNetworkUploadFirst` | `uploadFirst` | `false` | [L395](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L395) |
| `DiskMenuBarStyle.defaultsKey` | `diskStyle` | `DiskMenuBarStyle.percent` | [L396](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L396) |
| `DefaultsKey.menuBarUsageBarNormalColor` | `normalColor` | `MenuBarUsageBarSupport.defaultNormalColor` | [L454](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L454) |
| `DefaultsKey.menuBarUsageBarElevatedColor` | `elevatedColor` | `MenuBarUsageBarSupport.defaultElevatedColor` | [L455](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L455) |
| `DefaultsKey.menuBarUsageBarCriticalColor` | `criticalColor` | `MenuBarUsageBarSupport.defaultCriticalColor` | [L456](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L456) |
| `DefaultsKey.menuBarUsageBarMediumThreshold` | `mediumThreshold` | `MenuBarUsageBarSupport.defaultMediumThreshold` | [L457](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L457) |
| `DefaultsKey.menuBarUsageBarHighThreshold` | `highThreshold` | `MenuBarUsageBarSupport.defaultHighThreshold` | [L458](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MonitorSettings.swift#L458) |

## MouseButtonSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.mouseButtonShortcutsEnabled` | `enabled` | `false` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseButtonSettings.swift#L15) |
| `DefaultsKey.mouseSpacesGestureEnabled` | `spacesEnabled` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseButtonSettings.swift#L16) |
| `DefaultsKey.mouseSpacesGestureButton` | `spacesButton` | `0` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseButtonSettings.swift#L17) |
| `DefaultsKey.mouseSpacesGestureFollowsDrag` | `spacesFollowsDrag` | `false` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseButtonSettings.swift#L18) |

## MouseSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.scrollInverterEnabled` | `invertVertical` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L17) |
| `DefaultsKey.scrollInverterHorizontalEnabled` | `invertHorizontal` | `false` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L18) |
| `DefaultsKey.scrollHorizontalEnabled` | `horizontalScrollEnabled` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L19) |
| `DefaultsKey.scrollHorizontalModifier` | `horizontalScrollModifier` | `ScrollHorizontalModifier.shift` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L20) |
| `DefaultsKey.focusFollowsMouseEnabled` | `focusFollowsMouseEnabled` | `false` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L22) |
| `DefaultsKey.focusFollowsMouseRaise` | `focusFollowsMouseRaise` | `true` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L23) |
| `DefaultsKey.focusFollowsMouseWaitForStop` | `focusFollowsMouseWaitForStop` | `true` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L24) |
| `DefaultsKey.focusFollowsMouseDelay` | `focusFollowsMouseDelay` | `FocusFollowsMouseSupport.defaultDelayMilliseconds` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L25) |
| `DefaultsKey.smoothScrollEnabled` | `smoothScrollEnabled` | `false` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L27) |
| `DefaultsKey.smoothScrollStep` | `smoothScrollStep` | `SmoothScrollSupport.defaultStep` | [L28](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L28) |
| `DefaultsKey.mouseAccelerationDisabled` | `mouseAccelerationDisabled` | `false` | [L29](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L29) |
| `DefaultsKey.linearScrollEnabled` | `linearScrollEnabled` | `false` | [L30](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L30) |
| `DefaultsKey.linearScrollLines` | `linearScrollLines` | `ScrollWheelSupport.defaultLinesPerNotch` | [L31](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L31) |
| `DefaultsKey.smoothScrollResponse` | `smoothScrollResponse` | `SmoothScrollSupport.defaultResponse` | [L33](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L33) |
| `DefaultsKey.smoothScrollCoast` | `smoothScrollCoast` | `SmoothScrollSupport.defaultCoast` | [L35](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L35) |
| `DefaultsKey.mouseNavigationEnabled` | `mouseNavigationEnabled` | `false` | [L37](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L37) |
| `DefaultsKey.mouseButtonShortcutsEnabled` | `mouseButtonShortcutsEnabled` | `false` | [L38](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L38) |
| `DefaultsKey.mouseSpacesGestureEnabled` | `spacesEnabled` | `false` | [L39](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L39) |
| `DefaultsKey.middleClickEnabled` | `middleClickEnabled` | `false` | [L40](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L40) |
| `DefaultsKey.middleClickTapFingers` | `middleClickTapFingers` | `0` | [L41](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L41) |
| `DefaultsKey.mouseClickDebounceEnabled` | `mouseClickDebounceEnabled` | `false` | [L42](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L42) |
| `DefaultsKey.mouseClickDebounceWindowMs` | `mouseClickDebounceWindow` | `Defaults.defaultMouseClickDebounceWindowMs` | [L43](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/MouseSettings.swift#L43) |

## NotchAgentsSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.notchAgentsClaude` | `claude` | `true` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L11) |
| `DefaultsKey.notchAgentsCodex` | `codex` | `true` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L12) |
| `DefaultsKey.notchAgentsOpenCode` | `opencode` | `true` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L13) |
| `DefaultsKey.notchAgentsCopilot` | `copilot` | `true` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L14) |
| `DefaultsKey.notchAgentsCardOrder` | `cardOrder` | `""` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L15) |
| `DefaultsKey.notchAgentsHiddenCards` | `hiddenCards` | `""` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L16) |
| `DefaultsKey.notchAgentsLimitDisplay` | `limitDisplay` | `NotchAgentLimitDisplay.remaining.rawValue` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L17) |
| `DefaultsKey.notchAgentsLimitFocus` | `limitFocus` | `NotchAgentLimitFocus.mostUsed.rawValue` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L18) |
| `DefaultsKey.notchAgentsLiveActivity` | `liveActivity` | `true` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L19) |
| `DefaultsKey.notchAgentsReadout` | `readout` | `NotchAgentReadout.elapsed.rawValue` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L20) |
| `DefaultsKey.notchAgentsFinishAlert` | `finishAlert` | `true` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L21) |
| `DefaultsKey.notchAgentsFinishMinimum` | `finishMinimum` | `NotchAgentSupport.defaultFinishMinimum` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L22) |
| `DefaultsKey.notchAgentsLimitAlert` | `limitAlert` | `true` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L23) |
| `DefaultsKey.notchAgentsLimitThreshold` | `limitThreshold` | `NotchAgentSupport.defaultLimitThreshold` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L24) |
| `DefaultsKey.notchAgentsDailyBudget` | `dailyBudget` | `0.0` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L25) |
| `DefaultsKey.notchAgentsPriceUpdates` | `priceUpdates` | `true` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L26) |

## NotchContentEditor.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.notchLiquidGlassEnabled` | `glass` | `false` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchContentEditor.swift#L15) |
| `DefaultsKey.scratchpadTextSize` | `storedTextSize` | `ScratchpadSupport.defaultTextSize` | [L206](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchContentEditor.swift#L206) |

## NotchLayoutEditor.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.notchOutlineEnabled` | `outlineEnabled` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchLayoutEditor.swift#L17) |

## NotchMascotSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.notchEnabled` | `islandEnabled` | `false` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L15) |
| `DefaultsKey.notchSilhouette` | `silhouette` | `NotchSilhouette.capsule.rawValue` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L16) |
| `DefaultsKey.notchMascotEnabled` | `enabled` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L17) |
| `DefaultsKey.notchMascotVisits` | `visits` | `true` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L18) |
| `DefaultsKey.notchMascotReactions` | `reactions` | `true` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L19) |
| `DefaultsKey.notchMascotHidesWhenIdle` | `hidesWhenIdle` | `true` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L20) |
| `DefaultsKey.notchMascotStyle` | `style` | `NotchMascotStyle.minimal.rawValue` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L21) |
| `DefaultsKey.notchMascotShape` | `shape` | `NotchMascotShape.ball.rawValue` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L22) |
| `DefaultsKey.notchMascotPalette` | `palette` | `NotchMascotPalette.pearl.rawValue` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L23) |
| `DefaultsKey.notchMascotSide` | `side` | `NotchMascotSide.left.rawValue` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L24) |
| `DefaultsKey.notchMascotVisitFrequency` | `frequency` | `NotchMascotVisitFrequency.normal.rawValue` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L25) |
| `DefaultsKey.notchCommandBar` | `commandBar` | `true` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L26) |
| `DefaultsKey.notchCommandBarStyle` | `commandBarStyle` | `NotchCommandBarStyle.droplet.rawValue` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L27) |

## NotchSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.notchGesturesEnabled` | `gesturesEnabled` | `true` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L13) |
| `DefaultsKey.notchKeyboardLight` | `keyboardLight` | `true` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L14) |
| `DefaultsKey.notchNotificationsEnabled` | `notificationsEnabled` | `true` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L15) |
| `DefaultsKey.notchDismissNativeNotifications` | `dismissNativeNotifications` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L16) |
| `DefaultsKey.notchTimerEnabled` | `timerEnabled` | `true` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L17) |
| `DefaultsKey.notchTimerSoundEnabled` | `timerSoundEnabled` | `true` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L18) |
| `DefaultsKey.notchHideTimerCountdown` | `hideTimerCountdown` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L19) |
| `DefaultsKey.notchCameraEnabled` | `cameraEnabled` | `true` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L20) |
| `DefaultsKey.notchAccessoriesEnabled` | `accessoriesEnabled` | `true` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L21) |
| `DefaultsKey.notchCalendarEnabled` | `calendarEnabled` | `true` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L22) |
| `DefaultsKey.notchCalendarCountdown` | `calendarCountdown` | `false` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L23) |
| `DefaultsKey.notchCalendarTimeLeft` | `calendarTimeLeft` | `false` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L24) |
| `DefaultsKey.notchCalendarWeekNumbers` | `calendarWeekNumbers` | `false` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L25) |
| `DefaultsKey.notchAgentsEnabled` | `agentsEnabled` | `false` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L26) |
| `DefaultsKey.notchWatchEnabled` | `watchEnabled` | `true` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L27) |
| `DefaultsKey.notchLyricsEnabled` | `lyricsEnabled` | `true` | [L28](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L28) |
| `DefaultsKey.notchLyricsOnline` | `lyricsOnline` | `false` | [L29](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L29) |
| `DefaultsKey.notchBrowserCovers` | `browserCovers` | `false` | [L30](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L30) |
| `DefaultsKey.notchQueueEnabled` | `queueEnabled` | `true` | [L31](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L31) |
| `DefaultsKey.notchLiveEqualizer` | `liveEqualizer` | `false` | [L32](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L32) |
| `DefaultsKey.notchEnabled` | `enabled` | `false` | [L33](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L33) |
| `DefaultsKey.notchMascotEnabled` | `mascotEnabled` | `false` | [L34](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L34) |
| `DefaultsKey.notchMascotHidesWhenIdle` | `mascotHidesWhenIdle` | `true` | [L35](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L35) |
| `DefaultsKey.notchMascotStyle` | `mascotStyle` | `NotchMascotStyle.minimal.rawValue` | [L36](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L36) |
| `DefaultsKey.notchMascotShape` | `mascotShape` | `NotchMascotShape.ball.rawValue` | [L37](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L37) |
| `DefaultsKey.notchMascotPalette` | `mascotPalette` | `NotchMascotPalette.pearl.rawValue` | [L38](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L38) |
| `DefaultsKey.notchMascotSide` | `mascotSide` | `NotchMascotSide.left.rawValue` | [L39](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L39) |
| `DefaultsKey.notchDisplay` | `display` | `NotchDisplay.automatic.rawValue` | [L40](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L40) |
| `DefaultsKey.notchSilhouette` | `silhouette` | `NotchSilhouette.capsule.rawValue` | [L41](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L41) |
| `DefaultsKey.notchOpenOnHover` | `hover` | `false` | [L42](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L42) |
| `DefaultsKey.notchShortcutEnabled` | `shortcutEnabled` | `false` | [L43](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L43) |
| `DefaultsKey.notchHideInFullscreen` | `hideInFullscreen` | `false` | [L44](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L44) |
| `DefaultsKey.notchHideUntilHover` | `hideUntilHover` | `false` | [L45](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L45) |
| `DefaultsKey.notchHiddenShowsActivity` | `hiddenShowsActivity` | `false` | [L46](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L46) |
| `DefaultsKey.notchCoversMenus` | `coversMenus` | `true` | [L47](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L47) |
| `DefaultsKey.notchHoverDelay` | `hoverDelay` | `NotchSupport.defaultHoverDelay` | [L48](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L48) |
| `DefaultsKey.notchCloseDelay` | `closeDelay` | `NotchSupport.defaultCloseDelay` | [L49](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L49) |
| `DefaultsKey.notchReturnHome` | `returnHome` | `false` | [L50](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L50) |
| `DefaultsKey.notchHomeModule` | `homeModule` | `NotchModule.controls.rawValue` | [L51](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L51) |
| `DefaultsKey.notchOpensActivity` | `opensActivity` | `true` | [L52](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L52) |
| `DefaultsKey.notchHiddenModules` | `hidden` | `""` | [L53](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L53) |
| `DefaultsKey.notchModuleOrder` | `order` | `""` | [L54](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L54) |
| `DefaultsKey.notchVolume` | `volume` | `true` | [L55](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L55) |
| `DefaultsKey.notchInputSource` | `inputSource` | `true` | [L56](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L56) |
| `DefaultsKey.notchMicrophone` | `microphone` | `true` | [L57](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L57) |
| `DefaultsKey.notchBrightness` | `brightness` | `true` | [L58](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L58) |
| `DefaultsKey.notchBattery` | `battery` | `true` | [L59](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L59) |
| `DefaultsKey.notchClipboard` | `clipboard` | `true` | [L60](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L60) |
| `DefaultsKey.notchClipboardWindow` | `clipboardWindow` | `true` | [L61](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L61) |
| `DefaultsKey.notchClipboardCardSize` | `clipboardCardSize` | `NotchClipboardCardSize.comfortable.rawValue` | [L62](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L62) |
| `DefaultsKey.screenshotDefaultAction` | `captureAction` | `""` | [L63](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L63) |
| `DefaultsKey.notchCapture` | `capture` | `true` | [L64](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L64) |
| `DefaultsKey.notchTrackChange` | `trackChange` | `true` | [L65](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L65) |
| `DefaultsKey.notchShowPlayingMusic` | `showPlayingMusic` | `true` | [L66](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L66) |
| `DefaultsKey.notchIncludeOtherPlayers` | `includeOtherPlayers` | `true` | [L67](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L67) |
| `DefaultsKey.notchPreferredPlayer` | `preferredPlayer` | `NotchPreferredPlayer.automatic` | [L68](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L68) |
| `DefaultsKey.notchIdleContent` | `idle` | `NotchIdleContent.music.rawValue` | [L69](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L69) |
| `DefaultsKey.notchLowBatteryTint` | `lowBatteryTint` | `false` | [L70](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L70) |
| `DefaultsKey.notchLowBatteryThreshold` | `lowBatteryThreshold` | `NotchSupport.defaultLowBatteryThreshold` | [L71](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L71) |
| `DefaultsKey.notchLowBatteryEarly` | `earlyBatteryWarning` | `false` | [L72](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L72) |
| `DefaultsKey.notchLowBatteryEarlyThreshold` | `earlyBatteryThreshold` | `NotchSupport.defaultEarlyBatteryThreshold` | [L73](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L73) |
| `DefaultsKey.notchLowBatteryMenuBar` | `lowBatteryMenuBar` | `true` | [L74](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L74) |
| `DefaultsKey.notchHiddenControls` | `hiddenControls` | `NotchControlItem.defaultHidden` | [L75](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L75) |
| `DefaultsKey.notchControlOrder` | `controlOrder` | `""` | [L76](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L76) |
| `DefaultsKey.notchShowInCaptures` | `showInCaptures` | `true` | [L77](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L77) |
| `DefaultsKey.notchLockScreen` | `lockScreen` | `false` | [L78](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L78) |
| `DefaultsKey.notchLockSounds` | `lockSounds` | `false` | [L79](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L79) |
| `DefaultsKey.notchSize` | `size` | `NotchSize.spacious.rawValue` | [L80](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L80) |
| `DefaultsKey.notchOutlineEnabled` | `outlineEnabled` | `false` | [L81](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L81) |
| `DefaultsKey.notchHideMenuBarGap` | `hideMenuBarGap` | `false` | [L82](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L82) |
| `DefaultsKey.notchCustomWidth` | `customWidth` | `NotchSize.defaultWidth` | [L83](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L83) |
| `DefaultsKey.notchCustomHeight` | `customHeight` | `NotchSize.defaultHeight` | [L84](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L84) |
| `DefaultsKey.notchCameraFitWidth` | `cameraFitWidth` | `0.0` | [L85](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L85) |
| `DefaultsKey.notchCameraFitHeight` | `cameraFitHeight` | `0.0` | [L86](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L86) |
| `DefaultsKey.notchCapsuleFitWidth` | `capsuleFitWidth` | `0.0` | [L87](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L87) |
| `DefaultsKey.notchCapsuleFitHeight` | `capsuleFitHeight` | `0.0` | [L88](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L88) |
| `DefaultsKey.notchCapsuleFitDrop` | `capsuleFitDrop` | `0.0` | [L89](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L89) |
| `DefaultsKey.notchHapticFeedback` | `hapticFeedback` | `true` | [L90](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L90) |
| `DefaultsKey.notchTranslucentBackground` | `translucentBackground` | `false` | [L91](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L91) |
| `DefaultsKey.notchLiquidGlassEnabled` | `liquidGlass` | `false` | [L92](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L92) |
| `DefaultsKey.notchShelf` | `shelfWindow` | `true` | [L93](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L93) |
| `DefaultsKey.notchDragReveal` | `dragReveal` | `true` | [L94](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L94) |
| `DefaultsKey.notchCaptureControls` | `captureControls` | `true` | [L95](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L95) |
| `DefaultsKey.notchQuickPanel` | `quickPanel` | `true` | [L96](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L96) |
| `DefaultsKey.notchAppPanel` | `appPanel` | `false` | [L97](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L97) |
| `DefaultsKey.notchHidesMenuBarIcon` | `hidesMenuBarIcon` | `false` | [L98](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L98) |
| `DefaultsKey.notchKeepAwakeActivity` | `keepAwakeActivity` | `false` | [L99](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L99) |
| `DefaultsKey.notchScratchpad` | `scratchpad` | `true` | [L100](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L100) |
| `DefaultsKey.brightnessControlEnabled` | `brightnessControlEnabled` | `false` | [L101](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L101) |
| `DefaultsKey.clipboardHistoryEnabled` | `clipboardHistoryEnabled` | `false` | [L102](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L102) |
| `DefaultsKey.notchHoverExpands` | `hoverExpand` | `true` | [L103](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L103) |
| `DefaultsKey.notchQuickAccessLayout` | `accessData` | `Data()` | [L104](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L104) |

## PanelLayoutEditor.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.panelShowFanControl` | `showFanControl` | `true` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/PanelLayoutEditor.swift#L16) |
| `DefaultsKey.brightnessControlEnabled` | `brightnessEnabled` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/PanelLayoutEditor.swift#L17) |

## QuickToolsSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.quickLauncherShortcutEnabled` | `launcherShortcutEnabled` | `true` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L16) |
| `DefaultsKey.micMuteShortcutEnabled` | `micShortcutEnabled` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L17) |
| `DefaultsKey.cameraPreviewShortcutEnabled` | `cameraShortcutEnabled` | `false` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L18) |
| `DefaultsKey.scratchpadShortcutEnabled` | `scratchpadShortcutEnabled` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L19) |
| `DefaultsKey.scratchpadRetention` | `scratchpadRetention` | `ScratchpadRetention.never.rawValue` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L20) |
| `DefaultsKey.scratchpadCloseOnClickOutside` | `scratchpadCloseOnClickOutside` | `true` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L21) |
| `DefaultsKey.scratchpadBackgroundOpacity` | `scratchpadBackgroundOpacity` | `0.0` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L22) |
| `DefaultsKey.scratchpadTextSize` | `scratchpadTextSize` | `ScratchpadSupport.defaultTextSize` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L23) |
| `DefaultsKey.micMuteMenuBarIndicator` | `micMenuBarIndicator` | `false` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L24) |
| `DefaultsKey.cleaningModeKeepScreenVisible` | `cleaningModeKeepScreenVisible` | `false` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuickToolsSettings.swift#L25) |

## QuitProtectionSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.quitProtectionQuitEnabled` | `quitEnabled` | `false` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L11) |
| `DefaultsKey.quitProtectionQuitMode` | `quitMode` | `QuitProtectionMode.hold.rawValue` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L12) |
| `DefaultsKey.quitProtectionQuitHoldDurationMs` | `quitHoldDuration` | `QuitProtectionSupport.defaultHoldDurationMilliseconds` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L13) |
| `DefaultsKey.quitProtectionQuitDoubleIntervalMs` | `quitDoubleInterval` | `QuitProtectionSupport.defaultDoublePressIntervalMilliseconds` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L14) |
| `DefaultsKey.quitProtectionQuitExtraModifier` | `quitExtraModifier` | `QuitProtectionExtraModifier.shift.rawValue` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L15) |
| `DefaultsKey.quitProtectionQuitScope` | `quitScope` | `QuitProtectionScope.all.rawValue` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L16) |
| `DefaultsKey.quitProtectionQuitShowFeedback` | `quitShowFeedback` | `true` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L17) |
| `DefaultsKey.quitProtectionCloseEnabled` | `closeEnabled` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L19) |
| `DefaultsKey.quitProtectionCloseMode` | `closeMode` | `QuitProtectionMode.hold.rawValue` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L20) |
| `DefaultsKey.quitProtectionCloseHoldDurationMs` | `closeHoldDuration` | `QuitProtectionSupport.defaultHoldDurationMilliseconds` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L21) |
| `DefaultsKey.quitProtectionCloseDoubleIntervalMs` | `closeDoubleInterval` | `QuitProtectionSupport.defaultDoublePressIntervalMilliseconds` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L22) |
| `DefaultsKey.quitProtectionCloseExtraModifier` | `closeExtraModifier` | `QuitProtectionExtraModifier.shift.rawValue` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L23) |
| `DefaultsKey.quitProtectionCloseScope` | `closeScope` | `QuitProtectionScope.all.rawValue` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L24) |
| `DefaultsKey.quitProtectionCloseShowFeedback` | `closeShowFeedback` | `true` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/QuitProtectionSettings.swift#L25) |

## RadialMenuSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.radialMenuEnabled` | `enabled` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/RadialMenuSettings.swift#L14) |
| `DefaultsKey.radialMenuAtPointer` | `atPointer` | `true` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/RadialMenuSettings.swift#L15) |
| `DefaultsKey.radialMenuActivationMode` | `activationModeRaw` | `RadialMenuActivationMode.pressOrHold.rawValue` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/RadialMenuSettings.swift#L16) |
| `DefaultsKey.middleClickEnabled` | `middleClickEnabled` | `false` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/RadialMenuSettings.swift#L18) |
| `DefaultsKey.middleClickTapFingers` | `middleClickTapFingers` | `0` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/RadialMenuSettings.swift#L19) |

## ScreenCaptureSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.recentCapturesShortcutEnabled` | `enabled` | `false` | [L109](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenCaptureSettings.swift#L109) |
| `DefaultsKey.screenOCRRemoveLineBreaks` | `removesLineBreaks` | `false` | [L180](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenCaptureSettings.swift#L180) |
| `DefaultsKey.screenOCRDetectQRCodes` | `detectsQRCodes` | `true` | [L181](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenCaptureSettings.swift#L181) |
| `DefaultsKey.colorPickerFormat` | `format` | `"hex"` | [L213](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenCaptureSettings.swift#L213) |
| `DefaultsKey.colorPickerBareHex` | `usesBareHex` | `false` | [L214](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenCaptureSettings.swift#L214) |

## ScreenRecorderSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.recorderCountdown` | `countdown` | `3` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L14) |
| `DefaultsKey.recorderQuality` | `qualityRaw` | `RecorderSupport.Quality.balanced.rawValue` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L15) |
| `DefaultsKey.recorderFrameRate` | `frameRate` | `60` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L17) |
| `DefaultsKey.recorderSystemAudio` | `systemAudio` | `true` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L18) |
| `DefaultsKey.recorderMicrophone` | `microphone` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L19) |
| `DefaultsKey.recorderSaveFolder` | `saveFolder` | `""` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L20) |
| `DefaultsKey.recorderOpenEditor` | `opensEditor` | `true` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L21) |
| `DefaultsKey.recorderAutomaticZoom` | `automaticZoom` | `true` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L22) |
| `DefaultsKey.recorderGIFSize` | `gifSizeRaw` | `RecorderSupport.GIFSize.medium.rawValue` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L23) |
| `DefaultsKey.recorderGIFFrameRate` | `gifFrameRate` | `12` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L25) |
| `DefaultsKey.recorderSharingEnabled` | `sharingEnabled` | `true` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenRecorderSettings.swift#L26) |

## ScreenshotSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.screenshotFullScreenShortcutEnabled` | `fullScreenShortcutEnabled` | `false` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L12) |
| `DefaultsKey.screenshotLastCaptureShortcutEnabled` | `lastCaptureShortcutEnabled` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L14) |
| `DefaultsKey.screenshotClipboardShortcutEnabled` | `clipboardShortcutEnabled` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L16) |
| `DefaultsKey.screenshotFreeze` | `freeze` | `true` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L18) |
| `DefaultsKey.screenshotHideVorssaintWindows` | `hideVorssaintWindows` | `true` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L19) |
| `DefaultsKey.screenshotSaveFolder` | `saveFolder` | `""` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L20) |
| `DefaultsKey.screenshotSaveSubfolder` | `saveSubfolder` | `""` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L21) |
| `DefaultsKey.screenshotFileNamePattern` | `fileNamePattern` | `""` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L22) |
| `DefaultsKey.screenshotFileNumberStart` | `numberStart` | `1` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L23) |
| `DefaultsKey.screenshotFileNumberNext` | `nextNumber` | `1` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L24) |
| `DefaultsKey.screenshotIncludePointer` | `includePointer` | `false` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L25) |
| `DefaultsKey.screenshotShowLastRegion` | `showLastRegion` | `true` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L26) |
| `DefaultsKey.screenshotHighlightWindows` | `highlightWindows` | `true` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L27) |
| `DefaultsKey.screenshotLoupeStartsOn` | `loupeStartsOn` | `false` | [L28](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L28) |
| `DefaultsKey.screenshotLoupeRememberZoom` | `rememberLoupeZoom` | `false` | [L29](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L29) |
| `DefaultsKey.screenshotLoupeDefaultZoom` | `loupeDefaultZoom` | `1.0` | [L30](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L30) |
| `DefaultsKey.screenshotLoupeSteppedZoomByDefault` | `steppedLoupeZoomByDefault` | `false` | [L31](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L31) |
| `DefaultsKey.screenshotDownscale` | `downscale` | `false` | [L33](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L33) |
| `DefaultsKey.screenshotDelay` | `delay` | `0` | [L34](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L34) |
| `DefaultsKey.screenshotDefaultAction` | `defaultActionRaw` | `""` | [L35](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L35) |
| `DefaultsKey.screenshotToolOrder` | `toolOrderRaw` | `ScreenshotSupport.Tool.defaultOrderStorage` | [L36](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L36) |
| `DefaultsKey.screenshotToolShortcutsEnabled` | `toolShortcutsEnabled` | `true` | [L38](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L38) |
| `DefaultsKey.screenshotCopyToClipboard` | `copyToClipboard` | `false` | [L39](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L39) |
| `DefaultsKey.screenshotAddToShelf` | `addToShelf` | `false` | [L40](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L40) |
| `DefaultsKey.shelfEnabled` | `shelfEnabled` | `false` | [L41](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L41) |
| `AppFeature.shelf.availabilityKey` | `shelfAvailable` | `false` | [L42](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L42) |
| `DefaultsKey.screenshotPreviewPosition` | `previewPositionRaw` | `""` | [L43](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L43) |
| `DefaultsKey.screenshotPreviewTakesFocus` | `previewTakesFocus` | `true` | [L44](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L44) |
| `DefaultsKey.screenshotPreviewEnabled` | `previewEnabled` | `true` | [L45](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L45) |
| `DefaultsKey.screenshotPreviewDuration` | `previewDuration` | `ScreenshotSupport.defaultConfirmationPreviewDuration` | [L46](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L46) |
| `DefaultsKey.screenshotSharingEnabled` | `sharingEnabled` | `true` | [L48](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L48) |
| `DefaultsKey.screenshotUploadShortcutEnabled` | `uploadShortcutEnabled` | `false` | [L49](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L49) |
| `DefaultsKey.screenshotUploadDuration` | `uploadDuration` | `ScreenshotShareDuration.oneHour.rawValue` | [L50](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ScreenshotSettings.swift#L50) |

## SettingsView.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.superKeySource` | `superKeySourceRaw` | `SuperKeySource.capsLock.rawValue` | [L56](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsView.swift#L56) |
| `DefaultsKey.autoCheckUpdates` | `autoCheck` | `true` | [L619](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsView.swift#L619) |
| `DefaultsKey.includeBetaUpdates` | `includeBetas` | `AppInfo.isBeta` | [L620](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsView.swift#L620) |
| `DefaultsKey.showReleaseNotesBeforeUpdate` | `showReleaseNotesFirst` | `true` | [L621](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsView.swift#L621) |
| `DefaultsKey.releaseNotesOnUpdate` | `showWhatsNewAfter` | `true` | [L622](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsView.swift#L622) |

## ShelfSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.shelfEnabled` | `enabled` | `false` | [L9](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L9) |
| `DefaultsKey.shelfShortcutEnabled` | `shortcutEnabled` | `true` | [L10](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L10) |
| `DefaultsKey.shelfShortcutAddsFinderSelection` | `shortcutAddsFinderSelection` | `false` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L11) |
| `DefaultsKey.shelfShakeToOpen` | `shake` | `true` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L12) |
| `DefaultsKey.shelfDropZoneEnabled` | `dropZone` | `true` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L13) |
| `DefaultsKey.shelfDockPlacement` | `dockPlacement` | `ShelfDockPlacement.menuBar.rawValue` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L14) |
| `DefaultsKey.notchEnabled` | `islandEnabled` | `false` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L15) |
| `DefaultsKey.shelfEdgeDragEnabled` | `edgeDrag` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L16) |
| `DefaultsKey.shelfCloseAfterDrop` | `closeAfterDrop` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L17) |
| `DefaultsKey.shelfRemoveAfterDrop` | `removeAfterDrop` | `true` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L18) |
| `DefaultsKey.shelfClearOnClose` | `clearOnClose` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L19) |
| `DefaultsKey.notchShelf` | `opensInIsland` | `true` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShelfSettings.swift#L20) |

## ShortcutsSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.keyboardBrightnessShortcutsEnabled` | `keyboardBrightnessShortcutsEnabled` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/ShortcutsSettings.swift#L14) |

## SuperKeySettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.superKeyEnabled` | `enabled` | `false` | [L10](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SuperKeySettings.swift#L10) |
| `DefaultsKey.superKeySource` | `sourceRaw` | `SuperKeySource.capsLock.rawValue` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SuperKeySettings.swift#L11) |
| `DefaultsKey.superKeyModifiers` | `modifierStorage` | `SuperKeySupport.defaultModifierStorageValue` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SuperKeySettings.swift#L12) |
| `DefaultsKey.superKeySoloAction` | `soloActionRaw` | `SuperKeySoloAction.none.rawValue` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SuperKeySettings.swift#L14) |

## SwitcherSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.switcherEnabled` | `switcherEnabled` | `true` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L13) |
| `DefaultsKey.switcherShortcut` | `switcherShortcutStorage` | `GlobalShortcut.switcherDefault.storageValue` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L14) |
| `DefaultsKey.switcherTakeOverSystemShortcuts` | `switcherTakeOverSystemShortcuts` | `false` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L15) |
| `DefaultsKey.switcherIconRowMode` | `switcherIconRowMode` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L16) |
| `DefaultsKey.switcherSimpleMode` | `switcherSimpleMode` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L17) |
| `DefaultsKey.switcherMergeTabs` | `switcherMergeTabs` | `false` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L18) |
| `DefaultsKey.switcherWindowlessApps` | `switcherWindowlessApps` | `SwitcherWindowlessApps.fallback.rawValue` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L19) |
| `DefaultsKey.switcherMinimizedPlacement` | `switcherMinimizedPlacement` | `WindowSwitchMinimizedPlacement.normal.rawValue` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L20) |
| `DefaultsKey.switcherTreatHiddenAppsLikeMinimized` | `switcherTreatHiddenAppsLikeMinimized` | `true` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L21) |
| `DefaultsKey.switcherShowFullscreenWindows` | `switcherShowFullscreenWindows` | `true` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L22) |
| `DefaultsKey.switcherScreenPlacement` | `switcherScreenPlacement` | `SwitcherScreenPlacement.fallback.rawValue` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L23) |
| `DefaultsKey.switcherCurrentDisplayOnly` | `switcherCurrentDisplayOnly` | `false` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L24) |
| `DefaultsKey.switcherCurrentSpaceOnly` | `switcherCurrentSpaceOnly` | `false` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L25) |
| `DefaultsKey.switcherSearchPinEnabled` | `switcherSearchPinEnabled` | `false` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L26) |
| `DefaultsKey.switcherShowShortcutHints` | `switcherShowShortcutHints` | `true` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L27) |
| `DefaultsKey.switcherAppearanceDelay` | `switcherAppearanceDelay` | `SwitcherSupport.defaultAppearanceDelayMilliseconds` | [L28](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L28) |
| `DefaultsKey.switcherInstantSelection` | `switcherInstantSelection` | `false` | [L29](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L29) |
| `DefaultsKey.switcherMaxColumns` | `switcherMaxColumns` | `0` | [L30](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L30) |
| `DefaultsKey.minimalWindowPreviews` | `minimalPreviews` | `false` | [L378](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SwitcherSettings.swift#L378) |

## TextSnippetsSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.textSnippetsEnabled` | `enabled` | `false` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/TextSnippetsSettings.swift#L15) |
| `DefaultsKey.snippetLibraryEnabled` | `libraryEnabled` | `false` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/TextSnippetsSettings.swift#L16) |
| `DefaultsKey.snippetSoundEnabled` | `soundEnabled` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/TextSnippetsSettings.swift#L17) |
| `DefaultsKey.snippetSoundName` | `soundName` | `Defaults.defaultSnippetSoundName` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/TextSnippetsSettings.swift#L18) |

## URLCleanerSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.urlCleanerEnabled` | `enabled` | `false` | [L10](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/URLCleanerSettings.swift#L10) |
| `DefaultsKey.urlCleanerCustomParameters` | `globalNames` | `""` | [L11](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/URLCleanerSettings.swift#L11) |
| `DefaultsKey.urlCleanerSiteParameters` | `siteNames` | `""` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/URLCleanerSettings.swift#L12) |
| `DefaultsKey.urlCleanerDisabledParameters` | `disabledNames` | `""` | [L13](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/URLCleanerSettings.swift#L13) |

## WhatsAppDownloadsSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.whatsAppDownloadsEnabled` | `enabled` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L14) |
| `DefaultsKey.whatsAppDownloadsAutomaticEnabled` | `automatic` | `false` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L15) |
| `DefaultsKey.whatsAppDownloadsCategories` | `categoriesRaw` | `"image,video,audio"` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L16) |
| `DefaultsKey.whatsAppDownloadsRetentionDays` | `retentionDays` | `7` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L17) |
| `DefaultsKey.whatsAppDownloadsNotify` | `notify` | `true` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L18) |
| `DefaultsKey.whatsAppDownloadsLastCleanup` | `lastCleanup` | `0.0` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L19) |
| `DefaultsKey.whatsAppDownloadsLastCleanupCount` | `lastCount` | `0` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L20) |
| `DefaultsKey.whatsAppDownloadsLastCleanupBytes` | `lastBytes` | `0` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L21) |
| `DefaultsKey.whatsAppDownloadsLastCleanupFailed` | `lastFailed` | `0` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L22) |
| `DefaultsKey.whatsAppOrganizerEnabled` | `organizerEnabled` | `false` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L23) |
| `DefaultsKey.whatsAppOrganizerDestinationPath` | `organizerDestination` | `""` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L24) |
| `DefaultsKey.whatsAppOrganizerDelayMinutes` | `organizerDelay` | `5` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L25) |
| `DefaultsKey.whatsAppOrganizerCategories` | `organizerCategoriesRaw` | `"image,video,audio,document,archive,other"` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L26) |
| `DefaultsKey.whatsAppOrganizerLayout` | `organizerLayout` | `"flat"` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L27) |
| `DefaultsKey.whatsAppOrganizerDuplicateAction` | `duplicateAction` | `"trashNew"` | [L28](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L28) |
| `DefaultsKey.whatsAppOrganizerLastRun` | `organizerLastRun` | `0.0` | [L29](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L29) |
| `DefaultsKey.whatsAppOrganizerLastMoved` | `organizerLastMoved` | `0` | [L30](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L30) |
| `DefaultsKey.whatsAppOrganizerLastDuplicates` | `organizerLastDuplicates` | `0` | [L31](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L31) |
| `DefaultsKey.whatsAppOrganizerLastFailed` | `organizerLastFailed` | `0` | [L32](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WhatsAppDownloadsSettings.swift#L32) |

## WindowLayoutSettings.swift

| Key | ตัวแปร UI | Default expression | หลักฐาน |
|---|---|---|---|
| `DefaultsKey.windowMaximizeEnabled` | `maximizeEnabled` | `false` | [L12](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L12) |
| `DefaultsKey.pointerDisplayEnabled` | `pointerDisplayEnabled` | `false` | [L14](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L14) |
| `DefaultsKey.panelUtilityWindowLayout` | `showInPanel` | `true` | [L15](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L15) |
| `DefaultsKey.windowLayoutShortcutsEnabled` | `shortcutsEnabled` | `true` | [L16](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L16) |
| `DefaultsKey.windowDirectionalEnabled` | `directionalEnabled` | `false` | [L17](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L17) |
| `DefaultsKey.windowDirectionalShortcut` | `directionalShortcutRaw` | `GlobalShortcut.windowDirectionalDefault.storageValue` | [L18](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L18) |
| `DefaultsKey.windowEdgeSnapEnabled` | `edgeSnapEnabled` | `false` | [L19](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L19) |
| `DefaultsKey.windowEdgeSnapDisabledZones` | `edgeSnapDisabledZones` | `""` | [L20](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L20) |
| `DefaultsKey.windowEdgeSnapZoneActions` | `edgeSnapZoneActions` | `""` | [L21](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L21) |
| `DefaultsKey.windowGestureEnabled` | `gestureEnabled` | `false` | [L22](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L22) |
| `DefaultsKey.windowGestureModifiers` | `gestureModifiers` | `WindowGestureSupport.defaultModifierStorageValue` | [L23](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L23) |
| `DefaultsKey.windowGestureRaiseWindow` | `gestureRaiseWindow` | `false` | [L24](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L24) |
| `DefaultsKey.windowLayoutWindowGap` | `windowGap` | `0` | [L25](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L25) |
| `DefaultsKey.windowLayoutScreenGap` | `screenGap` | `0` | [L26](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L26) |
| `DefaultsKey.windowLayoutMarginPercent` | `marginPercent` | `WindowLayoutMargin.defaultPercent` | [L27](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L27) |
| `DefaultsKey.windowLayoutSideRepeatCyclesThirds` | `sideRepeatCyclesThirds` | `false` | [L28](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L28) |
| `DefaultsKey.dockClickCycleWindows` | `dockClickCycleWindows` | `false` | [L34](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/WindowLayoutSettings.swift#L34) |
