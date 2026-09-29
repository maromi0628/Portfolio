// node test_csv.js
const assert = require('assert');
const { parse, stringify, convert } = require('./csv.js');

const t = parse('﻿a,b,c\r\n1,"x, y","say ""hi"""\n2,"line1\nline2",\r\n');
assert.deepStrictEqual(t, [['a', 'b', 'c'], ['1', 'x, y', 'say "hi"'], ['2', 'line1\nline2', '']]);
assert.strictEqual(stringify(t), 'a,b,c\r\n1,"x, y","say ""hi"""\r\n2,"line1\nline2",\r\n');

const table = parse('id,name\n1, A \n,\n1, A \n2,B\n');
const rule = [
  { name: 'No', type: 'serial', value: '1' },
  { name: 'ID', type: 'column', value: 'id' },
  { name: '名前', type: 'column', value: 'name' },
  { name: '店舗', type: 'fixed', value: 'S1' },
  { name: '無い列', type: 'column', value: 'zzz' }
];
const r = convert(table, rule, { dedup: true, pad: 3 });
assert.deepStrictEqual(r.header, ['No', 'ID', '名前', '店舗', '無い列']);
assert.deepStrictEqual(r.rows, [['001', '1', 'A', 'S1', ''], ['002', '2', 'B', 'S1', '']]);
assert.deepStrictEqual(r.stats, { input: 4, output: 2, skipped: 1, dup: 1, missing: ['zzz'] });

const r2 = convert(table, rule, { trim: false, skipEmpty: false });
assert.strictEqual(r2.rows.length, 4);
assert.strictEqual(r2.rows[0][2], ' A ');
console.log('ok');
