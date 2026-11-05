# สถาปัตยกรรม ITDash

เอกสารนี้อธิบายว่าข้อมูลไหลจากระบบต่างๆ ในองค์กรมาถึงหน้า dashboard อย่างไร
(ไดอะแกรมเขียนด้วย Mermaid — GitHub แสดงเป็นรูปให้อัตโนมัติ)

แนวคิดหลักมี 3 ข้อ

1. **ดึงข้อมูลฝั่ง server เท่านั้น** — token / รหัสผ่านของแต่ละระบบอยู่บน server ของ ITDash ไม่หลุดไปถึงเบราว์เซอร์
2. **หนึ่งระบบต้นทาง = หนึ่ง adapter** — adapter แปลงข้อมูลให้อยู่ในรูป type กลาง (`src/lib/data`) หน้าจอจึงไม่ต้องรู้ว่าข้อมูลมาจาก Zabbix หรือ PRTG
3. **cache ตามความสดที่ต้องการ** — สถานะบริการ 30 วินาที, ticket 1 นาที, backup 5–15 นาที, storage รายชั่วโมง ลดภาระของระบบต้นทาง

---

## 1. ภาพรวมระบบ

```mermaid
flowchart LR
  ZBX["Zabbix / LibreNMS<br/>network · servers · storage"]
  KUMA["Uptime Kuma<br/>service checks"]
  GLPI["GLPI<br/>tickets · assets"]
  VEEAM["Veeam B&R<br/>backup jobs"]
  LOGS["Graylog / Wazuh<br/>syslog · security"]

  subgraph APP["ITDash · Next.js server"]
    direction TB
    ADP["adapters<br/>src/lib/sources/*"]
    TYP["แปลงเป็น type กลาง<br/>src/lib/data/types.ts"]
    CCH["cache<br/>'use cache' + cacheLife"]
    UI["Server Components<br/>Overview, Tickets, ..."]
    ADP --> TYP --> CCH --> UI
  end

  IDP["Active Directory /<br/>Microsoft Entra ID"]
  BR["เบราว์เซอร์<br/>ทีมไอที"]

  ZBX -- "JSON-RPC" --> ADP
  KUMA -- "HTTP JSON" --> ADP
  GLPI -- "REST (OAuth)" --> ADP
  VEEAM -- "REST :9419" --> ADP
  LOGS -- "Search API" --> ADP
  IDP -- "SSO: OIDC / LDAPS" --> APP
  UI -- "HTML ที่ render แล้ว" --> BR
```

---

## 2. การ์ดแต่ละใบดึงข้อมูลจากไหน

```mermaid
flowchart LR
  ZBX["Zabbix"]:::src
  KUMA["Uptime Kuma"]:::src
  GLPI["GLPI"]:::src
  VEEAM["Veeam B&R"]:::src
  LOGS["Graylog / Wazuh"]:::src

  W1["แถบแจ้ง incident"]
  W3["WAN throughput"]
  W4["Storage capacity"]
  W7["Event log"]
  W2["KPI: Services up"]
  W5["Service health matrix"]
  W6["Ticket queue + KPI tickets"]
  W8["Backup jobs + KPI backups"]

  ZBX --> W1
  ZBX --> W3
  ZBX --> W4
  ZBX --> W7
  LOGS --> W7
  KUMA --> W2
  KUMA --> W5
  GLPI --> W6
  VEEAM --> W8
  VEEAM -. "repository usage" .-> W4

  classDef src fill:#e8f5ec,stroke:#2f8f57,color:#123
```

> ถ้ายังไม่มี Uptime Kuma ใช้ Zabbix Web scenario หรือ trigger ของแต่ละ host แทนได้ — การ์ด Service health เปลี่ยนแค่ adapter

---

## 3. ลำดับการดึงข้อมูลเมื่อเปิดหน้า

```mermaid
sequenceDiagram
  autonumber
  participant B as เบราว์เซอร์
  participant N as ITDash server
  participant C as Cache
  participant Z as Zabbix API

  B->>N: GET /  (มี session SSO)
  N->>C: getActiveProblems()
  alt ข้อมูลใน cache ยังสด
    C-->>N: ส่งค่าเดิมทันที
  else หมดอายุแล้ว
    N->>Z: problem.get  (Authorization: Bearer token)
    Z-->>N: JSON
    N->>N: แปลงเป็น LogLine[]
    N->>C: เก็บผลลัพธ์
  end
  N-->>B: HTML (การ์ดที่ช้าจะ stream ตามมาทีหลัง)
  loop ทุก 60 วินาที
    B->>N: router.refresh()  ดึงเฉพาะส่วนที่เปลี่ยน
  end
```

ถ้าระบบต้นทางตัวใดล่ม การ์ดใบนั้นแสดง "source unreachable" ส่วนการ์ดอื่นยังทำงานปกติ
(ห่อแต่ละการ์ดด้วย `<Suspense>` + error boundary แยกกัน)

---

## 4. การวางเครื่องในเครือข่าย

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
    GLPI["GLPI :443"]
    VEEAM["Veeam B&R :9419"]
    KUMA["Uptime Kuma :3001"]
  end

  DC["Domain Controller<br/>LDAPS :636"]

  IT -- "HTTPS" --> FW --> RP --> DASH
  DASH -- "บัญชี read-only" --> ZBX
  DASH -- "OAuth client" --> GLPI
  DASH -- "บัญชี Viewer" --> VEEAM
  DASH --> KUMA
  DASH -- "ตรวจสิทธิ์ผู้ใช้" --> DC
```

- ITDash เปิดเฉพาะภายใน ไม่ต้องเปิดออกอินเทอร์เน็ต
- ทุกการเชื่อมต่อขาออกจาก ITDash เป็น HTTPS และใช้บัญชีที่**อ่านได้อย่างเดียว**
- ถ้าระบบภายในใช้ใบรับรองจาก CA ขององค์กร ให้ตั้ง `NODE_EXTRA_CA_CERTS=/path/to/org-ca.pem` แทนการปิดการตรวจ TLS

---

## 5. โครงโค้ดฝั่งข้อมูล (เป้าหมาย)

```mermaid
flowchart LR
  P1["src/app/(dashboard)/page.tsx<br/>หน้า Overview"]
  IDX["src/lib/data/index.ts<br/>getOverview()"]
  MOCK["src/lib/data/mock.ts<br/>ข้อมูลตัวอย่าง (ใช้ตอน dev)"]
  SRC["src/lib/sources/<br/>zabbix.ts · glpi.ts<br/>veeam.ts · uptime-kuma.ts"]
  ENV[".env.local<br/>URL + token"]
  T["src/lib/data/types.ts<br/>ServiceRow · LogLine · BackupJob ..."]

  P1 --> IDX
  IDX -- "DATA_SOURCE=mock" --> MOCK
  IDX -- "DATA_SOURCE=live" --> SRC
  ENV -. "อ่านค่า" .-> SRC
  MOCK -- "คืนค่าเป็น" --> T
  SRC -- "คืนค่าเป็น" --> T
```

สลับระหว่างข้อมูลจำลองกับข้อมูลจริงด้วยตัวแปร `DATA_SOURCE` — ทำให้พัฒนาหน้าจอต่อได้แม้ยังไม่ได้สิทธิ์เข้าระบบจริง

วิธีต่อแต่ละระบบอยู่ใน [INTEGRATIONS.md](./INTEGRATIONS.md)
