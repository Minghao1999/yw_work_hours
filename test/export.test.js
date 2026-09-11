import test from "node:test";
import assert from "node:assert/strict";

import { buildFullReport, buildFullReportFileName, downloadFullReportWorkbook, personRows, uniqueSheetName } from "../src/export.js";

test("full report includes all regions, region-company pairs, and one people table per region", () => {
  const rows = [
    { 姓名: "Ana", 日期: "2026-09-09", 时间表: "MIA-alpha-早班", 总时长: "08:30:00" },
    { 姓名: "Ben", 日期: "2026-09-09", 时间表: "MIA-beta-晚班", 总时长: "07:00:00" },
    { 姓名: "Cleo", 日期: "2026-09-09", 时间表: "ATL-alpha-早班", 总时长: "09:00:00" },
  ];
  const columns = { person: "姓名", date: "日期", timesheet: "时间表", totalDuration: "总时长", timeColumns: [] };
  const report = buildFullReport(rows, columns, {
    regions: ["MIA", "ATL"],
    fallbackRegion: "",
    startDate: "2026-09-09",
    endDate: "2026-09-09",
  });

  assert.deepEqual(report.regionSummaries.map((item) => item.region), ["MIA", "ATL"]);
  assert.deepEqual(report.companySummaries.map((item) => `${item.region}-${item.company}`), ["MIA-alpha", "MIA-beta", "ATL-alpha"]);
  assert.equal(report.peopleByRegion.length, 2);
  assert.deepEqual(report.peopleByRegion[0].people.map((item) => `${item.company}-${item.person}`), ["alpha-Ana", "beta-Ben"]);
});

test("people table exports paper break time and keeps machine break unavailable", () => {
  const rows = personRows("MIA", [{
    company: "ksanchez",
    person: "莘莘 孙",
    shiftText: "午班",
    timeText: "10:00 → 17:50",
    totalHours: 7 + 50 / 60 + 48 / 3600,
    overtimeHours: 0,
    breakHours: 0.5,
    sourceType: "paper",
    workDays: 1,
    punchCount: 2,
    unmatchedCount: 0,
  }]);

  assert.equal(rows[1][1], "纸质表");
  assert.equal(rows[1][8], "0:30");

  const machineRows = personRows("MIA", [{
    company: "ksanchez",
    person: "Machine User",
    totalHours: 8,
    overtimeHours: 0,
    breakHours: null,
    sourceType: "machine",
    workDays: 1,
  }]);
  assert.equal(machineRows[1][8], "-");
});

test("workbook download creates summary sheets before each region people sheet", () => {
  const appended = [];
  const fakeXlsx = {
    utils: {
      book_new: () => ({ SheetNames: [] }),
      aoa_to_sheet: (rows) => ({ rows }),
      book_append_sheet: (workbook, worksheet, name) => {
        workbook.SheetNames.push(name);
        appended.push({ name, worksheet });
      },
    },
    writeFile: (workbook, fileName) => {
      assert.equal(fileName, "考勤完整报表.xlsx");
      assert.deepEqual(workbook.SheetNames, ["地区汇总", "地区劳务公司", "MIA人员", "ATL人员"]);
    },
  };

  downloadFullReportWorkbook({
    regionSummaries: [],
    companySummaries: [],
    peopleByRegion: [{ region: "MIA", people: [] }, { region: "ATL", people: [] }],
  }, "考勤完整报表.xlsx", fakeXlsx);

  assert.equal(appended.length, 4);
});

test("file and sheet names are safe for Excel", () => {
  assert.equal(buildFullReportFileName("2026-09-09", "2026-09-10"), "考勤完整报表_2026-09-09_至_2026-09-10.xlsx");
  assert.equal(uniqueSheetName("MIA/东区人员", new Set()), "MIA-东区人员");
  assert.equal(uniqueSheetName("MIA人员", new Set(["MIA人员"])), "MIA人员-2");
});
