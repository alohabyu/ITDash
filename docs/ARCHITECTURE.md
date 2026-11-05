# สถาปัตยกรรม ITDash

ข้อมูลไหลจากระบบต่างๆ ในองค์กรมาถึงหน้า dashboard อย่างไร
(ไดอะแกรมเขียนด้วย Mermaid — GitHub แสดงเป็นรูปให้อัตโนมัติ)

แนวคิดหลัก

1. **ดึงข้อมูลฝั่ง server เท่านั้น** — token / รหัสผ่านอยู่บน server ของ ITDash ไม่ถูกส่งไปเบราว์เซอร์
2. **หนึ่งระบบ = หนึ่ง adapter** (`src/lib/sources/*`) — ทุก adapter คืนค่าเป็น type กลาง (`src/lib/data/types.ts`)
   หน้าจอจึงไม่ต้องรู้ว่าข้อมูลมาจากไหน
3. **cache ตามความสดของข้อมูล** — problem/probe/log 30 วินาที, traffic และ backup 5 นาที, storage 15 นาที
4. **การ์ดแยกกันโหลด** — ระบบไหนช้าหรือล่ม กระทบแค่การ์ดของตัวเอง และแสดงสาเหตุแทนตัวเลขปลอม

---

## 1. ภาพรวมระบบ

```mermaid
flowchart LR
  ZBX["Zabbix<br/>hosts · problems · disks"]
  PROM["Prometheus<br/>traffic · blackbox probes"]
  ES["Elasticsearch<br/>logs"]
  VBR["Veeam B&R<br/>backup jobs"]
  COH["Cohesity<br/>protection groups"]
  FILES["log files · Windows events · syslog"]

  subgraph APP["ITDash · Next.js server"]
    direction TB
    ADP["adapters<br/>src/lib/sources/*"]
    TYP["แปลงเป็น type กลาง<br/>src/lib/data"]
    CCH["cache<br/>'use cache' + cacheLife"]
    UI["Server Components<br/>การ์ดแต่ละใบ"]
    ADP --> TYP --> CCH --> UI
  end

  BR["เบราว์เซอร์<br/>ทีมไอที"]

  FILES -- "Filebeat / Elastic Agent" --> ES
  ZBX -- "JSON-RPC · Bearer token" --> ADP
  PROM -- "PromQL HTTP API" --> ADP
  ES -- "_search · API key" --> ADP
  VBR -- "REST :9419 · OAuth" --> ADP
  COH -- "REST v2 · apiKey" --> ADP
  UI -- "HTML ที่ render แล้ว" --> BR
```

---

## 2. การ์ดแต่ละใบดึงข้อมูลจากไหน

```mermaid
flowchart LR
  ZBX["Zabbix"]:::src
  PROM["Prometheus"]:::src
  ES["Elasticsearch"]:::src
  VBR["Veeam B&R"]:::src
  COH["Cohesity"]:::src

  W1["แถบแจ้ง incident"]
  W2["KPI: Hosts up"]
  W3["KPI: Active problems"]
  W4["Storage capacity"]
  W7["Event log"]
  W5["KPI: Probe latency"]
  W6["WAN throughput"]
  W8["Service health"]
  W9["KPI: Log errors · 1h"]
  W10["Backup jobs"]

  ZBX --> W1
  ZBX --> W2
  ZBX --> W3
  ZBX --> W4
  ZBX --> W7
  ES --> W7
  ES --> W9
  PROM --> W5
  PROM --> W6
  PROM --> W8
  VBR --> W10
  COH --> W10

  classDef src fill:#e8f5ec,stroke:#2f8f57,color:#123
```

---

## 3. ลำดับการดึงข้อมูลเมื่อเปิดหน้า

```mermaid
sequenceDiagram
  autonumber
  participant B as เบราว์เซอร์
  participant N as ITDash server
  participant C as Cache
  participant Z as Zabbix API

  B->>N: GET /
  N-->>B: โครงหน้า + skeleton ของทุกการ์ด (ทันที)
  N->>C: zabbixProblems()
  alt ข้อมูลใน cache ยังสด (< 30 วินาที)
    C-->>N: ส่งค่าเดิม
  else หมดอายุ
    N->>Z: problem.get + event.get (Bearer token)
    Z-->>N: JSON
    N->>N: แปลงเป็น Problem[]
    N->>C: เก็บผลลัพธ์ (ถ้า error เก็บแค่ 15 วินาที)
  end
  N-->>B: stream การ์ดที่พร้อมแล้วเข้าไปแทน skeleton
  loop ทุก 60 วินาที (เฉพาะตอนแท็บเปิดอยู่)
    B->>N: router.refresh()
  end
```

การ์ด 3 ใบที่ใช้ `problem.get` (แถบ incident, KPI, Event log) ใช้ผลลัพธ์ cache เดียวกัน — Zabbix ถูกเรียกครั้งเดียว

---

## 4. สถานะของการ์ด

```mermaid
flowchart LR
  A{"DATA_SOURCE"} -- "mock" --> S["sample<br/>ข้อมูลตัวอย่าง"]
  A -- "live" --> B{"ตั้งค่า URL/token<br/>ของระบบนี้แล้ว?"}
  B -- "ยัง" --> S
  B -- "แล้ว" --> C{"เรียก API สำเร็จ?"}
  C -- "สำเร็จ" --> L["live<br/>● zabbix"]
  C -- "บางระบบ" --> P["partial<br/>● veeam + cohesity · partial"]
  C -- "ล้มเหลว" --> E["error<br/>แสดงสาเหตุ · ลองใหม่ใน 15 วิ"]
```

---

## 5. การวางเครื่องในเครือข่าย

```mermaid
flowchart TB
  subgraph UV["VLAN ผู้ใช้ / VPN"]
    IT["เจ้าหน้าที่ไอที"]
  end

  FW{{"Firewall<br/>อนุญาตเฉพาะกลุ่ม IT → 443"}}

  subgraph MG["VLAN Management"]
    RP["Reverse proxy<br/>nginx / Caddy · TLS"]
    DASH["ITDash<br/>Node.js หรือ Docker :3000"]
    ZBX["Zabbix :443"]
    PROM["Prometheus :9090"]
    ES["Elasticsearch :9200"]
    VBR["Veeam B&R :9419"]
    COH["Cohesity :443"]
  end

  IT -- "HTTPS" --> FW --> RP --> DASH
  DASH -- "API token (read-only)" --> ZBX
  DASH --> PROM
  DASH -- "API key (read)" --> ES
  DASH -- "Backup Viewer" --> VBR
  DASH -- "API key (Viewer)" --> COH
```

- ITDash เปิดเฉพาะภายใน ไม่ต้องเปิดออกอินเทอร์เน็ต
- ขาออกจาก ITDash ไปแต่ละระบบใช้บัญชีที่**อ่านได้อย่างเดียว**
- Veeam / Cohesity มักใช้ใบรับรอง self-signed — ตั้ง `NODE_EXTRA_CA_CERTS` แทนการปิดการตรวจ TLS

---

## 6. โครงโค้ดฝั่งข้อมูล

```mermaid
flowchart LR
  P1["src/app/(dashboard)/page.tsx<br/>โครงหน้า + Suspense"]
  CARDS["components/dashboard/<br/>overview-cards.tsx"]
  IDX["src/lib/data/index.ts<br/>loadX() ต่อการ์ด"]
  MOCK["src/lib/data/mock.ts"]
  SRC["src/lib/sources/<br/>zabbix · prometheus · elasticsearch<br/>veeam · cohesity"]
  ENV[".env.local"]
  T["src/lib/data/types.ts"]

  P1 --> CARDS --> IDX
  IDX -- "sample" --> MOCK
  IDX -- "live" --> SRC
  ENV -. "อ่านค่าตอน request" .-> SRC
  MOCK -- "คืนค่าเป็น" --> T
  SRC -- "คืนค่าเป็น" --> T
```

วิธีตั้งค่าแต่ละระบบอยู่ใน [INTEGRATIONS.md](./INTEGRATIONS.md)
