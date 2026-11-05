# ITDash

Dashboard สำหรับงานไอทีขององค์กร (network, servers, service desk, backups) — ธีม "phosphor console" สีเขียวแบบ terminal พัฒนาขึ้นเองบน Next.js + shadcn/ui

## เริ่มใช้งาน

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
```

ต้องใช้ Node.js 20+ — ฟอนต์ (IBM Plex Sans / Mono / Sans Thai) ติดตั้งผ่าน npm จึง build ได้แม้ไม่มีอินเทอร์เน็ต

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
│   └── dashboard/                 # kpi-tile, throughput-chart, service-matrix, ...
└── lib/
    ├── navigation.ts              # เมนู sidebar ทั้งหมดอยู่ที่นี่ที่เดียว
    ├── data/overview.ts           # mock data + types
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

**ต่อข้อมูลจริง** — หน้า Overview อ่านข้อมูลจาก `src/lib/data/overview.ts` เท่านั้น เปลี่ยนแต่ละ export ให้ไป fetch จาก API (Zabbix, PRTG, GLPI, Veeam ฯลฯ) โดยคง type เดิมไว้ หน้าจอก็ไม่ต้องแก้

## Design notes

- ตัวเลข/label/log ใช้ monospace ส่วนเนื้อความใช้ sans เพื่อให้อ่านง่าย
- สีมีความหมาย: เขียว = ปกติ, อำพัน = เตือน, แดง = วิกฤต, ฟ้า = ข้อมูล/บำรุงรักษา
- รองรับ dark / light / system, responsive ถึงหน้าจอมือถือ (sidebar กลายเป็น drawer)
