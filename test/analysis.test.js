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

test("each employee workday deducts one 30-minute break before overtime", () => {
  const result = analyzeRows(
    [{ 姓名: "Ming Liu", 日期: "2026-09-08", 上班: "09:00", 下班: "18:00" }],
    columns,
    filters,
    "2026-09-08",
    "2026-09-08"
  );

  assert.equal(result.people[0].totalHours, 8.5);
  assert.equal(result.people[0].overtimeHours, 0.5);
  assert.equal(result.totalWork, 8.5);
  assert.equal(result.totalOvertime, 0.5);
});

test("the break is deducted once when a workday contains multiple segments", () => {
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

  assert.equal(result.people[0].totalHours, 8.5);
  assert.equal(result.people[0].workDays, 1);
});
