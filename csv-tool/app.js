(function () {
  const $ = id => document.getElementById(id);
  const RULE_KEY = 'csv-tool-rule';

  const SAMPLE = [
    '注文番号,注文日時,注文者氏名,注文者電話番号,送付先氏名,送付先住所,商品コード,商品名,数量,単価,支払方法,備考',
    'A-10021,2026/09/01 10:12,山田 花子,090-0000-0001,山田 花子,東京都千代田区架空町1-2-3,T-001,"ほうじ茶ティーバッグ, 20包",2,980,クレジット,',
    'A-10022,2026/09/01 11:40,佐藤 一郎,090-0000-0002,佐藤 次郎,大阪府大阪市架空区4-5-6,T-014,抹茶パウダー 100g,1,1480,クレジット,"ギフト包装希望（""のし""不要）"',
    'A-10022,2026/09/01 11:40,佐藤 一郎,090-0000-0002,佐藤 次郎,大阪府大阪市架空区4-5-6,T-001,"ほうじ茶ティーバッグ, 20包",1,980,クレジット,',
    ',,,,,,,,,,,',
    'A-10023,2026/09/02 09:05,  鈴木 美咲 ,090-0000-0003,鈴木 美咲,福岡県福岡市架空区7-8-9,T-020,玄米茶 200g,3,650,クレジット,',
    'A-10023,2026/09/02 09:05,  鈴木 美咲 ,090-0000-0003,鈴木 美咲,福岡県福岡市架空区7-8-9,T-020,玄米茶 200g,3,650,クレジット,'
  ].join('\r\n');

  const PRESET = [
    { name: '受注番号', type: 'column', value: '注文番号' },
    { name: '明細ID', type: 'serial', value: '1' },
    { name: '受注日時', type: 'column', value: '注文日時' },
    { name: '購入者名', type: 'column', value: '注文者氏名' },
    { name: '発送先名', type: 'column', value: '送付先氏名' },
    { name: '発送先住所', type: 'column', value: '送付先住所' },
    { name: '商品コード', type: 'column', value: '商品コード' },
    { name: '数量', type: 'column', value: '数量' },
    { name: '単価', type: 'column', value: '単価' },
    { name: '店舗ID', type: 'fixed', value: 'S0001' },
    { name: 'ステータス', type: 'fixed', value: '1' }
  ];

  let table = null, header = [], rule = [], fileName = 'data.csv';

  function decode(bytes) {
    const arr = new Uint8Array(bytes);
    const enc = Encoding.detect(arr);
    const label = enc === 'SJIS' ? 'Shift_JIS' : enc === 'UTF8' ? 'UTF-8' : enc === 'ASCII' ? 'ASCII' : enc;
    const text = Encoding.convert(arr, { to: 'UNICODE', from: enc === 'ASCII' ? 'UTF8' : enc, type: 'string' });
    return { text, label };
  }

  function load(text, name, encLabel) {
    table = CsvTool.parse(text);
    if (!table.length) { $('info').textContent = '中身が空のファイルです。'; return; }
    header = table[0].map(h => h.trim());
    fileName = name;
    $('info').textContent = `${name}（${encLabel}・${table.length - 1}行・${header.length}列）を読み込みました`;
    if (!rule.length) rule = header.map(h => ({ name: h, type: 'column', value: h }));
    $('mapCard').hidden = false;
    $('prevCard').hidden = false;
    renderRule();
  }

  function readFile(file) {
    if (!file) return;
    file.arrayBuffer().then(buf => {
      const { text, label } = decode(buf);
      rule = [];
      load(text, file.name, label);
    });
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'on') Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn));
      else if (k in e) e[k] = v; else e.setAttribute(k, v);
    });
    (children || []).forEach(c => e.append(c));
    return e;
  }

  function renderRule() {
    const tb = $('mapBody');
    tb.textContent = '';
    rule.forEach((r, i) => {
      const nameIn = el('input', { value: r.name, 'aria-label': '出力する列名', on: { input: e => { r.name = e.target.value; preview(); } } });
      const typeSel = el('select', { 'aria-label': '種類', on: { change: e => {
        r.type = e.target.value;
        r.value = r.type === 'column' ? header[0] : r.type === 'serial' ? '1' : '';
        renderRule();
      } } }, [['column', '元の列'], ['fixed', '固定値'], ['serial', '連番']].map(([v, t]) =>
        el('option', { value: v, textContent: t, selected: r.type === v })));
      let valIn;
      if (r.type === 'column') {
        const opts = header.map(h => el('option', { value: h, textContent: h, selected: r.value === h }));
        if (!header.includes(r.value)) opts.unshift(el('option', { value: r.value, textContent: `（見つかりません：${r.value}）`, selected: true }));
        valIn = el('select', { 'aria-label': '元の列', on: { change: e => { r.value = e.target.value; renderRule(); } } }, opts);
      } else {
        valIn = el('input', { value: r.value, placeholder: r.type === 'serial' ? '開始番号' : '入力する値', 'aria-label': '値',
          on: { input: e => { r.value = e.target.value; preview(); } } });
      }
      const btns = el('div', { className: 'mini' }, [
        el('button', { className: 'btn ghost small', type: 'button', textContent: '↑', title: '上へ', disabled: i === 0, on: { click: () => move(i, -1) } }),
        el('button', { className: 'btn ghost small', type: 'button', textContent: '↓', title: '下へ', disabled: i === rule.length - 1, on: { click: () => move(i, 1) } }),
        el('button', { className: 'btn ghost small', type: 'button', textContent: '削除', on: { click: () => { rule.splice(i, 1); renderRule(); } } })
      ]);
      tb.append(el('tr', {}, [el('td', { className: 'num', textContent: i + 1 }), el('td', {}, [nameIn]), el('td', {}, [typeSel]), el('td', {}, [valIn]), el('td', {}, [btns])]));
    });
    preview();
  }

  function move(i, d) {
    const [r] = rule.splice(i, 1);
    rule.splice(i + d, 0, r);
    renderRule();
  }

  function options() {
    return { trim: $('optTrim').checked, dedup: $('optDedup').checked, skipEmpty: $('optSkipEmpty').checked, pad: Number($('optPad').value) || 1 };
  }

  function preview() {
    if (!table) return;
    const res = CsvTool.convert(table, rule, options());
    const s = res.stats;
    $('summary').textContent = `元データ ${s.input} 行 → 出力 ${s.output} 行（空の行 ${s.skipped} 行・重複 ${s.dup} 行を除外）。先頭10行を表示しています。`;
    const w = $('warn');
    w.hidden = !s.missing.length;
    w.textContent = s.missing.length ? `元のCSVに見つからない列があります：${s.missing.join('、')}（この列は空欄で出力されます）` : '';
    const t = $('prev');
    t.textContent = '';
    t.append(el('thead', {}, [el('tr', {}, res.header.map(h => el('th', { textContent: h })))]));
    t.append(el('tbody', {}, res.rows.slice(0, 10).map(r => el('tr', {}, r.map(v => el('td', { textContent: v }))))));
  }

  function download() {
    const res = CsvTool.convert(table, rule, options());
    const text = CsvTool.stringify([res.header, ...res.rows]);
    let bytes;
    if ($('optEnc').value === 'SJIS') {
      bytes = new Uint8Array(Encoding.convert(Encoding.stringToCode(text), { to: 'SJIS', from: 'UNICODE' }));
    } else {
      bytes = new TextEncoder().encode('﻿' + text);
    }
    const a = el('a', { href: URL.createObjectURL(new Blob([bytes], { type: 'text/csv' })), download: fileName.replace(/\.csv$/i, '') + '_変換後.csv' });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  const drop = $('drop');
  drop.addEventListener('click', () => $('file').click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); readFile(e.dataTransfer.files[0]); });
  $('file').addEventListener('change', e => readFile(e.target.files[0]));
  $('sample').addEventListener('click', () => { rule = PRESET.map(r => Object.assign({}, r)); load(SAMPLE, 'サンプル注文データ.csv', 'サンプル'); });
  $('addCol').addEventListener('click', () => { rule.push({ name: '新しい列', type: 'fixed', value: '' }); renderRule(); });
  $('preset').addEventListener('click', () => { rule = PRESET.map(r => Object.assign({}, r)); renderRule(); });
  $('saveRule').addEventListener('click', () => {
    try { localStorage.setItem(RULE_KEY, JSON.stringify(rule)); $('info').textContent = '変換ルールを保存しました（このブラウザに保存）'; }
    catch (e) { $('info').textContent = 'このブラウザでは保存できませんでした'; }
  });
  $('loadRule').addEventListener('click', () => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(RULE_KEY)); } catch (e) { /* 読めなければ何もしない */ }
    if (saved && saved.length) { rule = saved; renderRule(); } else { $('info').textContent = '保存したルールがありません'; }
  });
  ['optTrim', 'optDedup', 'optSkipEmpty', 'optPad'].forEach(id => $(id).addEventListener('input', preview));
  $('download').addEventListener('click', download);
})();
