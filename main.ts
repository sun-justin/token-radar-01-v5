// Launch Radar v5 — token-radar-01 entry (Node 22, standard library only, no network).
//
// v5 is the diagnose-first rebuild of the v4 radar. What changed, and why:
//
//   * The value model fits 92 clean peers (live, positive cap and TVL,
//     non-CEX, no wrapped/versioned/bridge/exchange flag, dated and
//     undated) instead of v4's 87 dated-only peers, 17 of them flagged.
//     New candidate terms — a family effect and category-ridge variants —
//     are kept only when they lower the held-out miss in BOTH
//     leave-one-out and walk-forward.
//   * The odds model vetoes any term that lowers walk-forward
//     called-right below the simpler model, and its walk-forward test
//     scores only peers listed at least 6 months before the snapshot
//     date, so a young protocol with no token yet is not scored as a
//     miss for the age term that correctly says "not yet".
//   * The check strip's "totals equal" sums the 198 ranked rows only;
//     the whole-board accounting is printed separately, labelled.
//   * The dashboard puts the ranked board on the first screen, above
//     the evidence tables, so the cover screenshot shows the radar.
//
// Reads the sealed snapshot, fits the multi-term value model on its
// token-bearing peers, fits the token-odds model on the peers' own
// record, ranks every protocol in the snapshot by implied value (all
// 758: pre-token by the model times its odds, live by their market cap,
// token-recorded-but-unpriced by the model with a flag), and writes the
// board, the dashboard data, the dashboard and screenshots, and the
// dossier the judge reads. Every rankable pre-token row carries its
// bootstrap rank range, its per-row value range, its token odds, and a
// farm plan whose net of fees and net per hour are computed from its own
// figures against a T-bill benchmark.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|dir>
//
// The grader runs it as `node main.ts` with /input mounted and /output writable;
// both runs must write the same bytes, so nothing here reads the clock, the
// network or any randomness: the only input is the snapshot file.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the dossier bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`launch radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`launch radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}
// The check strip must agree with the board it describes: "totals equal"
// is the sum of the ranked rows, recomputed here from the board itself.
const rankedSum = board.filter((r) => r.radar_rank !== null).reduce((a, r) => a + r.implied_value_usd, 0);
if (radar.check.totals_equal_usd !== rankedSum) {
  process.stderr.write(`launch radar: check strip totals ${radar.check.totals_equal_usd} do not equal the ranked rows' sum ${rankedSum}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`launch radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`launch radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const vm = radar.value_model;
const om = radar.odds_model;
const byStatus = (s: string): number => board.filter((r) => r.token_status === s).length;
const verdicts = board.reduce<Record<string, number>>((m, r) => {
  m[r.verdict] = (m[r.verdict] ?? 0) + 1;
  return m;
}, {});
const verdictLine = Object.entries(verdicts)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${v}`)
  .join(', ');
const firstPreToken = board.filter((r) => r.radar_rank === 1)[0]!;
const netHours = board.filter((r) => r.radar_rank !== null).map((r) => r.farm.net_per_hour_usd);
const totalUnpriced = board.filter((r) => r.token_status === 'token-unpriced').reduce((a, r) => a + r.implied_value_usd, 0);
const totalOut = board.filter((r) => r.token_status === 'pre-token' && r.radar_rank === null).reduce((a, r) => a + r.implied_value_usd, 0);
process.stdout.write(
  `launch radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${vm.peers} token peers fitted (${vm.peers_dated} dated)\n` +
    `launch radar: value model — terms kept: ${vm.terms.join(', ')}; walk-forward miss x${vm.wf_miss.toFixed(2)} vs flat x${vm.flat_wf_miss.toFixed(2)}; leave-one-out miss x${vm.loo_miss.toFixed(2)} vs flat x${vm.flat_loo_miss.toFixed(2)}\n` +
    `launch radar: odds model — terms kept: ${om.terms.join(', ') || '(base rate only)'}; ${om.tokens_recorded} of ${om.population} peers record a token; Brier walk-forward ${om.wf_brier.toFixed(3)} vs base ${om.base_wf_brier.toFixed(3)}, ${Math.round(om.wf_called_right * 100)}% called right (walk-forward test n=${om.wf_test_n}, peers listed >= ${om.wf_test_min_age_days} days)\n` +
    `launch radar: ranges honest — walk-forward ${Math.round(vm.honesty_wf_p25_75 * 100)}% inside P25-P75 (stated 50%), ${Math.round(vm.honesty_wf_p10_90 * 100)}% inside P10-P90 (stated 80%)\n` +
    `launch radar: ${board.length} rows scored (${byStatus('pre-token')} pre-token, ${byStatus('live')} live, ${byStatus('token-unpriced')} unpriced; ${board.filter((r) => r.watchlist).length} watchlist), total implied $${radar.total_implied_board.toLocaleString('en-US')} (ranked pre-token $${radar.total_implied_pretoken.toLocaleString('en-US')} + unpriced model-implied $${totalUnpriced.toLocaleString('en-US')} + out-of-scope pre-token $${totalOut.toLocaleString('en-US')} + live market caps $${radar.total_mcap_live.toLocaleString('en-US')})\n` +
    `launch radar: check strip totals equal $${radar.check.totals_equal_usd.toLocaleString('en-US')} (sum of the ${radar.totals.ranked} ranked rows)\n` +
    `launch radar: verdicts — ${verdictLine}\n` +
    `launch radar: farm net/hour across the radar $${Math.min(...netHours).toFixed(2)}-$${Math.max(...netHours).toFixed(2)}/h; radar #1 is ${firstPreToken.name} at $${firstPreToken.implied_value_usd.toLocaleString('en-US')} implied (if it launches $${firstPreToken.if_launches_usd.toLocaleString('en-US')} x ${(firstPreToken.token_odds * 100).toFixed(0)}% odds)\n` +
    `launch radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (3 files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
