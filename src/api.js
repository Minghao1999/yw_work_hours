export async function saveAttendanceImport(fileNames, rows) {
  const response = await fetch("/api/attendance/imports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileNames, rows }),
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `数据库保存失败（${response.status}）`);
  }
  return payload;
}

export async function fetchAttendanceImports(limit = 20) {
  const response = await fetch(`/api/attendance/imports?limit=${encodeURIComponent(limit)}`);
  const payload = await readJson(response);
  if (!response.ok || !payload.ok) throw new Error(payload.error || "读取导入记录失败");
  return payload.imports;
}

export async function fetchAttendanceRecords(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value != null) params.set(key, value);
  });
  const response = await fetch(`/api/attendance/records?${params.toString()}`);
  const payload = await readJson(response);
  if (!response.ok || !payload.ok) throw new Error(payload.error || "读取考勤记录失败");
  return payload;
}

export async function fetchAllAttendanceRecords(pageSize = 5000) {
  const records = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchAttendanceRecords({ limit: pageSize, skip });
    records.push(...page.records);
    hasMore = Boolean(page.hasMore);
    skip += page.records.length;
    if (!page.records.length || skip > 1000000) break;
  }
  return records;
}

export async function deleteAttendanceRecords(scope) {
  const response = await fetch("/api/attendance/records", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scope),
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `删除失败（${response.status}）`);
  }
  return payload;
}

export function databaseRecordToRow(record) {
  if (record?.raw && typeof record.raw === "object" && !Array.isArray(record.raw)) {
    const row = {
      ...record.raw,
      "数据来源": record.raw["数据来源"] || record.sourceType || "machine",
    };
    if (row["数据来源"] === "paper") {
      row["Clock In"] = row["Clock In"] || record.clockIn || record.punches?.[0] || "";
      row["Clock Out"] = row["Clock Out"] || record.clockOut || record.punches?.[1] || "";
    }
    return row;
  }

  const row = {
    "数据来源": record?.sourceType || "machine",
    "人员姓名": record?.personName || "",
    "人员ID": record?.personId || "",
    "日期": record?.date || "",
    "时间表": record?.timesheet || "",
    "地区": record?.region || "",
    "劳务公司": record?.company || "",
    "班次": record?.shift || "",
    "Clock In": record?.clockIn || "",
    "Clock Out": record?.clockOut || "",
    "Break Out 1": record?.breakOut1 || "",
    "Break In 1": record?.breakIn1 || "",
    "Break Out 2": record?.breakOut2 || "",
    "Break In 2": record?.breakIn2 || "",
    "总时长": record?.totalDuration || "",
    "考勤记录": record?.attendanceRecord || "",
  };
  (record?.punches || []).forEach((value, index) => {
    row[`打卡时间${index + 1}`] = value;
  });
  return row;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return { ok: false, error: "服务器返回了无法识别的响应" };
  }
}
