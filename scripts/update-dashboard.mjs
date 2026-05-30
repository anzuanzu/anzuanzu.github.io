import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, "..", "data");
const outputFile = path.join(outputDir, "dashboard.json");

const SOURCES = {
  twseRevenue: "https://openapi.twse.com.tw/v1/opendata/t187ap05_L",
  tpexRevenue: "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O",
  twseMajor: "https://openapi.twse.com.tw/v1/opendata/t187ap04_L",
  tpexMajor: "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap04_O",
  twseQuotes: "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
  tpexQuotes: "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes",
  twseIndices: "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX",
  tpexHighlight: "https://www.tpex.org.tw/openapi/v1/tpex_mainborad_highlight",
  tpexInstiSummary: "https://www.tpex.org.tw/openapi/v1/tpex_3insti_summary",
  tpexInstiDetail: "https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading"
};

const watchlists = {
  semiconductor: {
    title: "半導體鏈",
    summary: "先看產能、先進封裝、設備交期與大客戶拉貨節奏，再用月營收和重大訊息確認需求是真的擴散到供應鏈，而不是只有龍頭敘事。",
    cadence: [
      "每月 8 到 12 日先檢查月營收是否連續改善，再回看法說口徑有沒有同步轉強。",
      "優先留意設備、材料、封裝、載板這些較早反映景氣變化的環節。",
      "如果市場只交易龍頭、二線供應商還沒全面反映，這類題材的資訊優勢通常比較完整。"
    ],
    companies: [
      ["2330", "listed", "晶圓代工", "觀察 AI、先進製程與先進封裝需求是否持續外溢。"],
      ["2303", "listed", "成熟製程", "看工控、車用與通訊需求回補是否能帶動利用率。"],
      ["3711", "listed", "先進封裝 / 封測", "檢查封裝稼動率、CoWoS 外溢與大客戶急單訊號。"],
      ["2454", "listed", "IC 設計", "關注手機、邊緣 AI 與平台轉換是否推升產品組合。"],
      ["3035", "listed", "ASIC / IP", "重點不在故事，而是 tape-out、專案量產與營收認列時點。"],
      ["5274", "listed", "伺服器管理晶片", "檢查 AI 伺服器滲透率是否持續推升高毛利產品比重。"],
      ["6488", "listed", "矽晶圓", "注意長約價格、庫存調整是否結束，以及利用率修復速度。"],
      ["8046", "listed", "ABF 載板", "看高階封裝與 HPC 需求是否帶動載板規格升級。"],
      ["3189", "listed", "ABF 載板", "觀察產能利用率、ASP 與客戶產品周期是否同步改善。"],
      ["3583", "listed", "半導體設備", "設備認列節奏常先於下游獲利，適合追交機與驗收節點。"],
      ["3131", "otc", "半導體設備", "檢查先進封裝與先進製程擴產是否持續帶來新接單。"],
      ["6223", "otc", "測試介面 / 探針卡", "高階測試需求若擴散，通常先反映在這類環節。"],
      ["3105", "otc", "砷化鎵 / RF", "適合追蹤手機、基地台與衛星通訊拉貨是否回溫。"]
    ]
  },
  nonElectronics: {
    title: "非電子鏈",
    summary: "先確認需求、價格、通路庫存與政策方向，再檢查月營收和毛利邏輯是否成立。非電子鏈的錯價，常出現在景氣拐點而不是熱門題材。",
    cadence: [
      "先分清楚營收改善是量增、價增，還是匯率與一次性因素。",
      "月營收只是第一層，真正要賺的是毛利、費用率與現金流同步改善。",
      "市場若還用舊景氣框架看公司，反而容易出現預期差。"
    ],
    companies: [
      ["1216", "listed", "食品 / 原物料轉嫁", "看原料成本、通路動銷與品牌調價能否轉成獲利。"],
      ["2912", "listed", "超商通路", "重點是同店、鮮食結構與會員經營是否推升客單價。"],
      ["5904", "otc", "零售通路", "寶雅這類公司適合追人流、展店與毛利率變化。"],
      ["2207", "listed", "汽車通路", "觀察交車節奏、新車周期與金融服務對獲利的拉動。"],
      ["2603", "listed", "貨櫃航運", "先看運價和裝載率，再看市場是不是把短期行情當長週期。"],
      ["2615", "listed", "貨櫃航運", "適合比對艙位利用率、遠洋航線變化與現貨運價彈性。"],
      ["2727", "listed", "餐飲", "看展店與同店銷售是否同步成長，而不只是節慶旺季。"],
      ["2731", "listed", "旅遊 / 觀光", "留意出團量、機位供給與國際旅遊需求是否延續。"],
      ["9945", "listed", "資產 / 營建", "適合追建案入帳節奏與資產價值被重新定價的時點。"],
      ["9933", "listed", "統包工程", "檢查在手訂單、毛利結構與海外接案是否改善。"],
      ["5609", "otc", "物流", "觀察空海運量、報價與跨境需求是否出現結構性回升。"],
      ["8436", "otc", "保健食品 / 品牌出海", "看中國與海外銷售恢復是否真正轉成營收與現金流。"]
    ]
  }
};

const routineKeywords = ["股東會", "董事會", "審計委員會", "薪酬委員會", "除權息", "法人說明會", "受邀參加", "補充說明", "更正", "配合主管機關", "公告本公司", "面額變更", "代子公司公告"];
const catalystKeywords = ["新產品", "擴產", "增資", "取得", "處分", "簽約", "合作", "接單", "量產", "投資", "設廠", "策略", "客戶", "資本支出", "設備"];

const pickValue = (row, keys) => keys.find((key) => row && row[key] != null) ? row[keys.find((key) => row && row[key] != null)] : null;
const normalizeNumber = (value) => {
  if (value == null) return null;
  const cleaned = String(value).replaceAll(",", "").replaceAll("%", "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "-") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
};
const rocDateToIso = (raw) => {
  const text = String(raw || "").replaceAll("/", "").trim();
  if (!/^\d{7,8}$/.test(text)) return String(raw || "");
  return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}-${text.slice(5, 7)}`;
};
const latestMonthLabel = (raw) => {
  const text = String(raw || "").trim();
  return /^\d{5}$/.test(text) ? `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}` : (text || "無資料");
};
const mapByCode = (rows, key) => new Map(rows.map((row) => [String(row[key] || "").trim(), row]));
const formatLargeNumber = (value) => value == null || !Number.isFinite(value) ? "無資料" : Math.abs(value) >= 100000000 ? `${(value / 100000000).toFixed(2)} 億` : Math.abs(value) >= 10000 ? `${(value / 10000).toFixed(2)} 萬` : value.toLocaleString("zh-TW");
const formatRevenueFromThousand = (value) => value == null || !Number.isFinite(value) ? "無資料" : Math.abs(value) >= 100000 ? `${(value / 100000).toFixed(2)} 億` : Math.abs(value) >= 10 ? `${(value / 10).toFixed(2)} 萬` : `${value.toLocaleString("zh-TW")} 千元`;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "tw-stock-dashboard-action/1.0", accept: "application/json, text/plain, */*" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} @ ${url}`);
  return response.json();
}

function parseMajorEntry(entry, market) {
  const subject = String(pickValue(entry, ["主旨 ", "主旨"]) || "").trim();
  const summary = String(pickValue(entry, ["說明"]) || "").replaceAll("\r", " ").replaceAll("\n", " ").trim();
  return {
    market,
    code: String(pickValue(entry, ["公司代號", "SecuritiesCompanyCode"]) || "").trim(),
    companyName: String(pickValue(entry, ["公司名稱", "CompanyName"]) || "").trim(),
    subject,
    date: rocDateToIso(pickValue(entry, ["發言日期", "Date"])),
    time: String(pickValue(entry, ["發言時間"]) || "").padStart(6, "0").replace(/(\d{2})(\d{2})(\d{2})/, "$1:$2:$3"),
    summary,
    isRoutine: routineKeywords.some((keyword) => subject.includes(keyword)),
    hasCatalyst: catalystKeywords.some((keyword) => subject.includes(keyword) || summary.includes(keyword))
  };
}

function computeSignal(item, listKey) {
  const yoy = item.revenueYoY ?? -999;
  const mom = item.revenueMoM ?? -999;
  const cumulative = item.cumulativeYoY ?? -999;
  const priceChange = item.priceChange ?? 0;
  let score = 0;
  if (yoy >= 25) score += 3; else if (yoy >= 10) score += 2; else if (yoy >= 0) score += 1; else if (yoy <= -15) score -= 2; else if (yoy < 0) score -= 1;
  if (mom >= 10) score += 2; else if (mom >= 0) score += 1; else if (mom <= -10) score -= 2; else if (mom < 0) score -= 1;
  if (cumulative >= 15) score += 2; else if (cumulative >= 0) score += 1; else if (cumulative <= -10) score -= 1;
  if (priceChange > 2) score += 1; else if (priceChange < -2) score -= 1;
  if (item.announcementCount > 0) score += 1;
  if (item.catalystCount > 0) score += 1;
  if (listKey === "semiconductor" && item.market === "otc" && yoy >= 20) score += 1;
  if (listKey === "nonElectronics" && item.market === "otc" && cumulative >= 10) score += 1;
  if (score >= 7) return { score, label: "高優先追蹤", tone: "strong" };
  if (score >= 4) return { score, label: "正向觀察", tone: "positive" };
  if (score >= 2) return { score, label: "等待確認", tone: "neutral" };
  return { score, label: "保守看待", tone: "negative" };
}

function resolveMarketRow(code, preferredMarket, maps) {
  const preferred = maps[preferredMarket]?.get(code) || null;
  if (preferred) return { row: preferred, market: preferredMarket };
  const fallbackMarket = preferredMarket === "listed" ? "otc" : "listed";
  const fallback = maps[fallbackMarket]?.get(code) || null;
  return fallback ? { row: fallback, market: fallbackMarket } : { row: null, market: preferredMarket };
}

function buildWatchlist(listKey, revenueMaps, quoteMaps, majorByCode, tpexInstiMap) {
  const definition = watchlists[listKey];
  const items = definition.companies.map(([code, marketHint, focus, note]) => {
    const revenueMatch = resolveMarketRow(code, marketHint, revenueMaps);
    const quoteMatch = resolveMarketRow(code, revenueMatch.market, quoteMaps);
    const market = quoteMatch.row ? quoteMatch.market : revenueMatch.market;
    const revenueRow = revenueMatch.row || {};
    const quoteRow = quoteMatch.row || {};
    const announcements = (majorByCode.get(code) || []).slice(0, 3);
    const insti = market === "otc" ? tpexInstiMap.get(code) : null;
    const item = {
      code,
      market,
      name: String(pickValue(revenueRow, ["公司名稱"]) || pickValue(quoteRow, ["Name", "CompanyName"]) || code).trim(),
      industry: String(pickValue(revenueRow, ["產業別"]) || "未分類").trim(),
      focus,
      note,
      dataMonth: latestMonthLabel(pickValue(revenueRow, ["資料年月"])),
      revenue: normalizeNumber(pickValue(revenueRow, ["營業收入-當月營收"])),
      revenueMoM: normalizeNumber(pickValue(revenueRow, ["營業收入-上月比較增減(%)"])),
      revenueYoY: normalizeNumber(pickValue(revenueRow, ["營業收入-去年同月增減(%)"])),
      cumulativeYoY: normalizeNumber(pickValue(revenueRow, ["累計營業收入-前期比較增減(%)"])),
      closingPrice: normalizeNumber(pickValue(quoteRow, ["ClosingPrice", "Close"])),
      priceChange: normalizeNumber(pickValue(quoteRow, ["Change"])),
      announcementCount: announcements.length,
      catalystCount: announcements.filter((entry) => entry.hasCatalyst).length,
      announcements,
      otcInstitutionNet: normalizeNumber(pickValue(insti || {}, ["TotalDifference", "ForeignInvestorsInclude MainlandAreaInvestors-Difference", "Foreign Investors include Mainland Area Investors (Foreign Dealers excluded)-Difference"]))
    };
    item.signal = computeSignal(item, listKey);
    item.revenueDisplay = formatRevenueFromThousand(item.revenue);
    item.otcInstitutionNetDisplay = formatLargeNumber(item.otcInstitutionNet);
    return item;
  });
  return {
    key: listKey,
    title: definition.title,
    summary: definition.summary,
    cadence: definition.cadence,
    items,
    topIdeas: [...items].sort((a, b) => b.signal.score - a.signal.score || (b.revenueYoY ?? -999) - (a.revenueYoY ?? -999)).slice(0, 3)
  };
}

async function main() {
  const [twseRevenue, tpexRevenue, twseMajor, tpexMajor, twseQuotes, tpexQuotes, twseIndices, tpexHighlight, tpexInstiSummary, tpexInstiDetail] = await Promise.all(Object.values(SOURCES).map(fetchJson));
  const revenueMaps = { listed: mapByCode(twseRevenue, "公司代號"), otc: mapByCode(tpexRevenue, "公司代號") };
  const quoteMaps = { listed: mapByCode(twseQuotes, "Code"), otc: mapByCode(tpexQuotes, "SecuritiesCompanyCode") };
  const watchCodes = new Set(Object.values(watchlists).flatMap((list) => list.companies.map(([code]) => code)));
  const majorEntries = [...twseMajor.map((entry) => parseMajorEntry(entry, "listed")), ...tpexMajor.map((entry) => parseMajorEntry(entry, "otc"))]
    .filter((entry) => watchCodes.has(entry.code))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const majorByCode = new Map();
  for (const entry of majorEntries) {
    if (entry.isRoutine) continue;
    if (!majorByCode.has(entry.code)) majorByCode.set(entry.code, []);
    if (majorByCode.get(entry.code).length < 5) majorByCode.get(entry.code).push(entry);
  }
  const tpexInstiMap = mapByCode(tpexInstiDetail, "SecuritiesCompanyCode");
  const taiex = twseIndices.find((item) => String(item["指數"] || "").includes("發行量加權股價指數")) || twseIndices[0];
  const otcOverview = Array.isArray(tpexHighlight) ? tpexHighlight[0] : tpexHighlight;
  const otcClose = normalizeNumber(otcOverview?.CloseIndex);
  const otcChange = normalizeNumber(otcOverview?.IndexChange);
  const otcPreviousClose = otcClose != null && otcChange != null ? otcClose - otcChange : null;

  const payload = {
    generatedAt: new Date().toISOString(),
    marketOverview: {
      listed: {
        label: "加權指數",
        date: rocDateToIso(taiex["日期"]),
        close: normalizeNumber(taiex["收盤指數"]),
        change: normalizeNumber(taiex["漲跌點數"]),
        changePct: normalizeNumber(taiex["漲跌百分比"])
      },
      otc: {
        label: "櫃買指數",
        date: rocDateToIso(otcOverview?.Date),
        close: otcClose,
        change: otcChange,
        changePct: otcPreviousClose && otcChange != null ? Number(((otcChange / otcPreviousClose) * 100).toFixed(2)) : null,
        riseCount: normalizeNumber(otcOverview?.PriceRiseCompanyNumbers),
        fallCount: normalizeNumber(otcOverview?.PriceDeclineCompanyNumbers),
        flatCount: normalizeNumber(otcOverview?.PriceFlatCompanyNumbers)
      },
      otcInstitutionSummary: tpexInstiSummary.map((item) => ({ investor: item.Investor, net: normalizeNumber(item.Net) }))
    },
    sourceStatus: {
      monthlyRevenueMonth: latestMonthLabel(pickValue(twseRevenue[0] || {}, ["資料年月"]) || pickValue(tpexRevenue[0] || {}, ["資料年月"])),
      twseMajorDate: rocDateToIso(pickValue(twseMajor[0] || {}, ["發言日期", "出表日期"])),
      tpexMajorDate: rocDateToIso(pickValue(tpexMajor[0] || {}, ["發言日期", "Date"]))
    },
    lists: {
      semiconductor: buildWatchlist("semiconductor", revenueMaps, quoteMaps, majorByCode, tpexInstiMap),
      nonElectronics: buildWatchlist("nonElectronics", revenueMaps, quoteMaps, majorByCode, tpexInstiMap)
    },
    announcements: majorEntries.filter((entry) => !entry.isRoutine).slice(0, 12)
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`wrote ${outputFile}`);
}

await main();
