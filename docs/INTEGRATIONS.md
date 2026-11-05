# การเชื่อมต่อแหล่งข้อมูล

ITDash มี adapter สำหรับ **Zabbix, Prometheus, Elasticsearch, Veeam B&R และ Cohesity** อยู่แล้ว
ตั้งค่าใน `.env.local` (ดูตัวอย่างใน [`.env.example`](../.env.example)) แล้วตั้ง `DATA_SOURCE=live` — ไม่ต้องแก้โค้ด

ภาพรวมสถาปัตยกรรมดูที่ [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## สรุป: การ์ด → ระบบ

| การ์ด | ระบบ | ข้อมูลที่ใช้ | cache |
| --- | --- | --- | --- |
| แถบแจ้ง incident | Zabbix | problem ที่ severity High / Disaster | 30 วินาที |
| KPI Hosts up | Zabbix | `host.get` + สถานะ interface | 30 วินาที |
| KPI Active problems | Zabbix | `problem.get` (ไม่นับที่ถูก suppress) | 30 วินาที |
| KPI Probe latency | Prometheus | `PROM_Q_LATENCY` ย้อนหลัง 2 ชม. | 30 วินาที |
| KPI Log errors · 1h | Elasticsearch | นับ log ระดับ error ขึ้นไป เทียบชั่วโมงก่อน | 30 วินาที |
| WAN throughput 24h | Prometheus | `PROM_Q_WAN_IN` / `PROM_Q_WAN_OUT` เฉลี่ยรายชั่วโมง | 5 นาที |
| Storage capacity | Zabbix | item `vfs.fs.size` / `vfs.fs.dependent.size` (used, total) | 15 นาที |
| Service health | Prometheus | `PROM_Q_PROBE` (blackbox `probe_success`) 3 ชม. + uptime 30 วัน | 30 วินาที |
| Event log | Zabbix + Elasticsearch | problem ที่เปิดอยู่ + log ระดับ warn/error 24 ชม. | 30 วินาที |
| Backup jobs | Veeam + Cohesity | สถานะรันล่าสุดของแต่ละ job / protection group | 5 นาที |
| Ticket queue | — | ยังไม่มีระบบ ticket (แสดงข้อมูลตัวอย่าง) | — |

**ป้ายมุมขวาของการ์ด** บอกสถานะข้อมูล
`● zabbix` = ข้อมูลจริง · `sample` = ข้อมูลตัวอย่าง · `● zabbix down` = ดึงไม่ได้ (เอาเมาส์ชี้เพื่อดูสาเหตุ) ·
`● veeam + cohesity · partial` = ได้มาบางระบบ

> ถ้าระบบล่ม การ์ดจะแสดง error พร้อมสาเหตุ **ไม่แสดงข้อมูลตัวอย่างแทน** — หน้าจอ ops ต้องไม่โชว์ตัวเลขปลอมที่ดูเหมือนจริง
> และจะลองใหม่ทุก 15 วินาที

---

## 1. Zabbix

**เตรียมฝั่ง Zabbix (6.4 / 7.x)**
1. *Users → User roles* → สร้าง role `itdash-api` เปิด *Access to API* และจำกัด *API methods* ให้เหลือ
   `host.get`, `problem.get`, `event.get`, `item.get`
2. สร้าง user `svc-itdash` ใช้ role นี้ ให้สิทธิ์ **read** กับ host group ที่ต้องการแสดง
3. *Users → API tokens* → สร้าง token ให้ `svc-itdash` (ตั้งวันหมดอายุ) → ใส่ใน `ZABBIX_TOKEN`

**หมายเหตุ**
- ส่ง token ใน header `Authorization: Bearer` (Zabbix 7.2+ เลิกใช้ field `auth` แล้ว)
- ถ้าหน้าเว็บ Zabbix อยู่หลัง Apache ที่เปิด Kerberos/SSO ต้องยกเว้น `api_jsonrpc.php` ไม่อย่างนั้น header จะถูกแทนที่
- การ์ด Storage อ่าน item `used` + `total` ของ template OS มาตรฐาน (Linux/Windows by Zabbix agent)
  แสดงเฉพาะ filesystem ≥ `ZABBIX_STORAGE_MIN_TB` เรียงจากเต็มมากสุด
- **log file บนเครื่องที่มี Zabbix agent** ทำ item `log[]` / `logrt[]` + trigger ได้ — problem จะขึ้นในแถบ incident และ Event log เอง

---

## 2. Prometheus

**เตรียม:** บัญชีไม่จำเป็นถ้า Prometheus เปิดภายใน ถ้ามี reverse proxy ทำ auth ให้ใส่ `PROM_TOKEN` หรือ `PROM_USER`/`PROM_PASSWORD`

**PromQL** — ค่าเริ่มต้นเป็นของ node_exporter + blackbox_exporter แก้ให้ตรงกับ exporter ที่ใช้จริง:

| ตัวแปร | ต้องคืนค่า | ตัวอย่าง |
| --- | --- | --- |
| `PROM_Q_WAN_IN` / `PROM_Q_WAN_OUT` | series เดียว หน่วย Mbps | **SNMP exporter (if_mib):** `sum(rate(ifHCInOctets{instance="core-sw-01",ifName="xe-0/0/0"}[5m])) * 8 / 1e6`<br>**node_exporter (ค่าเริ่มต้น):** `sum(rate(node_network_receive_bytes_total{device!~"lo\|veth.*"}[5m])) * 8 / 1e6`<br>**windows_exporter:** `sum(rate(windows_net_bytes_received_total[5m])) * 8 / 1e6` |
| `PROM_Q_PROBE` | หลาย series ค่า 0/1 — หนึ่ง series ต่อหนึ่งบริการ | `probe_success{job="blackbox-http"}` |
| `PROM_Q_LATENCY` | series เดียว หน่วย ms | `avg(probe_duration_seconds{job="blackbox-http"}) * 1000` |
| `PROM_PROBE_NAME_LABEL` | ชื่อ label ที่ใช้เป็นชื่อบริการ | `instance` (ค่าเริ่มต้น) หรือ label ที่ตั้งเองเช่น `service` |

ทดสอบ query ในหน้า Prometheus (*Graph*) ก่อนใส่ ถ้าได้ผลลัพธ์ตามคอลัมน์ "ต้องคืนค่า" ก็ใช้ได้

> แนะนำให้ติด label `service="e-Office"` ใน `scrape_configs` ของ blackbox แล้วตั้ง `PROM_PROBE_NAME_LABEL=service`
> จะได้ชื่อบริการภาษาคนแทน URL

---

## 3. Elasticsearch

**เตรียมฝั่ง Elastic**
1. สร้าง role `itdash-read` สิทธิ์ `read` + `view_index_metadata` บน index pattern ของ log (เช่น `logs-*`)
2. สร้าง API key ผูกกับ role นี้ (*Stack Management → API keys*) → ใส่ค่า **encoded** ใน `ES_API_KEY`

**field ที่ใช้** — ค่าเริ่มต้นตาม ECS (Filebeat, Elastic Agent, Winlogbeat ใช้ชื่อนี้อยู่แล้ว):
`@timestamp`, `log.level`, `message`, `host.name` — ถ้า index ของคุณใช้ชื่ออื่นให้ตั้ง `ES_*_FIELD`

ระดับ log ที่นับเป็น error: `error, err, crit, critical, fatal, alert, emerg` (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
ปรับได้ด้วย `ES_ERROR_LEVELS` และ `ES_LOG_LEVELS` · ตัด log ที่ไม่สนใจด้วย `ES_FILTER` (Lucene query)

### log file ต่างๆ → Elasticsearch

แนะนำให้ส่ง log ทุกชนิดเข้า Elasticsearch ก่อน แล้ว ITDash อ่านจากที่เดียว
(ไม่ให้ dashboard ไปอ่านไฟล์บนเครื่องต่างๆ เอง — ปลอดภัยกว่า และค้นย้อนหลังได้)

| แหล่ง log | เครื่องมือส่ง | หมายเหตุ |
| --- | --- | --- |
| log ไฟล์ของแอป (`/var/log/app/*.log`) | Filebeat `filestream` หรือ Elastic Agent *Custom Logs* | ถ้าไฟล์ไม่มี field level ให้แยกด้วย `dissect`/`grok` ใน ingest pipeline แล้วเขียนลง `log.level` |
| Windows Event Log | Winlogbeat หรือ Elastic Agent *Windows* integration | ได้ `log.level` มาให้แล้ว |
| syslog จาก switch / firewall | Elastic Agent *Syslog* / Logstash `syslog` input | map severity → `log.level` |
| log ที่ขึ้นหลายบรรทัด (stack trace) | ตั้ง `multiline` ใน Filebeat | ITDash แสดงเฉพาะบรรทัดแรก |

ขั้นตอนเต็ม (สำรวจ log → ส่ง → แยก field → ตรวจ → ตั้งค่า) และกรณี log ที่ไม่มีระดับ ดู [LOGS.md](./LOGS.md) — ITDash เลือก log ด้วย `log.level` เสมอ ใส่แค่ `ES_FILTER` อย่างเดียวจะไม่ขึ้น

---

## 4. Veeam Backup & Replication

1. สร้าง local/AD account (เช่น `svc-itdash`) แล้วกำหนด role **Veeam Backup Viewer** บน B&R server
2. ตั้ง `VEEAM_URL=https://<vbr>:9419`, `VEEAM_USERNAME`, `VEEAM_PASSWORD`
3. ตั้ง `VEEAM_API_VERSION` ให้ตรงกับเวอร์ชันของ B&R — ถ้าไม่ตรง request จะล้มเหลว
   (เช่น `1.3-rev1` สำหรับ v13.0.1) ดูค่าที่รองรับได้ที่ `https://<vbr>:9419/swagger/ui/index.html`
4. B&R ใช้ใบรับรอง self-signed เป็นค่าเริ่มต้น — export ใบรับรองแล้วตั้ง `NODE_EXTRA_CA_CERTS` **ใน environment ของ service** (ไม่ใช่ `.env.local` — Node อ่านค่านี้ก่อนโหลดไฟล์นั้น) อย่าปิดการตรวจ TLS

ITDash เรียก `POST /api/oauth2/token` → `GET /api/v1/jobs/states` (สถานะ/ผลล่าสุด) และ `GET /api/v1/sessions` (คำนวณระยะเวลา)
job ที่ disabled จะไม่แสดง · job บางประเภท (เช่น Proxmox) อาจไม่มี `lastRun` จะแสดงเป็น "never"

---

## 5. Cohesity

1. สร้าง user ที่มี role แบบ view-only (เช่น *Viewer*) บน cluster
2. สร้าง **API key** ให้ user นี้ (*Settings → Access Management → API Keys*) → ใส่ `COHESITY_API_KEY`
   (ถ้าไม่ใช้ API key ใส่ `COHESITY_USERNAME`/`COHESITY_PASSWORD`/`COHESITY_DOMAIN` แทน)
3. `COHESITY_URL` = VIP ของ cluster

ITDash เรียก `GET /v2/data-protect/protection-groups?isDeleted=false&isActive=true&includeLastRunInfo=true`
แล้วอ่าน `lastRun.localBackupInfo` (status, เวลาเริ่ม/จบ, `localSnapshotStats.bytesWritten`)
protection group ที่ pause อยู่จะไม่แสดง

> ถ้าใช้ **Cohesity Helios (SaaS)** แทน cluster ตรง ต้องเพิ่ม header `accessClusterId` — แจ้งได้ จะเพิ่มให้
> ถ้า field ไหนว่าง ตรวจชื่อ field กับ API Explorer ของ cluster (เวอร์ชันต่างกันเล็กน้อย)

---

## ทดสอบโดยยังไม่มีระบบจริง

มี server จำลองของทั้ง 5 ระบบไว้ทดสอบ/พัฒนาหน้าจอ (`scripts/fake-sources.mjs`):

```bash
npm run fake-sources   # terminal 1 — เปิด port 4101–4105
npm run dev:fake       # terminal 2 — ITDash ที่ชี้ไปยัง server จำลอง (.env.fake)
```

ลองแก้ค่าใน `.env.fake` ให้ผิด (เช่น token) เพื่อดูหน้าจอตอนระบบล่มได้

## ทดสอบหลังตั้งค่า

```bash
npm run build && npm start      # หรือ npm run dev
```

เปิดหน้า Overview แล้วดูป้ายมุมขวาของแต่ละการ์ด — ถ้าขึ้น `down` ให้ชี้เมาส์ดูสาเหตุ หรือดูใน log ของ server
(ทุกข้อผิดพลาดขึ้นต้นด้วย `[itdash]`) ข้อความที่พบบ่อย:

| ข้อความ | สาเหตุ |
| --- | --- |
| `zabbix: host.get: Not authorized.` | token ผิด/หมดอายุ หรือ role ไม่ได้อนุญาต method นั้น |
| `cannot reach … (ECONNREFUSED)` | URL/port ผิด หรือ firewall ปิด |
| `cannot reach … (self-signed certificate)` | ต้องตั้ง `NODE_EXTRA_CA_CERTS` ใน environment ของ service (systemd `Environment=`) ไม่ใช่ใน `.env.local` |
| `veeam: HTTP 400` | `VEEAM_API_VERSION` ไม่ตรงกับเวอร์ชัน B&R |
| `elasticsearch: HTTP 403` | API key ไม่มีสิทธิ์ read บน `ES_INDEX` |
| การ์ด Service health ว่าง | `PROM_Q_PROBE` ไม่คืน series — ลองใน Prometheus ก่อน |

---

## Checklist ความปลอดภัย

- [ ] ทุกบัญชีที่ ITDash ใช้เป็น **read-only** และใช้กับ ITDash อย่างเดียว
- [ ] เก็บค่าลับใน `.env.local` บน server เท่านั้น ห้ามใช้ prefix `NEXT_PUBLIC_`
- [ ] HTTPS ทุกเส้นทาง ใบรับรองภายในใช้ `NODE_EXTRA_CA_CERTS` (ตั้งใน service ไม่ใช่ `.env.local`) — ห้ามตั้ง `NODE_TLS_REJECT_UNAUTHORIZED=0`
- [ ] dashboard เปิดเฉพาะเครือข่ายภายใน/VPN และบังคับล็อกอิน (SSO — ยังไม่ได้ทำ)
- [ ] ตั้งรอบหมุนเวียน token / API key / รหัสผ่าน (เช่น ทุก 90 วัน)
