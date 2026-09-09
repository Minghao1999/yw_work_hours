import { DEFAULT_START, sampleRows } from './config.js';
import { analyzeRows } from './analysis.js';
import { Dashboard } from './components.js';
import { formatRegionName, formatShiftFilter, normalize } from './utils.js';
import { guessColumns, inferSiteName, inferCompanyName, getRegionOptions, getCompanyOptions, inferDateRange, readWorkbookFile, readSheet } from './parser.js';

const { useEffect, useMemo, useState } = React;

export function App() {
  const [rows, setRows] = useState(sampleRows);
  const [columns, setColumns] = useState(sampleRows[0] ? Object.keys(sampleRows[0]) : []);
  const [fileName, setFileName] = useState("未上传文件");
  const [notice, setNotice] = useState("");
  const [importInfo, setImportInfo] = useState("");
  const [mode, setMode] = useState("week");
  const [selectedDate, setSelectedDate] = useState(DEFAULT_START);
  const [selectedShift, setSelectedShift] = useState("all");

  const guessed = useMemo(() => guessColumns(columns, rows), [columns, rows]);
  const siteName = useMemo(() => inferSiteName(rows, guessed), [rows, guessed.personId]);
  const companyName = useMemo(() => inferCompanyName(rows, guessed), [rows, guessed.company]);
  const regionOptions = useMemo(() => getRegionOptions(rows, guessed, siteName), [rows, guessed.region, guessed.personId, siteName]);
  const companyOptions = useMemo(() => getCompanyOptions(rows, guessed, companyName), [rows, guessed.company, companyName]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const dateRange = useMemo(() => inferDateRange(rows, guessed), [rows, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut]);
  const activeRange = mode === "day"
    ? { start: selectedDate, end: selectedDate }
    : dateRange;
  const activeRegion = selectedRegion || regionOptions[0] || siteName;
  const activeCompany = selectedCompany || companyOptions[0] || companyName;
  const hasRows = rows.length > 0;

  const analysis = useMemo(
    () => analyzeRows(rows, guessed, {
      region: activeRegion,
      company: activeCompany,
      shift: selectedShift,
      fallbackRegion: siteName,
      fallbackCompany: companyName,
    }, activeRange.start, activeRange.end),
    [rows, guessed.person, guessed.region, guessed.company, guessed.personId, guessed.date, guessed.time, guessed.timeColumns.join("|"), guessed.clockIn, guessed.clockOut, guessed.breakTime, guessed.timesheet, activeRegion, activeCompany, selectedShift, siteName, companyName, activeRange.start, activeRange.end]
  );

  useEffect(() => {
    if (!regionOptions.length) return;
    if (!selectedRegion || !regionOptions.some((value) => normalize(value) === normalize(selectedRegion))) {
      setSelectedRegion(regionOptions[0]);
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
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setNotice("");
    try {
      const data = await file.arrayBuffer();
      const workbook = readWorkbookFile(file, data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const imported = readSheet(sheet);
      const parsed = imported.rows;
      if (!parsed.length) throw new Error("表格第一张 sheet 没有可读取的数据");
      const importedColumns = guessColumns(imported.columns, parsed);
      const importedSite = inferSiteName(parsed, importedColumns);
      const importedCompany = inferCompanyName(parsed, importedColumns);
      setRows(parsed);
      setColumns(imported.columns);
      setSelectedRegion(getRegionOptions(parsed, importedColumns, importedSite)[0] || importedSite);
      setSelectedCompany(getCompanyOptions(parsed, importedColumns, importedCompany)[0] || importedCompany);
      setSelectedShift("all");
      setFileName(file.name);
      setImportInfo(imported.info);
    } catch (error) {
      setNotice(error.message || "文件解析失败，请确认是 .xlsx、.xls 或 .csv 文件");
    }
  }

  const canAnalyze = Boolean(guessed.person && ((guessed.clockIn && guessed.clockOut) || guessed.time || guessed.timeColumns.length));

  return React.createElement(
    "main",
    { className: "app" },
    React.createElement(
      "header",
      { className: "topbar" },
      React.createElement(
        "div",
        { className: "title" },
            React.createElement("h1", null, hasRows && activeRegion ? `${formatRegionName(activeRegion)} 考勤工时 Dashboard` : "考勤工时 Dashboard"),
        React.createElement("p", null, "按上传表日期统计，每天超过 8 小时的部分计入加班。")
      ),
      React.createElement(
        "div",
        { className: "upload" },
        React.createElement(
          "label",
          { className: "fileButton" },
          "上传考勤表",
          React.createElement("input", {
            type: "file",
            accept: ".xlsx,.xls,.csv",
            onChange: handleFile,
          })
        ),
        React.createElement("span", { className: "fileName" }, fileName)
      )
    ),
    notice ? React.createElement("div", { className: "notice" }, notice) : null,
    hasRows ? React.createElement("div", { className: "autoStatus" }, importInfo, `。统计范围：${formatRegionName(activeRegion)} / ${activeRange.start} 至 ${activeRange.end}。劳务公司：${activeCompany}。班次：${formatShiftFilter(selectedShift)}。`) : null,
    !canAnalyze
      ? React.createElement(
          "section",
          { className: "panel empty" },
          React.createElement(
            "div",
            null,
            React.createElement("h2", null, hasRows ? "没有匹配到可统计记录" : "请上传考勤表"),
            React.createElement(
              "p",
              null,
              hasRows
                ? "请重新上传考勤表。我会自动扫描表头和列内容，支持完整时间戳、同一格里的开始/结束时间，以及分开的上班/下班打卡时间列。"
                : "上传后会自动识别地区、劳务公司、班次、上下班时间和休息时间，并生成工时统计。"
            )
          )
        )
      : React.createElement(Dashboard, {
          analysis,
          siteName: activeRegion,
          companyName: activeCompany,
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
        })
  );
}
