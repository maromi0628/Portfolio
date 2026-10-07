// 実行: node test_code.js（Apps Script のサービスを簡易的な偽物に置き換えて Code.gs を動かす）
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeSheet(name) {
  const rows = [];
  const cell = (r, c) => (rows[r - 1] || [])[c - 1];
  const set = (r, c, v) => { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; };
  const range = (r, c, nr = 1, nc = 1) => {
    const self = {
      getSheet: () => sheet, getRow: () => r, getColumn: () => c, getNumRows: () => nr,
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cell(r + i, c + j) ?? '')),
      setValues: (vals) => { vals.forEach((row, i) => row.forEach((v, j) => set(r + i, c + j, v))); return self; },
      setValue: (v) => { set(r, c, v); return self; },
      clearContent: () => { set(r, c, ''); return self; },
      setFontWeight: () => self, setBackground: () => self, setNumberFormat: () => self,
      setDataValidation: () => self,
    };
    return self;
  };
  const sheet = {
    rows, getName: () => name, getRange: range, setFrozenRows() {}, getMaxRows: () => 1000,
    getLastRow: () => rows.length, appendRow: (row) => rows.push(row),
    getDataRange: () => range(1, 1, rows.length, Math.max(...rows.map((r) => r.length))),
  };
  return sheet;
}

const sheets = {};
const mails = [];
const triggers = [];
const ss = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => (sheets[n] = makeSheet(n)),
  getUrl: () => 'https://example.invalid/sheet',
};
const builder = { forSpreadsheet: () => builder, onFormSubmit: () => builder, timeBased: () => builder,
  atHour: () => builder, everyDays: () => builder, create: () => builder };
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ss,
    newDataValidation: () => ({ requireValueInList() { return this; }, build: () => ({}) }) },
  Session: { getActiveUser: () => ({ getEmail: () => 'owner@example.invalid' }) },
  ScriptApp: { getProjectTriggers: () => triggers, deleteTrigger() {},
    newTrigger: (fn) => { triggers.push(fn); return builder; } },
  MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Date,
};
vm.createContext(ctx);
for (const f of ['Logic.gs', 'Code.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });

ctx.setup();
assert.strictEqual(triggers.join(), ['handleFormSubmit', 'dailyDigest'].join());
assert.strictEqual(sheets['管理'].rows[0][0], '受付番号');

const submit = (type, body) => ctx.handleFormSubmit({ namedValues: {
  'お名前': ['山田 太郎'], 'メールアドレス': ['taro@example.invalid'], '種別': [type], 'お問い合わせ内容': [body] } });
submit('見積もり', 'LPの制作費用を知りたいです');
submit('不具合', 'フォームが動かない');

const list = sheets['管理'].rows;
assert.strictEqual(list.length, 3);
assert.match(list[1][0], /^Q-\d{8}-001$/);
assert.match(list[2][0], /^Q-\d{8}-002$/);
assert.strictEqual(JSON.stringify(list[2].slice(4, 9)), JSON.stringify(['不具合', 'フォームが動かない', '高', 'サポート担当', '未対応']));
assert.strictEqual(mails.length, 2);
assert.ok(mails[1].subject.startsWith('【新規お問い合わせ】') && mails[1].to === 'owner@example.invalid');
console.log('ok フォーム送信 → 管理シート登録・通知');

const statusCol = 9;
const edit = (value) => ctx.onEdit({ value, range: sheets['管理'].getRange(2, statusCol) });
edit('完了');
assert.ok(list[1][9] instanceof Date);
edit('対応中');
assert.strictEqual(list[1][9], '');
console.log('ok ステータス変更 → 完了日');

list[2][1] = new Date(Date.now() - 5 * 86400000); // 5日前の受付にする
mails.length = 0;
ctx.dailyDigest();
assert.strictEqual(mails.length, 1);
assert.ok(mails[0].subject.includes('1件') && mails[0].body.includes(list[2][0]));
console.log('ok 未完了の通知');
