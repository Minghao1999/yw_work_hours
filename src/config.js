export const DEFAULT_START = "2026-08-31";
export const DEFAULT_END = "2026-09-06";
export const HOUR_MS = 60 * 60 * 1000;
export const SHIFT_DAY_CUTOFF_HOUR = 8;
export const DEFAULT_COMPANY_OPTIONS = [];

export const sampleRows = [];

export const columnRules = {
  person: [/人员姓名/, /姓名/, /员工姓名/, /员工/, /人员/, /name/i, /person/i, /employee/i, /nombre\s+(?:de\s+la\s+)?persona/i, /nombre\s+(?:del\s+)?empleado/i, /^nombre$/i],
  region: [/地区/, /区域/, /region/i, /site/i, /area/i, /regi[oó]n/i, /sitio/i, /[aá]rea/i],
  company: [/劳务公司/, /服务公司/, /外包公司/, /供应商/, /^公司$/, /^company$/i, /vendor/i, /agency/i, /labor/i, /staffing/i, /contractor/i, /empresa/i, /proveedor/i, /agencia/i],
  date: [/日期/, /考勤日/, /班次日期/, /\bdate\b/i, /fecha/i],
  time: [/考勤时间/, /考勤记录/, /打卡时间/, /上班时间/, /下班时间/, /开始时间/, /结束时间/, /首次打卡/, /末次打卡/, /签到/, /签退/, /刷卡/, /punch/i, /clock/i, /\btime\b/i, /fichaje/i, /marcaje/i, /hora/i],
  clockIn: [/^clock\s*in(?:\s*1)?$/i, /^check\s*in(?:\s*1)?$/i, /上班打卡(?:1|一)?/, /上班时间(?:1|一)?/, /^entrada\s*1?$/i, /^hora\s+de\s+entrada\s*1?$/i],
  clockOut: [/^clock\s*out(?:\s*1)?$/i, /^check\s*out(?:\s*1)?$/i, /下班打卡(?:1|一)?/, /下班时间(?:1|一)?/, /^salida\s*1?$/i, /^hora\s+de\s+salida\s*1?$/i],
  paperBreakOut1: [/第一次休息离开/i, /break\s*out\s*1/i],
  paperBreakIn1: [/第一次休息回来/i, /break\s*in\s*1/i],
  paperBreakOut2: [/第二次休息离开/i, /break\s*out\s*2/i],
  paperBreakIn2: [/第二次休息回来/i, /break\s*in\s*2/i],
  breakTime: [/total\s*break/i, /break\s*time/i, /break\s*out/i, /休息/, /总休息时长/, /descanso/i, /pausa/i],
  totalDuration: [/^总时长(?:\s*\(小时\))?$/i, /^total\s*(?:duration|hours?)(?:\s*\((?:h|hrs?|hours?)\))?$/i, /^tiempo\s+total(?:\s*\(horas\))?$/i],
  timesheet: [/timesheet/i, /time\s*sheet/i, /时间表/, /班次/, /时段/, /hoja\s+de\s+tiempo/i],
  shift: [/^班次$/, /^shift$/i, /^turno$/i],
  personId: [/person\s*id/i, /employee\s*id/i, /人员ID/i, /工号/, /id\s+(?:(?:de\s+(?:la\s+)?)|del\s+)?persona/i, /id\s+(?:(?:de\s+(?:la\s+)?)|del\s+)?empleado/i],
  dataSource: [/^数据源$/, /^数据来源$/, /^data\s*source$/i, /^fuente\s+de\s+datos$/i],
};

export const DATA_SOURCE_MACHINE = "machine";
export const DATA_SOURCE_PAPER = "paper";
