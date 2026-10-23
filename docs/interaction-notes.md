# Interaction details

## Current redesign

The [2026-10-23 source port](vorssaint-source-port.md) maps each existing module
to its Vorssaint source view. Settings is now a split view with sidebar/search,
four Dynamic Island tabs and live module order/visibility controls. Pin, Settings,
Collapse and Quit are in the island's native context menu (Shift+F10).

Appearance now exposes independent resting/expanded widths, overall scale and
surface/accent colors. Settings previews on input, batches saves and rolls back
failed writes. See the design system for bounds and native-host reservation.

Windows system feedback reads the default render endpoint with Core Audio,
subscribes to `WmiMonitorBrightnessEvent`, and reads only the Caps Lock toggle.
The hidden helper samples audio/lock state every 120ms; only changes cross IPC.
There is no startup toast or percentage synthesized for an unavailable device.
Brightness requires a display driver that exposes Windows WMI brightness; external
monitor hardware buttons and DDC/CI-only changes are not observed by this bridge.

Rapid changes replace one activity and restart its brief expiry, rather than
adding a queue entry per key press. A different system control replaces the prior
one. Critical timer/transfer activities retain priority; queued system feedback
expires after 2.2 seconds and cannot appear late. Volume/brightness/lock
feedback is a passive readout. The open page remains open, with a small inline
meter. Reduced motion removes meter animation.

The current [design system](../design-system/islet/MASTER.md) follows the source
gallery's two 86px rows/four columns. Music is a compact 520×230 player;
Files and Notes use 520×350. System uses 520×180 for overview and 520×290
for detail; Timer uses 520×260 setup and 520×230 active. The native host
remains stable through these changes. The widths remain customizable.

Horizontal trackpad gestures and deliberate pointer swipes on the header switch
modules; music gestures keep their track behavior. Previous/next controls, Alt+Arrow,
Alt+1–8, gallery navigation, Add files and Ctrl+O provide alternatives.

The activity queue coalesces duplicate events, caps waiting entries, gives timers
priority over music, pauses on hover/focus, and supports dismiss/open actions. It
shows app-owned music, transfer, timer and AI events. It does not read Windows-wide
notifications. Activities stay inline while a module is open and never focus the
window automatically. Escape discards queued previews.

File dragging reveals a shelf cue and a distinct device send target. Compact
transfers show their real progress, with a waiting pulse before acceptance.

The tests use synthetic data and never send the user's files. Offscreen Electron
does not generate native focus events for hidden windows, so focus-handler tests
dispatch the corresponding DOM event; pure queue tests verify pause/resume timing.

Current validation includes the full Node suite, 137 full-renderer checks,
the two-window Settings integration, long-title layout and targeted module
interaction checks. See the source-port document for scope and screenshots.
`node test/system-actions-live-read.js` additionally reads three live Windows
samples with stdin kept open, then closes the helper normally. Audio, WMI
brightness and Caps Lock are available on the development machine. The test
never changes those values. Streaming uses a dedicated StreamReader because
Windows PowerShell's synchronized Console.In can block ReadLineAsync.

The native Claude CLI reports signed out on this machine; quota rendering is
verified with synthetic account responses, and the real reader returns the
sign-in state. Actual authenticated quota requires the user's CLI sign-in.

## Earlier exploration

สำรวจ [Vorssaint live demo](https://vorssaint.com/) เมื่อ 2026-10-22
โดยกดใช้งาน Now Playing, Files, Clipboard, Explore และเมนู Dynamic Island
บันทึกนี้แยกพฤติกรรมที่เห็นในเดโมออกจากวิธีปรับใช้กับแอป Windows นี้

| สิ่งที่เห็น / แนวคิดจากต้นแบบ | สิ่งที่ใช้ใน Islet |
|---|---|
| คลิกพื้นที่เดสก์ท็อปแล้วพาเนลย่อ | รับ `BrowserWindow.blur` แล้วย่อ; การเปิดด้วยคลิกหรือ hotkey โฟกัสหน้าต่างให้จับการคลิกออกได้ |
| เมนู Keep open | ปุ่มหมุดแยกชัดเจน พร้อม `aria-pressed`; คลิกเปิดธรรมดาไม่ถือว่าปักหมุด |
| ปกเพลงยังอยู่ในโหมดเล็ก และกดแล้วเปิด Now Playing | ปก 17px กับแถบแอนิเมชันบอกสถานะเล่น; คลิกเปิดหน้าเพลงโดยตรง |
| ปุ่ม play/pause, previous, next และ timeline | คำสั่งจริงผ่าน Windows SMTC; เลื่อนเวลาได้เฉพาะ player ที่แจ้งว่ารองรับ |
| ไทม์ไลน์แสดงเวลาที่เล่นและเวลาที่เหลือ | แยกเวลาซ้าย/ขวา; ลาก slider เห็นตัวอย่างก่อนปล่อยเพื่อสั่ง seek |
| ชื่อเพลงยาวไม่แย่งพื้นที่ปกและปุ่ม | วัด overflow แล้วเลื่อนชื่อเท่าที่เกินจริง ด้วยความเร็วตามความยาว |
| หน้ารายการไฟล์มีไอคอนประเภทและปุ่มเอาออก | การ์ดประเภทไฟล์, drag out, double click เปิดโฟลเดอร์, Enter เปิดโฟลเดอร์, Delete เอาออก |
| Clipboard มีช่องค้นหา | ค้นหาข้อความตัวอย่าง/ประเภทบนเครื่อง, Ctrl+F และ Esc ล้างคำค้นก่อนย่อ |
| ปุ่มต่าง ๆ ตอบสนองชัดเจน | มีข้อความคัดลอกสำเร็จ, ส่งสำเร็จ และข้อผิดพลาดที่อยู่ในพาเนลที่กำลังใช้ |
| Gestures ใน Dynamic Island | เลื่อนลงเปิด, เลื่อนขึ้นบนส่วนหัว/แท็บ/ท้ายพาเนลเพื่อย่อ; เลื่อนแนวนอนบนปกเพื่อเปลี่ยนเพลง |

## รายละเอียดที่ออกแบบเพิ่มสำหรับการส่งไฟล์

- เพลงเริ่มเล่นหรือเปลี่ยนขณะย่อ: แสดง peek 2.4 วินาที แล้วกลับเป็นโหมดเล็ก
  ไม่เปิดพาเนลใหญ่เองและไม่แย่งโฟกัสจากงานที่ทำอยู่
- เล่น/หยุดจาก peek ได้โดยไม่ขยาย; หยุดเพลงแล้วแถบแอนิเมชันหยุดด้วย
  แถบนี้สื่อสถานะเล่นเพลง ไม่ได้เก็บหรือวิเคราะห์เสียง
- ขณะกำลังส่ง: การคลิกออกไม่ยกเลิกและไม่ซ่อนความคืบหน้าทันที
  เมื่อเสร็จจะแสดงผลก่อนย่อ 1.8 วินาทีถ้าเมาส์อยู่นอกและไม่ได้ปักหมุด
- การขอ PIN และข้อผิดพลาดอยู่ให้จัดการต่อ ไม่ย่อจาก timer ของการส่งครั้งก่อน
- ลากไฟล์แล้วเปลี่ยนใจ: คืนสถานะเดิม ไม่ทิ้งพาเนลค้างโดยไม่ได้ตั้งใจ
- Esc/ปุ่มย่อไม่ทำให้ hover เปิดกลับทันทีขณะเมาส์ยังอยู่บน notch
- พื้นที่เงาและมุมโปร่งใสรับคลิกทะลุได้ ไม่บังปุ่มของหน้าต่างข้างหลัง
- รองรับ reduced motion และหยุดใช้คำสั่ง seek เมื่อ player ไม่รองรับ/ปฏิเสธ

## ขอบเขต

ใช้ API ที่มีอยู่จริงใน Windows ไม่มีข้อมูลคิวเพลงหรือเนื้อเพลงจำลองในแอปจริง
ฟังก์ชันในเดโมที่ยังไม่เชื่อม เช่น volume mixer, output device, lyrics, up next,
calendar และ quota ของ AI ไม่ถูกเพิ่มเป็นปุ่มที่กดแล้วไม่ทำงาน

การ seek อ้างอิง [Windows SMTC TryChangePlaybackPositionAsync](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession.trychangeplaybackpositionasync)
โดยบวกตำแหน่งเริ่มต้นของ timeline และใช้หน่วย 100ns ตาม API

## Verification

- `npm test`: protocol round trips, media state/command validation, clipboard, AI และระบบ
- `npm run test:ui`: Electron offscreen พร้อมข้อมูลจำลองและภาพใน `docs/previews/`
- `node test/media-live-read.js`: อ่าน Windows SMTC จริงหนึ่งครั้งโดยไม่สั่งเปลี่ยนเพลงหรือระดับเสียง

ภาพตัวอย่างใช้ชื่อไฟล์/อุปกรณ์/เพลงสมมติ การส่งไป iPad จริงยังต้องเปิด LocalSend
บน iPad และเชื่อมต่อเครือข่ายเดียวกัน
