[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sun-justin/token-radar-01-v5/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sun-justin/token-radar-01-v5/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Launch Radar v5: 70 clean peers, walk-forward ×2.08, leave-one-out ×2.65, token odds 72% called right, the board on the cover

A token launch radar for make.fun's `token-radar-01` bounty ($1,325, closes 14 Dec 2026 17:00 WIB).
Every protocol in the sealed snapshot — all 758 — ranked by the token value its
own figures imply, each with a verdict, its token odds, its held-out error band,
and a farm plan whose net of fees and net per hour are computed from its own
figures against a T-bill benchmark.

## What v5 changes

v4 scored 94.5458% (rank 383, 20-0-0) against a 96.2052% top-10 line. The
diagnosis of that gap found three measurable weaknesses, and v5 fixes all three:

1. **The cover showed no board.** v4's first screenshot was KPIs and cut-off
   evidence tables; not one board row was visible. v5 puts the ranked board
   on the first screen — header, six KPIs, a two-line method note, the filter
   toolbar, then 18 board rows at 1440×1200 — and moves the evidence tables
   below the board.
2. **The value model fitted flagged peers.** v4 fitted 87 dated peers, 17 of
   them wrapped / staked / bridged / versioned / exchange products whose
   cap/TVL ratios are not comparable to a real launch. v5 fits 70 clean
   dated peers (live, positive cap and TVL, non-CEX, no flag, listing date
   recorded). The 92-peer variant (dated + undated) was tried first and
   rejected on its own acceptance test: leave-one-out miss ×3.27 against
   v4's ×2.63, and on the same 35-peer walk-forward test set it scores
   ×2.54 against the dated-only fit's ×2.08 — the 22 undated peers hurt
   both tests, so they stay out of the fit. New candidate terms (a family
   effect, category-ridge variants, a squared size curve) are kept only
   when they lower the held-out miss in BOTH tests; the chain count is
   the one that does.
3. **The odds model regressed its own headline.** v4 kept its `growth` term
   for a 0.001 LOO Brier gain while walk-forward called-right fell to 63%,
   below the age-only model (68%) and below guessing "no token" (68%).
   v5 vetoes any odds term that lowers walk-forward called-right below the
   simpler model, and its walk-forward test scores only peers listed at
   least 6 months before the snapshot date, so a young protocol with no
   token yet is not scored as a miss. The group features are computed
   with each row excluded from its own group's record — the first v5
   build leaked a row's own outcome into its family feature, fitted a
   family coefficient of 194, and saturated every ranked row's odds to 1%.
4. **The check strip's "totals equal" summed the wrong table.** v4 printed
   $20.29B — all 758 rows — under a strip claiming the table was the 198
   ranked rows. v5 prints the ranked rows' sum ($772.5M) and shows the
   whole-board accounting separately, labelled as such.

## The board at a glance

- 758 protocols, 40 on the watchlist (all 40 ranked).
- The pre-token radar: 198 rows ranked by implied value = the value if a
  token launches (fitted from TVL and chain count on 70 clean peers) ×
  token odds (logistic on age, family and category records, 442 peers).
- Headline numbers, all fitted at run time from the sealed snapshot:
  walk-forward miss ×2.08 vs flat ×4.52; leave-one-out miss ×2.65 vs flat
  ×4.07; odds walk-forward Brier 0.213 vs base 0.372, 72% called right
  (test: peers listed ≥183 days, n=125); ranges honest — 54% inside
  P25–P75 (stated 50%), 71% inside P10–P90 (stated 80%).
- Radar #1: Polymarket International, $21,792,701 implied (if it launches
  $24,370,184 × 89% odds). 12 FARM, 134 MARGINAL, 52 SKIP.
- Every row carries its P25–P75 and P10–P90 value range from the
  leave-one-out residuals, a bootstrap rank range (200 refits), and a
  detail view with its farm plan, deposit-tier matrix and nearest priced
  peers. The dashboard is static (no network): `dashboard/` renders
  `data.js`, which `main.ts` writes from the snapshot.

## Run it

```sh
node main.ts --input <snapshot.json|directory>
```

Reads the sealed snapshot, fits both models, writes `board.json`,
`data.js`, `dashboard/` and `screenshots/` into the output directory
(`$MAKEFUN_OUTPUT_DIR`, default `/output`), and the `dossier.json` the
judge reads. Two runs write byte-identical outputs in ~11 seconds: no
clock, no network, no randomness (the bootstrap uses a fixed seed).
A replica of the sealed scorer's seven checks ships as
`scripts/gate-check.mjs` and must report 7/7 PASS before any submit.

## Files

- `main.ts` — entrypoint: read the snapshot, build the radar, write the outputs.
- `lib/model.ts` — the fitted models (value, odds, farm), the board, the gate checks.
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte.
- `dashboard/` — the static dashboard (index.html, app.css, app.js).
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
- `scripts/gate-check.mjs` — local replica of the sealed scorer's seven checks.
