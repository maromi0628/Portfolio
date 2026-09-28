(function () {
  'use strict';

  const STORAGE_KEY = 'freelance-dashboard-demo-v1';
  const STATUSES = ['応募検討', '応募済', '契約', '作業中', '納品', '検収完了', '不採用'];
  const ACTIVE = ['契約', '作業中', '納品'];
  const SEED = window.DASHBOARD_DATA || { settings: {}, candidates: [], jobs: [], worklogs: [], payments: [] };

  // ---------- state ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { data: JSON.parse(raw), dirty: true };
    } catch (e) { /* storage unavailable */ }
    return { data: clone(SEED), dirty: false };
  }
  let { data: state, dirty } = load();
  for (const k of ['candidates', 'jobs', 'worklogs', 'payments']) state[k] = state[k] || [];
  state.settings = Object.assign({ monthlyTarget: 0, feeTiers: SEED.settings.feeTiers || [] }, state.settings);

  function save() {
    dirty = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    render();
  }
  function nextId(list, prefix) {
    let n = 0;
    for (const x of list) {
      const m = String(x.id || '').match(/(\d+)$/);
      if (m) n = Math.max(n, Number(m[1]));
    }
    return prefix + String(n + 1).padStart(3, '0');
  }

  // ---------- helpers ----------
  const yen = (n) => '¥' + Math.round(n || 0).toLocaleString('ja-JP');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const ym = (d) => (d || '').slice(0, 7);
  const hours = (min) => (min / 60).toFixed(1) + 'h';
  const jobById = (id) => state.jobs.find((j) => j.id === id);

  // クラウドソーシングのシステム利用料（契約金額に対する段階制、settings.feeTiers で変更可）
  function calcFee(amount) {
    let fee = 0, prev = 0;
    for (const t of state.settings.feeTiers) {
      const cap = t.upTo == null ? Infinity : t.upTo;
      if (amount > prev) fee += (Math.min(amount, cap) - prev) * t.rate;
      prev = cap;
    }
    return Math.round(fee);
  }
  const net = (p) => p.amount - calcFee(p.amount);
  function hourlyRate(c) {
    if (c.budgetType === '時給') return c.budget;
    return c.estHours ? Math.round(c.budget / c.estHours) : null;
  }
  const stars = (n) => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));
  function daysUntil(d) {
    if (!d) return null;
    return Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000);
  }

  // ---------- aggregates ----------
  function monthlySales() {
    const map = {};
    for (const p of state.payments) {
      const k = ym(p.date);
      if (!k) continue;
      map[k] = map[k] || { gross: 0, net: 0, paid: 0 };
      map[k].gross += p.amount;
      map[k].net += net(p);
      if (p.status === '入金済') map[k].paid += net(p);
    }
    return map;
  }
  function lastMonths(n) {
    const out = [], d = new Date();
    d.setDate(1);
    for (let i = n - 1; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'));
    }
    return out;
  }

  // ---------- chart (inline SVG, no external lib) ----------
  function barChart(months, map) {
    const W = 600, H = 220, pad = { l: 56, r: 8, t: 10, b: 28 };
    const vals = months.map((m) => (map[m] ? map[m].net : 0));
    const target = state.settings.monthlyTarget || 0;
    const max = Math.max(1, target, ...vals) * 1.15;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / months.length;
    const y = (v) => pad.t + ih - (v / max) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="月別手取り売上">`;
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/>`;
      s += `<text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v / 1000)}k</text>`;
    }
    months.forEach((m, i) => {
      const v = vals[i], x = pad.l + i * bw + bw * 0.2, w = bw * 0.6;
      s += `<rect x="${x}" y="${y(v)}" width="${w}" height="${pad.t + ih - y(v)}" rx="3" fill="var(--bar)"><title>${m}: ${yen(v)}</title></rect>`;
      s += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${Number(m.slice(5))}月</text>`;
    });
    if (target) {
      s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(target)}" y2="${y(target)}" stroke="var(--good)" stroke-dasharray="4 4"/>`;
      s += `<text x="${pad.l + 4}" y="${y(target) - 4}">目標 ${yen(target)}</text>`;
    }
    return s + '</svg>';
  }

  // ---------- views ----------
  function renderOverview() {
    const m = ym(today());
    const sales = monthlySales();
    const cur = sales[m] || { gross: 0, net: 0, paid: 0 };
    const pending = state.payments.filter((p) => p.status !== '入金済').reduce((a, p) => a + net(p), 0);
    const active = state.jobs.filter((j) => ACTIVE.includes(j.status));
    const monthMin = state.worklogs.filter((w) => ym(w.date) === m).reduce((a, w) => a + Number(w.minutes || 0), 0);
    // 実績時給は「入金記録があり、作業ログもある案件」だけで計算する
    const loggedJobs = new Set(state.worklogs.map((w) => w.jobId));
    const paidJobs = new Set(state.payments.map((p) => p.jobId));
    const totalMin = state.worklogs.filter((w) => paidJobs.has(w.jobId)).reduce((a, w) => a + Number(w.minutes || 0), 0);
    const totalNet = state.payments.filter((p) => loggedJobs.has(p.jobId)).reduce((a, p) => a + net(p), 0);
    const target = state.settings.monthlyTarget || 0;
    const pct = target ? Math.min(100, Math.round((cur.net / target) * 100)) : 0;

    const due = state.jobs
      .filter((j) => ACTIVE.includes(j.status) && j.dueDate)
      .map((j) => ({ j, d: daysUntil(j.dueDate) }))
      .filter((x) => x.d <= 3)
      .sort((a, b) => a.d - b.d);

    const counts = STATUSES.map((s) => [s, state.jobs.filter((j) => j.status === s).length]);

    document.getElementById('overview').innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="label">今月の手取り売上</div><div class="value">${yen(cur.net)}</div>
          <div class="note">契約額 ${yen(cur.gross)}${target ? ` / 目標 ${yen(target)} (${pct}%)` : ''}</div>
          ${target ? `<div class="progress"><div style="width:${pct}%"></div></div>` : ''}</div>
        <div class="kpi"><div class="label">入金待ち（手取り）</div><div class="value">${yen(pending)}</div></div>
        <div class="kpi"><div class="label">進行中の案件</div><div class="value">${active.length}件</div>
          <div class="note">契約・作業中・納品</div></div>
        <div class="kpi"><div class="label">今月の作業時間</div><div class="value">${hours(monthMin)}</div></div>
        <div class="kpi"><div class="label">実績時給（累計）</div><div class="value">${totalMin ? yen(totalNet / (totalMin / 60)) : '—'}</div>
          <div class="note">売上計上済み案件の 手取り ÷ 作業時間</div></div>
        <div class="kpi"><div class="label">候補案件</div><div class="value">${state.candidates.length}件</div></div>
      </div>
      <div class="grid2">
        <div class="card chart"><h2>月別 手取り売上（直近6か月）</h2>${barChart(lastMonths(6), sales)}</div>
        <div class="card">
          <h2>納期アラート（3日以内）</h2>
          ${due.length ? due.map(({ j, d }) => `<div class="alert">${d < 0 ? `${-d}日超過` : d === 0 ? '今日' : `あと${d}日`}：${esc(j.title)}（${esc(j.dueDate)}）</div>`).join('') : '<div class="empty">直近の納期はありません</div>'}
          <h2 style="margin-top:16px">ステータス別件数</h2>
          <div class="filters">${counts.map(([s, n]) => `<span class="badge">${s} ${n}</span>`).join('')}</div>
          <label class="muted" style="display:block;margin-top:12px">月次目標（手取り）
            <input id="target" type="number" min="0" step="1000" value="${target}"></label>
        </div>
      </div>`;
    document.getElementById('target').addEventListener('change', (e) => {
      state.settings.monthlyTarget = Number(e.target.value) || 0;
      save();
    });
  }

  function renderPipeline() {
    const cols = STATUSES.map((s) => {
      const jobs = state.jobs.filter((j) => j.status === s);
      const sum = jobs.reduce((a, j) => a + Number(j.contractAmount || 0), 0);
      return `<div class="col"><h3><span>${s}</span><span class="muted">${jobs.length}</span></h3>
        <div class="sum">${yen(sum)}</div>
        ${jobs.map((j) => {
          const d = daysUntil(j.dueDate);
          return `<div class="job"><div class="t">${esc(j.title)}</div>
            <div class="m">${j.contractAmount ? yen(j.contractAmount) : '金額未定'}${j.dueDate ? ` ・ 納期 ${esc(j.dueDate)}${d != null && d <= 3 && ACTIVE.includes(j.status) ? ' <span class="badge warn">近い</span>' : ''}` : ''}</div>
            ${j.notes ? `<div class="m">${esc(j.notes)}</div>` : ''}
            <select data-job="${j.id}">${STATUSES.map((x) => `<option${x === j.status ? ' selected' : ''}>${x}</option>`).join('')}</select>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    document.getElementById('pipeline').innerHTML = `
      <div class="card"><details><summary>＋ 案件を追加</summary>
        <form class="inline" id="job-form">
          <label>案件名<input name="title" required></label>
          <label>契約金額(税込)<input name="contractAmount" type="number" min="0"></label>
          <label>納期<input name="dueDate" type="date"></label>
          <label>ステータス<select name="status">${STATUSES.map((s) => `<option>${s}</option>`).join('')}</select></label>
          <label>メモ<input name="notes"></label>
          <button class="btn">追加</button>
        </form></details></div>
      <div class="kanban">${cols}</div>
      ${state.jobs.length ? '' : '<div class="empty">案件はまだありません。候補案件タブから「検討へ」で移せます。</div>'}`;

    document.getElementById('job-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      state.jobs.push({
        id: nextId(state.jobs, 'J'), candidateId: null, title: f.get('title'), status: f.get('status'),
        contractAmount: Number(f.get('contractAmount')) || 0, dueDate: f.get('dueDate') || '', notes: f.get('notes') || '',
      });
      save();
    });
    document.querySelectorAll('#pipeline select[data-job]').forEach((sel) =>
      sel.addEventListener('change', () => {
        const j = jobById(sel.dataset.job);
        j.status = sel.value;
        if (j.status === '検収完了' && j.contractAmount && !state.payments.some((p) => p.jobId === j.id)) {
          state.payments.push({ id: nextId(state.payments, 'P'), jobId: j.id, amount: j.contractAmount, status: '予定', date: today() });
        }
        save();
      }));
  }

  let candSort = { key: 'claudeFeasibility', dir: -1 };
  let candFilter = { minFeas: 0, category: '' };
  function renderCandidates() {
    const cats = [...new Set(state.candidates.map((c) => c.category).filter(Boolean))];
    const rows = state.candidates
      .filter((c) => (c.claudeFeasibility || 0) >= candFilter.minFeas && (!candFilter.category || c.category === candFilter.category))
      .map((c) => Object.assign({}, c, { hourlyRate: hourlyRate(c) }))
      .sort((a, b) => ((a[candSort.key] || 0) > (b[candSort.key] || 0) ? 1 : -1) * candSort.dir);
    const taken = new Set(state.jobs.map((j) => j.candidateId));
    const th = (k, label, cls = '') => `<th class="sortable ${cls}" data-sort="${k}">${label}${candSort.key === k ? (candSort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;

    document.getElementById('candidates').innerHTML = `
      <div class="card">
        <div class="filters">
          <select id="f-feas"><option value="0">実現度: すべて</option>${[3, 4, 5].map((n) => `<option value="${n}"${candFilter.minFeas === n ? ' selected' : ''}>★${n}以上</option>`).join('')}</select>
          <select id="f-cat"><option value="">カテゴリ: すべて</option>${cats.map((c) => `<option${candFilter.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        </div>
        <div class="table-wrap"><table>
          <thead><tr>${th('title', '案件')}${th('category', 'カテゴリ')}${th('budget', '予算', 'num')}${th('estHours', '想定工数', 'num')}${th('hourlyRate', '想定時給', 'num')}${th('claudeFeasibility', 'Claude実現度')}${th('deadline', '応募期限')}<th>選定理由 / リスク</th><th></th></tr></thead>
          <tbody>${rows.map((c) => `<tr>
            <td>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>` : esc(c.title)}${c.applicants != null ? `<div class="muted">応募 ${c.applicants}件（${esc(c.foundAt)}時点）</div>` : ''}</td>
            <td>${esc(c.category)}</td>
            <td class="num">${yen(c.budget)}${c.budgetType === '時給' ? '/h' : ''}</td>
            <td class="num">${c.estHours ? c.estHours + 'h' : '—'}</td>
            <td class="num">${c.hourlyRate ? yen(c.hourlyRate) : '—'}</td>
            <td class="stars" title="${c.claudeFeasibility}/5">${stars(c.claudeFeasibility)}</td>
            <td>${esc(c.deadline || '')}</td>
            <td>${esc(c.reason)}${c.risk ? `<div class="muted">⚠ ${esc(c.risk)}</div>` : ''}</td>
            <td>${taken.has(c.id) ? '<span class="badge good">登録済</span>' : `<button class="btn small" data-promote="${c.id}">検討へ</button>`}
                <button class="btn small danger" data-del-cand="${c.id}" title="削除">×</button></td>
          </tr>`).join('')}</tbody>
        </table></div>
        ${rows.length ? '' : '<div class="empty">候補案件はまだありません。下のフォームから追加できます。</div>'}
      </div>
      <div class="card"><details><summary>＋ 候補を手動で追加</summary>
        <form class="inline" id="cand-form">
          <label>案件名<input name="title" required></label>
          <label>URL<input name="url" type="url"></label>
          <label>カテゴリ<input name="category"></label>
          <label>予算<input name="budget" type="number" min="0"></label>
          <label>形式<select name="budgetType"><option>固定</option><option>時給</option></select></label>
          <label>想定工数(h)<input name="estHours" type="number" min="0" step="0.5"></label>
          <label>Claude実現度(1-5)<input name="claudeFeasibility" type="number" min="1" max="5" value="3"></label>
          <label>応募期限<input name="deadline" type="date"></label>
          <label>選定理由<input name="reason"></label>
          <label>リスク<input name="risk"></label>
          <button class="btn">追加</button>
        </form></details></div>`;

    const root = document.getElementById('candidates');
    root.querySelectorAll('th[data-sort]').forEach((el) => el.addEventListener('click', () => {
      const k = el.dataset.sort;
      candSort = { key: k, dir: candSort.key === k ? -candSort.dir : -1 };
      renderCandidates();
    }));
    root.querySelector('#f-feas').addEventListener('change', (e) => { candFilter.minFeas = Number(e.target.value); renderCandidates(); });
    root.querySelector('#f-cat').addEventListener('change', (e) => { candFilter.category = e.target.value; renderCandidates(); });
    root.querySelectorAll('[data-promote]').forEach((b) => b.addEventListener('click', () => {
      const c = state.candidates.find((x) => x.id === b.dataset.promote);
      state.jobs.push({ id: nextId(state.jobs, 'J'), candidateId: c.id, title: c.title, status: '応募検討',
        contractAmount: c.budgetType === '固定' ? c.budget : 0, dueDate: '', notes: '' });
      save();
    }));
    root.querySelectorAll('[data-del-cand]').forEach((b) => b.addEventListener('click', () => {
      if (!confirm('この候補を削除しますか？')) return;
      state.candidates = state.candidates.filter((x) => x.id !== b.dataset.delCand);
      save();
    }));
    root.querySelector('#cand-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      state.candidates.push({
        id: nextId(state.candidates, 'C'), title: f.get('title'), url: f.get('url') || '', category: f.get('category') || '',
        budget: Number(f.get('budget')) || 0, budgetType: f.get('budgetType'), estHours: Number(f.get('estHours')) || 0,
        claudeFeasibility: Number(f.get('claudeFeasibility')) || 3, deadline: f.get('deadline') || '',
        reason: f.get('reason') || '', risk: f.get('risk') || '', foundAt: today(),
      });
      save();
    });
  }

  function jobOptions() {
    return state.jobs.map((j) => `<option value="${j.id}">${esc(j.title)}</option>`).join('');
  }

  function renderWorklogs() {
    const byJob = {};
    for (const w of state.worklogs) byJob[w.jobId] = (byJob[w.jobId] || 0) + Number(w.minutes || 0);
    const summary = Object.entries(byJob).map(([id, min]) => {
      const j = jobById(id);
      const amt = j ? Number(j.contractAmount || 0) : 0;
      const n = amt ? amt - calcFee(amt) : 0;
      return `<tr><td>${esc(j ? j.title : id)}</td><td>${esc(j ? j.status : '')}</td><td class="num">${hours(min)}</td>
        <td class="num">${n ? yen(n / (min / 60)) : '—'}</td></tr>`;
    }).join('');
    const logs = [...state.worklogs].sort((a, b) => (a.date < b.date ? 1 : -1));

    document.getElementById('worklogs').innerHTML = `
      <div class="card"><h2>作業を記録</h2>
        ${state.jobs.length ? `<form class="inline" id="log-form">
          <label>案件<select name="jobId">${jobOptions()}</select></label>
          <label>日付<input name="date" type="date" value="${today()}" required></label>
          <label>作業時間(分)<input name="minutes" type="number" min="1" required></label>
          <label>メモ<input name="memo"></label>
          <button class="btn">記録</button>
        </form>` : '<div class="empty">先にパイプラインで案件を追加してください</div>'}
      </div>
      <div class="grid2">
        <div class="card"><h2>案件別 作業時間</h2><div class="table-wrap"><table>
          <thead><tr><th>案件</th><th>状態</th><th class="num">時間</th><th class="num">想定時給(手取り)</th></tr></thead>
          <tbody>${summary}</tbody></table></div>
          ${summary ? '' : '<div class="empty">記録がありません</div>'}</div>
        <div class="card"><h2>作業ログ</h2><div class="table-wrap"><table>
          <thead><tr><th>日付</th><th>案件</th><th class="num">時間</th><th>メモ</th><th></th></tr></thead>
          <tbody>${logs.map((w) => `<tr><td>${esc(w.date)}</td><td>${esc((jobById(w.jobId) || {}).title || w.jobId)}</td>
            <td class="num">${w.minutes}分</td><td>${esc(w.memo)}</td>
            <td><button class="btn small danger" data-del-log="${w.id}">×</button></td></tr>`).join('')}</tbody></table></div>
          ${logs.length ? '' : '<div class="empty">記録がありません</div>'}</div>
      </div>`;

    const form = document.getElementById('log-form');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      state.worklogs.push({ id: nextId(state.worklogs, 'W'), jobId: f.get('jobId'), date: f.get('date'), minutes: Number(f.get('minutes')), memo: f.get('memo') || '' });
      save();
    });
    document.querySelectorAll('[data-del-log]').forEach((b) => b.addEventListener('click', () => {
      state.worklogs = state.worklogs.filter((w) => w.id !== b.dataset.delLog);
      save();
    }));
  }

  function renderSales() {
    const sales = monthlySales();
    const months = Object.keys(sales).sort().reverse();
    const pays = [...state.payments].sort((a, b) => (a.date < b.date ? 1 : -1));
    const tot = state.payments.reduce((a, p) => ({ gross: a.gross + p.amount, fee: a.fee + calcFee(p.amount), net: a.net + net(p) }), { gross: 0, fee: 0, net: 0 });
    const tierText = state.settings.feeTiers.map((t, i, arr) => {
      const from = i ? arr[i - 1].upTo : 0;
      return `${t.upTo == null ? `${(from / 10000)}万円超` : `${from ? from / 10000 + '万円超〜' : ''}${t.upTo / 10000}万円以下`}の部分 ${t.rate * 100}%`;
    }).join(' / ');

    document.getElementById('sales').innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="label">累計 契約額</div><div class="value">${yen(tot.gross)}</div></div>
        <div class="kpi"><div class="label">累計 手数料</div><div class="value">${yen(tot.fee)}</div></div>
        <div class="kpi"><div class="label">累計 手取り</div><div class="value">${yen(tot.net)}</div></div>
      </div>
      <div class="card"><h2>入金を登録</h2>
        ${state.jobs.length ? `<form class="inline" id="pay-form">
          <label>案件<select name="jobId">${jobOptions()}</select></label>
          <label>契約金額(税込)<input name="amount" type="number" min="1" required></label>
          <label>計上日<input name="date" type="date" value="${today()}" required></label>
          <label>状態<select name="status"><option>予定</option><option>入金済</option></select></label>
          <button class="btn">登録</button>
        </form>` : '<div class="empty">先にパイプラインで案件を追加してください</div>'}
        <p class="muted" style="margin:8px 0 0">手数料計算: ${esc(tierText)}（data.js の settings.feeTiers で変更可。最新の料金は公式で確認してください）</p>
      </div>
      <div class="grid2">
        <div class="card"><h2>月別集計</h2><div class="table-wrap"><table>
          <thead><tr><th>月</th><th class="num">契約額</th><th class="num">手取り</th><th class="num">入金済</th></tr></thead>
          <tbody>${months.map((m) => `<tr><td>${m}</td><td class="num">${yen(sales[m].gross)}</td><td class="num">${yen(sales[m].net)}</td><td class="num">${yen(sales[m].paid)}</td></tr>`).join('')}</tbody>
        </table></div>${months.length ? '' : '<div class="empty">売上はまだありません</div>'}</div>
        <div class="card"><h2>入金一覧</h2><div class="table-wrap"><table>
          <thead><tr><th>計上日</th><th>案件</th><th class="num">契約額</th><th class="num">手数料</th><th class="num">手取り</th><th>状態</th><th></th></tr></thead>
          <tbody>${pays.map((p) => `<tr><td>${esc(p.date)}</td><td>${esc((jobById(p.jobId) || {}).title || p.jobId)}</td>
            <td class="num">${yen(p.amount)}</td><td class="num">${yen(calcFee(p.amount))}</td><td class="num">${yen(net(p))}</td>
            <td><button class="btn small ${p.status === '入金済' ? 'ghost' : ''}" data-toggle-pay="${p.id}">${p.status}</button></td>
            <td><button class="btn small danger" data-del-pay="${p.id}">×</button></td></tr>`).join('')}</tbody>
        </table></div>${pays.length ? '' : '<div class="empty">入金記録はありません</div>'}</div>
      </div>`;

    const form = document.getElementById('pay-form');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      state.payments.push({ id: nextId(state.payments, 'P'), jobId: f.get('jobId'), amount: Number(f.get('amount')), status: f.get('status'), date: f.get('date') });
      save();
    });
    document.querySelectorAll('[data-toggle-pay]').forEach((b) => b.addEventListener('click', () => {
      const p = state.payments.find((x) => x.id === b.dataset.togglePay);
      p.status = p.status === '入金済' ? '予定' : '入金済';
      save();
    }));
    document.querySelectorAll('[data-del-pay]').forEach((b) => b.addEventListener('click', () => {
      if (!confirm('この入金記録を削除しますか？')) return;
      state.payments = state.payments.filter((p) => p.id !== b.dataset.delPay);
      save();
    }));
  }

  function render() {
    document.getElementById('dirty').hidden = !dirty;
    renderOverview();
    renderPipeline();
    renderCandidates();
    renderWorklogs();
    renderSales();
  }

  // ---------- chrome ----------
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button, .panel').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.tab).classList.add('active');
    try { localStorage.setItem(STORAGE_KEY + ':tab', b.dataset.tab); } catch (e) { /* ignore */ }
  }));
  try {
    const t = localStorage.getItem(STORAGE_KEY + ':tab');
    const btn = t && document.querySelector(`.tabs button[data-tab="${t}"]`);
    if (btn) btn.click();
  } catch (e) { /* ignore */ }

  document.getElementById('export').addEventListener('click', () => {
    const body = '// ダッシュボードのデータ（このファイルが正データ）。\n' +
      '// 画面上での編集はブラウザ(localStorage)に一時保存されます。\n' +
      '// 「データを書き出す」で出力した data.js をこのファイルに置き換えるとリポジトリに反映されます。\n' +
      'window.DASHBOARD_DATA = ' + JSON.stringify(state, null, 2) + ';\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
    a.download = 'data.js';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('ブラウザ上の変更を破棄して data.js の内容に戻しますか？')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    state = clone(SEED);
    dirty = false;
    render();
  });

  render();
})();
