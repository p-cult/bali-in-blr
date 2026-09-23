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

const PAGE = process.argv[2] || "http://localhost:8000/plan/?print=1";
const OUT = process.argv[3] || "plan/tour-plan.pdf";
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
await send("Page.navigate", { url: PAGE });
let text = "";
for (let i = 0; i < 90; i++) {
  await sleep(1000);
  text = await evalJS("(document.getElementById('loader-text')||{}).textContent||''");
  if (/Everything is loaded|Could not load/.test(text)) break;
}
process.stderr.write("loader: " + text + "\n");
await sleep(1000);
const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
const buf = Buffer.from(pdf.result.data, "base64");
if (!/Everything is loaded/.test(text)) { console.error("Plan did not finish loading; keeping the previous PDF."); ws.close(); chrome.kill(); process.exit(2); }
writeFileSync(OUT, buf);
const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
writeFileSync(OUT + ".json", JSON.stringify({ at: new Date().toISOString(), bytes: buf.length, pages: pages }) + "\n");
process.stderr.write("wrote " + OUT + " (" + pages + " pages)\n");
ws.close(); chrome.kill();
