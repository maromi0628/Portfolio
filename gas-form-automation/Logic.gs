/**
 * 判定・集計のロジック（スプレッドシートに触れない純粋な関数）。
 * Apps Script ではそのまま読み込まれ、Node.js では test_logic.js からテストする。
 */

var URGENT_WORDS = ['至急', '緊急', '急ぎ', '動かない', 'エラー', '止まっ'];

/** 種別と本文から優先度（高・中・低）を決める。 */
function classify(type, body) {
  var text = String(body || '');
  var urgent = URGENT_WORDS.some(function (w) { return text.indexOf(w) !== -1; });
  if (type === '不具合' || urgent) return '高';
  if (type === '見積もり') return '中';
  return '低';
}

/** 受付番号を作る（例: Q-20261007-003）。seq はその日の何件目か。 */
function makeTicketId(date, seq) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return 'Q-' + y + m + d + '-' + ('00' + seq).slice(-3);
}

/** 同じ日の受付件数を数えて、次の連番を返す。 */
function nextSeq(receivedDates, date) {
  var count = receivedDates.filter(function (v) {
    return v instanceof Date && v.toDateString() === date.toDateString();
  }).length;
  return count + 1;
}

/** 種別から担当者を決める。設定にない種別は「既定」の担当。 */
function assignOwner(type, owners) {
  return owners[type] || owners['既定'] || '';
}

/** 完了していない受付のうち、受付から days 日以上たったものを古い順に返す。 */
function findOverdue(records, today, days) {
  var limit = days * 24 * 60 * 60 * 1000;
  return records
    .filter(function (r) {
      return r.status !== '完了' && r.receivedAt instanceof Date && today - r.receivedAt >= limit;
    })
    .sort(function (a, b) { return a.receivedAt - b.receivedAt; });
}

/** 未対応の一覧メール（件名・本文）を作る。対象がなければ null。 */
function buildDigest(overdue, today, days) {
  if (overdue.length === 0) return null;
  var lines = overdue.map(function (r) {
    var age = Math.floor((today - r.receivedAt) / 86400000);
    return '・' + r.id + '［' + r.priority + '］' + r.type + ' / ' + r.name +
      ' 様（' + age + '日経過・担当: ' + (r.owner || '未定') + '・' + r.status + '）';
  });
  return {
    subject: '【要対応】' + days + '日以上未完了のお問い合わせ ' + overdue.length + '件',
    body: '次のお問い合わせが受付から' + days + '日以上完了していません。\n\n' +
      lines.join('\n') + '\n\n管理シートでステータスを更新してください。'
  };
}

if (typeof module !== 'undefined') {
  module.exports = { classify: classify, makeTicketId: makeTicketId, nextSeq: nextSeq,
    assignOwner: assignOwner, findOverdue: findOverdue, buildDigest: buildDigest };
}
