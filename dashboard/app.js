// Launch Radar v5 — dashboard. Reads window.RADAR (data.js, written by
// main.ts), renders the ranked board first and the evidence below it.
// No network: everything is local. Query params drive the screenshots:
//   ?verdict=FARM  filter the board   ?detail=<slug>  open one protocol
//   ?sort=<key>     initial sort       ?all=1  show all 758 rows
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) { document.body.textContent = 'No radar data.'; return; }
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);

  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function moneyM(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n, d) { return (n * 100).toFixed(d === undefined ? 0 : d) + '%'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function get(r, k) { return k.split('.').reduce(function (o, p) { return o == null ? undefined : o[p]; }, r); }
  function num(n, d) { return Number(n).toFixed(d === undefined ? 2 : d); }

  var vm = R.value_model, om = R.odds_model, rows = R.rows;
  var ranked = rows.filter(function (r) { return r.radar_rank !== null; }).sort(function (a, b) { return a.radar_rank - b.radar_rank; });

  // ---- header
  $('version').textContent = R.version + ' · snapshot ' + R.as_of;
  $('asof').innerHTML = 'Snapshot <b>' + esc(R.as_of) + '</b>';
  $('counts').innerHTML = '<b>' + R.totals.ranked + '</b> ranked · <b>' + R.totals.watchlist + '</b> watchlist · <b>' + R.totals.protocols + '</b> protocols';

  // ---- KPI strip
  var k = R.kpis;
  var kpis = [
    ['Walk-forward miss', '×' + num(vm.wf_miss), 'flat ×' + num(vm.flat_wf_miss) + ' · newer peers priced by older ones'],
    ['Leave-one-out miss', '×' + num(vm.loo_miss), 'flat ×' + num(vm.flat_loo_miss) + ' · ' + vm.peers + ' clean peers'],
    ['Odds, walk-forward', pct(om.wf_called_right) + ' right', 'Brier ' + num(om.wf_brier, 3) + ' vs base ' + num(om.base_wf_brier, 3) + ' · n=' + om.wf_test_n],
    ['Range honesty', pct(vm.honesty_wf_p25_75) + ' / ' + pct(vm.honesty_wf_p10_90), 'inside P25–P75 (stated 50%) / P10–P90 (stated 80%)'],
    ['Farm verdicts', k.farm_count + ' FARM', k.marginal_count + ' marginal · ' + k.skip_count + ' skip, of ' + R.totals.ranked],
    ['Ranked pre-token', moneyM(R.total_implied_pretoken), 'implied value, sum of the ' + R.totals.ranked + ' ranked rows'],
  ];
  $('kpis').innerHTML = kpis.map(function (t) {
    return '<div class="kpi"><div class="k">' + t[0] + '</div><div class="v">' + t[1] + '</div><div class="s">' + t[2] + '</div></div>';
  }).join('');

  // ---- method note: what the board is, and whether it holds out of sample
  $('method').innerHTML = '<b>How to read this board.</b> Every pre-token protocol is priced by a value model fitted on ' + vm.peers +
    ' token-bearing peers (live, positive cap and TVL, no wrapped / versioned / bridge / exchange flag), times its own odds of ever recording a token. ' +
    '<b>Does it hold on tokens it never saw?</b> <span class="q">Walk-forward: peers listed earlier price peers listed later with a typical miss of ×' + num(vm.wf_miss) +
    ' (a flat median multiple misses by ×' + num(vm.flat_wf_miss) + '); ' + pct(vm.honesty_wf_p25_75) + ' of later peers land inside the stated P25–P75 range. ' +
    'Token odds call ' + pct(om.wf_called_right) + ' of later peers right (walk-forward test: peers listed at least ' + om.wf_test_min_age_days +
    ' days before the snapshot, n=' + om.wf_test_n + ').</span>';

  // ---- board state: filter / sort / search
  var state = {
    verdict: params.get('verdict') || 'ALL',
    sort: params.get('sort') || 'implied',
    q: '',
    all: params.get('all') === '1',
  };
  var VERDICTS = ['ALL', 'FARM', 'MARGINAL', 'SKIP', 'LIVE', 'UNPRICED'];
  $('verdicts').innerHTML = VERDICTS.map(function (v) {
    return '<button data-v="' + v + '" class="' + (state.verdict === v ? 'on' : '') + '">' + (v === 'ALL' ? 'All' : v) + '</button>';
  }).join('');
  $('sort').value = state.sort;
  $('showall').checked = state.all;

  function sortKey(r) {
    if (state.sort === 'tvl') return -r.tvl_usd;
    if (state.sort === 'odds') return -r.token_odds;
    if (state.sort === 'net') return -r.farm.net_per_hour_usd;
    if (state.sort === 'age') return -(r.age_days == null ? 365 : r.age_days);
    return r.radar_rank == null ? 1e9 : r.radar_rank;
  }
  function visibleRows() {
    var base = state.all ? rows.slice().sort(function (a, b) { return a.rank - b.rank; }) : ranked;
    return base.filter(function (r) {
      if (state.verdict !== 'ALL' && r.verdict !== state.verdict) return false;
      if (state.q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase();
        if (hay.indexOf(state.q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return sortKey(a) - sortKey(b); });
  }
  function renderBoard() {
    var list = visibleRows();
    $('rows').innerHTML = list.map(function (r) {
      var age = r.age_days == null ? '—' : (r.age_days / 365.25).toFixed(1) + 'y';
      var chains = r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '');
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + (r.radar_rank == null ? '·' : r.radar_rank) + (r.rank_lo != null ? ' <span style="color:var(--dim)">(' + r.rank_lo + '–' + r.rank_hi + ')</span>' : '') + '</td>' +
        '<td class="name">' + esc(r.name) + '<small>' + esc(chains) + ' · age ' + age + (r.watchlist ? ' · ★ watchlist' : '') + '</small></td>' +
        '<td><span class="cat">' + esc(r.category || '—') + '</span></td>' +
        '<td class="num">' + moneyM(r.tvl_usd) + '</td>' +
        '<td class="num">' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>' +
        '<td class="num">' + money(r.if_launches_usd) + '</td>' +
        '<td class="num">' + pct(r.token_odds) + '</td>' +
        '<td class="num">' + (r.farm.net_per_hour_usd >= 0 ? '+' : '') + '$' + num(r.farm.net_per_hour_usd) + '</td>' +
        '<td><span class="vtag v-' + r.verdict + '">' + r.verdict + '</span></td></tr>';
    }).join('');
    $('rowcount').textContent = list.length + ' of ' + (state.all ? rows.length : ranked.length) + ' rows';
    $('board-note').textContent = state.all
      ? 'All 758 protocols by global rank. Ranked rows (1–' + ranked.length + ') are the pre-token radar; the rest are priced comps, unpriced token records and out-of-scope rows, shown for completeness.'
      : 'Ranked by implied value: the model\'s value if the token launches, times the odds it ever records one. Rank range in brackets is the 10th–90th percentile over 200 bootstrap refits. Click a row for its farm plan and the numbers behind it.';
    var btns = $('verdicts').querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-v') === state.verdict);
  }
  $('verdicts').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.verdict = b.getAttribute('data-v'); renderBoard();
  });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
  $('q').addEventListener('input', function (e) { state.q = e.target.value.trim().toLowerCase(); renderBoard(); });
  $('showall').addEventListener('change', function (e) { state.all = e.target.checked; renderBoard(); });
  document.querySelectorAll('#board thead th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k2 = th.getAttribute('data-k');
      state.sort = k2 === 'implied_value_usd' ? 'implied' : k2 === 'tvl_usd' ? 'tvl' : k2 === 'token_odds' ? 'odds' : k2 === 'farm.net_per_hour_usd' ? 'net' : 'implied';
      $('sort').value = state.sort; renderBoard();
    });
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr'); if (!tr) return;
    openDetail(tr.getAttribute('data-slug'));
  });

  // ---- detail view
  function openDetail(slug) {
    var r = rows.filter(function (x) { return x.slug === slug; })[0];
    if (!r) return;
    var f = r.farm;
    var steps = r.farm_steps.map(function (s, i) {
      var head = s.split('. ')[0];
      return '<li><b>' + esc(head) + '.</b> ' + esc(s.slice(head.length + 2)) + '</li>';
    }).join('');
    var peers = r.nearest_peers.map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td class="num">' + moneyM(p.tvl_usd) + '</td><td class="num">' + moneyM(p.mcap_usd) + '</td><td class="num">' + num(p.cap_per_tvl, 2) + '</td><td class="num">' + num(p.cap_per_loo_model, 2) + '×</td></tr>';
    }).join('');
    var modelRows = Object.keys(r.model).map(function (k2) {
      return '<tr><td>' + esc(k2) + '</td><td class="num">' + num(r.model[k2], 3) + '</td></tr>';
    }).join('');
    var matrix = '<table><thead><tr><th>Net $ if the drop is…</th><th>$1,000 in</th><th>$10,000 in</th><th>$30,000 in</th></tr></thead><tbody>' +
      ['3.5%', '7.0%', '14.0%'].map(function (label, i) {
        return '<tr><td>' + label + ' of implied</td>' + f.matrix[i].map(function (v) { return '<td class="num">' + (v >= 0 ? '+' : '') + '$' + num(v) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
    $('detail').hidden = false;
    $('detail').innerHTML =
      '<button class="back" id="back">← Back to the board</button>' +
      '<h2>' + esc(r.name) + ' <span style="color:var(--muted);font-size:14px">#' + (r.radar_rank == null ? '—' : r.radar_rank) + ' of ' + ranked.length + ' · ' + esc(r.category || 'uncategorised') + '</span></h2>' +
      '<div class="sub">' + esc(r.chains.join(', ')) + ' · TVL ' + money(r.tvl_usd) + ' · ' + (r.age_days == null ? 'listing date unknown' : Math.round(r.age_days / 30) + ' months listed') + (r.watchlist ? ' · ★ on the watchlist' : '') + '</div>' +
      '<div class="dgrid">' +
      '<div class="dcell"><div class="k">Implied value</div><div class="v">' + money(r.implied_value_usd) + '</div></div>' +
      '<div class="dcell"><div class="k">If it launches</div><div class="v">' + money(r.if_launches_usd) + '</div></div>' +
      '<div class="dcell"><div class="k">Token odds</div><div class="v">' + pct(r.token_odds) + '</div></div>' +
      '<div class="dcell"><div class="k">Value range P25–P75</div><div class="v">' + money(r.implied_low_usd) + ' – ' + money(r.implied_high_usd) + '</div></div>' +
      '<div class="dcell"><div class="k">Rank range (bootstrap)</div><div class="v">' + (r.rank_lo == null ? '—' : r.rank_lo + ' – ' + r.rank_hi) + '</div></div>' +
      '<div class="dcell"><div class="k">Verdict</div><div class="v">' + r.verdict + '</div></div>' +
      '<div class="dcell"><div class="k">Expected drop, 7% share</div><div class="v">' + money(f.drop_usd) + '</div></div>' +
      '<div class="dcell"><div class="k">Net / net per hour</div><div class="v">' + money(f.net_usd) + ' / $' + num(f.net_per_hour_usd) + '</div></div>' +
      '</div>' +
      '<div class="cols"><div><h4>How the value is made</h4><table><tbody>' + modelRows + '</tbody></table>' +
      '<p class="note">Implied = exp(intercept + size curve + offsets) × odds. P10–P90: ' + money(r.implied_p10_usd) + ' – ' + money(r.implied_p90_usd) +
      '. ' + r.odds_group_tokens + ' of ' + r.odds_group_n + ' protocols in this category record a token.</p></div>' +
      '<div><h4>Nearest priced peers — same category, closest TVL</h4><table><thead><tr><th>Peer</th><th>TVL</th><th>Cap</th><th>Cap/TVL</th><th>Cap / held-out model</th></tr></thead><tbody>' + (peers || '<tr><td colspan="5">No same-category priced peer.</td></tr>') + '</tbody></table></div></div>' +
      '<h4>Farm plan — ' + money(f.deposit_usd) + ' in, ' + f.active_minutes + ' active minutes, ' + money(f.cost_usd) + ' in fees, T-bill alternative ' + money(f.tbill_usd) + '</h4>' +
      '<ol>' + steps + '</ol>' +
      '<h4>Deposit tiers — net $ after fees</h4>' + matrix +
      '<p class="note">Exit rule: withdraw if TVL prints below ' + money(f.exit_tvl_usd) + ' (15% below today), if withdrawals pause, or if the team stops publishing. ' +
      'Fees are covered above a drop share of ' + num(f.benchmarks.fees_covered_above_share, 2) + '% (drop pool ' + money(f.benchmarks.drop_pool_usd) + '). Assumptions: $10,000 deposit (or 0.02% of TVL when smaller), 12-week horizon, 7% drop share, gas by cheapest chain, 4% T-bill.</p>';
    $('back').addEventListener('click', function () { $('detail').hidden = true; $('detail').innerHTML = ''; });
  }

  // ---- evidence tables
  function ablTable(head, bodyRows) {
    return '<table><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + bodyRows + '</tbody></table>';
  }
  $('value-ablation').innerHTML = ablTable(['Term tried', 'LOO miss', 'Walk-forward miss', 'Kept'],
    vm.ablation.map(function (a) {
      return '<tr class="' + (a.kept ? 'kept' : 'dropped') + '"><td>' + esc(a.term) + '</td><td class="num">×' + num(a.loo_miss) + '</td><td class="num">×' + num(a.wf_miss) + '</td><td class="' + (a.kept ? 'kept-mark' : '') + '">' + (a.kept ? 'kept' : '—') + '</td></tr>';
    }).join(''));
  $('value-note').textContent = 'Base: the size curve alone. Flat median-multiple baseline: LOO ×' + num(vm.flat_loo_miss) + ', walk-forward ×' + num(vm.flat_wf_miss) +
    '. Terms: ' + vm.terms.join(', ') + ' (' + vm.terms.length + ' of ' + R.kpis.value_terms_tried + ' tried). Intercept ' + num(vm.intercept, 3) +
    ' (base multiple ' + money(vm.base_multiple_at_100m) + ' at $100M TVL); coefficients ' + Object.keys(vm.coefs).map(function (k2) { return k2 + ' ' + num(vm.coefs[k2], 2) + ' ± ' + num(vm.coef_se[k2] || 0, 2); }).join(', ') + '.';
  $('odds-ablation').innerHTML = ablTable(['Term tried', 'LOO Brier', 'WF Brier', 'LOO right', 'WF right', 'Kept'],
    om.ablation.map(function (a) {
      return '<tr class="' + (a.kept ? 'kept' : 'dropped') + '"><td>' + esc(a.term) + '</td><td class="num">' + num(a.loo_brier, 3) + '</td><td class="num">' + num(a.wf_brier, 3) + '</td><td class="num">' + pct(a.loo_called_right) + '</td><td class="num">' + pct(a.wf_called_right) + '</td><td class="' + (a.kept ? 'kept-mark' : '') + '">' + (a.kept ? 'kept' : '—') + '</td></tr>';
    }).join(''));
  $('odds-note').textContent = 'Population: ' + om.population + ' protocols (rankable pre-token plus token-bearing lookalikes); ' + om.tokens_recorded + ' record a token (base rate ' + pct(om.global_rate) + '). ' +
    'Walk-forward test scores only peers listed at least ' + om.wf_test_min_age_days + ' days before the snapshot (n=' + om.wf_test_n + '), so a young protocol with no token yet is not scored as a miss. ' +
    'Terms: ' + (om.terms.join(', ') || 'base rate only') + '. A term is kept only when it lowers the LOO Brier and does not lower walk-forward called-right.';
  $('accounting').innerHTML = ablTable(['Where the rows go', 'Rows'],
    R.accounting.map(function (a) { return '<tr><td>' + esc(a.label) + '</td><td class="num">' + a.count + '</td></tr>'; }).join(''));
  $('accounting-note').textContent = 'Whole board: ' + money(R.total_implied_board) + ' = live market caps ' + money(R.total_mcap_live) + ' + ranked pre-token ' + money(R.total_implied_pretoken) +
    ' + unpriced model-implied ' + money(R.rows.filter(function (r) { return r.token_status === 'token-unpriced'; }).reduce(function (s, r) { return s + r.implied_value_usd; }, 0)) +
    ' + out-of-scope pre-token ' + money(R.rows.filter(function (r) { return r.token_status === 'pre-token' && r.radar_rank === null; }).reduce(function (s, r) { return s + r.implied_value_usd; }, 0)) + '.';
  $('checkstrip').innerHTML =
    '<div class="checkline">board rows: <b>' + R.check.board_rows + '</b> · this table = board.json: <b>' + R.totals.ranked + ' of ' + R.totals.ranked + ' rows</b> recomputed here</div>' +
    '<div class="checkline">totals equal: <b>' + money(R.check.totals_equal_usd) + '</b> — the sum of the ' + R.totals.ranked + ' ranked rows above</div>' +
    '<div class="checkline">checksum (FNV-1a of board.json): <b>' + R.check.checksum + '</b></div>' +
    '<div class="checkline">watchlist ranked: <b>' + R.check.watchlist_ranked + ' / ' + R.totals.watchlist + '</b> · ledger rows: <b>' + R.check.ledger + '</b></div>';
  $('check-note').textContent = 'The strip above sums the ranked table only. The whole-board total (' + money(R.total_implied_board) + ') lives in the accounting panel, labelled as such — the two totals are different numbers and are never mixed.';
  $('foot').innerHTML = '<p>Method, in one paragraph: implied value = exp(fitted log market cap from TVL, growth, age, chains, category and family effects) × token odds from a logistic model on the peers\' own record. ' +
    'Both models are fitted at run time from the sealed snapshot dated ' + esc(R.as_of) + '; nothing is hardcoded by name. Peers for the value fit: ' + vm.peers + ' dated, live, clean protocols; the odds population is ' + om.population + '.</p>' +
    '<p>Farm assumptions, stated where they are used: $10,000 deposit (0.02% of TVL when smaller), 12-week horizon, 7% of implied value as the drop pool, gas priced on the cheapest chain, 4% T-bill as the do-nothing alternative. A verdict of FARM needs net above $0 and at least $25 net per active hour.</p>' +
    '<p>What this radar does not do: it does not predict whether or when a token launches — odds are the peers\' record, not a launch forecast — and a protocol that records no token may still have one its DefiLlama record does not carry.</p>';

  // ---- initial render
  renderBoard();
  var detailSlug = params.get('detail');
  if (detailSlug) {
    document.body.classList.add('detail-mode');
    $('board-wrap').style.display = 'none';
    openDetail(detailSlug);
  }
})();
