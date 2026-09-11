import test from "node:test";
import assert from "node:assert/strict";

import { databaseRecordToRow, deleteAttendanceRecords } from "../src/api.js";

test("database record restores its original normalized attendance row", () => {
  const raw = { 人员姓名: "Ana", 日期: "2026-09-09", 地区: "MIA", 总时长: "08:00:00" };
  assert.deepEqual(databaseRecordToRow({ raw }), { ...raw, 数据来源: "machine" });
});

test("database record without raw data is converted to canonical columns", () => {
  const row = databaseRecordToRow({
    personName: "Jessica Flores",
    personId: "ATL001",
    date: "2026-09-09",
    timesheet: "ATL-MI-晚班",
    region: "ATL",
    company: "MI",
    shift: "晚班",
    punches: ["14:59:31", "23:23:38", "23:50:23", "00:55:58"],
  });

  assert.equal(row["人员姓名"], "Jessica Flores");
  assert.equal(row["数据来源"], "machine");
  assert.equal(row["劳务公司"], "MI");
  assert.equal(row["打卡时间1"], "14:59:31");
  assert.equal(row["打卡时间4"], "00:55:58");
});

test("paper database record restores break columns", () => {
  const row = databaseRecordToRow({
    sourceType: "paper",
    personName: "jiadong sun",
    breakOut1: "14:35",
    breakIn1: "15:05",
    breakOut2: "19:35",
    breakIn2: "20:05",
  });
  assert.equal(row["数据来源"], "paper");
  assert.equal(row["Break Out 1"], "14:35");
  assert.equal(row["Break In 2"], "20:05");
});

test("legacy paper records restore clock-in and clock-out from their stored punches", () => {
  const row = databaseRecordToRow({
    sourceType: "paper",
    punches: ["13:30:00", "04:02:00"],
    raw: {
      数据来源: "paper",
      "Clock In": "",
      "Clock Out": "",
      "Break Out 1": "18:31:00",
      "Break In 1": "19:31:00",
    },
  });
  assert.equal(row["Clock In"], "13:30:00");
  assert.equal(row["Clock Out"], "04:02:00");
});

test("delete client sends the exact destructive scope to the backend", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ ok: true, deletedCount: 12 }),
    };
  };

  try {
    const result = await deleteAttendanceRecords({
      scope: "company",
      sourceType: "machine",
      region: "ATL",
      company: "MI",
    });
    assert.equal(request.url, "/api/attendance/records");
    assert.equal(request.options.method, "DELETE");
    assert.deepEqual(JSON.parse(request.options.body), {
      scope: "company",
      sourceType: "machine",
      region: "ATL",
      company: "MI",
    });
    assert.equal(result.deletedCount, 12);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
