import { DEFAULT_START, DEFAULT_END, HOUR_MS, columnRules } from './config.js';
import { clean, normalize, parseAnyDate, parseDateOnly, dateKey, extractPunches } from './utils.js';

export function readWorkbookFile(file, data) {
  if (/\.csv$/i.test(file.name)) {
    const text = decodeCsvText(data);
    return XLSX.read(text, { type: "string", cellDates: true });
  }
  return XLSX.read(data, { type: "array", cellDates: true });
}

export function decodeCsvText(data) {
  const encodings = ["utf-8", "gb18030", "gbk", "big5"];
  const candidates = encodings.map((encoding) => {
    try {
      const text = new TextDecoder(encoding).decode(data);
      return { encoding, text, score: mojibakeScore(text) };
    } catch (error) {
      return null;
    }
  }).filter(Boolean);

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] ? candidates[0].text : new TextDecoder("utf-8").decode(data);
}

export function mojibakeScore(text) {
  const bad = (text.match(/[�]|Ã|Â|å|æ|ä|œ|¤/g) || []).length;
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const headers = /Person Name|Clock In|Clock Out|Timesheet/.test(text) ? -20 : 0;
  return bad * 10 - chinese * 2 + headers;
}

export function readSheet(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false, raw: false });
  const normalizedMatrix = matrix
    .map((row) => row.map((cell) => clean(cell)))
    .filter((row) => row.some(Boolean));
  if (!normalizedMatrix.length) return { rows: [], columns: [], info: "未找到数据" };

  const headerIndex = findHeaderRow(normalizedMatrix);
  if (headerIndex >= 0) {
    const width = Math.max(...normalizedMatrix.slice(headerIndex).map((row) => row.length));
    const columns = buildHeaders(normalizedMatrix[headerIndex], width);
    const rows = normalizedMatrix
      .slice(headerIndex + 1)
      .map((row) => rowToObject(row, columns))
      .filter((row) => Object.values(row).some(Boolean));
    return {
      rows,
      columns,
      info: `已识别第 ${headerIndex + 1} 行为表头，共 ${rows.length} 行数据`,
    };
  }

  const width = Math.max(...normalizedMatrix.map((row) => row.length));
  const columns = Array.from({ length: width }, (_, index) => `第 ${index + 1} 列`);
  const rows = normalizedMatrix.map((row) => rowToObject(row, columns)).filter((row) => Object.values(row).some(Boolean));
  return {
    rows,
    columns,
    info: `未识别到标准表头，已按列内容自动推断，共 ${rows.length} 行数据`,
  };
}

export function findHeaderRow(matrix) {
  let bestIndex = -1;
  let bestScore = 0;
  matrix.slice(0, 12).forEach((row, index) => {
    const rowText = row.join(" ");
    const keywordScore = Object.values(columnRules)
      .flat()
      .reduce((score, rule) => score + (rule.test(rowText) ? 1 : 0), 0);
    const nonEmpty = row.filter(Boolean).length;
    const score = keywordScore * 10 + Math.min(nonEmpty, 8);
    if (keywordScore > 0 && score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestIndex;
}

export function buildHeaders(row, width) {
  const seen = new Map();
  return Array.from({ length: width }, (_, index) => {
    const cell = row[index];
    const base = clean(cell) || `第 ${index + 1} 列`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
}

export function rowToObject(row, columns) {
  return columns.reduce((object, column, index) => {
    object[column] = row[index] == null ? "" : row[index];
    return object;
  }, {});
}

export function guessColumns(columns, rows) {
  const result = {};
  Object.entries(columnRules).forEach(([key, rules]) => {
    result[key] = bestHeaderColumn(columns, key, rules);
  });
  const inferred = inferColumns(columns, rows);
  return {
    ...inferred,
    ...Object.fromEntries(Object.entries(result).filter(([, value]) => value)),
  };
}

export function bestHeaderColumn(columns, key, rules) {
  let best = "";
  let bestScore = 0;
  columns.forEach((column) => {
    const text = clean(column);
    const matched = rules.some((rule) => rule.test(text));
    if (!matched) return;
    let score = 10;
    if (key === "person" && /姓名|name/i.test(text)) score += 20;
    if (key === "person" && /id|编号|工号/i.test(text)) score -= 20;
    if (key === "person" && /^person name$/i.test(text)) score += 25;
    if (key === "clockIn" && /^clock\s*in$/i.test(text)) score += 30;
    if (key === "clockOut" && /^clock\s*out$/i.test(text)) score += 30;
    if (key === "breakTime" && /total\s*break/i.test(text)) score += 30;
    if (key === "timesheet" && /timesheet/i.test(text)) score += 30;
    if (key === "personId" && /person\s*id/i.test(text)) score += 30;
    if (key === "company" && /劳务公司|服务公司|外包公司|供应商|company|vendor|agency|labor|staffing|contractor/i.test(text)) score += 25;
    if (key === "time" && /考勤记录|考勤时间|打卡时间/i.test(text)) score += 20;
    if (key === "date" && /打卡日期|考勤日|日期/i.test(text)) score += 20;
    if (score > bestScore) {
      best = column;
      bestScore = score;
    }
  });
  return bestScore > 0 ? best : "";
}

export function inferColumns(columns, rows) {
  const sample = rows.slice(0, 80);
  const scores = columns.map((column) => {
    const values = sample.map((row) => row[column]).filter((value) => clean(value));
    return {
      column,
      time: values.reduce((sum, value) => sum + scoreTimeValue(value), 0),
      clock: values.reduce((sum, value) => sum + scoreClockValue(value), 0) + scoreTimeHeader(column),
      date: values.reduce((sum, value) => sum + scoreDateValue(value), 0),
      person: values.reduce((sum, value) => sum + scorePersonValue(value), 0),
    };
  });

  const best = (key, minScore) => {
    const winner = [...scores].sort((a, b) => b[key] - a[key])[0];
    return winner && winner[key] >= minScore ? winner.column : "";
  };

  return {
    person: best("person", 3),
    region: "",
    date: best("date", 3),
    time: best("time", 4),
    timeColumns: scores
      .filter((score) => score.clock >= 3 && score.column !== best("date", 3))
      .sort((a, b) => columns.indexOf(a.column) - columns.indexOf(b.column))
      .map((score) => score.column),
  };
}

export function scoreTimeValue(value) {
  const text = clean(value);
  if (!text) return 0;
  const timeCount = (text.match(/\d{1,2}:\d{2}(?::\d{2})?/g) || []).length;
  const dateTimeCount = (text.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}/g) || []).length;
  if (dateTimeCount >= 1 && timeCount >= 2) return 4;
  if (timeCount >= 2) return 3;
  if (timeCount === 1 && /[-/]\d{1,2}[-/]\d{1,2}/.test(text)) return 2;
  return 0;
}

export function scoreClockValue(value) {
  const text = clean(value);
  if (!text || parseAnyDate(text)) return 0;
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(text) ? 1 : 0;
}

export function scoreTimeHeader(column) {
  const text = clean(column);
  if (/日期|date/i.test(text)) return 0;
  return /时间|打卡|上班|下班|签到|签退|clock|punch|time/i.test(text) ? 2 : 0;
}

export function scoreDateValue(value) {
  const text = clean(value);
  if (!text || scoreTimeValue(text) > 0) return 0;
  return parseAnyDate(text) ? 1 : 0;
}

export function scorePersonValue(value) {
  const text = clean(value);
  if (!text || text.length > 24 || scoreTimeValue(text) > 0 || parseAnyDate(text)) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return 0;
  if (/^[a-z]{2,4}$/i.test(text)) return 0;
  if (/[\u4e00-\u9fa5]{2,6}/.test(text)) return 1;
  if (/^[A-Za-z][A-Za-z .'-]{1,23}$/.test(text)) return 1;
  return 0;
}

export function inferSiteName(rows, columns) {
  if (columns.personId) {
    const id = rows.map((row) => clean(row[columns.personId])).find(Boolean);
    const prefix = id && id.match(/^[A-Za-z]+/);
    if (prefix) return prefix[0].toLowerCase();
  }
  return "njc";
}

export function inferCompanyName(rows, columns) {
  if (columns.company) {
    const company = rows.map((row) => clean(row[columns.company])).find(Boolean);
    if (company) return company;
  }
  return "delin";
}

export function getRegionOptions(rows, columns, fallbackRegion) {
  return uniqueDimension(rows.map((row) => getRowRegion(row, columns, fallbackRegion)), fallbackRegion);
}

export function getCompanyOptions(rows, columns, fallbackCompany) {
  return uniqueDimension(rows.map((row) => getRowCompany(row, columns, fallbackCompany)), fallbackCompany);
}

export function uniqueDimension(values, fallback) {
  const map = new Map();
  values.forEach((value) => {
    const text = clean(value);
    if (text) map.set(normalize(text), text);
  });
  if (!map.size && fallback) map.set(normalize(fallback), fallback);
  return [...map.values()].sort((a, b) => clean(a).localeCompare(clean(b)));
}

export function getRowRegion(row, columns, fallbackRegion) {
  if (columns.region) {
    const region = clean(row[columns.region]);
    if (region) return region;
  }
  if (columns.personId) {
    const personId = clean(row[columns.personId]);
    const prefix = personId.match(/^[A-Za-z]+/);
    if (prefix) return prefix[0].toLowerCase();
  }
  return fallbackRegion || "";
}

export function getRowCompany(row, columns, fallbackCompany) {
  if (columns.company) {
    const company = clean(row[columns.company]);
    if (company) return company;
  }
  return fallbackCompany || "";
}

export function inferDateRange(rows, columns) {
  const dates = [];
  const timeColumns = Array.isArray(columns.timeColumns) ? columns.timeColumns : [];
  rows.slice(0, 2000).forEach((row) => {
    if (columns.date) {
      const date = parseAnyDate(row[columns.date]);
      if (date) dates.push(parseDateOnly(dateKey(date)));
    }
    const sourceColumns = [columns.time, ...timeColumns].filter(Boolean);
    sourceColumns.forEach((column) => {
      extractPunches(row[column], null).forEach((date) => dates.push(parseDateOnly(dateKey(date))));
    });
  });

  const valid = dates.filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => a - b);
  if (!valid.length) return { start: DEFAULT_START, end: DEFAULT_END, dates: daysBetween(DEFAULT_START, DEFAULT_END) };

  const uniqueDates = [...new Set(valid.map((date) => dateKey(date)))].sort();
  return {
    start: uniqueDates[0],
    end: uniqueDates[uniqueDates.length - 1],
    dates: uniqueDates,
  };
}

export function daysBetween(startDate, endDate) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const dates = [];
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates;
  for (let date = start; date <= end; date = new Date(date.getTime() + 24 * HOUR_MS)) {
    dates.push(dateKey(date));
  }
  return dates;
}
