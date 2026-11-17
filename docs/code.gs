const SHEET_REPORTS = "reports";
const SHEET_EMPLOYEES = "employees";
const SHEET_FORKLIFTS = "forklifts";
const SHEET_QUESTIONS = "Questions";

function doGet(e) {
  const action = e.parameter.action || "";
  if (action === "employees") return getEmployees();
  if (action === "missing") return getMissingForklifts(e);
  if (action === "status") return getForkliftStatus(e);
  if (action === "summary") return getDailySummary(e);
  if (action === "drivers") return getDriversToday(e);
  if (action === "driverReports") return getDriverReports(e);
  if (action === "questions") return getQuestions(e);
  if (action === "forklifts") return getForklifts(e);
  return json({ error: "Invalid action" });
}

/** =========================
 *  GET FORKLIFTS (for QR print)
 *  ========================= */
function getForklifts(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FORKLIFTS);
  if (!sheet) return json({ error: "Missing forklifts sheet" });

  const activeOnly = String((e.parameter && e.parameter.activeOnly) || "") === "true";

  const values = sheet.getDataRange().getValues();
  const header = values.shift();
  const idxCode = header.indexOf("forkliftCode");
  const idxName = header.indexOf("name");
  const idxActive = header.indexOf("active");

  if (idxCode === -1 || idxActive === -1) {
    return json({ error: "Sheet forklifts thiếu cột forkliftCode hoặc active" });
  }

  const forklifts = values
    .map(function (r) {
      const active =
        r[idxActive] === true || String(r[idxActive]).toUpperCase() === "TRUE";
      return {
        forkliftCode: String(r[idxCode] || "").trim(),
        name: String(r[idxName] || "").trim(),
        active: active,
      };
    })
    .filter(function (f) {
      if (!f.forkliftCode) return false;
      if (activeOnly && !f.active) return false;
      return true;
    });

  return json({ forklifts: forklifts });
}

function doPost(e) {
  const action = e.parameter.action || "";

  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ error: "Invalid JSON body" });
  }

  try {
    if (action === "submitChecklist") return submitChecklist(body);
    if (action === "saveQuestion") return json(saveQuestion_(body));
    if (action === "setQuestionActive") return json(setQuestionActive_(body));
    return json({ error: "Invalid action" });
  } catch (err) {
    return json({ error: err.message || String(err) });
  }
}

/** =========================
 *  QUESTIONS SHEET
 *  ========================= */
function ensureQuestionsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_QUESTIONS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_QUESTIONS);
    sheet.appendRow(["questionId", "sortOrder", "text", "active", "updatedAt"]);
    return sheet;
  }

  const firstRow = sheet.getRange(1, 1, 1, Math.max(5, sheet.getLastColumn())).getValues()[0];
  if (String(firstRow[0]).trim() !== "questionId") {
    sheet.clear();
    sheet.appendRow(["questionId", "sortOrder", "text", "active", "updatedAt"]);
  }

  return sheet;
}

function readQuestions_(activeOnly) {
  const sh = ensureQuestionsSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(String);
  const iId = header.indexOf("questionId");
  const iOrder = header.indexOf("sortOrder");
  const iText = header.indexOf("text");
  const iActive = header.indexOf("active");
  const iUpdated = header.indexOf("updatedAt");

  if (iId === -1 || iOrder === -1 || iText === -1 || iActive === -1) {
    throw new Error("Sheet Questions thiếu cột questionId/sortOrder/text/active");
  }

  const list = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const id = String(row[iId] || "").trim();
    if (!id) continue;

    const active =
      row[iActive] === true || String(row[iActive]).toUpperCase() === "TRUE";
    if (activeOnly && !active) continue;

    list.push({
      questionId: id,
      sortOrder: Number(row[iOrder] || 0),
      text: String(row[iText] || ""),
      active: active,
      updatedAt: iUpdated >= 0 ? String(row[iUpdated] || "") : "",
    });
  }

  list.sort(function (a, b) {
    return a.sortOrder - b.sortOrder;
  });
  return list;
}

function questionsById_() {
  const map = {};
  readQuestions_(false).forEach(function (q) {
    map[q.questionId] = q;
  });
  return map;
}

function nextQuestionId_() {
  const list = readQuestions_(false);
  let max = 0;
  list.forEach(function (q) {
    const m = /^Q(\d+)$/i.exec(q.questionId);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  const n = max + 1;
  return "Q" + (n < 10 ? "0" + n : String(n));
}

function legacyIndexToQuestionId_(oneBasedIndex) {
  const n = Number(oneBasedIndex);
  if (!isFinite(n) || n < 1) return "";
  return "Q" + (n < 10 ? "0" + n : String(n));
}

function getQuestions(e) {
  const activeOnly = String((e.parameter && e.parameter.activeOnly) || "") === "true";
  return json({ questions: readQuestions_(activeOnly) });
}

function saveQuestion_(body) {
  const sh = ensureQuestionsSheet_();
  const values = sh.getDataRange().getValues();
  const header = values[0].map(String);
  const iId = header.indexOf("questionId");
  const iOrder = header.indexOf("sortOrder");
  const iText = header.indexOf("text");
  const iActive = header.indexOf("active");
  const iUpdated = header.indexOf("updatedAt");
  const now = new Date().toISOString();

  let questionId = String(body.questionId || "").trim();
  const text = String(body.text || "").trim();
  const sortOrder = Number(body.sortOrder);

  if (!text) throw new Error("text is required");
  if (!isFinite(sortOrder)) throw new Error("sortOrder is required");

  if (!questionId) {
    questionId = nextQuestionId_();
    sh.appendRow([questionId, sortOrder, text, true, now]);
    return {
      ok: true,
      question: {
        questionId: questionId,
        sortOrder: sortOrder,
        text: text,
        active: true,
        updatedAt: now,
      },
    };
  }

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][iId]).trim() === questionId) {
      sh.getRange(r + 1, iOrder + 1).setValue(sortOrder);
      sh.getRange(r + 1, iText + 1).setValue(text);
      if (iUpdated >= 0) sh.getRange(r + 1, iUpdated + 1).setValue(now);

      const active =
        values[r][iActive] === true ||
        String(values[r][iActive]).toUpperCase() === "TRUE";

      return {
        ok: true,
        question: {
          questionId: questionId,
          sortOrder: sortOrder,
          text: text,
          active: active,
          updatedAt: now,
        },
      };
    }
  }

  throw new Error("Question not found: " + questionId);
}

function setQuestionActive_(body) {
  const questionId = String(body.questionId || "").trim();
  const active = body.active === true || body.active === "true";
  if (!questionId) throw new Error("questionId is required");

  const sh = ensureQuestionsSheet_();
  const values = sh.getDataRange().getValues();
  const header = values[0].map(String);
  const iId = header.indexOf("questionId");
  const iOrder = header.indexOf("sortOrder");
  const iText = header.indexOf("text");
  const iActive = header.indexOf("active");
  const iUpdated = header.indexOf("updatedAt");
  const now = new Date().toISOString();

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][iId]).trim() === questionId) {
      sh.getRange(r + 1, iActive + 1).setValue(active);
      if (iUpdated >= 0) sh.getRange(r + 1, iUpdated + 1).setValue(now);

      return {
        ok: true,
        question: {
          questionId: questionId,
          sortOrder: Number(values[r][iOrder] || 0),
          text: String(values[r][iText] || ""),
          active: active,
          updatedAt: now,
        },
      };
    }
  }

  throw new Error("Question not found: " + questionId);
}

/**
 * Normalize answers:
 * - snapshot: [{ questionId, questionText, answer }]
 * - legacy: ["PASS","FAIL",...] length 11 → map Q01..Q11
 */
function normalizeAnswers_(bodyAnswers) {
  if (!Array.isArray(bodyAnswers) || bodyAnswers.length === 0) {
    throw new Error("Checklist không hợp lệ (thiếu answers)");
  }

  const byId = questionsById_();

  if (typeof bodyAnswers[0] === "object" && bodyAnswers[0] !== null) {
    return bodyAnswers.map(function (item) {
      const questionId = String(item.questionId || "").trim();
      const answer = String(item.answer || "").trim();
      const questionText =
        String(item.questionText || "").trim() ||
        (byId[questionId] && byId[questionId].text) ||
        "";
      if (!questionId || !answer) {
        throw new Error("Checklist không hợp lệ (thiếu questionId/answer)");
      }
      return { questionId: questionId, questionText: questionText, answer: answer };
    });
  }

  return bodyAnswers.map(function (a, i) {
    const questionId = legacyIndexToQuestionId_(i + 1);
    const q = byId[questionId];
    return {
      questionId: questionId,
      questionText: (q && q.text) || "",
      answer: String(a || "").trim(),
    };
  });
}

function ensureReportsAnswersJsonColumn_(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  let idx = header.indexOf("answersJson");
  if (idx !== -1) return idx;

  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue("answersJson");
  return newCol - 1; // 0-based
}

/** =========================
 *  GET EMPLOYEES
 *  ========================= */
function getEmployees() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_EMPLOYEES);

  if (!sheet) return json({ error: "Missing employees sheet" });

  const values = sheet.getDataRange().getValues();
  const header = values.shift();
  const idxCode = header.indexOf("employeeCode");
  const idxName = header.indexOf("fullName");
  const idxActive = header.indexOf("active");

  const employees = values
    .filter(r => String(r[idxActive]).toUpperCase() === "TRUE")
    .map(r => ({
      employeeCode: String(r[idxCode]).trim(),
      fullName: String(r[idxName]).trim(),
    }));

  return json({ employees });
}

/** =========================
 *  POST CHECKLIST SUBMIT
 *  RULE: mỗi tài xế 1 lần / xe / ngày
 *  answers: snapshot [{questionId, questionText, answer}] hoặc legacy string[11]
 *  ========================= */
function submitChecklist(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_REPORTS);
    if (!sheet) return json({ error: "Missing reports sheet" });

    const forkliftCode = (body.forkliftCode || "").trim();
    const employeeCode = (body.employeeCode || "").trim();
    const employeeName = (body.employeeName || "").trim();
    const issueDescription = (body.issueDescription || "").trim();

    if (!forkliftCode || !employeeCode || !employeeName) {
      return json({ error: "Thiếu mã xe hoặc thông tin nhân viên" });
    }

    let normalized;
    try {
      normalized = normalizeAnswers_(body.answers || []);
    } catch (err) {
      return json({ error: err.message || "Checklist không hợp lệ" });
    }

    const hasIssue = normalized.some(function (a) {
      return a.answer !== "PASS";
    });
    if (hasIssue && issueDescription.length < 3) {
      return json({ error: "Có lỗi - vui lòng mô tả sự hư hỏng" });
    }

    const tz = "Asia/Ho_Chi_Minh";
    const todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    const idxAnswersJson = ensureReportsAnswersJsonColumn_(sheet);

    const values = sheet.getDataRange().getValues();
    const header = values.shift().map(String);

    const idxDate = header.indexOf("date");
    const idxForklift = header.indexOf("forkliftCode");
    const idxEmp = header.indexOf("employeeCode");

    if (idxDate === -1 || idxForklift === -1) {
      return json({ error: "Sheet reports thiếu cột date hoặc forkliftCode" });
    }
    if (idxEmp === -1) return json({ error: "Sheet reports thiếu cột employeeCode" });

    const forkliftExist = values.find(function (r) {
      const cellDate = r[idxDate];
      const dateStr =
        cellDate instanceof Date
          ? Utilities.formatDate(cellDate, tz, "yyyy-MM-dd")
          : String(cellDate).trim();

      const code = String(r[idxForklift]).trim();
      const emp = String(r[idxEmp]).trim();

      return dateStr === todayStr && code === forkliftCode && emp === employeeCode;
    });

    if (forkliftExist) {
      return json({
        error:
          "Xe " +
          forkliftCode +
          " hôm nay tài xế " +
          employeeName +
          " (" +
          employeeCode +
          ") đã checklist rồi. Không thể gửi lại.",
        code: 409,
        date: todayStr,
      });
    }

    const status = hasIssue ? "HAS_ISSUE" : "PASS";
    const createdAt = new Date().toISOString();
    const answersJson = JSON.stringify(normalized);

    // Fill tối đa 11 cột answer đầu (layout cũ sau employeeName)
    const qCols = [];
    for (let i = 0; i < 11; i++) {
      qCols.push(normalized[i] ? normalized[i].answer : "");
    }

    // Layout cố định như trước: createdAt..employeeName, 11 answers, status, issueDescription
    sheet.appendRow([
      createdAt,
      todayStr,
      forkliftCode,
      employeeCode,
      employeeName,
      qCols[0],
      qCols[1],
      qCols[2],
      qCols[3],
      qCols[4],
      qCols[5],
      qCols[6],
      qCols[7],
      qCols[8],
      qCols[9],
      qCols[10],
      status,
      hasIssue ? issueDescription : "",
    ]);

    // Ghi answersJson vào đúng cột (thường ở cuối header)
    const lastRow = sheet.getLastRow();
    const answersJsonCol =
      header.indexOf("answersJson") !== -1
        ? header.indexOf("answersJson") + 1
        : idxAnswersJson + 1;
    sheet.getRange(lastRow, answersJsonCol).setValue(answersJson);

    updateDailySummaryForDate_(todayStr);
    return json({ ok: true, status: status, date: todayStr });
  } finally {
    lock.releaseLock();
  }
}

/** =========================
 *  GET MISSING FORKLIFTS TODAY
 *  ========================= */
function getMissingForklifts(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetForklifts = ss.getSheetByName(SHEET_FORKLIFTS);
  const sheetReports = ss.getSheetByName(SHEET_REPORTS);

  if (!sheetForklifts || !sheetReports) {
    return json({ error: "Missing forklifts/reports sheet" });
  }

  const tz = "Asia/Ho_Chi_Minh";
  const date = (e.parameter.date || Utilities.formatDate(new Date(), tz, "yyyy-MM-dd")).trim();

  const fVals = sheetForklifts.getDataRange().getValues();
  const fHeader = fVals.shift();
  const idxCode = fHeader.indexOf("forkliftCode");
  const idxName = fHeader.indexOf("name");
  const idxActive = fHeader.indexOf("active");

  if (idxCode === -1 || idxActive === -1) {
    return json({ error: "Sheet forklifts thiếu cột forkliftCode hoặc active" });
  }

  const activeForklifts = fVals
    .filter(r => String(r[idxActive]).toUpperCase() === "TRUE")
    .map(r => ({
      forkliftCode: String(r[idxCode]).trim(),
      name: String(r[idxName] || "").trim(),
    }));

  const rVals = sheetReports.getDataRange().getValues();
  const rHeader = rVals.shift();
  const idxRDate = rHeader.indexOf("date");
  const idxRForklift = rHeader.indexOf("forkliftCode");

  if (idxRDate === -1 || idxRForklift === -1) {
    return json({ error: "Sheet reports thiếu cột date hoặc forkliftCode" });
  }

  const checkedSet = new Set();

  for (const r of rVals) {
    const cellDate = r[idxRDate];
    const dateStr =
      cellDate instanceof Date
        ? Utilities.formatDate(cellDate, tz, "yyyy-MM-dd")
        : String(cellDate).trim();

    if (dateStr !== date) continue;

    const code = String(r[idxRForklift]).trim();
    if (code) checkedSet.add(code);
  }

  const missing = activeForklifts.filter(f => !checkedSet.has(f.forkliftCode));

  return json({
    date: date,
    total: activeForklifts.length,
    checked: checkedSet.size,
    missing: missing,
  });
}

/** =========================
 *  JSON RESPONSE HELPER
 *  ========================= */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getForkliftStatus(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetReports = ss.getSheetByName(SHEET_REPORTS);
  if (!sheetReports) return json({ error: "Missing reports sheet" });

  const forkliftCode = (e.parameter.forkliftCode || "").trim();
  const employeeCode = (e.parameter.employeeCode || "").trim();

  if (!forkliftCode) return json({ error: "Missing forkliftCode" });

  const tz = "Asia/Ho_Chi_Minh";
  const todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  const values = sheetReports.getDataRange().getValues();
  const header = values.shift();

  const idxDate = header.indexOf("date");
  const idxForklift = header.indexOf("forkliftCode");
  const idxEmp = header.indexOf("employeeCode");

  if (idxDate === -1 || idxForklift === -1) {
    return json({ error: "Sheet reports thiếu cột date hoặc forkliftCode" });
  }

  const exist = values.find(function (r) {
    const cellDate = r[idxDate];
    const dateStr =
      cellDate instanceof Date
        ? Utilities.formatDate(cellDate, tz, "yyyy-MM-dd")
        : String(cellDate).trim();

    const code = String(r[idxForklift]).trim();
    if (dateStr !== todayStr || code !== forkliftCode) return false;

    if (employeeCode && idxEmp !== -1) {
      const emp = String(r[idxEmp]).trim();
      return emp === employeeCode;
    }

    return true;
  });

  return json({
    forkliftCode: forkliftCode,
    employeeCode: employeeCode || null,
    date: todayStr,
    checked: !!exist,
  });
}

function ensureDailySummarySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("daily_summary");

  if (!sheet) {
    sheet = ss.insertSheet("daily_summary");
    sheet.appendRow(["date", "checked_count", "issue_count"]);
  }

  const firstRow = sheet.getRange(1, 1, 1, 3).getValues()[0];
  if (firstRow[0] !== "date") {
    sheet.clear();
    sheet.appendRow(["date", "checked_count", "issue_count"]);
  }

  return sheet;
}

function updateDailySummaryForDate_(dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetReports = ss.getSheetByName(SHEET_REPORTS);
  if (!sheetReports) throw new Error("Missing reports sheet");

  const sheetSummary = ensureDailySummarySheet_();

  const tz = "Asia/Ho_Chi_Minh";
  const values = sheetReports.getDataRange().getValues();
  const header = values.shift();

  const idxDate = header.indexOf("date");
  const idxForklift = header.indexOf("forkliftCode");
  const idxStatus = header.indexOf("status");

  if (idxDate === -1 || idxForklift === -1 || idxStatus === -1) {
    throw new Error("Sheet reports thiếu cột date/forkliftCode/status");
  }

  const checkedSet = new Set();
  const issueSet = new Set();

  for (const r of values) {
    const cellDate = r[idxDate];
    const dStr =
      cellDate instanceof Date
        ? Utilities.formatDate(cellDate, tz, "yyyy-MM-dd")
        : String(cellDate).trim();

    if (dStr !== dateStr) continue;

    const forkliftCode = String(r[idxForklift]).trim();
    if (!forkliftCode) continue;

    checkedSet.add(forkliftCode);

    const status = String(r[idxStatus]).trim();
    if (status === "HAS_ISSUE") {
      issueSet.add(forkliftCode);
    }
  }

  const checkedCount = checkedSet.size;
  const issueCount = issueSet.size;

  const sVals = sheetSummary.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < sVals.length; i++) {
    const rowDate = sVals[i][0];
    const d =
      rowDate instanceof Date
        ? Utilities.formatDate(rowDate, tz, "yyyy-MM-dd")
        : String(rowDate).trim();

    if (d === dateStr) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    sheetSummary.appendRow([dateStr, checkedCount, issueCount]);
  } else {
    sheetSummary.getRange(rowIndex, 2, 1, 2).setValues([[checkedCount, issueCount]]);
  }
}

function getDailySummary(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("daily_summary");
  if (!sheet) return json({ error: "Missing daily_summary sheet" });

  const tz = "Asia/Ho_Chi_Minh";
  const days = Number(e.parameter.days || 30);

  const values = sheet.getDataRange().getValues();
  values.shift();

  let data = values
    .filter(r => r[0])
    .map(r => ({
      date:
        r[0] instanceof Date
          ? Utilities.formatDate(r[0], tz, "yyyy-MM-dd")
          : String(r[0]).trim(),
      checked_count: Number(r[1] || 0),
      issue_count: Number(r[2] || 0),
    }));

  if (days && data.length > days) {
    data = data.slice(-days);
  }

  return json({ days: days, data: data });
}

function getDriversToday(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetReports = ss.getSheetByName(SHEET_REPORTS);
  if (!sheetReports) return json({ error: "Missing reports sheet" });

  const tz = "Asia/Ho_Chi_Minh";
  const date = (e.parameter.date || Utilities.formatDate(new Date(), tz, "yyyy-MM-dd")).trim();

  const values = sheetReports.getDataRange().getValues();
  const header = values.shift();

  const idxDate = header.indexOf("date");
  const idxEmp = header.indexOf("employeeCode");
  const idxName = header.indexOf("employeeName");

  if (idxDate === -1 || idxEmp === -1 || idxName === -1) {
    return json({ error: "Sheet reports thiếu cột date/employeeCode/employeeName" });
  }

  const map = new Map();

  for (const r of values) {
    const cellDate = r[idxDate];
    const dStr =
      cellDate instanceof Date
        ? Utilities.formatDate(cellDate, tz, "yyyy-MM-dd")
        : String(cellDate).trim();

    if (dStr !== date) continue;

    const code = String(r[idxEmp]).trim();
    const name = String(r[idxName]).trim();
    if (!code) continue;

    const current = map.get(code) || { employeeCode: code, employeeName: name, count: 0 };
    current.count += 1;
    if (!current.employeeName && name) current.employeeName = name;
    map.set(code, current);
  }

  const drivers = Array.from(map.values()).sort(function (a, b) {
    return b.count - a.count;
  });

  return json({ date: date, totalDrivers: drivers.length, drivers: drivers });
}

function buildIssueItemsFromAnswersJson_(raw, byId) {
  try {
    const parsed = JSON.parse(String(raw || ""));
    if (!Array.isArray(parsed)) return null;

    const items = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] || {};
      const answer = String(item.answer || "").trim();
      if (!answer || answer === "PASS") continue;

      const questionId = String(item.questionId || "").trim();
      const questionText =
        String(item.questionText || "").trim() ||
        (byId[questionId] && byId[questionId].text) ||
        "";

      items.push({
        questionId: questionId,
        questionText: questionText,
        answer: answer,
        q: questionId ? undefined : i + 1,
      });
    }
    return items;
  } catch (err) {
    return null;
  }
}

function buildIssueItemsFromLegacyCols_(r, idxAnswersStart, byId) {
  const items = [];
  for (let i = 0; i < 11; i++) {
    const a = String(r[idxAnswersStart + i] || "").trim();
    if (!a || a === "PASS") continue;

    const questionId = legacyIndexToQuestionId_(i + 1);
    const q = byId[questionId];
    items.push({
      questionId: questionId,
      questionText: (q && q.text) || "",
      answer: a,
      q: i + 1,
    });
  }
  return items;
}

function getDriverReports(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetReports = ss.getSheetByName(SHEET_REPORTS);
  if (!sheetReports) return json({ error: "Missing reports sheet" });

  const tz = "Asia/Ho_Chi_Minh";
  const date = (e.parameter.date || Utilities.formatDate(new Date(), tz, "yyyy-MM-dd")).trim();
  const employeeCode = (e.parameter.employeeCode || "").trim();

  if (!employeeCode) return json({ error: "Missing employeeCode" });

  const values = sheetReports.getDataRange().getValues();
  const header = values.shift().map(String);

  const idxCreatedAt = header.indexOf("createdAt");
  const idxDate = header.indexOf("date");
  const idxForklift = header.indexOf("forkliftCode");
  const idxEmp = header.indexOf("employeeCode");
  const idxEmpName = header.indexOf("employeeName");
  const idxStatus = header.indexOf("status");
  const idxIssueDesc = header.indexOf("issueDescription");
  const idxAnswersJson = header.indexOf("answersJson");
  const idxAnswersStart = idxEmpName + 1;

  if (
    idxDate === -1 ||
    idxForklift === -1 ||
    idxEmp === -1 ||
    idxEmpName === -1 ||
    idxStatus === -1 ||
    idxIssueDesc === -1
  ) {
    return json({
      error:
        "Sheet reports thiếu cột bắt buộc (date/forkliftCode/employeeCode/employeeName/status/issueDescription)",
    });
  }

  let byId = {};
  try {
    byId = questionsById_();
  } catch (err) {
    byId = {};
  }

  const reports = [];

  for (const r of values) {
    const cellDate = r[idxDate];
    const dStr =
      cellDate instanceof Date
        ? Utilities.formatDate(cellDate, tz, "yyyy-MM-dd")
        : String(cellDate).trim();

    if (dStr !== date) continue;

    const emp = String(r[idxEmp]).trim();
    if (emp !== employeeCode) continue;

    const forkliftCode = String(r[idxForklift]).trim();
    const employeeName = String(r[idxEmpName]).trim();
    const status = String(r[idxStatus]).trim();
    const issueDescription = String(r[idxIssueDesc] || "").trim();

    let issueItems = null;
    if (idxAnswersJson !== -1) {
      const raw = r[idxAnswersJson];
      if (raw !== "" && raw != null) {
        issueItems = buildIssueItemsFromAnswersJson_(raw, byId);
      }
    }
    if (!issueItems) {
      issueItems = buildIssueItemsFromLegacyCols_(r, idxAnswersStart, byId);
    }

    const createdAtRaw = idxCreatedAt !== -1 ? r[idxCreatedAt] : "";
    const createdAt =
      createdAtRaw instanceof Date
        ? Utilities.formatDate(createdAtRaw, tz, "yyyy-MM-dd HH:mm:ss")
        : String(createdAtRaw || "").trim();

    reports.push({
      createdAt: createdAt,
      date: dStr,
      forkliftCode: forkliftCode,
      employeeCode: employeeCode,
      employeeName: employeeName,
      status: status,
      issueDescription: issueDescription,
      issueItems: issueItems,
    });
  }

  reports.sort(function (a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });

  const issueCount = reports.filter(function (r) {
    return r.status === "HAS_ISSUE";
  }).length;

  return json({
    date: date,
    employeeCode: employeeCode,
    employeeName: reports[0] ? reports[0].employeeName : "",
    totalReports: reports.length,
    issueReports: issueCount,
    reports: reports,
  });
}
