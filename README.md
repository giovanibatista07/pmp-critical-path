# PMP Critical Path

A free, open-source study app for the **2026 PMP exam** (July 2026 Examination Content Outline). It has **600 original exam-style questions**, weighted exactly like the real exam and mapped to all 26 ECO tasks. Every question has a hint, a reveal-on-demand answer and an explanation for every option. The app also includes case-study sets, chart and table questions, a timed exam that runs in 3 sections like the real test, spaced review, a study guide and progress tracking.

It's a static website: no server, no build tools, no account. Open `index.html` in a browser or publish it free on GitHub Pages.

![Home screen](docs/screenshots/home.png)

## How it works

1. **Pick an answer.** Selecting an option only highlights it. Nothing tells you whether it's right.
2. **Need help?** Press **Hint** for a nudge toward the principle being tested. Hints never give the answer away.
3. **Reveal the answer** when you're ready. You see the correct option, whether you got it, and a note on **every** option explaining why it's right or wrong.
4. **Learn the pattern.** Each question includes **Why** (the reasoning), **How to approach it** (the reusable exam technique), **Go deeper** (models, formulas, predictive vs agile contrasts, common traps) and its source.

![Revealed question](docs/screenshots/question.png)

Case-study sets show the shared scenario and its exhibit above each question:

![Case study](docs/screenshots/case-study.png)

## Features

| Area | What you get |
|---|---|
| **Practice** | Filter by domain, ECO task, approach (agile / hybrid / predictive / neutral), difficulty, source, **question type** (case-study sets, charts & tables, calculations, multiple response) and your history (new, missed, due for review, flagged). Options are shuffled so you learn ideas, not letters. Keyboard: `A–D` choose, `H` hint, `R` reveal, `F` flag, `←/→` move. |
| **Case studies** | 9 longer scenarios with 32 questions (3–4 each), shown with the scenario and its exhibit alongside. Case sets always stay together. |
| **Charts & tables** | 28 graphic-based questions plus 6 case exhibits: burndown, burnup, cumulative flow, control charts, velocity and throughput, network/activity tables, EVM tables, registers, RACI and engagement matrices. Each chart can be shown as a data table. |
| **Exam simulation** | 30, 60, 90 or 180 questions in the real domain mix (33 / 41 / 26), at the real pace (80 seconds per question), with case sets included. The **full 180-question exam runs in three 60-question sections with two optional 10-minute breaks**: the clock pauses for up to 10 minutes, and a finished section is locked, as on the real test. No hints or answers until you submit; then you get a full review with scores by domain. |
| **Spaced review** | Every missed question comes back today, then after 1, 3, 7 and 16 days while you keep getting it right. After five correct reviews in a row it counts as mastered. |
| **Study guide** | Exam overview (2026 ECO, PMBOK 8 vocabulary), PMI mindset rules, formula sheet, agile essentials, case-study and chart-reading strategy, all three domain summaries, summaries of the PMBOK Guide 7th ed. and *Project Management Next Generation*, an 8-week study plan and an errata page for a third-party practice book. |
| **Question bank** | Search all 600 questions by keyword, topic, tag, case ID or question ID. |
| **Progress** | Accuracy by domain and by each of the 26 ECO tasks, simulation history, and backup/restore of your progress. |

## Coverage

| Domain | ECO weight | Questions | Per task |
|---|---|---|---|
| People | 33% | 198 | 24–27 |
| Process | 41% | 246 | 23–26 |
| Business Environment | 26% | 156 | 19–20 |
| **Total** | | **600** | |

- **Approach:** 172 agile, 125 hybrid, 147 predictive, 156 approach-neutral. Of the questions tied to a specific approach, two-thirds are agile or hybrid, in line with the exam's tilt.
- **Difficulty:** 95 easy, 334 medium, 171 hard. Every stem is a situational scenario.
- **Formats:** 569 single-answer, 31 multiple response ("Select two/three"), 59 calculations, 28 exhibits, 32 case-study questions, and 34 on AI in projects (governance, privacy, bias, compliance).
- **Sources:** every question is written against the 2026 ECO and current PMI and agile practice. **124** draw on the *PMBOK® Guide — 7th ed.* (principles, performance domains, tailoring, models/methods/artifacts), and **104** on Kerzner, Zeitoun & Vargas, *Project Management Next Generation* (strategy alignment, adaptive frameworks, PMOs and governance, value metrics, leadership).
- **Scope rule:** only project-management content relevant to the PMP. Business books that aren't about project management (corporate accounting, startup leadership, digital strategy) were deliberately left out.

### Quality checks

- `scripts/build.py` validates every item: fields, ECO task labels, answer keys vs option notes, multi-select wording, IDs, case links and exhibit data.
- Each new question was **answered blind by an independent reviewer**. No wrong keys were found. Hint leaks, length giveaways and near-duplicates were fixed.
- All numeric answers were recomputed.
- The correct option is no more likely to be the longest (or shortest) than a distractor, and answer positions are balanced across A–D.

## Run it locally

No install needed:

```bash
# Option 1: just open the file
open index.html            # macOS  (Windows: start index.html)

# Option 2: a tiny local server
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Publish it on GitHub Pages (free)

```bash
# 1. Create an empty repository on github.com named pmp-critical-path (no README), then:
git remote add origin https://github.com/<your-username>/pmp-critical-path.git
git push -u origin main

# 2. On GitHub: Settings → Pages → Build and deployment → Source: "Deploy from a branch"
#    Branch: main  ·  Folder: / (root)  → Save

# 3. After about a minute your site is live at:
#    https://<your-username>.github.io/pmp-critical-path/
```

With the GitHub CLI you can do step 1 in one line: `gh repo create pmp-critical-path --public --source=. --push`.

Every push runs a GitHub Action that validates the question bank (`.github/workflows/validate.yml`).

## Project structure

```
pmp-critical-path/
├── index.html                  # the app shell
├── assets/css/styles.css       # styles (light + dark themes, chart palette)
├── assets/js/app.js            # the app (vanilla JavaScript, no dependencies)
├── data/questions.js           # GENERATED from questions/*.json and cases/*.json
├── data/study-guide.js         # GENERATED from content/*.md
├── questions/                  # SOURCE OF TRUTH — 24 JSON files (600 questions)
├── cases/cases.json            # 9 case-study scenarios (+ exhibits) that group questions
├── content/                    # study guide pages in Markdown
├── scripts/build.py            # validates questions/cases and regenerates data/*.js
├── scripts/rebalance_answers.py# optional: reshuffle option order to balance the answer key
├── dist/pmp-critical-path.html # single-file build (everything inlined)
├── docs/screenshots/           # images used in this README
├── SPEC.md                     # product spec, data schema, and authoring guide
└── .github/workflows/validate.yml
```

## Add or edit questions

1. Edit or add a file in `questions/` (see the schema and writing guide in [SPEC.md](SPEC.md)). Case studies go in `cases/cases.json` and their questions carry `"caseId"`.
2. Run `python3 scripts/build.py`. It validates every question and case and regenerates `data/questions.js`.
3. Commit and push. Your GitHub Pages site updates automatically.

`python3 scripts/build.py --stats` prints coverage by domain, task, approach, difficulty, answer position, sources, exhibits and length balance. `--single` also rebuilds the one-file version in `dist/`.

## Your progress

Progress (answers, spaced-review schedule, flags, simulation history) is saved in your browser's local storage. It stays on that device and browser. Use **Progress → Copy progress** to back it up or move it to another device, and **Import** to restore it.

## Disclaimer

This is an independent study aid. It is not affiliated with, endorsed by, or sponsored by the Project Management Institute (PMI). PMI, PMP and PMBOK are registered marks of the Project Management Institute, Inc. The questions are original practice items written against the public 2026 PMP Examination Content Outline; they are not actual exam questions. Book-based questions and summaries paraphrase ideas from the cited books for study purposes and do not reproduce the books' text, figures or case studies. Please buy the books to read them in full.

## License

Code and original content: MIT (see [LICENSE](LICENSE)).
