// 実行: node test_logic.js（Logic.gs を Node.js で読み込んでテストする）
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const src = fs.readFileSync(path.join(__dirname, 'Logic.gs'), 'utf8');
const m = new Module('Logic.gs');
m._compile(src, 'Logic.gs');
const L = m.exports;

const day = (s) => new Date(s + 'T09:00:00');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok', name); }

test('優先度の判定', () => {
  assert.strictEqual(L.classify('不具合', 'ログインできません'), '高');
  assert.strictEqual(L.classify('その他', '至急ご確認ください'), '高');
  assert.strictEqual(L.classify('見積もり', 'LPの制作費用を知りたい'), '中');
  assert.strictEqual(L.classify('その他', '営業時間について'), '低');
  assert.strictEqual(L.classify('その他', undefined), '低');
});

test('受付番号と連番', () => {
  const now = new Date(2026, 9, 7, 15, 0);
  const dates = [new Date(2026, 9, 6, 10), new Date(2026, 9, 7, 9), new Date(2026, 9, 7, 11), '', null];
  assert.strictEqual(L.nextSeq(dates, now), 3);
  assert.strictEqual(L.makeTicketId(now, 3), 'Q-20261007-003');
  assert.strictEqual(L.makeTicketId(new Date(2026, 0, 2), 12), 'Q-20260102-012');
});

test('担当の割り当て', () => {
  const owners = { '見積もり': '営業担当', '既定': '事務担当' };
  assert.strictEqual(L.assignOwner('見積もり', owners), '営業担当');
  assert.strictEqual(L.assignOwner('取材依頼', owners), '事務担当');
  assert.strictEqual(L.assignOwner('取材依頼', {}), '');
});

const records = [
  { id: 'Q-1', receivedAt: day('2026-10-01'), status: '対応中', priority: '中', type: '見積もり', name: '山田', owner: '営業担当' },
  { id: 'Q-2', receivedAt: day('2026-09-28'), status: '未対応', priority: '高', type: '不具合', name: '佐藤', owner: '' },
  { id: 'Q-3', receivedAt: day('2026-09-20'), status: '完了', priority: '低', type: 'その他', name: '鈴木', owner: '事務担当' },
  { id: 'Q-4', receivedAt: day('2026-10-05'), status: '未対応', priority: '低', type: 'その他', name: '高橋', owner: '事務担当' },
  { id: 'Q-5', receivedAt: '', status: '未対応' },
];

test('未完了の抽出（完了・日付なし・期限内は除く、古い順）', () => {
  const overdue = L.findOverdue(records, day('2026-10-07'), 3);
  assert.deepStrictEqual(overdue.map((r) => r.id), ['Q-2', 'Q-1']);
});

test('通知メールの文面', () => {
  const today = day('2026-10-07');
  const digest = L.buildDigest(L.findOverdue(records, today, 3), today, 3);
  assert.strictEqual(digest.subject, '【要対応】3日以上未完了のお問い合わせ 2件');
  assert.ok(digest.body.includes('・Q-2［高］不具合 / 佐藤 様（9日経過・担当: 未定・未対応）'));
  assert.strictEqual(L.buildDigest([], today, 3), null);
});

console.log(`\n${passed} tests passed`);
