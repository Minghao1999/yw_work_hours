export const DEFAULT_START = "2026-08-31";
export const DEFAULT_END = "2026-09-06";
export const HOUR_MS = 60 * 60 * 1000;
export const DAILY_BREAK_HOURS = 0.5;
export const SHIFT_DAY_CUTOFF_HOUR = 8;
export const DEFAULT_COMPANY_OPTIONS = [];

export const sampleRows = [];

export const columnRules = {
  person: [/人员姓名/, /姓名/, /员工姓名/, /员工/, /人员/, /name/i, /person/i, /employee/i],
  region: [/地区/, /区域/, /region/i, /site/i, /area/i],
  company: [/劳务公司/, /服务公司/, /外包公司/, /供应商/, /^公司$/, /^company$/i, /vendor/i, /agency/i, /labor/i, /staffing/i, /contractor/i],
  date: [/日期/, /考勤日/, /班次日期/, /\bdate\b/i],
  time: [/考勤时间/, /考勤记录/, /打卡时间/, /上班时间/, /下班时间/, /开始时间/, /结束时间/, /首次打卡/, /末次打卡/, /签到/, /签退/, /刷卡/, /punch/i, /clock/i, /\btime\b/i],
  clockIn: [/^clock\s*in$/i, /上班打卡/, /上班时间/],
  clockOut: [/^clock\s*out$/i, /下班打卡/, /下班时间/],
  breakTime: [/total\s*break/i, /break\s*time/i, /break\s*out/i, /休息/, /总休息时长/],
  timesheet: [/timesheet/i, /time\s*sheet/i, /时间表/, /班次/, /时段/],
  shift: [/^班次$/, /^shift$/i],
  personId: [/person\s*id/i, /人员ID/i, /工号/],
};
