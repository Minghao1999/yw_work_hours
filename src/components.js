import { daysBetween, formatDuration, formatRegionName, formatShiftFilter } from './utils.js';

const { useState } = React;

export function Dashboard({ analysis, siteName, companyName, regionOptions, companyOptions, selectedRegion, setSelectedRegion, selectedCompany, setSelectedCompany, selectedShift, setSelectedShift, mode, setMode, selectedDate, setSelectedDate, dateRange, activeRange }) {
  const overtimeRate = analysis.totalWork ? (analysis.totalOvertime / analysis.totalWork) * 100 : 0;
  const isDay = mode === "day";
  const avgHours = analysis.people.length ? analysis.totalWork / analysis.people.length : 0;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(ViewControls, {
      regionOptions,
      companyOptions,
      selectedRegion,
      setSelectedRegion,
      selectedCompany,
      setSelectedCompany,
      mode,
      setMode,
      selectedDate,
      setSelectedDate,
      dateRange,
    }),
    React.createElement(
      "section",
      { className: "metrics" },
      React.createElement(Metric, { label: isDay ? `${formatRegionName(siteName)} 当日工作时长` : `${formatRegionName(siteName)} 总工作时长`, value: formatDuration(analysis.totalWork), hint: `${companyName} / ${analysis.shiftCount} 个日期记录` }),
      React.createElement(Metric, { label: isDay ? `${formatRegionName(siteName)} 当日加班时长` : `${formatRegionName(siteName)} 总加班时长`, value: formatDuration(analysis.totalOvertime), hint: `加班占比 ${overtimeRate.toFixed(1)}%` }),
      React.createElement(Metric, { label: "统计人数", value: analysis.people.length, hint: "按姓名去重" }),
      React.createElement(Metric, { label: "人均工作时长", value: formatDuration(avgHours), hint: isDay ? "当日合计 / 人数" : "表内合计 / 人数" })
    ),
    React.createElement(
      "section",
      { className: "grid" },
      React.createElement(
        "div",
        { className: "panel section" },
        React.createElement(
          "div",
          { className: "sectionHead" },
          React.createElement("h2", null, isDay ? `${activeRange.start} 个人工作时长与加班时长` : "个人工作时长与加班时长"),
          React.createElement(
            "div",
            { className: "legend" },
            React.createElement("span", null, React.createElement("i", { className: "barWork" }), "工作时长"),
            React.createElement("span", null, React.createElement("i", { className: "barOvertime" }), "加班时长")
          )
        ),
        React.createElement(AdaptiveWorkTable, { data: analysis.people, selectedShift, setSelectedShift })
      )
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

export function ViewControls({ regionOptions, companyOptions, selectedRegion, setSelectedRegion, selectedCompany, setSelectedCompany, mode, setMode, selectedDate, setSelectedDate, dateRange }) {
  const dates = dateRange.dates && dateRange.dates.length ? dateRange.dates : daysBetween(dateRange.start, dateRange.end);
  return React.createElement(
    "section",
    { className: "viewControls" },
    React.createElement(
      "div",
      { className: "filterGroup" },
      React.createElement(
        "label",
        { className: "filterField" },
        React.createElement("span", null, "地区"),
        React.createElement(
          "select",
          { value: selectedRegion, onChange: (event) => setSelectedRegion(event.target.value) },
          regionOptions.map((region) => React.createElement("option", { key: region, value: region }, formatRegionName(region)))
        )
      ),
      React.createElement(
        "label",
        { className: "filterField" },
        React.createElement("span", null, "劳务公司"),
        React.createElement(
          "select",
          { value: selectedCompany, onChange: (event) => setSelectedCompany(event.target.value) },
          companyOptions.map((company) => React.createElement("option", { key: company, value: company }, company))
        )
      )
    ),
    React.createElement(
      "div",
      { className: "segmented" },
      React.createElement("button", {
        type: "button",
        className: mode === "week" ? "active" : "",
        onClick: () => setMode("week"),
      }, "全部汇总"),
      React.createElement("button", {
        type: "button",
        className: mode === "day" ? "active" : "",
        onClick: () => setMode("day"),
      }, "天汇总")
    ),
    mode === "day" ? React.createElement(
      "label",
      { className: "dayPicker" },
      React.createElement("span", null, "选择日期"),
      React.createElement(
        "select",
        { value: selectedDate, onChange: (event) => setSelectedDate(event.target.value) },
        dates.map((date) => React.createElement("option", { key: date, value: date }, date))
      )
    ) : React.createElement("div", { className: "rangeText" }, `${dateRange.start} 至 ${dateRange.end}`)
  );
}

export function Metric({ label, value, hint }) {
  return React.createElement(
    "div",
    { className: "panel metric" },
    React.createElement("span", null, label),
    React.createElement("strong", null, value),
    React.createElement("small", null, hint)
  );
}

export function AdaptiveWorkTable({ data, selectedShift, setSelectedShift }) {
  const [tooltip, setTooltip] = useState(null);
  const [shiftMenuOpen, setShiftMenuOpen] = useState(false);
  const sorted = [...data].sort((a, b) => b.totalHours - a.totalHours);
  const workMax = 8;
  const shiftOptions = [
    { value: "all", label: "全部" },
    { value: "early", label: "早班" },
    { value: "late", label: "晚班" },
  ];

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
          React.createElement("th", null, "姓名"),
          React.createElement(
            "th",
            { className: "shiftHead" },
            React.createElement(
              "div",
              { className: "tableFilter" },
              React.createElement("span", null, "班次"),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: shiftMenuOpen ? "tableFilterButton active" : "tableFilterButton",
                  onClick: () => setShiftMenuOpen((open) => !open),
                  title: `筛选班次：${formatShiftFilter(selectedShift)}`,
                },
                React.createElement("span", null, formatShiftFilter(selectedShift)),
                React.createElement("b", null, "≡")
              ),
              shiftMenuOpen ? React.createElement(
                "div",
                { className: "tableFilterMenu" },
                shiftOptions.map((option) => React.createElement(
                  "button",
                  {
                    key: option.value,
                    type: "button",
                    className: selectedShift === option.value ? "active" : "",
                    onClick: () => {
                      setSelectedShift(option.value);
                      setShiftMenuOpen(false);
                    },
                  },
                  option.label
                ))
              ) : null
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
