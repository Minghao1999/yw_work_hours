import test from "node:test";
import assert from "node:assert/strict";

import { analyzeRows } from "../src/analysis.js";

const columns = {
  person: "姓名",
  date: "日期",
  clockIn: "上班",
  clockOut: "下班",
  timeColumns: [],
};

const filters = {
  region: "",
  company: "",
  shift: "all",
  fallbackRegion: "",
  fallbackCompany: "",
};

test("a two-punch workday does not calculate or deduct break time", () => {
  const result = analyzeRows(
    [{ 姓名: "Ming Liu", 日期: "2026-09-08", 上班: "09:00", 下班: "18:00" }],
    columns,
    filters,
    "2026-09-08",
    "2026-09-08"
  );

  assert.equal(result.people[0].totalHours, 9);
  assert.equal(result.people[0].overtimeHours, 1);
  assert.equal(result.people[0].breakHours, null);
  assert.equal(result.people[0].shiftText, "未知");
  assert.equal(result.totalWork, 9);
  assert.equal(result.totalOvertime, 1);
});

test("mid shift can be displayed and filtered", () => {
  const middayColumns = {
    ...columns,
    timesheet: "时间表",
  };
  const rows = [
    { 姓名: "Noon Worker", 日期: "2026-09-08", 时间表: "SFO-MEIDA-午班", 上班: "11:00", 下班: "19:00" },
    { 姓名: "Early Worker", 日期: "2026-09-08", 时间表: "SFO-MEIDA-早班", 上班: "06:00", 下班: "14:00" },
  ];
  const result = analyzeRows(rows, middayColumns, { ...filters, shift: "mid" }, "2026-09-08", "2026-09-08");

  assert.equal(result.people.length, 1);
  assert.equal(result.people[0].person, "Noon Worker");
  assert.equal(result.people[0].shiftText, "午班");
});

test("multi-day personnel totals are accumulated and each work time shows its date", () => {
  const result = analyzeRows(
    [
      { 姓名: "Ming Liu", 日期: "2026-09-08", 上班: "09:00", 下班: "17:00" },
      { 姓名: "Ming Liu", 日期: "2026-09-09", 上班: "10:00", 下班: "18:30" },
    ],
    columns,
    filters,
    "2026-09-08",
    "2026-09-09"
  );

  assert.equal(result.people[0].totalHours, 16.5);
  assert.equal(result.people[0].workDays, 2);
  assert.equal(result.people[0].timeText, "2026-09-08  09:00 → 17:00\n2026-09-09  10:00 → 18:30");
});

test("a single worked day still shows its date when the selected range spans multiple days", () => {
  const result = analyzeRows(
    [{ 姓名: "Ming Liu", 日期: "2026-09-09", 上班: "09:00", 下班: "17:00" }],
    columns,
    filters,
    "2026-09-08",
    "2026-09-10"
  );

  assert.equal(result.people[0].timeText, "2026-09-09  09:00 → 17:00");
});

test("an eight-hour workday shows break time as unavailable", () => {
  const result = analyzeRows(
    [{ 姓名: "Ming Liu", 日期: "2026-09-08", 上班: "09:00", 下班: "17:00" }],
    columns,
    filters,
    "2026-09-08",
    "2026-09-08"
  );

  assert.equal(result.people[0].totalHours, 8);
  assert.equal(result.people[0].overtimeHours, 0);
  assert.equal(result.people[0].breakHours, null);
});

test("four punches sum the work segments but leave break time unavailable", () => {
  const result = analyzeRows(
    [
      { 姓名: "Ming Liu", 日期: "2026-09-08", 上班: "08:00", 下班: "12:00" },
      { 姓名: "Ming Liu", 日期: "2026-09-08", 上班: "13:00", 下班: "18:00" },
    ],
    columns,
    filters,
    "2026-09-08",
    "2026-09-08"
  );

  assert.equal(result.people[0].totalHours, 9);
  assert.equal(result.people[0].workDays, 1);
  assert.equal(result.people[0].punchCount, 4);
  assert.equal(result.people[0].overtimeHours, 1);
  assert.equal(result.people[0].breakHours, null);
});

test("four Spanish punch columns preserve order across midnight", () => {
  const spanishColumns = {
    person: "Nombre de la persona",
    date: "Fecha",
    timesheet: "Hoja de tiempo",
    timeColumns: ["Entrada1", "Salida1", "Entrada2", "Salida2"],
  };
  const result = analyzeRows(
    [{
      "Nombre de la persona": "Jessica Flores",
      Fecha: "09/09/2026",
      "Hoja de tiempo": "ATL-MI-晚班",
      Entrada1: "14:59:31 (-04:00)",
      Salida1: "23:23:38 (-04:00)",
      Entrada2: "23:50:23 (-04:00)",
      Salida2: "00:55:58 (-04:00)",
    }],
    spanishColumns,
    filters,
    "2026-09-09",
    "2026-09-09"
  );

  assert.ok(Math.abs(result.people[0].totalHours - (9 + 29 / 60 + 42 / 3600)) < 1e-9);
  assert.ok(Math.abs(result.people[0].overtimeHours - (1 + 29 / 60 + 42 / 3600)) < 1e-9);
  assert.equal(result.people[0].punchCount, 4);
  assert.equal(result.people[0].shiftText, "晚班");
  assert.equal(result.people[0].breakHours, null);
  assert.equal(result.people[0].timeText, "14:59 → 23:23\n23:50 → 次日 00:55");
});

test("a row without punches uses total duration and leaves break unavailable", () => {
  const durationColumns = {
    person: "人员姓名",
    date: "日期",
    timesheet: "时间表",
    totalDuration: "总时长(小时)",
    timeColumns: ["打卡时间1", "打卡时间2"],
  };
  const result = analyzeRows(
    [{ 人员姓名: "Yong Liu", 日期: "09.09-09.09", 时间表: "周一到周五-早", "总时长(小时)": "07:39:43" }],
    durationColumns,
    filters,
    "2026-09-09",
    "2026-09-09"
  );

  assert.ok(Math.abs(result.people[0].totalHours - (7 + 39 / 60 + 43 / 3600)) < 1e-9);
  assert.equal(result.people[0].overtimeHours, 0);
  assert.equal(result.people[0].breakHours, null);
  assert.equal(result.people[0].punchCount, 0);
  assert.equal(result.people[0].timeText, "");
});

test("total-duration fallback does not deduct a break and still calculates overtime", () => {
  const durationColumns = {
    person: "人员姓名",
    date: "日期",
    totalDuration: "总时长(小时)",
    timeColumns: [],
  };
  const result = analyzeRows(
    [{ 人员姓名: "Xinqian Chen", 日期: "09.09-09.09", "总时长(小时)": "08:29:52" }],
    durationColumns,
    filters,
    "2026-09-09",
    "2026-09-09"
  );

  assert.ok(Math.abs(result.people[0].totalHours - (8 + 29 / 60 + 52 / 3600)) < 1e-9);
  assert.ok(Math.abs(result.people[0].overtimeHours - (29 / 60 + 52 / 3600)) < 1e-9);
  assert.equal(result.people[0].breakHours, null);
});

test("total-duration fallback accepts decimal hour values", () => {
  const durationColumns = {
    person: "人员姓名",
    date: "日期",
    totalDuration: "总时长(小时)",
    timeColumns: [],
  };
  const result = analyzeRows(
    [{ 人员姓名: "Decimal Hours", 日期: "2026-09-09", "总时长(小时)": "8.5" }],
    durationColumns,
    filters,
    "2026-09-09",
    "2026-09-09"
  );

  assert.equal(result.people[0].totalHours, 8.5);
  assert.equal(result.people[0].overtimeHours, 0.5);
  assert.equal(result.people[0].breakHours, null);
});

test("punch data takes precedence over a duration-only row for the same person and day", () => {
  const mixedColumns = {
    person: "人员姓名",
    date: "日期",
    clockIn: "上班",
    clockOut: "下班",
    totalDuration: "总时长(小时)",
    timeColumns: [],
  };
  const result = analyzeRows(
    [
      { 人员姓名: "Ming Liu", 日期: "2026-09-09", 上班: "09:00", 下班: "18:00", "总时长(小时)": "" },
      { 人员姓名: "Ming Liu", 日期: "2026-09-09", 上班: "", 下班: "", "总时长(小时)": "12:00:00" },
    ],
    mixedColumns,
    filters,
    "2026-09-09",
    "2026-09-09"
  );

  assert.equal(result.people[0].totalHours, 9);
  assert.equal(result.people[0].breakHours, null);
  assert.equal(result.people[0].punchCount, 2);
});

test("paper attendance subtracts and sums two break intervals", () => {
  const paperColumns = {
    person: "人员姓名Name",
    date: "日期Date",
    timesheet: "时间表Timesheet",
    clockIn: "上班打卡Clock In",
    clockOut: "下班打卡Clock Out",
    paperBreakOut1: "第一次休息离开Break Out 1",
    paperBreakIn1: "第一次休息回来Break In 1",
    paperBreakOut2: "第二次休息离开Break Out 2",
    paperBreakIn2: "第二次休息回来Break In 2",
    timeColumns: ["打卡时间1", "打卡时间2"],
  };
  const result = analyzeRows([{
    "人员姓名Name": "jiadong sun",
    "日期Date": "09/09/2026",
    "时间表Timesheet": "JFK-caion-晚班",
    "上班打卡Clock In": "10:00",
    "下班打卡Clock Out": "21:00",
    "第一次休息离开Break Out 1": "14:35",
    "第一次休息回来Break In 1": "15:05",
    "第二次休息离开Break Out 2": "19:35",
    "第二次休息回来Break In 2": "20:05",
    "数据来源": "paper",
  }], paperColumns, { ...filters, sourceType: "paper" }, "2026-09-09", "2026-09-09");

  assert.equal(result.people[0].totalHours, 10);
  assert.equal(result.people[0].overtimeHours, 2);
  assert.equal(result.people[0].breakHours, 1);
  assert.equal(result.people[0].punchCount, 2);
});

test("paper attendance handles the second break crossing midnight", () => {
  const paperColumns = {
    person: "姓名",
    date: "日期",
    clockIn: "上班",
    clockOut: "下班",
    paperBreakOut1: "休息出1",
    paperBreakIn1: "休息回1",
    paperBreakOut2: "休息出2",
    paperBreakIn2: "休息回2",
    timeColumns: [],
  };
  const result = analyzeRows([{
    "姓名": "changhui lin",
    "日期": "09/09/2026",
    "上班": "13:30",
    "下班": "04:02",
    "休息出1": "18:31",
    "休息回1": "19:01",
    "休息出2": "23:31",
    "休息回2": "00:01",
    "数据来源": "paper",
  }], paperColumns, { ...filters, sourceType: "paper" }, "2026-09-09", "2026-09-09");

  assert.ok(Math.abs(result.people[0].totalHours - (13 + 32 / 60)) < 1e-9);
  assert.ok(Math.abs(result.people[0].breakHours - 1) < 1e-9);
});

test("paper attendance ignores a break interval outside the work shift", () => {
  const columns = {
    person: "姓名",
    date: "日期",
    clockIn: "上班",
    clockOut: "下班",
    paperBreakOut1: "休息出1",
    paperBreakIn1: "休息回1",
    timeColumns: [],
  };
  const result = analyzeRows([{
    "姓名": "Outside Break",
    "日期": "09/09/2026",
    "上班": "10:00",
    "下班": "16:02",
    "休息出1": "18:31",
    "休息回1": "19:31",
    "数据来源": "paper",
  }], columns, { ...filters, sourceType: "paper" }, "2026-09-09", "2026-09-09");

  assert.ok(Math.abs(result.people[0].totalHours - (6 + 2 / 60)) < 1e-9);
  assert.equal(result.people[0].breakHours, 0);
});
