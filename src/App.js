import { DEFAULT_START, sampleRows } from './config.js?v=20260909-21';
import { analyzeRows } from './analysis.js?v=20260909-21';
import { Dashboard } from './components.js?v=20260909-21';
import { clean, formatRegionName, normalize, parseTimesheetParts } from './utils.js?v=20260909-21';
import { guessColumns, inferSiteName, inferCompanyName, getRegionOptions, getCompanyOptions, inferDateRange, readWorkbookFile, readSheet, getRowTimesheetParts, getTimesheetCandidates } from './parser.js?v=20260909-21';

const { useEffect, useMemo, useState } = React;
const CANONICAL_BASE_COLUMNS = ["人员姓名", "人员ID", "日期", "时间表", "地区", "劳务公司", "班次", "Clock In", "Clock Out", "总休息时长", "考勤记录"];

export function App() {
  const [rows, setRows] = useState(sampleRows);
  const [columns, setColumns] = useState(sampleRows[0] ? Object.keys(sampleRows[0]) : []);
  const [fileName, setFileName] = useState("未上传文件");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("week");
  const [selectedDate, setSelectedDate] = useState(DEFAULT_START);
  const [selectedShift, setSelectedShift] = useState("all");
  const [analysisMode, setAnalysisMode] = useState("region");

  const guessed = useMemo(() => guessColumns(columns, rows), [columns, rows]);
  const siteName = useMemo(() => inferSiteName(rows, guessed), [rows, guessed.personId, guessed.timesheet]);
  const companyName = useMemo(() => inferCompanyName(rows, guessed), [rows, guessed.company, guessed.timesheet]);
  const regionOptions = useMemo(() => getRegionOptions(rows, guessed, siteName), [rows, guessed.region, guessed.personId, guessed.timesheet, siteName]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const activeRegion = selectedRegion || regionOptions[0] || siteName;
  const companyOptions = useMemo(() => getCompanyOptions(rows, guessed, companyName, activeRegion), [rows, guessed.region, guessed.company, guessed.personId, guessed.timesheet, companyName, activeRegion]);
  const dateRange = useMemo(() => inferDateRange(rows, guessed), [rows, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut]);
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
  const hasRows = rows.length > 0;
  const canAnalyze = Boolean(guessed.person && ((guessed.clockIn && guessed.clockOut) || guessed.time || guessed.timeColumns.length));

  const analysis = useMemo(
    () => analyzeRows(rows, guessed, {
      region: activeRegion,
      company: activeCompany,
      shift: effectiveShift,
      fallbackRegion: siteName,
      fallbackCompany: companyName,
    }, activeRange.start, activeRange.end),
    [rows, guessed.person, guessed.region, guessed.company, guessed.personId, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut, guessed.breakTime, guessed.timesheet, activeRegion, activeCompany, effectiveShift, siteName, companyName, activeRange.start, activeRange.end]
  );

  const comparison = useMemo(
    () => buildComparison(rows, guessed, {
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
    }),
    [rows, guessed.person, guessed.region, guessed.company, guessed.personId, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut, guessed.breakTime, guessed.timesheet, regionOptions.join("|"), companyOptions.join("|"), activeRegion, activeCompany, effectiveShift, siteName, companyName, activeRange.start, activeRange.end, canAnalyze]
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

  async function handleFile(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
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
          maxTimeColumns = Math.max(maxTimeColumns, fileColumns.timeColumns.length || 0);
          imports.push({
            file,
            ...imported,
            rows: normalizeImportedRows(imported.rows, fileColumns),
          });
        }
      }

      const importedRows = imports.flatMap((item) => item.rows);
      if (!importedRows.length) throw new Error("表格第一张 sheet 没有可读取的数据");
      const parsed = dedupeRows(importedRows);
      const mergedColumns = [
        ...CANONICAL_BASE_COLUMNS,
        ...Array.from({ length: maxTimeColumns }, (_, index) => `打卡时间${index + 1}`),
      ];
      const importedColumns = guessColumns(mergedColumns, parsed);
      const importedSite = inferSiteName(parsed, importedColumns);
      const importedCompany = inferCompanyName(parsed, importedColumns);
      const nextRegions = getRegionOptions(parsed, importedColumns, importedSite);
      const nextRegion = nextRegions[0] || importedSite;
      const nextCompanies = getCompanyOptions(parsed, importedColumns, importedCompany, nextRegion);
      setRows(parsed);
      setColumns(mergedColumns);
      setSelectedRegion(nextRegion);
      setSelectedCompany(nextCompanies[0] || importedCompany);
      setSelectedShift("all");
      setAnalysisMode("region");
      const nextFileNames = [...new Set(files.map((file) => file.name))];
      setFileName(nextFileNames.length === 1 ? nextFileNames[0] : `${nextFileNames.length} 个文件`);
      event.target.value = "";
    } catch (error) {
      setNotice(error.message || "文件解析失败，请确认是 .xlsx、.xls 或 .csv 文件");
    }
  }

  function clearData() {
    setRows([]);
    setColumns([]);
    setFileName("未上传文件");
    setNotice("");
    setSelectedRegion("");
    setSelectedCompany("");
    setSelectedShift("all");
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
          hasRows ? React.createElement(
            "button",
            {
              type: "button",
              className: "clearButton",
              onClick: clearData,
            },
            "清空"
          ) : null
        ),
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
        }) : null
  );
}

function normalizeImportedRows(rows, columns) {
  return rows.map((row) => {
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
      "人员姓名": columns.person ? row[columns.person] : "",
      "人员ID": columns.personId ? row[columns.personId] : "",
      "日期": columns.date ? row[columns.date] : "",
      "时间表": timesheetText,
      "地区": timesheetParts.region || (columns.region ? row[columns.region] : ""),
      "劳务公司": timesheetParts.company || (columns.company ? row[columns.company] : ""),
      "班次": timesheetParts.shift,
      "Clock In": columns.clockIn ? row[columns.clockIn] : "",
      "Clock Out": columns.clockOut ? row[columns.clockOut] : "",
      "总休息时长": columns.breakTime ? row[columns.breakTime] : "",
      "考勤记录": columns.time ? row[columns.time] : "",
    };
    (columns.timeColumns || []).forEach((column, index) => {
      normalized[`打卡时间${index + 1}`] = row[column];
    });
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
    regions: config.regions.map((region) => summarize(formatRegionName(region), {
      region,
      company: "",
      shift: config.selectedShift,
      fallbackRegion: config.fallbackRegion,
      fallbackCompany: "",
    })),
    companies: config.companies.map((company) => summarize(company, {
      region: config.selectedRegion,
      company,
      shift: config.selectedShift,
      fallbackRegion: config.fallbackRegion,
      fallbackCompany: config.fallbackCompany,
    })),
  };
}
