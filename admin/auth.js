/* ============================================================
   Shared admin sign-in gate for every page under /admin.
   Deliberately lightweight (these are internal tools, not a secret store):
   it keeps the pages out of casual/accidental reach. Passwords are stored as
   SHA-256 hashes here, never plaintext. Sign-in is remembered per browser tab
   (sessionStorage) and shared across all /admin pages on this origin, so you
   sign in once and can move between tools.

   To add or change an admin, run:
     printf '%s' 'their-password' | shasum -a 256
   and add/replace the hash in USERS below.

   Usage on an admin page:
     <div id="admin-app" hidden> …page… </div>
     <script src="auth.js"></script>
     <script> AdminAuth.protect({ onUnlock: (user) => { … } }); </script>
   ============================================================ */
(function (global) {
  "use strict";

  const USERS = {
    jois:  "ee9d41e56dce85563d3e14b0a37eb48dde121c27539a2f4f9884e56b2ea1e0c7", // jois-7aade8
    vinod: "df6fcc5c1774a5292e5b8c61bb0e9cc57034b3b4f25b439231fe7c9cd726c820", // vinod-98860
  };
  const AUTH_FLAG = "bali-admin-auth";

  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Returns the normalised username on success, or false.
  async function checkCreds(user, pass) {
    const u = String(user || "").trim().toLowerCase();
    if (!USERS[u]) return false;
    return (await sha256(pass)) === USERS[u] ? u : false;
  }

  function saved() {
    try { return JSON.parse(sessionStorage.getItem(AUTH_FLAG) || "null"); } catch (e) { return null; }
  }
  function creds() {
    const s = saved();
    return s && s.user && s.pass ? { user: s.user, pass: s.pass } : null;
  }
  function currentUser() { const c = creds(); return c ? c.user : null; }
  function signOut() { try { sessionStorage.removeItem(AUTH_FLAG); } catch (e) {} location.reload(); }

  function injectStyles() {
    if (document.getElementById("aa-styles")) return;
    const css = `
      .aa-gate{position:fixed;inset:0;background:#1B1D21;display:flex;align-items:center;justify-content:center;padding:1.5rem;z-index:9999;
        font-family:"Instrument Sans",system-ui,sans-serif;color:#EFE7D8}
      .aa-gate[hidden]{display:none}
      .aa-box{width:100%;max-width:380px;background:#23262B;border:1px solid #2C3036;border-radius:8px;padding:2rem;display:flex;flex-direction:column;gap:.7rem}
      .aa-kick{font-family:"Archivo","Arial Narrow",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.2em;font-size:.7rem;color:#C87941;margin:0 0 .1rem}
      .aa-box h1{font-family:"Archivo","Arial Narrow",sans-serif;font-weight:900;text-transform:uppercase;font-size:1.6rem;margin:0 0 .2rem}
      .aa-box p{color:#8C8E92;margin:0 0 1rem;font-size:.9rem}
      .aa-box input{width:100%;background:#1B1D21;border:1px solid #2C3036;border-radius:6px;color:#EFE7D8;font:inherit;font-size:.95rem;padding:.6rem .7rem}
      .aa-box input:focus{outline:none;border-color:#ff5a3c}
      .aa-btn{font-family:"Archivo","Arial Narrow",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.03em;font-size:.8rem;border:0;border-radius:5px;padding:.7rem 1.2rem;cursor:pointer;background:#ff5a3c;color:#111;margin-top:.3rem}
      .aa-btn:hover{background:#C87941}
      .aa-err{color:#ff5a3c;font-size:.85rem;margin:.2rem 0 0}
    `;
    const style = document.createElement("style");
    style.id = "aa-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildGate() {
    const gate = document.createElement("div");
    gate.className = "aa-gate";
    gate.innerHTML =
      '<form class="aa-box" autocomplete="off">' +
      '<p class="aa-kick">Bali in Bengaluru · internal</p>' +
      "<h1>Sign in</h1>" +
      "<p>This area is for Param Foundation staff.</p>" +
      '<input class="aa-user" type="text" placeholder="Username" autocomplete="username" autocapitalize="none" spellcheck="false" />' +
      '<input class="aa-pass" type="password" placeholder="Password" autocomplete="current-password" />' +
      '<button class="aa-btn" type="submit">Sign in</button>' +
      '<p class="aa-err" hidden>Wrong username or password.</p>' +
      "</form>";
    return gate;
  }

  /* Show the gate; reveal #admin-app and call opts.onUnlock(user) once authed
     (whether restored from the session or entered just now). */
  function protect(opts) {
    opts = opts || {};
    const onUnlock = typeof opts.onUnlock === "function" ? opts.onUnlock : function () {};

    function start() {
      injectStyles();
      const gate = buildGate();
      document.body.appendChild(gate);
      const app = document.getElementById("admin-app");
      const form = gate.querySelector("form");
      const userEl = gate.querySelector(".aa-user");
      const passEl = gate.querySelector(".aa-pass");
      const errEl = gate.querySelector(".aa-err");

      const unlock = (u) => {
        gate.hidden = true;
        gate.remove();
        if (app) app.hidden = false;
        onUnlock(u);
      };

      // Restore an existing session, re-verifying the password hash.
      const s = creds();
      if (s) {
        checkCreds(s.user, s.pass).then((u) => { if (u) unlock(u); else userEl.focus(); });
      } else {
        userEl.focus();
      }

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const u = await checkCreds(userEl.value, passEl.value);
        if (u) {
          try { sessionStorage.setItem(AUTH_FLAG, JSON.stringify({ user: u, pass: passEl.value })); } catch (e2) {}
          unlock(u);
        } else {
          errEl.hidden = false;
          passEl.value = "";
          passEl.focus();
        }
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  }

  global.AdminAuth = { protect, checkCreds, creds, currentUser, signOut, AUTH_FLAG };
})(window);
