const SHEET_NAME = 'data';
const EXPECTED_SECRET = ''; // optional: paste the same secret used in app.js

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (EXPECTED_SECRET && body.secret !== EXPECTED_SECRET) {
      throw new Error('Unauthorized');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    ensureHeader_(sheet);

    const rows = Array.isArray(body.results) ? body.results.map(result => normalizeRow_(body, result)) : [];
    if (!rows.length) throw new Error('No result rows supplied');

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows_written: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    'server_timestamp',
    'participant_id',
    'session_id',
    'condition_order',
    'experiment_version',
    'block',
    'orientation',
    'phase',
    'trial_ordinal',
    'target_category',
    'target_item',
    'target_path',
    'clicked_category',
    'clicked_item',
    'clicked_path',
    'correct',
    'rt_ms',
    'client_timestamp',
    'viewport_width',
    'viewport_height',
    'screen_width',
    'screen_height',
    'menu_layout_json'
  ]);
}

function normalizeRow_(body, result) {
  return [
    new Date(),
    body.participantId || '',
    body.sessionId || '',
    Array.isArray(body.conditionOrder) ? body.conditionOrder.join('->') : '',
    body.experimentVersion || '',
    result.block || '',
    result.orientation || '',
    result.phase || '',
    result.trialOrdinal || '',
    result.targetCategory || '',
    result.targetItem || '',
    result.targetPath || '',
    result.clickedCategory || '',
    result.clickedItem || '',
    result.clickedPath || '',
    result.correct === true,
    result.rt || '',
    result.timestamp || '',
    result.viewportWidth || '',
    result.viewportHeight || '',
    result.screenWidth || '',
    result.screenHeight || '',
    JSON.stringify(result.menuLayout || [])
  ];
}
