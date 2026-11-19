/* ტექსტში ძიება (ტელეფონზე Ctrl+F არ არის).
   ღილაკი 🔍 ჩნდება მაშინ, როცა ტექსტია გახსნილი; პოულობს სიტყვას/ფრაზას, აფერადებს და გადადის მასზე.
   გვერდის შიგთავსს არ ცვლის (React-ის აპლიკაციებიც არ ზიანდება): მონიშვნა CSS Highlight-ით ან ზედ დადებული ჩარჩოთი.
   გვერდს შეუძლია მიუთითოს, სად ეძებოს: window.POISK_TARGET = () => ელემენტი ან null. */
(function () {
  if (window.__poisk) return; window.__poisk = 1;
  var HL = !!(window.CSS && CSS.highlights && window.Highlight);

  var css = document.createElement("style");
  css.textContent =
    "#pk-btn{position:fixed;left:calc(14px + env(safe-area-inset-left,0px));bottom:calc(var(--pk-bottom,40px) + env(safe-area-inset-bottom,0px));z-index:2147483000;" +
    "width:48px;height:48px;border-radius:50%;border:0;background:#4f46e5;color:#fff;font-size:22px;line-height:48px;text-align:center;padding:0;" +
    "box-shadow:0 4px 14px rgba(30,27,75,.35);cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    "#pk-btn[hidden],#pk-bar[hidden]{display:none}" +
    "#pk-bar{position:fixed;left:0;right:0;top:0;z-index:2147483001;background:#fff;border-bottom:1px solid #c7d2fe;box-shadow:0 4px 14px rgba(30,27,75,.18);" +
    "padding:calc(8px + env(safe-area-inset-top,0px)) calc(10px + env(safe-area-inset-right,0px)) 8px calc(10px + env(safe-area-inset-left,0px));" +
    "display:flex;align-items:center;gap:6px;font-family:inherit;color:#1e1b4b}" +
    "#pk-in{flex:1;min-width:0;font-size:16px;padding:9px 12px;border:1.5px solid #c7d2fe;border-radius:12px;outline:none;background:#fff;color:#1e1b4b;font-family:inherit}" +
    "#pk-in:focus{border-color:#4f46e5}" +
    "#pk-n{font-size:13px;color:#64748b;min-width:44px;text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}" +
    "#pk-n.none{color:#dc2626}" +
    ".pk-b{width:38px;height:38px;flex:none;border:1.5px solid #c7d2fe;border-radius:10px;background:#eef2ff;color:#4338ca;font-size:16px;cursor:pointer;padding:0;line-height:1}" +
    ".pk-b:disabled{opacity:.4}" +
    "#pk-cur{position:fixed;left:0;top:0;width:0;height:0;z-index:2147482999;pointer-events:none}" +
    "#pk-cur i{position:fixed;border-radius:3px;background:rgba(249,115,22,.35);outline:2px solid #f97316}" +
    "::highlight(pk-all){background-color:#fde68a;color:inherit}" +
    "::highlight(pk-one){background-color:#fb923c;color:#000}";
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.id = "pk-btn"; btn.type = "button"; btn.hidden = true;
  btn.title = "ტექსტში ძიება"; btn.setAttribute("aria-label", "ტექსტში ძიება");
  btn.textContent = "🔍";
  var bar = document.createElement("div");
  bar.id = "pk-bar"; bar.hidden = true; bar.setAttribute("role", "search");
  bar.innerHTML = '<input id="pk-in" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="ძიება ტექსტში…" aria-label="ძიება ტექსტში">' +
    '<span id="pk-n" aria-live="polite"></span>' +
    '<button type="button" class="pk-b" id="pk-up" aria-label="წინა">▲</button>' +
    '<button type="button" class="pk-b" id="pk-dn" aria-label="შემდეგი">▼</button>' +
    '<button type="button" class="pk-b" id="pk-x" aria-label="დახურვა">✕</button>';
  var cur = document.createElement("div"); cur.id = "pk-cur";
  function mount() { document.body.appendChild(btn); document.body.appendChild(bar); document.body.appendChild(cur); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  var inp = bar.querySelector("#pk-in"), cnt = bar.querySelector("#pk-n");
  var target = null, ranges = [], idx = -1, lastQ = "", dirty = true, mo = null;

  function visible(el) {
    if (!el || !el.isConnected) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }
  // ტექსტის ადგილი: გვერდის მითითება, თორემ — ფანჯარაში (fixed) გახსნილი გრძელი ტექსტი, რომელიც გადაიხვევა
  function findTarget() {
    if (typeof window.POISK_TARGET === "function") { var t = window.POISK_TARGET(); return t && visible(t) ? t : null; }
    var best = null, all = document.querySelectorAll("div,article,section,main");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.scrollHeight <= el.clientHeight + 40) continue;
      var oy = getComputedStyle(el).overflowY;
      if (oy !== "auto" && oy !== "scroll") continue;
      if (!visible(el) || bar.contains(el)) continue;
      if ((el.textContent || "").length < 600) continue;
      var p = el, fixed = false;
      while (p && p !== document.body) { if (getComputedStyle(p).position === "fixed") { fixed = true; break; } p = p.parentElement; }
      if (!fixed) continue;
      if (!best || el.textContent.length > best.textContent.length) best = el;
    }
    return best;
  }

  var BLOCK = /^(P|DIV|LI|H[1-6]|BLOCKQUOTE|SECTION|ARTICLE|TR|TD|BR)$/;
  function blockOf(n) { var p = n.parentElement; while (p && !BLOCK.test(p.tagName) && p !== target) p = p.parentElement; return p; }
  // ტექსტის კვანძები ერთ სტრიქონად; სხვადასხვა აბზაცს/სტრიქონს შორის — ჰარი
  function collect() {
    var nodes = [], s = "", w = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }), n, prevB = null;
    while ((n = w.nextNode())) {
      var b = blockOf(n), p = n.parentElement;
      if (p.closest && p.closest("[hidden],[aria-hidden=true]")) continue;
      if (prevB && b !== prevB && s && !/\s$/.test(s)) s += " ";
      nodes.push({ n: n, at: s.length }); s += n.nodeValue; prevB = b;
    }
    return { nodes: nodes, s: s };
  }
  function norm(c) { return c.toLowerCase().replace(/[„“”«»"]/g, '"').replace(/[‘’`]/g, "'").replace(/[–—]/g, "-").replace(/ё/g, "е"); }
  function pos(nodes, k, end) {   // სტრიქონის k ადგილი → (კვანძი, offset)
    var lo = 0, hi = nodes.length - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (nodes[m].at <= k - (end ? 1 : 0)) lo = m; else hi = m - 1; }
    var it = nodes[lo], o = Math.min(Math.max(k - it.at, 0), it.n.nodeValue.length);
    return [it.n, o];
  }
  function mk(rs) { var h = new Highlight(); for (var i = 0; i < rs.length; i++) h.add(rs[i]); return h; }
  function search(q) {
    ranges = []; idx = -1;
    if (HL) { CSS.highlights.delete("pk-all"); CSS.highlights.delete("pk-one"); }
    var qq = norm(q.trim());
    if (!target || qq.length < 2) return;
    var c = collect(), s = norm(c.s);
    var re = new RegExp(qq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "g"), m;
    while ((m = re.exec(s))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      var a = pos(c.nodes, m.index, false), b = pos(c.nodes, m.index + m[0].length, true), r = document.createRange();
      try { r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); ranges.push(r); } catch (e) {}
    }
    if (HL && ranges.length) CSS.highlights.set("pk-all", mk(ranges));
  }
  function scroller(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      var oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  }
  function drawCur() {   // ჩარჩო მხოლოდ იქ, სადაც CSS Highlight არ მუშაობს
    cur.innerHTML = "";
    var r = ranges[idx]; if (!r || HL) return;
    var rs = r.getClientRects();
    for (var i = 0; i < rs.length; i++) {
      var q = rs[i]; if (!q.width) continue;
      var e = document.createElement("i");
      e.style.left = (q.left - 2) + "px"; e.style.top = (q.top - 1) + "px";
      e.style.width = (q.width + 4) + "px"; e.style.height = (q.height + 2) + "px";
      cur.appendChild(e);
    }
  }
  function show() {
    var n = ranges.length;
    cnt.textContent = inp.value.trim().length < 2 ? "" : n ? (idx + 1) + "/" + n : "0";
    cnt.className = n || inp.value.trim().length < 2 ? "" : "none";
    bar.querySelector("#pk-up").disabled = bar.querySelector("#pk-dn").disabled = n < 2;
    if (HL) { if (n) CSS.highlights.set("pk-one", mk([ranges[idx]])); else CSS.highlights.delete("pk-one"); }
    drawCur();
  }
  function go(i, smooth) {
    if (!ranges.length) { show(); return; }
    idx = (i + ranges.length) % ranges.length;
    var r = ranges[idx], rect = r.getBoundingClientRect(), sc = scroller(r.startContainer.parentElement);
    var barH = bar.hidden ? 0 : bar.getBoundingClientRect().bottom;
    if (sc) {
      var box = sc.getBoundingClientRect(), top = Math.max(box.top, barH), h = box.bottom - top;
      var want = sc.scrollTop + (rect.top - top) - h / 3;
      sc.scrollTo ? sc.scrollTo({ top: want, behavior: smooth ? "smooth" : "auto" }) : (sc.scrollTop = want);
    } else {
      var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      window.scrollTo({ top: window.scrollY + rect.top - barH - (vh - barH) / 3, behavior: smooth ? "smooth" : "auto" });
    }
    show();
  }
  function run(keepPlace) {
    var q = inp.value;
    if (q === lastQ && !dirty) return;
    var was = ranges[idx]; lastQ = q; dirty = false;
    search(q);
    if (!ranges.length) { show(); return; }
    var start = 0;
    if (keepPlace && was) {   // შიგთავსი შეიცვალა — იმავე ადგილთან დარჩეს
      for (var i = 0; i < ranges.length; i++) { try { if (ranges[i].compareBoundaryPoints(Range.START_TO_START, was) >= 0) { start = i; break; } } catch (e) { break; } }
      idx = start; show(); return;
    }
    // პირველი ის, რაც ეკრანზე ჩანს ან მის შემდეგაა
    var barH = bar.getBoundingClientRect().bottom;
    for (var j = 0; j < ranges.length; j++) if (ranges[j].getBoundingClientRect().top >= barH) { start = j; break; }
    go(start, false);
  }

  var tmr = 0;
  inp.addEventListener("input", function () { clearTimeout(tmr); tmr = setTimeout(function () { run(false); }, 250); });
  inp.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(tmr); if (inp.value !== lastQ || dirty) run(false); else go(idx + (e.shiftKey ? -1 : 1), true); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  });
  bar.querySelector("#pk-dn").onclick = function () { run(true); go(idx + 1, true); };
  bar.querySelector("#pk-up").onclick = function () { run(true); go(idx - 1, true); };
  bar.querySelector("#pk-x").onclick = function () { close(); };
  // ღილაკზე დაჭერისას კლავიატურა არ დაიხუროს
  ["pk-up", "pk-dn"].forEach(function (id) { bar.querySelector("#" + id).addEventListener("mousedown", function (e) { e.preventDefault(); }); });

  function open() {
    target = findTarget(); if (!target) return;
    bar.hidden = false; btn.hidden = true;
    watch();
    inp.focus(); inp.select();
    if (inp.value.trim().length >= 2) { dirty = true; run(false); }
  }
  function close() {
    bar.hidden = true; ranges = []; idx = -1; cur.innerHTML = "";
    if (HL) { CSS.highlights.delete("pk-all"); CSS.highlights.delete("pk-one"); }
    if (mo) { mo.disconnect(); mo = null; }
    inp.blur(); dirty = true;
    tick();
  }
  function watch() {
    if (mo) mo.disconnect();
    mo = new MutationObserver(function () {
      dirty = true; clearTimeout(tmr);
      tmr = setTimeout(function () { if (!bar.hidden) run(true); }, 200);
    });
    mo.observe(target, { childList: true, subtree: true, characterData: true });
  }
  btn.onclick = open;
  window.POISK_OPEN = open;   // გვერდს თავისი ღილაკიდანაც შეუძლია გახსნა (მაშინ window.POISK_NOBTN = true)

  // ღილაკი ჩანს მხოლოდ მაშინ, როცა ტექსტია გახსნილი
  function tick() {
    var t = findTarget();
    if (!bar.hidden) {
      if (!t) { close(); return; }
      if (t !== target) { target = t; watch(); dirty = true; run(false); }
      drawCur();
      return;
    }
    btn.hidden = !t || !!window.POISK_NOBTN;
  }
  setInterval(tick, 600);
  window.addEventListener("scroll", function () { if (!bar.hidden) drawCur(); }, true);
  window.addEventListener("resize", function () { if (!bar.hidden) drawCur(); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", function () { if (!bar.hidden) drawCur(); });
})();
