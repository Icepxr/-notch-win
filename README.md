# Islet

นอตช์แบบ macOS สำหรับ Windows — ลากไฟล์ไปพักไว้ที่ขอบจอด้านบน แล้วส่งไป iPad/iPhone/Android
ผ่านโปรโตคอล [LocalSend](https://github.com/localsend/protocol) ได้ในคลิกเดียว

ไม่ต้องเปิดแอป LocalSend บน Windows — ตัวนอตช์คุยโปรโตคอลเองตรงๆ
(ฝั่งปลายทางยังต้องเปิดแอป LocalSend ไว้เพื่อรับ)

## ใช้งาน

สร้าง shortcut ชื่อ **Islet** บน Desktop เพื่อดับเบิลคลิกเปิดแอปได้:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-shortcuts.ps1
```

หากต้องการให้เปิดอัตโนมัติหลังลงชื่อเข้า Windows ให้เพิ่ม `-Startup`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-shortcuts.ps1 -Startup
```

รันจากโฟลเดอร์โปรเจกต์หลัง `npm install` สคริปต์สร้าง shortcut ของผู้ใช้ปัจจุบัน
โดยชี้เข้า Electron พร้อม path โปรเจกต์แบบเต็ม จึงเปิดจาก Desktop/Startup ได้โดยตรง
การใช้ `ExecutionPolicy Bypass` มีผลเฉพาะคำสั่งนี้ ไม่ได้เปลี่ยน policy ถาวร
ถ้าต้องการปิดการเปิดอัตโนมัติ กด **Win+R** พิมพ์ `shell:startup` แล้วลบ `Islet`
ในโฟลเดอร์นั้น หากย้ายโฟลเดอร์โปรเจกต์ ให้ลบ shortcut เดิมแล้วสร้างใหม่ให้ชี้ที่อยู่ใหม่

The current UI is ported from the Vorssaint source structure for the features
already implemented in Islet. Settings now has a sidebar, search and **Dynamic
Island → Layout / Content / Activity / Behavior**. Content can reorder or hide
existing modules; at least one stays visible. Right-click the notch (or press
**Shift+F10**) for Pin, Settings, Collapse and Quit. **Ctrl+Comma** opens Settings.
The player uses the source's compact reading column and the gallery shows two
complete rows. See [the source mapping](docs/vorssaint-source-port.md).

Clipboard now supports **Pin**, a **Pinned** filter and **Clear recent** that
keeps pins. Hover a row for a lifted preview, or use its Preview button/**F2**;
Escape closes the preview first. Notes adds **Ctrl+F** local find, next/previous
matches, Copy all and a saved 10–22px text size. Scrolling lists fade only the
edge with more content beyond it.

AI Agents now uses independent provider cards, a fixed toolbar and compact
reading order. **Customize cards** can rearrange/hide cards, switch quota
between Used/Remaining, and choose elapsed time or quota on the resting notch.
Charts support pointer and keyboard date inspection; updates retain focus and
scroll. Missing or expired quota stays unknown, with elapsed time as the compact
fallback. See [the AI source mapping](docs/vorssaint-source-port.md#ai-agents-redesign--2026-10-23).

The notch now uses a closer Vorssaint-inspired layout, with content-sized pages,
76px music artwork, a fuller player and a two-row module gallery with shortcut labels.

- Swipe horizontally on the header to switch modules, or use **Alt+Left/Right**.
- Music fills the panel with larger artwork, 16/14px title/artist text and a
  wider timeline. Play/Pause changes its icon immediately while Windows confirms
  playback; stale polls and older command replies cannot undo the latest click.
- Use the small previous/next controls in the top row; click the page counter to
  choose a module. **Alt+1–7** opens a module; **Alt+8** opens Settings.
- Drag files onto the shelf to park them, or onto a device to send. **Add files**
  and **Ctrl+O** open the native file picker.
- Track changes, completed timers, transfers and AI turns can appear as brief
  activities in the notch. Click an activity to open its module; dismiss it with
  the cross. Hover or keyboard focus pauses expiry. An open page stays open.
- Timer has a centered ruler: drag, scroll, or use Arrow/Home/End keys to choose
  1–180 minutes. Timer and Focus remember separate durations. Focus adds saved
  short/long breaks, long-break interval and session count, with explicit next
  phases and real cycle progress. The active clock keeps running in the main
  process when the notch closes or its renderer reloads.
- **Settings → Dynamic Island → Layout** adjusts resting width (160–280px), expanded
  width (480–640px), and overall size (85–125%). The preview responds as you drag.
  **Reset size** restores the default dimensions. The notch stays opaque black
  in every module and state; older color and glass preferences migrate to black.
  **Settings → Music → Artwork color on music meters** lets the timeline and
  equalizer follow the cover. Text and the notch background keep neutral colors.
- Changing Windows volume, mute, supported display brightness or Caps Lock shows
  brief system feedback. Repeated presses update the same readout. Disable it
  under **Dynamic Island → Activity → System feedback**.
  Brightness uses Windows WMI reporting; DDC/CI-only external monitor controls
  are not observed.

Design decisions and skill references are recorded in
[the Islet design system](design-system/islet/MASTER.md).

When adopting the Islet name, a new, unused Islet profile reuses the original
`localsend-island` data directory. Existing notes, shelf entries, preferences and
LocalSend identity remain in place. A new profile that already contains notes or
a shelf keeps its own data; neither profile is deleted or overwritten.

```bash
npm install
npm start
```

หน้าตาของแอปเป็นภาษาอังกฤษทั้งหมด ธีมมืดชุดเดียว พร้อมการ์ด Explore, Settings,
เพลง และ AI

| ท่า | ผล |
|---|---|
| เอาเมาส์ไปจ่อขอบจอบนกลาง | นอตช์กางเป็น peek — นาฬิกา, จำนวนไฟล์ในชั้นวาง (หรือเพลงที่เล่นอยู่) |
| คลิกที่นอตช์ | กางเต็ม เห็นชั้นวางไฟล์ + อุปกรณ์ที่เจอ |
| คลิกออกไปหน้าต่างอื่น | ย่ออัตโนมัติ; ถ้ากำลังส่งจะรอให้ส่งเสร็จก่อน |
| ปุ่มหมุดบนหัวนอตช์ | Keep open — เปิดค้างไว้จนกว่าจะปลดหมุดหรือกดย่อ |
| เลื่อนลงบนนอตช์ / เลื่อนขึ้นบนหัวพาเนล | เปิด / ย่อ |
| ลากไฟล์เข้ามา | นอตช์กางเองทันที วางลงชั้นวางได้เลย |
| ลากโฟลเดอร์เข้ามา | พักทั้งโฟลเดอร์เป็นรายการเดียว ส่งแล้วปลายทางได้โครงสร้างเดิม |
| ปุ่ม **Paste text** | เอาข้อความที่ copy ไว้มาพักเป็นไฟล์ `.txt` แล้วส่งได้เลย |
| ลากไฟล์ทับชื่ออุปกรณ์ | พักไฟล์ + ส่งทันทีในท่าเดียว |
| คลิกชื่ออุปกรณ์ | ส่งทุกไฟล์ในชั้นวางไปเครื่องนั้น |
| ลากไฟล์ออกจากชั้นวาง | ได้ไฟล์จริงไปวางที่ Explorer หรือแอปอื่น |
| ดับเบิลคลิกไฟล์ในชั้นวาง | เปิดโฟลเดอร์ที่ไฟล์นั้นอยู่ |
| คลิกปุ่มตารางมุมซ้ายบน | Explore — ค้นหาแล้วเปิดส่งไฟล์ / เพลง / คลิปบอร์ด / ระบบ / AI / จับเวลา / บันทึกย่อ |
| ไทล์ Settings ใน Explore (หรือเมนู tray) | เปิดหน้าต่างตั้งค่าแยกต่างหาก |
| `Ctrl+Alt+D` | กาง/ย่อนอตช์ |
| `Esc` | ย่อ |

ออกจากโปรแกรมได้จากไอคอนใน system tray (คลิกขวา)

## หลายจอ

เลือกจอที่จะให้นอตช์ไปเกาะได้จาก **Explore → Settings → Display behavior**
หรือเมนู **Display** ใน tray

| โหมด | ผล |
|---|---|
| Choose a display | ปักหมุดกับจอที่เลือกไว้ในช่อง **Show on** |
| Follow primary | อยู่บนจอหลักของ Windows |
| Follow cursor | ย้ายตามเมาส์หลังหยุดนิ่งครู่หนึ่ง — เฉพาะตอนย่ออยู่ พาเนลที่กางอยู่และการส่งที่ค้างอยู่ไม่ขยับ |

ถอดจอที่เลือกไว้ออก นอตช์จะย้ายไปจอหลักชั่วคราวโดยยังจำตัวเลือกเดิมไว้
เสียบกลับก็กลับไปจอเดิม รองรับจอที่อยู่ซ้าย/เหนือจอหลัก และ scaling ที่ไม่เท่ากันในแต่ละจอ
จอเล็กจะย่อหน้าตาให้พอดีกับความสูงที่มี

## หน้าตาและการทดสอบ UI

นอตช์มีสามระดับ: ย่อ 184px, peek เมื่อเอาเมาส์จ่อ และพาเนลเต็ม 520px
พื้นดำต่อกับขอบจอด้วยไหล่โค้ง แยกไอคอนไฟล์ตามประเภท และแสดงอุปกรณ์ใกล้เคียงเป็นการ์ด
ตอนลากไฟล์จะไฮไลต์พื้นที่รับไฟล์; ส่งสำเร็จจะแสดงข้อความยืนยันสีเขียว
กดลูกศรเพื่อเลือกโมดูลใน Explore แล้วกด Enter เพื่อเปิด
รองรับการตั้งค่าลดแอนิเมชันของ Windows

พอร์ตตรรกะสปริง, gesture และ timer จากซอร์ส Vorssaint เป็น JavaScript สำหรับ Windows
ดู [ส่วนที่พอร์ตแล้วและ API ที่ใช้](docs/windows-port.md) และ [เครดิต/สัญญาอนุญาต](THIRD_PARTY_NOTICES.md)

หน้าตั้งค่าเป็น**หน้าต่างแยก** ไม่ใช่แท็บในนอตช์ เลือกรูปทรง Notch/Capsule ระดับกระจก
จอที่แสดง การย่อเมื่อคลิกออก และ gesture ได้ บน Windows 11 22H2 ขึ้นไปหน้าต่างนี้ใช้
backdrop material แบบ acrylic ของระบบจริง (นอตช์ใช้ไม่ได้เพราะต้องเป็นหน้าต่างโปร่งใส)
ตัวจับเวลารองรับนับถอยหลัง โฟกัสแบบ Pomodoro และ stopwatch; บันทึกย่อเก็บเป็นไฟล์
`scratchpad.txt` ในโฟลเดอร์ข้อมูลของแอป โดยบันทึกข้อความล่าสุดก่อนออกจากโปรแกรมด้วย

```bash
npm test
npm run test:ui
```

ชุด UI ใช้ Electron แบบ offscreen กับข้อมูลจำลอง ไม่ส่งไฟล์จริงหรืออ่านคลิปบอร์ด
และบันทึกภาพตัวอย่างลง `docs/previews/`

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/main.js` | lifecycle, หน้าต่าง, tray, IPC |
| `src/displays.js` | Monitor selection, docking, cursor following, mixed-DPI placement and fitted zoom |
| `src/discovery.js` | ค้นหาอุปกรณ์ผ่าน UDP multicast `224.0.0.167:53317` + endpoint `register` |
| `src/sender.js` | `prepare-upload` + `upload` ตามสเปก v2 |
| `src/identity.js` | ใบรับรอง self-signed ของเรา (จำเป็น — ดูหัวข้อ mTLS) |
| `src/shelf.js` | ชั้นวางไฟล์ (เก็บลงดิสก์ อยู่ข้ามการรีสตาร์ต) |
| `src/png.js` | สร้างไอคอน tray ตอนรันไทม์ (เลยไม่มีไฟล์ binary ในโปรเจกต์) |
| `src/media.js` | ดูแล bridge ของ Now Playing (spawn, restart, ส่งคำสั่ง) |
| `src/media/nowplaying.ps1` | ตัว bridge เอง — คุย WinRT SMTC ผ่าน PowerShell |
| `src/renderer/media-state.js` | แปลง JSON จาก bridge เป็น state ของ UI (ใช้ทั้งสองฝั่ง) |
| `src/ai-dashboard.js` / `src/ai-worker.js` / `src/ai-usage.js` | สถิติ AI จาก log, aggregate และ lifecycle |
| `src/ai-codex.js` | อ่านโควตา Codex ผ่าน app-server |
| `src/renderer/panel-ai.js` | การ์ด AI, filters, trend และกิจกรรม |
| `src/aimon.js` | เฝ้า `~/.claude/sessions` หาเซสชัน AI ที่รันอยู่ (watch + poll สำรอง) |
| `src/renderer/ai-state.js` | แปลงไฟล์เซสชันเป็นแถวในพาเนล + คำนวณสถานะ/ระยะเวลา (ใช้ทั้งสองฝั่ง) |
| `src/clipboard.js` | ประวัติคลิปบอร์ด (poll + กันซ้ำ + เก็บลงดิสก์) |
| `src/sysmon.js` | CPU / RAM / ดิสก์ / uptime — Node ล้วน ไม่ spawn อะไร |
| `src/renderer/panel-clipboard.js` | วาดพาเนลคลิปบอร์ด |
| `src/renderer/panel-system.js` | วาดพาเนลระบบ + sparkline |
| `src/renderer/panels.css` | สไตล์เฉพาะของสองพาเนลนั้น |
| `src/renderer/` | ตัวนอตช์: state machine + สไตล์ |
| `src/renderer/notch-motion.js` | สปริงและ gesture ที่พอร์ตจาก Vorssaint |
| `src/timer.js` | Timer / Pomodoro / stopwatch ใน main process |
| `src/notes.js` | บันทึกย่อแบบ atomic และ flush ก่อน quit |
| `src/renderer/panel-utilities.js` | หน้าจับเวลาและบันทึกย่อ |
| `src/renderer/settings.html` / `.css` / `.js` | หน้าต่างตั้งค่าแยก (acrylic บน Win11) |
| `src/panel-preload.js` | bridge ของหน้าต่างตั้งค่า — อ่าน/เขียน preference เท่านั้น |
| `docs/design-tokens.md` | ดีไซน์ปัจจุบัน + motion ที่พอร์ตจากซอร์ส |

## Now Playing

ถ้ามีเพลงเล่นอยู่ นอตช์จะโชว์ให้เองโดยไม่ต้องตั้งอะไร

| ท่า | ผล |
|---|---|
| เอาเมาส์ไปจ่อ (peek) | ปกอัลบั้มเล็ก + ชื่อเพลงวิ่ง แทนที่นาฬิกากับจำนวนไฟล์ |
| เริ่มเพลงใหม่ขณะย่อ | แสดงชื่อเพลงประมาณ 2.4 วินาทีแล้วกลับไปย่อ โดยไม่แย่งโฟกัส |
| คลิกปกเพลงขณะย่อ | เปิดแท็บเพลงโดยตรง |
| ปุ่มเล่น/หยุดใน peek | ควบคุมเพลงได้โดยไม่ต้องเปิดพาเนลเต็ม |
| ลากแถบเวลาเพลง | เลื่อนตำแหน่งจริงผ่าน Windows SMTC ถ้าแอปต้นทางรองรับ |
| เลือกแอปใต้ชื่อเพลง | เลือก player ของ Windows SMTC หรือให้เลือกแอปที่กำลังเล่นอัตโนมัติ |
| เลื่อนแนวนอนบนปกเพลงหรือโหมดเล็ก | เพลงก่อนหน้า / ถัดไป |
| คลิกกางเต็ม | ปกใหญ่ + ชื่อเพลง/ศิลปิน/แอป + ปุ่มก่อนหน้า-เล่น/หยุด-ถัดไป + แถบความคืบหน้า |
| ไม่มีเพลงเล่น | กลับไปเป็นนาฬิกา + จำนวนไฟล์เหมือนเดิม การ์ดหดกลับเท่าเดิม |

ข้อมูลมาจาก **System Media Transport Controls** ของ Windows ตัวเดียวกับที่โผล่ตอนกด
ปุ่ม volume บนคีย์บอร์ด — ดึงผ่าน WinRT
`Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager`

วิธีต่อคือ **แยกเป็นอีก process** (`src/media/nowplaying.ps1`) แล้วคุยกันทาง stdout/stdin:

- `powershell.exe` (Windows PowerShell 5.1) เป็นตัวเดียวบนเครื่องเปล่าๆ ที่ project
  WinRT ได้ — `pwsh` 7 ตัดความสามารถนี้ไปแล้ว ส่วน native binding (NodeRT ฯลฯ)
  ต้อง rebuild ตาม ABI ของ Electron ทุกครั้งที่อัปเวอร์ชัน เลยไม่เอา
- bridge ยิง JSON บรรทัดละก้อนออก stdout ทุก 900 ms และรับคำสั่ง
  (`toggle` / `next` / `prev` / `seek`) ทาง stdin — ไม่ต้อง spawn ใหม่ต่อการกดปุ่มหนึ่งครั้ง
  กดแล้วตอบกลับภายใน ~150 ms
- spawn ด้วย `windowsHide` + `-WindowStyle Hidden` เลย**ไม่มีหน้าต่างคอนโซลเด้ง**
- ปุ่มควบคุมเรียก `TryTogglePlayPauseAsync` / `TrySkipNextAsync` /
  `TrySkipPreviousAsync` ของ session ตรงๆ ถ้าแอปไหนลงทะเบียนไว้แต่ไม่ยอมรับคำสั่ง
  จะถอยไปกด media key (`VK_MEDIA_PLAY_PAUSE` ฯลฯ) ให้แทน
- ปกอัลบั้มส่งเป็น data URI และส่งเฉพาะตอนเปลี่ยนเพลง (ไม่ใช่ทุก poll)
- ถ้า bridge ตายหรือเงียบเกิน 12 วินาที `src/media.js` จะ spawn ใหม่ให้ ถ้าตายรัวๆ
  3 ครั้งติดจะเลิกแล้วปล่อยให้นอตช์ทำงานต่อโดยไม่มี Now Playing

ข้อจำกัดที่ยังเหลือ:

- **แอปที่ไม่ลงทะเบียน SMTC จะไม่โชว์** (เช่น เกม, เครื่องเล่นเก่าๆ บางตัว)
  ส่วน Spotify, YouTube/เพลงในเบราว์เซอร์ (Edge, Chrome, Firefox), Media Player โชว์ปกติ
- **ตำแหน่งเพลงขึ้นกับว่าแอปต้นทางบอกมาแค่ไหน** บางแอป (รวมถึงสตรีมสด) ไม่บอกความยาว
  กรณีนั้นแถบความคืบหน้าจะซ่อนไป
- **อัปเดตทุก 900 ms** ไม่ได้ subscribe event ของ WinRT เลยมีดีเลย์ได้ไม่เกินราวหนึ่งวินาที
- **หยุดเพลงค้างไว้เกิน 5 นาที** นอตช์จะเลิกโชว์แถวนั้นแล้วกลับไปเป็นนาฬิกา
  (ไม่งั้นแท็บเบราว์เซอร์ที่หยุดไว้เมื่อวานจะยึดนอตช์ไว้ตลอด)

## คลิปบอร์ด

เก็บทุกอย่างที่คัดลอก แล้วคลิกเพื่อเอากลับมาใช้ จัดชนิดให้อัตโนมัติ
(ลิงก์ / พาธ / อีเมล / JSON / โค้ด / แฮช / ข้อความ) เพื่อให้กวาดตาหาเจอเร็ว

มีช่องค้นหาจากข้อความตัวอย่างและประเภท กด `Ctrl+F` เพื่อโฟกัสช่องค้นหา
กด `Esc` ครั้งแรกเพื่อล้างคำค้น และมีข้อความยืนยันหลังคัดลอกกลับสำเร็จ

เรื่องความเป็นส่วนตัว — คลิปบอร์ดเป็นของที่อ่อนไหวที่สุดที่นอตช์แตะ เลยทำไว้แบบนี้:

- ข้อมูลอยู่ใน `%APPDATA%\Islet\clipboard.json` เท่านั้น ไม่ออกนอกเครื่อง
- **renderer ได้แค่ตัวอย่างข้อความ** ไม่ได้ข้อความเต็ม ตัวเต็มอยู่ใน main process
  และถูกส่งกลับเฉพาะตอนกดเลือกรายการ
- ข้อความยาวเกิน 20,000 ตัวอักษรเก็บในหน่วยความจำอย่างเดียว ไม่เขียนลงดิสก์
- รูปภาพเก็บเป็นภาพย่อในหน่วยความจำ ไม่เขียนลงดิสก์ และคัดลอกกลับไม่ได้
  (ถ้าเขียนกลับจะได้ภาพย่อแทนของจริง เลยเลือกปฏิเสธแทนที่จะลดคุณภาพเงียบๆ)
- เคารพรูปแบบ `ExcludeClipboardContentFromMonitorProcessing` และ
  `Clipboard Viewer Ignore` — ตัวจัดการรหัสผ่านติดธงนี้ตอนคัดลอกความลับ
  ของที่ติดธงจะไม่ถูกบันทึกเลย
- ปุ่ม **หยุดบันทึก** หยุดเก็บชั่วคราวโดยไม่ลบของเดิม ใช้ตอนกำลังจะ**คัดลอก**
  ของที่ไม่อยากให้เก็บ (การพิมพ์ไม่ผ่านคลิปบอร์ด จึงไม่ใช่ความเสี่ยง)

## ระบบ

CPU, หน่วยความจำ, พื้นที่ดิสก์ และเวลาที่เปิดเครื่องมา พร้อม sparkline ย้อนหลัง 40 จุด
สีของแถบเปลี่ยนตามความหนัก — เกิน 70% เป็นส้ม เกิน 90% เป็นแดง

อ่านจาก `os.cpus()`, `os.totalmem()/freemem()` และ `fs.statfsSync()` ล้วนๆ
ไม่มีการ spawn process ไม่มี native module เลยถูกและพังยากกว่าทางที่ต้องพึ่ง bridge

## AI Monitor

เปิด Explore → AI เพื่อติดตาม Codex และ Claude Code ในการ์ดแบบ Vorssaint:

- โควตา Codex คงเหลือ พร้อมเวลารีเซ็ตแต่ละช่วงและจำนวนสิทธิ์รีเซ็ตที่มี
- token, cache, เซสชันล่าสุด, กราฟรายวัน, โมเดล, โปรเจกต์ และกิจกรรม 28 วัน
- เลือกผู้ให้บริการ/วันนี้/7 วัน/30 วัน และเลือกซ่อนการ์ดจากปุ่ม ⋯
- แจ้งเตือนเมื่อสังเกตว่างานที่ใช้เวลาอย่างน้อย 60 วินาทีเสร็จ และเมื่อโควตาบัญชีข้าม 80%
- จุดบน notch และรายการย่อบอกกำลังทำงาน/รอคุณ โดยไม่ต้องเปิดหน้าขยาย

อ่านประวัติ 31 วันล่าสุดจาก CODEX_HOME/sessions, archived_sessions และ
~/.claude/projects ใน worker แยกจาก UI แบบ incremental เก็บเฉพาะตัวนับ
โมเดล ชื่อโฟลเดอร์ และเหตุการณ์เริ่ม/จบ ไม่ส่งข้อความสนทนาไป renderer หรือเขียน
สำเนา transcript ลงดิสก์ ไฟล์ประวัติต้นทางถูกอ่านอย่างเดียว

สถานะ Claude จาก ~/.claude/sessions ตรวจ PID ก่อนแสดง ส่วนสถานะจาก log
แสดงป้าย log เพื่อบอกว่าเป็นกิจกรรมที่อนุมาน ไม่ยืนยันว่า process ยังเปิดอยู่
รายการที่ไม่มีกิจกรรมเกิน 10 นาทีจะหยุดเรียกร้องความสนใจ

โควตา Codex อ่านผ่าน local codex app-server ด้วยบัญชีที่ลงชื่อเข้าใช้อยู่แล้ว
ตาม [เอกสาร account API](https://learn.chatgpt.com/docs/app-server)
ทุก 5 นาทีหรือเมื่อกดรีเฟรช ไม่คัดลอก credential ไม่เริ่ม inference และไม่ใช้สิทธิ์รีเซ็ต
ถ้า API ใช้ไม่ได้จะใช้ข้อมูลจาก log พร้อมป้ายว่าอาจไม่ล่าสุด ข้อมูลที่ผ่านเวลารีเซ็ต
จะแสดง — จนกว่าจะได้ข้อมูลใหม่ ไม่เดาว่าโควตากลับมาเต็ม

โควตา Claude อ่านผ่าน Claude Code CLI ด้วย control requests `initialize` และ
`get_usage` ตามต้นแบบ Vorssaint ไม่ส่ง user message ไม่เรียกโมเดล และปิด user
hooks/tools/MCP ในคำขอตรวจบัญชี ตรวจโควตา 5 ชั่วโมง/7 วันและแยก Opus/Sonnet
เมื่อบัญชีรายงานมา ตรวจอายุ cache และการเปลี่ยนบัญชีก่อนแสดง มี backoff เมื่อ CLI
หาย/เก่า/ยังไม่ลงชื่อเข้าใช้ ถ้าต้องเชื่อมบัญชี กด **AI → Claude → Connect Claude**
เพื่อเปิดขั้นตอน login ของ CLI ใน Terminal แล้วกด **Refresh** ใน notch
Claude จัดการการลงชื่อเข้าใช้เอง รวมทั้งการยืนยันบนเบราว์เซอร์ของผู้ใช้

ข้อแตกต่างที่ควรรู้: ตัวนับและสถานะเซสชันอ่านจากไฟล์ log ในเครื่องล้วนๆ แต่**โควตา
ไม่ใช่** — การอ่านโควตาคือการสั่ง CLI ที่ติดตั้งไว้ให้ถาม provider ผ่านเน็ตเวิร์ก
ด้วย credential ของ CLI เอง ไม่มีข้อมูลของ Islet ถูกส่งออกไป แต่ก็เป็นการต่อเน็ต
ในนามผู้ใช้ ปิดได้ที่ **Settings → Behaviour → Read AI plan limits** แล้วแผง AI
จะเหลือเฉพาะตัวเลขที่นับได้จากเครื่องนี้

ยังไม่รองรับ OpenCode/Copilot, สลับบัญชี หรือประมาณค่าใช้จ่ายจากราคาโมเดล
Token ใน log เป็นกิจกรรมบนเครื่องนี้ ไม่ใช่ยอดเงินในแพ็กเกจ

## ความลื่นของ notch บน Windows

หน้าต่างโปร่งใสมี backing surface ขนาดคงที่สำหรับทุกสถานะและพื้นที่ spring overshoot
เพื่อไม่ให้ Windows ต้องสร้าง surface ใหม่ตอนเริ่ม/จบการย่อ เนื้อหาแต่ละ layer
จัดหน้าที่ขนาดจริงเพียงครั้งเดียว และใช้ shell เปิดเผย/ตัดเนื้อหาระหว่างแอนิเมชัน
ภาพปกขนาดใหญ่จางออกภายใน 65 ms ตอนหุบ ก่อนแสดงภาพปกเล็ก ไม่โหลดภาพซ้ำ
หรือวัด marquee ทุก 250 ms ระหว่างเล่นเพลง พื้นที่โปร่งใสใช้ painted hit region
เพื่อให้คลิกผ่านไปหน้าต่างด้านล่างได้

## พอร์ตที่ใช้

- **UDP 53317** — ฟัง announcement ของอุปกรณ์อื่น เปิดด้วย `reuseAddr` เลยรันคู่กับแอป
  LocalSend ตัวจริงได้ ถ้าจับพอร์ตไม่ได้จะถอยไปใช้พอร์ตสุ่มแล้วค้นหาแบบ active แทน
- **TCP 53318** — endpoint `register` ของเราเอง (เลี่ยง 53317 ไม่ให้ชนกับแอป LocalSend)

ครั้งแรกที่รัน Windows Firewall จะถาม — ต้องกด **Allow** และติ๊ก **Private networks**
ไม่งั้นอุปกรณ์อื่นจะมองไม่เห็น

## mTLS: ฝั่งรับขอใบรับรองจากฝั่งส่งด้วย

สเปกไม่ได้เขียนไว้ชัด แต่ของจริง LocalSend ฝั่งรับเปิด TLS แบบ **mutual** — ถ้าฝั่งส่ง
ไม่ยื่น client certificate มา handshake จะตายก่อนถึง HTTP ด้วย

```
tlsv13 alert certificate required  (SSL alert 116)
```

นี่คือเหตุผลที่สเปกบอกว่าในโหมด HTTPS ตัว `fingerprint` คือ SHA-256 ของใบรับรอง —
แต่ละเครื่องมีใบของตัวเอง `src/identity.js` เลยสร้างใบ self-signed (RSA 2048, อายุ 10 ปี,
`extKeyUsage` มี `clientAuth`) เก็บไว้ที่

```
%APPDATA%\Islet\identity.crt
%APPDATA%\Islet\identity.key
```

ใบนี้สร้างครั้งเดียวแล้วใช้ซ้ำ ถ้าลบไปจะสร้างใหม่ให้เอง (fingerprint เปลี่ยน
ปลายทางจะเห็นเป็นเครื่องใหม่) ส่วน cert ของปลายทางเราไม่ verify เพราะเป็น self-signed
ตามดีไซน์ ความปลอดภัยของ transfer มาจาก token ต่อไฟล์

## เทสต์

```bash
npm test                                  # 11 ชุด — ไม่แตะเน็ตเวิร์กจริง ไม่เปิดหน้าต่าง
npm run test:ui                           # 75 เช็คใน renderer จริง + วาดภาพลง docs/previews/
node test/live-send.js "ชื่ออุปกรณ์"        # ส่งจริงไปเครื่องจริง
node test/live-send.js "iPad" รูป.jpg      # ระบุไฟล์เองก็ได้
```

| ชุด | เทสต์อะไร |
|---|---|
| `test/send-roundtrip.js` | โปรโตคอล LocalSend กับ mock receiver รวมเคส mTLS |
| `test/media-state.js` | reducer ของ Now Playing |
| `test/aimon.js` | การอ่านไฟล์เซสชัน AI + คำนวณสถานะ |
| `test/clipboard.js` | ประวัติคลิปบอร์ด + การกันซ้ำ + สิ่งที่ห้ามเขียนลงดิสก์ |
| `test/sysmon.js` | คณิตของ CPU/RAM/ดิสก์ + sparkline |

`live-send.js` ใช้ใบรับรองใบเดียวกับตัวแอป เลยเทสต์เส้นทางจริงทั้งเส้น ตั้ง
`NOTCH_IDENTITY_DIR` ถ้าอยากใช้ใบอื่น

## ข้อจำกัดที่รู้อยู่

- **ส่งได้ทางเดียว** นอตช์เป็นฝั่งส่งเท่านั้น ถ้า iPad พยายามส่งมาจะได้ 403 กลับไป
  (รับไฟล์ให้ใช้แอป LocalSend ตัวจริง)
- **โฟลเดอร์ส่งได้สูงสุด 500 ไฟล์ ลึก 12 ชั้น** เกินกว่านั้นจะตัดและบอกใน log
  ส่วน symbolic link ข้ามไป (ลิงก์ออกนอกโฟลเดอร์ไม่ใช่ของที่ลาก ลิงก์วนกลับเข้ามาจะวน)
- **ชั้นวางเก็บ path ไม่ได้ก็อปไฟล์** ถ้าย้ายหรือลบไฟล์ต้นทาง รายการนั้นจะหายไปเอง
- **อุปกรณ์หายจากลิสต์ใน 25 วินาที** ถ้าไม่มี announcement ใหม่เข้ามา
- ตอนขึ้น "รอปลายทางกดรับ" รอได้นานสุด 3 นาที (`prepare-upload` ค้างรอคนกดรับ ไม่ใช่ค้าง)
- **ระบบยังไม่มีความเร็วเน็ต** Node อ่าน throughput ของการ์ดเน็ตไม่ได้ ถ้าจะเอา
  ต้องเพิ่ม PowerShell bridge อีกตัว (`Get-NetAdapterStatistics`) ซึ่งยังไม่คุ้ม
- **รูปในคลิปบอร์ดคัดลอกกลับไม่ได้** เก็บแค่ภาพย่อไว้ดู ไม่ได้เก็บของจริง
- TLS ของปลายทางเป็น self-signed ตามดีไซน์ของโปรโตคอล เลยปิด cert verification
  ไว้ — ความปลอดภัยของ transfer มาจาก token ต่อไฟล์ ไม่ใช่ chain ของใบรับรอง

## เปิดพร้อม Windows

คลิกขวาไอคอนใน tray → **เปิดพร้อม Windows**
