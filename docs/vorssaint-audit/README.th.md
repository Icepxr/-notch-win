# Vorssaint — รายการดีไซน์ ฟังก์ชัน ลูกเล่น และการตั้งค่า

ตรวจ source วันที่ 23 ตุลาคม 2026 ที่ revision [`e916961092686d32d455d12494ab10f65a43b73a`](https://github.com/vorssaint/vorssaint-utils/tree/e916961092686d32d455d12494ab10f65a43b73a) ซึ่งเป็น HEAD ที่ตรวจพบตอนเริ่มงาน ไม่ได้ใช้เพียงหน้าเว็บหรือ README และไม่ได้แก้ runtime ของ Islet ในรอบนี้

เอกสารนี้รวบรวม **282 รายการย่อยใน 19 หมวด** พร้อม **feature-hub identities ครบ 77 ตัว** ท้ายเล่ม (มีการซ้ำเชิงหมวดโดยตั้งใจ ไม่บวกเป็นจำนวนฟีเจอร์ที่ไม่ซ้ำ) และแยก [รายการ configuration ที่ประกาศใน Settings](configuration.md) กับ [แผนที่ source](source-map.md) ไว้ให้ตรวจต่อ

เป็น static source audit บน Windows: ยืนยันว่ามี implementation/configuration ใน revision นี้ ไม่ใช่ผลทดสอบว่าแต่ละ integration ทำงานได้กับทุกแอปหรือทุก Mac ไม่มีการรันแอป macOS ที่นี่ ส่วนสถานะ Islet เป็นการเทียบจากโค้ดและงานที่เราทำใน workspace ไม่ได้หมายถึงหน้าตาเหมือน source ทุก pixel

## วิธีใช้รายการ

เลือกด้วยรหัส เช่น `M18, AI04, PET09` แล้วค่อยสั่งทำเป็นรอบๆ ได้ ตอนนี้ยังไม่อนุมัติหรือเพิ่มรายการใหม่ให้เอง

| สถานะ | ความหมาย | จำนวนรายการย่อย |
|---|---|---:|
| มี | Islet มีพฤติกรรมหลักเทียบเคียงแล้ว | 87 |
| บางส่วน | มีฐานแล้ว แต่ยังมีตัวเลือก/ข้อมูล/รายละเอียดต่างจาก source | 58 |
| ใหม่ | ยังไม่มีใน Islet รอบนี้ | 128 |
| ข้อกำหนด | source มี แต่ต้องคงคำสั่งปัจจุบันของผู้ใช้ก่อน | 3 |
| macOS | พฤติกรรมผูกกับ macOS หรือฮาร์ดแวร์ Mac ต้องออกแบบตัวแทน | 6 |

**ข้อกำหนด Islet ที่ยังคงอยู่:** พื้น notch ดำเท่านั้น; สีเพลงมีผลเฉพาะ timeline/equalizer; UI อังกฤษ; จอเลือกอิสระ; HUD เสียง/แสงเป็น readout; ไม่เพิ่มปุ่มที่ไม่มี service จริง

## สารบัญ

- [D — รูปทรง พื้นผิว สี และรายละเอียดภาพ (24)](#d)
- [B — สถานะ การเปิดปิด Hover และหลายจอ (24)](#b)
- [A — การเคลื่อนไหว Gesture และ microinteraction (18)](#a)
- [E — Explore และการจัดหน้า/ทางลัด (11)](#e)
- [M — เพลง Player เนื้อเพลง และคิว (26)](#m)
- [F — File shelf ลากวาง และงานไฟล์ (15)](#f)
- [C — Clipboard (12)](#c)
- [N — Scratchpad/Notes (10)](#n)
- [T — Timer Focus และ Stopwatch (12)](#t)
- [AI — AI Agents และ quota dashboard (28)](#ai)
- [S — System monitoring ใน notch (10)](#s)
- [CAL — Calendar (10)](#cal)
- [NF — Notifications และ system feedback (15)](#nf)
- [DL — Downloads (6)](#dl)
- [W — Watch พื้นที่หน้าจอ (8)](#w)
- [CAP — Captures Camera และ Camera mirror (9)](#cap)
- [CTL — Controls Mixer และ Tools (10)](#ctl)
- [PET — Companion/Mascot และของตกแต่งมีชีวิต (15)](#pet)
- [SET — Config panel / Settings ทั้งระบบ (19)](#set)
- [APP — รายการ feature hub ทั้ง 77 ตัว](#app)
- [ช่องว่างสำคัญและ dependency](#dependencies)

## หน้า notch ทั้ง 16 โมดูล

Controls, Mixer, Music, Clipboard, Captures, Files, System, Tools, Calendar, Notifications, Timer, Camera, Downloads, Scratchpad, Agents, Watch จาก [NotchSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchSupport.swift#L1641) ส่วน Explore, app panel, lyrics/queue, compact activities และ companion เป็นการนำทาง/ส่วนเสริม ไม่ได้นับเป็นโมดูลหลักเพิ่ม

## สเปกภาพสำคัญที่อ่านได้จาก source

ค่าเหล่านี้เป็น pt ของ SwiftUI/AppKit ไม่ใช่ค่าบังคับให้ Islet เปลี่ยนตามทั้งหมด และหลายค่าปรับตาม geometry/กล้อง/พื้นที่หน้าจอ

| ส่วน | ค่า source |
|---|---|
| Notch content | horizontal inset 28, row gap 10, bottom inset 16 |
| มุมผิว notch | min(28, height×0.34); shoulder min(14,height×0.19) |
| Capsule | min(height/2,28), aspect ตอนพัก 5; มี fit/drop เพิ่มได้ |
| Gallery tiles | width 92 / height 86 / spacing 8; คำนวณจำนวนแถวคอลัมน์ตามพื้นที่ |
| Music reading width | 344; source ไม่ได้ใช้ layout 76px artwork เต็มหน้าของ Islet ปัจจุบัน |
| Music artwork/head | artwork 56, head spacing 14, title band 38 |
| Music typography | title 14 semibold, artist 13; Compact มีชุด font แยก |
| Music timeline/transport | timeline region 14, transport row 44 |
| Timer | reading width 344, ruler 82, Start 28; มี minimum ruler และ layout ตามโหมด |
| System cards | height 72 / width 128 ก่อน fit กับพื้นที่ |
| Clipboard | compact card 52 / comfortable 104 / gap 8 / search 36 |
| AI cards | gap 10 / minimum card 96 / chart 118; account cards มีขนาดแยก |
| Settings sidebar | min 198 / ideal 210 / max 240 |
| Settings groups | radius 16 / padding 16 / heading-content gap 13 |
| Settings rows | icon tile 26 / radius 7 / icon-text gap 12 |
| Scroll edge | 16 / fade 180ms เฉพาะขอบที่มี content ต่อ; Lyrics ใช้ 24 |

หลักฐาน: [NotchSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchSupport.swift#L1641) · [NotchAgentSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchAgentSupport.swift#L66) · [NotchMusicView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchMusicView.swift#L6) · [SettingsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsView.swift#L52) · [SettingsCard](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsCard.swift#L9) · [NotchScrollEdgeFade](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchScrollEdgeFade.swift#L9)

<a id="d"></a>

## D — รูปทรง พื้นผิว สี และรายละเอียดภาพ

สีที่ source มีเป็นรายการอ้างอิงเท่านั้น: Islet ยังคงพื้นดำตามคำสั่งล่าสุด; สีมาสคอตหรือสถานะเป็นคนละส่วนกับสีพื้น notch

หลักฐาน: [NotchComponents](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchComponents.swift) · [NotchView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchView.swift#L7) · [NotchSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchSupport.swift#L1641) · [Theme](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Theme.swift#L7)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| D01 | พื้นดำของ notch | Solid black เป็นฐาน แยกจากธีมของหน้าต่าง Settings/เมนูหลัก | มี |
| D02 | Capsule ลอย | ทรงแคปซูลแยกจากขอบบน ไม่มีไหล่เว้า ใช้มุม min(height/2,28) | มี |
| D03 | Notch ชิดขอบ | มุมบนตรง ไหล่เว้าต่อขอบจอ มุมล่าง min(28,height×.34) | มี |
| D04 | ไหล่ปรับตามความสูง | Shoulder min(14,height×.19) ไม่ใช้ขนาดเดียวทุกสถานะ | มี |
| D05 | ขนาด Compact/Spacious/Custom | เลือกรูปแบบสำเร็จรูปหรือกำหนดเอง | บางส่วน |
| D06 | ความกว้างและความสูงสูงสุด | Source custom width 360–600 และ height 260–640 pt; Islet ใช้ช่วงของตัวเอง | บางส่วน |
| D07 | ปรับ capsule ละเอียด | ปรับ width -40…40, height -4…4, ระยะจากบน 0…20 pt | ใหม่ |
| D08 | ปรับให้พอดีกล้องจริง | ชดเชยความกว้าง/สูง housing และซ่อนช่องว่างแถบเมนู; เป็นเรื่องของ Mac ที่มีกล้องบาก | macOS |
| D09 | เส้นขอบรอบ notch | เปิด outline ได้ มีค่าความหนาใน NotchLayout | ใหม่ |
| D10 | พื้นโปร่งใส | Translucent เป็นตัวเลือกแยกจาก solid black | ข้อกำหนด |
| D11 | Liquid Glass | มีเงื่อนไข macOS/SDK และ Reduce Transparency; ไม่ใช่สีธีม preset | ข้อกำหนด |
| D12 | แสง/สีจากปกเพลง | source มี artwork tint และชั้นภาพเพลง; ของเราจำกัด timeline/equalizer เท่านั้น | บางส่วน |
| D13 | ปรับสีตามบริบท | แบตต่ำแดง เตือนก่อนต่ำส้ม timer ส้ม provider มีสีเฉพาะ ไม่ใช่ย้อมทั้งแอป | บางส่วน |
| D14 | ตัวอักษรตามระบบ | ใช้ system fonts, semibold/medium และเลข monospaced ตามบริบท; Mac กับ Windows ใช้คนละฟอนต์ | มี |
| D15 | ผิวการ์ดย่อย | ขาวโปร่งบาง เส้นขอบละเอียด และสถานะ selected/disabled | มี |
| D16 | ปกเพลงมีเส้นขอบบาง | Artwork corner radius ตามขนาด เส้นขอบขาว .5pt 12% | มี |
| D17 | ปุ่มมีสถานะ hover/pressed | ไฮไลต์พื้นบาง ยก/ย่อเล็กน้อยตามชนิดปุ่ม ไม่ใช้เอฟเฟกต์เดียวกันทั้งหมด | บางส่วน |
| D18 | ไอคอนระบบ | SF Symbols และไอคอนแอปจริง; Windows ต้องใช้ไอคอนที่มีสิทธิ์และรูปแบบใกล้เคียง | บางส่วน |
| D19 | Light/Dark ของ panel | หน้าต่างเมนูใช้ surface/สี metric ที่เปลี่ยนตาม color scheme; notch มี presentation ของตนเอง | ใหม่ |
| D20 | Increase Contrast | เพิ่มความชัดเส้นขอบเมื่อระบบขอ ไม่อาศัยสีเพียงอย่างเดียว | บางส่วน |
| D21 | Reduce Motion/Transparency | ลดแอนิเมชันและลดความโปร่งใสตาม accessibility | บางส่วน |
| D22 | Empty/loading/error states | ใช้สัญลักษณ์ ข้อความ สถานะรอและปุ่มไปขั้นถัดไปแทนพื้นที่ว่าง | บางส่วน |
| D23 | จำกัดรอบแอนิเมชันตกแต่ง | NotchDecorativeClock เป็นตัวจัดจังหวะ animation ที่จำกัดอัตราและผูกกับการมองเห็น ไม่ใช่ widget นาฬิกา | ใหม่ |
| D24 | ขอบรายการค่อยๆ จาง | Fade 16pt เฉพาะด้านที่ยังเลื่อนได้ 180ms; lyrics ใช้ระยะของตัวเอง | มี |

<a id="b"></a>

## B — สถานะ การเปิดปิด Hover และหลายจอ

การวางจอและ native window ต้องปรับใช้ Windows; ไม่ควรนำระดับหน้าต่างหรือ API macOS มาใช้ตรงตัว

หลักฐาน: [NotchService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchService.swift#L105) · [NotchWindowHost](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchWindowHost.swift#L22) · [NotchMirrorView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchMirrorView.swift#L8) · [NotchSettings](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L7) · [NotchSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchSupport.swift#L1641)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| B01 | Rest/compact/peek/open | แยกสถานะพัก กิจกรรมย่อ พรีวิว และหน้าขยาย | มี |
| B02 | เลือกสิ่งแสดงตอนพัก | None / Battery / Music / Agents | บางส่วน |
| B03 | คลิกเพื่อเปิด | เปิดเนื้อหาจากจุดที่ผู้ใช้กำลังดู | มี |
| B04 | Hover preview | เลื่อนเมาส์ผ่านแล้วแสดงพรีวิวแทนเปิดทั้งหน้า | มี |
| B05 | Hover expand | เลือกให้ hover เปิดหน้าขยายได้ | ใหม่ |
| B06 | ซ่อนจนกว่าจะ hover | ซ่อนพื้นผิวพัก รอ pointer หรือ shortcut | ใหม่ |
| B07 | กิจกรรมขณะซ่อน | เลือกให้กิจกรรมยังแสดงเมื่อใช้ hidden-until-hover | ใหม่ |
| B08 | ตั้ง hover delay | ปรับเวลารอก่อนแสดงเมื่อชี้เมาส์ | ใหม่ |
| B09 | ตั้ง close delay | ปรับเวลารอก่อนปิดหน้าที่เปิดด้วย hover | บางส่วน |
| B10 | Pin/Keep open | ปักหมุด ป้องกันการย่อจากเมาส์ออก | มี |
| B11 | คลิกด้านนอกย่อ | ปล่อยพื้นที่ให้หน้าต่างเดิม โดยไม่ยกเลิกงานเบื้องหลัง | มี |
| B12 | เปิดโดยไม่แย่ง focus | hover/readout ไม่ควรดึงคีย์บอร์ดจากงานที่ใช้อยู่ | บางส่วน |
| B13 | เปิดกลับหน้าล่าสุด | จำหน้าที่กำลังใช้ | มี |
| B14 | กำหนดหน้าบ้าน | เลือก Controls/โมดูลอื่น/Explore/App panel เป็นปลายทางเปิดใหม่ | ใหม่ |
| B15 | เปิดกิจกรรมปัจจุบัน | เลือกให้คลิกเปิดโมดูลของกิจกรรมที่กำลังแสดง | มี |
| B16 | เลือกจอ Automatic/Built-in/Main/Pointer | ของเรามี selected/primary/cursor และเลือกจอรายตัว | บางส่วน |
| B17 | แสดงทุกจอพร้อมกัน | All ใช้ compact mirror บนจออื่น; คลิกที่ mirror เพื่อย้าย island มาเปิดบนจอนั้น ไม่ใช่เปิดหน้าขยายอิสระทุกจอ | ใหม่ |
| B18 | ต่อ/ถอดจอและ lid changes | คำนวณ geometry ใหม่ พร้อมรองรับสภาพกล้อง/ไม่มีบาก | บางส่วน |
| B19 | ซ่อนใน fullscreen | มีตัวเลือกและเงื่อนไข compact presentation ระหว่าง fullscreen | ใหม่ |
| B20 | พฤติกรรมกับ menu bar | การคลุมเมนู การเว้นช่อง และการเข้าถึงเมนูเป็น logic เฉพาะ Mac | macOS |
| B21 | แสดง/ซ่อนในภาพจับหน้าจอ | เลือกให้ overlay อยู่ใน capture หรือไม่ | ใหม่ |
| B22 | Destination ของหน้าต่างย่อย | เลือกเปิด shelf/clipboard/notes/tools/capture controls ใน island หรือหน้าต่างแยก | บางส่วน |
| B23 | Lock-screen presentation | มี overlay และกิจกรรมที่อนุญาตบนล็อกสกรีนตามข้อจำกัดของ Mac | macOS |
| B24 | Lock/unlock sounds | เสียงเหตุการณ์ล็อกแยกเปิดปิดได้ | macOS |

<a id="a"></a>

## A — การเคลื่อนไหว Gesture และ microinteraction

ค่าระยะเป็น pt ของ source ไม่ใช่คำสั่งให้เปลี่ยนขนาด Islet; การ swipe เปลี่ยนโมดูลของ Islet เป็นส่วนที่เราประยุกต์ ไม่เหมารวมว่า source ใช้เหมือนกัน

หลักฐาน: [NotchSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchSupport.swift#L1641) · [NotchGestureSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchGestureSupport.swift#L8) · [NotchComponents](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchComponents.swift) · [NotchView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchView.swift#L7)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| A01 | Spring แยกแกน | ขยาย width .44s bounce .25 และ height .38s bounce .22 | มี |
| A02 | ย่อแบบไม่เด้ง | width .30s และ height .26s ไม่มี bounce | มี |
| A03 | จำกัด overshoot | ไม่ให้ overshoot เกิน 12pt และกำหนดเกณฑ์ settle .5pt | มี |
| A04 | กลับทิศกลางแอนิเมชัน | เริ่มจากขนาดที่วาดอยู่และ retarget ได้ | บางส่วน |
| A05 | รักษาทรงขณะ hover | capsule คงมุมครบสี่ด้าน ไม่เผยทรง notch หลัง animation จบ | มี |
| A06 | เนื้อหาแยกจากเปลือก | จัด content ให้พอดีในผิวที่กำลัง morph ลดปก/ตัวอักษรเด้ง | บางส่วน |
| A07 | Fade through black | สลับ companion/activity ผ่านดำเมื่อ crossfade จะทำให้ข้อความซ้อน | ใหม่ |
| A08 | Blur replacement | บางช่วงสลับแถวกิจกรรมใช้ blurReplace ตามระบบ | ใหม่ |
| A09 | Hover โตโดยคงแถบเดิม | ขยายพื้นที่รอบ strip โดยไม่ขยายปกและ bars กระโดดทันที | บางส่วน |
| A10 | กดปุ่มยุบตัว | NotchButtonStyle มี pressed scale และ spring เฉพาะปุ่ม | บางส่วน |
| A11 | Slider editing feedback | แยกสถานะกำลังปรับ เพื่อไม่ปิด/สลับเนื้อหากลางการลาก | บางส่วน |
| A12 | เลื่อนลงเปิด/ขึ้นปิด | มี threshold และจำพื้นที่เริ่ม gesture | มี |
| A13 | Swipe เพลงซ้ายขวา | เปลี่ยน previous/next บน music surface เมื่อรองรับ | มี |
| A14 | ล็อกแกนและหนึ่ง action ต่อ gesture | สะสมระยะเริ่ม จับ intent และป้องกัน firing ซ้ำใน sequence | มี |
| A15 | แยก momentum ของ trackpad | โมเมนตัมช่วยจบเปิด/ปิดได้ แต่ไม่สร้างการเปลี่ยนเพลงใหม่ | บางส่วน |
| A16 | ไม่แย่ง scroll/editor/control | ตรวจ native control, text editor และ scroll view ก่อนใช้ gesture | บางส่วน |
| A17 | Haptic feedback | มีตัวเลือก feedback บนฮาร์ดแวร์ที่รองรับ; Windows ต้องหาอุปกรณ์/API ที่เหมาะสม | macOS |
| A18 | Keyboard/navigation | shortcut เปิด island เลือกหน้า คุมปุ่มและช่องค้นหา โดยไม่บังคับใช้ hover อย่างเดียว | บางส่วน |

<a id="e"></a>

## E — Explore และการจัดหน้า/ทางลัด

โมดูลตาม enum มี 16 ตัว; Explore และ App panel เป็นปลายทาง/การนำทาง ไม่ใช่โมดูลเพิ่มอีกสองตัว

หลักฐาน: [NotchSectionsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchSectionsView.swift#L12) · [NotchQuickAccessView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchQuickAccessView.swift#L63) · [NotchLayoutEditor](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchLayoutEditor.swift#L6) · [NotchContentEditor](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchContentEditor.swift)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| E01 | Explore grid | รวมโมดูลเป็น tiles 86pt และระยะ 8pt | มี |
| E02 | เลื่อนเป็นชุดแถว | วัดจำนวน columns/rows ให้รายการเต็ม ไม่ตัดครึ่งแถว | มี |
| E03 | ชื่อ ไอคอน shortcut | แต่ละ tile มีตัวช่วยบอกปลายทางและการเปิดด้วยคีย์ | มี |
| E04 | จัดลำดับโมดูล | ลากเรียงและบันทึกลำดับ | มี |
| E05 | เปิด/ซ่อนโมดูล | ไม่แสดงของที่ไม่เลือกหรือ feature ยังไม่ติดตั้ง | มี |
| E06 | Live layout editor | preview หน้า notch กับรายการควบคุมประกอบกันได้ | บางส่วน |
| E07 | Quick access layout | จัด configuration ของปุ่มลัดที่แสดงในหน้า home | ใหม่ |
| E08 | จัดลำดับ Controls | primary level cards และ shortcut tiles ปรับแยกกัน | ใหม่ |
| E09 | Options ตามโมดูล | เมื่อเลือก Music/Calendar/Clipboard ฯลฯ จะแสดงตัวเลือกเฉพาะส่วนนั้น | บางส่วน |
| E10 | ป้ายบอก dependency | ของที่ยังใช้ไม่ได้มีเหตุผลและทางไปติดตั้ง/ให้สิทธิ์ | บางส่วน |
| E11 | Settings จากบริบท | เข้าตั้งค่าหน้าที่กำลังใช้โดยตรง ไม่ต้องไล่กลับเอง | บางส่วน |

<a id="m"></a>

## M — เพลง Player เนื้อเพลง และคิว

SMTC ของ Windows ไม่รับประกัน lyrics/queue/shuffle ของทุก player; ต้องตรวจ capability และมี fallback ตามจริง

หลักฐาน: [NotchMusicView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchMusicView.swift#L6) · [NotchMusicStrip](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchMusicStrip.swift#L21) · [NotchLyricsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchLyricsView.swift#L6) · [NotchQueueView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchQueueView.swift#L6) · [NotchMusicService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchMusicService.swift#L7)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| M01 | ชื่อเพลง ศิลปิน แอป และปก | layout เฉพาะ open/compact/camera/capsule | มี |
| M02 | Play/Pause ทันที | แยก requestedPlaying จาก reading ให้ไอคอนตอบสนองก่อน state จริงกลับมา | มี |
| M03 | Previous/Next | แสดงและ enable ตามความสามารถของ source | มี |
| M04 | Scrub timeline | ลาก seek พร้อมเวลาที่อ่านได้ และติดตาม context ของ track | มี |
| M05 | Elapsed/remaining time | เลขเวลาใช้ monospaced ลดการขยับ | มี |
| M06 | เลือก playback source | source อัตโนมัติหรือเลือก player ที่พบ | มี |
| M07 | ตั้ง preferred player | เลือกแอปที่จะเปิดเมื่อไม่มีอะไรเล่น; Automatic จำแอปเพลงล่าสุดแล้ว fallback ไป Spotify/Apple Music ของ Mac | ใหม่ |
| M08 | คลิกเปิดแอปเพลง | เปิด player ของเพลงปัจจุบันโดยตรง | บางส่วน |
| M09 | Shuffle | ปุ่มสุ่มขึ้นกับ source และการอนุญาต automation | ใหม่ |
| M10 | เลือก output | เปิดตัวเลือก audio output จากหน้าเพลง | ใหม่ |
| M11 | Tint เฉลี่ยจากปก | หนึ่ง pixel sRGB → ตรวจความมืด/อิ่มสี → normalize ช่วงสี | มี |
| M12 | ชื่อเพลงเลื่อนเมื่อยาว | เลื่อนเฉพาะกรณีพื้นที่ไม่พอ | มี |
| M13 | ชื่อเพลงตอน compact hover | หน่วงการแสดงชื่อและคำนวณปีกตามชื่อ ลดการกระโดดเมื่อชี้ | บางส่วน |
| M14 | Track-change activity | เปลี่ยนเพลงแสดงช่วงสั้นโดยไม่เปิดหน้าใหญ่ | มี |
| M15 | Grace period metadata | ช่วง source ไม่ส่งข้อมูลสั้นๆ ไม่ทำให้ UI หายทันที | มี |
| M16 | ปกจาก browser | Firefox/Zen ใช้ saved session หาแท็บ YouTube แล้วโหลด thumbnail; fallback บางกรณีใช้ iTunes lookup จึงมี network request | ใหม่ |
| M17 | Equalizer ตกแต่ง | แท่งเคลื่อนไหวแสดงสถานะ playing ไม่ใช่การวัดเสียงจริง | มี |
| M18 | Live equalizer | เมื่อเปิด feature และจับ audio ได้ แท่งใช้ band levels จริง | ใหม่ |
| M19 | Lyrics sync | เนื้อเพลงตาม timestamp เลื่อนบรรทัดกลางและไฮไลต์บรรทัดร้อง | ใหม่ |
| M20 | Lyrics plain/instrumental | fallback เมื่อไม่มีตำแหน่ง/เพลงบรรเลง มีข้อความอธิบาย | ใหม่ |
| M21 | นำเข้าเนื้อเพลง | import timed lyrics และรายงานไฟล์ผิด/ว่าง | ใหม่ |
| M22 | Online lyrics แบบ opt-in | ส่ง metadata เพลงไป lrclib.net และอาจตรวจชื่อกับ musicbrainz.org เฉพาะเมื่อเปิดใช้; มี retry/loading | ใหม่ |
| M23 | ปรับ lyrics offset | เพิ่ม/ลด .25 วินาที และรีเซ็ต offset | ใหม่ |
| M24 | Upcoming queue | แสดงปกย่อ ชื่อ ศิลปิน และ loading/empty/unavailable แยกกัน | ใหม่ |
| M25 | Play queued item | เล่นจากคิวเมื่อ player ยอมให้สั่ง และกันคำสั่งซ้อน | ใหม่ |
| M26 | Refresh queue | รีเฟรชคิวพร้อมสถานะงานค้าง/ผิดพลาด | ใหม่ |

<a id="f"></a>

## F — File shelf ลากวาง และงานไฟล์

AirDrop ใน Mac กับ LocalSend ของ Islet เป็นคนละระบบ; การส่งไป iPad ที่เรามีเป็นความสามารถของ Islet ไม่อ้างว่า source ใช้ LocalSend

หลักฐาน: [NotchFilesView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchFilesView.swift#L8) · [ShelfTilesView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Shelf/ShelfTilesView.swift#L89) · [ShelfService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Shelf/ShelfService.swift#L19) · [NotchFileToolsSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchFileToolsSupport.swift#L8)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| F01 | ลากเข้าเพื่อพักไฟล์ | reveal shelf เมื่อ drag ผ่านบริเวณ island | มี |
| F02 | Empty tray แบบเส้นประ | สัญลักษณ์ถาด เส้นขอบ dash และคำแนะนำสั้น | มี |
| F03 | การ์ดไฟล์แนวนอน | thumbnail/icon ชื่อ ชนิด และ selection | มี |
| F04 | พัก text/link | รับของจาก clipboard/drag นอกเหนือจาก file URL | บางส่วน |
| F05 | ลากไฟล์ออก | ส่ง item กลับไปแอปอื่นผ่าน native drag | มี |
| F06 | เลือกหลายรายการ | selected items มีคำแนะนำและ actions ตาม selection | บางส่วน |
| F07 | Batch grouping | รวมชุดไฟล์และขยาย/ยุบ batch | บางส่วน |
| F08 | Pin shelf items | เก็บ item ไม่ให้ถูกเอาออกตามการใช้งานทั่วไป | ใหม่ |
| F09 | Open/Reveal/Quick preview | เมนูและการกระทำตามชนิดไฟล์ผ่านระบบ | บางส่วน |
| F10 | Share sheet | แชร์ผ่าน macOS services; ถ้าทำบน Windows ต้องใช้ Share/LocalSend ของเรา | ใหม่ |
| F11 | Clear ยืนยันใน menu | เมนูลบชุดและ Cancel ไม่ใช้ sheet ที่ทำพื้นโปร่งใสเสีย | บางส่วน |
| F12 | Archive ZIP | เลือกปลายทาง สร้าง archive แสดง progress/cancel และกัน output ทับ input | ใหม่ |
| F13 | Drop destination สองฝั่ง | เลือกพัก shelf หรือ Optimize Media ด้วยพื้นที่ drop แยก | ใหม่ |
| F14 | Media workspace ใน notch | บีบอัดภาพ/วิดีโอหรือ tool ที่รับไฟล์นั้นได้ เปิดต่อ/ปิดต่อโดยไม่ทิ้งงาน | ใหม่ |
| F15 | งานไฟล์ไม่ถูก hover ปิด | คงปฏิสัมพันธ์ขณะ native menu/save dialog หรือกำลังลาก | บางส่วน |

<a id="c"></a>

## C — Clipboard

ของเราจงใจเก็บเพียง bounded text/preview และไม่เก็บ full image history; source รองรับมากกว่า

หลักฐาน: [NotchClipboardView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchClipboardView.swift#L9) · [ClipboardHistoryService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Clipboard/ClipboardHistoryService.swift#L21) · [ClipboardHistorySupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Clipboard/ClipboardHistorySupport.swift)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| C01 | Text/image/file history | แสดงรายการต่างชนิดพร้อม preview ตามข้อมูลจริง | บางส่วน |
| C02 | ค้นหาในหน้า | พิมพ์เพื่อค้นหาและใช้คีย์บอร์ดเลือกผล | มี |
| C03 | Pin และ Pinned filter | เลือกแสดงเฉพาะของที่ปักไว้ | มี |
| C04 | Copy/paste กับ copied feedback | source มี paste flow กับ focus ของแอปเดิม; Islet มี copy กลับ clipboard | บางส่วน |
| C05 | Clear recent โดยเก็บ pins | ล้างประวัติทั่วไปแยกจากรายการปักหมุด | มี |
| C06 | Card size Compact/Comfortable | source เลือก 52/104pt card density | บางส่วน |
| C07 | Hover lifted preview | pointer dwell 700ms / keyboard 1.4s แล้วแสดงรายละเอียด | มี |
| C08 | ออกจาก preview หน่วงสั้น | ปิดหลังออก 150ms และ Escape คืน focus | มี |
| C09 | เรียง/จัดรายการ | source history มี order/pin behavior; ตรวจผลต่อรายการจริงก่อนพอร์ต | บางส่วน |
| C10 | Privacy retention | จำกัดรายการ แยก cache และเงื่อนไขไม่เก็บข้อมูลบางประเภท | บางส่วน |
| C11 | Auto-clear system clipboard | มี delay/sleep/lock โดยไม่เหมารวมว่าลบ history ทั้งหมด | ใหม่ |
| C12 | Paste plain text | วางแบบตัด formatting แล้วรักษา clipboard เดิม | ใหม่ |

<a id="n"></a>

## N — Scratchpad/Notes

ฐานของเราเป็นโน้ตเดียว; multi-pad และ Markdown ต้องเปลี่ยน data model จึงระบุใหม่แยกจาก autosave ที่มีแล้ว

หลักฐาน: [NotchScratchpadView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchScratchpadView.swift#L14) · [ScratchpadService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/QuickTools/ScratchpadService.swift#L15) · [ScratchpadSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/QuickTools/ScratchpadSupport.swift#L208)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| N01 | Autosave | เก็บโน้ตและแสดงสถานะบันทึก/ข้อผิดพลาด | มี |
| N02 | Find ในโน้ต | ค้นหา/ถัดไป/ก่อนหน้า และเลื่อนไปผลลัพธ์ | มี |
| N03 | ปรับ text size | ขนาดตัวอักษรที่บันทึกไว้ได้ | มี |
| N04 | Copy all พร้อม feedback | ใช้ icon check ชั่วคราวเมื่อสำเร็จ | มี |
| N05 | หลายแท็บ/หลาย pad | สร้าง เลือก เปลี่ยนชื่อ และปิด pad | ใหม่ |
| N06 | Markdown preview | สลับแก้ไขกับอ่าน Markdown | ใหม่ |
| N07 | Format bar | แถบช่วยจัดรูปแบบข้อความ/Markdown | ใหม่ |
| N08 | Export โน้ต | ส่งออกเนื้อหาจาก pad ปัจจุบัน | ใหม่ |
| N09 | Clear/Close confirmation | ยืนยันการกระทำกับเอกสารที่มีข้อมูล | ใหม่ |
| N10 | เปิดหน้าต่างแยก | เลือกเปิด Scratchpad นอก notch ได้ | ใหม่ |

<a id="t"></a>

## T — Timer Focus และ Stopwatch

หน้าที่มีอยู่ต้องรักษา session ใน main process; ข้อที่เรียกว่ามี หมายถึงมีพฤติกรรมเทียบเคียง ไม่รับรอง pixel-identical

หลักฐาน: [NotchTimerView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchTimerView.swift#L6) · [NotchTimerRuler](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchTimerRuler.swift#L8) · [NotchTimerSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchTimerSupport.swift#L174) · [NotchTimerService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchTimerService.swift#L9)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| T01 | Timer ตั้งนาที | เลือกเวลาบน ruler กึ่งกลางหน้าขยาย | มี |
| T02 | Ruler ลาก/scroll/keyboard | ตัวเลขและเข็มสัมพันธ์กับ minute ที่เลือก | มี |
| T03 | จำ Timer/Focus แยกกัน | สลับโหมดไม่ทับ duration กัน | มี |
| T04 | Focus cycle | งาน พักสั้น พักยาว และจำนวนรอบ | มี |
| T05 | Start/Pause/Resume/Reset | สถานะและปุ่มหลักเปลี่ยนตาม session | มี |
| T06 | Stopwatch | จับเวลาแบบนับขึ้น | มี |
| T07 | Compact countdown | แสดงเวลาขณะ notch ย่อ พร้อมเปิดกลับหน้าของตัวเอง | มี |
| T08 | ซ่อน compact countdown | มี setting ซ่อนการนับโดย session ยังทำงาน | ใหม่ |
| T09 | Completion notice และเสียง | source มี timer sound option; ของเรามีแจ้งเตือนภาพ | บางส่วน |
| T10 | Next phase แบบ explicit | เวลาเสร็จรอผู้ใช้เริ่มช่วงถัดไป | มี |
| T11 | Digit transition | เลขเปลี่ยนแบบ numeric motion และเคารพ Reduce Motion | มี |
| T12 | งานเดินต่อเมื่อปิด UI | service เป็นเจ้าของนาฬิกา ไม่เริ่มงานซ้ำเมื่อโหลดหน้าใหม่ | มี |

<a id="ai"></a>

## AI — AI Agents และ quota dashboard

นี่เป็นตัวติดตาม agent/usage ไม่ใช่ chatbot ใหม่ ข้อมูล limits ขึ้นกับ provider/บัญชี; API value เป็น estimate ไม่ใช่ยอดบิลจริง

หลักฐาน: [NotchAgentsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchAgentsView.swift#L7) · [NotchAgentComponents](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchAgentComponents.swift) · [NotchAgentStrip](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchAgentStrip.swift#L9) · [NotchAgentSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchAgentSupport.swift#L66) · [NotchAgentsSettings](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchAgentsSettings.swift#L8)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| AI01 | Claude และ Codex | provider cards, โลโก้ และข้อมูลจาก integration ของแต่ละตัว | มี |
| AI02 | OpenCode | provider เพิ่มใน source พร้อมข้อมูลที่ integration อ่านได้ | ใหม่ |
| AI03 | GitHub Copilot | ข้อมูล local CLI/app session; token totals บางส่วนรอ shutdown metrics | ใหม่ |
| AI04 | หลายบัญชี Codex | เพิ่ม CODEX_HOME ให้แต่ละ account มี limits card | ใหม่ |
| AI05 | Session/weekly limits | หน้าต่าง quota และเวลาที่รีเซ็ต เมื่อ provider ส่งมา | มี |
| AI06 | Used/Remaining | สลับวิธีแสดงเปอร์เซ็นต์ | มี |
| AI07 | เลือก limit focus | Most-used / session / weekly | บางส่วน |
| AI08 | แถบเวลาใน quota window | elapsed-time marker แยกจาก quota percentage | มี |
| AI09 | Fresh/stale/signed-out | ข้อมูลเก่า/ขาด/ต้อง sign-in ไม่ถูกตีเป็น 0 | มี |
| AI10 | Refresh พร้อม cooldown | ตรวจบัญชีด้วยสถานะ pending/error | มี |
| AI11 | Limits card | quota ของ provider/account | มี |
| AI12 | Spend card | ค่าประเมิน API แยกจากจำนวน token | บางส่วน |
| AI13 | Live sessions card | model/project/status/เวลาทำงานของ session จริง | มี |
| AI14 | Trend card | กราฟ usage ตามช่วงเวลาและ inspector | มี |
| AI15 | Models breakdown | สรุปแยก model และ usage/value | บางส่วน |
| AI16 | Projects breakdown | สรุปแยก project | บางส่วน |
| AI17 | Activity heatmap | ความหนาแน่นการใช้งานรายวัน | มี |
| AI18 | Banked resets card | แสดง/ใช้ Codex banked resets ตามสิทธิ์ของบัญชี | ใหม่ |
| AI19 | เลือกช่วงวัน | period selector ใน dashboard | มี |
| AI20 | จัดลำดับ/ซ่อน cards | ลากเรียงและมีวิธีคืนค่าเมื่อซ่อนหมด | มี |
| AI21 | Compact readout 4 แบบ | elapsed / tokens / cost / limit; ของเรามี elapsed กับ limit | บางส่วน |
| AI22 | ตัวบอกกำลังทำงาน | provider mark และ status animation ไม่ทับ activity อื่น | มี |
| AI23 | แจ้งเตือนงานเสร็จ | กำหนด minimum task duration ได้ใน source | บางส่วน |
| AI24 | แจ้งเตือน quota ต่ำ | เลือก threshold 50/75/80/90/95% ตามค่า source | บางส่วน |
| AI25 | Daily budget | ตัวเลือกงบ estimate รายวันและค่า 0=ไม่กำหนด | ใหม่ |
| AI26 | อัปเดตราคา model | เลือกให้ service อัปเดต price data สำหรับ estimate | ใหม่ |
| AI27 | ข้อมูลไม่สูญ focus/scroll | UI updates ไม่รื้อ card ทุก poll | มี |
| AI28 | Connect/setup guidance | เส้นทางติดตั้ง/sign-in/แก้ CLI outdated ตามสาเหตุ | บางส่วน |

<a id="s"></a>

## S — System monitoring ใน notch

GPU/temp/fan/power ต้องพึ่ง Windows sensors หรือ service เพิ่ม ไม่สรุปว่ามีเพียงเพราะ Windows แสดง CPU ได้

หลักฐาน: [NotchSystemView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchSystemView.swift#L6) · [MetricDetailView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/MenuPanel/MetricDetailView.swift#L147) · [NotchSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchSupport.swift#L1641)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| S01 | CPU overview/history | ภาพรวมแล้วเปิดรายละเอียดการใช้งาน | มี |
| S02 | Memory overview/pressure | แยก memory/pressure และ history | บางส่วน |
| S03 | Disk/storage detail | พื้นที่ว่างและข้อมูล storage | มี |
| S04 | GPU metric | ข้อมูล GPU เมื่อระบบรองรับ | ใหม่ |
| S05 | Network detail | traffic/history และ local network readings | ใหม่ |
| S06 | Power/battery health | กำลังไฟ ชาร์จ สุขภาพแบตและเวลาที่ประมาณได้ | ใหม่ |
| S07 | Temperatures | sensor readings ตาม metric ที่มีอยู่ | ใหม่ |
| S08 | Connected-device battery | อุปกรณ์ที่ระบบรู้จักและแบตที่อ่านได้ | ใหม่ |
| S09 | Adaptive overview cards | card สูง 72pt ปรับแถว/คอลัมน์ตามพื้นที่ | มี |
| S10 | Fan control | เป็น feature แยก มี RPM/manual/curve; การรองรับฮาร์ดแวร์ต้องสำรวจ | ใหม่ |

<a id="cal"></a>

## CAL — Calendar

source ใช้ EventKit; Windows ต้องตัดสินใจแหล่ง calendar และสิทธิ์ใหม่ก่อนสร้าง

หลักฐาน: [NotchCalendarView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchCalendarView.swift#L7) · [NotchCalendarMonthView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchCalendarMonthView.swift#L8) · [NotchCalendarStrip](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchCalendarStrip.swift#L10) · [NotchCalendarSelection](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchCalendarSelection.swift#L9)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| CAL01 | Agenda | เหตุการณ์ตามวัน พร้อม all-day/current/ended state | ใหม่ |
| CAL02 | Week strip | เลือกวันและเลื่อนสัปดาห์ | ใหม่ |
| CAL03 | Month grid | หน้าปฏิทินเดือนเมื่อพื้นที่พอ | ใหม่ |
| CAL04 | Previous/Next/Today | นำทางและกลับวันที่ปัจจุบัน | ใหม่ |
| CAL05 | เลือก calendars | เลือกแหล่งปฏิทินที่แสดง | ใหม่ |
| CAL06 | Event countdown | นับถอยหลังเหตุการณ์และเลือกเป็นราย event | ใหม่ |
| CAL07 | Time remaining | แสดงเวลาที่เหลือของเหตุการณ์ปัจจุบัน | ใหม่ |
| CAL08 | Week numbers | เปิดเลขสัปดาห์ได้ | ใหม่ |
| CAL09 | เปิด event ใน Calendar | เชื่อมกลับแอปเจ้าของข้อมูล | ใหม่ |
| CAL10 | Compact calendar activity | แสดงเหตุการณ์ในแถบย่อและใช้ร่วมกับ activity อื่น | ใหม่ |

<a id="nf"></a>

## NF — Notifications และ system feedback

ต้องแยก internal activity ของ Islet ที่มีแล้วออกจากการอ่าน system notifications ซึ่งเรายังไม่มี; การแทน native banner เป็นงานเฉพาะแพลตฟอร์ม

หลักฐาน: [NotchNotificationsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchNotificationsView.swift#L7) · [NotchNoticeView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchNoticeView.swift#L7) · [NotchNotificationService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchNotificationService.swift#L10) · [NotchSettings](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L7)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| NF01 | System notification inbox | อ่านแจ้งเตือนของแอปอื่นมาแสดงใน notch | ใหม่ |
| NF02 | ไอคอนแอป ชื่อ ข้อความ เวลา | แสดงข้อมูลแจ้งเตือนตามที่อ่านได้ | ใหม่ |
| NF03 | Open/Dismiss/Clear all | เปิดแอปต้นทาง ลบรายรายการ/ล้างรวม | ใหม่ |
| NF04 | ขยาย notice | เปิดข้อความหรือ actions เพิ่มตาม notification ที่รองรับ | ใหม่ |
| NF05 | Hide system banner | source มีตัวเลือก dismiss native banners เพื่อไม่ซ้ำ | macOS |
| NF06 | Volume/mute HUD | readout สั้นพร้อมระดับจริง | มี |
| NF07 | Brightness HUD | แสดงค่าความสว่างจริงที่อ่านได้ | มี |
| NF08 | Keyboard backlight HUD | ระดับแสงคีย์บอร์ดบนอุปกรณ์ที่รองรับ | ใหม่ |
| NF09 | Microphone HUD | feedback เปิด/ปิดไมค์ | ใหม่ |
| NF10 | Input-source feedback | แจ้งเมื่อสลับภาษา/รูปแบบคีย์บอร์ด | ใหม่ |
| NF11 | Battery/accessory notices | แบตต่ำ ต่อชาร์จ/เชื่อมอุปกรณ์ ตาม service | ใหม่ |
| NF12 | Clipboard activity | แสดงผลการ copy ตามการตั้งค่าความเป็นส่วนตัว | บางส่วน |
| NF13 | Capture result activity | แจ้งภาพ/งาน capture พร้อมขั้นถัดไป | ใหม่ |
| NF14 | กิจกรรมหลายอย่างเลือกได้ | เลือก music/timer/watch/downloads/agents/calendar/keep-awake หรือ companion combination | บางส่วน |
| NF15 | Notice ไม่รื้อหน้าปัจจุบัน | แยก transient feedback จาก page ที่เปิด | มี |

<a id="dl"></a>

## DL — Downloads

นี่คือตรวจโฟลเดอร์/งานดาวน์โหลดที่เห็นได้ ไม่ได้แปลว่าอ่านเปอร์เซ็นต์ของทุก browser ได้ทั้งหมด

หลักฐาน: [NotchDownloadsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchDownloadsView.swift#L123) · [NotchDownloadSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchDownloadSupport.swift#L108) · [NotchDownloadService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchDownloadService.swift#L8)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| DL01 | เลือกโฟลเดอร์เฝ้าดู | เลือก/ลืม folder พร้อมสิทธิ์เข้าถึง | ใหม่ |
| DL02 | รายการกำลังโหลด/โหลดเสร็จ | รวม partial files กับ file results ที่ตรวจพบ | ใหม่ |
| DL03 | Compact progress | ชื่อ ไอคอน เปอร์เซ็นต์/แถบเมื่อข้อมูลเพียงพอ | ใหม่ |
| DL04 | เสร็จ/ล้มเหลว feedback | สถานะผลลัพธ์และ activity | ใหม่ |
| DL05 | Open/Reveal | เปิดไฟล์หรือโฟลเดอร์เมื่อมีไฟล์ปลายทาง | ใหม่ |
| DL06 | ย้ายเข้าสู่ shelf | ส่งไฟล์ที่โหลดแล้วไปหน้า Files | ใหม่ |

<a id="w"></a>

## W — Watch พื้นที่หน้าจอ

เป็นการอ่านพื้นที่ที่ผู้ใช้เลือกด้วย screen capture/OCR ในเครื่อง ไม่ใช่ AI ที่เข้าใจทุกแอป และไม่ได้ติดตามหน้าต่างที่ปิด/ซ่อนได้เสมอ

หลักฐาน: [NotchWatchView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchWatchView.swift#L29) · [NotchWatchSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchWatchSupport.swift#L146) · [NotchWatchService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchWatchService.swift#L37)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| W01 | Choose Area | เลือกส่วนหนึ่งของหน้าต่าง เช่น progress/build/score | ใหม่ |
| W02 | เตือนเมื่อเปลี่ยน | ตรวจการเปลี่ยนค่าหรือภาพที่เลือก | ใหม่ |
| W03 | เตือนเมื่อหยุดเปลี่ยน | ต้องเปลี่ยนก่อน แล้วนิ่งครบช่วงที่ source กำหนด | ใหม่ |
| W04 | เตือนเมื่อพบข้อความ | contains เป้าหมายที่ผู้ใช้ใส่ | ใหม่ |
| W05 | เตือนตัวเลขถึงเป้า | เปรียบเทียบค่าตัวเลขที่อ่านได้ | ใหม่ |
| W06 | Live activity | แสดง reading ย่อ เปิดดู/เลือกพื้นที่ใหม่/Stop/Watch Again | ใหม่ |
| W07 | สถานะ hidden/closed | บอกเมื่อหน้าต่างซ่อนและเมื่อปิด ไม่แกล้งแสดงค่าต่อ | ใหม่ |
| W08 | เสียงเตือนแยก | เลือกเปิด/ปิดเสียงเหตุการณ์ Watch | ใหม่ |

<a id="cap"></a>

## CAP — Captures Camera และ Camera mirror

บริการจับภาพ/กล้องใช้ API macOS ในต้นฉบับ ต้องแทนด้วย Windows capture/media APIs; Camera mirror คือภาพกล้อง ส่วน NotchMirrorView คือสำเนา island บนจออื่น

หลักฐาน: [NotchCaptureControlsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchCaptureControlsView.swift#L12) · [NotchCameraView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchCameraView.swift#L7) · [CameraPreviewService](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/QuickTools/CameraPreviewService.swift#L13) · [NotchView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchView.swift#L7)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| CAP01 | Recent captures ใน notch | รายการ capture ที่ทำไว้ เปิดกลับมาใช้งาน | ใหม่ |
| CAP02 | Capture tool selector | เลือก screenshot/record/OCR/color จากแถบเดียว | ใหม่ |
| CAP03 | Capture controls ใน island | collapse/cancel/tool และคีย์บอร์ดสำหรับ controls | ใหม่ |
| CAP04 | Repeat last region | ตัวเลือกทำซ้ำบริเวณที่เคยเลือกเมื่อ service มีข้อมูล | ใหม่ |
| CAP05 | Recording audio options | เปิด system audio/microphone แยก | ใหม่ |
| CAP06 | Camera preview | เริ่มดูภาพกล้องใน notch | ใหม่ |
| CAP07 | เลือก camera device | เมนูอุปกรณ์และอุปกรณ์ปัจจุบัน | ใหม่ |
| CAP08 | Mirror preview | ภาพสำหรับตรวจหน้ากล้อง และเปิดหน้าต่างแยก | ใหม่ |
| CAP09 | Capture privacy | hide/show island ในผล capture และ permission/empty state | ใหม่ |

<a id="ctl"></a>

## CTL — Controls Mixer และ Tools

ต้องไม่เปลี่ยน HUD อ่านค่าเฉยๆ ของเราเป็นปุ่มเปิด Settings โดยอัตโนมัติ; interactive Controls เป็นคนละหน้า

หลักฐาน: [NotchControlsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchControlsView.swift#L7) · [NotchMixerView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchMixerView.swift#L13) · [NotchKeepAwakeStrip](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchKeepAwakeStrip.swift#L10) · [NotchQuickAccessView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchQuickAccessView.swift#L63) · [NotchSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchSupport.swift#L1641)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| CTL01 | Volume control card | slider แบบใช้งานได้จริง พร้อมตัวเลือก output | ใหม่ |
| CTL02 | Brightness control card | slider/อุปกรณ์ตาม brightness service | ใหม่ |
| CTL03 | Keyboard light card | ซ่อนเมื่อฮาร์ดแวร์ไม่รองรับ | ใหม่ |
| CTL04 | Music control card | readout/playback ในหน้า home controls | ใหม่ |
| CTL05 | Keep awake controls/activity | เปิด/ปิดและแสดงงานย่อพร้อมระยะเวลา | ใหม่ |
| CTL06 | Shortcut tiles 15 ชนิด | volume/brightness/keyboardLight/music/mixer/keepAwake/timer/calendar/microphone/screenshot/recording/speedTest/panel/commandBar/scratchpad | บางส่วน |
| CTL07 | Per-app volume faders | ระดับเสียงแยกแอปในหน้ามิกเซอร์ | ใหม่ |
| CTL08 | Pin/reorder mixer apps | จัดแอปที่ใช้บ่อยและเรียง faders | ใหม่ |
| CTL09 | Mixer output/routing | แยก output และตัวเลือกแต่ละ app ตามระบบที่รองรับ | ใหม่ |
| CTL10 | Launch tools rail | เรียกเครื่องมือที่ติดตั้งจาก quick-launcher ใน notch | ใหม่ |

<a id="pet"></a>

## PET — Companion/Mascot และของตกแต่งมีชีวิต

สีของมาสคอตไม่ใช่สีพื้น notch; source วาดตัวละครด้วย geometry/vector ไม่จำเป็นต้องพึ่งรูป bitmap

หลักฐาน: [NotchMascotView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Notch/NotchMascotView.swift#L1186) · [NotchMascotSupport](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Services/Notch/NotchMascotSupport.swift#L1162) · [NotchMascotSettings](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchMascotSettings.swift#L9)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| PET01 | เปิด/ปิด companion | เลือกให้มีตัวละครบน island | ใหม่ |
| PET02 | Minimal/Robot | สองรูปแบบหน้าตา | ใหม่ |
| PET03 | Body shapes | Ball/Egg/Squircle/Pill | ใหม่ |
| PET04 | 7 palettes | Pearl/Lemon/Peach/Rose/Lilac/Sky/Mint | ใหม่ |
| PET05 | เลือกฝั่ง | ซ้าย/ขวาของพื้นที่พัก | ใหม่ |
| PET06 | ซ่อนตอน idle | ไม่บัง content เมื่อไม่มีกิจกรรม | ใหม่ |
| PET07 | Visit frequency | Rare/Normal/Frequent | ใหม่ |
| PET08 | Visits เปิดปิดแยก | ตัวละครเดิน/แวะ/กลับที่พักตาม track ที่คำนวณไว้ | ใหม่ |
| PET09 | Reactions เปิดปิดแยก | มี celebrate/love/surprised/flash/confused/wake/yawn/perk/bounce/hush/ready/groove | ใหม่ |
| PET10 | Mood/eyes | idle/happy/wink/love/sleepy/determined/surprised/searching/thinking/confused/alert | ใหม่ |
| PET11 | ปฏิกิริยาตามเหตุการณ์ | timer/music/agent/event/download/capture ฯลฯ มี moment mapping และ rate gate | ใหม่ |
| PET12 | Countdown performance | มีช่วงก่อนหมดเวลาและพักค้างสั้น ไม่ใช่สุ่ม animation ตลอดเวลา | ใหม่ |
| PET13 | หลบเนื้อหาและส่งคืนพื้นที่ | content steps aside/fade through ขณะตัวละครผ่าน | ใหม่ |
| PET14 | Command Bar presentation | เลือก Droplet หรือ Island สำหรับ command bar integration | ใหม่ |
| PET15 | Live preview ใน Settings | ดูรูปร่าง/สี/อารมณ์ก่อนเลือก | ใหม่ |

<a id="set"></a>

## SET — Config panel / Settings ทั้งระบบ

Settings ใช้ธีมของหน้าต่างระบบ แยกจากการล็อกพื้น notch เป็นดำ; Appendix แนบทุก @AppStorage declaration ที่พบใน UI/Settings

หลักฐาน: [SettingsView](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsView.swift#L52) · [SettingsDirectory](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsDirectory.swift#L37) · [SettingsCard](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsCard.swift#L9) · [NotchSettings](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/NotchSettings.swift#L7) · [FeatureHubSettings](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/FeatureHubSettings.swift#L12)

| รหัส | รายการ | รายละเอียดที่พบใน source / สิ่งที่ต่างใน Islet | Islet |
|---|---|---|---|
| SET01 | Sidebar แบ่งหมวด | workspace/tools และรายละเอียดที่เลื่อนแยก | มี |
| SET02 | Search ถึง control | ค้นหาชื่อ feature/keyword แล้วไปหน้าหรือ section ที่เกี่ยวข้อง | มี |
| SET03 | History/back-forward | ย้อนกลับ/ไปหน้าเดิมโดยไม่หลงตำแหน่ง | มี |
| SET04 | Collapsible sidebar groups | ยุบหมวดที่ไม่ได้ใช้งาน | ใหม่ |
| SET05 | Dynamic Island tabs | Layout/Content/Activity/Behavior และ Companion เมื่อ feature พร้อม | บางส่วน |
| SET06 | Rounded grouped cards | radius16 padding16 หัวข้อและ row hierarchy | มี |
| SET07 | Row icon tile | 26pt tile, gap12 และคำอธิบายใต้ชื่อ | มี |
| SET08 | Preview ในตัว | live preview ของ layout/content/companion ไม่ใช่ภาพ static อย่างเดียว | บางส่วน |
| SET09 | Feature hub | ติดตั้ง/ถอนการใช้แต่ละ feature โดย service ที่ปิดไม่โหลด | ใหม่ |
| SET10 | Feature presets | เลือกชุดเริ่มต้นแล้วปรับแยกภายหลัง | ใหม่ |
| SET11 | Permission portal | บอกว่าฟีเจอร์ไหนต้องการสิทธิ์ใดและทางไปตั้งค่า | ใหม่ |
| SET12 | Dependency/gating | รายการที่ยังไม่พร้อมมีเหตุผลและทางแก้ ไม่ปล่อยปุ่มตาย | บางส่วน |
| SET13 | Backup/export/import settings | ย้ายการตั้งค่าข้ามเครื่องและ restore | ใหม่ |
| SET14 | Languages | หลายภาษาใน source; Islet UI เป็นอังกฤษตามคำสั่ง | ข้อกำหนด |
| SET15 | Launch at login | ตั้งค่าเริ่มเมื่อเข้าระบบ | มี |
| SET16 | Global shortcut editor | จัด shortcuts รวม ตรวจชน/ลงทะเบียนไม่สำเร็จ | บางส่วน |
| SET17 | Panel layout editor | เรียง/ซ่อน sections ของเมนูหลัก เลือก density/layout | ใหม่ |
| SET18 | Update/onboarding/what's new | หน้าความเปลี่ยนแปลง คำแนะนำเริ่มต้นและตัวอัปเดต | ใหม่ |
| SET19 | Privacy/data/about | ข้อมูลแอป การเก็บ local data และการตั้งค่าที่เกี่ยวข้อง | บางส่วน |

<a id="app"></a>

## APP — Feature hub ครบ 77 identities

รายการนี้รวมความสามารถนอก notch ด้วย ไม่ได้เสนอให้ยกทั้งโปรแกรมมาไว้ใน Islet แต่ละรายการเป็น feature identity ที่ติดตั้ง/ถอดการใช้งานแยกได้ใน source; รายละเอียดย่อยของส่วน notch อยู่ในหมวดด้านบน ส่วนเครื่องมือภายนอกบางตัวมี editor/settings ย่อยอีกหลายหน้า จึงแนบ configuration และ source map ให้ไล่ต่อ

หลักฐานรายการครบ: [FeatureCatalog](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/Core/FeatureCatalog.swift) และ [SettingsDirectory](https://github.com/vorssaint/vorssaint-utils/blob/e916961092686d32d455d12494ab10f65a43b73a/Sources/Vorssaint/UI/Settings/SettingsDirectory.swift#L37)

| รหัสเลือก | Source identity | ฟังก์ชัน | ขอบเขต |
|---|---|---|---|
| APP01 | `switcher` | App/window switcher | สลับแอป/หน้าต่าง live preview ค้นหาและกรองจอ |
| APP02 | `dockPreview` | Dock previews | พรีวิวหน้าต่างเมื่อ hover ไอคอน Dock แล้วเปิด/ปิด/ย้าย |
| APP03 | `dockClick` | Dock click actions | ย่อ ซ่อน หรือวนหน้าต่างจาก Dock |
| APP04 | `windowMaximizer` | Maximize | ใช้ปุ่มเขียวขยายโดยไม่เข้า Space ใหม่ |
| APP05 | `windowLayout` | Window layout | snap layouts/edge/shortcut/modifier drag และย้ายจอ |
| APP06 | `autoQuit` | Quit on last close | ปิดแอปที่เลือกเมื่อหน้าต่างสุดท้ายถูกปิด |
| APP07 | `spacesOrder` | Fixed Spaces order | รักษาลำดับ virtual desktops ของ Mac |
| APP08 | `scrollInverter` | Invert scrolling | กลับแนวตั้ง/แนวนอนแยกจาก trackpad |
| APP09 | `scrollHorizontal` | Modifier horizontal scroll | กด modifier แล้วเลื่อนแนวนอน |
| APP10 | `focusFollowsMouse` | Focus follows pointer | ย้าย focus ตาม pointer หลัง delay |
| APP11 | `smoothScroll` | Smooth wheel | ปรับความลื่น ความเร็ว และ response |
| APP12 | `linearScroll` | Linear scrolling | หนึ่ง notch ล้อเลื่อนเท่ากันโดยไม่ขึ้นกับความเร็ว |
| APP13 | `mouseAcceleration` | Pointer acceleration | ปิด acceleration และคืนค่าตอนเลิกใช้ |
| APP14 | `mouseNavigation` | Mouse back/forward | ปุ่มด้านข้างกับ Finder/browser ที่รองรับ |
| APP15 | `mouseButtonShortcuts` | Extra mouse bindings | ผูกปุ่ม/side wheel/drag gesture |
| APP16 | `middleClick` | Trackpad middle click | แปลง three-finger press เป็น middle click |
| APP17 | `mouseClickDebounce` | Click debounce | กรองคลิกซ้ำจากสวิตช์เสื่อม |
| APP18 | `keyboardDebounce` | Key debounce | กรองอักษรซ้ำจากปุ่มเสื่อม |
| APP19 | `textSnippets` | Text snippets | trigger → ข้อความ มี clipboard/date/time variables และค้นหา library |
| APP20 | `superKey` | Super key | Caps/right modifier เป็นชุด shortcut พร้อม tap action/exclusions |
| APP21 | `quitWindowProtection` | Quit/close protection | hold/double press/modifier สำหรับ shortcut ปิดแอป/หน้าต่าง |
| APP22 | `clipboardHistory` | Clipboard history | text/image/file local history ค้นหา pin preview/paste |
| APP23 | `pastePlain` | Paste plain | วางไร้ formatting โดยคืน clipboard เดิม |
| APP24 | `finderCutPaste` | Finder cut/paste | ย้ายไฟล์ด้วย shortcut และความคืบหน้า |
| APP25 | `finderRename` | Finder F2 rename | rename ผ่าน F2 |
| APP26 | `shelf` | File shelf | พัก file/text/link และลากออกหรือ share |
| APP27 | `urlCleaner` | URL cleaner | ลบ tracking parameters ทั้ง manual/automatic |
| APP28 | `diskImageInstaller` | DMG installer | ติดตั้งจาก disk image และ eject/cleanup |
| APP29 | `mixer` | Volume mixer | ระดับเสียงต่อแอป boost และจัด favorites |
| APP30 | `soundOutputSwitcher` | Output switcher | สลับ audio output ด้วย shortcut และลดเสียงเมื่อ headset หลุด |
| APP31 | `audioPriority` | Audio priority | จัดลำดับ preferred audio input/output ตามอุปกรณ์ |
| APP32 | `micMute` | Microphone tools | เลือก input/level ที่รองรับและ mute shortcut |
| APP33 | `musicBlock` | Block unwanted Music launch | กัน Music เปิดจาก playback-button presses ที่ตรวจพบ |
| APP34 | `keepAwake` | Keep awake | timer/lid/app/power/display automation |
| APP35 | `brightness` | Display brightness | คุมรายจอ hardware/software dimming และขั้น brightness keys |
| APP36 | `extraBrightness` | Extra XDR brightness | ใช้ HDR headroom บน MacBook Pro ที่รองรับ |
| APP37 | `bluetoothSleep` | Bluetooth on sleep | ปิดตอน sleep และคืนเฉพาะที่แอปเป็นผู้ปิด |
| APP38 | `quickLauncher` | Quick launcher | palette เครื่องมือโปรดแบบ floating |
| APP39 | `quickToggles` | Quick toggles | appearance/desktop icons/eject/trash/lock และ actions ระบบ |
| APP40 | `colorPicker` | Screen color picker | HEX/RGB/HSL/SwiftUI พร้อม magnifier |
| APP41 | `screenOCR` | Screen OCR/QR | อ่าน text/QR ในเครื่องจากบริเวณหน้าจอ |
| APP42 | `cleaningMode` | Cleaning mode | ล็อก keyboard สำหรับเช็ดจอ มี black screen/indicator |
| APP43 | `mediaTools` | Local media tools | บีบอัด/แปลงภาพ วิดีโอ GIF watermark และ extract text |
| APP44 | `cleaner` | Cleaner | cache/log/leftovers manual/scheduled |
| APP45 | `uninstaller` | Uninstaller | ตรวจ app-related files ก่อนย้าย Trash |
| APP46 | `homebrew` | Homebrew manager | ค้นหา ติดตั้ง ลบ formula/cask |
| APP47 | `appUpdates` | App updates | รวม Store/package/feed updates และเลือกอัปเดต |
| APP48 | `screenshot` | Screenshot/editor | area/window/screen/scrolling annotate/crop/redact/background/watermark/pin/share |
| APP49 | `cameraPreview` | Camera mirror | กล้อง floating/island |
| APP50 | `radialMenu` | Radial menu | วงล้อ app/file/shortcut/tool มี profiles และ submenus |
| APP51 | `scratchpad` | Scratchpad | autosave tabs Markdown preview/export |
| APP52 | `commandBar` | Command Bar | ค้นหา apps/windows/files/clipboard/snippets/menu; calculator/unit/emoji/scripts |
| APP53 | `screenRecorder` | Screen recorder/editor | system/mic audio tracks trim/cut/zoom/blur/video/GIF/share |
| APP54 | `wallpaper` | Wallpaper | feature เปลี่ยน/จัดการ wallpaper ตามตัวเลือก service |
| APP55 | `killProcess` | Kill Process | เลือก process และสั่งหยุดผ่านเครื่องมือ |
| APP56 | `portManager` | Port Manager | แสดง listening ports และ process เจ้าของ |
| APP57 | `notch` | Dynamic Island | ตัว host ของ 16 โมดูลและกิจกรรม |
| APP58 | `notchCalendar` | Calendar extension | agenda/month/countdown |
| APP59 | `notchNotifications` | Notification extension | แสดง system notification ใน island |
| APP60 | `notchGestures` | Gesture extension | scroll open/close และ swipe เพลง |
| APP61 | `notchTimer` | Timer extension | timer/focus/stopwatch |
| APP62 | `notchAccessories` | Accessory extension | สถานะอุปกรณ์และแบต |
| APP63 | `notchLyrics` | Lyrics extension | timed/plain/import/optional online lyrics |
| APP64 | `notchQueue` | Queue extension | upcoming และสั่งเล่นเมื่อ source รองรับ |
| APP65 | `notchLiveEqualizer` | Live audio levels | bars ตามเสียงจริงบนระบบรองรับ |
| APP66 | `notchDownloads` | Downloads extension | เฝ้า folder และ download activity |
| APP67 | `notchAgents` | Agent extension | Claude/Codex/OpenCode/Copilot และ usage/limits |
| APP68 | `notchWatch` | Watch extension | ติดตามบริเวณหน้าต่างและเตือนตามเงื่อนไข |
| APP69 | `notchMascot` | Companion extension | ตัวละคร shape/palette/reaction/visit |
| APP70 | `monitorCPU` | CPU metrics | usage/history/temperature ที่รองรับ |
| APP71 | `monitorGPU` | GPU metrics | GPU readings ที่รองรับ |
| APP72 | `monitorMemory` | Memory metrics | usage/pressure/history |
| APP73 | `monitorNetwork` | Network metrics | traffic/session total/IP/speed test |
| APP74 | `monitorDisk` | Disk metrics | storage/readings/history ตาม service |
| APP75 | `monitorPower` | Power metrics | battery health/time/power/temperature |
| APP76 | `connectedDevices` | Connected devices | อุปกรณ์เชื่อมต่อและข้อมูลที่อ่านได้ |
| APP77 | `fanControl` | Fan Control beta | RPM/manual/temperature curves บนฮาร์ดแวร์ที่รองรับ |

<a id="dependencies"></a>

## ช่องว่างสำคัญและ dependency ที่ใช้ตัดสินใจ

| กลุ่ม | สิ่งที่ต้องตัดสินใจ/สร้างเพิ่มบน Windows |
|---|---|
| Lyrics / Queue / Shuffle | SMTC อย่างเดียวไม่รับประกันข้อมูล; ต้องมี adapter ของ player และ capability fallback |
| Live equalizer / Mixer | แยก decorative bars ออกจาก audio capture จริง; ต้องมีบริการ Windows audio session/loopback และพิจารณา routing ที่ระบบยอมให้ทำ |
| Notifications | Windows notification access/activation/การซ้ำ banner ต้องสำรวจแยก ไม่เทียบตรงกับวิธีอ่าน Notification Center ของ Mac |
| Calendar | เลือกแหล่งข้อมูล บัญชี และสิทธิ์ที่ผู้ใช้ต้องการก่อนใช้แทน EventKit |
| Watch | ต้องมี area/window capture, local OCR, เงื่อนไขตรวจเปลี่ยน และสถานะเมื่อหน้าต่างซ่อน/ย่อ/ปิด |
| Sensors/Fans | Windows ไม่ได้ให้ API สากลครอบคลุมทุกฮาร์ดแวร์ ต้องแสดง unknown/unsupported ตามจริง |
| หลายจอพร้อมกัน | ต้องออกแบบหลาย host windows และเลือกเจ้าของ interaction/session โดยไม่ทำซ้ำงานเบื้องหลัง |
| Lock screen / Dock / Finder / Spaces / XDR / Homebrew | เป็น macOS integration ต้องเปลี่ยนแนวทางหรือพิจารณาไม่นำมาใช้ ไม่ใช่คัด Swift ไปแล้วทำงานบน Windows |
| Glass/พื้นโปร่งใส/พื้นตามเพลง | เป็นสิ่งที่พบใน source แต่ยังขัดข้อกำหนด Islet พื้นดำ จึงไม่เปิดกลับโดยพลการ |
| Source license | source เป็น GPL-3.0-or-later และมีข้อกำหนด branding แยก; Islet คงชื่อของเราและ attribution เดิม |

## สิ่งที่แยกให้ถูกก่อนเลือก

- AI Agents คือ monitor ของการใช้งาน/สถานะ agent ไม่ใช่การเพิ่ม chatbot ที่ตอบแทน provider
- ค่า API value/cost estimate ไม่ใช่ค่าใช้จ่ายจริงหรือ quota ของบัญชี และค่าที่ provider ไม่ส่งต้องคง unknown
- แถบ equalizer ตกแต่งไม่ใช่ live audio spectrum
- File Share/AirDrop ของ macOS ไม่ใช่ LocalSend; Islet มี LocalSend ของตัวเอง
- Spring duration เป็น parameter ของแบบจำลอง ไม่ใช่รับประกันเวลา render จบตรงตัวบนทุกเครื่อง
- UI/config ที่พบใน source ไม่ได้ยืนยันว่าฮาร์ดแวร์/permission ของทุกเครื่องรองรับ

รายการเลือกของคุณ: `____________________________________________`
