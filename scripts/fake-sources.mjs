// Fake Zabbix / Prometheus / Elasticsearch / Veeam / Cohesity servers for local development.
// Run:  npm run fake-sources   then start ITDash with:  npm run dev:fake
import http from "node:http";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function body(req) {
  return new Promise((r) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => r(b));
  });
}
const json = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
};
const now = () => Math.floor(Date.now() / 1000);

// ---------------- Zabbix ----------------
const ZTOKEN = "zbx-test-token";
http
  .createServer(async (req, res) => {
    const raw = await body(req);
    if (req.url !== "/api_jsonrpc.php") return json(res, 404, {});
    const auth = req.headers.authorization;
    const rq = JSON.parse(raw);
    log("ZABBIX", rq.method, "auth=" + (auth === `Bearer ${ZTOKEN}` ? "ok" : auth), JSON.stringify(rq.params).slice(0, 140));
    if (auth !== `Bearer ${ZTOKEN}`)
      return json(res, 200, { jsonrpc: "2.0", error: { code: -32602, message: "Invalid params.", data: "Not authorized." }, id: rq.id });
    const r = (result) => json(res, 200, { jsonrpc: "2.0", result, id: rq.id });
    switch (rq.method) {
      case "host.get": {
        const names = ["dc-01", "dc-02", "mx-01", "app-03", "app-05", "nas-01", "fw-edge", "web-01", "web-02", "db-01"];
        return r(names.map((n, i) => ({ hostid: String(10100 + i), name: n, interfaces: [{ available: n === "app-03" ? "2" : "1" }] })));
      }
      case "problem.get":
        return r([
          { eventid: "88123", name: "e-Office: HTTP 503 on /api/health", severity: "4", clock: String(now() - 720), suppressed: "0" },
          { eventid: "88119", name: "High memory utilization (>90% for 5m)", severity: "3", clock: String(now() - 1900), suppressed: "0" },
          { eventid: "88102", name: "/var: Disk space is low (used > 85%)", severity: "2", clock: String(now() - 5400), suppressed: "0" },
          { eventid: "88090", name: "Maintenance noise (suppressed)", severity: "2", clock: String(now() - 6000), suppressed: "1" },
        ]);
      case "event.get":
        return r(
          rq.params.eventids.map((id) => ({
            eventid: id,
            hosts: [{ name: { 88123: "app-03", 88119: "db-01", 88102: "web-02" }[id] ?? "x" }],
          })),
        );
      case "item.get": {
        const TB = 1024 ** 4;
        const fs = [
          ["nas-01", "/volume1", 38.2, 48, "vfs.fs.dependent.size"],
          ["db-01", "/var/lib/mysql", 2.9, 4, "vfs.fs.dependent.size"],
          ["fs-02", "D:", 7.4, 8, "vfs.fs.size"],
          ["app-05", "/", 0.02, 0.05, "vfs.fs.dependent.size"], // too small → filtered
          ["backup-01", "/backup", 30, 80, "vfs.fs.dependent.size"],
          ["mx-01", "/mail", 4.1, 8, "vfs.fs.dependent.size"],
        ];
        const items = [];
        fs.forEach(([h, m, u, t, k], i) => {
          items.push({ itemid: `${i}1`, key_: `${k}[${m},used]`, lastvalue: String(u * TB), hosts: [{ name: h }] });
          items.push({ itemid: `${i}2`, key_: `${k}[${m},total]`, lastvalue: String(t * TB), hosts: [{ name: h }] });
          items.push({ itemid: `${i}3`, key_: `${k}[${m},pused]`, lastvalue: String((u / t) * 100), hosts: [{ name: h }] });
          items.push({ itemid: `${i}4`, key_: `vfs.fs.inode[${m},pfree]`, lastvalue: "90", hosts: [{ name: h }] });
        });
        return r(items);
      }
    }
    json(res, 200, { jsonrpc: "2.0", error: { code: -32601, message: "Method not found." }, id: rq.id });
  })
  .listen(4101);

// ---------------- Prometheus ----------------
http
  .createServer(async (req, res) => {
    const raw = await body(req);
    const p = new URLSearchParams(raw);
    const q = p.get("query") ?? "";
    log("PROM", req.url, JSON.stringify(q).slice(0, 120), p.get("start") ? `range ${p.get("start")}→${p.get("end")} step ${p.get("step")}` : `t=${p.get("time")}`);
    const range = (fn) => {
      const out = [];
      for (let t = Number(p.get("start")); t <= Number(p.get("end")); t += Number(p.get("step"))) {
        const v = fn(t);
        if (v !== null) out.push([t, String(v)]);
      }
      return out;
    };
    const ok = (resultType, result) => json(res, 200, { status: "success", data: { resultType, result } });
    if (req.url === "/api/v1/query_range") {
      if (q.includes("receive_bytes"))
        return ok("matrix", [{ metric: {}, values: range((t) => Math.round(80 + 700 * Math.exp(-(((t / 3600 + 7) % 24 - 11) ** 2) / 10))) }]);
      if (q.includes("transmit_bytes"))
        return ok("matrix", [{ metric: {}, values: range((t) => Math.round(40 + 280 * Math.exp(-(((t / 3600 + 7) % 24 - 11) ** 2) / 10))) }]);
      if (q.includes("probe_duration"))
        return ok("matrix", [{ metric: {}, values: range((t) => (22 + 6 * Math.sin(t / 900)).toFixed(2)) }]);
      if (q === "probe_success") {
        const targets = ["https://mail.example.org", "https://eoffice.example.org", "https://hr.example.org", "https://www.example.org", "tcp://vpn.example.org:443", "https://intranet.example.org"];
        const end = Number(p.get("end"));
        return ok(
          "matrix",
          targets.map((instance) => ({
            metric: { __name__: "probe_success", instance, job: instance.startsWith("tcp") ? "blackbox-tcp" : "blackbox-http" },
            values: range((t) => {
              if (instance.includes("eoffice") && t > end - 900) return 0;
              if (instance.includes("hr") && t < end - 9000) return null; // new target: no data early
              if (instance.includes("vpn") && (t / 300) % 7 === 3) return 0;
              return 1;
            }),
          })),
        );
      }
      return ok("matrix", []);
    }
    if (req.url === "/api/v1/query") {
      if (q.includes("avg_over_time((probe_success)[30d:5m])")) {
        const u = { "https://mail.example.org": 99.98, "https://eoffice.example.org": 99.41, "https://www.example.org": 99.99, "tcp://vpn.example.org:443": 99.62, "https://intranet.example.org": 100 };
        return ok("vector", Object.entries(u).map(([instance, v]) => ({ metric: { instance }, value: [now(), String(v)] })));
      }
      return ok("vector", []);
    }
    json(res, 404, { status: "error", error: "not found" });
  })
  .listen(4102);

// ---------------- Elasticsearch ----------------
const ESKEY = "ZXMtdGVzdDprZXk=";
http
  .createServer(async (req, res) => {
    const raw = await body(req);
    log("ES", req.method, req.url, "auth=" + (req.headers.authorization === `ApiKey ${ESKEY}` ? "ok" : req.headers.authorization), raw.slice(0, 160));
    if (req.headers.authorization !== `ApiKey ${ESKEY}`)
      return json(res, 401, { error: { type: "security_exception", reason: "unable to authenticate" }, status: 401 });
    const b = JSON.parse(raw);
    if (b.size === 0) {
      return json(res, 200, {
        aggregations: {
          previous: { doc_count: 49 },
          current: { doc_count: 37, per5m: { buckets: [2, 4, 1, 3, 6, 2, 5, 3, 2, 4, 3, 2].map((d) => ({ doc_count: d })) } },
        },
      });
    }
    const t = Date.now();
    const docs = [
      { "@timestamp": new Date(t - 60e3).toISOString(), log: { level: "error" }, host: { name: "app-03" }, message: "upstream timed out (110: Connection timed out) while reading response header\nstack..." },
      { "@timestamp": new Date(t - 240e3).toISOString(), log: { level: "WARN" }, host: { name: "fw-edge" }, message: "IPsec SA branch-04 rekey failed, retrying" },
      { "@timestamp": new Date(t - 1500e3).toISOString(), "log.level": "warning", "host.name": "dc-01", message: "Kerberos pre-authentication failed for user s.kittipong (flattened fields)" },
      { "@timestamp": new Date(t - 3000e3).toISOString(), log: { level: "critical" }, host: { name: "db-01" }, message: "InnoDB: page_cleaner: 1000ms intended loop took 4528ms" },
    ];
    json(res, 200, { hits: { hits: docs.map((d, i) => ({ _id: String(i), _source: d })) } });
  })
  .listen(4103);

log("fakes listening on 4101 (zabbix), 4102 (prometheus), 4103 (elasticsearch)");

// ---------------- Veeam B&R ----------------
http
  .createServer(async (req, res) => {
    const raw = await body(req);
    const ver = req.headers["x-api-version"];
    log("VEEAM", req.method, req.url, "x-api-version=" + ver, "auth=" + (req.headers.authorization ?? "-").slice(0, 18), raw.replace(/password=[^&]*/, "password=***").slice(0, 80));
    if (!ver) return json(res, 400, { errorCode: "BadRequest", message: "x-api-version header is required" });
    if (req.url === "/api/oauth2/token") {
      const p = new URLSearchParams(raw);
      if (p.get("username") !== "svc-itdash" || p.get("password") !== "pw") return json(res, 401, { errorCode: "Unauthorized" });
      return json(res, 200, { access_token: "vbr-token", token_type: "bearer", expires_in: 900 });
    }
    if (req.headers.authorization !== "Bearer vbr-token") return json(res, 401, { errorCode: "Unauthorized" });
    const iso = (minAgo) => new Date(Date.now() - minAgo * 60e3).toISOString();
    if (req.url.startsWith("/api/v1/jobs/states")) {
      return json(res, 200, {
        data: [
          { id: "j1", name: "VM-Daily-Prod", type: "Backup", status: "inactive", lastResult: "Success", lastRun: iso(760), repositoryName: "Repo-SOBR-01", objectsCount: 42 },
          { id: "j2", name: "SQL-Nightly", type: "Backup", status: "inactive", lastResult: "Warning", lastRun: iso(790), repositoryName: "Repo-SOBR-01", objectsCount: 3 },
          { id: "j3", name: "Exchange-Mailbox", type: "Backup", status: "inactive", lastResult: "Failed", lastRun: iso(850), repositoryName: "Repo-Cloud", objectsCount: 1 },
          { id: "j4", name: "FileServer-Hourly", type: "Backup", status: "running", lastResult: "Success", lastRun: iso(5), repositoryName: "Repo-SOBR-01", objectsCount: 2, progressPercent: 64 },
          { id: "j5", name: "Old-Test-Job", type: "Backup", status: "disabled", lastResult: "None", objectsCount: 0 },
        ],
      });
    }
    if (req.url.startsWith("/api/v1/sessions")) {
      return json(res, 200, {
        data: [
          { jobId: "j1", name: "VM-Daily-Prod", creationTime: iso(760), endTime: iso(658), state: "Stopped" },
          { jobId: "j2", name: "SQL-Nightly", creationTime: iso(790), endTime: iso(752), state: "Stopped" },
          { jobId: "j3", name: "Exchange-Mailbox", creationTime: iso(850), endTime: iso(846), state: "Stopped" },
        ],
      });
    }
    json(res, 404, { errorCode: "NotFound" });
  })
  .listen(4104);

// ---------------- Cohesity ----------------
http
  .createServer(async (req, res) => {
    await body(req);
    log("COHESITY", req.method, req.url, "apiKey=" + (req.headers.apikey === "coh-key" ? "ok" : req.headers.apikey));
    if (req.headers.apikey !== "coh-key") return json(res, 401, { errorCode: "KStatusUnauthorized", message: "Authentication failed" });
    if (req.url.startsWith("/v2/data-protect/protection-groups")) {
      const us = (minAgo) => (Date.now() - minAgo * 60e3) * 1000;
      const GB = 1024 ** 3;
      return json(res, 200, {
        protectionGroups: [
          { id: "1:1:10", name: "PG-VMware-Tier1", environment: "kVMware", isActive: true, isPaused: false, lastRun: { localBackupInfo: { status: "Succeeded", startTimeUsecs: us(300), endTimeUsecs: us(271), localSnapshotStats: { bytesWritten: 182 * GB, logicalSizeBytes: 9000 * GB } } } },
          { id: "1:1:11", name: "PG-NAS-Shares", environment: "kGenericNas", isActive: true, isPaused: false, lastRun: { localBackupInfo: { status: "SucceededWithWarning", startTimeUsecs: us(420), endTimeUsecs: us(380), localSnapshotStats: { bytesWritten: 64 * GB } } } },
          { id: "1:1:12", name: "PG-Oracle-ERP", environment: "kOracle", isActive: true, isPaused: false, lastRun: { localBackupInfo: { status: "Running", startTimeUsecs: us(12) } } },
          { id: "1:1:13", name: "PG-Paused", environment: "kPhysical", isActive: true, isPaused: true },
          { id: "1:1:14", name: "PG-New-NeverRun", environment: "kPhysical", isActive: true, isPaused: false },
        ],
      });
    }
    json(res, 404, {});
  })
  .listen(4105);
log("+ veeam 4104, cohesity 4105");
