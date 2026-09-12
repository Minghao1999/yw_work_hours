import { HOUR_MS } from './config.js?v=20260911-46';
import { clean, normalize, normalizeShiftLabel, formatDuration, parseAnyDate, parseClockOnDate, parseDurationHours, matchesShiftFilter, addUnmatched, addPunchCount, extractPunches, extractPunchesFromColumns, parseDateOnly, dateKey, shiftDateKey, formatPersonTimeRanges } from './utils.js?v=20260911-46';
import { getRowRegion, getRowCompany, getRowTimesheetParts } from './parser.js?v=20260911-46';

export function analyzeRows(rows, columns, filters, startDate, endDate) {
  const timeColumns = Array.isArray(columns.timeColumns) ? columns.timeColumns : [];
  if (!columns.person || (!(columns.clockIn && columns.clockOut) && !columns.time && timeColumns.length < 1 && !columns.totalDuration)) {
    return { people: [], totalWork: 0, totalOvertime: 0, shiftCount: 0, dayCount: 0 };
  }

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const byPersonDay = new Map();
  const singlePunches = new Map();
  const punchCountByPersonDay = new Map();
  const unmatchedByPersonDay = new Map();
  const regionNeedle = normalize(filters.region);
  const companyNeedle = normalize(filters.company);
  const sourceNeedle = normalize(filters.sourceType);
  const shiftNeedle = filters.shift || "all";
  const shifts = [];
  const durationEntries = [];

  rows.forEach((row) => {
    const rowSourceType = normalizeDataSource(row["数据来源"]);
    if (sourceNeedle && rowSourceType !== sourceNeedle) return;
    if (regionNeedle && normalize(getRowRegion(row, columns, filters.fallbackRegion)) !== regionNeedle) return;
    if (companyNeedle && normalize(getRowCompany(row, columns, filters.fallbackCompany)) !== companyNeedle) return;

    const person = clean(row[columns.person]);
    if (!person) return;

    const baseDate = columns.date ? parseAnyDate(row[columns.date]) : null;
    const rowShiftLabel = getRowTimesheetParts(row, columns).shift;
    if (rowSourceType === "paper" && columns.clockIn && columns.clockOut) {
      const paperShift = buildClockInOutShift(row, columns, person, baseDate, rowSourceType);
      if (paperShift) {
        shifts.push(paperShift);
        addPunchCount(punchCountByPersonDay, person, paperShift.workDate, paperShift.punchCount);
        return;
      }
    }
    const rowTimeColumns = timeColumns.length > 1 ? timeColumns : [];
    if (!rowTimeColumns.length && columns.clockIn && columns.clockOut) {
      const shift = buildClockInOutShift(row, columns, person, baseDate, rowSourceType);
      if (shift) {
        shifts.push(shift);
        addPunchCount(punchCountByPersonDay, person, shift.workDate, shift.punchCount);
        return;
      }
    }

    const multiColumnPunches = rowTimeColumns.length ? extractPunchesFromColumns(row, rowTimeColumns, baseDate) : [];
    const mainPunches = columns.time ? extractPunches(row[columns.time], baseDate) : [];
    const punches = multiColumnPunches.length ? multiColumnPunches : mainPunches;
    if (!punches.length) {
      const durationHours = columns.totalDuration ? parseDurationHours(row[columns.totalDuration]) : 0;
      if (baseDate && Number.isFinite(durationHours) && durationHours > 0 && durationHours <= 24) {
        durationEntries.push({
          person,
          workDate: dateKey(baseDate),
          hours: durationHours,
          shiftLabel: rowShiftLabel,
          sourceType: rowSourceType,
        });
      }
      return;
    }

    if (punches.length >= 2) {
      addPunchCount(punchCountByPersonDay, person, shiftDateKey(punches[0]), punches.length);
      for (let index = 0; index < punches.length - 1; index += 2) {
        shifts.push({
          person,
          workDate: shiftDateKey(punches[index]),
          start: punches[index],
          end: punches[index + 1],
          shiftLabel: rowShiftLabel,
        });
      }
      if (punches.length % 2 === 1) {
        addUnmatched(unmatchedByPersonDay, person, shiftDateKey(punches[punches.length - 1]), 1);
      }
      return;
    }

    const list = singlePunches.get(person) || [];
    list.push(punches[0]);
    singlePunches.set(person, list);
  });

  singlePunches.forEach((punches, person) => {
    const result = buildShiftsFromSinglePunches(person, punches);
    result.shifts.forEach((shift) => shifts.push(shift));
    result.unmatched.forEach((item) => addUnmatched(unmatchedByPersonDay, person, item.workDate, item.count));
    result.punchCounts.forEach((item) => addPunchCount(punchCountByPersonDay, person, item.workDate, item.count));
  });

  shifts.forEach((shift) => {
    if (!shift.start || !shift.end) return;
    const workDate = shift.workDate || shiftDateKey(shift.start);
    const dateForFilter = parseDateOnly(workDate);
    if (dateForFilter < start || dateForFilter > end) return;

    let endTime = shift.end;
    while (endTime <= shift.start) {
      endTime = new Date(endTime.getTime() + 24 * HOUR_MS);
    }

    const grossHours = Math.max(0, (endTime - shift.start) / HOUR_MS);
    const breakHours = shift.sourceType === "paper" ? Math.max(0, shift.breakHours || 0) : 0;
    const hours = Math.max(0, grossHours - breakHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 18) return;
    const shiftLabel = normalizeShiftLabel(shift.shiftLabel) || "未知";
    if (!matchesShiftFilter(shiftLabel, shiftNeedle)) return;
    const key = `${shift.person}__${workDate}`;
    const current = byPersonDay.get(key) || { person: shift.person, day: workDate, totalHours: 0, breakHours: 0, sourceType: shift.sourceType || "machine", segmentCount: 0, shiftLabels: new Set(), timeRanges: [] };
    current.totalHours += hours;
    current.breakHours += breakHours;
    current.segmentCount += 1;
    current.shiftLabels.add(shiftLabel);
    current.timeRanges.push({ start: shift.start, end: endTime });
    byPersonDay.set(key, current);
  });

  durationEntries.forEach((entry) => {
    const dateForFilter = parseDateOnly(entry.workDate);
    if (dateForFilter < start || dateForFilter > end) return;
    const shiftLabel = normalizeShiftLabel(entry.shiftLabel) || "未知";
    if (!matchesShiftFilter(shiftLabel, shiftNeedle)) return;
    const key = `${entry.person}__${entry.workDate}`;
    if (byPersonDay.has(key)) return;
    const current = { person: entry.person, day: entry.workDate, totalHours: entry.hours, breakHours: 0, sourceType: entry.sourceType || "machine", segmentCount: 1, shiftLabels: new Set(), timeRanges: [], durationOnly: true };
    current.shiftLabels.add(shiftLabel);
    byPersonDay.set(key, current);
  });

  punchCountByPersonDay.forEach((count, key) => {
    if (!byPersonDay.has(key)) return;
    const [person, day] = key.split("__");
    const current = byPersonDay.get(key) || { person, day, totalHours: 0, segmentCount: 0, shiftLabels: new Set(), timeRanges: [] };
    current.punchCount = (current.punchCount || 0) + count;
    byPersonDay.set(key, current);
  });

  unmatchedByPersonDay.forEach((count, key) => {
    if (!byPersonDay.has(key)) return;
    const [person, day] = key.split("__");
    const current = byPersonDay.get(key) || { person, day, totalHours: 0, segmentCount: 0, shiftLabels: new Set(), timeRanges: [] };
    current.unmatchedCount = (current.unmatchedCount || 0) + count;
    byPersonDay.set(key, current);
  });

  const peopleMap = new Map();
  [...byPersonDay.values()].forEach((dayRow) => {
    const isPaper = dayRow.sourceType === "paper";
    dayRow.breakHours = isPaper ? dayRow.breakHours || 0 : null;
    dayRow.overtimeHours = Math.max(0, dayRow.totalHours - 8);
    const personRow = peopleMap.get(dayRow.person) || {
      person: dayRow.person,
      totalHours: 0,
      overtimeHours: 0,
      breakHours: isPaper ? 0 : null,
      sourceType: dayRow.sourceType,
      workDays: 0,
      segmentCount: 0,
      punchCount: 0,
      unmatchedCount: 0,
      shiftLabels: new Set(),
      timeRanges: [],
      days: [],
    };
    personRow.totalHours += dayRow.totalHours;
    personRow.overtimeHours += dayRow.overtimeHours;
    if (isPaper) personRow.breakHours += dayRow.breakHours;
    personRow.workDays += 1;
    personRow.segmentCount += dayRow.segmentCount;
    personRow.punchCount += dayRow.punchCount || 0;
    personRow.unmatchedCount += dayRow.unmatchedCount || 0;
    if (dayRow.shiftLabels) {
      dayRow.shiftLabels.forEach((label) => personRow.shiftLabels.add(label));
    }
    personRow.timeRanges.push({ day: dayRow.day, ranges: dayRow.timeRanges });
    const shiftLabel = dayRow.shiftLabels && dayRow.shiftLabels.size ? ` / ${[...dayRow.shiftLabels].join("+")}` : "";
    personRow.days.push(`${dayRow.day} ${formatDuration(dayRow.totalHours)}${shiftLabel} / 打卡${dayRow.punchCount || 0}${dayRow.unmatchedCount ? ` / 未配对${dayRow.unmatchedCount}` : ""}`);
    peopleMap.set(dayRow.person, personRow);
  });

  const people = [...peopleMap.values()]
    .map((person) => ({
      ...person,
      shiftText: [...person.shiftLabels].join("+"),
      timeText: formatPersonTimeRanges(person.timeRanges, startDate !== endDate),
      days: person.days.sort(),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
  return {
    people,
    totalWork: people.reduce((sum, item) => sum + item.totalHours, 0),
    totalOvertime: people.reduce((sum, item) => sum + item.overtimeHours, 0),
    shiftCount: people.reduce((sum, item) => sum + item.workDays, 0),
    dayCount: new Set([...byPersonDay.values()].filter((dayRow) => dayRow.totalHours > 0).map((dayRow) => dayRow.day)).size,
  };
}

export function buildShiftsFromSinglePunches(person, punches) {
  const sorted = punches.filter(Boolean).sort((a, b) => a - b);
  const byShiftDay = new Map();
  sorted.forEach((punch) => {
    const key = shiftDateKey(punch);
    const group = byShiftDay.get(key) || [];
    group.push(punch);
    byShiftDay.set(key, group);
  });

  const shifts = [];
  const unmatched = [];
  const punchCounts = [];
  [...byShiftDay.entries()].forEach(([workDate, group]) => {
    const dayShifts = [];
    const ordered = group.sort((a, b) => a - b);
    punchCounts.push({ person, workDate, count: ordered.length });
    for (let index = 0; index < ordered.length - 1; index += 2) {
      dayShifts.push({ person, workDate, start: ordered[index], end: ordered[index + 1] });
    }
    if (ordered.length % 2 === 1) {
      unmatched.push({ person, workDate, count: 1 });
    }
    dayShifts.forEach((shift) => shifts.push(shift));
  });
  return { shifts, unmatched, punchCounts };
}

export function buildClockInOutShift(row, columns, person, baseDate, sourceType = "machine") {
  const workDate = baseDate ? dateKey(baseDate) : null;
  const clockIn = parseClockOnDate(row[columns.clockIn], baseDate);
  const clockOut = parseClockOnDate(row[columns.clockOut], baseDate);
  if (!clockIn || !clockOut || !workDate) return null;

  let end = clockOut;
  while (end <= clockIn) {
    end = new Date(end.getTime() + 24 * HOUR_MS);
  }

  return {
    person,
    workDate,
    start: clockIn,
    end,
    punchCount: 2,
    sourceType,
    breakHours: sourceType === "paper" ? calculatePaperBreakHours(row, columns, baseDate, clockIn, end) : 0,
    shiftLabel: getRowTimesheetParts(row, columns).shift,
  };
}

export function calculatePaperBreakHours(row, columns, baseDate, shiftStart = null, shiftEnd = null) {
  const pairs = [
    [columns.paperBreakOut1, columns.paperBreakIn1],
    [columns.paperBreakOut2, columns.paperBreakIn2],
  ];
  return pairs.reduce((total, [outColumn, inColumn]) => {
    if (!outColumn || !inColumn) return total;
    let breakOut = parseClockOnDate(row[outColumn], baseDate);
    let breakIn = parseClockOnDate(row[inColumn], baseDate);
    if (!breakOut || !breakIn) return total;
    while (shiftStart && breakOut < shiftStart) breakOut = new Date(breakOut.getTime() + 24 * HOUR_MS);
    while (breakIn <= breakOut) breakIn = new Date(breakIn.getTime() + 24 * HOUR_MS);
    if (shiftStart && shiftEnd && (breakOut < shiftStart || breakIn > shiftEnd)) return total;
    const hours = (breakIn - breakOut) / HOUR_MS;
    return Number.isFinite(hours) && hours > 0 && hours <= 4 ? total + hours : total;
  }, 0);
}

export function normalizeDataSource(value) {
  return normalize(value) === "paper" ? "paper" : "machine";
}
