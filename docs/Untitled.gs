function rebuildDailySummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reports = ss.getSheetByName("reports");
  if (!reports) throw new Error("Missing reports sheet");

  const tz = "Asia/Ho_Chi_Minh";
  const values = reports.getDataRange().getValues();
  const header = values.shift();

  const idxDate = header.indexOf("date");
  if (idxDate === -1) throw new Error("reports thiếu cột date");

  // lấy danh sách ngày unique
  const dates = new Set();

  for (const r of values) {
    const cellDate = r[idxDate];
    const dStr = cellDate instanceof Date
      ? Utilities.formatDate(cellDate, tz, "yyyy-MM-dd")
      : String(cellDate).trim();
    if (dStr) dates.add(dStr);
  }

  // update từng ngày
  Array.from(dates).sort().forEach(d => updateDailySummaryForDate_(d));

  Logger.log("✅ rebuildDailySummary DONE. total days = " + dates.size);
}
