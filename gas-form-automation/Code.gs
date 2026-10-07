/**
 * Googleフォームのお問い合わせを管理シートに自動で登録し、担当者へ通知する。
 * 使い方は README.md を参照。最初に一度だけ setup() を実行する。
 */

var SHEET_LIST = '管理';
var SHEET_SETTINGS = '設定';
var HEADERS = ['受付番号', '受付日時', 'お名前', 'メールアドレス', '種別', '内容',
  '優先度', '担当', 'ステータス', '完了日'];
var COL = {}; HEADERS.forEach(function (h, i) { COL[h] = i + 1; });
var STATUSES = ['未対応', '対応中', '完了'];

/** シートの用意とトリガーの登録（最初に1回だけ実行）。 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var list = ss.getSheetByName(SHEET_LIST) || ss.insertSheet(SHEET_LIST);
  list.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#e8eef8');
  list.setFrozenRows(1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
  list.getRange(2, COL['ステータス'], list.getMaxRows() - 1, 1).setDataValidation(rule);

  var settings = ss.getSheetByName(SHEET_SETTINGS);
  if (!settings) {
    settings = ss.insertSheet(SHEET_SETTINGS);
    settings.getRange(1, 1, 7, 2).setValues([
      ['項目', '値'],
      ['通知先メール', Session.getActiveUser().getEmail()],
      ['未完了の通知（日数）', 3],
      ['担当:見積もり', '営業担当'],
      ['担当:不具合', 'サポート担当'],
      ['担当:その他', '事務担当'],
      ['担当:既定', '事務担当']
    ]);
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['handleFormSubmit', 'dailyDigest'].indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('handleFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('dailyDigest').timeBased().atHour(9).everyDays(1).create();
}

/** 設定シートを読み込む。 */
function readSettings_() {
  var rows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS)
    .getDataRange().getValues().slice(1);
  var settings = { notifyTo: '', days: 3, owners: {} };
  rows.forEach(function (r) {
    var key = String(r[0]).trim();
    if (key === '通知先メール') settings.notifyTo = String(r[1]).trim();
    else if (key === '未完了の通知（日数）') settings.days = Number(r[1]) || 3;
    else if (key.indexOf('担当:') === 0) settings.owners[key.slice(3)] = String(r[1]).trim();
  });
  return settings;
}

/** フォーム送信時：管理シートに1行追加して通知する。 */
function handleFormSubmit(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // 同時送信で受付番号が重ならないようにする
  try {
    var answer = function (name) { return ((e.namedValues[name] || [''])[0] || '').trim(); };
    var settings = readSettings_();
    var list = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LIST);
    var now = new Date();

    var lastRow = list.getLastRow();
    var dates = lastRow > 1 ? list.getRange(2, COL['受付日時'], lastRow - 1, 1).getValues()
      .map(function (r) { return r[0]; }) : [];
    var id = makeTicketId(now, nextSeq(dates, now));

    var type = answer('種別') || 'その他';
    var body = answer('お問い合わせ内容');
    var priority = classify(type, body);
    var owner = assignOwner(type, settings.owners);
    list.appendRow([id, now, answer('お名前'), answer('メールアドレス'), type, body,
      priority, owner, '未対応', '']);

    if (settings.notifyTo) {
      MailApp.sendEmail(settings.notifyTo,
        '【新規お問い合わせ】' + id + '（優先度: ' + priority + '）',
        '種別: ' + type + '\n担当: ' + owner + '\nお名前: ' + answer('お名前') +
        '\n\n' + body + '\n\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    }
  } finally {
    lock.releaseLock();
  }
}

/** 毎朝：一定日数以上完了していない受付をまとめて通知する。 */
function dailyDigest() {
  var settings = readSettings_();
  var values = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LIST)
    .getDataRange().getValues().slice(1);
  var records = values.filter(function (r) { return r[0]; }).map(function (r) {
    return { id: r[COL['受付番号'] - 1], receivedAt: r[COL['受付日時'] - 1],
      name: r[COL['お名前'] - 1], type: r[COL['種別'] - 1], priority: r[COL['優先度'] - 1],
      owner: r[COL['担当'] - 1], status: r[COL['ステータス'] - 1] };
  });
  var today = new Date();
  var digest = buildDigest(findOverdue(records, today, settings.days), today, settings.days);
  if (digest && settings.notifyTo) MailApp.sendEmail(settings.notifyTo, digest.subject, digest.body);
}

/** ステータスを「完了」にしたら完了日を入れ、戻したら消す（シンプルトリガー）。 */
function onEdit(e) {
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_LIST || e.range.getRow() < 2 ||
      e.range.getColumn() !== COL['ステータス'] || e.range.getNumRows() !== 1) return;
  var doneCell = sheet.getRange(e.range.getRow(), COL['完了日']);
  if (e.value === '完了') doneCell.setValue(new Date()).setNumberFormat('yyyy/mm/dd');
  else doneCell.clearContent();
}
