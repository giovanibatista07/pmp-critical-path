# Formula Cheat Sheet

<!-- group: Exam Essentials | order: 3 | summary: Earned value, estimating, scheduling, risk, procurement, finance (NPV, IRR, payback, BCR), and agile flow formulas with worked examples. -->

## Earned value management (EVM)

| Measure | Formula | Good when |
|---|---|---|
| Cost variance (CV) | EV − AC | positive |
| Schedule variance (SV) | EV − PV | positive |
| Cost performance index (CPI) | EV ÷ AC | > 1 |
| Schedule performance index (SPI) | EV ÷ PV | > 1 |
| EAC — typical (trend continues) | BAC ÷ CPI | — |
| EAC — atypical (one-time variance) | AC + (BAC − EV) | — |
| EAC — cost and schedule both matter | AC + [(BAC − EV) ÷ (CPI × SPI)] | — |
| EAC — new estimate | AC + bottom-up ETC | — |
| Estimate to complete (ETC) | EAC − AC | — |
| Variance at completion (VAC) | BAC − EAC | positive |
| To-complete performance index (TCPI) | (BAC − EV) ÷ (BAC − AC) — or ÷ (EAC − AC) for a revised target | ≤ 1 is achievable |

**Memory aid:** EV always comes first. Variances subtract; indices divide.

**Example:** PV 100k, EV 90k, AC 110k → CV −20k, SV −10k, CPI 0.82, SPI 0.90 → over budget and behind schedule.

## Estimating

- **PERT / beta:** E = (O + 4M + P) ÷ 6 · SD = (P − O) ÷ 6 · Variance = SD²
- **Triangular:** E = (O + M + P) ÷ 3
- Path SD = √(sum of activity variances)
- ±1σ ≈ 68% · ±2σ ≈ 95% · ±3σ ≈ 99.7%

## Scheduling

- **Total float** = LS − ES = LF − EF
- **Free float** = ES(successor) − EF(activity)
- **Critical path** = longest path; zero total float (usually)
- **Crashing** adds cost; **fast tracking** adds risk. Both only help on the critical path.

## Communication

- **Channels** = n(n − 1) ÷ 2. From 8 to 12 people: 28 → 66 (+38).

## Risk

- **EMV** = probability × impact (threats negative, opportunities positive)
- Decision tree: expected value of each branch; choose best

## Procurement

- **Point of total assumption (FPIF):** PTA = (Ceiling price − Target price) ÷ Buyer's share + Target cost
- **CPIF fee:** Target fee + Seller's share × (Target cost − Actual cost); buyer pays actual cost + fee

## Finance and project selection

- **Present value:** PV = FV ÷ (1 + i)ⁿ
- **NPV** = Σ PV of future cash flows − initial investment → accept if > 0
- **IRR** = discount rate at which NPV = 0 → accept if IRR > hurdle rate
- **Payback** = initial investment ÷ annual cash flow (ignores time value and later cash)
- **Profitability index (PI)** = PV of future cash flows ÷ initial investment → > 1 is good; use to rank projects of different size
- **ROI** (simple) = (gain − cost) ÷ cost
- **Benefit-cost ratio (BCR)** = PV of benefits ÷ PV of costs → > 1 means benefits exceed costs
- **Opportunity cost** = the value of the best option you give up. **Sunk costs** are already spent: ignore them when deciding whether to continue
- **Life-cycle cost** = acquisition + operating + maintenance + disposal over the product's life (compare options on this, not purchase price)
- **Cost baseline** = work package estimates + contingency reserve · **Budget** = cost baseline + management reserve
- **Agile release budget** ≈ number of sprints × cost per sprint (team run rate)

**Worked NPV:** invest $3,000; receive $1,300 at the end of each of 3 years; discount rate 8% → PV ≈ $3,350 → NPV ≈ +$350 → accept. Payback = 2.31 years. IRR ≈ 14.4%. When projects are mutually exclusive, choose the higher **NPV**.

## Agile flow and value

- **Velocity forecasting:** remaining points ÷ velocity range → range of sprints (round up)
- **Little's Law:** average cycle time = average WIP ÷ average throughput
- **WSJF** = cost of delay ÷ job size (highest first)
- **Process cycle efficiency** = value-added time ÷ total lead time
- **Net Promoter Score** = % promoters (9–10) − % detractors (0–6)

## Communication and quality quick math

- **Communication channels** = n(n − 1) ÷ 2. Adding people grows channels much faster than headcount.
- **Rule of seven (control charts):** 7 consecutive points on one side of the mean → investigate, even if all are within limits.
- **Cost of quality** = prevention + appraisal (cost of conformance) + internal + external failure (cost of nonconformance).
