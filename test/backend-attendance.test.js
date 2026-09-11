import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";

import { hashImport, normalizeAttendanceDocument } from "../backend/attendance.js";

test("MongoDB attendance document keeps normalized fields and ordered punches", () => {
  const importId = new ObjectId();
  const createdAt = new Date("2026-09-11T00:00:00Z");
  const document = normalizeAttendanceDocument({
    数据来源: "machine",
    人员姓名: "Jessica Flores",
    人员ID: "ATL001",
    日期: "2026-09-09",
    时间表: "ATL-MI-晚班",
    地区: "ATL",
    劳务公司: "MI",
    班次: "晚班",
    打卡时间2: "23:23:38",
    打卡时间1: "14:59:31",
    打卡时间4: "00:55:58",
    打卡时间3: "23:50:23",
  }, { importId, rowNumber: 1, fileNames: ["ATL.csv"], createdAt });

  assert.equal(document.personName, "Jessica Flores");
  assert.equal(document.region, "ATL");
  assert.equal(document.company, "MI");
  assert.equal(document.sourceType, "machine");
  assert.deepEqual(document.punches, ["14:59:31", "23:23:38", "23:50:23", "00:55:58"]);
  assert.equal(document.importId, importId);
  assert.equal(document.createdAt, createdAt);
});

test("paper attendance document keeps both break intervals", () => {
  const document = normalizeAttendanceDocument({
    数据来源: "paper",
    人员姓名: "jiadong sun",
    日期: "09/09/2026",
    时间表: "JFK-caion-晚班",
    地区: "JFK",
    劳务公司: "caion",
    班次: "晚班",
    "Clock In": "10:00",
    "Clock Out": "21:00",
    "Break Out 1": "14:35",
    "Break In 1": "15:05",
    "Break Out 2": "19:35",
    "Break In 2": "20:05",
  }, {
    importId: new ObjectId(),
    rowNumber: 1,
    fileNames: ["260909 NJC.xlsx"],
    createdAt: new Date("2026-09-11T00:00:00Z"),
  });

  assert.equal(document.sourceType, "paper");
  assert.equal(document.breakOut1, "14:35");
  assert.equal(document.breakIn1, "15:05");
  assert.equal(document.breakOut2, "19:35");
  assert.equal(document.breakIn2, "20:05");
});

test("identical imports produce the same duplicate-detection hash", () => {
  const rows = [{ 人员姓名: "Ana", 日期: "2026-09-09", 总时长: "08:00:00" }];
  assert.equal(hashImport(["MIA.csv"], rows), hashImport(["MIA.csv"], rows));
  assert.notEqual(hashImport(["MIA.csv"], rows), hashImport(["ATL.csv"], rows));
});

test("machine source migration remains duplicate-compatible with old imports", () => {
  const legacy = [{ 人员姓名: "Ana", 日期: "2026-09-09", 总时长: "08:00:00" }];
  const migrated = [{
    ...legacy[0],
    数据来源: "machine",
    "Break Out 1": "",
    "Break In 1": "",
    "Break Out 2": "",
    "Break In 2": "",
  }];
  assert.equal(hashImport(["MIA.csv"], legacy), hashImport(["MIA.csv"], migrated));
});

test("paper duplicate hash treats legacy punches and clock columns as the same data", () => {
  const common = {
    数据来源: "paper",
    人员姓名: "changhui lin",
    日期: "09/09/2026",
    "Break Out 1": "18:31:00",
    "Break In 1": "19:01:00",
    "Break Out 2": "23:31:00",
    "Break In 2": "0:01:00",
  };
  const legacy = [{ ...common, "Clock In": "", "Clock Out": "", 打卡时间1: "13:30:00", 打卡时间2: "4:02:00", 总休息时长: "18:31:00", 考勤记录: "13:30:00" }];
  const current = [{ ...common, "Clock In": "13:30:00", "Clock Out": "04:02:00", "Break In 2": "00:01:00", 总休息时长: "", 考勤记录: "" }];
  assert.equal(hashImport(["260909 NJC.xlsx"], legacy), hashImport(["260909 NJC.xlsx"], current));
});
