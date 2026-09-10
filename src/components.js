import { daysBetween, formatDuration, formatRegionName } from './utils.js?v=20260909-21';

const { useState } = React;

export function Dashboard({ analysis, siteName, companyName, analysisMode, setAnalysisMode, regionOptions, companyOptions, selectedRegion, setSelectedRegion, selectedCompany, setSelectedCompany, selectedShift, setSelectedShift, mode, setMode, selectedDate, setSelectedDate, dateRange, activeRange, comparison }) {
  const overtimeRate = analysis.totalWork ? (analysis.totalOvertime / analysis.totalWork) * 100 : 0;
  const isDay = mode === "day";
  const avgHours = analysis.people.length ? analysis.totalWork / analysis.people.length : 0;
  const scopeName = `${formatRegionName(siteName)} ${companyName || "未识别劳务公司"}`;
  const personView = React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "section",
      { className: "dashboardHeading" },
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "eyebrow" }, "人员概览"),
        React.createElement("h2", null, scopeName)
      ),
      React.createElement("span", { className: "dateBadge" }, isDay ? activeRange.start : `${activeRange.start} — ${activeRange.end}`)
    ),
    React.createElement(
      "section",
      { className: "metrics" },
      React.createElement(Metric, { tone: "work", label: isDay ? "当日工作时长" : "总工作时长", value: formatDuration(analysis.totalWork), hint: `覆盖 ${analysis.dayCount || 0} 天记录` }),
      React.createElement(Metric, { tone: "overtime", label: isDay ? "当日加班时长" : "总加班时长", value: formatDuration(analysis.totalOvertime), hint: `占总工时 ${overtimeRate.toFixed(1)}%` }),
      React.createElement(Metric, { tone: "people", label: "统计人数", value: analysis.people.length, hint: "已按姓名去重" }),
      React.createElement(Metric, { tone: "average", label: "人均工作时长", value: formatDuration(avgHours), hint: isDay ? "当日合计 ÷ 人数" : "总工时 ÷ 人数" })
    ),
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
              { className: "legend" },
              React.createElement("span", null, React.createElement("i", { className: "barWork" }), "工作时长"),
              React.createElement("span", null, React.createElement("i", { className: "barOvertime" }), "加班时长")
            )
          ),
          React.createElement(AdaptiveWorkTable, { data: analysis.people, selectedShift, setSelectedShift })
    )
  );

  const comparisonView = analysisMode === "region"
    ? React.createElement(ComparisonCard, {
        title: "地区工时对比",
        subtitle: "汇总各地区全部劳务公司的数据",
        rows: comparison.regions,
      })
    : React.createElement(ComparisonCard, {
        title: `${formatRegionName(siteName)} 劳务公司对比`,
        subtitle: "同一地区内按劳务公司汇总",
        rows: comparison.companies,
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
        mode,
        setMode,
        selectedDate,
        setSelectedDate,
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

export function ComparisonCard({ title, subtitle, rows }) {
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
        )
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
          )
        );
      }) : React.createElement("div", { className: "emptyCompare" }, "暂无可对比数据")
    )
  );
}

export function EmptyPanel({ message }) {
  return React.createElement(
    "div",
    { className: "emptyInline" },
    message
  );
}

export function ViewControls({ regionOptions, companyOptions, selectedRegion, setSelectedRegion, selectedCompany, setSelectedCompany, analysisMode, mode, setMode, selectedDate, setSelectedDate, dateRange }) {
  const dates = dateRange.dates && dateRange.dates.length ? dateRange.dates : daysBetween(dateRange.start, dateRange.end);
  return React.createElement(
    "section",
    { className: "viewControls analysisFilters" },
    React.createElement("span", { className: "filterTitle" }, "筛选范围"),
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
      React.createElement(
        "div",
        { className: "segmented", role: "group", "aria-label": "统计周期" },
        React.createElement("button", {
          type: "button",
          className: mode === "week" ? "active" : "",
          onClick: () => setMode("week"),
        }, "全部日期"),
        React.createElement("button", {
          type: "button",
          className: mode === "day" ? "active" : "",
          onClick: () => setMode("day"),
        }, "指定日期")
      ),
      mode === "day" ? React.createElement(
        "label",
        { className: "dayPicker" },
        React.createElement("span", null, "日期"),
        React.createElement(
          "select",
          { value: selectedDate, onChange: (event) => setSelectedDate(event.target.value) },
          dates.map((date) => React.createElement("option", { key: date, value: date }, date))
        )
      ) : React.createElement("div", { className: "rangeText" }, `${dateRange.start} 至 ${dateRange.end}`)
    )
  );
}

export function Metric({ label, value, hint, tone = "work" }) {
  return React.createElement(
    "div",
    { className: `panel metric metric--${tone}` },
    React.createElement(
      "div",
      { className: "metricTop" },
      React.createElement("span", null, label),
      React.createElement("i", { "aria-hidden": "true" })
    ),
    React.createElement("strong", { className: "metricValue" }, value),
    React.createElement("small", null, hint)
  );
}

export function AdaptiveWorkTable({ data, selectedShift, setSelectedShift }) {
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
                React.createElement("option", { value: "late" }, "晚班")
              )
            )
          ),
          React.createElement("th", null, "上班时间"),
          React.createElement("th", { className: "workHoursHead" }, "工作时长"),
          React.createElement("th", { className: "overtimeHoursHead" }, "加班时长"),
          React.createElement("th", { className: "num" }, "工作日"),
          React.createElement("th", { className: "num" }, "打卡次数"),
          React.createElement("th", { className: "num" }, "未配对")
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
          React.createElement("td", { className: "shiftCell" }, item.shiftText || "-"),
          React.createElement("td", { className: "timeCell" }, item.timeText || "-"),
          React.createElement("td", { className: "workHoursCell" }, React.createElement(WorkInlineBar, {
            value: item.totalHours,
            regularMax: workMax,
          })),
          React.createElement("td", { className: "overtimeHoursCell overtimeNumber" }, formatDuration(item.overtimeHours)),
          React.createElement("td", { className: "num" }, item.workDays),
          React.createElement("td", { className: "num" }, item.punchCount || 0),
          React.createElement("td", { className: "num" }, item.unmatchedCount || 0)
        )) : React.createElement(
          "tr",
          null,
          React.createElement("td", { className: "emptyRow", colSpan: 8 }, "没有匹配到该班次的数据")
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
      React.createElement("span", null, `工作日：${tooltip.item.workDays} 天`),
      React.createElement("span", null, `上班时间：${tooltip.item.timeText || "-"}`),
      React.createElement("span", null, `打卡次数：${tooltip.item.punchCount || 0}`),
      React.createElement("span", null, `未配对打卡：${tooltip.item.unmatchedCount || 0}`)
    ) : null
  );
}

export function WorkInlineBar({ value, regularMax }) {
  const regularHours = Math.min(value, regularMax);
  const overtimeHours = Math.max(0, value - regularMax);
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
