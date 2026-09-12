import { formatDuration, formatRegionName } from './utils.js?v=20260911-46';
import { buildFullReportFileName, downloadFullReportWorkbook } from './export.js?v=20260911-46';

const { useEffect, useRef, useState } = React;

export function Dashboard({ analysis, siteName, companyName, analysisMode, setAnalysisMode, regionOptions, companyOptions, selectedRegion, setSelectedRegion, selectedCompany, setSelectedCompany, selectedShift, setSelectedShift, selectedStartDate, setSelectedStartDate, selectedEndDate, setSelectedEndDate, dateRange, activeRange, comparison, fullReport, deletingKey, onDeleteRegion, onDeleteCompany, onDeletePerson }) {
  const isDay = activeRange.start === activeRange.end;
  const downloadFileName = buildFullReportFileName(activeRange.start, activeRange.end);
  const handleFullReportDownload = () => downloadFullReportWorkbook(fullReport, downloadFileName);
  const canDownload = Boolean(fullReport && fullReport.regionSummaries && fullReport.regionSummaries.length);
  const personView = React.createElement(
    React.Fragment,
    null,
    React.createElement(
          "div",
          { className: "panel section" },
          React.createElement(
            "div",
            { className: "sectionHead" },
            React.createElement(
              "div",
              null,
              React.createElement("h2", null, isDay ? `${activeRange.start} 人员工时明细` : "员工工时明细"),
              React.createElement("p", null, `共 ${analysis.people.length} 人，按工作时长从高到低排列`)
            ),
            React.createElement(
              "div",
              { className: "sectionActions" },
              React.createElement(
                "div",
                { className: "legend" },
                React.createElement("span", null, React.createElement("i", { className: "barWork" }), "工作时长"),
                React.createElement("span", null, React.createElement("i", { className: "barOvertime" }), "加班时长")
              ),
              React.createElement(DownloadButton, { onClick: handleFullReportDownload, disabled: !canDownload })
            )
          ),
          React.createElement(AdaptiveWorkTable, {
            data: analysis.people,
            selectedShift,
            setSelectedShift,
            deletingKey,
            onDeletePerson,
            region: siteName,
            company: companyName,
          })
    )
  );

  const comparisonView = analysisMode === "region"
    ? React.createElement(ComparisonCard, {
        title: "地区工时对比",
        subtitle: "汇总各地区全部劳务公司的数据",
        rows: comparison.regions,
        onDownload: handleFullReportDownload,
        onDelete: (row) => onDeleteRegion(row.value),
        deletingKey,
        getDeleteKey: (row) => ["region", row.value, "", ""].join(":"),
      })
    : React.createElement(ComparisonCard, {
        title: `${formatRegionName(siteName)} 劳务公司对比`,
        subtitle: "同一地区内按劳务公司汇总",
        rows: comparison.companies,
        onDownload: handleFullReportDownload,
        onDelete: (row) => onDeleteCompany(row.value),
        deletingKey,
        getDeleteKey: (row) => ["company", siteName, row.value, ""].join(":"),
      });

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "section",
      { className: "analysisModePanel", "aria-label": "选择分析方式与筛选范围" },
      React.createElement(
        "div",
        { className: "analysisChoice" },
        React.createElement("span", { className: "stepLabel" }, "02 · 选择分析方式"),
        React.createElement(AnalysisModeNav, { value: analysisMode, onChange: setAnalysisMode, siteName, companyName })
      ),
      React.createElement(ViewControls, {
        regionOptions,
        companyOptions,
        selectedRegion,
        setSelectedRegion,
        selectedCompany,
        setSelectedCompany,
        analysisMode,
        selectedStartDate,
        setSelectedStartDate,
        selectedEndDate,
        setSelectedEndDate,
        dateRange,
      })
    ),
    React.createElement(
      "section",
      { className: "analysisResult", role: "tabpanel" },
      analysisMode === "person" ? personView : comparisonView
    )
  );
}

export function AnalysisModeNav({ value, onChange, siteName, companyName }) {
  const options = [
    { value: "region", number: "01", label: "地区对比", description: "查看各地区整体工时与加班" },
    { value: "company", number: "02", label: "劳务公司对比", description: `比较 ${formatRegionName(siteName)} 下的劳务公司` },
    { value: "person", number: "03", label: "人员对比", description: `查看 ${companyName || "当前劳务公司"} 的员工明细` },
  ];
  return React.createElement(
    "div",
    { className: "analysisModes", role: "tablist", "aria-label": "选择分析方式" },
    options.map((option) => React.createElement(
      "button",
      {
        key: option.value,
        type: "button",
        role: "tab",
        "aria-selected": value === option.value,
        className: value === option.value ? "analysisMode active" : "analysisMode",
        onClick: () => onChange(option.value),
      },
      React.createElement("span", { className: "modeNumber", "aria-hidden": "true" }, option.number),
      React.createElement(
        "span",
        { className: "modeCopy" },
        React.createElement("strong", null, option.label),
        React.createElement("small", null, option.description)
      ),
      React.createElement("span", { className: "modeArrow", "aria-hidden": "true" }, "→")
    ))
  );
}

export function ComparisonSection({ comparison, siteName, companyName }) {
  return React.createElement(
    "section",
    { className: "comparisonGrid" },
    React.createElement(ComparisonCard, {
      title: "地区对比",
      subtitle: `当前劳务公司：${companyName || "未识别劳务公司"}`,
      rows: comparison.regions,
    }),
    React.createElement(ComparisonCard, {
      title: "劳务公司对比",
      subtitle: `当前地区：${formatRegionName(siteName)}`,
      rows: comparison.companies,
    })
  );
}

export function ComparisonCard({ title, subtitle, rows, onDownload, onDelete, deletingKey = "", getDeleteKey }) {
  const maxWork = Math.max(1, ...rows.map((row) => row.totalWork));
  return React.createElement(
    "div",
    { className: "panel comparisonCard" },
    React.createElement(
      "div",
      { className: "comparisonHead" },
      React.createElement("h2", null, title),
        React.createElement(
          "div",
          { className: "comparisonHeadAside" },
          React.createElement("span", null, subtitle),
        React.createElement(
          "div",
          { className: "comparisonLegend", "aria-label": "工时颜色说明" },
          React.createElement("span", null, React.createElement("i", { className: "comparisonLegendWork" }), "正常工时"),
          React.createElement("span", null, React.createElement("i", { className: "comparisonLegendOvertime" }), "加班")
          ),
          onDownload ? React.createElement(DownloadButton, { onClick: onDownload, disabled: !rows.length }) : null
        )
    ),
    React.createElement(
      "div",
      { className: "comparisonRows" },
      rows.length ? rows.map((row) => {
        const overtime = Math.max(0, Math.min(row.totalOvertime, row.totalWork));
        const regular = Math.max(0, row.totalWork - overtime);
        const regularRate = row.totalWork ? (regular / row.totalWork) * 100 : 0;
        const overtimeRate = row.totalWork ? (overtime / row.totalWork) * 100 : 0;
        return React.createElement(
          "div",
          { className: "comparisonRow", key: row.label },
          React.createElement("div", { className: "comparisonName" }, row.label),
          React.createElement(
            "div",
            { className: "comparisonBarTrack", "aria-label": `${row.label}：正常工时 ${formatDuration(regular)}，加班 ${formatDuration(overtime)}` },
            React.createElement(
              "div",
              { className: "comparisonBarTotal", style: { width: `${Math.max(0, (row.totalWork / maxWork) * 100)}%` } },
              React.createElement("div", { className: "comparisonBarRegular", style: { width: `${regularRate}%` } }),
              React.createElement("div", { className: "comparisonBarOvertime", style: { width: `${overtimeRate}%` } })
            )
          ),
          React.createElement(
            "div",
            { className: "comparisonNumbers" },
            React.createElement("strong", null, formatDuration(row.totalWork)),
            React.createElement("span", null, `加班 ${formatDuration(row.totalOvertime)} / ${row.peopleCount}人 / ${row.dayCount}天`)
          ),
          onDelete ? React.createElement(DeleteButton, {
            label: row.label,
            onClick: () => onDelete(row),
            disabled: Boolean(deletingKey),
            busy: deletingKey === getDeleteKey(row),
          }) : null
        );
      }) : React.createElement("div", { className: "emptyCompare" }, "暂无可对比数据")
    )
  );
}

export function DownloadButton({ onClick, disabled }) {
  return React.createElement(
    "button",
    {
      type: "button",
      className: "downloadButton",
      onClick,
      disabled,
    },
    "下载完整报表"
  );
}

export function DeleteButton({ label, onClick, disabled, busy }) {
  return React.createElement(
    "button",
    {
      type: "button",
      className: "deleteButton",
      onClick,
      disabled,
      "aria-label": `删除 ${label} 的全部数据`,
    },
    busy ? "删除中…" : "删除"
  );
}

export function EmptyPanel({ message }) {
  return React.createElement(
    "div",
    { className: "emptyInline" },
    message
  );
}

export function ViewControls({ regionOptions, companyOptions, selectedRegion, setSelectedRegion, selectedCompany, setSelectedCompany, analysisMode, selectedStartDate, setSelectedStartDate, selectedEndDate, setSelectedEndDate, dateRange }) {
  return React.createElement(
    "section",
    { className: "viewControls analysisFilters" },
    React.createElement("span", { className: "filterTitle" }, "筛选范围"),
    React.createElement(
      "div",
      { className: "filterControlRow" },
      React.createElement(
        "div",
        { className: "filterGroup" },
        analysisMode !== "region" ? React.createElement(
          "label",
          { className: "filterField" },
          React.createElement("span", null, "地区"),
          React.createElement(
            "select",
            {
              value: selectedRegion,
              onChange: (event) => {
                setSelectedRegion(event.target.value);
                setSelectedCompany("");
              },
            },
            regionOptions.map((region) => React.createElement("option", { key: region, value: region }, formatRegionName(region)))
          )
        ) : null,
        analysisMode === "person" ? React.createElement(
          "label",
          { className: "filterField" },
          React.createElement("span", null, "劳务公司"),
          React.createElement(
            "select",
            { value: selectedCompany, onChange: (event) => setSelectedCompany(event.target.value) },
            companyOptions.map((company) => React.createElement("option", { key: company, value: company }, company))
          )
        ) : null
      ),
      React.createElement(
        "div",
        { className: "periodControls" },
        React.createElement(DateRangePicker, {
          startDate: selectedStartDate,
          endDate: selectedEndDate,
          onStartDateChange: setSelectedStartDate,
          onEndDateChange: setSelectedEndDate,
          dateRange,
        })
      )
    )
  );
}

export function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange, dateRange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(monthStart(startDate || dateRange.end));
  const pickerRef = useRef(null);
  const dataDates = new Set(dateRange.dates || []);
  const calendarDays = buildCalendarDays(displayMonth);
  const selectedLow = startDate <= endDate ? startDate : endDate;
  const selectedHigh = startDate <= endDate ? endDate : startDate;
  const minimumMonth = monthStart(dateRange.start);
  const maximumMonth = monthStart(dateRange.end);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSelectingEnd(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSelectingEnd(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setDisplayMonth(monthStart(startDate || dateRange.end));
  }, [isOpen, startDate, dateRange.end]);

  const chooseDate = (date) => {
    if (!selectingEnd) {
      onStartDateChange(date);
      onEndDateChange(date);
      setSelectingEnd(true);
      return;
    }
    const rangeStart = date < startDate ? date : startDate;
    const rangeEnd = date < startDate ? startDate : date;
    onStartDateChange(rangeStart);
    onEndDateChange(rangeEnd);
    setSelectingEnd(false);
    setIsOpen(false);
  };

  const chooseAllDates = () => {
    onStartDateChange(dateRange.start);
    onEndDateChange(dateRange.end);
    setSelectingEnd(false);
    setIsOpen(false);
  };

  const monthDate = parseISODate(displayMonth);
  const monthLabel = `${monthDate.getFullYear()}年 ${monthDate.getMonth() + 1}月`;

  return React.createElement(
    "div",
    { className: "dateRangePicker", ref: pickerRef },
    React.createElement(
      "button",
      {
        type: "button",
        className: isOpen ? "dateRangeTrigger open" : "dateRangeTrigger",
        onClick: () => {
          setIsOpen((current) => !current);
          setSelectingEnd(false);
        },
        "aria-haspopup": "dialog",
        "aria-expanded": isOpen,
        "aria-label": `选择日期范围，当前为 ${startDate} 至 ${endDate}`,
      },
      React.createElement("span", { className: "dateRangeValue" }, startDate || "开始日期"),
      React.createElement("span", { className: "dateRangeArrow", "aria-hidden": "true" }, "→"),
      React.createElement("span", { className: "dateRangeValue" }, endDate || "结束日期"),
      React.createElement(
        "svg",
        { className: "calendarIcon", viewBox: "0 0 24 24", "aria-hidden": "true" },
        React.createElement("path", { d: "M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z" })
      )
    ),
    isOpen ? React.createElement(
      "div",
      { className: "dateCalendar", role: "dialog", "aria-label": "选择日期范围" },
      React.createElement(
        "div",
        { className: "calendarHeader" },
        React.createElement("strong", null, monthLabel),
        React.createElement(
          "div",
          { className: "calendarNav" },
          React.createElement("button", {
            type: "button",
            onClick: () => setDisplayMonth(shiftMonth(displayMonth, -1)),
            disabled: displayMonth <= minimumMonth,
            "aria-label": "上个月",
          }, "‹"),
          React.createElement("button", {
            type: "button",
            onClick: () => setDisplayMonth(shiftMonth(displayMonth, 1)),
            disabled: displayMonth >= maximumMonth,
            "aria-label": "下个月",
          }, "›")
        )
      ),
      React.createElement(
        "div",
        { className: "calendarWeekdays", "aria-hidden": "true" },
        ["一", "二", "三", "四", "五", "六", "日"].map((day) => React.createElement("span", { key: day }, day))
      ),
      React.createElement(
        "div",
        { className: "calendarGrid" },
        calendarDays.map(({ date, inMonth }) => {
          const isDisabled = date < dateRange.start || date > dateRange.end;
          const isStart = date === selectedLow;
          const isEnd = date === selectedHigh;
          const isInRange = date >= selectedLow && date <= selectedHigh;
          const classes = [
            "calendarDay",
            inMonth ? "" : "outsideMonth",
            dataDates.has(date) ? "hasData" : "",
            isInRange ? "inRange" : "",
            isStart ? "rangeStart" : "",
            isEnd ? "rangeEnd" : "",
          ].filter(Boolean).join(" ");
          return React.createElement(
            "button",
            {
              type: "button",
              key: date,
              className: classes,
              disabled: isDisabled,
              onClick: () => chooseDate(date),
              "aria-label": `${date}${dataDates.has(date) ? "，有考勤数据" : ""}`,
            },
            React.createElement("span", { className: "calendarDayNumber" }, Number(date.slice(-2)))
          );
        })
      ),
      React.createElement(
        "div",
        { className: "calendarFooter" },
        React.createElement("span", null, selectingEnd ? "请选择结束日期" : "请选择开始日期"),
        React.createElement("button", { type: "button", onClick: chooseAllDates }, "选择全部日期")
      )
    ) : null
  );
}

function parseISODate(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year, Math.max(0, (month || 1) - 1), day || 1);
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(value) {
  const date = parseISODate(value);
  return formatISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function shiftMonth(value, amount) {
  const date = parseISODate(value);
  return formatISODate(new Date(date.getFullYear(), date.getMonth() + amount, 1));
}

function buildCalendarDays(value) {
  const month = parseISODate(value);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    return {
      date: formatISODate(date),
      inMonth: date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear(),
    };
  });
}

export function AdaptiveWorkTable({ data, selectedShift, setSelectedShift, deletingKey = "", onDeletePerson, region, company }) {
  const [tooltip, setTooltip] = useState(null);
  const sorted = [...data].sort((a, b) => b.totalHours - a.totalHours);
  const workMax = 8;

  return React.createElement(
    "div",
    { className: "adaptiveTableWrap", onMouseLeave: () => setTooltip(null) },
    React.createElement(
      "table",
      { className: "adaptiveTable" },
      React.createElement(
        "thead",
        null,
        React.createElement(
          "tr",
          null,
          React.createElement("th", { className: "personHead" }, "姓名"),
          React.createElement(
            "th",
            { className: "shiftHead" },
            React.createElement(
              "label",
              { className: "tableShiftControl" },
              React.createElement("span", null, "班次"),
              React.createElement(
                "select",
                {
                  value: selectedShift,
                  onChange: (event) => setSelectedShift(event.target.value),
                  "aria-label": "筛选班次",
                },
                React.createElement("option", { value: "all" }, "全部"),
                React.createElement("option", { value: "early" }, "早班"),
                React.createElement("option", { value: "mid" }, "午班"),
                React.createElement("option", { value: "late" }, "晚班"),
                React.createElement("option", { value: "unknown" }, "未知")
              )
            )
          ),
          React.createElement("th", { className: "timeHead" }, "上班时间"),
          React.createElement("th", { className: "workHoursHead" }, "工作时长"),
          React.createElement("th", { className: "overtimeHoursHead" }, "加班时长"),
          React.createElement("th", { className: "breakHoursHead" }, "休息时长"),
          React.createElement("th", { className: "num" }, "工作日"),
          React.createElement("th", { className: "num" }, "打卡次数"),
          React.createElement("th", { className: "num" }, "未配对"),
          React.createElement("th", { className: "actionHead" }, "操作")
        )
      ),
      React.createElement(
        "tbody",
        null,
        sorted.length ? sorted.map((item) => React.createElement(
          "tr",
          {
            key: item.person,
            onMouseMove: (event) => setTooltip({ item, x: event.clientX, y: event.clientY }),
            onMouseLeave: () => setTooltip(null),
          },
          React.createElement("td", { className: "personCell" }, item.person),
          React.createElement("td", { className: "shiftCell" }, item.shiftText || "未知"),
          React.createElement("td", { className: "timeCell" }, item.timeText || "-"),
          React.createElement("td", { className: "workHoursCell" }, React.createElement(WorkInlineBar, {
            value: item.totalHours,
            overtimeHours: item.overtimeHours,
            regularMax: workMax * Math.max(1, item.workDays),
          })),
          React.createElement("td", { className: "overtimeHoursCell overtimeNumber" }, formatDuration(item.overtimeHours)),
          React.createElement("td", { className: "breakHoursCell" }, formatBreakDuration(item.breakHours)),
          React.createElement("td", { className: "num" }, item.workDays),
          React.createElement("td", { className: "num" }, item.punchCount || 0),
          React.createElement("td", { className: "num" }, item.unmatchedCount || 0),
          React.createElement(
            "td",
            { className: "actionCell" },
            React.createElement(DeleteButton, {
              label: item.person,
              onClick: () => onDeletePerson(item.person),
              disabled: Boolean(deletingKey),
              busy: deletingKey === ["person", region, company, item.person].join(":"),
            })
          )
        )) : React.createElement(
          "tr",
          null,
          React.createElement("td", { className: "emptyRow", colSpan: 10 }, "没有匹配到该班次的数据")
        )
      )
    ),
    tooltip ? React.createElement(
      "div",
      {
        className: "chartTooltip",
        style: {
          left: tooltip.x + 14,
          top: tooltip.y + 14,
        },
      },
      React.createElement("strong", null, tooltip.item.person),
      React.createElement("span", null, `工作时长：${formatDuration(tooltip.item.totalHours)}`),
      React.createElement("span", null, `加班时长：${formatDuration(tooltip.item.overtimeHours)}`),
      React.createElement("span", null, `休息时长：${formatBreakDuration(tooltip.item.breakHours)}`),
      React.createElement("span", null, `工作日：${tooltip.item.workDays} 天`),
      React.createElement("span", null, `上班时间：${tooltip.item.timeText || "-"}`),
      React.createElement("span", null, `打卡次数：${tooltip.item.punchCount || 0}`),
      React.createElement("span", null, `未配对打卡：${tooltip.item.unmatchedCount || 0}`)
    ) : null
  );
}

function formatBreakDuration(value) {
  return value == null ? "-" : formatDuration(value);
}

export function WorkInlineBar({ value, overtimeHours = 0, regularMax }) {
  const regularHours = Math.max(0, value - overtimeHours);
  const regularWidth = regularMax ? Math.min(100, Math.max(0, (regularHours / regularMax) * 100)) : 0;
  const overtimeWidth = regularMax ? Math.min(80, Math.max(0, (overtimeHours / regularMax) * 100)) : 0;
  return React.createElement(
    "div",
    { className: "inlineBar" },
    React.createElement("span", { className: "barValue" }, formatDuration(value)),
    React.createElement(
      "div",
      { className: "workScale", title: `基础工时 ${formatDuration(regularHours)}，加班 ${formatDuration(overtimeHours)}` },
      React.createElement(
        "div",
        { className: "barTrack workBaseTrack" },
        React.createElement("div", { className: "workFill", style: { width: `${regularWidth}%` } })
      ),
      React.createElement(
        "div",
        { className: "barTrack workExtraTrack" },
        overtimeHours > 0 ? React.createElement("div", { className: "workOvertimeFill", style: { width: `${overtimeWidth}%` } }) : null
      )
    )
  );
}

export function InlineBar({ value, max, className }) {
  const capped = max ? Math.min(value, max) : 0;
  const width = max ? Math.min(100, Math.max(0, (capped / max) * 100)) : 0;
  return React.createElement(
    "div",
    { className: "inlineBar" },
    React.createElement("span", { className: "barValue" }, formatDuration(value)),
    React.createElement(
      "div",
      { className: "barTrack" },
      React.createElement("div", { className, style: { width: `${width}%` } })
    )
  );
}
