# PMP Critical Path — Product Specification

Version 2.0 · September 2026 (600 questions, case studies, exhibits, sectioned exam, spaced review)

## 1. Purpose

Help a PMP candidate pass the 2026 PMP exam by practicing exam-style judgment, not memorizing answers. The app must make the candidate **commit to an answer before seeing feedback**, then teach the reasoning behind every option.

### Goals
- Cover all 3 domains and 26 tasks of the 2026 PMP Examination Content Outline (ECO), weighted like the exam (People 33%, Process 41%, Business Environment 26%).
- Provide hints, reveal-on-demand answers, and explanations (why, how, per-option notes, deep dive, source) for every question.
- Integrate project-management concepts from the candidate's reading list — the *PMBOK Guide 7th ed.* and Kerzner, Zeitoun & Vargas, *Project Management Next Generation* — as exam-style questions and study summaries.
- **Scope rule:** include only content relevant to PMP project management. Books or topics outside it (e.g., corporate accounting, startup/CEO leadership, company digital strategy) are excluded, even if the candidate owns them.
- Reproduce the 2026 exam's formats: situational single-answer, multiple response ("Select two/three"), case/scenario sets and graphic-based items.
- Run anywhere as a static site: GitHub Pages, a local file, or a single self-contained HTML file.

### Non-goals (v1)
- User accounts, servers, or cross-device sync (progress export/import covers moving devices).
- Reproducing copyrighted book text or actual PMI exam questions.

## 2. Users and key scenarios

| Scenario | Flow |
|---|---|
| Daily practice | Home → Practice 10 random (or filter a set) → answer → hint (optional) → reveal → read notes → next |
| Weak-area drill | Progress → task with low accuracy → Drill |
| Exam rehearsal | Exam → choose length → timed session with navigator and flags (180 questions: 3 sections, optional breaks, closed sections) → submit → review by domain and question |
| Gap closing | Review → spaced-review queue (due today) → missed / flagged |
| Case practice | Home → Work through a case study, or Practice → Question type → Case-study sets |
| Concept study | Study Guide → overview, mindset rules, formulas, domain and book summaries |
| Lookup | Question Bank → search "NPV" → open a question |

## 3. Functional requirements

### 3.1 Answering (core rule)
- FR-1 Selecting an option only marks it as selected. The UI must **not** reveal correctness on selection.
- FR-2 **Reveal answer** shows: correct option(s), whether the selection was correct, a note under every option, and the Why / How / Go deeper / Source sections.
- FR-3 Reveal works even with no selection (recorded as not correct).
- FR-4 **Hint** shows a nudge that points to the principle without naming the answer. Hints are unavailable in Exam mode.
- FR-5 Multiple-response questions state how many answers to select and cap selections at that number.
- FR-6 Option order may be shuffled per session (default on); letters follow the displayed order.

### 3.2 Practice
- FR-7 Filters: domain, ECO task, approach, difficulty, source, question type (case sets, exhibits, calculations, multiple response), history status (new, missed, due for spaced review, correct, flagged), count (10/25/50/all), order (random/by ID). Questions from the same case always appear together, in case order.
- FR-7a Case questions show the case scenario (and its exhibit) in a collapsible panel above the stem; exhibit questions render a table or an SVG chart (line, bar, stacked area; reference lines for control limits) with a legend, direct labels and a "show data as a table" view.
- FR-8 Session navigation: previous/next, jump grid with state (answered, correct, missed, flagged), end session, summary with score and "retry missed".
- FR-9 Keyboard: A–F or 1–6 choose, H hint, R/Enter reveal, F flag, ←/→ move.

### 3.3 Exam simulation
- FR-10 Lengths 30/60/90/180, allocated by ECO weight (largest-remainder rounding), optionally preferring unseen questions. About one case set per 50 questions is included as a contiguous block (net of its domain counts).
- FR-10a The 180-question exam is split into three 60-question sections. Navigation is limited to the current section; "End section" asks for confirmation (showing unanswered/flagged counts), then offers an optional 10-minute break during which the exam clock is paused (for at most 10 minutes). Earlier sections cannot be reopened. Case blocks never straddle a section boundary.
- FR-11 Timer at 80 s/question (240 min ÷ 180), countdown with low-time warning; auto-submit at zero; optional untimed mode.
- FR-12 Navigator, flag for review, inline submit confirmation showing unanswered/flagged counts; inline discard confirmation.
- FR-13 Results: score, time used, per-domain bars, filter (all/incorrect/flagged/unanswered), expandable fully revealed review of each question. Keep the last 30 results.

### 3.4 Review, Bank, Guide, Progress
- FR-14 Review shows the spaced-review queue (Leitner boxes: a miss → box 0, due now; each correct review moves up a box; intervals 0/1/3/7/16 days; box 5 = mastered), plus questions missed on the latest attempt and flagged questions, with bulk practice.
- FR-15 Bank: keyword search over ID, topic, question, task, tags, source; filters; open any question; practice the filtered set.
- FR-16 Study guide renders Markdown pages grouped as Exam Essentials (overview, PMI mindset, formulas, agile, case studies & graphics), Domain Summaries, Book Summaries (PMBOK 7, PM Next Generation), Study Plan (8-week plan, practice-book errata), with previous/next navigation and deep links (`#guide-<slug>`).
- FR-17 Progress: totals, accuracy by domain and by task (heat: ≥75% green, 60–74% yellow, <60% red), simulation history, copy/import backup, reset with inline confirmation.

## 4. Non-functional requirements
- NFR-1 Static files only; no external runtime dependencies except Google Fonts (with system fallbacks).
- NFR-2 Works offline from `file://` (data is loaded with `<script>` tags, not `fetch`).
- NFR-3 Responsive to 360 px width with no horizontal page scroll; light and dark themes (system default plus manual toggle).
- NFR-4 Accessible: semantic buttons, visible focus, `aria-pressed` on options, `aria-live` for status, reduced-motion support.
- NFR-5 Storage: `localStorage` key `pmp-critical-path-v1`, every access wrapped in try/catch; the app works (without persistence) if storage is blocked.
- NFR-6 The question bank must pass `scripts/build.py --check` (enforced in CI).

## 5. Question data schema

Each file in `questions/` is a JSON array of objects:

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique. Prefix `PEO-`, `PRO-`, `BUS-` + 3 digits |
| `domain` | string | `People` · `Process` · `Business Environment` |
| `task` | string | Exact ECO task label, e.g. `2. Manage conflicts` (see `DOMAINS` in `scripts/build.py`) |
| `approach` | string | `Agile` · `Predictive` · `Hybrid` · `Any` (approach-neutral) |
| `difficulty` | string | `Easy` · `Medium` · `Hard` |
| `type` | string | `single` (exactly 1 answer) · `multi` (2+ answers) |
| `topic` | string | Short label shown in lists |
| `source` | string | `ECO 2026 · <Domain> Task <n> · <note>`, `Book: PMBOK Guide 7th ed. (PMI, 2021) — <section>` or `Book: Project Management Next Generation (Kerzner, Zeitoun & Vargas, 2022) — Pillar <n>: <name>` |
| `question` | string | The scenario and the ask (FIRST / NEXT / BEST / MOST). Multi-select stems end with `(Select two.)` / `(Select three.)` (validated) |
| `options` | string[] | 4–6 options |
| `answer` | int[] | Zero-based indexes of correct options |
| `hint` | string | Points to the principle; must not name the answer |
| `why` | string | Why the correct answer is correct (show calculations) |
| `how` | string | The reusable technique or rule for this question type |
| `optionNotes` | string[] | One per option, same order. Must start with `Correct —` or `Incorrect —` (validated against `answer`) |
| `deepDive` | string | Related concepts, formulas, models, mnemonics, or book context |
| `tags` | string[] | Search keywords; add `calculation` for numeric items, `multi-select` for multiple response, `exhibit`, `case study`, `ai` where relevant |
| `exhibit` | object | Optional. `{"kind": "table", "title", "columns": [..], "rows": [[..]]}` or `{"kind": "line" \| "bar" \| "stacked-area", "title", "xLabel", "yLabel", "x": [..], "series": [{"name", "values": [..]}], "refLines": [{"label", "value"}]}` (≤ 4 series; each series has `len(x)` numbers; `null` allowed) |
| `caseId` | string | Optional. `CS-nn` — links the question to a case in `cases/` |

Each file in `cases/` is a JSON array of case objects: `id` (`CS-nn`), `title`, `approach`, `scenario` (Markdown: paragraphs and `- ` bullets, 60+ words), optional `exhibit`, and `questionIds` (2–5 ids, each carrying the matching `caseId`). The validator checks both directions of the link.

## 6. Question writing guide

1. **Situational first.** Describe what is happening and ask what the PM should do FIRST/NEXT/BEST. Use definitions sparingly.
2. **One clearly best answer**, three plausible distractors that reflect real mistakes (escalating too early, skipping analysis, bypassing roles, gold plating, hiding bad news).
3. **Tag the approach honestly.** About 60% of the exam is agile or hybrid; keep new approach-specific items at or above that share.
4. **Explain every option.** The note should teach, not just say "wrong".
5. **Hints nudge, never tell.** "Who owns backlog priority?" is good; "The product owner decides" is not.
6. **Calculations:** show the formula and every step in `why`; include the common wrong answers as distractors; numeric options in ascending order; add the `calculation` tag; recompute every number with a script.
7. **Books:** paraphrase ideas; keep quotations to a few words; never reproduce figures or company case studies — invent fictional organizations; cite the section in `source`.
8. **In scope only.** Test PMP project management: no corporate accounting (ratios, WACC, working capital), CEO/startup topics or company strategy content, and never ask candidates to recite PMBOK 7's principle or domain lists (the exam uses PMBOK 8 vocabulary; test the ideas).
9. **No tells.** Options of similar length and grammar (the key must not be conspicuously longest or shortest), no "all/none of the above", balanced answer positions. For new questions, `python3 scripts/rebalance_answers.py <ids>` reshuffles just those items.
10. **Case sets:** 180–350-word scenario, 3–4 questions from at least two domains, stems start "Refer to the case." and must depend on case facts. **Exhibits:** use when the data is the question (burn charts, CFD, control chart, network or EVM tables, registers) and say "Refer to the exhibit."
11. **Independent review.** Before release, a second reviewer answers every new item blind; any disagreement means the item is rewritten until exactly one answer is best.

## 7. Build and release

```
python3 scripts/build.py            # validate + regenerate data/*.js
python3 scripts/build.py --stats    # coverage report
python3 scripts/build.py --single   # also build dist/pmp-critical-path.html
```

Validation checks: required fields, no unknown fields, unique IDs with the right domain prefix, valid domain/task/approach/difficulty/type, 4–6 options, answer indexes in range, single vs. multi answer counts, multi-select stem wording, option notes aligned with the answer key, no duplicate options, non-empty text fields, exhibit structure (columns/rows, series lengths, reference lines), and two-way links between cases and their questions.

## 8. QA checklist (run before each release)
- [ ] `python3 scripts/build.py --check` passes (600 questions, 9 cases)
- [ ] No references to excluded, non-PMP sources (`grep -i -E "Horowitz|Financial Intelligence|Age of AI" questions content`)
- [ ] Every new item answered blind by an independent reviewer; numbers recomputed
- [ ] Selecting an option shows no correctness; Reveal shows verdict, notes, and explanations
- [ ] Hint appears in Practice, not in Exam
- [ ] Multi-select caps at the required number
- [ ] Case sets stay contiguous in practice and exam; case panel and exhibits render in both themes
- [ ] Exam: timer counts down; 180-question exam shows one section at a time, pauses during breaks, and locks finished sections; submit confirmation shows counts; results list all questions
- [ ] Spaced review: a missed question appears as due today
- [ ] Progress persists after reload; copy/import round-trips
- [ ] No horizontal scroll at 390 px; both themes readable
- [ ] No console errors

## 9. Roadmap
- Drag-and-drop matching and hotspot question types.
- Side-by-side case layout on wide screens.
- Optional per-question "confidence" rating to weight spaced review.
- New PM-focused modules as more reading material is added (only if it is in PMP scope).
