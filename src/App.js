import { DEFAULT_START, sampleRows } from './config.js?v=20260911-40';
import { analyzeRows } from './analysis.js?v=20260911-40';
import { Dashboard } from './components.js?v=20260911-40';
import { clean, formatRegionName, normalize, parseTimesheetParts } from './utils.js?v=20260911-40';
import { detectDataSource, normalizeSourceValue, guessColumns, inferSiteName, inferCompanyName, getRegionOptions, getCompanyOptions, inferDateRange, readWorkbookFile, readSheet, getRowTimesheetParts, getTimesheetCandidates } from './parser.js?v=20260911-40';
import { buildFullReport } from './export.js?v=20260911-40';
import { databaseRecordToRow, deleteAttendanceRecords, fetchAllAttendanceRecords, saveAttendanceImport } from './api.js?v=20260911-40';

const { useEffect, useMemo, useRef, useState } = React;
const CANONICAL_BASE_COLUMNS = ["数据来源", "人员姓名", "人员ID", "日期", "时间表", "地区", "劳务公司", "班次", "Clock In", "Clock Out", "Break Out 1", "Break In 1", "Break Out 2", "Break In 2", "总休息时长", "总时长", "考勤记录"];

export function App() {
  const [rows, setRows] = useState(sampleRows);
  const [columns, setColumns] = useState(sampleRows[0] ? Object.keys(sampleRows[0]) : []);
  const [fileName, setFileName] = useState("未上传文件");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("week");
  const [selectedDate, setSelectedDate] = useState(DEFAULT_START);
  const [selectedShift, setSelectedShift] = useState("all");
  const [analysisMode, setAnalysisMode] = useState("region");
  const [selectedDataSource, setSelectedDataSource] = useState("machine");
  const [deletingKey, setDeletingKey] = useState("");
  const dataRequestVersion = useRef(0);

  const visibleRows = useMemo(
    () => rows.filter((row) => (row["数据来源"] === "paper" ? "paper" : "machine") === selectedDataSource),
    [rows, selectedDataSource]
  );
  const sourceCounts = useMemo(() => rows.reduce((counts, row) => {
    const source = row["数据来源"] === "paper" ? "paper" : "machine";
    counts[source] += 1;
    return counts;
  }, { machine: 0, paper: 0 }), [rows]);
  const guessed = useMemo(() => guessColumns(columns, visibleRows), [columns, visibleRows]);
  const siteName = useMemo(() => inferSiteName(visibleRows, guessed), [visibleRows, guessed.personId, guessed.timesheet]);
  const companyName = useMemo(() => inferCompanyName(visibleRows, guessed), [visibleRows, guessed.company, guessed.timesheet]);
  const regionOptions = useMemo(() => getRegionOptions(visibleRows, guessed, siteName), [visibleRows, guessed.region, guessed.personId, guessed.timesheet, siteName]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const activeRegion = selectedRegion || regionOptions[0] || siteName;
  const companyOptions = useMemo(() => getCompanyOptions(visibleRows, guessed, companyName, activeRegion), [visibleRows, guessed.region, guessed.company, guessed.personId, guessed.timesheet, companyName, activeRegion]);
  const dateRange = useMemo(() => inferDateRange(visibleRows, guessed), [visibleRows, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut, guessed.totalDuration]);
  const activeRange = mode === "day"
    ? { start: selectedDate, end: selectedDate }
    : dateRange;
  const activeCompany = selectedCompany || companyOptions[0] || companyName;
  const effectiveShift = analysisMode === "person" ? selectedShift : "all";
  const currentScopeLabel = analysisMode === "region"
    ? `${regionOptions.length} 个地区`
    : analysisMode === "company"
      ? formatRegionName(activeRegion)
      : `${formatRegionName(activeRegion)} · ${activeCompany || "未识别劳务公司"}`;
  const hasStoredRows = rows.length > 0;
  const hasRows = visibleRows.length > 0;
  const canAnalyze = Boolean(guessed.person && ((guessed.clockIn && guessed.clockOut) || guessed.time || guessed.timeColumns.length || guessed.totalDuration));
  const fullReport = useMemo(
    () => canAnalyze ? buildFullReport(visibleRows, guessed, {
      regions: regionOptions,
      fallbackRegion: siteName,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }) : { regionSummaries: [], companySummaries: [], peopleByRegion: [] },
    [visibleRows, guessed.person, guessed.region, guessed.company, guessed.personId, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut, guessed.totalDuration, guessed.timesheet, regionOptions.join("|"), siteName, dateRange.start, dateRange.end, canAnalyze]
  );

  const analysis = useMemo(
    () => analyzeRows(visibleRows, guessed, {
      region: activeRegion,
      company: activeCompany,
      shift: effectiveShift,
      fallbackRegion: siteName,
      fallbackCompany: companyName,
      sourceType: selectedDataSource,
    }, activeRange.start, activeRange.end),
    [visibleRows, guessed.person, guessed.region, guessed.company, guessed.personId, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut, guessed.breakTime, guessed.paperBreakOut1, guessed.paperBreakIn1, guessed.paperBreakOut2, guessed.paperBreakIn2, guessed.totalDuration, guessed.timesheet, activeRegion, activeCompany, effectiveShift, selectedDataSource, siteName, companyName, activeRange.start, activeRange.end]
  );

  const comparison = useMemo(
    () => buildComparison(visibleRows, guessed, {
      regions: regionOptions,
      companies: companyOptions,
      selectedRegion: activeRegion,
      selectedCompany: activeCompany,
      selectedShift: effectiveShift,
      fallbackRegion: siteName,
      fallbackCompany: companyName,
      startDate: activeRange.start,
      endDate: activeRange.end,
      canAnalyze,
      sourceType: selectedDataSource,
    }),
    [visibleRows, guessed.person, guessed.region, guessed.company, guessed.personId, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut, guessed.breakTime, guessed.paperBreakOut1, guessed.paperBreakIn1, guessed.paperBreakOut2, guessed.paperBreakIn2, guessed.totalDuration, guessed.timesheet, regionOptions.join("|"), companyOptions.join("|"), activeRegion, activeCompany, effectiveShift, selectedDataSource, siteName, companyName, activeRange.start, activeRange.end, canAnalyze]
  );

  useEffect(() => {
    if (!regionOptions.length) return;
    if (!selectedRegion || !regionOptions.some((value) => normalize(value) === normalize(selectedRegion))) {
      setSelectedRegion(regionOptions[0]);
      setSelectedCompany("");
    }
  }, [regionOptions.join("|"), selectedRegion]);

  useEffect(() => {
    if (!companyOptions.length) return;
    if (!selectedCompany || !companyOptions.some((value) => normalize(value) === normalize(selectedCompany))) {
      setSelectedCompany(companyOptions[0]);
    }
  }, [companyOptions.join("|"), selectedCompany]);

  useEffect(() => {
    if (selectedDate < dateRange.start || selectedDate > dateRange.end) {
      setSelectedDate(dateRange.start);
    }
  }, [dateRange.start, dateRange.end, selectedDate]);

  useEffect(() => {
    const requestVersion = ++dataRequestVersion.current;
    let cancelled = false;
    setNotice("正在从 MongoDB 读取考勤数据…");

    fetchAllAttendanceRecords()
      .then((records) => {
        if (cancelled || requestVersion !== dataRequestVersion.current) return;
        if (!records.length) {
          setNotice("MongoDB 已连接，目前还没有保存的考勤数据");
          return;
        }

        const databaseRows = dedupeRows(records.map(databaseRecordToRow));
        const availableSources = new Set(databaseRows.map((row) => row["数据来源"] === "paper" ? "paper" : "machine"));
        const nextSource = availableSources.has("machine") ? "machine" : "paper";
        const sourceRows = databaseRows.filter((row) => (row["数据来源"] === "paper" ? "paper" : "machine") === nextSource);
        const maxTimeColumns = databaseRows.reduce((maximum, row) => Math.max(
          maximum,
          Object.keys(row).filter((column) => /^打卡时间\d+$/.test(column)).length
        ), 0);
        const mergedColumns = [
          ...CANONICAL_BASE_COLUMNS,
          ...Array.from({ length: maxTimeColumns }, (_, index) => `打卡时间${index + 1}`),
        ];
        const databaseColumns = guessColumns(mergedColumns, sourceRows);
        const databaseSite = inferSiteName(sourceRows, databaseColumns);
        const databaseCompany = inferCompanyName(sourceRows, databaseColumns);
        const nextRegions = getRegionOptions(sourceRows, databaseColumns, databaseSite);
        const nextRegion = nextRegions[0] || databaseSite;
        const nextCompanies = getCompanyOptions(sourceRows, databaseColumns, databaseCompany, nextRegion);
        const nextDateRange = inferDateRange(sourceRows, databaseColumns);

        setRows(databaseRows);
        setColumns(mergedColumns);
        setSelectedDataSource(nextSource);
        setSelectedRegion(nextRegion);
        setSelectedCompany(nextCompanies[0] || databaseCompany);
        setSelectedShift("all");
        setAnalysisMode("region");
        setMode("day");
        setSelectedDate(nextDateRange.end);
        setFileName(`MongoDB · ${databaseRows.length} 条记录`);
        setNotice(`已从 MongoDB 加载 ${databaseRows.length} 条考勤记录，当前显示${nextSource === "paper" ? "纸质表" : "打卡机"}数据 ${nextDateRange.end}`);
      })
      .catch((error) => {
        if (cancelled || requestVersion !== dataRequestVersion.current) return;
        setNotice(`无法从 MongoDB 读取数据：${error.message}`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFile(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    dataRequestVersion.current += 1;
    setNotice("");
    try {
      const imports = [];
      let maxTimeColumns = 0;
      for (const file of files) {
        const data = await file.arrayBuffer();
        const workbook = readWorkbookFile(file, data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const imported = readSheet(sheet);
        if (imported.rows.length) {
          const fileColumns = guessColumns(imported.columns, imported.rows);
          const sourceType = detectDataSource(imported.columns, imported.rows);
          maxTimeColumns = Math.max(maxTimeColumns, fileColumns.timeColumns.length || 0);
          imports.push({
            file,
            sourceType,
            ...imported,
            rows: normalizeImportedRows(imported.rows, fileColumns, sourceType),
          });
        }
      }

      const importedRows = imports.flatMap((item) => item.rows);
      if (!importedRows.length) throw new Error("表格第一张 sheet 没有可读取的数据");
      const parsed = dedupeRows(importedRows);
      const combinedRows = dedupeRows([...rows, ...parsed]);
      maxTimeColumns = Math.max(maxTimeColumns, combinedRows.reduce((maximum, row) => Math.max(
        maximum,
        Object.keys(row).filter((column) => /^打卡时间\d+$/.test(column)).length
      ), 0));
      const importedSources = [...new Set(imports.map((item) => item.sourceType))];
      const nextSource = importedSources.length === 1 ? importedSources[0] : importedSources[0] || "machine";
      const sourceRows = parsed.filter((row) => (row["数据来源"] === "paper" ? "paper" : "machine") === nextSource);
      const mergedColumns = [
        ...CANONICAL_BASE_COLUMNS,
        ...Array.from({ length: maxTimeColumns }, (_, index) => `打卡时间${index + 1}`),
      ];
      const importedColumns = guessColumns(mergedColumns, sourceRows);
      const importedSite = inferSiteName(sourceRows, importedColumns);
      const importedCompany = inferCompanyName(sourceRows, importedColumns);
      const nextRegions = getRegionOptions(sourceRows, importedColumns, importedSite);
      const nextRegion = nextRegions[0] || importedSite;
      const nextCompanies = getCompanyOptions(sourceRows, importedColumns, importedCompany, nextRegion);
      setRows(combinedRows);
      setColumns(mergedColumns);
      setSelectedDataSource(nextSource);
      setSelectedRegion(nextRegion);
      setSelectedCompany(nextCompanies[0] || importedCompany);
      setSelectedShift("all");
      setAnalysisMode("region");
      const nextFileNames = [...new Set(files.map((file) => file.name))];
      setFileName(nextFileNames.length === 1 ? nextFileNames[0] : `${nextFileNames.length} 个文件`);
      event.target.value = "";
      try {
        const saved = await saveAttendanceImport(nextFileNames, parsed);
        setNotice(saved.duplicate
          ? `数据库中已有相同数据，共 ${saved.recordCount} 条，未重复保存`
          : `已保存到 MongoDB，共 ${saved.recordCount} 条考勤记录`);
      } catch (saveError) {
        setNotice(`报表已在页面中打开，但没有保存到 MongoDB：${saveError.message}`);
      }
    } catch (error) {
      setNotice(error.message || "文件解析失败，请确认是 .xlsx、.xls 或 .csv 文件");
    }
  }

  async function handleDelete(scope) {
    const sourceLabel = selectedDataSource === "paper" ? "纸质表数据" : "打卡机数据";
    const scopeLabel = scope.scope === "region"
      ? `${formatRegionName(scope.region)} 地区`
      : scope.scope === "company"
        ? `${formatRegionName(scope.region)} 地区的 ${scope.company} 劳务公司`
        : `${formatRegionName(scope.region)} 地区、${scope.company} 劳务公司的 ${scope.personName}`;
    const detail = scope.scope === "region"
      ? "该地区全部劳务公司、全部人员和全部日期"
      : scope.scope === "company"
        ? "该劳务公司的全部人员和全部日期"
        : "该人员的全部日期";
    if (!window.confirm(`确定永久删除${sourceLabel}中的【${scopeLabel}】吗？\n\n将删除${detail}的考勤记录，此操作无法撤销。`)) return;

    const deleteKey = [scope.scope, scope.region, scope.company || "", scope.personName || ""].join(":");
    setDeletingKey(deleteKey);
    try {
      const result = await deleteAttendanceRecords({ ...scope, sourceType: selectedDataSource });
      const remainingRows = rows.filter((row) => !matchesDeleteScope(row, { ...scope, sourceType: selectedDataSource }));
      const currentSourceHasRows = remainingRows.some((row) => getRowSourceType(row) === selectedDataSource);
      const otherSource = selectedDataSource === "machine" ? "paper" : "machine";
      const otherSourceHasRows = remainingRows.some((row) => getRowSourceType(row) === otherSource);

      setRows(remainingRows);
      setFileName(remainingRows.length ? `MongoDB · ${remainingRows.length} 条记录` : "MongoDB · 0 条记录");
      setSelectedRegion("");
      setSelectedCompany("");
      setSelectedShift("all");
      if (!currentSourceHasRows && otherSourceHasRows) setSelectedDataSource(otherSource);
      setNotice(result.deletedCount
        ? `已永久删除${scopeLabel}的 ${result.deletedCount} 条${sourceLabel}`
        : `数据库中没有找到${scopeLabel}的可删除记录`);
    } catch (error) {
      setNotice(`删除失败：${error.message}`);
    } finally {
      setDeletingKey("");
    }
  }

  function clearData() {
    dataRequestVersion.current += 1;
    setRows([]);
    setColumns([]);
    setFileName("未上传文件");
    setNotice("");
    setSelectedRegion("");
    setSelectedCompany("");
    setSelectedShift("all");
    setSelectedDataSource("machine");
    setAnalysisMode("region");
    setMode("week");
    setSelectedDate(DEFAULT_START);
  }

  return React.createElement(
    "main",
    { className: "app" },
    React.createElement(
      "header",
      { className: "topbar" },
      React.createElement(
        "div",
        { className: "brandBlock" },
        React.createElement("div", { className: "brandMark", "aria-hidden": "true" }, "YW"),
        React.createElement(
          "div",
          { className: "title" },
          React.createElement("span", { className: "eyebrow" }, "WORKFORCE ANALYTICS"),
          React.createElement("h1", null, "YW Workforce Insights")
        )
      ),
      hasRows ? React.createElement(
        "div",
        { className: "currentScope" },
        React.createElement("span", null, "当前视图"),
        React.createElement("strong", null, currentScopeLabel),
        React.createElement("small", null, `${activeRange.start} 至 ${activeRange.end}`)
      ) : null
    ),
    React.createElement(
      "section",
      { className: "controlBar" },
      React.createElement(
        "div",
        { className: "uploadArea" },
        React.createElement("span", { className: "stepLabel" }, "01 · 数据文件"),
        React.createElement(
          "div",
          { className: "uploadRow" },
          React.createElement(
            "label",
            { className: "uploadControl" },
            React.createElement(
              "span",
              { className: "fileButton" },
              React.createElement("span", { "aria-hidden": "true" }, "+"),
              "选择考勤表",
              React.createElement("input", {
                type: "file",
                accept: ".xlsx,.xls,.csv",
                multiple: true,
                onChange: handleFile,
              })
            ),
            React.createElement(
              "span",
              { className: "fileMeta" },
              React.createElement("strong", { className: "fileName" }, fileName),
              React.createElement("small", null, "支持 Excel / CSV，可一次选择多个文件")
            )
          ),
          hasStoredRows ? React.createElement(
            "button",
            {
              type: "button",
              className: "clearButton",
              onClick: clearData,
            },
            "清空"
          ) : null
        ),
        hasStoredRows ? React.createElement(
          "div",
          { className: "sourceSelector", role: "group", "aria-label": "选择数据来源" },
          React.createElement("span", null, "数据来源"),
          React.createElement(
            "div",
            { className: "segmented sourceSegmented" },
            React.createElement("button", {
              type: "button",
              className: selectedDataSource === "machine" ? "active" : "",
              disabled: sourceCounts.machine === 0,
              onClick: () => {
                setSelectedDataSource("machine");
                setSelectedRegion("");
                setSelectedCompany("");
                setNotice(`当前显示打卡机数据，共 ${sourceCounts.machine} 条；休息时长显示为 -`);
              },
            }, `打卡机数据 ${sourceCounts.machine}`),
            React.createElement("button", {
              type: "button",
              className: selectedDataSource === "paper" ? "active" : "",
              disabled: sourceCounts.paper === 0,
              onClick: () => {
                setSelectedDataSource("paper");
                setSelectedRegion("");
                setSelectedCompany("");
                setNotice(`当前显示纸质表数据，共 ${sourceCounts.paper} 条；休息时长为两段休息之和`);
              },
            }, `纸质表数据 ${sourceCounts.paper}`),
          )
        ) : null,
      )
    ),
    notice ? React.createElement("div", { className: "notice" }, notice) : null,
    !canAnalyze && hasRows
      ? React.createElement(
          "section",
          { className: "panel empty" },
          React.createElement(
            "div",
            null,
            React.createElement("span", { className: "emptyIcon", "aria-hidden": "true" }, "↥"),
            React.createElement("h2", null, "没有匹配到可统计记录"),
            React.createElement(
              "p",
              null,
              "请确认表格中包含姓名、日期和打卡时间。"
            )
          )
        )
      : canAnalyze ? React.createElement(Dashboard, {
          analysis,
          siteName: activeRegion,
          companyName: activeCompany,
          analysisMode,
          setAnalysisMode,
          regionOptions,
          companyOptions,
          selectedRegion: activeRegion,
          setSelectedRegion,
          selectedCompany: activeCompany,
          setSelectedCompany,
          selectedShift,
          setSelectedShift,
          mode,
          setMode,
          selectedDate,
          setSelectedDate,
          dateRange,
          activeRange,
          comparison,
          fullReport,
          deletingKey,
          onDeleteRegion: (region) => handleDelete({ scope: "region", region }),
          onDeleteCompany: (company) => handleDelete({ scope: "company", region: activeRegion, company }),
          onDeletePerson: (personName) => handleDelete({ scope: "person", region: activeRegion, company: activeCompany, personName }),
        }) : null
  );
}

function normalizeImportedRows(rows, columns, sourceType = "machine") {
  return rows.map((row) => {
    const rowSourceType = columns.dataSource
      ? normalizeSourceValue(row[columns.dataSource]) || sourceType
      : sourceType;
    const hasPunchSequence = rowSourceType === "machine" && (columns.timeColumns || []).length >= 2;
    const timesheetCandidates = getTimesheetCandidates(row, columns);
    const timesheetText = clean(columns.timesheet ? row[columns.timesheet] : "") || timesheetCandidates[0] || "";
    const detectedTimesheetParts = getRowTimesheetParts(row, columns);
    const parsedTimesheetParts = parseTimesheetParts(timesheetText);
    const timesheetParts = {
      region: detectedTimesheetParts.region || parsedTimesheetParts.region,
      company: detectedTimesheetParts.company || parsedTimesheetParts.company,
      shift: detectedTimesheetParts.shift || parsedTimesheetParts.shift,
    };
    const normalized = {
      "数据来源": rowSourceType,
      "人员姓名": columns.person ? row[columns.person] : "",
      "人员ID": columns.personId ? row[columns.personId] : "",
      "日期": columns.date ? row[columns.date] : "",
      "时间表": timesheetText,
      "地区": timesheetParts.region || (columns.region ? row[columns.region] : ""),
      "劳务公司": timesheetParts.company || (columns.company ? row[columns.company] : ""),
      "班次": timesheetParts.shift,
      "Clock In": !hasPunchSequence && columns.clockIn ? row[columns.clockIn] : "",
      "Clock Out": !hasPunchSequence && columns.clockOut ? row[columns.clockOut] : "",
      "Break Out 1": columns.paperBreakOut1 ? row[columns.paperBreakOut1] : "",
      "Break In 1": columns.paperBreakIn1 ? row[columns.paperBreakIn1] : "",
      "Break Out 2": columns.paperBreakOut2 ? row[columns.paperBreakOut2] : "",
      "Break In 2": columns.paperBreakIn2 ? row[columns.paperBreakIn2] : "",
      "总休息时长": rowSourceType === "machine" && columns.breakTime ? row[columns.breakTime] : "",
      "总时长": columns.totalDuration ? row[columns.totalDuration] : "",
      "考勤记录": rowSourceType === "machine" && columns.time ? row[columns.time] : "",
    };
    if (rowSourceType === "machine") {
      (columns.timeColumns || []).forEach((column, index) => {
        normalized[`打卡时间${index + 1}`] = row[column];
      });
    }
    return normalized;
  });
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const timeColumns = Object.keys(row).filter((column) => /^打卡时间\d+$/.test(column)).sort();
    const key = [...CANONICAL_BASE_COLUMNS, ...timeColumns]
      .map((column) => clean(row[column]))
      .join("\u001f");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getRowSourceType(row) {
  return row["数据来源"] === "paper" ? "paper" : "machine";
}

function matchesDeleteScope(row, scope) {
  if (getRowSourceType(row) !== scope.sourceType) return false;
  if (clean(row["地区"]) !== clean(scope.region)) return false;
  if (scope.scope !== "region" && clean(row["劳务公司"]) !== clean(scope.company)) return false;
  if (scope.scope === "person" && clean(row["人员姓名"]) !== clean(scope.personName)) return false;
  return true;
}

function buildComparison(rows, columns, config) {
  if (!config.canAnalyze) return { regions: [], companies: [] };

  const summarize = (label, filters) => {
    const result = analyzeRows(rows, columns, filters, config.startDate, config.endDate);
    return {
      label,
      totalWork: result.totalWork,
      totalOvertime: result.totalOvertime,
      peopleCount: result.people.length,
      dayCount: result.dayCount || 0,
    };
  };

  return {
    regions: config.regions.map((region) => ({ ...summarize(formatRegionName(region), {
      region,
      company: "",
      shift: config.selectedShift,
      fallbackRegion: config.fallbackRegion,
      fallbackCompany: "",
      sourceType: config.sourceType,
    }), value: region })),
    companies: config.companies.map((company) => ({ ...summarize(company, {
      region: config.selectedRegion,
      company,
      shift: config.selectedShift,
      fallbackRegion: config.fallbackRegion,
      fallbackCompany: config.fallbackCompany,
      sourceType: config.sourceType,
    }), value: company })),
  };
}
