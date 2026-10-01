# Case Studies & Graphic Questions

<!-- group: Exam Essentials | order: 5 | summary: How to work the 2026 exam's case/scenario sets and chart-based items — plus how to read burndown, burnup, CFD, control charts, network tables and EVM tables fast. -->

## Case/scenario sets

The 2026 exam adds sets of questions that share one longer scenario. This app has **9 case studies with 32 questions**. Full-length simulations include 3 case sets, 60-question simulations include 1, and each set stays together as it would on the exam. Use **Practice → Question type → Case-study sets** or **Home → Work through a case study** to drill them.

**A reliable routine**

1. **Read the ask first, then the case.** Skim the question so you know what to look for, then read the scenario once, carefully.
2. **Mark the facts that constrain decisions:** who has authority (sponsor, product owner, contract administrator, CCB), contract terms and notice periods, regulatory duties, stated thresholds, and the approach (predictive, agile, hybrid).
3. **Watch for the "new development".** Most case questions add a twist ("Two weeks later…"). The best answer responds to the twist *within* the case's rules.
4. **Answer each question on its own merits.** Earlier answers in the set are not revealed, and one wrong answer doesn't make the next one wrong.
5. **Budget time.** A 4-question case with a long scenario takes about 5–6 minutes. Keep the case panel open while you answer.

**Common traps in case items**

- An option that is right in general but **ignores a case fact** (for example, "issue a change order", when only the contract administrator may do that).
- An option that **solves the symptom the scenario highlights** but not the underlying cause shown in the data.
- **Escalating straight past a named role** the case gives authority to.

## Graphic-based items

The bank has 28 chart and table questions, plus exhibits inside 6 case studies. Filter with **Question type → Charts & tables**. Every chart has a **Show the data as a table** toggle.

| Exhibit | Read it like this | Typical question |
|---|---|---|
| **Sprint burndown** | Remaining work vs the ideal line. Above the line means behind, and a flat stretch means blocked or unfinished stories. | Is the sprint goal at risk? What should the team do in the Daily Scrum? |
| **Release burnup** | Two lines: total scope and completed. The gap is the work left. A rising scope line means the date slips even if velocity holds. | Forecast the release (remaining ÷ net velocity) and decide what to discuss with the product owner. |
| **Cumulative flow diagram** | Bands are workflow states. A **widening** band means work is piling up in that state (a bottleneck). Parallel bands mean steady flow. | Where is the constraint? Answer: limit WIP there and swarm, not "add more starts". |
| **Control chart** | Mean with upper and lower control limits. A point outside the limits, or **7 consecutive points on one side of the mean**, signals an assignable cause. Specification limits are a different thing. | Is the process in control? What to investigate. |
| **Velocity / throughput bars** | Look at the average and the variation, not the best sprint. Net throughput = done − added. | Forecast weeks remaining. Is a commitment realistic? |
| **Activity list / network table** | Draw the paths quickly. The longest path is the critical path. Total float = LS − ES; free float = earliest ES of successors − EF. | Which activity can slip without delaying the project? What happens if X is delayed? |
| **EVM table** | CV = EV − AC, SV = EV − PV, CPI = EV/AC, SPI = EV/PV. Check critical-path accounts separately, because a good total can hide a late critical account. | What's the real status? What to report? |
| **Registers & logs** (risk, issue, change, benefits) | Look for missing owners, overdue triggers, changes approved outside the process, and benefits without a measure or owner. | What should the PM do next? |
| **Engagement matrix / RACI** | For engagement, compare current (C) with desired (D). For RACI, exactly one **A** per activity. | Whom to engage first? Which role conflict to fix? |

*Tip:* in the real exam you can't hover over a chart. Practise reading values from the gridlines, and use the data table here only to check yourself.
