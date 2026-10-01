#!/usr/bin/env python3
"""Shuffle the option order of specific questions (deterministically, seeded by id) so the answer key
stays spread across A–D. Option notes move with their options and `answer` is remapped.

Usage:
  python3 scripts/rebalance_answers.py PEO-201 PRO-247      # only these questions
  python3 scripts/rebalance_answers.py --all                # every question (reshuffles the whole bank)

Questions whose options are naturally ordered (numbers, money, 'Option A'…) are left untouched —
keep numeric options in ascending order by hand."""
import json, random, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORDERED = re.compile(r"^(\$|−|-|\+|\d|Option |Seller |Feature |Candidate |Investment |Project [A-Z] )")
args = sys.argv[1:]
if not args:
    sys.exit(__doc__)
targets = None if args == ["--all"] else set(args)

changed = 0
for f in sorted((ROOT / "questions").glob("*.json")):
    data = json.loads(f.read_text(encoding="utf-8"))
    touched = False
    for q in data:
        if targets is not None and q["id"] not in targets:
            continue
        if all(ORDERED.match(o.strip()) for o in q["options"]):
            continue
        perm = list(range(len(q["options"])))
        random.Random(q["id"] + "-v2").shuffle(perm)  # new position i holds old option perm[i]
        q["options"] = [q["options"][i] for i in perm]
        q["optionNotes"] = [q["optionNotes"][i] for i in perm]
        q["answer"] = sorted(perm.index(a) for a in q["answer"])
        touched = True
        changed += 1
    if touched:
        f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"reshuffled {changed} question(s)")
