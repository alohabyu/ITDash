# ขั้นตอนการติดตั้ง ITDash

คู่มือนี้ติดตั้งบน **Mac mini (macOS, Apple Silicon)** — มี 2 ทาง เลือกทางเดียว

| ทาง | เหมาะกับ | ข้อดี |
| --- | --- | --- |
| **A. Docker** (แนะนำ) | ใช้งานจริง | ติดตั้ง/อัปเดต/ถอดง่าย, restart เองเมื่อพัง, ย้ายไป Linux server ได้ทันที |
| **B. Node.js โดยตรง** | เครื่องที่ลง Docker ไม่ได้ หรือใช้พัฒนาต่อ | ไม่ต้องลง Docker Desktop, ใช้หน่วยความจำน้อยกว่า |

ก่อนเริ่ม ให้ firewall เปิดตาม *ITDash Firewall Policy* และเตรียมบัญชี read-only ของแต่ละระบบตาม [INTEGRATIONS.md](INTEGRATIONS.md) ไว้แล้ว

---

## 0. เตรียมเครื่อง (ทำครั้งเดียว ทั้งสองทาง)

1. **ตั้ง IP คงที่** — *System Settings → Network → (สาย LAN) → Details → TCP/IP* ตั้ง *Manually* หรือให้ทีม network จอง DHCP reservation
2. **กันเครื่องหลับ** — *System Settings → Energy*: เปิด *Prevent automatic sleeping when the display is off* และ *Start up automatically after a power failure*
3. **Git** — เปิด Terminal แล้วรัน `git --version` ถ้ายังไม่มี macOS จะถามให้ติดตั้ง *Command Line Tools* ให้กด Install
4. **สิทธิ์เข้า repo** (repo เป็น private) — เลือกอย่างใดอย่างหนึ่ง
   - GitHub CLI: `brew install gh` แล้ว `gh auth login`
   - หรือสร้าง Personal Access Token (สิทธิ์ `repo` แบบ read) ไว้ใช้แทนรหัสผ่านตอน `git clone`
5. **ดึงโค้ด**

   ```bash
   mkdir -p ~/Apps && cd ~/Apps
   git clone https://github.com/alohabyu/ITDash.git
   cd ITDash
   ```

6. **ตั้งค่า** — คัดลอกไฟล์ตัวอย่างแล้วใส่ URL + token ของแต่ละระบบ (รายละเอียดใน [INTEGRATIONS.md](INTEGRATIONS.md))

   ```bash
   cp .env.example .env.local
   chmod 600 .env.local
   open -e .env.local          # แก้ด้วย TextEdit หรือ editor ที่ถนัด
   ```

   ต้องมี `DATA_SOURCE=live` — ระบบไหนเว้นว่างไว้ การ์ดของระบบนั้นจะแสดงข้อมูลตัวอย่าง

7. **ใบรับรอง** (ถ้า Veeam / Cohesity / ระบบอื่นใช้ใบรับรองภายในหรือ self-signed) — รวมเป็นไฟล์เดียวตามหัวข้อ 7 ของ *คู่มือตั้งค่าการเชื่อมต่อ* แล้ววางไว้ที่

   ```bash
   cp /path/to/ca-bundle.pem certs/ca-bundle.pem
   ```

---

## A. ติดตั้งด้วย Docker (แนะนำ)

### A1. ติดตั้ง Docker Desktop

1. ดาวน์โหลด **Docker Desktop for Mac — Apple Silicon** จาก [docker.com](https://www.docker.com/products/docker-desktop/) แล้วติดตั้ง
2. เปิด Docker Desktop → *Settings*
   - *General*: เปิด **Start Docker Desktop when you sign in to your computer**
   - *Resources*: CPU อย่างน้อย 2, Memory อย่างน้อย 2 GB
3. ตรวจใน Terminal: `docker compose version` ต้องเป็น 2.24 ขึ้นไป (ใช้กับ `compose.scale.yaml`)

> Docker Desktop สำหรับองค์กรขนาดใหญ่ (พนักงาน > 250 คน หรือรายได้ > 10 ล้าน USD) ต้องมี license แบบเสียเงิน — ตรวจเงื่อนไขกับฝ่ายจัดซื้อ
> ทางเลือกที่ไม่ต้องใช้ Docker Desktop: [OrbStack](https://orbstack.dev) หรือ [Colima](https://github.com/abiosoft/colima) ใช้ไฟล์ `compose.yaml` เดิมได้

### A2. Build และรัน

```bash
cd ~/Apps/ITDash
docker compose up -d --build        # ครั้งแรกใช้เวลา 3–5 นาที (ต้องออกเน็ตไป npm registry)
```

### A3. ตรวจผล

```bash
docker compose ps                   # STATUS ต้องเป็น (healthy) — รอ ~30 วินาทีหลังเริ่ม
curl http://localhost:3000/api/health   # {"status":"ok"}
docker compose logs -f itdash       # ข้อผิดพลาดของการเชื่อมต่อขึ้นต้นด้วย [itdash]
```

เปิด <http://localhost:3000> แล้วดูป้ายมุมขวาของทุกการ์ด — ควรเป็นจุดเขียวพร้อมชื่อระบบ (ยกเว้น Ticket queue)
ถ้าขึ้น `down` ให้ชี้เมาส์ดูสาเหตุ แล้วเทียบกับตารางแก้ปัญหาใน [INTEGRATIONS.md](INTEGRATIONS.md)

### A4. เปิดเองหลังรีบูต

- `compose.yaml` ตั้ง `restart: unless-stopped` ไว้แล้ว — container จะขึ้นเองเมื่อ Docker Desktop เริ่ม
- Docker Desktop เริ่มเมื่อ **มีผู้ใช้ล็อกอิน** เท่านั้น ถ้า Mac mini ไม่มีคนนั่งหน้าเครื่อง ให้เปิด
  *System Settings → Users & Groups → Automatically log in as* เป็นบัญชีที่รัน ITDash (ปรึกษาฝ่ายความปลอดภัยก่อน)
  หรือใช้ทาง B ซึ่งเริ่มได้โดยไม่ต้องล็อกอิน (LaunchDaemon)

### A5. คำสั่งที่ใช้บ่อย

| ต้องการ | คำสั่ง |
| --- | --- |
| แก้ `.env.local` แล้วให้มีผล | `docker compose up -d` |
| อัปเดตเป็นเวอร์ชันล่าสุด | `git pull && docker compose up -d --build` |
| หยุด / เริ่ม | `docker compose stop` / `docker compose start` |
| ดู log | `docker compose logs -f --tail 100 itdash` |
| ถอดออก | `docker compose down` (ไม่ลบ `.env.local`) |
| ลบ image เก่าที่ค้าง | `docker image prune` |

---

## B. ติดตั้งด้วย Node.js โดยตรง

### B1. ติดตั้ง Node.js 22 LTS

ต้องใช้ Node.js **20.9 ขึ้นไป** — แนะนำ 22 LTS ผ่าน nvm

```bash
# ถ้ายังไม่มี nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# เปิด Terminal ใหม่ แล้ว
nvm install 22
nvm alias default 22
node -v                             # v22.x
```

### B2. ติดตั้งและ build

```bash
cd ~/Apps/ITDash
npm ci                              # ติดตั้ง package ตาม package-lock.json
npm run build
```

### B3. ทดลองรัน

```bash
NODE_EXTRA_CA_CERTS="$PWD/certs/ca-bundle.pem" npm start
```

เปิด <http://localhost:3000> ตรวจป้ายบนการ์ดเหมือนข้อ A3 แล้วกด `Ctrl+C` เพื่อหยุดก่อนทำขั้นต่อไป

> `NODE_EXTRA_CA_CERTS` ต้องตั้งตอนสั่งรันแบบนี้ (หรือใน service ข้อ B4) — ใส่ใน `.env.local` ไม่มีผล

### B4. ให้รันเป็น service (เปิดเองหลังรีบูต) ด้วย launchd

1. หา path ของ node: `which node` (เช่น `/Users/aloha/.nvm/versions/node/v22.12.0/bin/node`)
2. สร้างไฟล์ `~/Library/LaunchAgents/th.itdash.plist` — แก้ 3 จุดที่มี `/Users/aloha` และ path ของ node ให้ตรงเครื่อง

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>Label</key>
     <string>th.itdash</string>
     <key>WorkingDirectory</key>
     <string>/Users/aloha/Apps/ITDash</string>
     <key>ProgramArguments</key>
     <array>
       <string>/Users/aloha/.nvm/versions/node/v22.12.0/bin/node</string>
       <string>node_modules/next/dist/bin/next</string>
       <string>start</string>
     </array>
     <key>EnvironmentVariables</key>
     <dict>
       <key>NODE_ENV</key>
       <string>production</string>
       <key>PORT</key>
       <string>3000</string>
       <key>NODE_EXTRA_CA_CERTS</key>
       <string>/Users/aloha/Apps/ITDash/certs/ca-bundle.pem</string>
     </dict>
     <key>RunAtLoad</key>
     <true/>
     <key>KeepAlive</key>
     <true/>
     <key>StandardOutPath</key>
     <string>/Users/aloha/Apps/ITDash/itdash.log</string>
     <key>StandardErrorPath</key>
     <string>/Users/aloha/Apps/ITDash/itdash.log</string>
   </dict>
   </plist>
   ```

3. ตรวจรูปแบบไฟล์และเริ่ม service

   ```bash
   plutil -lint ~/Library/LaunchAgents/th.itdash.plist      # ต้องขึ้น OK
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/th.itdash.plist
   curl http://localhost:3000/api/health
   ```

   LaunchAgent เริ่มเมื่อผู้ใช้ล็อกอิน ถ้าต้องการให้เริ่มตั้งแต่เปิดเครื่องโดยไม่ต้องล็อกอิน
   ให้วางไฟล์ไว้ที่ `/Library/LaunchDaemons/` แทน (ต้องใช้ `sudo` และเพิ่ม key `UserName` เป็นบัญชีที่รัน)

### B5. คำสั่งที่ใช้บ่อย

| ต้องการ | คำสั่ง |
| --- | --- |
| แก้ `.env.local` แล้วให้มีผล | `launchctl kickstart -k gui/$(id -u)/th.itdash` |
| อัปเดตเป็นเวอร์ชันล่าสุด | `git pull && npm ci && npm run build && launchctl kickstart -k gui/$(id -u)/th.itdash` |
| หยุด service | `launchctl bootout gui/$(id -u)/th.itdash` |
| ดู log | `tail -f ~/Apps/ITDash/itdash.log` |
| อัปเกรด Node.js | `nvm install 22` แล้วแก้ path ใน plist ให้ตรงเวอร์ชันใหม่ |

---

## ให้คนอื่นในทีมเปิดดู (ถ้าต้องการ)

ค่าเริ่มต้นเปิดดูได้ที่ Mac mini เครื่องเดียว (`localhost:3000`) ถ้าให้เจ้าหน้าที่คนอื่นเปิดจากเครื่องตัวเอง

1. ขอเปิดกฎขาเข้า `FW-ITD-IN1` / `IN2` ใน *ITDash Firewall Policy*
2. *System Settings → Network → Firewall → Options* อนุญาต incoming ให้ Docker (ทาง A) หรือ `node` (ทาง B)
3. แนะนำวาง reverse proxy ที่ทำ HTTPS ไว้ข้างหน้า (เช่น Caddy หรือ nginx) — **ITDash ยังไม่มีระบบล็อกอิน**
   ให้เปิดเฉพาะวงเครือข่ายของทีมไอทีหรือ VPN เท่านั้น

---

## ตรวจหลังติดตั้ง

- [ ] `curl http://localhost:3000/api/health` ได้ `{"status":"ok"}`
- [ ] ทุกการ์ดขึ้นป้ายจุดเขียว (ยกเว้น Ticket queue ที่ยังไม่มีระบบ)
- [ ] รีบูต Mac mini แล้ว dashboard กลับมาเองภายใน 2 นาทีหลังล็อกอิน
- [ ] `.env.local` สิทธิ์ 600 และไม่อยู่ใน `git status`
- [ ] จดวันหมดอายุของ token / API key ไว้ในปฏิทิน (หมุนทุก 90 วัน)

ติดปัญหาการเชื่อมต่อ → ตารางแก้ปัญหาใน [INTEGRATIONS.md](INTEGRATIONS.md) · เรื่องโหลดและหลาย replica → [DEPLOYMENT.md](DEPLOYMENT.md)
