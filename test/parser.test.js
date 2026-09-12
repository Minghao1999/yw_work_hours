import test from "node:test";
import assert from "node:assert/strict";

import { decodeCsvText, detectDataSource, getCompanyOptions, guessColumns, inferDateRange, normalizeSourceValue } from "../src/parser.js";
import { parseTimesheetParts } from "../src/utils.js";

test("UTF-8 CSV keeps Chinese headers and timesheet values intact", () => {
  const csv = [
    "人员姓名,人员ID,日期,时间表,Clock In,Clock Out",
    "Lin Li,1,09/08/2026,NJC-delin-晚班,15:29:16,04:22:02",
  ].join("\n");

  const decoded = decodeCsvText(new TextEncoder().encode(csv));

  assert.equal(decoded, csv);
  assert.match(decoded, /时间表/);
  assert.match(decoded, /NJC-delin-晚班/);
});

test("company options are extracted from the 时间表 column", () => {
  const rows = [
    { 人员姓名: "Lin Li", 时间表: "NJC-delin-晚班", "Clock In": "15:29:16", "Clock Out": "04:22:02" },
    { 人员姓名: "Han Li", 时间表: "NJC-acme-早班", "Clock In": "06:00:00", "Clock Out": "14:30:00" },
  ];
  const columns = guessColumns(Object.keys(rows[0]), rows);

  assert.deepEqual(parseTimesheetParts(rows[0].时间表), {
    region: "NJC",
    company: "delin",
    shift: "晚班",
  });
  assert.deepEqual(getCompanyOptions(rows, columns, "", "NJC"), ["acme", "delin"]);
});

test("timesheet parsing recognizes mid shift and leaves unrecognized shifts unknown", () => {
  assert.deepEqual(parseTimesheetParts("SFO-MEIDA-午班"), {
    region: "SFO",
    company: "MEIDA",
    shift: "午班",
  });
  assert.deepEqual(parseTimesheetParts("SFO-MEIDA"), {
    region: "",
    company: "",
    shift: "",
  });
  assert.deepEqual(parseTimesheetParts("SFO-MEIDA-未标明班次"), {
    region: "SFO",
    company: "MEIDA",
    shift: "",
  });
});

test("Spanish attendance headers map four ordered punch columns", () => {
  const rows = [{
    "Nombre de la persona": "Jessica Flores",
    "ID de persona": "ATL001",
    Fecha: "09/09/2026",
    "Hoja de tiempo": "ATL-MI-晚班",
    Entrada1: "14:59:31 (-04:00)",
    Salida1: "23:23:38 (-04:00)",
    Entrada2: "23:50:23 (-04:00)",
    Salida2: "00:55:58 (-04:00)",
    "Tiempo total de descanso (horas)": "",
  }];
  const columns = guessColumns(Object.keys(rows[0]), rows);

  assert.equal(columns.person, "Nombre de la persona");
  assert.equal(columns.personId, "ID de persona");
  assert.equal(columns.date, "Fecha");
  assert.equal(columns.timesheet, "Hoja de tiempo");
  assert.equal(columns.clockIn, "Entrada1");
  assert.equal(columns.clockOut, "Salida1");
  assert.equal(columns.breakTime, "Tiempo total de descanso (horas)");
  assert.deepEqual(columns.timeColumns, ["Entrada1", "Salida1", "Entrada2", "Salida2"]);
});

test("Chinese and English numbered punch headers are recognized", () => {
  const chineseColumns = guessColumns(
    ["人员姓名", "日期", "上班时间1", "下班时间1", "上班时间2", "下班时间2"],
    []
  );
  const englishColumns = guessColumns(
    ["Person Name", "Date", "Clock In 1", "Clock Out 1", "Clock In 2", "Clock Out 2"],
    []
  );

  assert.deepEqual(chineseColumns.timeColumns, ["上班时间1", "下班时间1", "上班时间2", "下班时间2"]);
  assert.deepEqual(englishColumns.timeColumns, ["Clock In 1", "Clock Out 1", "Clock In 2", "Clock Out 2"]);
});

test("numbered canonical punches take precedence over duplicate unnumbered columns", () => {
  const columns = guessColumns(
    ["人员姓名", "日期", "Clock In", "Clock Out", "打卡时间1", "打卡时间2", "打卡时间3", "打卡时间4"],
    []
  );

  assert.deepEqual(columns.timeColumns, ["打卡时间1", "打卡时间2", "打卡时间3", "打卡时间4"]);
});

test("summary attendance headers identify the exact total duration column", () => {
  const headers = ["人员ID", "人员姓名", "时间表", "日期", "总休息时长", "总工作时长(小时)", "总加班时长(小时)", "总时长(小时)"];
  const columns = guessColumns(headers, []);

  assert.equal(columns.totalDuration, "总时长(小时)");
  assert.equal(columns.time, "");
});

test("English summary header accepts the h unit abbreviation", () => {
  const headers = ["Person ID", "Person Name", "Timesheet", "Date", "Total Work", "Total Hours(h)"];
  const columns = guessColumns(headers, []);

  assert.equal(columns.totalDuration, "Total Hours(h)");
  assert.equal(columns.time, "");
});

test("date range uses the work date instead of an overnight clock-out date", () => {
  const rows = [{
    日期: "09/09/2026",
    打卡时间1: "2026-09-09 15:00:00",
    打卡时间2: "2026-09-10 01:00:00",
  }];
  const range = inferDateRange(rows, {
    date: "日期",
    time: "",
    timeColumns: ["打卡时间1", "打卡时间2"],
  });

  assert.deepEqual(range, {
    start: "2026-09-09",
    end: "2026-09-09",
    dates: ["2026-09-09"],
  });
});

test("date range excludes dates whose rows have no punches or total duration", () => {
  const rows = [
    { 日期: "9/9/26", 总时长: "08:00:00", 打卡时间1: "", 打卡时间2: "" },
    { 日期: "9/10/26", 总时长: "", 打卡时间1: "", 打卡时间2: "" },
  ];
  const range = inferDateRange(rows, {
    date: "日期",
    totalDuration: "总时长",
    time: "",
    timeColumns: ["打卡时间1", "打卡时间2"],
  });

  assert.deepEqual(range, {
    start: "2026-09-09",
    end: "2026-09-09",
    dates: ["2026-09-09"],
  });
});

test("fixed paper attendance columns are detected separately from machine punches", () => {
  const headers = [
    "人员姓名Name",
    "日期Date",
    "时间表Timesheet",
    "上班打卡Clock In",
    "下班打卡Clock Out",
    "第一次休息离开Break Out 1",
    "第一次休息回来Break In 1",
    "第二次休息离开Break Out 2",
    "第二次休息回来Break In 2",
    "数据源",
  ];
  const columns = guessColumns(headers, []);

  assert.equal(detectDataSource(headers, [{ 数据源: "纸质表" }]), "paper");
  assert.equal(columns.paperBreakOut1, "第一次休息离开Break Out 1");
  assert.equal(columns.paperBreakIn1, "第一次休息回来Break In 1");
  assert.equal(columns.paperBreakOut2, "第二次休息离开Break Out 2");
  assert.equal(columns.paperBreakIn2, "第二次休息回来Break In 2");
});

test("a sheet without the data-source column is always machine data", () => {
  const headers = [
    "人员姓名Name",
    "第一次休息离开Break Out 1",
    "第一次休息回来Break In 1",
    "第二次休息离开Break Out 2",
    "第二次休息回来Break In 2",
  ];
  assert.equal(detectDataSource(headers, []), "machine");
  assert.equal(normalizeSourceValue("纸质表"), "paper");
  assert.equal(normalizeSourceValue("打卡机"), "machine");
});
