/**
 * リビング時計用の Apps Script(Google アカウント側で動かす)
 * - 今日の予定は「時刻だけ」返す。件名・場所・メモはこのスクリプトの外に出さない
 * - ToDo は家族の共有スプレッドシートから「済」でない行を返す
 *
 * 合言葉・シートID・カレンダーIDはここに書かず、
 * [プロジェクトの設定]→[スクリプト プロパティ] に入れる:
 *   KEY      … 合言葉(Fire の設定画面に入れるものと同じ)
 *   SHEET_ID … 共有スプレッドシートの ID(URL の /d/ と /edit の間)
 *   CAL_IDS  … 表示するカレンダーの ID をカンマ区切り(省略時はメインのカレンダーだけ)
 */
function doGet(e) {
  var p = PropertiesService.getScriptProperties();
  if (!e.parameter.key || e.parameter.key !== p.getProperty('KEY')) {
    return json({ error: 'key' });
  }
  return json({ events: todayEvents(p.getProperty('CAL_IDS')), todos: openTodos(p.getProperty('SHEET_ID')) });
}

function todayEvents(calIds) {
  var tz = 'Asia/Tokyo';
  var start = new Date();
  start.setHours(0, 0, 0, 0);
  var end = new Date(start.getTime() + 24 * 3600 * 1000);
  var cals = calIds
    ? calIds.split(',').map(function (id) { return CalendarApp.getCalendarById(id.trim()); }).filter(Boolean)
    : [CalendarApp.getDefaultCalendar()];
  var out = [];
  cals.forEach(function (cal) {
    cal.getEvents(start, end).forEach(function (ev) {
      out.push({
        allDay: ev.isAllDayEvent(),
        start: Utilities.formatDate(ev.getStartTime(), tz, 'H:mm'),
        end: Utilities.formatDate(ev.getEndTime(), tz, 'H:mm'),
        sort: ev.isAllDayEvent() ? 0 : ev.getStartTime().getTime()
      });
    });
  });
  out.sort(function (a, b) { return a.sort - b.sort; });
  return out.map(function (x) { return { allDay: x.allDay, start: x.start, end: x.end }; });
}

// 1行目は見出し(やること / 誰 / 済)。「済」列に何か入っている行は出さない
function openTodos(sheetId) {
  if (!sheetId) return [];
  var rows = SpreadsheetApp.openById(sheetId).getSheets()[0].getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var task = String(rows[i][0]).trim();
    var done = rows[i][2] === true || String(rows[i][2]).trim() !== '' && rows[i][2] !== false;
    if (task && !done) out.push({ task: task, who: String(rows[i][1] || '').trim() });
  }
  return out;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
