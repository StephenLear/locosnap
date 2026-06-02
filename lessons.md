
## 2026-06-02 — Sequence store-config BEFORE the build when a UI feature depends on it
- Built v1.0.36 (free-tier 6->3) and submitted, THEN changed prices, THEN realised the "SAVE %" annual badge (which needs the new live prices to compute correctly) could not have been in 1.0.36 — forcing an immediate 1.0.37.
- Lesson: when a build and a coupled store-config change (pricing, offers) are both pending, do the **config change first**, then build, so the dependent UI feature ships in the same binary. Check the dependency direction before ordering build vs config.
- Same root cause exposed the dormant Play win-backs (offers set up after the build; needed app wiring that was never in any build).
