// Render the planner's print edition to a ready-made PDF.
//
//   node tools/render-plan-pdf.mjs [page-url] [out.pdf]
//
// Opens the public plan page (?print=1) in headless Chrome, waits until the
// page's own loader says "Everything is loaded" (sheet inputs and Google
// traffic applied), then prints it with the page's print stylesheet. Writes
// the PDF and a stamp beside it (<out>.json: when, size, pages) that the
// pages read to label the Download PDF button.
//
// Runs nightly on GitHub Actions (.github/workflows/render-plan-pdf.yml) and
// by hand with a local server on :8000. Needs Node 22+ (built-in WebSocket)
// and a Chrome; CHROME env overrides the path.
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

// With no arguments: one PDF per active stay from data/logistics.json
// (plan/tour-plan-<stay id>.pdf) plus plan/tour-plan.pdf for the main stay.
import { readFileSync } from "node:fs";
const BASE = process.env.PLAN_URL || "http://localhost:8000/plan/";
const jobs = [];
if (process.argv[2]) jobs.push({ url: process.argv[2], out: process.argv[3] || "plan/tour-plan.pdf" });
else {
  const cfg = JSON.parse(readFileSync("data/logistics.json", "utf8"));
  const stays = (cfg.stays || []).filter((s) => s.active !== false && s.lat != null);
  for (const s of stays) jobs.push({ url: BASE + "?print=1&stay=" + encodeURIComponent(s.id), out: "plan/tour-plan-" + s.id + ".pdf", stay: s });
  const main = stays.find((s) => s.id === cfg.selectedStay) || stays[0];
  if (main) jobs.push({ url: BASE + "?print=1&stay=" + encodeURIComponent(main.id), out: "plan/tour-plan.pdf", stay: main });
}
const CHROME = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"].find(existsSync);
if (!CHROME) { console.error("No Chrome found; set CHROME=/path/to/chrome"); process.exit(1); }
const PORT = 9333;
const dir = "/tmp/";

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=" + PORT, "--user-data-dir=" + dir + "chrome-cdp", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch("http://127.0.0.1:" + PORT + "/json").then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r)); break; }
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
}
function send(method, params) { return new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }); }
async function evalJS(expression) { const r = await send("Runtime.evaluate", { expression, returnByValue: true }); return r.result && r.result.result && r.result.result.value; }

await connect();
await send("Page.enable");
await send("Emulation.setEmulatedMedia", { media: "print" });
let failed = 0;
for (const job of jobs) {
  await send("Page.navigate", { url: job.url });
  let text = "";
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    text = await evalJS("(document.getElementById('loader-text')||{}).textContent||''");
    if (/Everything is loaded|Could not load/.test(text)) break;
  }
  if (!/Everything is loaded/.test(text)) { console.error(job.out + ": plan did not finish loading (" + text + "); keeping the previous file."); failed++; continue; }
  await sleep(800);
  const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  const buf = Buffer.from(pdf.result.data, "base64");
  writeFileSync(job.out, buf);
  const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  writeFileSync(job.out + ".json", JSON.stringify({ at: new Date().toISOString(), bytes: buf.length, pages: pages, stay: job.stay ? job.stay.id : null, stayName: job.stay ? job.stay.name : null }) + "\n");
  process.stderr.write("wrote " + job.out + " (" + pages + " pages" + (job.stay ? ", " + job.stay.name : "") + ")\n");
}
ws.close(); chrome.kill();
if (failed) process.exit(2);
