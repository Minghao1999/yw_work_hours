import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";

export const IMPORTS_COLLECTION = "attendance_imports";
export const RECORDS_COLLECTION = "attendance_records";

export async function ensureDatabaseSchema(database) {
  await ensureCollection(database, IMPORTS_COLLECTION);
  await ensureCollection(database, RECORDS_COLLECTION);

  await database.collection(IMPORTS_COLLECTION).createIndexes([
    { key: { contentHash: 1 }, name: "unique_content_hash", unique: true },
    { key: { createdAt: -1 }, name: "created_at_desc" },
  ]);
  await database.collection(RECORDS_COLLECTION).createIndexes([
    { key: { importId: 1, rowNumber: 1 }, name: "import_rows" },
    { key: { sourceType: 1, region: 1, company: 1, date: 1 }, name: "source_scope_and_date" },
    { key: { personName: 1, date: 1 }, name: "person_and_date" },
  ]);
  await database.collection(IMPORTS_COLLECTION).updateMany(
    { sourceTypes: { $exists: false } },
    { $set: { sourceTypes: ["machine"] } }
  );
  await database.collection(RECORDS_COLLECTION).updateMany(
    { sourceType: { $exists: false } },
    { $set: { sourceType: "machine" } }
  );
}

export async function saveAttendanceImport(database, payload) {
  const fileNames = normalizeFileNames(payload?.fileNames);
  const rows = validateRows(payload?.rows);
  const sourceTypes = [...new Set(rows.map((row) => normalizeSourceType(row["数据来源"])))].sort();
  const contentHash = hashImport(fileNames, rows);
  const imports = database.collection(IMPORTS_COLLECTION);
  const records = database.collection(RECORDS_COLLECTION);
  const existing = await imports.findOne({ contentHash, status: "complete" });

  if (existing) {
    return {
      duplicate: true,
      importId: existing._id,
      recordCount: existing.recordCount,
      fileNames: existing.fileNames,
      createdAt: existing.createdAt,
      sourceTypes: existing.sourceTypes || ["machine"],
    };
  }

  const createdAt = new Date();
  let importResult;
  try {
    importResult = await imports.insertOne({
      fileNames,
      contentHash,
      recordCount: rows.length,
      sourceTypes,
      status: "processing",
      createdAt,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const duplicate = await imports.findOne({ contentHash });
    return {
      duplicate: true,
      importId: duplicate?._id,
      recordCount: duplicate?.recordCount || rows.length,
      fileNames: duplicate?.fileNames || fileNames,
      createdAt: duplicate?.createdAt || createdAt,
      sourceTypes: duplicate?.sourceTypes || sourceTypes,
    };
  }

  const importId = importResult.insertedId;
  try {
    const documents = rows.map((row, index) => normalizeAttendanceDocument(row, {
      importId,
      rowNumber: index + 1,
      fileNames,
      createdAt,
    }));

    for (let index = 0; index < documents.length; index += 1000) {
      await records.insertMany(documents.slice(index, index + 1000), { ordered: true });
    }
    await imports.updateOne({ _id: importId }, { $set: { status: "complete", completedAt: new Date() } });
  } catch (error) {
    await records.deleteMany({ importId }).catch(() => {});
    await imports.deleteOne({ _id: importId }).catch(() => {});
    throw error;
  }

  return {
    duplicate: false,
    importId,
    recordCount: rows.length,
    fileNames,
    createdAt,
    sourceTypes,
  };
}

export async function listAttendanceImports(database, limit = 20) {
  return database.collection(IMPORTS_COLLECTION)
    .find({}, { projection: { contentHash: 0 } })
    .sort({ createdAt: -1 })
    .limit(clampLimit(limit, 20, 100))
    .toArray();
}

export async function listAttendanceRecords(database, query = {}) {
  const filter = {};
  if (query.importId) {
    if (!ObjectId.isValid(query.importId)) throw new RequestError("importId 格式不正确");
    filter.importId = new ObjectId(query.importId);
  }
  if (query.region) filter.region = String(query.region);
  if (query.company) filter.company = String(query.company);
  if (query.date) filter.date = String(query.date);
  if (query.personName) filter.personName = String(query.personName);
  if (query.sourceType) filter.sourceType = normalizeSourceType(query.sourceType);

  const limit = clampLimit(query.limit, 500, 5000);
  const skip = clampOffset(query.skip);
  const records = await database.collection(RECORDS_COLLECTION)
    .find(filter)
    .sort({ date: 1, region: 1, company: 1, personName: 1, rowNumber: 1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  return { records, limit, skip, hasMore: records.length === limit };
}

export async function listAttendanceDates(database) {
  return database.collection(RECORDS_COLLECTION).aggregate([
    { $group: { _id: "$date", recordCount: { $sum: 1 }, withDuration: { $sum: { $cond: [{ $ne: ["$totalDuration", ""] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]).toArray();
}

export async function deleteAttendanceRecords(database, payload) {
  const { scope, filter } = buildAttendanceDeleteFilter(payload);
  const records = database.collection(RECORDS_COLLECTION);
  const imports = database.collection(IMPORTS_COLLECTION);
  const affectedImports = await records.aggregate([
    { $match: filter },
    { $group: { _id: "$importId" } },
  ]).toArray();
  const importIds = affectedImports.map((item) => item._id).filter(Boolean);
  const result = await records.deleteMany(filter);

  if (result.deletedCount) {
    const modifiedAt = new Date();
    for (const importId of importIds) {
      const remainingCount = await records.countDocuments({ importId });
      if (!remainingCount) {
        await imports.deleteOne({ _id: importId });
        continue;
      }
      await imports.updateOne(
        { _id: importId },
        {
          $set: {
            contentHash: `modified:${String(importId)}:${modifiedAt.getTime()}`,
            recordCount: remainingCount,
            status: "modified",
            modifiedAt,
          },
        }
      );
    }
  }

  return {
    scope,
    deletedCount: result.deletedCount || 0,
    affectedImportCount: importIds.length,
  };
}

export function buildAttendanceDeleteFilter(payload = {}) {
  const scope = clean(payload.scope).toLowerCase();
  const sourceType = clean(payload.sourceType).toLowerCase();
  if (!['machine', 'paper'].includes(sourceType)) {
    throw new RequestError("删除数据时必须指定数据来源");
  }
  if (!['region', 'company', 'person'].includes(scope)) {
    throw new RequestError("删除范围不正确");
  }

  const region = clean(payload.region);
  const company = clean(payload.company);
  const personName = clean(payload.personName);
  if (!region) throw new RequestError("删除数据时必须指定地区");
  if (scope !== 'region' && !company) throw new RequestError("删除数据时必须指定劳务公司");
  if (scope === 'person' && !personName) throw new RequestError("删除数据时必须指定人员");

  const filter = { sourceType, region };
  if (scope === 'company' || scope === 'person') filter.company = company;
  if (scope === 'person') filter.personName = personName;
  return { scope, filter };
}

export function normalizeAttendanceDocument(row, context) {
  const punches = Object.keys(row)
    .filter((key) => /^打卡时间\d+$/.test(key) && clean(row[key]))
    .sort((left, right) => Number(left.match(/\d+/)?.[0] || 0) - Number(right.match(/\d+/)?.[0] || 0))
    .map((key) => clean(row[key]));

  return {
    importId: context.importId,
    rowNumber: context.rowNumber,
    fileNames: context.fileNames,
    personName: clean(row["人员姓名"]),
    personId: clean(row["人员ID"]),
    date: clean(row["日期"]),
    timesheet: clean(row["时间表"]),
    region: clean(row["地区"]),
    company: clean(row["劳务公司"]),
    shift: clean(row["班次"]),
    sourceType: normalizeSourceType(row["数据来源"]),
    clockIn: clean(row["Clock In"]),
    clockOut: clean(row["Clock Out"]),
    breakOut1: clean(row["Break Out 1"]),
    breakIn1: clean(row["Break In 1"]),
    breakOut2: clean(row["Break Out 2"]),
    breakIn2: clean(row["Break In 2"]),
    totalDuration: clean(row["总时长"]),
    attendanceRecord: clean(row["考勤记录"]),
    punches,
    raw: row,
    createdAt: context.createdAt,
  };
}

export function hashImport(fileNames, rows) {
  const hashRows = rows.map((row) => {
    if (normalizeSourceType(row["数据来源"]) === "paper") {
      const normalizedPaperRow = { ...row, "数据来源": "paper" };
      const punchKeys = Object.keys(normalizedPaperRow)
        .filter((key) => /^打卡时间\d+$/.test(key))
        .sort((left, right) => Number(left.match(/\d+/)?.[0] || 0) - Number(right.match(/\d+/)?.[0] || 0));
      normalizedPaperRow["Clock In"] = normalizeClockText(normalizedPaperRow["Clock In"] || normalizedPaperRow[punchKeys[0]]);
      normalizedPaperRow["Clock Out"] = normalizeClockText(normalizedPaperRow["Clock Out"] || normalizedPaperRow[punchKeys[1]]);
      ["Break Out 1", "Break In 1", "Break Out 2", "Break In 2"].forEach((key) => {
        normalizedPaperRow[key] = normalizeClockText(normalizedPaperRow[key]);
      });
      punchKeys.forEach((key) => delete normalizedPaperRow[key]);
      normalizedPaperRow["总休息时长"] = "";
      normalizedPaperRow["考勤记录"] = "";
      return normalizedPaperRow;
    }
    const { 数据来源, ...legacyCompatibleRow } = row;
    ["Break Out 1", "Break In 1", "Break Out 2", "Break In 2"].forEach((key) => {
      if (!clean(legacyCompatibleRow[key])) delete legacyCompatibleRow[key];
    });
    return legacyCompatibleRow;
  });
  return createHash("sha256")
    .update(JSON.stringify({ fileNames, rows: hashRows }))
    .digest("hex");
}

function normalizeClockText(value) {
  const text = clean(value);
  const match = text.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return text;
  return [match[1], match[2], match[3] || "00"]
    .map((part) => part.padStart(2, "0"))
    .join(":");
}

function normalizeFileNames(values) {
  const fileNames = Array.isArray(values)
    ? [...new Set(values.map((value) => clean(value)).filter(Boolean))].sort()
    : [];
  return fileNames.length ? fileNames : ["未命名考勤表"];
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new RequestError("没有可保存的考勤记录");
  if (rows.length > 100000) throw new RequestError("单次最多保存 100000 条考勤记录");
  if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new RequestError("考勤记录格式不正确");
  }
  return rows;
}

async function ensureCollection(database, name) {
  const exists = await database.listCollections({ name }, { nameOnly: true }).hasNext();
  if (exists) return;
  try {
    await database.createCollection(name);
  } catch (error) {
    if (error?.code !== 48) throw error;
  }
}

function clampLimit(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), maximum);
}

function clampOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), 1000000);
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeSourceType(value) {
  return clean(value).toLowerCase() === "paper" ? "paper" : "machine";
}

export class RequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestError";
    this.statusCode = 400;
  }
}
