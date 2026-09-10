import test from "node:test";
import assert from "node:assert/strict";

import { decodeCsvText, getCompanyOptions, guessColumns } from "../src/parser.js";
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
