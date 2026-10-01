#!/usr/bin/env python3
"""
PMP Mastery — build & validate script.

Usage:
  python3 scripts/build.py            # validate + generate data/questions.js and data/study-guide.js
  python3 scripts/build.py --check    # validate only (used by CI)
  python3 scripts/build.py --stats    # print coverage statistics
  python3 scripts/build.py --single   # also build dist/pmp-critical-path.html (one self-contained file)

Source of truth:
  questions/*.json   -> arrays of question objects (see SPEC.md for the schema)
  cases/*.json       -> case-study scenarios shared by 3–4 questions (questions carry "caseId")
  content/*.md       -> study-guide pages (front matter: first line '# Title')
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QDIR = ROOT / "questions"
KDIR = ROOT / "cases"
CDIR = ROOT / "content"
DATA = ROOT / "data"
DIST = ROOT / "dist"

DOMAINS = {
    "People": [
        "1. Develop a common vision",
        "2. Manage conflicts",
        "3. Lead the project team",
        "4. Engage stakeholders",
        "5. Align stakeholder expectations",
        "6. Manage stakeholder expectations",
        "7. Help ensure knowledge transfer",
        "8. Plan and manage communication",
    ],
    "Process": [
        "1. Develop an integrated project management plan and plan delivery",
        "2. Develop and manage project scope",
        "3. Help ensure value-based delivery",
        "4. Plan and manage resources",
        "5. Plan and manage procurement",
        "6. Plan and manage finance",
        "7. Plan and optimize quality of products/deliverables",
        "8. Plan and manage schedule",
        "9. Evaluate project status",
        "10. Manage project closure",
    ],
    "Business Environment": [
        "1. Define and establish project governance",
        "2. Plan and manage project compliance",
        "3. Manage and control changes",
        "4. Remove impediments and manage issues",
        "5. Plan and manage risk",
        "6. Continuous improvement",
        "7. Support organizational change",
        "8. Evaluate external business environment changes",
    ],
}
APPROACHES = {"Agile", "Predictive", "Hybrid", "Any"}
DIFFICULTIES = {"Easy", "Medium", "Hard"}
TYPES = {"single", "multi"}
EXHIBIT_KINDS = {"table", "line", "bar", "stacked-area"}
CASE_ID = re.compile(r"^CS-\d{2}$")
ID_RE = re.compile(r"^(PEO|PRO|BUS)-\d{3}$")
ID_PREFIX = {"People": "PEO", "Process": "PRO", "Business Environment": "BUS"}
BOOK_MARKERS = {  # substring in `source` -> display name (keep in sync with BOOKS in assets/js/app.js)
    "PMBOK Guide 7th": "PMBOK Guide 7th ed.",
    "Next Generation": "Project Management Next Generation",
}
REQUIRED = [
    "id", "domain", "task", "approach", "difficulty", "type", "topic", "source",
    "question", "options", "answer", "hint", "why", "how", "optionNotes", "deepDive", "tags",
]


def load_questions():
    questions, errors = [], []
    files = sorted(QDIR.glob("*.json"))
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{f.name}: invalid JSON — {e}")
            continue
        if not isinstance(data, list):
            errors.append(f"{f.name}: top level must be a JSON array")
            continue
        for q in data:
            q["_file"] = f.name
            questions.append(q)
    return questions, errors


def validate_exhibit(ex, where):
    """Exhibits are small data objects the app renders as a table or an SVG chart."""
    errs = []
    if not isinstance(ex, dict) or ex.get("kind") not in EXHIBIT_KINDS:
        return [f"{where}: exhibit.kind must be one of {sorted(EXHIBIT_KINDS)}"]
    if not isinstance(ex.get("title", ""), str):
        errs.append(f"{where}: exhibit.title must be a string")
    if ex["kind"] == "table":
        cols, rows = ex.get("columns"), ex.get("rows")
        if not (isinstance(cols, list) and cols and all(isinstance(c, str) for c in cols)):
            errs.append(f"{where}: table exhibit needs a non-empty 'columns' list of strings")
        elif not (isinstance(rows, list) and rows and all(isinstance(r, list) and len(r) == len(cols) for r in rows)):
            errs.append(f"{where}: table exhibit rows must be lists with {len(cols)} cells")
    else:
        x, series = ex.get("x"), ex.get("series")
        if not (isinstance(x, list) and len(x) >= 2):
            errs.append(f"{where}: chart exhibit needs an 'x' list with 2+ labels")
        elif not (isinstance(series, list) and series):
            errs.append(f"{where}: chart exhibit needs a non-empty 'series' list")
        else:
            for sr in series:
                vals = sr.get("values") if isinstance(sr, dict) else None
                if not isinstance(sr, dict) or not isinstance(sr.get("name"), str):
                    errs.append(f"{where}: each series needs a 'name'")
                elif not (isinstance(vals, list) and len(vals) == len(x)
                          and all(v is None or isinstance(v, (int, float)) for v in vals)):
                    errs.append(f"{where}: series '{sr.get('name')}' needs {len(x)} numeric values (null allowed)")
        for rl in ex.get("refLines", []) or []:
            if not (isinstance(rl, dict) and isinstance(rl.get("label"), str) and isinstance(rl.get("value"), (int, float))):
                errs.append(f"{where}: refLines entries need 'label' and numeric 'value'")
    return errs


def load_cases():
    cases, errors = [], []
    if not KDIR.exists():
        return cases, errors
    for f in sorted(KDIR.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{f.name}: invalid JSON — {e}")
            continue
        if not isinstance(data, list):
            errors.append(f"{f.name}: top level must be a JSON array")
            continue
        for c in data:
            c["_file"] = f.name
            cases.append(c)
    return cases, errors


def validate_cases(cases, questions):
    errors = []
    by_id = {q.get("id"): q for q in questions}
    seen = set()
    for c in cases:
        where = f"{c.get('_file')}:{c.get('id', '?')}"
        for k in ("id", "title", "approach", "scenario", "questionIds"):
            if k not in c:
                errors.append(f"{where}: missing field '{k}'")
        if any(e.startswith(where) for e in errors):
            continue
        if not CASE_ID.match(c["id"]):
            errors.append(f"{where}: case id must look like CS-01")
        if c["id"] in seen:
            errors.append(f"{where}: duplicate case id")
        seen.add(c["id"])
        if c["approach"] not in APPROACHES:
            errors.append(f"{where}: bad approach '{c['approach']}'")
        if not isinstance(c["scenario"], str) or len(c["scenario"].split()) < 60:
            errors.append(f"{where}: scenario should be a substantial string (60+ words)")
        ids = c["questionIds"]
        if not isinstance(ids, list) or not 2 <= len(ids) <= 5:
            errors.append(f"{where}: questionIds must list 2–5 questions")
            continue
        for qid in ids:
            q = by_id.get(qid)
            if q is None:
                errors.append(f"{where}: unknown question {qid}")
            elif q.get("caseId") != c["id"]:
                errors.append(f"{where}: question {qid} must have caseId '{c['id']}'")
        if "exhibit" in c:
            errors += validate_exhibit(c["exhibit"], where)
    for q in questions:
        cid = q.get("caseId")
        if cid is not None and cid not in seen:
            errors.append(f"{q.get('_file')}:{q.get('id')}: caseId '{cid}' has no matching case in cases/")
        elif cid is not None:
            case = next(c for c in cases if c.get("id") == cid)
            if q["id"] not in case.get("questionIds", []):
                errors.append(f"{q.get('_file')}:{q.get('id')}: not listed in {cid}.questionIds")
    return errors


def validate(questions):
    errors = []
    seen = set()
    for q in questions:
        where = f"{q.get('_file')}:{q.get('id', '?')}"
        for k in REQUIRED:
            if k not in q:
                errors.append(f"{where}: missing field '{k}'")
        if errors and errors[-1].startswith(where):
            continue
        if q["id"] in seen:
            errors.append(f"{where}: duplicate id")
        seen.add(q["id"])
        if not ID_RE.match(str(q["id"])) or (q["domain"] in ID_PREFIX and not q["id"].startswith(ID_PREFIX[q["domain"]])):
            errors.append(f"{where}: id must be {ID_PREFIX.get(q['domain'], 'XXX')}-nnn for domain {q['domain']}")
        if "caseId" in q and not (isinstance(q["caseId"], str) and CASE_ID.match(q["caseId"])):
            errors.append(f"{where}: caseId must look like CS-01")
        if "exhibit" in q:
            errors += validate_exhibit(q["exhibit"], where)
        if not isinstance(q["tags"], list) or not all(isinstance(t, str) for t in q["tags"]):
            errors.append(f"{where}: tags must be a list of strings")
        extra = set(q) - set(REQUIRED) - {"caseId", "exhibit", "_file"}
        if extra:
            errors.append(f"{where}: unknown field(s) {sorted(extra)}")
        if q["domain"] not in DOMAINS:
            errors.append(f"{where}: unknown domain '{q['domain']}'")
        elif q["task"] not in DOMAINS[q["domain"]]:
            errors.append(f"{where}: unknown task '{q['task']}' for domain {q['domain']}")
        if q["approach"] not in APPROACHES:
            errors.append(f"{where}: bad approach '{q['approach']}'")
        if q["difficulty"] not in DIFFICULTIES:
            errors.append(f"{where}: bad difficulty '{q['difficulty']}'")
        if q["type"] not in TYPES:
            errors.append(f"{where}: bad type '{q['type']}'")
        opts = q["options"]
        if not isinstance(opts, list) or len(opts) < 4 or len(opts) > 6:
            errors.append(f"{where}: options must be a list of 4–6 strings")
            continue
        if len(q["optionNotes"]) != len(opts):
            errors.append(f"{where}: optionNotes length {len(q['optionNotes'])} != options {len(opts)}")
        ans = q["answer"]
        if not isinstance(ans, list) or not ans or any((not isinstance(a, int)) or a < 0 or a >= len(opts) for a in ans):
            errors.append(f"{where}: answer must be a non-empty list of valid option indexes")
            continue
        if len(set(ans)) != len(ans):
            errors.append(f"{where}: duplicate answer indexes")
        if q["type"] == "single" and len(ans) != 1:
            errors.append(f"{where}: single-answer question must have exactly one answer")
        if q["type"] == "multi" and len(ans) < 2:
            errors.append(f"{where}: multi-answer question must have 2+ answers")
        if q["type"] == "multi":
            word = {2: "two", 3: "three", 4: "four"}.get(len(ans), str(len(ans)))
            if f"(select {word}" not in q["question"].lower():
                errors.append(f"{where}: multi-select stem must say '(Select {word}.)'")
        for i, note in enumerate(q["optionNotes"]):
            starts_correct = note.strip().lower().startswith("correct")
            if (i in ans) != starts_correct:
                errors.append(f"{where}: optionNotes[{i}] correctness label disagrees with answer key")
        for k in ("question", "hint", "why", "how", "deepDive", "topic", "source"):
            if not isinstance(q[k], str) or len(q[k].strip()) < 3:
                errors.append(f"{where}: field '{k}' is empty")
        if len(set(o.strip().lower() for o in opts)) != len(opts):
            errors.append(f"{where}: duplicate option text")
    return errors


def stats(questions):
    out = []
    n = len(questions)
    out.append(f"Total questions: {n}")
    by_domain = Counter(q["domain"] for q in questions)
    for d in DOMAINS:
        c = by_domain.get(d, 0)
        out.append(f"  {d:<22} {c:>4}  ({(c / n * 100 if n else 0):.1f}%)")
    out.append("Tasks:")
    by_task = Counter((q["domain"], q["task"]) for q in questions)
    for d, tasks in DOMAINS.items():
        for t in tasks:
            out.append(f"  {d[:8]:<8} {t:<68} {by_task.get((d, t), 0):>3}")
    out.append("Approach:   " + ", ".join(f"{k}={v}" for k, v in Counter(q["approach"] for q in questions).most_common()))
    out.append("Difficulty: " + ", ".join(f"{k}={v}" for k, v in Counter(q["difficulty"] for q in questions).most_common()))
    out.append("Type:       " + ", ".join(f"{k}={v}" for k, v in Counter(q["type"] for q in questions).most_common()))
    pos = Counter()
    for q in questions:
        if q["type"] == "single":
            pos["ABCDEF"[q["answer"][0]]] += 1
    out.append("Single-answer key position: " + ", ".join(f"{k}={pos[k]}" for k in sorted(pos)))
    books = Counter()
    for q in questions:
        for marker, name in BOOK_MARKERS.items():
            if marker in q["source"]:
                books[name] += 1
    out.append("Book-linked questions: " + ", ".join(f"{k}={v}" for k, v in books.most_common()))
    tags = Counter(t for q in questions for t in q["tags"])
    out.append(f"Calculation items: {tags.get('calculation', 0)} · exhibits (table/chart): "
               f"{sum(1 for q in questions if 'exhibit' in q)} · case-study questions: "
               f"{sum(1 for q in questions if 'caseId' in q)}")
    singles = [q for q in questions if q["type"] == "single"]
    longest = sum(1 for q in singles
                  if max(range(len(q["options"])), key=lambda i: len(q["options"][i])) == q["answer"][0])
    out.append(f"Correct option is the longest: {longest}/{len(singles)} single-answer items")
    return "\n".join(out)


def parse_markdown_pages():
    pages = []
    for f in sorted(CDIR.glob("*.md")):
        text = f.read_text(encoding="utf-8")
        m = re.match(r"#\s+(.+)", text)
        title = m.group(1).strip() if m else f.stem
        body = text[m.end():].lstrip("\n") if m else text
        meta = {}
        # optional HTML comment metadata: <!-- group: Books | order: 3 | summary: ... -->
        mm = re.search(r"<!--\s*(.*?)\s*-->", body, re.S)
        if mm:
            for part in mm.group(1).split("|"):
                if ":" in part:
                    k, v = part.split(":", 1)
                    meta[k.strip()] = v.strip()
            body = body[:mm.start()] + body[mm.end():]
        pages.append({
            "slug": f.stem,
            "title": title,
            "group": meta.get("group", "Study Guide"),
            "order": float(meta.get("order", "99")),
            "summary": meta.get("summary", ""),
            "markdown": body.strip() + "\n",
        })
    group_order = {"Exam Essentials": 0, "Domain Summaries": 1, "Book Summaries": 2, "Study Plan": 3}
    pages.sort(key=lambda p: (group_order.get(p["group"], 9), p["order"], p["title"]))
    return pages


def write_bundles(questions, pages, cases=()):
    DATA.mkdir(exist_ok=True)
    clean = [{k: v for k, v in q.items() if not k.startswith("_")} for q in questions]
    order = {"People": 0, "Process": 1, "Business Environment": 2}
    clean.sort(key=lambda q: (order[q["domain"]], q["id"]))
    meta = {
        "eco": {d: t for d, t in DOMAINS.items()},
        "weights": {"People": 33, "Process": 41, "Business Environment": 26},
        "count": len(clean),
    }
    (DATA / "questions.js").write_text(
        "/* Generated by scripts/build.py — edit questions/*.json instead. */\n"
        "window.PMP_META = " + json.dumps(meta, ensure_ascii=False) + ";\n"
        "window.PMP_QUESTIONS = " + json.dumps(clean, ensure_ascii=False, indent=0) + ";\n"
        "window.PMP_CASES = " + json.dumps([{k: v for k, v in c.items() if not k.startswith("_")} for c in cases],
                                           ensure_ascii=False, indent=0) + ";\n",
        encoding="utf-8",
    )
    (DATA / "study-guide.js").write_text(
        "/* Generated by scripts/build.py — edit content/*.md instead. */\n"
        "window.PMP_GUIDE = " + json.dumps(pages, ensure_ascii=False, indent=0) + ";\n",
        encoding="utf-8",
    )


def build_single_file():
    """Inline local CSS/JS/data into one self-contained page (used for the hosted Claude Artifact).

    The Artifact host wraps the page in its own <!doctype>/<head>/<body> skeleton, so this output
    keeps only the <title>, font links, styles, body markup, and scripts."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    def inline_css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def inline_js(m):
        code = (ROOT / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
        return "<script>\n" + code + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="((?:assets)/[^"]+)">', inline_css, html)
    html = re.sub(r'<script src="((?:assets|data)/[^"]+)"></script>', inline_js, html)
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    head = re.sub(r"<meta [^>]*>\s*", "", head)  # charset/viewport come from the host skeleton
    out = head.strip() + "\n" + body.strip() + "\n"
    DIST.mkdir(exist_ok=True)
    target = DIST / "pmp-critical-path.html"
    target.write_text(out, encoding="utf-8")
    return target


def main():
    args = set(sys.argv[1:])
    questions, errors = load_questions()
    cases, case_errors = load_cases()
    errors += case_errors
    errors += validate(questions)
    errors += validate_cases(cases, questions)
    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"OK — {len(questions)} questions and {len(cases)} case studies validated.")
    if "--stats" in args or "--check" not in args:
        print(stats(questions))
    if "--check" in args:
        return
    pages = parse_markdown_pages()
    write_bundles(questions, pages, cases)
    print(f"Wrote data/questions.js and data/study-guide.js ({len(pages)} study pages).")
    if "--single" in args:
        p = build_single_file()
        print(f"Wrote {p.relative_to(ROOT)} ({p.stat().st_size // 1024} KB).")


if __name__ == "__main__":
    main()
