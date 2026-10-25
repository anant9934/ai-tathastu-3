/*!
 * AI Tathastu profile widget for partner/pilot sites.
 *
 *   <div id="ait-widget"></div>
 *   <script src="https://www.aitathastu.com/embed.js" async></script>
 *
 * The visitor clicks "Show my AI Tathastu profile"; a popup on aitathastu.com
 * asks them to approve, then hands this page a 15-minute, read-only token
 * (postMessage, no third-party cookies). The widget shows name, interview
 * readiness and top skills, in a Shadow DOM so host-page CSS can't leak in.
 * The site must be in AI Tathastu's EMBED_ALLOWED_ORIGINS.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var BASE = new URL(script && script.src ? script.src : "https://www.aitathastu.com/embed.js").origin;
  var STORE_KEY = "ait_embed_token:" + BASE;

  function readToken() {
    try {
      var t = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      return t && t.expiresAt * 1000 > Date.now() + 15000 ? t.token : null;
    } catch {
      return null; // storage blocked: just ask again
    }
  }
  function saveToken(token, expiresAt) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ token: token, expiresAt: expiresAt })); } catch { /* storage blocked */ }
  }
  function clearToken() {
    try { sessionStorage.removeItem(STORE_KEY); } catch { /* storage blocked */ }
  }

  var CSS = [
    ":host{all:initial;display:block}",
    ".card{--bg:#faf8f4;--fg:#26211d;--muted:#5f5850;--line:#dcd6cc;--brand:#c2410c;",
    "font:14px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--fg);background:var(--bg);",
    "border:1px solid var(--line);border-radius:10px;padding:16px 18px;max-width:360px;box-sizing:border-box}",
    "@media (prefers-color-scheme:dark){.card{--bg:#1c1916;--fg:#f2efe9;--muted:#bdb5aa;--line:#3a352f;--brand:#f0905a}}",
    ".eyebrow{display:flex;align-items:center;gap:8px;font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}",
    ".mark{width:20px;height:20px;flex:none}",
    ".brand{color:var(--brand)}",
    ".name{font-size:20px;font-weight:600;margin:8px 0 2px}",
    ".role{color:var(--muted);margin:0}",
    ".row{display:flex;align-items:baseline;gap:8px;margin-top:12px}",
    ".score{font-size:28px;font-weight:600}.of{color:var(--muted)}",
    ".bar{height:6px;background:var(--line);border-radius:99px;overflow:hidden;margin-top:6px}",
    ".fill{height:100%;background:var(--brand);transform-origin:left}",
    ".skills{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0;padding:0;list-style:none}",
    ".skills li{border:1px solid var(--line);border-radius:99px;padding:2px 10px;font-size:13px}",
    "a,button{font:inherit;color:inherit}",
    ".cta{display:inline-flex;margin-top:14px;font-weight:600;color:var(--brand);text-decoration:underline;text-underline-offset:3px}",
    ".btn{margin-top:10px;background:var(--fg);color:var(--bg);border:0;border-radius:8px;padding:9px 14px;font-weight:600;cursor:pointer}",
    ".btn:hover{opacity:.9}",
    "a:focus-visible,button:focus-visible{outline:3px solid var(--brand);outline-offset:2px}",
    ".muted{color:var(--muted);margin:6px 0 0}",
    "@media (prefers-reduced-motion:no-preference){.fill{transition:transform .3s ease}}",
  ].join("");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text); // never innerHTML with profile data
    return n;
  }

  function mount(host) {
    var root = host.shadowRoot || host.attachShadow({ mode: "open" });
    root.innerHTML = "";
    var style = document.createElement("style");
    style.textContent = CSS;
    var card = el("section", "card");
    card.setAttribute("aria-live", "polite");
    card.setAttribute("aria-label", "AI Tathastu profile");
    root.appendChild(style);
    root.appendChild(card);
    return card;
  }

  function header(card) {
    var eyebrow = el("div", "eyebrow");
    var mark = el("img", "mark");
    mark.src = BASE + "/brand/mark.png";
    mark.alt = "";
    eyebrow.appendChild(mark);
    eyebrow.appendChild(document.createTextNode("AI Tathastu"));
    eyebrow.appendChild(el("span", "brand", "."));
    card.appendChild(eyebrow);
  }

  function renderPrompt(card, message) {
    card.innerHTML = "";
    header(card);
    card.appendChild(el("p", "muted", message || "See your interview readiness and top skills."));
    var btn = el("button", "btn", "Show my AI Tathastu profile");
    btn.type = "button";
    btn.addEventListener("click", function () { authorize(card); });
    card.appendChild(btn);
  }

  function renderMessage(card, text) {
    card.innerHTML = "";
    header(card);
    card.appendChild(el("p", "muted", text));
  }

  function renderProfile(card, p) {
    card.innerHTML = "";
    header(card);
    card.appendChild(el("p", "name", p.name || "Your profile"));
    if (p.careerRole) card.appendChild(el("p", "role", p.careerRole));

    if (typeof p.erisScore === "number") {
      var pct = Math.round(p.erisScore * 100);
      var row = el("div", "row");
      row.appendChild(el("span", "score", pct));
      row.appendChild(el("span", "of", "/100 interview readiness"));
      card.appendChild(row);
      var bar = el("div", "bar");
      bar.setAttribute("role", "meter");
      bar.setAttribute("aria-label", "Interview readiness");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", String(pct));
      var fill = el("div", "fill");
      fill.style.transform = "scaleX(" + Math.max(0, Math.min(1, p.erisScore)) + ")";
      bar.appendChild(fill);
      card.appendChild(bar);
    } else {
      card.appendChild(el("p", "muted", "Interview readiness is still being calculated."));
    }

    if (p.topSkills && p.topSkills.length) {
      var ul = el("ul", "skills");
      ul.setAttribute("aria-label", "Top skills");
      p.topSkills.slice(0, 3).forEach(function (s) { ul.appendChild(el("li", null, s)); });
      card.appendChild(ul);
    }

    var link = el("a", "cta", "View dashboard");
    var url = new URL(p.dashboardUrl || BASE + "/dashboard");
    link.href = url.origin === BASE ? url.href : BASE + "/dashboard"; // only ever link to AI Tathastu
    link.target = "_blank";
    link.rel = "noopener";
    card.appendChild(link);
  }

  function load(card) {
    var token = readToken();
    if (!token) return renderPrompt(card);
    renderMessage(card, "Loading your profile…");
    fetch(BASE + "/api/profile/v1/me", { headers: { Authorization: "Bearer " + token }, credentials: "omit" })
      .then(function (res) {
        if (res.status === 401) { clearToken(); renderPrompt(card, "Your session ended. Show your profile again."); return; }
        if (res.status === 403) { clearToken(); renderMessage(card, "The AI Tathastu widget isn't available on this site right now."); return; }
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json().then(function (p) { renderProfile(card, p); });
      })
      .catch(function () { renderPrompt(card, "Couldn't load your profile. Try again."); });
  }

  function authorize(card) {
    var popup = window.open(
      BASE + "/embed/authorize?origin=" + encodeURIComponent(location.origin),
      "ait-embed-authorize",
      "width=460,height=620" // keeps window.opener so the popup can postMessage back
    );
    if (!popup) return renderPrompt(card, "Allow pop-ups for this site, then try again.");
    renderMessage(card, "Waiting for your approval in the AI Tathastu window…");

    function onMessage(e) {
      if (e.origin !== BASE || !e.data || e.data.source !== "ait-embed") return; // only trust AI Tathastu
      window.removeEventListener("message", onMessage);
      clearInterval(watch);
      if (e.data.type === "token" && e.data.token) {
        saveToken(e.data.token, e.data.expiresAt);
        load(card);
      } else {
        renderPrompt(card);
      }
    }
    window.addEventListener("message", onMessage);
    var watch = setInterval(function () {
      if (popup.closed) { clearInterval(watch); window.removeEventListener("message", onMessage); if (!readToken()) renderPrompt(card); }
    }, 800);
  }

  function start() {
    var host = document.getElementById("ait-widget");
    if (host) load(mount(host));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
