# ITDash

Dashboard สำหรับงานไอทีขององค์กร (network, servers, logs, backups) — ธีม "phosphor console" สีเขียวแบบ terminal พัฒนาขึ้นเองบน Next.js + shadcn/ui

ดึงข้อมูลจริงจาก **Zabbix, Prometheus, Elasticsearch, Veeam B&R และ Cohesity** — ระบบไหนยังไม่ได้ตั้งค่า การ์ดนั้นแสดงข้อมูลตัวอย่าง

## เริ่มใช้งาน

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
docker compose up -d --build # หรือรันด้วย Docker (docs/DEPLOYMENT.md)
```

ต้องใช้ Node.js 20+ — ฟอนต์ (IBM Plex Sans / Mono / Sans Thai) ติดตั้งผ่าน npm จึง build ได้แม้ไม่มีอินเทอร์เน็ต

### ต่อข้อมูลจริง

```bash
cp .env.example .env.local   # ใส่ URL + token ของแต่ละระบบ
npm run build && npm start
```

ไม่ได้ตั้ง `.env.local` = ทุกการ์ดแสดงข้อมูลตัวอย่าง (ป้าย `sample`)
วิธีเตรียมบัญชี/สิทธิ์ของแต่ละระบบ และการปรับ PromQL / field ของ Elasticsearch อยู่ใน [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)

## Stack

| ส่วน | ใช้อะไร |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS v4 + CSS variables แบบ OKLCh |
| Components | shadcn/ui pattern (Radix UI + CVA + `cn()`) — เป็น source ในโปรเจกต์ แก้ได้เลย |
| Charts | Recharts (กราฟ throughput) + SVG/CSS ล้วน (KPI strip, service matrix, meters) |
| Icons / Theme | lucide-react, next-themes (dark เป็นค่าเริ่มต้น) |

## โครงสร้าง

```
src/
├── app/
│   ├── layout.tsx                 # root: ฟอนต์ + ThemeProvider
│   ├── globals.css                # design tokens ทั้งหมด (light + .dark)
│   └── (dashboard)/               # route group — ทุกหน้าในนี้ได้ sidebar + header
│       ├── layout.tsx             # app shell
│       ├── page.tsx               # Overview  (/)
│       └── [section]/page.tsx     # หน้า placeholder ของเมนูที่ยังไม่ได้ทำ
├── components/
│   ├── ui/                        # button, card, badge, input, sheet, dropdown-menu
│   ├── layout/                    # sidebar, header, theme-toggle
│   └── dashboard/                 # overview-cards (การ์ดแบบ async), kpi-tile, charts, ...
└── lib/
    ├── navigation.ts              # เมนู sidebar ทั้งหมดอยู่ที่นี่ที่เดียว
    ├── data/
    │   ├── types.ts               # type กลางที่ทุก adapter คืนค่า
    │   ├── index.ts               # loadX() ต่อการ์ด: live / sample / error
    │   └── mock.ts                # ข้อมูลตัวอย่าง
    ├── sources/                   # adapter: zabbix, prometheus, elasticsearch, veeam, cohesity
    ├── format.ts                  # เวลา (Asia/Bangkok), ขนาดไฟล์, ระยะเวลา
    └── utils.ts                   # cn()
```

## ปรับแต่ง

**เปลี่ยนสีหลักทั้งแอป** — แก้ตัวเลขเดียวใน `src/app/globals.css`:

```css
:root { --brand-h: 148; }   /* 148 = เขียว, 220 = ฟ้า, 75 = อำพัน, 300 = ม่วง */
```

**เพิ่มหน้าใหม่** — เช่นหน้า Tickets:
1. สร้าง `src/app/(dashboard)/tickets/page.tsx` (โฟลเดอร์จริงจะทับ placeholder `[section]` อัตโนมัติ)
2. ถ้าเป็นเมนูใหม่ เพิ่มรายการใน `src/lib/navigation.ts`

**เพิ่มระบบใหม่** (เช่น ระบบ ticket) — เขียน adapter ใน `src/lib/sources/` ให้คืนค่าเป็น type ใน `types.ts`
แล้วต่อเข้า loader ใน `src/lib/data/index.ts` — หน้าจอไม่ต้องแก้

## เอกสาร

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — ไดอะแกรมสถาปัตยกรรม, การไหลของข้อมูล, การวางเครื่องในเครือข่าย
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — วิธีเชื่อมต่อ Zabbix, Prometheus, Elasticsearch (+ log files), Veeam, Cohesity และการแก้ปัญหา
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — รันด้วย Docker, เพิ่ม replica, ผลทดสอบโหลด
- [.env.example](.env.example) — ตัวแปรที่ต้องตั้งเมื่อต่อระบบจริง

## Design notes

- ตัวเลข/label/log ใช้ monospace ส่วนเนื้อความใช้ sans เพื่อให้อ่านง่าย
- สีมีความหมาย: เขียว = ปกติ, อำพัน = เตือน, แดง = วิกฤต, ฟ้า = ข้อมูล/บำรุงรักษา
- รองรับ dark / light / system, responsive ถึงหน้าจอมือถือ (sidebar กลายเป็น drawer)
