/* PMP Critical Path — single-page study app (vanilla JS, no build step).
   Data: window.PMP_QUESTIONS, window.PMP_META (data/questions.js), window.PMP_GUIDE (data/study-guide.js).
   Progress is stored in localStorage under KEY and can be exported/imported as JSON. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- data
  var QUESTIONS = window.PMP_QUESTIONS || [];
  var META = window.PMP_META || {};
  var GUIDE = window.PMP_GUIDE || [];
  var QMAP = {};
  QUESTIONS.forEach(function (q) { QMAP[q.id] = q; });
  var DOMAINS = ["People", "Process", "Business Environment"];
  var DCLASS = { "People": "people", "Process": "process", "Business Environment": "biz" };
  var DCHIP = { "People": "d-people", "Process": "d-process", "Business Environment": "d-biz" };
  var WEIGHTS = META.weights || { "People": 33, "Process": 41, "Business Environment": 26 };
  var TASKS = META.eco || {};
  var LETTERS = "ABCDEF";
  var CASES = window.PMP_CASES || [];
  var CMAP = {};
  CASES.forEach(function (c) { CMAP[c.id] = c; });
  // Keep in sync with BOOK_MARKERS in scripts/build.py
  var BOOKS = [
    { key: "pmbok7", short: "PMBOK 7", title: "PMBOK® Guide — Seventh Edition", author: "Project Management Institute (2021)", re: /PMBOK Guide 7th/, guide: "13-book-pmbok7" },
    { key: "kerz", short: "PM Next Generation", title: "Project Management Next Generation", author: "Harold Kerzner, Al Zeitoun & Ricardo Viana Vargas (2022)", re: /Next Generation/, guide: "14-book-pm-next-generation" }
  ];
  var SOURCES = [{ key: "all", label: "All sources" }, { key: "eco", label: "Exam outline & agile practice" }]
    .concat(BOOKS.map(function (b) { return { key: b.key, label: "Book · " + b.title.replace("®", "") }; }));
  var KINDS = [["all", "All question types"], ["case", "Case-study sets"], ["exhibit", "Charts & tables (exhibits)"], ["calc", "Calculations"], ["multi", "Multiple response"]];
  var APPROACH_LABEL = { "Agile": "Agile", "Predictive": "Predictive", "Hybrid": "Hybrid", "Any": "Approach-neutral" };
  var SEC_PER_Q = 80; // 240 minutes / 180 questions
  var SECTION_SIZE = 60; // the full exam has two optional 10-minute breaks, after questions 60 and 120
  var BREAK_MS = 10 * 60 * 1000;
  var DAY = 86400000;
  var SRS_DAYS = [0, 1, 3, 7, 16]; // spaced-review intervals by box; box 5 = mastered

  function hasExhibit(q) { return !!(q.exhibit || (q.caseId && CMAP[q.caseId] && CMAP[q.caseId].exhibit)); }
  function kindMatch(q, k) {
    if (!k || k === "all") return true;
    if (k === "case") return !!q.caseId;
    if (k === "exhibit") return hasExhibit(q);
    if (k === "calc") return q.tags.indexOf("calculation") !== -1;
    if (k === "multi") return q.type === "multi";
    return true;
  }

  function bookOf(q) {
    for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].re.test(q.source)) return BOOKS[i];
    return null;
  }
  function sourceMatch(q, key) {
    if (key === "all") return true;
    if (key === "eco") return !bookOf(q);
    for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].key === key) return BOOKS[i].re.test(q.source);
    return true;
  }
  function taskShort(t) { var m = /^(\d+)\.\s*(.*)$/.exec(t); return m ? "Task " + m[1] + " · " + m[2] : t; }
  function taskNum(t) { var m = /^(\d+)\./.exec(t); return m ? m[1] : t; }

  // ---------------------------------------------------------------- storage
  var KEY = "pmp-critical-path-v1";
  var store = { data: null };
  function normalize(d) {
    d = d && typeof d === "object" ? d : {};
    var s = d.settings && typeof d.settings === "object" ? d.settings : {};
    return {
      v: 1,
      answers: d.answers && typeof d.answers === "object" ? d.answers : {},
      flags: d.flags && typeof d.flags === "object" ? d.flags : {},
      exams: Array.isArray(d.exams) ? d.exams : [],
      session: d.session || null,
      exam: d.exam || null,
      settings: {
        shuffle: s.shuffle !== false,
        theme: s.theme || null,
        practice: Object.assign({ domain: "all", task: "all", approach: "all", difficulty: "all", source: "all", kind: "all", status: "all", count: 10, order: "random" }, s.practice || {})
      }
    };
  }
  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { raw = null; }
    store.data = normalize(raw);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store.data)); } catch (e) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------- utils
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function pct(c, n) { return n ? Math.round((c / n) * 100) : 0; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (h ? String(m).padStart(2, "0") : String(m)), ss = String(s).padStart(2, "0");
    return (h ? h + ":" : "") + mm + ":" + ss;
  }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; }
  }
  function sameSet(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var x = a.slice().sort(), y = b.slice().sort();
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }
  function isCorrect(q, choice) { return !!(choice && choice.length) && sameSet(q.answer, choice); }
  function stripLabel(note) { return String(note).replace(/^\s*(Correct|Incorrect)\s*[—–-]\s*/i, ""); }
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // ---------------------------------------------------------------- stats
  function recordAttempt(qid, choice, correct, mode) {
    var a = store.data.answers[qid] || { n: 0, c: 0 };
    var prev = srsState(store.data.answers[qid]);
    a.n += 1; if (correct) a.c += 1;
    a.last = !!correct; a.at = Date.now(); a.choice = choice || []; a.mode = mode;
    // Spaced review (Leitner boxes): a miss puts the question in box 0 (due now);
    // each later correct answer moves it up a box and pushes the next review further out.
    if (!correct) a.box = 0;
    else if (prev) a.box = Math.min(prev.box + 1, SRS_DAYS.length);
    if (a.box != null) a.due = a.box >= SRS_DAYS.length ? null : a.at + SRS_DAYS[a.box] * DAY;
    store.data.answers[qid] = a;
  }
  function srsState(a) {
    if (!a) return null;
    if (a.box == null) { // records saved before spaced review existed
      if (!a.last) return { box: 0, due: a.at || 0 };
      if (a.n > a.c) return { box: 1, due: (a.at || 0) + DAY };
      return null;
    }
    if (a.box >= SRS_DAYS.length) return null;
    return { box: a.box, due: a.due || 0 };
  }
  function dueQuestions() {
    var now = Date.now();
    return QUESTIONS.filter(function (q) { var s = srsState(store.data.answers[q.id]); return s && s.due <= now; });
  }
  function inRotation() {
    return QUESTIONS.filter(function (q) { return !!srsState(store.data.answers[q.id]); }).length;
  }
  function overall() {
    var ids = Object.keys(store.data.answers), n = 0, c = 0;
    ids.forEach(function (id) { if (QMAP[id]) { n++; if (store.data.answers[id].last) c++; } });
    return { answered: n, correct: c, acc: pct(c, n), flagged: Object.keys(store.data.flags).filter(function (k) { return store.data.flags[k] && QMAP[k]; }).length };
  }
  function statsFor(filterFn) {
    var total = 0, answered = 0, correct = 0;
    QUESTIONS.forEach(function (q) {
      if (!filterFn(q)) return;
      total++;
      var a = store.data.answers[q.id];
      if (a) { answered++; if (a.last) correct++; }
    });
    return { total: total, answered: answered, correct: correct, acc: pct(correct, answered) };
  }
  function weakestTask() {
    var best = null;
    DOMAINS.forEach(function (d) {
      (TASKS[d] || []).forEach(function (t) {
        var s = statsFor(function (q) { return q.domain === d && q.task === t; });
        var score = s.answered >= 3 ? s.acc : 101 + s.answered; // unexplored tasks come after weak ones
        if (!best || score < best.score) best = { domain: d, task: t, score: score, s: s };
      });
    });
    return best;
  }

  // ---------------------------------------------------------------- markdown (small, dependency-free)
  function mdInline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function mdTable(rows) {
    function cells(r) { return r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); }); }
    var head = cells(rows[0]);
    var body = rows.slice(2).map(cells);
    return '<div class="table-wrap"><table><thead><tr>' + head.map(function (h) { return "<th>" + mdInline(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + body.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + mdInline(c) + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody></table></div>";
  }
  function md(src) {
    var lines = String(src).replace(/\r/g, "").split("\n"), html = "", i = 0, m;
    var blockStart = /^(#{1,4}\s|\||\s*[-*]\s+|\s*\d+\.\s+|>|---+\s*$)/;
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim()) { i++; continue; }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { var lv = Math.min(4, m[1].length); html += "<h" + lv + ">" + mdInline(m[2]) + "</h" + lv + ">"; i++; continue; }
      if (/^---+\s*$/.test(l)) { html += "<hr>"; i++; continue; }
      if (l.charAt(0) === "|") { var rows = []; while (i < lines.length && lines[i].charAt(0) === "|") { rows.push(lines[i]); i++; } html += mdTable(rows); continue; }
      if (/^\s*[-*]\s+/.test(l)) { var ul = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { ul.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; } html += "<ul>" + ul.map(function (t) { return "<li>" + mdInline(t) + "</li>"; }).join("") + "</ul>"; continue; }
      if (/^\s*\d+\.\s+/.test(l)) { var ol = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { ol.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; } html += "<ol>" + ol.map(function (t) { return "<li>" + mdInline(t) + "</li>"; }).join("") + "</ol>"; continue; }
      if (l.charAt(0) === ">") { var bq = []; while (i < lines.length && lines[i].charAt(0) === ">") { bq.push(lines[i].replace(/^>\s?/, "")); i++; } html += "<blockquote>" + mdInline(bq.join(" ")) + "</blockquote>"; continue; }
      var para = [];
      while (i < lines.length && lines[i].trim() && !blockStart.test(lines[i])) { para.push(lines[i]); i++; }
      html += "<p>" + mdInline(para.join(" ")) + "</p>";
    }
    return html;
  }

  // ---------------------------------------------------------------- UI state (not persisted)
  var ui = {
    view: "home",
    guideSlug: GUIDE.length ? GUIDE[0].slug : null,
    bank: { q: "", domain: "all", source: "all", difficulty: "all", approach: "all", kind: "all" },
    examResultId: null,
    resultFilter: "all",
    confirmSubmit: false,
    confirmReset: false,
    confirmDiscard: false,
    confirmSection: false,
    examLen: 60,
    examTimed: true,
    examUnseen: true
  };
  var viewEl = null;

  // ---------------------------------------------------------------- exhibits (tables and small SVG charts)
  function exhibitTable(ex) {
    return '<div class="table-wrap"><table class="ex-table"><thead><tr>' + ex.columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + ex.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  function niceTicks(lo, hi, count) {
    var span = hi - lo || Math.abs(hi) || 1;
    var raw = span / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw))), err = raw / mag;
    var step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    var t0 = Math.floor(lo / step) * step, ticks = [];
    for (var v = t0; v <= hi + step * 0.5; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }
  function fmtNum(v) { return Math.abs(v) >= 1000 ? v.toLocaleString() : String(Math.round(v * 100) / 100); }
  function exhibitChart(ex) {
    var W = 640, H = 300, L = 52, T = 18, B = 46;
    var R = (ex.kind === "bar" || (ex.series.length < 2 && !(ex.refLines && ex.refLines.length))) ? 24 : 124;
    var pw = W - L - R, ph = H - T - B;
    var series = ex.series.slice(0, 4), xs = ex.x, n = xs.length;
    var stacked = ex.kind === "stacked-area", bar = ex.kind === "bar";
    var vals = [];
    var cum = xs.map(function () { return 0; });
    var stacks = series.map(function (s) {
      return s.values.map(function (v, i) { var base = cum[i]; if (stacked) cum[i] += (v || 0); return stacked ? [base, cum[i]] : [0, v]; });
    });
    stacks.forEach(function (st) { st.forEach(function (p) { if (p[1] != null) vals.push(p[1]); }); });
    (ex.refLines || []).forEach(function (r) { vals.push(r.value); });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var fromZero = mn >= 0 && (stacked || bar || !(ex.refLines && ex.refLines.length));
    var lo = fromZero ? 0 : mn - (mx - mn) * 0.15, hi = mx + (mx - mn || 1) * (fromZero ? 0.08 : 0.15);
    var ticks = niceTicks(lo, hi, 5); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    function y(v) { return T + ph - (v - lo) / (hi - lo) * ph; }
    var band = pw / n;
    function x(i) { return bar ? L + band * (i + 0.5) : L + (n === 1 ? pw / 2 : pw * i / (n - 1)); }
    var g = "";
    ticks.forEach(function (t) {
      if (t < lo - 1e-9 || t > hi + 1e-9) return;
      g += '<line class="grid" x1="' + L + '" x2="' + (L + pw) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"/>' +
        '<text class="tick" x="' + (L - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + fmtNum(t) + "</text>";
    });
    var every = n > 12 ? 2 : 1;
    xs.forEach(function (lab, i) { if (i % every === 0) g += '<text class="tick" x="' + x(i).toFixed(1) + '" y="' + (T + ph + 18) + '" text-anchor="middle">' + esc(lab) + "</text>"; });
    g += '<line class="axis" x1="' + L + '" x2="' + (L + pw) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '"/>';
    if (ex.xLabel) g += '<text class="axis-label" x="' + (L + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(ex.xLabel) + "</text>";
    var marks = "", labels = [];
    if (stacked) {
      stacks.forEach(function (st, si) {
        var top = st.map(function (p, i) { return x(i).toFixed(1) + "," + y(p[1]).toFixed(1); });
        var bottom = st.map(function (p, i) { return x(i).toFixed(1) + "," + y(p[0]).toFixed(1); }).reverse();
        marks += '<polygon class="area s' + (si + 1) + '" points="' + top.concat(bottom).join(" ") + '"><title>' + esc(series[si].name) + "</title></polygon>";
        var last = st[n - 1]; labels.push({ si: si, y: y((last[0] + last[1]) / 2), text: series[si].name });
      });
    } else if (bar) {
      var k = series.length, bw = Math.min(28, (band - 12) / k - 2);
      series.forEach(function (s, si) {
        s.values.forEach(function (v, i) {
          if (v == null) return;
          var bx = x(i) - (k * (bw + 2) - 2) / 2 + si * (bw + 2), by = y(Math.max(v, 0)), bh = Math.abs(y(v) - y(0));
          var r = Math.min(4, bh / 2, bw / 2);
          marks += '<path class="bar s' + (si + 1) + '" d="M' + bx.toFixed(1) + "," + (by + bh).toFixed(1) + "V" + (by + r).toFixed(1) + "Q" + bx.toFixed(1) + "," + by.toFixed(1) + " " + (bx + r).toFixed(1) + "," + by.toFixed(1) +
            "H" + (bx + bw - r).toFixed(1) + "Q" + (bx + bw).toFixed(1) + "," + by.toFixed(1) + " " + (bx + bw).toFixed(1) + "," + (by + r).toFixed(1) + "V" + (by + bh).toFixed(1) + 'Z"><title>' + esc(s.name + " · " + xs[i] + ": " + fmtNum(v)) + "</title></path>";
        });
      });
    } else {
      series.forEach(function (s, si) {
        var d = "", pen = false, lastI = -1;
        s.values.forEach(function (v, i) { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); pen = true; lastI = i; });
        marks += '<path class="line s' + (si + 1) + '" d="' + d + '"/>';
        s.values.forEach(function (v, i) {
          if (v == null) return;
          marks += '<circle class="pt s' + (si + 1) + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="4"><title>' + esc(s.name + " · " + xs[i] + ": " + fmtNum(v)) + "</title></circle>";
        });
        if (lastI >= 0) labels.push({ si: si, y: y(s.values[lastI]), text: s.name });
      });
    }
    (ex.refLines || []).forEach(function (r) {
      marks += '<line class="ref" x1="' + L + '" x2="' + (L + pw) + '" y1="' + y(r.value).toFixed(1) + '" y2="' + y(r.value).toFixed(1) + '"/>' +
        '<text class="ref-label" x="' + (L + pw + 6) + '" y="' + (y(r.value) + 4).toFixed(1) + '">' + esc(r.label + " " + fmtNum(r.value)) + "</text>";
    });
    if (!bar && series.length > 1) { // direct end labels, nudged apart so they never collide
      labels.sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
      labels.forEach(function (l) { marks += '<text class="end-label" x="' + (L + pw + 6) + '" y="' + (l.y + 4).toFixed(1) + '">' + esc(l.text.length > 18 ? l.text.slice(0, 17) + "…" : l.text) + "</text>"; });
    }
    var legend = series.length > 1 ? '<div class="ex-legend">' + series.map(function (s, si) { return '<span><i class="sw s' + (si + 1) + (bar || stacked ? "" : " ln") + '"></i>' + esc(s.name) + "</span>"; }).join("") + "</div>" : "";
    var ylab = ex.yLabel ? '<div class="ex-ylabel">' + esc(ex.yLabel) + "</div>" : "";
    var table = '<details class="ex-data"><summary>Show the data as a table</summary>' + exhibitTable({
      columns: [ex.xLabel || ""].concat(series.map(function (s) { return s.name; })),
      rows: xs.map(function (lab, i) { return [lab].concat(series.map(function (s) { return s.values[i] == null ? "—" : fmtNum(s.values[i]); })); })
    }) + "</details>";
    return legend + ylab + '<div class="ex-scroll"><svg class="ex-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(ex.title || "Chart") + '">' + g + marks + "</svg></div>" + table;
  }
  function exhibitHtml(ex) {
    if (!ex) return "";
    var body = ex.kind === "table" ? exhibitTable(ex) : exhibitChart(ex);
    return '<figure class="exhibit"><figcaption><span class="eyebrow">Exhibit</span>' + (ex.title ? " " + esc(ex.title) : "") + "</figcaption>" + body + "</figure>";
  }
  function caseBlock(q, mode) {
    var c = q.caseId && CMAP[q.caseId];
    if (!c) return "";
    var pos = c.questionIds.indexOf(q.id) + 1;
    return '<details class="case"' + (mode === "result" ? "" : " open") + '><summary><span class="eyebrow">Case study · ' + esc(c.id) + " · question " + pos + " of " + c.questionIds.length + '</span><span class="case-title">' + esc(c.title) + "</span></summary>" +
      '<div class="case-body">' + md(c.scenario) + exhibitHtml(c.exhibit) + "</div></details>";
  }
  function groupCases(ids) {
    // keep questions from the same case study together, in the case's own order
    var inSet = {}, seen = {}, out = [];
    ids.forEach(function (id) { inSet[id] = true; });
    ids.forEach(function (id) {
      if (seen[id]) return;
      var q = QMAP[id], c = q && q.caseId && CMAP[q.caseId];
      var group = c ? c.questionIds.filter(function (x) { return inSet[x]; }) : [id];
      group.forEach(function (x) { if (!seen[x]) { seen[x] = true; out.push(x); } });
    });
    return out;
  }

  // ---------------------------------------------------------------- question card
  function orderFor(q, stored) {
    if (stored && stored.length === q.options.length) return stored;
    return range(q.options.length);
  }
  function questionCard(q, o) {
    // o: { mode: 'practice'|'exam'|'result', choice, revealed, hint, order, number, total, flagged }
    var order = orderFor(q, o.order);
    var choice = o.choice || [];
    var revealed = !!o.revealed;
    var multi = q.type === "multi";
    var book = bookOf(q);
    var head =
      '<div class="qcard-head">' +
      '<span class="chip chip-id">' + esc(q.id) + "</span>" +
      '<span class="chip ' + DCHIP[q.domain] + '"><span class="dot"></span>' + esc(q.domain) + "</span>" +
      '<span class="chip">' + esc(taskShort(q.task)) + "</span>" +
      '<span class="chip">' + esc(APPROACH_LABEL[q.approach] || q.approach) + "</span>" +
      '<span class="chip">' + esc(q.difficulty) + "</span>" +
      (book ? '<span class="chip">Book · ' + esc(book.short) + "</span>" : "") +
      (q.caseId ? '<span class="chip">Case study</span>' : "") +
      '<span class="spacer"></span>' +
      (o.flagged ? '<span class="chip flag">Flagged</span>' : "") +
      (o.number ? '<span class="chip mono">' + o.number + " / " + o.total + "</span>" : "") +
      "</div>";

    var opts = order.map(function (orig, pos) {
      var selected = choice.indexOf(orig) !== -1;
      var cls = "opt" + (multi ? " multi" : "");
      var tag = "", note = "";
      if (revealed) {
        cls += " locked";
        var right = q.answer.indexOf(orig) !== -1;
        if (right) { cls += " is-correct"; tag = '<span class="tag">' + (selected ? "Your answer · correct" : "Correct answer") + "</span>"; }
        else if (selected) { cls += " is-wrong"; tag = '<span class="tag">Your answer</span>'; }
        note = '<span class="note">' + esc(stripLabel(q.optionNotes[orig])) + "</span>";
      } else if (o.mode === "result") {
        cls += " locked";
      }
      return '<li><button type="button" class="' + cls + '" data-act="opt" data-idx="' + orig + '" aria-pressed="' + (selected ? "true" : "false") + '"' + (revealed || o.mode === "result" ? ' aria-disabled="true"' : "") + ">" +
        '<span class="letter">' + LETTERS[pos] + "</span>" +
        "<span>" + esc(q.options[orig]) + tag + note + "</span></button></li>";
    }).join("");

    var hintHtml = (o.hint && o.mode !== "exam") ? '<div class="hint-box"><b>Hint</b> — ' + esc(q.hint) + "</div>" : "";
    var verdict = "", explain = "";
    if (revealed) {
      var correctLetters = order.map(function (orig, pos) { return q.answer.indexOf(orig) !== -1 ? LETTERS[pos] : null; }).filter(Boolean).join(" and ");
      var ok = isCorrect(q, choice);
      var big = ok ? "Correct" : (choice.length ? "Not quite" : "Answer revealed");
      verdict = '<div class="verdict ' + (ok ? "good" : "bad") + '" role="status"><span class="big">' + big + '</span><span class="sub">The answer is ' + correctLetters + ".</span></div>";
      explain =
        '<div class="explain">' +
        '<section class="why"><h4>Why this is the answer</h4><p>' + esc(q.why) + "</p></section>" +
        '<section class="how"><h4>How to approach it</h4><p>' + esc(q.how) + "</p></section>" +
        '<section class="deep"><h4>Go deeper</h4><p>' + esc(q.deepDive) + "</p></section>" +
        '<div class="source-line"><span>Source: ' + esc(q.source) + "</span>" + q.tags.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") + "</div>" +
        "</div>";
    }

    var actions = "";
    if (o.mode === "practice") {
      actions = '<div class="qactions">' +
        (!revealed && !o.hint ? '<button class="btn" data-act="hint">Hint <kbd>H</kbd></button>' : "") +
        (!revealed ? '<button class="btn btn-primary" data-act="reveal">Reveal answer <kbd>R</kbd></button>' : "") +
        '<button class="btn btn-ghost" data-act="flag">' + (o.flagged ? "Unflag" : "Flag") + " <kbd>F</kbd></button>" +
        '<span class="spacer"></span>' +
        '<button class="btn" data-act="prev"' + (o.number <= 1 ? " disabled" : "") + '>← Prev</button>' +
        (o.number >= o.total ? '<button class="btn btn-primary" data-act="finish">Finish session</button>' : '<button class="btn' + (revealed ? " btn-primary" : "") + '" data-act="next">Next →</button>') +
        "</div>";
    } else if (o.mode === "exam") {
      actions = '<div class="qactions">' +
        '<button class="btn btn-ghost" data-act="flag">' + (o.flagged ? "Unflag" : "Flag for review") + " <kbd>F</kbd></button>" +
        '<span class="spacer"></span>' +
        '<button class="btn" data-act="prev"' + (o.number <= 1 || o.sectionStart ? " disabled" : "") + '>← Prev</button>' +
        (o.number >= o.total ? '<button class="btn btn-primary" data-act="exam-review">Review &amp; submit</button>'
          : (o.sectionEnd ? '<button class="btn btn-primary" data-act="exam-end-section">End section →</button>' : '<button class="btn btn-primary" data-act="next">Next →</button>')) +
        "</div>";
    }

    var instr = multi ? '<p class="qinstr">Select ' + q.answer.length + " answers.</p>" : "";
    return '<article class="panel qcard">' + head +
      '<div class="qcard-body">' + caseBlock(q, o.mode) + '<p class="qtext">' + esc(q.question) + "</p>" + exhibitHtml(q.exhibit) + instr +
      '<ul class="opts" role="list">' + opts + "</ul>" + hintHtml + verdict + explain + "</div>" + actions + "</article>";
  }

  // ---------------------------------------------------------------- sessions
  function makeOrder(q) { return store.data.settings.shuffle ? shuffle(range(q.options.length)) : range(q.options.length); }
  function startPractice(ids, label) {
    if (!ids.length) { toast("No questions match those filters."); return; }
    ids = groupCases(ids);
    var order = {};
    ids.forEach(function (id) { order[id] = makeOrder(QMAP[id]); });
    store.data.session = { ids: ids, idx: 0, resp: {}, order: order, label: label || "Practice session", startedAt: Date.now(), done: false };
    save();
    go("practice");
  }
  function applyFilters(f) {
    var ans = store.data.answers, flags = store.data.flags;
    return QUESTIONS.filter(function (q) {
      if (f.domain !== "all" && q.domain !== f.domain) return false;
      if (f.task !== "all" && q.task !== f.task) return false;
      if (f.approach !== "all" && q.approach !== f.approach) return false;
      if (f.difficulty !== "all" && q.difficulty !== f.difficulty) return false;
      if (!sourceMatch(q, f.source)) return false;
      if (!kindMatch(q, f.kind)) return false;
      var a = ans[q.id];
      if (f.status === "new" && a) return false;
      if (f.status === "missed" && !(a && !a.last)) return false;
      if (f.status === "correct" && !(a && a.last)) return false;
      if (f.status === "flagged" && !flags[q.id]) return false;
      if (f.status === "due") { var st = srsState(a); if (!(st && st.due <= Date.now())) return false; }
      return true;
    });
  }
  function curSession() { var s = store.data.session; return s && s.ids && s.ids.length ? s : null; }

  // ---------------------------------------------------------------- views: home
  function renderHome() {
    var o = overall();
    var s = curSession();
    var weak = weakestTask();
    var due = dueQuestions().length;
    var sessionBtn = (s && !s.done) ? '<button class="btn btn-primary" data-act="resume"><span>Continue: ' + esc(s.label) + " (" + (s.idx + 1) + "/" + s.ids.length + ")</span><span>→</span></button>" : "";
    var examBtn = store.data.exam ? '<button class="btn btn-primary" data-act="nav" data-view="exam"><span>Return to your exam in progress</span><span>→</span></button>' : "";
    var domainCards = DOMAINS.map(function (d) {
      var st = statsFor(function (q) { return q.domain === d; });
      return '<div class="panel domain-card ' + DCLASS[d] + '">' +
        '<div class="dc-top"><div class="eyebrow">Domain · exam weight</div><div class="weight num">' + WEIGHTS[d] + "%</div></div>" +
        "<h3>" + esc(d) + "</h3>" +
        '<div class="row muted num" style="justify-content:space-between;font-size:var(--fs-sm)"><span>' + st.total + " questions · " + (TASKS[d] || []).length + " tasks</span><span>" + st.answered + " answered · " + (st.answered ? st.acc + "% correct" : "no attempts yet") + "</span></div>" +
        '<div class="bar" title="Coverage"><span style="width:' + pct(st.answered, st.total) + '%"></span></div>' +
        "<ul>" + (TASKS[d] || []).map(function (t) { return "<li>" + esc(t.replace(/^\d+\.\s*/, "")) + "</li>"; }).join("") + "</ul>" +
        '<div class="row"><button class="btn" data-act="drill-domain" data-domain="' + esc(d) + '">Practice ' + esc(d) + "</button></div></div>";
    }).join("");
    var bookCards = BOOKS.map(function (b) {
      var n = QUESTIONS.filter(function (q) { return b.re.test(q.source); }).length;
      return '<div class="panel book"><div class="eyebrow">Book · ' + n + ' questions</div><div class="t">' + esc(b.title) + '</div><div class="a">' + esc(b.author) + '</div>' +
        '<div class="row"><button class="btn" data-act="practice-book" data-book="' + b.key + '">Practice</button><button class="btn btn-ghost" data-act="guide" data-slug="' + b.guide + '">Read summary</button></div></div>';
    }).join("");
    viewEl.innerHTML =
      '<section class="home-hero">' +
      '<div class="panel hero-card">' +
      '<div class="eyebrow">PMP · 2026 Exam Content Outline · ' + QUESTIONS.length + " questions</div>" +
      "<h1>Find your <em>critical path</em> to the PMP</h1>" +
      '<p class="lede">Every question maps to one of the 26 tasks in the 2026 exam outline. Pick an answer, ask for a hint if you need one, and reveal the answer only when you are ready — then read why each option is right or wrong.</p>' +
      pathDiagram() +
      "</div>" +
      '<div class="panel panel-pad quick"><h3>Start here</h3>' + sessionBtn + examBtn +
      (due ? '<button class="btn" data-act="practice-due"><span>Spaced review: ' + due + " due today</span><span>→</span></button>" : "") +
      '<button class="btn" data-act="quick-random"><span>Practice 10 random questions</span><span>→</span></button>' +
      '<button class="btn" data-act="quick-new"><span>10 questions you have not seen</span><span>→</span></button>' +
      (CASES.length ? '<button class="btn" data-act="quick-case"><span>Work through a case study</span><span>→</span></button>' : "") +
      (weak ? '<button class="btn" data-act="drill-task" data-domain="' + esc(weak.domain) + '" data-task="' + esc(weak.task) + '"><span>Drill ' + (weak.s.answered >= 3 ? "your weakest task" : "next task") + ": " + esc(weak.domain === "Business Environment" ? "Bus. Env." : weak.domain) + " " + esc(taskNum(weak.task)) + "</span><span>→</span></button>" : "") +
      '<button class="btn" data-act="quick-exam"><span>60-question timed simulation</span><span>→</span></button>' +
      '<button class="btn btn-ghost" data-act="guide" data-slug="02-pmi-mindset"><span>Read: How to think like PMI</span><span>→</span></button>' +
      "</div></section>" +
      '<div class="stat-row" style="margin-bottom:20px">' +
      stat(o.answered + '<span class="muted" style="font-size:1rem"> / ' + QUESTIONS.length + "</span>", "Questions answered") +
      stat(o.answered ? o.acc + "%" : "—", "Accuracy (last attempt)") +
      stat(o.flagged, "Flagged for review") +
      stat(store.data.exams.length, "Simulations taken") +
      "</div>" +
      '<div class="view-head"><div><div class="eyebrow">Exam blueprint</div><h2 class="view-title" style="font-size:var(--fs-xl)">Three domains, weighted like the real exam</h2></div></div>' +
      '<div class="grid-3" style="margin-bottom:28px">' + domainCards + "</div>" +
      '<div class="view-head"><div><div class="eyebrow">From your reading list</div><h2 class="view-title" style="font-size:var(--fs-xl)">Book-based questions</h2><p class="lede">Each of these questions applies an idea from one of your project-management books to an original exam-style scenario: the PMBOK Guide\'s principles and performance domains, and Kerzner\'s ten pillars of project-management excellence. Everything else is written straight from the 2026 exam outline and the Agile Practice Guide.</p></div></div>' +
      '<div class="grid-2 books">' + bookCards + "</div>";
  }
  function stat(v, k) { return '<div class="stat"><span class="v">' + v + '</span><span class="k">' + esc(k) + "</span></div>"; }
  function pathDiagram() {
    // The study route as a small network diagram: a real sequence, highlighted like a critical path.
    var nodes = [["Learn", 20], ["Practice", 110], ["Review", 200], ["Simulate", 290], ["Pass", 380]];
    var line = nodes.slice(0, -1).map(function (n, i) {
      return '<line x1="' + (n[1] + 9) + '" y1="26" x2="' + (nodes[i + 1][1] - 9) + '" y2="26" stroke="var(--accent)" stroke-width="2.5"/>';
    }).join("");
    var circles = nodes.map(function (n, i) {
      var last = i === nodes.length - 1;
      return '<circle cx="' + n[1] + '" cy="26" r="' + (last ? 9 : 7) + '" fill="' + (last ? "var(--accent)" : "var(--surface)") + '" stroke="var(--accent)" stroke-width="2.5"/>' +
        '<text x="' + n[1] + '" y="52" text-anchor="middle">' + n[0] + "</text>";
    }).join("");
    return '<svg class="path-diagram" viewBox="0 0 400 60" role="img" aria-label="Study route: learn, practice, review, simulate, pass">' + line + circles + "</svg>";
  }

  // ---------------------------------------------------------------- views: practice
  function renderPractice() {
    var s = curSession();
    if (s && !s.done) return renderSession(s);
    if (s && s.done) return renderSessionSummary(s);
    renderPracticeSetup();
  }
  function optionTags(list, cur) {
    return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("");
  }
  function renderPracticeSetup() {
    var f = store.data.settings.practice;
    var tasks = f.domain === "all" ? [] : (TASKS[f.domain] || []);
    if (f.task !== "all" && tasks.indexOf(f.task) === -1) f.task = "all";
    var pool = applyFilters(f);
    var byDomain = DOMAINS.map(function (d) { return [d, pool.filter(function (q) { return q.domain === d; }).length]; });
    var countLabel = f.count === "all" ? pool.length : Math.min(Number(f.count), pool.length);
    viewEl.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Practice</div><h1 class="view-title">Build a practice set</h1><p class="lede">Choosing an option only marks your pick. Nothing tells you if it is right until you press Reveal answer.</p></div></div>' +
      '<div class="split">' +
      '<aside class="panel filters" aria-label="Filters">' +
      field("Domain", '<select id="f-domain" data-filter="domain">' + optionTags([["all", "All domains"]].concat(DOMAINS.map(function (d) { return [d, d + " (" + WEIGHTS[d] + "%)"]; })), f.domain) + "</select>") +
      field("ECO task", '<select id="f-task" data-filter="task"' + (f.domain === "all" ? " disabled" : "") + ">" + optionTags([["all", f.domain === "all" ? "Pick a domain first" : "All tasks"]].concat(tasks.map(function (t) { return [t, t]; })), f.task) + "</select>") +
      field("Approach", '<select id="f-approach" data-filter="approach">' + optionTags([["all", "All approaches"], ["Agile", "Agile"], ["Hybrid", "Hybrid"], ["Predictive", "Predictive"], ["Any", "Approach-neutral"]], f.approach) + "</select>") +
      field("Difficulty", '<select id="f-difficulty" data-filter="difficulty">' + optionTags([["all", "All levels"], ["Easy", "Easy"], ["Medium", "Medium"], ["Hard", "Hard"]], f.difficulty) + "</select>") +
      field("Source", '<select id="f-source" data-filter="source">' + optionTags(SOURCES.map(function (s) { return [s.key, s.label]; }), f.source) + "</select>") +
      field("Question type", '<select id="f-kind" data-filter="kind">' + optionTags(KINDS, f.kind) + "</select>") +
      field("Your history", '<select id="f-status" data-filter="status">' + optionTags([["all", "All questions"], ["new", "Not answered yet"], ["missed", "Missed last time"], ["due", "Due for spaced review"], ["correct", "Correct last time"], ["flagged", "Flagged"]], f.status) + "</select>") +
      field("Questions", '<select id="f-count" data-filter="count">' + optionTags([["10", "10"], ["25", "25"], ["50", "50"], ["all", "All matching"]], f.count) + "</select>") +
      field("Order", '<select id="f-order" data-filter="order">' + optionTags([["random", "Random"], ["sequential", "By ID"]], f.order) + "</select>") +
      '<label class="toggle"><input type="checkbox" id="f-shuffle" data-setting="shuffle"' + (store.data.settings.shuffle ? " checked" : "") + "> Shuffle answer options</label>" +
      "</aside>" +
      '<section class="stack">' +
      '<div class="panel panel-pad stack">' +
      '<div class="row" style="justify-content:space-between;align-items:end"><div><div class="eyebrow">Matching questions</div><div class="count num" style="font-family:var(--font-display);font-weight:700;font-size:2.4rem;line-height:1">' + pool.length + '</div></div>' +
      '<button class="btn btn-primary" data-act="start-practice"' + (pool.length ? "" : " disabled") + ">Start " + countLabel + " question" + (countLabel === 1 ? "" : "s") + " →</button></div>" +
      byDomain.map(function (x) {
        return '<div class="stack" style="gap:4px"><div class="row" style="justify-content:space-between;font-size:var(--fs-sm)"><span>' + esc(x[0]) + '</span><span class="num muted">' + x[1] + '</span></div><div class="bar" style="--dcolor:var(--' + (DCLASS[x[0]] === "biz" ? "biz" : DCLASS[x[0]]) + ')"><span style="width:' + pct(x[1], pool.length || 1) + '%"></span></div></div>';
      }).join("") +
      "</div>" +
      '<div class="panel panel-pad stack"><h3>How practice works</h3>' +
      '<ol style="margin:0;padding-left:20px;color:var(--ink-2)"><li>Read the scenario and choose an option (or two, when asked). Your pick is highlighted but not graded.</li>' +
      "<li>Stuck? Press <b>Hint</b> for a nudge toward the principle being tested.</li>" +
      "<li>Press <b>Reveal answer</b> to see the correct option, whether you got it, and a note on every option.</li>" +
      "<li>Read <b>Why</b>, <b>How to approach it</b>, and <b>Go deeper</b>. Flag anything you guessed.</li></ol>" +
      '<p class="shortcuts"><span><span class="kbd">A–D</span> choose</span><span><span class="kbd">H</span> hint</span><span><span class="kbd">R</span> reveal</span><span><span class="kbd">F</span> flag</span><span><span class="kbd">←</span> <span class="kbd">→</span> move</span></p></div>' +
      "</section></div>";
  }
  function field(label, control) { return '<div class="field"><span class="label">' + esc(label) + "</span>" + control + "</div>"; }

  function sessionPips(s, isExam) {
    var b = isExam ? secBounds(s) : { start: 0, end: s.ids.length };
    return '<div class="pips" role="list">' + s.ids.map(function (id, i) {
      var r = s.resp[id] || {};
      var cls = "pip";
      if (i < b.start || i >= b.end) return ""; // only the current exam section is navigable
      if (isExam) { if (r.choice && r.choice.length) cls += " answered"; }
      else if (r.revealed) cls += isCorrect(QMAP[id], r.choice) ? " good" : " bad";
      else if (r.choice && r.choice.length) cls += " answered";
      var flagged = isExam ? (s.flags && s.flags[id]) : store.data.flags[id];
      if (flagged) cls += " flagged";
      if (i === s.idx) cls += " current";
      return '<button class="' + cls + '" data-act="goto" data-i="' + i + '" aria-label="Question ' + (i + 1) + '">' + (i + 1) + "</button>";
    }).join("") + "</div>";
  }
  function renderSession(s) {
    var id = s.ids[s.idx], q = QMAP[id];
    if (!q) { s.done = true; save(); return renderPractice(); }
    var r = s.resp[id] || {};
    var revealedCount = s.ids.filter(function (x) { return s.resp[x] && s.resp[x].revealed; }).length;
    viewEl.innerHTML =
      '<div class="session-bar">' +
      '<div><div class="eyebrow">Practice</div><div style="font-weight:600">' + esc(s.label) + "</div></div>" +
      '<div class="progress"><div class="bar"><span style="width:' + pct(revealedCount, s.ids.length) + '%"></span></div><div class="muted num" style="font-size:var(--fs-xs);margin-top:4px">' + revealedCount + " of " + s.ids.length + " revealed</div></div>" +
      '<button class="btn btn-ghost" data-act="end-session">End session</button></div>' +
      questionCard(q, { mode: "practice", choice: r.choice, revealed: r.revealed, hint: r.hint, order: s.order[id], number: s.idx + 1, total: s.ids.length, flagged: !!store.data.flags[id] }) +
      (s.ids.length > 1 ? '<div class="panel panel-pad" style="margin-top:16px"><div class="eyebrow" style="margin-bottom:8px">Jump to question</div>' + sessionPips(s, false) + "</div>" : "") +
      '<p class="shortcuts"><span><span class="kbd">A–D</span> choose</span><span><span class="kbd">H</span> hint</span><span><span class="kbd">R</span> reveal</span><span><span class="kbd">F</span> flag</span><span><span class="kbd">←</span> <span class="kbd">→</span> move</span></p>';
  }
  function renderSessionSummary(s) {
    var rows = s.ids.map(function (id, i) {
      var q = QMAP[id]; if (!q) return "";
      var r = s.resp[id] || {};
      var st = !r.revealed ? '<span class="chip">Skipped</span>' : (isCorrect(q, r.choice) ? '<span class="chip good">Correct</span>' : '<span class="chip bad">Missed</span>');
      return '<div class="list-item"><span class="chip chip-id">' + esc(id) + '</span><div><div class="t">' + esc(q.topic) + '</div><div class="s">' + esc(q.domain) + " · " + esc(taskShort(q.task)) + "</div></div>" +
        '<div class="row">' + st + '<button class="btn btn-ghost" data-act="goto-review" data-i="' + i + '">Open</button></div></div>';
    }).join("");
    var revealed = s.ids.filter(function (id) { return s.resp[id] && s.resp[id].revealed; });
    var correct = revealed.filter(function (id) { return isCorrect(QMAP[id], s.resp[id].choice); });
    var missed = revealed.filter(function (id) { return !isCorrect(QMAP[id], s.resp[id].choice); });
    viewEl.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Session complete</div><h1 class="view-title">' + esc(s.label) + "</h1></div></div>" +
      '<div class="grid-2" style="margin-bottom:16px"><div class="panel panel-pad stack"><div class="eyebrow">Score on revealed questions</div><div class="score-big">' + pct(correct.length, revealed.length) + '%</div><div class="muted">' + correct.length + " correct of " + revealed.length + " revealed · " + (s.ids.length - revealed.length) + " skipped</div></div>" +
      '<div class="panel panel-pad stack"><h3>Next steps</h3>' +
      (missed.length ? '<button class="btn btn-primary" data-act="retry-missed">Retry the ' + missed.length + " missed →</button>" : "") +
      '<button class="btn" data-act="new-session">Build a new set</button>' +
      '<button class="btn btn-ghost" data-act="nav" data-view="progress">See progress by task</button></div></div>' +
      '<div class="panel list">' + rows + "</div>";
  }

  // ---------------------------------------------------------------- views: exam
  function breakUsedMs(e) { return e.onBreak ? Math.min(Date.now() - e.onBreak, BREAK_MS) : 0; }
  function examElapsed(e) { return (Date.now() - e.startedAt - (e.pausedMs || 0) - breakUsedMs(e)) / 1000; }
  function examRemaining(e) {
    var elapsed = examElapsed(e);
    return e.timed ? e.durationSec - elapsed : elapsed;
  }
  function secBounds(e) {
    if (!e.sections) return { start: 0, end: e.ids.length, sec: 0, count: 1 };
    var start = 0;
    for (var i = 0; i < e.sec; i++) start += e.sections[i];
    return { start: start, end: start + e.sections[e.sec], sec: e.sec, count: e.sections.length };
  }
  function pickExamIds(n, preferUnseen) {
    var answered = function (q) { return !!store.data.answers[q.id]; };
    // 1) case-study sets: about one per 50 questions, kept together like the real exam's case items
    var nCases = Math.min(CASES.length, Math.floor(n / 50));
    var caseRank = shuffle(CASES);
    if (preferUnseen) caseRank.sort(function (a, b) {
      return a.questionIds.filter(function (id) { return QMAP[id] && answered(QMAP[id]); }).length - b.questionIds.filter(function (id) { return QMAP[id] && answered(QMAP[id]); }).length;
    });
    var blocks = caseRank.slice(0, nCases).map(function (c) { return c.questionIds.filter(function (id) { return QMAP[id]; }); });
    var taken = {}; DOMAINS.forEach(function (d) { taken[d] = 0; });
    blocks.forEach(function (b) { b.forEach(function (id) { taken[QMAP[id].domain]++; }); });
    // 2) the rest by ECO weight (largest-remainder allocation), net of the case questions
    var raw = DOMAINS.map(function (d) { return { d: d, x: n * WEIGHTS[d] / 100 }; });
    raw.forEach(function (r) { r.k = Math.floor(r.x); r.f = r.x - r.k; });
    var left = n - raw.reduce(function (a, r) { return a + r.k; }, 0);
    raw.slice().sort(function (a, b) { return b.f - a.f; }).slice(0, left).forEach(function (r) { r.k++; });
    var singles = [];
    raw.forEach(function (r) {
      var pool = QUESTIONS.filter(function (q) { return q.domain === r.d && !q.caseId; });
      var ordered = preferUnseen ? shuffle(pool.filter(function (q) { return !answered(q); })).concat(shuffle(pool.filter(answered))) : shuffle(pool);
      ordered.slice(0, Math.max(0, r.k - taken[r.d])).forEach(function (q) { singles.push([q.id]); });
    });
    var total = singles.length + blocks.reduce(function (a, b) { return a + b.length; }, 0);
    // 3) arrange: in a full exam each case block sits inside one 60-question section
    if (n >= SECTION_SIZE * 3 && total === n) {
      var secs = [[], [], []], room = [SECTION_SIZE, SECTION_SIZE, SECTION_SIZE];
      blocks.forEach(function (b) { var s = room.indexOf(Math.max.apply(null, room)); secs[s].push(b); room[s] -= b.length; });
      var si = 0;
      shuffle(singles).forEach(function (u) { while (room[si] <= 0) si++; secs[si].push(u); room[si]--; });
      return secs.map(function (s) { return [].concat.apply([], shuffle(s)); }).reduce(function (a, b) { return a.concat(b); }, []);
    }
    return [].concat.apply([], shuffle(singles.concat(blocks)));
  }
  function startExam(n, timed, preferUnseen) {
    var ids = pickExamIds(n, preferUnseen);
    var order = {};
    ids.forEach(function (id) { order[id] = makeOrder(QMAP[id]); });
    var sections = ids.length >= SECTION_SIZE * 3 ? [SECTION_SIZE, SECTION_SIZE, ids.length - SECTION_SIZE * 2] : null;
    store.data.exam = { ids: ids, idx: 0, resp: {}, flags: {}, order: order, startedAt: Date.now(), timed: !!timed, durationSec: ids.length * SEC_PER_Q, sections: sections, sec: 0, pausedMs: 0, onBreak: null };
    ui.confirmSubmit = false; ui.confirmSection = false;
    save();
    go("exam");
  }
  function endSection() {
    var e = store.data.exam; if (!e || !e.sections || e.sec >= e.sections.length - 1) return;
    e.sec++;
    e.idx = secBounds(e).start;
    e.onBreak = Date.now();
    ui.confirmSection = false;
    save(); render(); scrollTop();
  }
  function resumeFromBreak() {
    var e = store.data.exam; if (!e || !e.onBreak) return;
    e.pausedMs = (e.pausedMs || 0) + breakUsedMs(e);
    e.onBreak = null;
    save(); render(); scrollTop();
  }
  function renderBreak(e) {
    var used = breakUsedMs(e), left = Math.max(0, BREAK_MS - used);
    viewEl.innerHTML =
      '<div class="panel panel-pad break-card stack">' +
      '<div class="eyebrow">Section ' + e.sec + " of " + e.sections.length + " complete</div>" +
      '<h1 class="view-title">Optional 10-minute break</h1>' +
      '<p class="lede">You cannot return to the questions in the section you just finished — the real PMP exam works the same way. The exam clock is paused for up to 10 minutes; after that it resumes even if you are still on this screen.</p>' +
      '<div class="row" style="align-items:baseline;gap:24px"><div><div class="eyebrow">Break time left</div><span class="timer" id="breakTimer">' + fmtTime(left / 1000) + '</span></div>' +
      '<div><div class="eyebrow">Exam time left</div><span class="timer" id="timer">' + fmtTime(examRemaining(e)) + "</span></div></div>" +
      '<div class="row"><button class="btn btn-primary" data-act="exam-resume">Start section ' + (e.sec + 1) + " →</button></div></div>";
  }
  function submitExam() {
    var e = store.data.exam; if (!e) return;
    var byDomain = {}; DOMAINS.forEach(function (d) { byDomain[d] = { c: 0, n: 0 }; });
    var correct = 0;
    var items = e.ids.map(function (id) {
      var q = QMAP[id], r = e.resp[id] || {}, ok = isCorrect(q, r.choice);
      if (ok) correct++;
      byDomain[q.domain].n++; if (ok) byDomain[q.domain].c++;
      recordAttempt(id, r.choice || [], ok, "exam");
      return { id: id, choice: r.choice || [], order: e.order[id], flagged: !!e.flags[id], ok: ok };
    });
    var used = Math.min(examElapsed(e), e.timed ? e.durationSec : Infinity);
    var result = { id: "X" + Date.now(), date: Date.now(), n: e.ids.length, correct: correct, score: pct(correct, e.ids.length), usedSec: Math.round(used), timed: e.timed, byDomain: byDomain, items: items };
    store.data.exams.unshift(result);
    store.data.exams = store.data.exams.slice(0, 30);
    store.data.exam = null;
    ui.examResultId = result.id; ui.resultFilter = "all"; ui.confirmSubmit = false;
    save();
    render();
  }
  function renderExam() {
    var e = store.data.exam;
    if (e) return renderExamRunner(e);
    if (ui.examResultId) {
      var res = store.data.exams.filter(function (x) { return x.id === ui.examResultId; })[0];
      if (res) return renderExamResult(res);
    }
    renderExamSetup();
  }
  function renderExamSetup() {
    var lens = [30, 60, 90, 180];
    var hist = store.data.exams.slice(0, 8).map(function (x) {
      return '<tr class="clickable" data-act="open-result" data-id="' + x.id + '"><td>' + fmtDate(x.date) + '</td><td class="num">' + x.n + '</td><td class="num"><span class="heat ' + heatClass(x.score, 1) + '">' + x.score + '%</span></td><td class="num">' + fmtTime(x.usedSec) + "</td></tr>";
    }).join("");
    viewEl.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Exam simulation</div><h1 class="view-title">Sit a timed practice exam</h1><p class="lede">Questions are drawn in the real exam\'s domain mix (33% People, 41% Process, 26% Business Environment). No hints and no answers until you submit — then you get a full review.</p></div></div>' +
      '<div class="grid-2">' +
      '<div class="panel panel-pad stack">' +
      '<div class="field"><span class="label">Length</span><div class="seg" role="group" aria-label="Exam length">' + lens.map(function (n) { return '<button data-act="exam-len" data-n="' + n + '" aria-pressed="' + (ui.examLen === n) + '">' + n + (n === 180 ? " · full" : "") + "</button>"; }).join("") + "</div></div>" +
      '<p class="muted num">' + ui.examLen + " questions · " + (ui.examTimed ? fmtTime(ui.examLen * SEC_PER_Q) + " (80 seconds per question, the real exam's pace)" : "untimed") +
      (ui.examLen >= 180 ? " · three 60-question sections with two optional 10-minute breaks; a finished section is closed, as on the real exam" : "") +
      (Math.floor(ui.examLen / 50) ? " · includes " + Math.min(CASES.length, Math.floor(ui.examLen / 50)) + " case-study set" + (Math.floor(ui.examLen / 50) > 1 ? "s" : "") : "") + "</p>" +
      '<label class="toggle"><input type="checkbox" id="exam-timed" data-act="exam-timed"' + (ui.examTimed ? " checked" : "") + "> Timed</label>" +
      '<label class="toggle"><input type="checkbox" id="exam-unseen" data-act="exam-unseen"' + (ui.examUnseen ? " checked" : "") + "> Prefer questions I have not answered yet</label>" +
      '<div class="row"><button class="btn btn-primary" data-act="start-exam">Start ' + ui.examLen + "-question exam →</button></div>" +
      "</div>" +
      '<div class="panel panel-pad stack"><h3>Readiness target</h3><p class="muted">PMI does not publish a passing score. Many candidates aim for <b>75% or better</b> on two consecutive 60-question simulations, with no domain under 70%, before booking the exam.</p>' +
      (hist ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Qs</th><th class="num">Score</th><th class="num">Time</th></tr></thead><tbody>' + hist + "</tbody></table></div>" : '<p class="muted">Your results will appear here.</p>') +
      "</div></div>";
  }
  function renderExamRunner(e) {
    if (e.onBreak) return renderBreak(e);
    var b = secBounds(e);
    if (e.idx < b.start || e.idx >= b.end) e.idx = b.start;
    var id = e.ids[e.idx], q = QMAP[id], r = e.resp[id] || {};
    var isAns = function (x) { return e.resp[x] && e.resp[x].choice && e.resp[x].choice.length; };
    var answered = e.ids.filter(isAns).length;
    var flagged = Object.keys(e.flags).filter(function (k) { return e.flags[k]; }).length;
    var secIds = e.ids.slice(b.start, b.end);
    var secOpen = secIds.filter(function (x) { return !isAns(x); }).length, secFlag = secIds.filter(function (x) { return e.flags[x]; }).length;
    var lastSection = b.sec >= b.count - 1;
    var rem = examRemaining(e);
    var confirm = "";
    if (ui.confirmSubmit && lastSection) confirm = '<div class="confirm" style="margin-top:14px"><span><b>Submit now?</b> ' + (e.ids.length - answered) + " unanswered · " + flagged + ' flagged.</span><span style="flex:1"></span><button class="btn" data-act="exam-cancel-submit">Keep working</button><button class="btn btn-primary" data-act="exam-submit">Submit exam</button></div>';
    else if (ui.confirmSection && !lastSection) confirm = '<div class="confirm" style="margin-top:14px"><span><b>End section ' + (b.sec + 1) + "?</b> " + secOpen + " unanswered · " + secFlag + " flagged in this section. You won't be able to return to questions " + (b.start + 1) + "–" + b.end + '.</span><span style="flex:1"></span><button class="btn" data-act="exam-cancel-submit">Keep reviewing</button><button class="btn btn-primary" data-act="exam-section-confirm">End section &amp; take break</button></div>';
    viewEl.innerHTML =
      '<div class="session-bar">' +
      '<div><div class="eyebrow">Exam simulation' + (e.sections ? " · section " + (b.sec + 1) + " of " + b.count : "") + '</div><div style="font-weight:600">' + e.ids.length + " questions</div></div>" +
      '<div class="progress"><div class="bar"><span style="width:' + pct(answered, e.ids.length) + '%"></span></div><div class="muted num" style="font-size:var(--fs-xs);margin-top:4px">' + answered + " answered · " + flagged + " flagged</div></div>" +
      '<span class="timer' + (e.timed && rem < 300 ? " low" : "") + '" id="timer" aria-label="' + (e.timed ? "Time remaining" : "Time elapsed") + '">' + fmtTime(rem) + "</span>" +
      (lastSection ? '<button class="btn" data-act="exam-review">Review &amp; submit</button>' : '<button class="btn" data-act="exam-end-section">End section</button>') + "</div>" +
      questionCard(q, { mode: "exam", choice: r.choice, order: e.order[id], number: e.idx + 1, total: e.ids.length, flagged: !!e.flags[id], sectionStart: e.idx === b.start, sectionEnd: !lastSection && e.idx === b.end - 1 }) +
      confirm +
      '<div class="panel panel-pad" style="margin-top:16px"><div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="eyebrow">Navigator' + (e.sections ? " · questions " + (b.start + 1) + "–" + b.end : "") + '</span><span class="muted" style="font-size:var(--fs-xs)">Blue = answered · yellow underline = flagged</span></div>' + sessionPips(e, true) +
      '<div class="row" style="margin-top:12px">' + (ui.confirmDiscard ? '<span class="confirm" style="padding:8px 10px"><span>Discard this exam? Answers so far will not be saved.</span><button class="btn" data-act="exam-discard-cancel">Keep exam</button><button class="btn btn-danger" data-act="exam-discard-confirm">Discard</button></span>' : '<button class="btn btn-ghost btn-danger" data-act="exam-discard">Discard exam…</button>') + "</div></div>";
  }
  function heatClass(v, answered) { if (!answered) return "h0"; if (v >= 75) return "h3"; if (v >= 60) return "h2"; return "h1"; }
  function renderExamResult(res) {
    var f = ui.resultFilter;
    var list = res.items.filter(function (it) {
      if (f === "wrong") return !it.ok;
      if (f === "flagged") return it.flagged;
      if (f === "blank") return !it.choice || !it.choice.length;
      return true;
    });
    var verdict = res.score >= 75 ? "On track — keep it up" : (res.score >= 65 ? "Close — target your weakest tasks" : "Keep building — review the explanations below");
    viewEl.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Exam results · ' + fmtDate(res.date) + '</div><h1 class="view-title">' + esc(verdict) + '</h1></div><div class="row"><button class="btn" data-act="exam-new">New exam</button><button class="btn btn-ghost" data-act="nav" data-view="review">Go to Review</button></div></div>' +
      '<div class="grid-2" style="margin-bottom:16px">' +
      '<div class="panel panel-pad stack"><div class="eyebrow">Score</div><div class="score-big">' + res.score + '%</div><div class="muted num">' + res.correct + " of " + res.n + " correct · time used " + fmtTime(res.usedSec) + (res.timed ? " of " + fmtTime(res.n * SEC_PER_Q) : " (untimed)") + "</div></div>" +
      '<div class="panel panel-pad stack"><div class="eyebrow">By domain</div>' + DOMAINS.map(function (d) {
        var b = res.byDomain[d] || { c: 0, n: 0 };
        return '<div class="stack" style="gap:4px"><div class="row" style="justify-content:space-between;font-size:var(--fs-sm)"><span>' + esc(d) + '</span><span class="num">' + b.c + "/" + b.n + " · " + pct(b.c, b.n) + '%</span></div><div class="bar" style="--dcolor:var(--' + DCLASS[d] + ')"><span style="width:' + pct(b.c, b.n) + '%"></span></div></div>';
      }).join("") + "</div></div>" +
      '<div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="font-family:var(--font-display);text-transform:uppercase;letter-spacing:0.03em">Question review</h3>' +
      '<div class="seg" role="group" aria-label="Filter results">' + [["all", "All"], ["wrong", "Incorrect"], ["flagged", "Flagged"], ["blank", "Unanswered"]].map(function (x) { return '<button data-act="result-filter" data-f="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="stack">' + (list.length ? list.map(function (it) {
        var q = QMAP[it.id]; if (!q) return "";
        var n = res.items.indexOf(it) + 1;
        return '<details class="panel"><summary class="list-item" style="cursor:pointer;border:0"><span class="chip mono">' + n + '</span><div><div class="t">' + esc(q.topic) + '</div><div class="s">' + esc(q.id) + " · " + esc(q.domain) + " · " + esc(taskShort(q.task)) + "</div></div>" +
          (it.ok ? '<span class="chip good">Correct</span>' : ((it.choice && it.choice.length) ? '<span class="chip bad">Incorrect</span>' : '<span class="chip bad">Unanswered</span>')) + "</summary>" +
          '<div style="padding:0 12px 12px">' + questionCard(q, { mode: "result", choice: it.choice, revealed: true, order: it.order, flagged: it.flagged }) + "</div></details>";
      }).join("") : '<div class="panel empty">Nothing in this filter.</div>') + "</div>";
  }

  // ---------------------------------------------------------------- views: review
  function renderReview() {
    var due = dueQuestions(), rotation = inRotation();
    var missed = QUESTIONS.filter(function (q) { var a = store.data.answers[q.id]; return a && !a.last; });
    var flagged = QUESTIONS.filter(function (q) { return store.data.flags[q.id]; });
    function list(arr, emptyMsg) {
      if (!arr.length) return '<div class="empty">' + emptyMsg + "</div>";
      return arr.map(function (q) {
        var a = store.data.answers[q.id];
        return '<div class="list-item"><span class="chip chip-id">' + esc(q.id) + '</span><div><div class="t">' + esc(q.topic) + '</div><div class="s">' + esc(q.domain) + " · " + esc(taskShort(q.task)) + (a ? " · " + a.c + "/" + a.n + " correct" : "") + '</div></div><button class="btn btn-ghost" data-act="open-q" data-id="' + esc(q.id) + '">Practice</button></div>';
      }).join("");
    }
    viewEl.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Review</div><h1 class="view-title">Close the gaps</h1><p class="lede">Spaced review brings back every question you have missed: again today, then after 1, 3, 7 and 16 days while you keep getting it right. A miss sends it back to the start. After five correct reviews in a row it counts as mastered.</p></div></div>' +
      '<div class="panel panel-pad row" style="justify-content:space-between;margin-bottom:16px"><div><div class="eyebrow">Spaced review</div><div style="font-family:var(--font-display);font-weight:700;font-size:2rem;line-height:1.1">' + due.length + ' due today</div><div class="muted" style="font-size:var(--fs-sm)">' + rotation + " question" + (rotation === 1 ? "" : "s") + " in rotation</div></div>" +
      (due.length ? '<button class="btn btn-primary" data-act="practice-due">Review ' + due.length + " due →</button>" : '<span class="muted">Nothing due. Missed questions will show up here.</span>') + "</div>" +
      '<div class="grid-2">' +
      '<div class="panel"><div class="panel-pad row" style="justify-content:space-between;border-bottom:1px solid var(--line)"><h3>Missed · ' + missed.length + "</h3>" + (missed.length ? '<button class="btn btn-primary" data-act="practice-missed">Practice all</button>' : "") + '</div><div class="list">' + list(missed, "No missed questions yet. Practice a set and anything you miss lands here.") + "</div></div>" +
      '<div class="panel"><div class="panel-pad row" style="justify-content:space-between;border-bottom:1px solid var(--line)"><h3>Flagged · ' + flagged.length + "</h3>" + (flagged.length ? '<button class="btn btn-primary" data-act="practice-flagged">Practice all</button>' : "") + '</div><div class="list">' + list(flagged, "Flag questions you guessed on, even when you got them right.") + "</div></div>" +
      "</div>";
  }

  // ---------------------------------------------------------------- views: guide
  function renderGuide() {
    var page = GUIDE.filter(function (p) { return p.slug === ui.guideSlug; })[0] || GUIDE[0];
    if (!page) { viewEl.innerHTML = '<div class="panel empty">Study guide content is missing.</div>'; return; }
    var groups = [];
    GUIDE.forEach(function (p) { if (groups.indexOf(p.group) === -1) groups.push(p.group); });
    var nav = groups.map(function (g) {
      return '<div class="stack" style="gap:2px"><div class="g">' + esc(g) + "</div>" + GUIDE.filter(function (p) { return p.group === g; }).map(function (p) {
        return '<button data-act="guide" data-slug="' + esc(p.slug) + '" aria-current="' + (p.slug === page.slug) + '">' + esc(p.title) + "</button>";
      }).join("") + "</div>";
    }).join("");
    var idx = GUIDE.indexOf(page), prev = GUIDE[idx - 1], next = GUIDE[idx + 1];
    viewEl.innerHTML =
      '<div class="split"><nav class="panel guide-nav" aria-label="Study guide pages">' + nav + "</nav>" +
      '<article class="panel prose"><div class="eyebrow">' + esc(page.group) + "</div><h1>" + esc(page.title) + "</h1>" + (page.summary ? '<p class="summary">' + esc(page.summary) + "</p>" : "") + md(page.markdown) +
      '<hr><div class="row" style="justify-content:space-between">' + (prev ? '<button class="btn" data-act="guide" data-slug="' + esc(prev.slug) + '">← ' + esc(prev.title) + "</button>" : "<span></span>") + (next ? '<button class="btn" data-act="guide" data-slug="' + esc(next.slug) + '">' + esc(next.title) + " →</button>" : "") + "</div></article></div>";
  }

  // ---------------------------------------------------------------- views: bank
  function bankFiltered() {
    var b = ui.bank, term = b.q.trim().toLowerCase();
    return QUESTIONS.filter(function (q) {
      if (b.domain !== "all" && q.domain !== b.domain) return false;
      if (b.approach !== "all" && q.approach !== b.approach) return false;
      if (b.difficulty !== "all" && q.difficulty !== b.difficulty) return false;
      if (!sourceMatch(q, b.source)) return false;
      if (!kindMatch(q, b.kind)) return false;
      if (!term) return true;
      return (q.id + " " + q.topic + " " + q.question + " " + q.task + " " + q.tags.join(" ") + " " + q.source + " " + (q.caseId || "")).toLowerCase().indexOf(term) !== -1;
    });
  }
  function bankRows(list) {
    if (!list.length) return '<tr><td colspan="6" class="muted">No questions match. Try a different search.</td></tr>';
    return list.map(function (q) {
      var a = store.data.answers[q.id];
      var st = !a ? '<span class="muted">New</span>' : (a.last ? '<span class="chip good">Correct</span>' : '<span class="chip bad">Missed</span>');
      return '<tr class="clickable" data-act="open-q" data-id="' + esc(q.id) + '"><td class="mono">' + esc(q.id) + "</td><td>" + esc(q.topic) + (q.caseId ? ' <span class="chip">Case</span>' : "") + (q.exhibit ? ' <span class="chip">Exhibit</span>' : "") + (store.data.flags[q.id] ? ' <span class="chip flag">Flagged</span>' : "") + '</td><td><span class="chip ' + DCHIP[q.domain] + '">' + esc(q.domain === "Business Environment" ? "Bus. Env." : q.domain) + " " + esc(taskNum(q.task)) + "</span></td><td>" + esc(APPROACH_LABEL[q.approach]) + "</td><td>" + esc(q.difficulty) + "</td><td>" + st + "</td></tr>";
    }).join("");
  }
  function renderBank() {
    var b = ui.bank, list = bankFiltered();
    viewEl.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Question bank</div><h1 class="view-title">All ' + QUESTIONS.length + ' questions</h1><p class="lede">Search by keyword, topic, tag, or ID. Open any question to answer it with the full explanation.</p></div>' +
      '<button class="btn btn-primary" data-act="bank-practice" id="bankPracticeBtn">Practice these ' + list.length + " →</button></div>" +
      '<div class="panel panel-pad" style="margin-bottom:14px"><div class="grid-3" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))">' +
      field("Search", '<input type="search" id="bank-q" data-bank="q" placeholder="e.g. EVM, conflict, NPV, PRO-071" value="' + esc(b.q) + '">') +
      field("Domain", '<select id="bank-domain" data-bank="domain">' + optionTags([["all", "All domains"]].concat(DOMAINS.map(function (d) { return [d, d]; })), b.domain) + "</select>") +
      field("Approach", '<select id="bank-approach" data-bank="approach">' + optionTags([["all", "All approaches"], ["Agile", "Agile"], ["Hybrid", "Hybrid"], ["Predictive", "Predictive"], ["Any", "Approach-neutral"]], b.approach) + "</select>") +
      field("Difficulty", '<select id="bank-difficulty" data-bank="difficulty">' + optionTags([["all", "All levels"], ["Easy", "Easy"], ["Medium", "Medium"], ["Hard", "Hard"]], b.difficulty) + "</select>") +
      field("Source", '<select id="bank-source" data-bank="source">' + optionTags(SOURCES.map(function (s) { return [s.key, s.label]; }), b.source) + "</select>") +
      field("Type", '<select id="bank-kind" data-bank="kind">' + optionTags(KINDS, b.kind) + "</select>") +
      "</div></div>" +
      '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Topic</th><th>Domain · task</th><th>Approach</th><th>Level</th><th>You</th></tr></thead><tbody id="bankRows">' + bankRows(list) + "</tbody></table></div>" +
      '<p class="muted" id="bankCount" style="margin-top:8px;font-size:var(--fs-xs)">' + list.length + " shown</p>";
  }
  function refreshBankTable() {
    var list = bankFiltered();
    var rows = document.getElementById("bankRows"); if (rows) rows.innerHTML = bankRows(list);
    var c = document.getElementById("bankCount"); if (c) c.textContent = list.length + " shown";
    var btn = document.getElementById("bankPracticeBtn"); if (btn) { btn.textContent = "Practice these " + list.length + " →"; btn.disabled = !list.length; }
  }

  // ---------------------------------------------------------------- views: progress
  function renderProgress() {
    var o = overall();
    var domRows = DOMAINS.map(function (d) {
      var s = statsFor(function (q) { return q.domain === d; });
      return "<tr><td><span class=\"chip " + DCHIP[d] + '"><span class="dot"></span>' + esc(d) + '</span></td><td class="num">' + WEIGHTS[d] + '%</td><td class="num">' + s.answered + " / " + s.total + '</td><td class="num"><span class="heat ' + heatClass(s.acc, s.answered) + '">' + (s.answered ? s.acc + "%" : "—") + "</span></td></tr>";
    }).join("");
    var taskRows = DOMAINS.map(function (d) {
      return '<tr><th colspan="5" style="position:static">' + esc(d) + "</th></tr>" + (TASKS[d] || []).map(function (t) {
        var s = statsFor(function (q) { return q.domain === d && q.task === t; });
        return "<tr><td>" + esc(t) + '</td><td class="num">' + s.total + '</td><td class="num">' + s.answered + '</td><td class="num"><span class="heat ' + heatClass(s.acc, s.answered) + '">' + (s.answered ? s.acc + "%" : "—") + '</span></td><td class="num"><button class="btn btn-ghost" data-act="drill-task" data-domain="' + esc(d) + '" data-task="' + esc(t) + '">Drill</button></td></tr>';
      }).join("");
    }).join("");
    var hist = store.data.exams.map(function (x) {
      return '<tr class="clickable" data-act="open-result" data-id="' + x.id + '"><td>' + fmtDate(x.date) + '</td><td class="num">' + x.n + '</td><td class="num"><span class="heat ' + heatClass(x.score, 1) + '">' + x.score + "%</span></td>" + DOMAINS.map(function (d) { var b = x.byDomain[d] || { c: 0, n: 0 }; return '<td class="num">' + pct(b.c, b.n) + "%</td>"; }).join("") + "</tr>";
    }).join("");
    viewEl.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Progress</div><h1 class="view-title">Where you stand</h1><p class="lede">Accuracy uses your most recent attempt at each question. Green is 75% or better, yellow 60–74%, red below 60%.</p></div></div>' +
      '<div class="stat-row" style="margin-bottom:16px">' + stat(o.answered + '<span class="muted" style="font-size:1rem"> / ' + QUESTIONS.length + "</span>", "Answered") + stat(o.answered ? o.acc + "%" : "—", "Accuracy") + stat(o.flagged, "Flagged") + stat(store.data.exams.length, "Simulations") + "</div>" +
      '<div class="grid-2" style="margin-bottom:16px">' +
      '<div class="stack"><h3 style="font-family:var(--font-display);text-transform:uppercase">By domain</h3><div class="table-wrap"><table><thead><tr><th>Domain</th><th class="num">Exam weight</th><th class="num">Answered</th><th class="num">Accuracy</th></tr></thead><tbody>' + domRows + "</tbody></table></div>" +
      '<h3 style="font-family:var(--font-display);text-transform:uppercase;margin-top:8px">Simulation history</h3>' +
      (hist ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Qs</th><th class="num">Score</th><th class="num">People</th><th class="num">Process</th><th class="num">Bus. Env.</th></tr></thead><tbody>' + hist + "</tbody></table></div>" : '<div class="panel empty">No simulations yet.<button class="btn" data-act="nav" data-view="exam">Take one</button></div>') +
      '<div class="panel panel-pad stack" style="margin-top:8px"><h3>Back up your progress</h3><p class="muted" style="font-size:var(--fs-sm)">Progress lives in this browser only. Copy it to keep a backup or move it to another device, then paste it into the box and press Import.</p>' +
      '<div class="row"><button class="btn" data-act="copy-progress">Copy progress</button><button class="btn" data-act="import-progress">Import</button>' +
      (ui.confirmReset ? '<span class="confirm" style="padding:8px 10px"><span>Erase all progress?</span><button class="btn" data-act="reset-cancel">Cancel</button><button class="btn btn-danger" data-act="reset-confirm">Erase</button></span>' : '<button class="btn btn-ghost btn-danger" data-act="reset">Reset…</button>') +
      '</div><textarea id="progressBox" aria-label="Progress backup" placeholder="Paste a backup here, then press Import"></textarea></div>' +
      "</div>" +
      '<div class="stack"><h3 style="font-family:var(--font-display);text-transform:uppercase">By ECO task</h3><div class="table-wrap"><table><thead><tr><th>Task</th><th class="num">Bank</th><th class="num">Answered</th><th class="num">Accuracy</th><th></th></tr></thead><tbody>' + taskRows + "</tbody></table></div></div>" +
      "</div>";
  }

  // ---------------------------------------------------------------- routing & rendering
  var VIEWS = { home: renderHome, practice: renderPractice, exam: renderExam, review: renderReview, guide: renderGuide, bank: renderBank, progress: renderProgress };
  function parseHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (h.indexOf("guide-") === 0) { ui.guideSlug = h.slice(6); return "guide"; }
    return VIEWS[h] ? h : "home";
  }
  function go(view, extra) {
    var target = extra ? view + "-" + extra : view;
    if (location.hash.replace(/^#/, "") === target) { ui.view = view; render(); scrollTop(); }
    else { location.hash = target; }
  }
  function scrollTop() { try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { window.scrollTo(0, 0); } }
  function render() {
    document.querySelectorAll("[data-nav]").forEach(function (b) {
      if (b.getAttribute("data-nav") === ui.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    (VIEWS[ui.view] || renderHome)();
  }

  // ---------------------------------------------------------------- actions
  function activeRun() {
    if (ui.view === "practice") { var s = curSession(); return s && !s.done ? { s: s, exam: false } : null; }
    if (ui.view === "exam" && store.data.exam && !store.data.exam.onBreak) return { s: store.data.exam, exam: true };
    return null;
  }
  function selectOption(orig) {
    var run = activeRun(); if (!run) return;
    var s = run.s, id = s.ids[s.idx], q = QMAP[id];
    var r = s.resp[id] || (s.resp[id] = {});
    if (r.revealed) return;
    var ch = (r.choice || []).slice();
    if (q.type === "multi") {
      var k = ch.indexOf(orig);
      if (k === -1) { ch.push(orig); if (ch.length > q.answer.length) ch.shift(); } else ch.splice(k, 1);
    } else {
      ch = (ch.length === 1 && ch[0] === orig) ? [] : [orig];
    }
    r.choice = ch;
    save(); render();
  }
  function reveal() {
    var run = activeRun(); if (!run || run.exam) return;
    var s = run.s, id = s.ids[s.idx], q = QMAP[id];
    var r = s.resp[id] || (s.resp[id] = {});
    if (r.revealed) return;
    r.revealed = true;
    recordAttempt(id, r.choice || [], isCorrect(q, r.choice), "practice");
    save(); render();
  }
  function move(delta) {
    var run = activeRun(); if (!run) return;
    var s = run.s, n = s.idx + delta;
    var b = run.exam ? secBounds(s) : { start: 0, end: s.ids.length };
    if (n < b.start || n >= b.end) return;
    s.idx = n; ui.confirmSubmit = false; ui.confirmSection = false; save(); render(); scrollTop();
  }
  function toggleFlag() {
    var run = activeRun(); if (!run) return;
    var id = run.s.ids[run.s.idx];
    if (run.exam) { run.s.flags[id] = !run.s.flags[id]; }
    else { if (store.data.flags[id]) delete store.data.flags[id]; else store.data.flags[id] = true; toast(store.data.flags[id] ? "Flagged for review" : "Flag removed"); }
    save(); render();
  }

  function handleAction(act, el) {
    var d = el.dataset;
    switch (act) {
      case "nav": go(d.view); break;
      case "opt": selectOption(Number(d.idx)); break;
      case "hint": {
        var run = activeRun(); if (!run || run.exam) break;
        var id = run.s.ids[run.s.idx]; (run.s.resp[id] || (run.s.resp[id] = {})).hint = true; save(); render(); break;
      }
      case "reveal": reveal(); break;
      case "flag": toggleFlag(); break;
      case "prev": move(-1); break;
      case "next": move(1); break;
      case "goto": {
        var r2 = activeRun(); if (!r2) break;
        var gi = Number(d.i), gb = r2.exam ? secBounds(r2.s) : { start: 0, end: r2.s.ids.length };
        if (gi >= gb.start && gi < gb.end) { r2.s.idx = gi; ui.confirmSubmit = false; ui.confirmSection = false; save(); render(); }
        break;
      }
      case "finish": { var s = curSession(); if (s) { s.done = true; save(); render(); scrollTop(); } break; }
      case "end-session": { var s2 = curSession(); if (s2) { s2.done = true; save(); render(); scrollTop(); } break; }
      case "resume": go("practice"); break;
      case "new-session": store.data.session = null; save(); go("practice"); break;
      case "retry-missed": {
        var s3 = curSession(); if (!s3) break;
        var ids = s3.ids.filter(function (id) { var r = s3.resp[id]; return r && r.revealed && !isCorrect(QMAP[id], r.choice); });
        startPractice(ids, "Retry: missed from last session"); break;
      }
      case "goto-review": {
        var s4 = curSession(); if (!s4) break;
        s4.done = false; s4.idx = Number(d.i); save(); render(); scrollTop(); break;
      }
      case "start-practice": {
        var f = store.data.settings.practice, pool = applyFilters(f);
        if (f.order === "random") pool = shuffle(pool);
        if (f.count !== "all") pool = pool.slice(0, Number(f.count));
        var label = [f.domain === "all" ? "All domains" : f.domain, f.task !== "all" ? taskShort(f.task) : null, f.source !== "all" ? (SOURCES.filter(function (x) { return x.key === f.source; })[0] || {}).label : null].filter(Boolean).join(" · ");
        startPractice(pool.map(function (q) { return q.id; }), label); break;
      }
      case "quick-random": startPractice(shuffle(QUESTIONS).slice(0, 10).map(function (q) { return q.id; }), "10 random questions"); break;
      case "quick-new": {
        var fresh = shuffle(QUESTIONS.filter(function (q) { return !store.data.answers[q.id]; }));
        if (!fresh.length) { toast("You have answered every question. Try Review instead."); break; }
        startPractice(fresh.slice(0, 10).map(function (q) { return q.id; }), "10 new questions"); break;
      }
      case "quick-exam": ui.examLen = 60; ui.examTimed = true; ui.examResultId = null; go("exam"); break;
      case "drill-domain": startPractice(shuffle(QUESTIONS.filter(function (q) { return q.domain === d.domain; })).slice(0, 15).map(function (q) { return q.id; }), d.domain + " · 15 questions"); break;
      case "drill-task": startPractice(shuffle(QUESTIONS.filter(function (q) { return q.domain === d.domain && q.task === d.task; })).map(function (q) { return q.id; }), d.domain + " · " + taskShort(d.task)); break;
      case "practice-book": {
        var b = BOOKS.filter(function (x) { return x.key === d.book; })[0];
        startPractice(shuffle(QUESTIONS.filter(function (q) { return b.re.test(q.source); })).map(function (q) { return q.id; }), "Book · " + b.title); break;
      }
      case "practice-due": startPractice(shuffle(dueQuestions()).map(function (q) { return q.id; }), "Spaced review · due today"); break;
      case "quick-case": {
        var unseenCases = CASES.filter(function (c) { return c.questionIds.some(function (id) { return !store.data.answers[id]; }); });
        var pick = shuffle(unseenCases.length ? unseenCases : CASES)[0];
        if (pick) startPractice(pick.questionIds.filter(function (id) { return QMAP[id]; }), "Case study · " + pick.title);
        break;
      }
      case "practice-missed": startPractice(shuffle(QUESTIONS.filter(function (q) { var a = store.data.answers[q.id]; return a && !a.last; })).map(function (q) { return q.id; }), "Review · missed questions"); break;
      case "practice-flagged": startPractice(QUESTIONS.filter(function (q) { return store.data.flags[q.id]; }).map(function (q) { return q.id; }), "Review · flagged questions"); break;
      case "open-q": startPractice([d.id], "Question " + d.id); break;
      case "bank-practice": startPractice(bankFiltered().map(function (q) { return q.id; }), "Question bank selection"); break;
      case "guide": ui.guideSlug = d.slug; go("guide", d.slug); break;
      case "exam-len": ui.examLen = Number(d.n); render(); break;
      case "start-exam": startExam(ui.examLen, ui.examTimed, ui.examUnseen); break;
      case "exam-review": ui.confirmSubmit = true; render(); break;
      case "exam-end-section": ui.confirmSection = true; render(); break;
      case "exam-section-confirm": endSection(); break;
      case "exam-resume": resumeFromBreak(); break;
      case "exam-cancel-submit": ui.confirmSubmit = false; ui.confirmSection = false; render(); break;
      case "exam-submit": submitExam(); scrollTop(); break;
      case "exam-discard": ui.confirmDiscard = true; render(); break;
      case "exam-discard-cancel": ui.confirmDiscard = false; render(); break;
      case "exam-discard-confirm": store.data.exam = null; ui.confirmSubmit = false; ui.confirmSection = false; ui.confirmDiscard = false; save(); toast("Exam discarded"); render(); break;
      case "exam-new": ui.examResultId = null; render(); break;
      case "open-result": ui.examResultId = d.id; ui.resultFilter = "all"; go("exam"); break;
      case "result-filter": ui.resultFilter = d.f; render(); break;
      case "copy-progress": {
        var json = JSON.stringify({ answers: store.data.answers, flags: store.data.flags, exams: store.data.exams, settings: store.data.settings });
        var box = document.getElementById("progressBox"); if (box) box.value = json;
        var done = function () { toast("Progress copied"); };
        var fallback = function () { if (box) { box.focus(); box.select(); } toast("Select the text in the box and copy it"); };
        try { navigator.clipboard.writeText(json).then(done, fallback); } catch (e) { fallback(); }
        break;
      }
      case "import-progress": {
        var bx = document.getElementById("progressBox");
        try {
          var parsed = JSON.parse(bx.value);
          var next = normalize(parsed);
          store.data.answers = next.answers; store.data.flags = next.flags; store.data.exams = next.exams;
          save(); toast("Progress imported"); render();
        } catch (e) { toast("That text is not a valid backup. Paste the full copied text."); }
        break;
      }
      case "reset": ui.confirmReset = true; render(); break;
      case "reset-cancel": ui.confirmReset = false; render(); break;
      case "reset-confirm": {
        var keepSettings = store.data.settings;
        store.data = normalize({ settings: keepSettings }); ui.confirmReset = false; ui.examResultId = null; save(); toast("Progress erased"); render(); break;
      }
    }
  }

  // ---------------------------------------------------------------- theme
  function currentTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyTheme() { if (store.data.settings.theme) document.documentElement.setAttribute("data-theme", store.data.settings.theme); }

  // ---------------------------------------------------------------- boot
  function boot() {
    load();
    applyTheme();
    viewEl = document.getElementById("view");

    document.querySelectorAll("[data-nav]").forEach(function (b) {
      b.addEventListener("click", function () { go(b.getAttribute("data-nav")); });
    });
    document.getElementById("themeToggle").addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      store.data.settings.theme = next; document.documentElement.setAttribute("data-theme", next); save();
    });

    viewEl.addEventListener("click", function (e) {
      var el = e.target.closest("[data-act]");
      if (!el || !viewEl.contains(el)) return;
      if (el.tagName === "INPUT") return; // checkboxes handled on change
      if (el.disabled) return;
      handleAction(el.getAttribute("data-act"), el);
    });
    viewEl.addEventListener("change", function (e) {
      var t = e.target;
      if (t.hasAttribute("data-filter")) {
        var k = t.getAttribute("data-filter"), v = t.value;
        store.data.settings.practice[k] = (k === "count" && v !== "all") ? Number(v) : v;
        if (k === "domain") store.data.settings.practice.task = "all";
        save(); render();
      } else if (t.getAttribute("data-setting") === "shuffle") {
        store.data.settings.shuffle = t.checked; save();
      } else if (t.getAttribute("data-act") === "exam-timed") {
        ui.examTimed = t.checked; render();
      } else if (t.getAttribute("data-act") === "exam-unseen") {
        ui.examUnseen = t.checked;
      } else if (t.hasAttribute("data-bank") && t.tagName === "SELECT") {
        ui.bank[t.getAttribute("data-bank")] = t.value; refreshBankTable();
      }
    });
    viewEl.addEventListener("input", function (e) {
      var t = e.target;
      if (t.getAttribute("data-bank") === "q") { ui.bank.q = t.value; refreshBankTable(); }
    });

    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      var run = activeRun(); if (!run) return;
      var k = e.key.toLowerCase();
      var q = QMAP[run.s.ids[run.s.idx]];
      var pos = "abcdef".indexOf(k); if (pos === -1 && /^[1-6]$/.test(k)) pos = Number(k) - 1;
      if (pos !== -1 && q && pos < q.options.length) {
        var order = orderFor(q, run.s.order[q.id]);
        selectOption(order[pos]); e.preventDefault(); return;
      }
      if (k === "arrowright" || k === "n") { move(1); e.preventDefault(); }
      else if (k === "arrowleft" || k === "p") { move(-1); e.preventDefault(); }
      else if (k === "f") { toggleFlag(); e.preventDefault(); }
      else if (!run.exam && k === "h") { handleAction("hint", { dataset: {} }); e.preventDefault(); }
      else if (!run.exam && (k === "r" || k === "enter")) { if (e.target && e.target.tagName === "BUTTON" && k === "enter") return; reveal(); e.preventDefault(); }
    });

    window.addEventListener("hashchange", function () { ui.view = parseHash(); render(); scrollTop(); });

    setInterval(function () {
      var e = store.data.exam;
      if (!e || ui.view !== "exam") return;
      var rem = examRemaining(e);
      var bt = document.getElementById("breakTimer");
      if (bt && e.onBreak) bt.textContent = fmtTime(Math.max(0, BREAK_MS - breakUsedMs(e)) / 1000);
      if (e.timed && rem <= 0) { toast("Time is up — exam submitted"); submitExam(); return; }
      var t = document.getElementById("timer");
      if (t) { t.textContent = fmtTime(rem); if (e.timed && rem < 300) t.classList.add("low"); }
    }, 1000);

    ui.view = parseHash();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
