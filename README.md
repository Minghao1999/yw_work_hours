# YW Workforce Insights

一个 React 考勤工时 Dashboard，配有 Node.js 和 MongoDB 后端，用于上传考勤表并统计不同地区、劳务公司、班次下的人员工作时长和加班时长。

## 功能

- 上传 `.xlsx`、`.xls`、`.csv` 考勤表
- 自动识别中文、英语和西班牙语的人员、日期、班次及打卡列
- 支持 `Clock In / Clock Out`、`上班 / 下班`、`Entrada / Salida` 等双次或四次打卡格式
- 支持按地区、劳务公司筛选
- 支持下载包含地区汇总、地区和劳务公司汇总、各地区人员明细的完整 Excel 报表
- 支持从 `Timesheet`、`时间表` 或 `Hoja de tiempo` 中解析 `地区-劳务公司-班次`
- 支持按全部日期或单日汇总
- 打开主界面时自动读取 MongoDB 数据，并默认显示最新一个有可计算工时的日期
- 后端分别保存打卡机数据与纸质表数据，主界面可一键切换两种数据来源
- 支持表头内按早班、晚班、全部筛选
- 每天超过 8 小时的部分计入加班
- 打卡机数据暂不计算休息时长，页面和下载报表统一显示为 `-`
- 带有“数据源”列且标记为“纸质表”的固定格式报表会归入纸质数据；没有“数据源”列的报表归入打卡机数据
- 纸质表会识别两组 `Break Out / Break In`，将上下班区间内的两段休息累加并从工作跨度中扣除
- 四次打卡时按两段实际工作时间相加；两次打卡时使用打卡跨度，不自动扣除休息时间
- 没有打卡时间但存在总时长时，直接使用总时长计算
- 工时和加班时长按 `小时:分钟` 显示，例如 `12:03`
- 工作时长条以 8 小时为基础基准，超过 8 小时的部分单独显示

## 项目结构

```text
.
├── index.html
├── styles.css
├── package.json
├── README.md
├── backend
│   ├── db.js
│   └── server.js
└── src
    ├── App.js
    ├── analysis.js
    ├── components.js
    ├── config.js
    ├── export.js
    ├── main.js
    ├── parser.js
    └── utils.js
```

## 本地运行

安装依赖：

```bash
npm install
```

复制环境变量模板并填写 MongoDB Atlas 连接字符串：

```bash
cp .env.example .env
```

启动开发服务器：

```bash
npm run dev
```

然后打开：

```text
http://localhost:5173
```

数据库连接健康检查：

```text
http://localhost:5173/api/health
```

生产方式启动：

```bash
npm start
```

## 主要模块

- `src/parser.js`：负责文件读取、CSV 编码识别、表头识别和列推断
- `src/analysis.js`：负责工时、加班、跨天班次和筛选后的汇总计算
- `src/components.js`：负责 Dashboard、指标卡、表格、表头筛选菜单等 UI
- `src/export.js`：负责生成包含全部地区、劳务公司和人员明细的 Excel 报表
- `src/utils.js`：负责日期、时间、格式化等通用函数
- `src/config.js`：负责列名匹配规则和默认配置
- `backend/db.js`：维护 MongoDB 单例连接和连接池
- `backend/attendance.js`：创建考勤集合、保存导入批次并查询考勤记录
- `backend/server.js`：提供静态页面和后端 API

## MongoDB 数据接口

- `POST /api/attendance/imports`：保存一次表格导入，重复内容不会重复写入
- `GET /api/attendance/imports`：查询最近的导入批次
- `GET /api/attendance/records`：按导入批次、地区、劳务公司、日期或姓名查询考勤记录
- `GET /api/attendance/dates`：查询数据库中的原始考勤日期及记录数量

启动后端时会自动创建 `attendance_imports` 和 `attendance_records` 两个集合。网页上传并解析表格后，会自动调用保存接口。
