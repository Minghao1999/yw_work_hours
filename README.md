# YW Workforce Insights

YW Workforce Insights 是一个考勤工时分析系统。前端使用 React，后端使用 Node.js、Express 和 MongoDB Atlas，可上传 Excel/CSV 考勤表，按地区、劳务公司和人员查看工时，并导出完整报表。

## 当前功能

- 上传 `.xlsx`、`.xls`、`.csv` 文件，支持一次选择多个文件
- 自动识别中文、英语和西班牙语表头
- 从 `Timesheet`、`时间表`、`Hoja de tiempo` 中解析地区、劳务公司和班次
- 页面启动时自动读取 MongoDB，并默认显示最新有数据的日期
- 按数据来源切换“打卡机数据”和“纸质表数据”
- 按全部日期或指定日期查看数据
- 提供地区对比、劳务公司对比和人员对比三种视图
- 支持早班、晚班和全部班次筛选
- 下载包含全部数据的 Excel 工作簿
- 支持按地区、劳务公司或人员永久删除 MongoDB 数据

## 数据来源与工时规则

### 打卡机数据

- 没有“数据源”列的文件默认归为打卡机数据
- 四次打卡按第 1–2 次和第 3–4 次两段工作时间累加
- 两次打卡使用上班到下班的时间跨度
- 没有打卡时间但提供总时长时，直接使用总时长
- 当前不计算休息时长，页面和下载报表统一显示 `-`

### 纸质表数据

- 包含“数据源”列且值为“纸质表”的记录归为纸质表数据
- 使用固定的 `Clock In`、`Clock Out`、`Break Out 1`、`Break In 1`、`Break Out 2`、`Break In 2` 列
- 两段休息时间分别计算后累加，并从上下班总跨度中扣除
- 支持休息和下班时间跨越午夜

### 通用规则

- 每人每天超过 8 小时的部分计入加班
- 工时使用 `小时:分钟` 显示，例如 `12:03`
- 工作时长条以 8 小时为基础，超过部分单独显示为加班

## 删除规则

删除操作只影响当前选择的数据来源，但不受当前日期筛选限制：

- 地区对比：删除该地区全部劳务公司、人员和日期的记录
- 劳务公司对比：删除当前地区下该劳务公司的全部人员和日期记录
- 人员对比：删除当前地区、当前劳务公司下该人员的全部日期记录

删除前页面会显示确认提示。删除成功后，MongoDB 记录、导入批次统计和当前页面会同步更新。删除无法撤销，操作前请确认已经保留原始考勤文件。

## 完整报表

“下载完整报表”会生成一个包含多个工作表的 Excel 文件：

1. 不同地区的汇总数据
2. 不同地区及不同劳务公司的汇总数据
3. 每个地区各自的人员明细表

## 技术结构

```text
.
├── backend
│   ├── attendance.js       # MongoDB 考勤保存、查询与删除
│   ├── db.js               # MongoDB 连接池
│   └── server.js           # Express API 和静态文件服务
├── src
│   ├── analysis.js         # 工时、休息和加班计算
│   ├── api.js              # 前端数据库请求
│   ├── App.js              # 页面状态、上传和删除流程
│   ├── components.js       # Dashboard 视图组件
│   ├── config.js           # 多语言列名规则
│   ├── export.js           # 完整 Excel 报表
│   ├── main.js             # React 入口
│   ├── parser.js           # Excel/CSV 解析与数据源识别
│   └── utils.js            # 日期、时间和格式化工具
├── test                    # 自动化测试
├── .env.example
├── index.html
├── package.json
├── styles.css
└── vercel.json             # Vercel 到 Lightsail 的 API 转发
```

## 本地运行

要求：Node.js 22、npm 和可访问的 MongoDB Atlas 集群。

```bash
npm install
cp .env.example .env
```

编辑 `.env`：

```dotenv
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/?appName=YOUR_CLUSTER
MONGODB_DB=work_hours_dashboard
HOST=127.0.0.1
PORT=5173
```

启动项目：

```bash
npm run dev
```

访问：

- 页面：`http://127.0.0.1:5173`
- 健康检查：`http://127.0.0.1:5173/api/health`

不要提交 `.env`，也不要在截图、Issue 或 README 中公开 MongoDB 用户名和密码。

## 自动化检查

```bash
npm run check
```

该命令会检查前后端 JavaScript 语法并运行全部测试。

## API

| 方法 | 地址 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 检查后端和 MongoDB 连接 |
| `POST` | `/api/attendance/imports` | 保存一次文件导入，避免完整重复导入 |
| `GET` | `/api/attendance/imports` | 查询最近的导入批次 |
| `GET` | `/api/attendance/records` | 按来源、地区、公司、日期或姓名查询记录 |
| `DELETE` | `/api/attendance/records` | 按地区、公司或人员永久删除记录 |
| `GET` | `/api/attendance/dates` | 查询数据库中的考勤日期和记录数 |

删除接口必须提供 `sourceType`、`scope` 和对应范围字段：

```json
{
  "sourceType": "machine",
  "scope": "company",
  "region": "ATL",
  "company": "MI"
}
```

后端启动时会自动创建 `attendance_imports` 和 `attendance_records` 集合及所需索引。

## Git 分支与发布流程

- `test`：开发和测试版本
- `main`：生产版本

日常修改先提交到 `test`：

```bash
git switch test
git add .
git commit -m "describe the change"
git push origin test
```

测试通过后，在 GitHub 创建从 `test` 到 `main` 的 Pull Request。审核并合并后，Vercel 会根据 `main` 自动更新生产前端。

当前 `test` 的 Vercel 预览和生产前端使用同一个 `vercel.json`，因此仍然连接生产 Lightsail 和生产 MongoDB。测试页面中的上传和删除会修改生产数据库；完全隔离测试需要单独的测试后端和测试数据库。

## 生产部署

### 前端：Vercel

Vercel 生产分支设置为 `main`。`vercel.json` 将浏览器访问的 `/api/*` 转发到 Lightsail 的 Nginx，因此前端代码保持使用相对 API 地址。

当前生产页面：

```text
https://yw-work-hours.vercel.app
```

### 后端：AWS Lightsail

后端由 PM2 管理，Nginx 监听公网 80 端口并转发到本机 `127.0.0.1:5173`。Lightsail 使用静态 IP，MongoDB Atlas 的 Network Access 必须放行该静态 IP。

`main` 合并后，在 Lightsail SSH 终端更新生产后端：

```bash
cd ~/yw_work_hours
git switch main
git pull origin main
pm2 restart work-hours-api --update-env
pm2 save
curl http://127.0.0.1:5173/api/health
```

只有依赖发生变化时才需要额外执行 `npm install`。

## 安全说明

当前系统尚未实现登录和权限控制，上传及删除接口通过公网后端提供。正式用于员工考勤数据前，应增加管理员身份验证、删除权限控制、HTTPS、操作日志和数据库备份。
