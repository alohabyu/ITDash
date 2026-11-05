# การเชื่อมต่อแหล่งข้อมูล

คู่มือนี้บอกว่าการ์ดแต่ละใบบน ITDash ควรดึงข้อมูลจากระบบไหน ผ่าน API อะไร
และต้องเตรียมอะไรฝั่งระบบต้นทาง ดูภาพรวมสถาปัตยกรรมได้ที่ [ARCHITECTURE.md](./ARCHITECTURE.md)

> ชื่อระบบในเอกสารนี้เป็นตัวที่หน่วยงานไทยใช้กันบ่อย ถ้าใช้ตัวอื่น (PRTG, LibreNMS, osTicket, Proxmox Backup ฯลฯ)
> โครงเหมือนเดิมทุกอย่าง — เขียน adapter ใหม่ให้คืนค่าเป็น type เดิม

---

## สรุป: การ์ด → ระบบ → API

| การ์ด | ระบบที่แนะนำ | API / method | ความสด (cache) |
| --- | --- | --- | --- |
| แถบแจ้ง incident | Zabbix | `problem.get` (severity ≥ High) | 30 วินาที |
| KPI Services up, Service health | Uptime Kuma (หรือ Zabbix web scenario) | status page heartbeat JSON | 30 วินาที |
| WAN throughput 24h | Zabbix (SNMP interface items) | `history.get` / `trend.get` | 5 นาที |
| Storage capacity | Zabbix `vfs.fs.size`, vCenter, Veeam repositories | `item.get` / `GET /api/vcenter/datastore` | 1 ชั่วโมง |
| Ticket queue, KPI tickets | GLPI | `/api.php` (v2) หรือ `/apirest.php` (v1) | 1 นาที |
| Backup jobs, KPI backups | Veeam B&R | `GET /api/v1/jobs/states` | 5–15 นาที |
| Event log | Zabbix + Graylog / Wazuh | `event.get` + search API | 30 วินาที |
| ผู้ใช้ / สิทธิ์เข้า dashboard | Active Directory หรือ Entra ID | LDAPS / OIDC (Auth.js) | — |

**ลำดับที่แนะนำ:** เริ่มจาก **Zabbix** ก่อน เพราะตัวเดียวครอบคลุมได้ 4–5 การ์ด
แล้วตามด้วย GLPI → Veeam → SSO → log/security

---

## 1. Zabbix — network, servers, storage, incidents

**เตรียมฝั่ง Zabbix**
1. สร้าง User role ชื่อ `api-readonly` → เปิด *Access to API* และจำกัด *API methods* ให้เหลือเฉพาะ `*.get`
2. สร้าง user `itdash` ใช้ role นี้ ให้สิทธิ์อ่าน host group ที่ต้องการแสดง
3. *Users → API tokens* → สร้าง token ให้ `itdash`

**เรียก API**
- Endpoint: `POST https://<zabbix>/api_jsonrpc.php`
- ส่ง token ใน header `Authorization: Bearer <token>`
  (Zabbix 7.2 ขึ้นไปเลิกใช้ field `auth` ใน body แล้ว)
- ถ้า Zabbix อยู่หลัง Apache ที่เปิด Kerberos/SSO ทั้งเว็บ ต้องยกเว้น `api_jsonrpc.php`
  ไม่อย่างนั้น header Bearer จะถูกแทนที่และเรียกไม่ผ่าน

**method ที่ใช้**

| ต้องการ | method | หมายเหตุ |
| --- | --- | --- |
| ปัญหาที่ยังเปิดอยู่ | `problem.get` | `recent: true`, `sortfield: "eventid"`, กรอง `severities: [4,5]` สำหรับแถบ incident |
| สถานะ host | `host.get` | `selectInterfaces`, ดู `available` |
| traffic ของ uplink | `item.get` หา itemid ของ `net.if.in[...]`/`net.if.out[...]` แล้ว `trend.get` (ราย ชม.) | trend เบากว่า history มากสำหรับกราฟ 24 ชม. |
| พื้นที่ดิสก์ | `item.get` key `vfs.fs.size[*,pused]` | ใช้ `lastvalue` ได้เลย |

---

## 2. Uptime Kuma — service health matrix

Uptime Kuma ไม่มี REST API อย่างเป็นทางการ แต่ทุก status page มี JSON endpoint ที่หน้าเว็บของมันเองใช้

1. สร้าง status page (เช่น slug `itdash`) แล้วเพิ่ม monitor ที่ต้องการแสดง
2. อ่าน `GET https://<kuma>/api/status-page/heartbeat/itdash` → ได้ heartbeat ล่าสุดของแต่ละ monitor
   และค่า uptime 24 ชม. — แปลงเป็น `ServiceRow.checks[]` ได้ตรงๆ
3. ถ้าต้องการ metric ละเอียดขึ้น เปิด API key แล้วอ่าน `/metrics` (รูปแบบ Prometheus)

> เพราะไม่ใช่ API ทางการ อาจเปลี่ยนเมื่ออัปเกรดเวอร์ชัน — ให้ล็อกเวอร์ชันและทดสอบหลังอัปเกรด

**ทางเลือก:** ใช้ Zabbix Web scenario (HTTP check) แทน แล้วอ่านด้วย `history.get` ของ item `web.test.fail[...]`

---

## 3. GLPI — tickets และ assets

**GLPI 11 (API v2)**
1. *Setup → OAuth clients* → สร้าง client ให้ ITDash เลือก grant type **Client credentials** และ scope `api`
2. ขอ token: `POST https://<glpi>/api.php/token` (`grant_type=client_credentials`, client id/secret, `scope=api`)
   — token อายุ 1 ชั่วโมง ให้ adapter ขอใหม่อัตโนมัติเมื่อหมดอายุ
3. อ่าน ticket: `GET https://<glpi>/api.php/Assistance/Ticket` พร้อมเงื่อนไขสถานะที่ยังไม่ปิด
   ดู parameter ที่รองรับได้ที่หน้า `https://<glpi>/api.php/doc`

**GLPI 10 (API v1)**
- `GET /apirest.php/initSession` ส่ง header `App-Token` และ `Authorization: user_token <token>` → ได้ `Session-Token`
- จากนั้นใช้ `/apirest.php/search/Ticket` กรองสถานะ และอ่าน `time_to_resolve` เพื่อนับงานที่เกิน SLA

**ใช้กับการ์ด:** จัดกลุ่มตาม `itilcategories_id` → Ticket queue,
เทียบ `time_to_resolve` กับเวลาปัจจุบัน → จำนวน "breaching SLA"

---

## 4. Veeam Backup & Replication — backup jobs

1. สร้าง local/AD account แล้วกำหนด role **Veeam Backup Viewer** บน B&R server
2. ขอ token: `POST https://<vbr>:9419/api/oauth2/token` แบบ form
   (`grant_type=password`, `username`, `password`)
3. ทุก request ต้องมี header `x-api-version` ให้ตรงกับเวอร์ชันของ B&R
   (เช่น `1.3-rev1` สำหรับ v13.0.1) — ถ้าไม่ส่ง request จะล้มเหลว
4. อ่านข้อมูล:
   - `GET /api/v1/jobs/states` → สถานะ, เวลา run ล่าสุด, ผลลัพธ์ของแต่ละ job
   - `GET /api/v1/sessions` → ประวัติย้อนหลัง ใช้คำนวณ "success rate 7 วัน"
   - `GET /api/v1/backupInfrastructure/repositories/states` → พื้นที่ repository (ใส่การ์ด Storage)

> path และ parameter ต่างกันเล็กน้อยตามเวอร์ชัน ตรวจได้ที่ Swagger บนเครื่อง B&R:
> `https://<vbr>:9419/swagger/ui/index.html`

---

## 5. Log และ security — event log

| ระบบ | วิธีอ่าน |
| --- | --- |
| Zabbix | `event.get` ล่าสุด 20 รายการ (ได้ทันทีจากข้อ 1) |
| Graylog | REST API ที่ `/api` ใช้ access token ของ user read-only; ดู endpoint ค้นหาของเวอร์ชันที่ใช้ใน API browser (`/api/api-browser`) |
| Wazuh | ค้นใน index `wazuh-alerts-*` ของ Wazuh Indexer (OpenSearch `:9200/_search`) กรอง `rule.level >= 10` |

รวมทุกแหล่งเป็น `LogLine[]` เดียว เรียงตามเวลา แล้วตัดเหลือ 20 บรรทัด

---

## 6. ล็อกอินเข้า dashboard (SSO)

- **Microsoft 365 / Entra ID:** ใช้ [Auth.js](https://authjs.dev) provider *Microsoft Entra ID*
  แล้วจำกัดเฉพาะสมาชิก group `IT-Staff`
- **AD ภายในอย่างเดียว:** ใช้ Auth.js *Credentials* provider ตรวจรหัสผ่านกับ AD ผ่าน LDAPS (`ldapts`)
- ไม่ว่าแบบไหน ให้ dashboard เปิดเฉพาะเครือข่ายภายใน/VPN ด้วย

---

## รูปแบบโค้ด adapter

ตัวอย่าง adapter ของ Zabbix — ทุกระบบใช้โครงเดียวกัน

```ts
// src/lib/sources/zabbix.ts
import "server-only"; // npm i server-only — กันไม่ให้ไฟล์นี้หลุดไปฝั่งเบราว์เซอร์
import { cacheLife } from "next/cache";
import type { LogLine } from "@/lib/data/overview";

async function zabbix<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${process.env.ZABBIX_URL}/api_jsonrpc.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json-rpc",
      Authorization: `Bearer ${process.env.ZABBIX_TOKEN}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  if (!res.ok) throw new Error(`Zabbix HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Zabbix ${method}: ${json.error.data}`);
  return json.result as T;
}

type ZbxProblem = { eventid: string; name: string; severity: string; clock: string };

export async function getActiveProblems(): Promise<LogLine[]> {
  "use cache";
  cacheLife("live"); // โปรไฟล์ 30 วินาที (ตั้งใน next.config.ts ด้านล่าง)

  const problems = await zabbix<ZbxProblem[]>("problem.get", {
    output: ["eventid", "name", "severity", "clock"],
    recent: true,
    sortfield: ["eventid"],
    sortorder: "DESC",
    limit: 20,
  });

  return problems.map((p) => ({
    ts: new Date(Number(p.clock) * 1000).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }),
    level: Number(p.severity) >= 4 ? "CRIT" : "WARN",
    source: "zabbix",
    message: p.name,
  }));
}
```

โปรไฟล์ cache ที่ใช้ร่วมกันทั้งโปรเจกต์:

```ts
// next.config.ts  (เพิ่มใน nextConfig)
cacheLife: {
  live:   { stale: 30,  revalidate: 30,   expire: 300 },   // สถานะบริการ, incident, log
  queue:  { stale: 60,  revalidate: 60,   expire: 600 },   // ticket
  ops:    { stale: 300, revalidate: 600,  expire: 3600 },  // backup, traffic
  slow:   { stale: 300, revalidate: 3600, expire: 86400 }, // storage, assets
},
```

ให้หน้าจอรีเฟรชเองทุก 60 วินาที (วาง `<AutoRefresh />` ไว้ใน layout):

```tsx
// src/components/auto-refresh.tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
```

ถ้าระบบต้นทางตัวไหนล่ม อย่าให้ทั้งหน้าพัง — เรียกทุกแหล่งด้วย `Promise.allSettled`
หรือแยกแต่ละการ์ดเป็น async component ห่อด้วย `<Suspense>` ของตัวเอง

---

## Checklist ความปลอดภัย

- [ ] ทุกบัญชีที่ ITDash ใช้เป็น **read-only** และใช้กับ ITDash อย่างเดียว
- [ ] เก็บ URL/token ใน `.env.local` บน server (ไฟล์นี้ไม่ถูก commit — ดูตัวอย่างใน `.env.example`)
- [ ] ห้ามใช้ prefix `NEXT_PUBLIC_` กับค่าลับ เพราะจะถูกฝังไปในโค้ดฝั่งเบราว์เซอร์
- [ ] ใช้ HTTPS ทุกเส้นทาง ถ้าเป็นใบรับรองของ CA องค์กรให้ตั้ง `NODE_EXTRA_CA_CERTS` — ห้ามปิดการตรวจ TLS
- [ ] dashboard เปิดเฉพาะเครือข่ายภายใน/VPN และบังคับล็อกอินด้วย SSO
- [ ] ตั้งรอบหมุนเวียน token (เช่น ทุก 90 วัน) และใส่วันหมดอายุตอนสร้าง token ใน Zabbix
