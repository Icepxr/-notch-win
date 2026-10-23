# V-Notch → Islet: สิ่งที่เหมาะนำมาประยุกต์

ตรวจ source วันที่ 23 ตุลาคม 2026 ที่ revision [`b843d2340bacd94bab1b4ea6439fb29b91555f17`](https://github.com/rainaku/V-Notch/tree/b843d2340bacd94bab1b4ea6439fb29b91555f17) ของ [rainaku/V-Notch](https://github.com/rainaku/V-Notch)

เป็น static code review: clone ไว้ใน reference folder โดยไม่ได้รัน installer, build, models, APIs หรือบริการของ V-Notch และยังไม่ย้าย runtime code มาใส่ Islet การมี test files ใน source ไม่ได้แปลว่ารอบนี้รัน tests ของเขาผ่านแล้ว

## ข้อสรุป

V-Notch มีประโยชน์กับเราเด่นที่ **Windows services และพฤติกรรมของ native window** ขณะที่ Vorssaint ใช้อ้างอิงรูปทรงและโครงหน้าได้ดี โครงสร้างของ V-Notch เป็น C#/.NET 8/WPF ตาม [V-Notch.csproj](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/V-Notch.csproj#L8) ส่วน Islet เป็น Electron/JavaScript + PowerShell จึงควรแยก logic/API contract มาประยุกต์เป็นชิ้น ไม่ใช้ XAML หรือ D3D presenter แทน DOM โดยตรง

## รายการที่เลือกทำต่อได้

| รหัส | ส่วนที่ศึกษา | ลำดับที่เสนอ | เทียบ Islet |
|---|---|---|---|
| VN01 | เลือก player ให้เสถียร และปักหมุด source | เริ่มก่อน | Islet เลือก source เองได้และมี metadata grace แต่ยังไม่มี scorer/arbiter แบบนี้ |
| VN02 | Media events และ metadata recovery | เริ่มก่อน | Islet ใช้ PowerShell bridge polling 900ms และมี watchdog/restart/command IDs แล้ว |
| VN03 | Fullscreen auto-hide และ desktop-layer mode | เริ่มก่อน | Islet อยู่บนจอที่ผู้ใช้เลือกได้ แต่ยังไม่มีโหมด fullscreen/อยู่หลังแอปแบบครบชุด |
| VN04 | Volume mixer รายแอปและเลือกอุปกรณ์เสียง | รอบถัดไป | Islet มี volume/mute HUD อ่านค่า แต่ยังไม่มี mixer page ที่ควบคุมรายแอป |
| VN05 | Transition coordinator และการยกเลิกภาพเก่า | ประยุกต์กับของเดิม | Islet มี geometryRevision, spring และ playback request IDs อยู่แล้ว |
| VN06 | ปกเพลง Cache และ thumbnail crop | เลือกเฉพาะส่วนเบา | Islet ไม่ reload src เดิมระหว่าง collapse แล้ว แต่ยังมีพื้นที่ปรับคุณภาพปก browser |
| VN07 | Synced lyrics พร้อม cache และ cancel | ฟังก์ชันใหม่ให้เลือก | Islet ยังไม่มี lyrics page |
| VN08 | Shelf multi-select/lasso และ virtualization | ฟังก์ชันใหม่ให้เลือก | Islet มี shelf, folder batches และ drag out/LocalSend; selection ขั้นสูงยังมีบางส่วน |
| VN09 | Privacy indicators ของ Windows | ต้องเลือก UX ก่อน | Islet ยังไม่มี camera/mic/location/recording detector |
| VN10 | Spotlight search และ AI chat แยกจาก agent monitor | งานแยกขนาดใหญ่ | Islet มี Explore และ AI usage/limits monitor แต่ยังไม่มี launcher/chat |
| VN11 | Windows local secret storage | ใช้เมื่อมีข้อมูลลับจริง | Islet ยังไม่เก็บ provider API keys สำหรับ chatbot |
| VN12 | Battery/Bluetooth/GPU และ service lifecycle | ขยายทีละ service | Islet มี CPU/memory/storage และ health/status บางส่วน |

## VN01 — เลือก player ให้เสถียร และปักหมุด source

- **ที่พบใน source:** SessionScorer ให้คะแนน metadata/source/ความสดของ playback; SessionSwitchArbiter หน่วงการย้าย source ที่ไม่มีหลักฐานใหม่ และมี session pin แยกจาก pin เปิด notch ค้างไว้
- **วิธีประยุกต์:** พอร์ต pure policy เป็น JavaScript ก่อน ผูกกับ SMTC bridge เดิม และรักษาการเลือก source แบบ explicit ของผู้ใช้; ต้องแยก session identity จากชื่อแอปเมื่อมีหลายแท็บ
- **เกณฑ์ก่อนถือว่าเสร็จ:** Spotify + browser สลับเล่น, pause เดิม/เริ่มใหม่, source หายแล้วกลับ และผู้ใช้ pin เลือกเองต้องไม่ถูก override
- **หลักฐาน:** [SessionScorer.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/SessionScorer.cs#L30) · [SessionSwitchArbiter.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/SessionSwitchArbiter.cs#L17) · [MediaSessionSelectionPolicy.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/MediaSessionSelectionPolicy.cs#L5) · [MainWindow.MediaPin.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Windows/MainWindow.MediaPin.cs#L10)

## VN02 — Media events และ metadata recovery

- **ที่พบใน source:** V-Notch ฟัง WinRT SessionsChanged/CurrentSessionChanged และ PlaybackInfo/MediaProperties/Timeline events พร้อม recovery polling/backoff เมื่อ metadata ยังไม่มา
- **วิธีประยุกต์:** ประเมิน event bridge ในโครงเดิมก่อน ถ้าต้องใช้ C# helper ให้ส่ง JSON ผ่าน pipe แบบ bounded และ heartbeat; อย่าลบ watchdog หรือเพิ่ม event/poll ซ้ำจนโหลดสูงกว่าเดิม
- **เกณฑ์ก่อนถือว่าเสร็จ:** สถานะและชื่อเพลงเปลี่ยนทัน, session gap สั้นไม่กระพริบ, ไม่มี orphan process, idle ไม่อ่านหนัก และ reconnect ได้หลัง player restart
- **หลักฐาน:** [MediaDetectionService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/MediaDetectionService.cs#L308) · [MediaMetadataRecoveryPolicy.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/MediaMetadataRecoveryPolicy.cs#L31) · [MediaChangeQueue.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/MediaChangeQueue.cs)

## VN03 — Fullscreen auto-hide และ desktop-layer mode

- **ที่พบใน source:** แยก exclusive กับ windowed/borderless fullscreen, ตรวจ monitor ที่ notch อยู่, กรอง shell/desktop/หน้าต่างของตัวเอง; ZOrderManager มี stay-behind-windows
- **วิธีประยุกต์:** เพิ่ม Windows foreground/geometry service แล้วค่อยเปิด setting รายโหมด; desktop-layer เป็นทางเลือกแยกจากซ่อน fullscreen ต้องคงทางกลับและไม่รบกวนการส่งไฟล์/กรอก PIN
- **เกณฑ์ก่อนถือว่าเสร็จ:** เต็มจอเฉพาะจออื่นต้องไม่ซ่อนผิด, Alt+Tab ไม่กระพริบ, taskbar/Start ไม่ถูกเข้าใจว่าเป็นเกม และออก fullscreen แล้วคืนตำแหน่งเดิม
- **หลักฐาน:** [FullscreenDetector.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/FullscreenDetector.cs#L44) · [FullscreenAutoHideController.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Controllers/FullscreenAutoHideController.cs#L11) · [ZOrderManager.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/ZOrderManager.cs#L66)

## VN04 — Volume mixer รายแอปและเลือกอุปกรณ์เสียง

- **ที่พบใน source:** AudioMixerService ใช้ NAudio/Core Audio อ่าน session, ปรับ volume/mute ตาม process ID, cache metadata และ enumerate input/output พร้อมคำสั่งเปลี่ยน default device
- **วิธีประยุกต์:** แยก Core Audio logic จาก WPF ImageSource/UI ผ่าน Windows helper; ส่งเฉพาะข้อมูลจำเป็น และตรวจ process identity ก่อนสั่ง ไม่ควรคัดทั้ง .cs ที่พึ่ง WPF มาโดยตรง
- **เกณฑ์ก่อนถือว่าเสร็จ:** หลายแอปและหลาย session, process ปิด/เปิดใหม่, device unplug, mute รายแอปไม่กลายเป็น mute ทั้งระบบ และ dispose COM handles ครบ
- **หลักฐาน:** [AudioMixerService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/AudioMixerService.cs#L37) · [MediaSessionVolumeService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/MediaSessionVolumeService.cs) · [AudioMixerView.xaml](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Controls/AudioMixerView.xaml)

## VN05 — Transition coordinator และการยกเลิกภาพเก่า

- **ที่พบใน source:** แยก current/target view, shape state, active transition ID และเจ้าของการแสดงผล; content presenter ตรวจ session/version ก่อน callback และ reset temporary transforms
- **วิธีประยุกต์:** เติมเงื่อนไขที่เรายังขาดใน coordinator เดิม; รักษาขนาด native host ที่จองไว้ และสี่มุม capsule ที่เพิ่งแก้ ไม่เริ่ม animation engine ใหม่ทั้งตัว
- **เกณฑ์ก่อนถือว่าเสร็จ:** hover/collapse สลับเร็ว, เพลงเปลี่ยนระหว่างย่อ, callback เก่าห้ามเปิดหน้า/ภาพเก่าทับ และ Reduce Motion ได้ state ปลายทางเดียวกัน
- **หลักฐาน:** [NotchTransitionCoordinator.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Controllers/NotchTransitionCoordinator.cs#L25) · [NotchContentTransitionPresenter.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Presenters/NotchContentTransitionPresenter.cs#L48) · [AnimationConfig.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/AnimationConfig.cs#L55)

## VN06 — ปกเพลง Cache และ thumbnail crop

- **ที่พบใน source:** แยก fingerprint/frame detection, thumbnail heuristics และ artwork service; smart crop เป็นคนละส่วนที่ใช้ ONNX/model และมีต้นทุน dependency เพิ่ม
- **วิธีประยุกต์:** เริ่ม dedup/cache/cancellation และการ crop แบบธรรมดา รักษา black shell และ artwork tint เฉพาะแถบเพลง; ไม่ดึง ONNX/model มาโดยไม่มีโจทย์ภาพที่ชัดเจน
- **เกณฑ์ก่อนถือว่าเสร็จ:** ปกไม่ค้างข้ามเพลง, late download ไม่ทับเพลงใหม่, ไม่มีปกกลับ neutral และไม่เปลี่ยนสีทั้ง notch
- **หลักฐาน:** [MediaArtworkService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/MediaArtworkService.cs#L11) · [ArtworkFingerprint.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/ArtworkFingerprint.cs) · [ThumbnailHeuristics.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/ThumbnailHeuristics.cs) · [SmartThumbnailCropService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/SmartThumbnailCropService.cs)

## VN07 — Synced lyrics พร้อม cache และ cancel

- **ที่พบใน source:** LyricsService สร้าง search candidates จากชื่อ/ศิลปิน, ใช้ LRCLIB/lrc mux, timeout, bounded cache 64 และ cancel งานเมื่อเพลงเปลี่ยน; UI มี presentation สำหรับ lyrics แยก
- **วิธีประยุกต์:** เขียนบริการ Node ที่มีขอบเขตเหมือนกันได้; กำหนด network opt-in และข้อมูล metadata ที่ส่งก่อนเริ่มใช้ ไม่จำเป็นนำพื้น gradient/Canvas มาใช้
- **เกณฑ์ก่อนถือว่าเสร็จ:** ชื่อไทย/ชื่อยาว/เพลง live, ไม่มีผลลัพธ์, network ช้า, เปลี่ยนเพลงกลาง lookup และข้อความหลายบรรทัดต้องไม่ตัด
- **หลักฐาน:** [LyricsService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/LyricsService.cs#L80) · [MainWindow.Lyrics.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Windows/MainWindow.Lyrics.cs) · [LyricsMultilineLayoutTests.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Tests/LyricsMultilineLayoutTests.cs)

## VN08 — Shelf multi-select/lasso และ virtualization

- **ที่พบใน source:** มี lasso/Ctrl+click/Delete และคำนวณ viewport range พร้อม overscan ไม่ต้องสร้างทุก card ตลอดเวลา
- **วิธีประยุกต์:** เติม selection model ที่แยกจาก DOM แล้วใช้กับ Add/Remove/Send selected; ถ้ารายการน้อยไม่จำเป็นเพิ่ม virtualization ทันที
- **เกณฑ์ก่อนถือว่าเสร็จ:** เลือกขณะเลื่อน, ลากออกเป็นชุด, รายการถูกลบระหว่างเลือก, keyboard alternative และ LocalSend ยังคงเลือกเฉพาะไฟล์ที่ผู้ใช้ตั้งใจ
- **หลักฐาน:** [ShelfViewportVirtualizer.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/ShelfViewportVirtualizer.cs#L12) · [ClipboardTray.Selection.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Controls/ClipboardTray.Selection.cs#L24) · [ShelfViewportVirtualizerTests.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Tests/ShelfViewportVirtualizerTests.cs)

## VN09 — Privacy indicators ของ Windows

- **ที่พบใน source:** อ่าน CapabilityAccessManager/ConsentStore ร่วมกับ microphone flow และ probes ของ screen recording; มี hold duration และการกรอง process ไม่ใช่ detector ที่รู้ครบทุกแอป
- **วิธีประยุกต์:** ต้องตกลงว่าจะให้แสดงที่ใดก่อน เพราะผู้ใช้เพิ่งเอาจุดเขียวบน hover ออก; หากเพิ่มควรเป็นการตั้งค่าแบบเลือกเอง ไม่ทำให้ badge เดิมกลับมา
- **เกณฑ์ก่อนถือว่าเสร็จ:** camera active/idle, microphone ที่ไม่มีสัญญาณ, permission/read failure, OBS/recording cases ที่รองรับ และสถานะ unknown ต้องไม่อ้างว่าปลอดภัยแน่นอน
- **หลักฐาน:** [PrivacyIndicatorService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/PrivacyIndicatorService.cs#L19) · [ScreenRecordingProbe.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/ScreenRecordingProbe.cs) · [MainWindow.PrivacyIndicators.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Windows/MainWindow.PrivacyIndicators.cs)

## VN10 — Spotlight search และ AI chat แยกจาก agent monitor

- **ที่พบใน source:** Spotlight ค้นหาแอป/ไฟล์/คำนวณ และ AI mode ใช้ API key กับ conversation ไปยัง provider; เป็นหน้าที่ต่างจากการอ่าน Claude/Codex usage ใน Islet
- **วิธีประยุกต์:** ถ้าต้องการให้แยกเป็นหน้า/โมดูลใหม่ รักษา monitor เดิม; ทำ key storage/network consent และ cancel streaming ก่อน UX ตกแต่ง
- **เกณฑ์ก่อนถือว่าเสร็จ:** ค้นหาเร็ว คีย์บอร์ดครบ ไม่ส่งข้อความเพียงเปิดโหมด, cancel ได้, ไม่ export API key และ quota/token estimate ไม่ปะปนกับ chat billing
- **หลักฐาน:** [SpotlightSearchService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/Spotlight/SpotlightSearchService.cs) · [SpotlightAiService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/Spotlight/SpotlightAiService.cs#L56) · [SpotlightWindow.Ai.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Windows/SpotlightWindow.Ai.cs)

## VN11 — Windows local secret storage

- **ที่พบใน source:** DataProtection ใช้ DPAPI CurrentUser, ไม่คืน plaintext เมื่อ encrypt ล้มเหลว และมี encrypted JSON handling สำหรับข้อมูลที่เกี่ยวข้อง
- **วิธีประยุกต์:** นำหลัก OS-protected storage มาใช้เมื่อเพิ่ม keys/chat history; บน Electron ให้เลือก adapter ที่เหมาะกับ runtime แทนการเรียก C# static class ตรง ๆ
- **เกณฑ์ก่อนถือว่าเสร็จ:** อีก Windows user เปิดไม่ได้ตาม scope, encrypt/decrypt failure ชัดเจน และ export/log ไม่ใส่ secret
- **หลักฐาน:** [DataProtection.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/DataProtection.cs#L11) · [DpapiJsonConverter.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/DpapiJsonConverter.cs) · [SpotlightChatStore.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/Spotlight/SpotlightChatStore.cs)

## VN12 — Battery/Bluetooth/GPU และ service lifecycle

- **ที่พบใน source:** V-Notch แยก module initialize/start/stop/dispose และมี services ของ battery, Bluetooth, GPU พร้อม lifetime tests
- **วิธีประยุกต์:** เลือกเพิ่มทีละ sensor และหยุด worker เมื่อปิด feature; ต้องแสดง unsupported/unknown ตามข้อมูลจริง ไม่แทนด้วย 0
- **เกณฑ์ก่อนถือว่าเสร็จ:** sleep/resume, device unplug, toggle feature หลายครั้ง ไม่เพิ่ม worker ซ้ำ/handle ค้าง และไม่เพิ่ม polling ตอน idle โดยไม่จำเป็น
- **หลักฐาน:** [ModuleLifecycleManager.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/ModuleLifecycleManager.cs#L20) · [BluetoothMonitorService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/BluetoothMonitorService.cs) · [BatteryServiceImpl.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/BatteryServiceImpl.cs) · [GpuMonitorService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/GpuMonitorService.cs)

## สิ่งที่ควรคงของ Islet ไว้

- พื้น notch ดำทุกสถานะ สีเพลงอยู่เฉพาะ timeline/equalizer ไม่เปิดพื้น gradient/glass/Canvas ตาม reference โดยอัตโนมัติ
- ปุ่ม Play/Pause ของเราตอบสนองทันที มี request ID และเลือก target app ชัดเจน อย่าแทนที่ด้วย global media-key fallback ของอีกโปรเจกต์ เพราะอาจคุม player คนละตัว ดู [MediaTransportControlService.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Services/MediaTransportControlService.cs#L34) ที่มี fallback ลักษณะนี้
- ขนาด native host ที่จองไว้, capsule corners, click-through และการเลือกจอของเรายังคงเป็นฐาน
- ไม่คืน green AI dot/count badge ที่ผู้ใช้เพิ่งให้เอาออก เพียงเพราะ reference มี privacy indicators
- LocalSend และข้อมูล shelf/notes/AI ที่มีอยู่ไม่เปลี่ยนไปเป็นระบบของ reference

## ส่วนที่ยังไม่ควรดึงเข้ามาทั้งชุด

| ส่วน | เหตุผลที่ควรเลือกเฉพาะชิ้น |
|---|---|
| Liquid Glass/DX11 shaders | พึ่ง WPF/D3D presenters, GPU resources และขัดการใช้พื้นดำล้วนของ Islet; ดู [LiquidGlassController.cs](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/Controllers/LiquidGlassController.cs) |
| Smart crop/ONNX และ offline models | เพิ่ม runtime/model payload สำหรับโจทย์ที่ยังไม่จำเป็น ต้องแยกจากการแก้รูปปกเบื้องต้น |
| Spotify Canvas/พื้นวิดีโอ | เป็น network/media integration เพิ่ม ไม่ใช่ขั้นจำเป็นของการคุม SMTC และเปลี่ยนแนวภาพที่ผู้ใช้กำหนดไว้ |
| Fonts/brand/icons ของ reference | ใช้ตัวอักษร Windows และ Islet branding ต่อ ต้องดูสิทธิ์ asset รายไฟล์ ไม่เหมารวม license ของ repo |
| NSIS/setup/runtime ทั้งชุด | ใช้ศึกษา distribution flow ได้ แต่ Islet ต้อง package Electron ของตัวเอง ไม่ใช้ installer .NET ของ V-Notch |

## ลำดับพัฒนาที่ผมเสนอ

1. **ความนิ่ง:** VN01 + VN02 + เสริม VN05 เฉพาะ gap ที่เจอ — source เพลง, metadata และ transition
2. **อยู่ร่วมกับงาน/เกม:** VN03 — hide-on-fullscreen และทางเลือก desktop-layer โดยไม่ขัด transfer/PIN
3. **ความสามารถ native ใหม่:** VN04 — mixer/output ผ่าน helper ที่แยก UI
4. **ผู้ใช้เลือกเพิ่มเติม:** VN07 lyrics, VN08 selection, VN09 privacy, VN10 Spotlight/AI chat และ VN12 sensors

ไม่จำเป็นต้องสร้าง C# helper ก้อนใหญ่ตั้งแต่รอบแรก: policy selection/recovery หลายส่วนแปลงเป็น JavaScript ได้ ส่วน COM/Core Audio/native hooks ค่อยประเมิน helper รายขอบเขต และรักษา bridge framing/heartbeat ของ Islet

## License และขอบเขตการนำมาใช้

repo ระบุ [LICENSE](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/LICENSE) เป็น Apache-2.0 และ Islet เป็น GPL-3.0-or-later; Apache Software Foundation อธิบายว่า Apache-2.0 code รวมใน GPLv3 work ได้ในทิศทางนี้ ดู [คำอธิบายของ ASF](https://apache.org/licenses/GPL-compatibility.html) หากนำ code มาจริงต้องเก็บ license/copyright/NOTICE ที่เกี่ยวข้องและระบุการแก้ไขตามเงื่อนไข ไม่เปลี่ยน Islet เป็น Apache เพียงเพราะใช้ reference นี้

asset และ dependencies ไม่ได้ใช้ license เดียวทั้งหมด: [THIRD_PARTY_NOTICES.md](https://github.com/rainaku/V-Notch/blob/b843d2340bacd94bab1b4ea6439fb29b91555f17/docs/THIRD_PARTY_NOTICES.md) แยก library, font/icon, model และ external content ไว้ จึงควรเลือก service ที่ต้องการและ dependencies ของมัน ไม่ยกโฟลเดอร์ Fonts/Assets/installer หรือ dependency graph ทั้ง repo มาใส่

## สถานะรอบนี้

เพิ่มเฉพาะเอกสารเปรียบเทียบและลิงก์ source ตรวจแล้วว่าไฟล์และ line anchors ที่อ้างมีอยู่ใน revision ที่ระบุ ไม่มีการเปลี่ยน UI, native window, media commands, Startup หรือบัญชี provider ของ Islet
