import { analyzeRows } from './analysis.js?v=20260910-39';
import { getCompanyOptions } from './parser.js?v=20260910-39';
import { formatDuration, formatRegionName } from './utils.js?v=20260910-39';

export function buildFullReport(rows, columns, config) {
  const regionSummaries = [];
  const companySummaries = [];
  const peopleByRegion = [];

  (config.regions || []).forEach((region) => {
    const regionAnalysis = analyzeRows(rows, columns, {
      region,
      company: "",
      shift: "all",
      fallbackRegion: config.fallbackRegion,
      fallbackCompany: "",
    }, config.startDate, config.endDate);

    regionSummaries.push({
      region: formatRegionName(region),
      totalWork: regionAnalysis.totalWork,
      totalOvertime: regionAnalysis.totalOvertime,
      peopleCount: regionAnalysis.people.length,
      dayCount: regionAnalysis.dayCount || 0,
    });

    const companies = getCompanyOptions(rows, columns, "", region);
    const regionPeople = [];
    companies.forEach((company) => {
      const companyAnalysis = analyzeRows(rows, columns, {
        region,
        company,
        shift: "all",
        fallbackRegion: config.fallbackRegion,
        fallbackCompany: "",
      }, config.startDate, config.endDate);

      companySummaries.push({
        region: formatRegionName(region),
        company,
        totalWork: companyAnalysis.totalWork,
        totalOvertime: companyAnalysis.totalOvertime,
        peopleCount: companyAnalysis.people.length,
        dayCount: companyAnalysis.dayCount || 0,
      });
      companyAnalysis.people.forEach((person) => regionPeople.push({ ...person, company }));
    });

    if (!companies.length) {
      regionAnalysis.people.forEach((person) => regionPeople.push({ ...person, company: "-" }));
    }

    peopleByRegion.push({
      region: formatRegionName(region),
      people: regionPeople.sort((a, b) => b.totalHours - a.totalHours),
    });
  });

  return { regionSummaries, companySummaries, peopleByRegion };
}

export function downloadFullReportWorkbook(report, fileName, xlsx = globalThis.XLSX) {
  if (!xlsx || !xlsx.utils || typeof xlsx.writeFile !== "function") {
    throw new Error("Excel 下载组件尚未加载，请刷新页面后重试");
  }

  const workbook = xlsx.utils.book_new();
  appendSheet(xlsx, workbook, "地区汇总", regionSummaryRows(report.regionSummaries));
  appendSheet(xlsx, workbook, "地区劳务公司", companySummaryRows(report.companySummaries));

  const usedNames = new Set(workbook.SheetNames || ["地区汇总", "地区劳务公司"]);
  (report.peopleByRegion || []).forEach((group) => {
    const sheetName = uniqueSheetName(`${group.region}人员`, usedNames);
    appendSheet(xlsx, workbook, sheetName, personRows(group.region, group.people));
    usedNames.add(sheetName);
  });

  xlsx.writeFile(workbook, fileName, { bookType: "xlsx", compression: true });
}

export function buildFullReportFileName(start, end) {
  const period = start === end ? start : `${start}_至_${end}`;
  return sanitizeFileName(`考勤完整报表_${period}.xlsx`);
}

export function regionSummaryRows(rows) {
  return [
    ["地区", "工作时长", "加班时长", "统计人数", "工作天数"],
    ...(rows || []).map((item) => [item.region, formatDuration(item.totalWork), formatDuration(item.totalOvertime), item.peopleCount, item.dayCount]),
  ];
}

export function companySummaryRows(rows) {
  return [
    ["地区", "劳务公司", "工作时长", "加班时长", "统计人数", "工作天数"],
    ...(rows || []).map((item) => [item.region, item.company, formatDuration(item.totalWork), formatDuration(item.totalOvertime), item.peopleCount, item.dayCount]),
  ];
}

export function personRows(region, people) {
  return [
    ["地区", "数据来源", "劳务公司", "姓名", "班次", "上班时间", "工作时长", "加班时长", "休息时长", "工作日", "打卡次数", "未配对打卡"],
    ...(people || []).map((item) => [
      region,
      item.sourceType === "paper" ? "纸质表" : "打卡机",
      item.company || "-",
      item.person,
      item.shiftText || "-",
      item.timeText || "-",
      formatDuration(item.totalHours),
      formatDuration(item.overtimeHours),
      item.breakHours == null ? "-" : formatDuration(item.breakHours),
      item.workDays,
      item.punchCount || 0,
      item.unmatchedCount || 0,
    ]),
  ];
}

function appendSheet(xlsx, workbook, name, rows) {
  const worksheet = xlsx.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = columnWidths(rows);
  if (rows.length && rows[0].length) {
    worksheet["!autofilter"] = { ref: `A1:${columnLetter(rows[0].length)}${Math.max(1, rows.length)}` };
  }
  xlsx.utils.book_append_sheet(workbook, worksheet, name);
}

function columnWidths(rows) {
  const width = rows[0] ? rows[0].length : 0;
  return Array.from({ length: width }, (_, index) => {
    const longest = rows.reduce((max, row) => Math.max(max, String(row[index] ?? "").split("\n").reduce((lineMax, line) => Math.max(lineMax, line.length), 0)), 0);
    return { wch: Math.min(42, Math.max(10, longest + 2)) };
  });
}

function columnLetter(count) {
  let value = count;
  let text = "";
  while (value > 0) {
    value -= 1;
    text = String.fromCharCode(65 + (value % 26)) + text;
    value = Math.floor(value / 26);
  }
  return text;
}

export function uniqueSheetName(value, usedNames = new Set()) {
  const base = String(value || "人员").replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "人员";
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    const ending = `-${suffix}`;
    candidate = `${base.slice(0, 31 - ending.length)}${ending}`;
    suffix += 1;
  }
  return candidate;
}

export function sanitizeFileName(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, "-");
}
