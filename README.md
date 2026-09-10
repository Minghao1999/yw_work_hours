# Work Hours Dashboard

一个本地运行的 React 考勤工时 Dashboard，用于上传考勤表并统计不同地区、劳务公司、班次下的人员工作时长和加班时长。

## 功能

- 上传 `.xlsx`、`.xls`、`.csv` 考勤表
- 自动识别人员、日期、班次、Clock In、Clock Out、休息时间等列
- 支持按地区、劳务公司筛选
- 支持从 `Timesheet` 或 `时间表` 中解析 `地区-劳务公司-班次`
- 支持按全部日期或单日汇总
- 支持表头内按早班、晚班、全部筛选
- 每天超过 8 小时的部分计入加班
- 工时和加班时长按 `小时:分钟` 显示，例如 `12:03`
- 工作时长条以 8 小时为基础基准，超过 8 小时的部分单独显示

## 项目结构

```text
.
├── index.html
├── styles.css
├── package.json
├── README.md
└── src
    ├── App.js
    ├── analysis.js
    ├── components.js
    ├── config.js
    ├── main.js
    ├── parser.js
    └── utils.js
```

## 本地运行

```bash
python3 -m http.server 5173
```

然后打开：

```text
http://localhost:5173
```

## 主要模块

- `src/parser.js`：负责文件读取、CSV 编码识别、表头识别和列推断
- `src/analysis.js`：负责工时、加班、跨天班次和筛选后的汇总计算
- `src/components.js`：负责 Dashboard、指标卡、表格、表头筛选菜单等 UI
- `src/utils.js`：负责日期、时间、格式化等通用函数
- `src/config.js`：负责列名匹配规则和默认配置
