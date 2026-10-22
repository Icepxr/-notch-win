# Notch design — earlier baseline

The current redesign is specified in
[design-system/islet/MASTER.md](../design-system/islet/MASTER.md).
Its content-sized surfaces, stable native host and activity layer supersede the
geometry table and resizing notes below. This document retains earlier exploration.

อ้างอิงบรรยากาศและลำดับเนื้อหาจาก [Vorssaint live demo](https://vorssaint.com/)
หน้า Now Playing และ Files ที่ดูเมื่อ 2026-10-22 แล้วออกแบบให้เข้ากับการส่งไฟล์
ผ่าน LocalSend บน Windows โดยเฉพาะ ค่าด้านล่างเป็นค่าของโปรเจกต์นี้

## Surface

| Token | Value |
|---|---|
| Surface | `#050506` |
| Cards | `#121214` |
| Primary text | `#f1f1f3` |
| Secondary text | `#97979f` |
| Accent | `#79b4ff` |
| Success | `#74dba5` |
| Hairline | inset `1px`, white at 5.5% |
| Font | Segoe UI Variable Text / Segoe UI / Leelawadee UI |

พื้นดำทึบช่วยให้ notch ดูต่อกับขอบจอ มีไหล่โค้งเว้ารัศมี 12px ทั้งสองข้าง
และมุมล่างรัศมี 16–28px ตามสถานะ พื้นที่โปร่งใสรอบเงาและมุมล่างคลิกทะลุได้
ตัวไอคอนเป็น SVG ส่วนการ์ดไฟล์ใช้สีแยกประเภทและไม่อ่านเนื้อหาไฟล์เพื่อสร้างภาพย่อ

## Geometry and motion

`src/renderer/notch-geometry.js` เป็นแหล่งข้อมูลขนาดร่วมของ main และ renderer
ค่าเดียวกันถูกส่งเป็น CSS variables ให้ `notch.css`

| State | Painted size | Native window |
|---|---|---|
| Closed | 184 × 28 | 224 × 60 |
| Peek | 300 × 46 | 340 × 78 |
| Peek with media | 360 × 50 | 400 × 82 |
| Open | 520 × 390 | 560 × 422 |
| Open (AI, Settings) | 520 × 510 | 560 × 542 |

- พื้นที่โปร่งใส 20px ต่อด้าน และ 32px ด้านล่างสำหรับเงา
- Morph ใช้สมการสปริงที่พอร์ตจาก `NotchMotion` ของต้นฉบับ: ขยาย width 0.44s/bounce 0.25,
  height 0.38s/bounce 0.22; ย่อ 0.30s/0.26s ไม่มี bounce; จำกัด overshoot 12px
- สร้าง keyframes 120Hz จนอยู่ในระยะ 0.5px จากปลายทาง และจองพื้นที่ native window รวม overshoot
- ขยาย native window ก่อนวาด และรอ transition ทั้งสองแกนก่อนลด native window
- Revision guard กันคำสั่งเก่ากลับมาทับสถานะใหม่เมื่อย่อ–ขยายเร็ว
- Hover หน่วง 90ms; ออกจาก peek แล้วรอ 300ms ก่อนย่อ
- คลิกเปิดจะอยู่จนคลิกออกไปหน้าต่างอื่น; Keep open ป้องกันการย่ออัตโนมัติ
- เพลงใหม่ preview 2.4 วินาทีโดยไม่แย่งโฟกัส; ส่งสำเร็จรอ 1.8 วินาทีก่อนย่อเมื่อเมาส์อยู่นอก
- ลากไฟล์ที่ยกเลิกกลางทางคืนสถานะการปักหมุดเดิม
- รองรับ `prefers-reduced-motion` และการเลือกโมดูลใน Explore ด้วยลูกศร / Home / End

## Liquid glass

นอตช์ต้องเป็นหน้าต่างโปร่งใส (ไหล่โค้ง มุมล่างมน เงาคลิกทะลุ) และ Windows
**ไม่วาด backdrop material ให้หน้าต่างโปร่งใส** ส่วน `backdrop-filter` ในหน้าต่าง
โปร่งใสก็เบลอได้แค่เนื้อหาในเพจ ไม่ใช่เดสก์ท็อปข้างหลัง กระจกในนอตช์จึงเป็นแสง
ที่วาดขึ้นเอง ไม่ใช่การเบลอจอจริง — ส่วนหน้าต่างตั้งค่าเป็นหน้าต่างทึบปกติ
เลยใช้ acrylic ของระบบได้จริงบน Windows 11 22H2 ขึ้นไป

ชั้นของกระจกตอนกาง เรียงจากล่างขึ้นบน:

1. ปกอัลบั้มขยายและเบลอ 44px เป็นแสงสี (`--artwork-url`) มี scrim ทับในชั้นเดียวกัน
2. specular สองสต็อปที่ขอบบน + cool wash ที่ก้น เพื่อให้กระจกมีสีของตัวเอง
3. การ์ดด้านในโปร่งแสง 10% + `backdrop-filter: blur()` จริง ขอบสว่าง 16%
4. rim ที่ขอบอิสระ และ sweep หนึ่งครั้งตอนกาง

ระดับกระจกตั้งได้จากหน้าต่างตั้งค่า (Liquid / Frosted / Solid → `data-glass`)
และ `body.is-shrinking` ปิด backdrop-filter ระหว่าง morph

### คอนทราสต์

ปกอัลบั้มสีสว่างดันพื้นหลังขึ้นจนตัวหนังสือรองเคยวัดได้ **2.26:1** ซึ่งตก AA
`npm run test:ui` จึงวัดคอนทราสต์จาก**พิกเซลจริง** (`capturePage().toBitmap()`
แล้วเทียบ luminance เปอร์เซ็นไทล์ 97 กับ 20) ใต้ปกสีขาวซึ่งเป็นกรณีแย่สุด
และ fail ถ้าป้ายใดต่ำกว่า 4.5:1 ปัจจุบันต่ำสุด 5.13:1

## Implementation and review

`style.css` และ `panels.css` เก็บคอนโทรลร่วม; `notch.css` ดูแล surface,
การจัดวาง และ motion ของ notch รุ่นปัจจุบัน

`npm run test:ui` เปิด Chromium แบบ offscreen ผ่าน Electron ด้วยข้อมูลจำลอง
ไม่อ่านคลิปบอร์ด ไม่ค้นหาอุปกรณ์ และไม่ส่งไฟล์จริง ภาพที่ได้อยู่ใน `docs/previews/`
ครอบคลุมสถานะย่อ, peek, ว่าง, มีไฟล์, ส่งสำเร็จ, PIN และเพลง

รายละเอียดการสำรวจและ interaction ดู [interaction-notes.md](interaction-notes.md)
การพอร์ตจาก repo และส่วนที่ยังเป็น macOS ดู [windows-port.md](windows-port.md)
