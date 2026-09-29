// CSV の読み書きと変換処理（画面に依存しない部分）
(function (root) {
  // RFC 4180 形式の CSV を2次元配列にする（"" のエスケープ・セル内改行に対応）
  function parse(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = [];
    let row = [], cell = '', i = 0, quoted = false;
    while (i < text.length) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          quoted = false; i++; continue;
        }
        cell += c; i++; continue;
      }
      if (c === '"') { quoted = true; i++; continue; }
      if (c === ',') { row.push(cell); cell = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(cell); rows.push(row); row = []; cell = '';
        i += (c === '\r' && text[i + 1] === '\n') ? 2 : 1;
        continue;
      }
      cell += c; i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function quote(v) {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function stringify(rows) {
    return rows.map(r => r.map(quote).join(',')).join('\r\n') + '\r\n';
  }

  // rule: [{ name, type: 'column'|'fixed'|'serial', value }]
  // 返り値: { header, rows, stats }
  function convert(table, rule, opts) {
    opts = Object.assign({ trim: true, dedup: false, skipEmpty: true, pad: 4 }, opts);
    const [head, ...body] = table;
    const index = {};
    head.forEach((h, i) => { index[h.trim()] = i; });
    const missing = rule.filter(r => r.type === 'column' && !(r.value in index)).map(r => r.value);

    let src = body;
    if (opts.skipEmpty) src = src.filter(r => r.some(c => c.trim() !== ''));
    let out = [];
    const seen = new Set();
    let dup = 0;
    src.forEach(r => {
      const line = rule.map(c => {
        if (c.type === 'column') {
          const v = r[index[c.value]] ?? '';
          return opts.trim ? v.trim() : v;
        }
        if (c.type === 'fixed') return c.value;
        return null; // 連番は重複判定のあとで振る
      });
      if (opts.dedup) {
        const key = JSON.stringify(line);
        if (seen.has(key)) { dup++; return; }
        seen.add(key);
      }
      out.push(line);
    });
    out = out.map((line, n) => line.map((v, i) =>
      rule[i].type === 'serial' ? String((Number(rule[i].value) || 1) + n).padStart(opts.pad, '0') : v));

    return {
      header: rule.map(r => r.name),
      rows: out,
      stats: { input: body.length, output: out.length, skipped: body.length - src.length, dup, missing }
    };
  }

  root.CsvTool = { parse, stringify, convert };
  if (typeof module !== 'undefined') module.exports = root.CsvTool;
})(typeof window !== 'undefined' ? window : globalThis);
