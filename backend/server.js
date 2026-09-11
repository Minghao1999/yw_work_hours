import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { closeDatabase, connectDatabase } from "./db.js";
import { deleteAttendanceRecords, ensureDatabaseSchema, listAttendanceDates, listAttendanceImports, listAttendanceRecords, RequestError, saveAttendanceImport } from "./attendance.js";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5173);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", async (request, response, next) => {
  try {
    const database = await connectDatabase();
    await ensureDatabaseSchema(database);
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    response.json({
      ok: true,
      service: "work-hours-api",
      database: database.databaseName,
      collections: collections.map((item) => item.name).sort(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/attendance/imports", async (request, response, next) => {
  try {
    const database = await connectDatabase();
    await ensureDatabaseSchema(database);
    const result = await saveAttendanceImport(database, request.body);
    response.status(result.duplicate ? 200 : 201).json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.get("/api/attendance/imports", async (request, response, next) => {
  try {
    const database = await connectDatabase();
    const imports = await listAttendanceImports(database, request.query.limit);
    response.json({ ok: true, imports });
  } catch (error) {
    next(error);
  }
});

app.get("/api/attendance/records", async (request, response, next) => {
  try {
    const database = await connectDatabase();
    const result = await listAttendanceRecords(database, request.query);
    response.json({ ok: true, ...result, count: result.records.length });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/attendance/records", async (request, response, next) => {
  try {
    const database = await connectDatabase();
    const result = await deleteAttendanceRecords(database, request.body);
    response.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.get("/api/attendance/dates", async (request, response, next) => {
  try {
    const database = await connectDatabase();
    const dates = await listAttendanceDates(database);
    response.json({ ok: true, dates });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(projectRoot));

app.use((error, request, response, next) => {
  console.error("请求处理失败：", error.message);
  response.status(error instanceof RequestError ? error.statusCode : 500).json({
    ok: false,
    error: error instanceof RequestError ? error.message : "服务器暂时无法处理请求",
  });
});

let server;

async function startServer() {
  const database = await connectDatabase();
  await ensureDatabaseSchema(database);
  server = app.listen(port, host, () => {
    console.log(`MongoDB 已连接：${database.databaseName}`);
    console.log(`应用运行在 http://${host}:${port}`);
  });
}

async function shutdown(signal) {
  console.log(`收到 ${signal}，正在关闭服务`);
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT").catch(console.error));
process.on("SIGTERM", () => shutdown("SIGTERM").catch(console.error));

startServer().catch((error) => {
  console.error("后端启动失败：", error.message);
  process.exit(1);
});
