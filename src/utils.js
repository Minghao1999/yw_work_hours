import { HOUR_MS, SHIFT_DAY_CUTOFF_HOUR } from './config.js?v=20260910-39';

export function parseClockOnDate(value, date) {
  if (!date) return null;
  const text = clean(value);
  const match = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Number(match[1]),
    Number(match[2]),
    Number(match[3] || 0)
  );
}

export function parseDurationHours(value) {
  const text = clean(value);
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const match = text.match(/(\d+):(\d{2})(?::(\d{2}))?/);
  if (!match) return 0;
  return Number(match[1]) + Number(match[2]) / 60 + Number(match[3] || 0) / 3600;
}

export function normalizeShiftLabel(value) {
  const text = clean(value);
  if (!text) return "";
  if (text.includes("早")) return "早班";
  if (text.includes("晚")) return "晚班";
  return text;
}

export function parseTimesheetParts(value) {
  const text = clean(value);
  if (!text) return { region: "", company: "", shift: "" };

  const normalizedText = text.replace(/[－–—‑‒−﹣－]/g, "-");
  const parts = text
    .replace(/[－–—‑‒−﹣－]/g, "-")
    .split(/\s*-\s*/)
    .map((part) => clean(part))
    .filter(Boolean);

  const shiftIndex = parts.findIndex((part) => /早|晚/.test(part));
  const shift = shiftIndex >= 0 ? normalizeShiftLabel(parts[shiftIndex]) : normalizeShiftLabel(normalizedText);
  if (parts.length < 3) return { region: "", company: "", shift };

  const companyParts = shiftIndex > 1
    ? parts.slice(1, shiftIndex)
    : parts.slice(1, -1);

  return {
    region: parts[0] || "",
    company: companyParts.join("-"),
    shift,
  };
}

export function inferShiftLabelFromStart(start) {
  if (!start) return "";
  return start.getHours() < 12 ? "早班" : "晚班";
}

export function matchesShiftFilter(shiftLabel, filter) {
  if (!filter || filter === "all") return true;
  const normalized = normalizeShiftLabel(shiftLabel);
  if (filter === "early") return normalized === "早班";
  if (filter === "late") return normalized === "晚班";
  return true;
}

export function addUnmatched(map, person, workDate, count) {
  const key = `${person}__${workDate}`;
  map.set(key, (map.get(key) || 0) + count);
}

export function addPunchCount(map, person, workDate, count) {
  const key = `${person}__${workDate}`;
  map.set(key, (map.get(key) || 0) + count);
}

export function extractPunches(value, baseDate) {
  if (value instanceof Date) return [value];
  const text = String(value || "").trim();
  if (!text) return [];
  const timeText = text.replace(/\s*\([+-]\d{2}:?\d{2}\)\s*/g, " ");

  const dateTimes = [];
  const stampRegex = /(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/g;
  let match;
  while ((match = stampRegex.exec(timeText))) {
    const parsed = parseDateTime(match[1], match[2]);
    if (parsed) dateTimes.push(parsed);
  }
  if (dateTimes.length) return dateTimes.sort((a, b) => a - b);

  const times = timeText.match(/\d{1,2}:\d{2}(?::\d{2})?/g) || [];
  if (!times.length || !baseDate) return [];

  const punches = [];
  times.forEach((timeText, index) => {
    let punch = combineDateAndTime(baseDate, timeText);
    if (index > 0) {
      while (punch <= punches[index - 1]) {
        punch = new Date(punch.getTime() + 24 * HOUR_MS);
      }
    }
    punches.push(punch);
  });
  return punches;
}

export function extractPunchesFromColumns(row, timeColumns, baseDate) {
  if (!baseDate) return [];
  const punches = [];
  timeColumns.forEach((column) => {
    extractPunches(row[column], baseDate).forEach((value) => {
      let punch = value;
      if (punches.length) {
        while (punch <= punches[punches.length - 1]) {
          punch = new Date(punch.getTime() + 24 * HOUR_MS);
        }
      }
      punches.push(punch);
    });
  });
  return punches;
}

export function parseAnyDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + value * 24 * HOUR_MS);
  }
  const text = String(value || "").trim();
  const match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})|(\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;
  if (match[1]) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (match[6]) return new Date(Number(match[6]), Number(match[4]) - 1, Number(match[5]));
  return new Date(2026, Number(match[7]) - 1, Number(match[8]));
}

export function parseDateTime(dateText, timeText) {
  const date = parseAnyDate(dateText);
  if (!date) return null;
  return combineDateAndTime(date, timeText);
}

export function combineDateAndTime(date, timeText) {
  const parts = String(timeText).split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), parts[0] || 0, parts[1] || 0, parts[2] || 0);
}

export function parseDateOnly(value) {
  const date = parseAnyDate(value);
  if (!date) return new Date(NaN);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

export function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function shiftDateKey(date) {
  const shiftDate = new Date(date);
  if (shiftDate.getHours() < SHIFT_DAY_CUTOFF_HOUR) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }
  return dateKey(shiftDate);
}

export function clean(value) {
  return String(value ?? "")
    .replace(/^\ufeff/, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function normalize(value) {
  return clean(value).toLowerCase();
}

export function formatHours(value) {
  const number = Number(value || 0);
  return number.toFixed(1).replace(/\.0$/, "");
}

export function formatDuration(value) {
  const totalMinutes = Math.round(Number(value || 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function formatRegionName(value) {
  const text = clean(value);
  return /^[a-z]+$/i.test(text) ? text.toUpperCase() : text;
}

export function formatShiftFilter(value) {
  if (value === "early") return "早班";
  if (value === "late") return "晚班";
  return "全部";
}

export function formatPersonTimeRanges(dayRanges) {
  const sorted = [...dayRanges].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.flatMap((item) => item.ranges.map((range) => {
    const rangeText = formatRange(range.start, range.end, item.day);
    return sorted.length > 1 ? `${item.day.slice(5)}  ${rangeText}` : rangeText;
  })).join("\n");
}

export function formatRange(start, end, workDate) {
  const startOffset = dayOffsetFromWorkDate(start, workDate);
  const endOffset = dayOffsetFromWorkDate(end, workDate);
  const startTime = formatTimeOnly(start);
  const endTime = formatTimeOnly(end);

  if (startOffset === 0 && endOffset === 0) return `${startTime} → ${endTime}`;
  if (startOffset === 0 && endOffset === 1) return `${startTime} → 次日 ${endTime}`;
  if (startOffset === 1 && endOffset === 1) return `次日 ${startTime} → ${endTime}`;
  return `${formatMonthDayTime(start)} → ${formatMonthDayTime(end)}`;
}

export function dayOffsetFromWorkDate(date, workDate) {
  const baseDate = parseDateOnly(workDate);
  if (!date || Number.isNaN(baseDate.getTime())) return null;
  const dateDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const workDay = Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  return Math.round((dateDay - workDay) / (24 * HOUR_MS));
}

export function formatTimeOnly(date) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function formatMonthDayTime(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day} ${formatTimeOnly(date)}`;
}

export function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}
