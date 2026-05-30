import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const dataFile = path.join(dataDir, "dashboard.json");

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
  tpexInstiDetail: "https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading",
};

const WATCHLISTS = {
  semiconductor: {
    title: "半導體鏈",
    summary:
      "先看製程、封裝、設備、材料與載板是否同步改善，再判斷需求是只有龍頭獨強，還是真的開始往供應鏈擴散。",
    cadence: [
      "每月 8 到 12 日先看月營收是否連續改善，再回看法說口徑有沒有同步轉強。",
      "設備、材料、封裝與載板通常比大客戶敘事更早透露景氣方向。",
      "如果市場只交易龍頭、二線供應商還沒被完整定價，研究價值通常更高。",
    ],
    companies: [
      { code: "2330", market: "listed", chain: "晶圓代工", focus: "先進製程 / 先進封裝", note: "觀察 AI 與高效能運算需求是否持續帶動產能與封裝外溢。" },
      { code: "2303", market: "listed", chain: "晶圓代工", focus: "成熟製程利用率", note: "關注工控、車用與通訊需求回補能否帶動利用率改善。" },
      { code: "5347", market: "otc", chain: "晶圓代工", focus: "特殊製程 / 功率元件", note: "看特殊製程與工業需求是否形成補庫存與報價支撐。" },
      { code: "2454", market: "listed", chain: "IC 設計", focus: "平台升級 / 邊緣 AI", note: "檢查手機、運算與平台轉換是否推升產品組合。" },
      { code: "3035", market: "listed", chain: "ASIC / IP", focus: "NRE 與 tape-out", note: "看 AI ASIC 案件與量產轉換是否讓營收節奏加速。" },
      { code: "3443", market: "listed", chain: "ASIC / IP", focus: "客製化晶片", note: "觀察雲端與加速器客戶的設計案是否持續增溫。" },
      { code: "3661", market: "listed", chain: "ASIC / IP", focus: "高階 ASIC", note: "關注高單價設計服務與量產節點是否延續。" },
      { code: "6533", market: "listed", chain: "IP / RISC-V", focus: "IP 授權與授權轉量產", note: "觀察授權案轉向量產與高毛利 IP 收入的節奏。" },
      { code: "3711", market: "listed", chain: "封裝測試", focus: "先進封裝 / CoWoS 外溢", note: "確認先進封裝稼動率與大客戶拉貨是否仍在擴大。" },
      { code: "6147", market: "listed", chain: "封裝測試", focus: "顯示驅動與記憶體封測", note: "觀察手機與消費端回補能否讓成熟封測出現改善。" },
      { code: "1560", market: "listed", chain: "材料", focus: "再生晶圓 / 耗材", note: "看先進製程與封裝需求是否帶動耗材與再生晶圓出貨。" },
      { code: "6488", market: "listed", chain: "材料", focus: "矽晶圓價格與出貨", note: "檢查長約、稼動率與半導體景氣回升是否反映在出貨。" },
      { code: "3131", market: "otc", chain: "設備", focus: "先進封裝設備", note: "觀察先進封裝擴產是否繼續帶動設備驗收與交機。" },
      { code: "3583", market: "listed", chain: "設備", focus: "再生晶圓 / 濕製程設備", note: "看設備與材料雙引擎是否同步受惠半導體資本支出。" },
      { code: "6187", market: "otc", chain: "設備", focus: "封裝設備 / 自動化", note: "留意設備交機節奏與新產能導入是否持續。" },
      { code: "6223", market: "otc", chain: "設備 / 測試", focus: "探針卡與測試介面", note: "觀察高階測試需求能否由 AI 與高速運算延伸。" },
      { code: "6640", market: "otc", chain: "設備", focus: "先進封裝 / 自動化", note: "確認先進封裝擴產是否外溢到二線設備股。" },
      { code: "8046", market: "listed", chain: "載板", focus: "ABF 載板", note: "看 HPC 與網通需求能否支撐載板稼動率與價格。" },
      { code: "3189", market: "listed", chain: "載板", focus: "ABF 載板", note: "檢查庫存去化後，高階載板是否重新回到漲價與滿載節奏。" },
      { code: "8028", market: "listed", chain: "矽晶圓 / 回收", focus: "矽晶圓循環利用", note: "留意成熟製程與先進製程回升是否同時反映在回收材料端。" },
      { code: "6515", market: "listed", chain: "測試介面", focus: "高階測試座", note: "關注高速運算與先進封裝對測試介面的需求拉升。" },
    ],
  },
  nonElectronics: {
    title: "非電子鏈",
    summary:
      "先拆解量、價、成本與政策四條線，再去判斷營收改善是短期反彈，還是已經開始往毛利與現金流傳導。",
    cadence: [
      "先看需求端異常，再檢查月營收是否反映，最後確認毛利與現金流能不能跟上。",
      "如果只是短期促銷、補庫存或一次性價格上調，不能直接當成長趨勢。",
      "政策、原物料與匯率方向常常比單日價格波動更重要。",
    ],
    companies: [
      { code: "1216", market: "listed", chain: "食品 / 物流", focus: "內需食品與低溫物流", note: "觀察內需消費、通路補貨與物流擴建能否轉成穩定成長。" },
      { code: "2912", market: "listed", chain: "零售通路", focus: "便利商店 / 鮮食", note: "看來客數、客單價與鮮食結構是否持續改善。" },
      { code: "5904", market: "otc", chain: "零售通路", focus: "美妝零售", note: "關注展店、同店銷售與內需消費強度。" },
      { code: "2903", market: "listed", chain: "百貨通路", focus: "百貨 / 內需消費", note: "檢查內需、促銷與人流能否支撐百貨成長。" },
      { code: "2207", market: "listed", chain: "汽車", focus: "車市與高單價車款", note: "觀察交車週期、車款組合與售後服務是否支撐獲利。" },
      { code: "2603", market: "listed", chain: "航運", focus: "貨櫃運價與裝載率", note: "看運價、航線調度與旺季前補貨是否轉強。" },
      { code: "2615", market: "listed", chain: "航運", focus: "亞洲線與靈活調度", note: "觀察短中程航線需求與貨櫃調度效益。" },
      { code: "2610", market: "listed", chain: "航空", focus: "客運 / 貨運雙引擎", note: "檢查載客率、貨運收益與燃油成本變化。" },
      { code: "2618", market: "listed", chain: "航空", focus: "客運復甦 / 匯率", note: "觀察旅遊需求與匯率對票價與成本的影響。" },
      { code: "5609", market: "listed", chain: "物流", focus: "國際物流與運價", note: "看海空運價、轉單與客戶需求是否同步改善。" },
      { code: "2727", market: "listed", chain: "餐飲", focus: "同店銷售與展店", note: "觀察內需餐飲需求與新品牌擴張是否持續。" },
      { code: "2731", market: "listed", chain: "旅遊", focus: "旅行團與自由行需求", note: "看出境旅遊與高單價團體行程恢復程度。" },
      { code: "8436", market: "listed", chain: "保健食品", focus: "品牌與跨境銷售", note: "檢查新品、海外市場與品牌力是否持續拉動營收。" },
      { code: "5871", market: "listed", chain: "租賃金融", focus: "利差與放款品質", note: "關注高利率環境下的利差、資產品質與撥備。" },
      { code: "1301", market: "listed", chain: "塑化", focus: "原料與景氣循環", note: "看油價、產品價差與下游需求是否出現拐點。" },
      { code: "6505", market: "listed", chain: "能源 / 石化", focus: "煉油價差與石化景氣", note: "觀察油價、價差與需求修復是否同步。" },
      { code: "9933", market: "listed", chain: "工程", focus: "工程在手案與成本控制", note: "檢查海外工程、能源案與成本結構變化。" },
      { code: "9945", market: "listed", chain: "資產 / 通路", focus: "資產評價與百貨轉投資", note: "看內需與資產開發題材是否同時推進。" },
      { code: "9921", market: "listed", chain: "消費製造", focus: "自行車庫存去化", note: "觀察歐美庫存是否回到健康水位，帶動訂單回升。" },
      { code: "9914", market: "listed", chain: "消費製造", focus: "運動用品需求", note: "看品牌拉貨、匯率與產能配置是否推升獲利。" },
    ],
  },
};

const ROUTINE_KEYWORDS = [
  "股東常會",
  "董事會決議",
  "受邀參加",
  "法人說明會",
  "法說會",
  "補充說明",
  "更正",
  "公告申報",
  "注意交易資訊",
  "自行結算",
  "簡式公告",
  "背書保證",
  "資金貸與",
];

const CATALYST_KEYWORDS = [
  "取得",
  "處分",
  "擴建",
  "擴產",
  "增資",
  "投資",
  "合併",
  "收購",
  "策略合作",
  "簽約",
  "接單",
  "訂單",
  "產能",
  "設備",
  "廠務工程",
  "專利",
  "量產",
  "建廠",
];

function pickValue(row, keys) {
  if (!row) return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replaceAll(",", "").replaceAll("%", "").replaceAll("+", "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "-") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function signedNumber(sign, value) {
  const number = normalizeNumber(value);
  if (number === null) return null;
  return String(sign || "").includes("-") ? -Math.abs(number) : number;
}

function formatLargeNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "無資料";
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(2)} 億`;
  if (abs >= 10000) return `${(value / 10000).toFixed(2)} 萬`;
  return value.toLocaleString("zh-TW");
}

function formatRevenueFromThousand(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "無資料";
  if (Math.abs(value) >= 100000) return `${(value / 100000).toFixed(2)} 億`;
  if (Math.abs(value) >= 10) return `${(value / 10).toFixed(2)} 萬`;
  return `${value.toLocaleString("zh-TW")} 千元`;
}

function rocDateToIso(raw) {
  const digits = String(raw || "").replaceAll("/", "").replaceAll("-", "").trim();
  if (!/^\d{7,8}$/.test(digits)) return String(raw || "");
  const year = Number(digits.slice(0, 3)) + 1911;
  const month = digits.slice(3, 5);
  const day = digits.slice(5, 7);
  return `${year}-${month}-${day}`;
}

function rocMonthToLabel(raw) {
  const digits = String(raw || "").replaceAll("/", "").replaceAll("-", "").trim();
  if (!/^\d{5}$/.test(digits)) return String(raw || "") || "無資料";
  const year = Number(digits.slice(0, 3)) + 1911;
  const month = digits.slice(3, 5);
  return `${year}-${month}`;
}

function mapByCode(rows, codeKey) {
  return new Map(rows.map((row) => [String(row[codeKey] || "").trim(), row]));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "tw-chain-terminal/1.0",
      accept: "application/json, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} @ ${url}`);
  }

  return response.json();
}

function parseMajorEntry(entry, market) {
  const code = String(pickValue(entry, ["公司代號", "SecuritiesCompanyCode"]) || "").trim();
  const companyName = String(pickValue(entry, ["公司名稱", "CompanyName"]) || "").trim();
  const subject = String(pickValue(entry, ["主旨", "主旨 ", "Subject"]) || "").trim();
  const date = rocDateToIso(pickValue(entry, ["發言日期", "Date", "事實發生日"]));
  const timeRaw = String(pickValue(entry, ["發言時間", "Time"]) || "").padStart(6, "0");
  const time = /^\d{6}$/.test(timeRaw)
    ? `${timeRaw.slice(0, 2)}:${timeRaw.slice(2, 4)}:${timeRaw.slice(4, 6)}`
    : "無資料";
  const summary = String(pickValue(entry, ["說明", "Summary"]) || "")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .trim();

  const isRoutine = ROUTINE_KEYWORDS.some((keyword) => subject.includes(keyword));
  const hasCatalyst = CATALYST_KEYWORDS.some(
    (keyword) => subject.includes(keyword) || summary.includes(keyword),
  );

  return {
    market,
    code,
    companyName,
    subject,
    date,
    time,
    summary,
    isRoutine,
    hasCatalyst,
  };
}

function computeSignal(item, listKey) {
  const yoy = item.revenueYoY ?? -999;
  const mom = item.revenueMoM ?? -999;
  const cumulative = item.cumulativeYoY ?? -999;
  const priceChange = item.priceChange ?? 0;
  let score = 0;

  if (yoy >= 30) score += 4;
  else if (yoy >= 15) score += 3;
  else if (yoy >= 5) score += 2;
  else if (yoy >= 0) score += 1;
  else if (yoy <= -20) score -= 3;
  else if (yoy < 0) score -= 1;

  if (mom >= 10) score += 2;
  else if (mom >= 0) score += 1;
  else if (mom <= -10) score -= 2;
  else if (mom < 0) score -= 1;

  if (cumulative >= 20) score += 2;
  else if (cumulative >= 5) score += 1;
  else if (cumulative <= -10) score -= 1;

  if (priceChange > 3) score += 1;
  else if (priceChange < -3) score -= 1;

  if (item.announcementCount > 0) score += 1;
  if (item.catalystCount > 0) score += 1;
  if (item.tradeValue !== null && item.tradeValue >= 1000000000) score += 1;

  if (listKey === "semiconductor" && item.chain.includes("設備") && yoy >= 15) score += 1;
  if (listKey === "nonElectronics" && item.chain.includes("航運") && mom >= 5) score += 1;

  score = Math.max(0, Math.min(10, score));

  if (score >= 8) return { score, label: "強訊號", tone: "strong" };
  if (score >= 5) return { score, label: "正向觀察", tone: "positive" };
  if (score >= 3) return { score, label: "中性監看", tone: "neutral" };
  return { score, label: "偏弱等待", tone: "negative" };
}

function resolveMarketRow(code, preferredMarket, maps) {
  const preferred = maps[preferredMarket]?.get(code) || null;
  if (preferred) return { row: preferred, market: preferredMarket };

  const fallbackMarket = preferredMarket === "listed" ? "otc" : "listed";
  const fallback = maps[fallbackMarket]?.get(code) || null;
  if (fallback) return { row: fallback, market: fallbackMarket };

  return { row: null, market: preferredMarket };
}

function buildWatchlist(listKey, revenueMaps, quoteMaps, majorByCode, tpexInstiMap) {
  const definition = WATCHLISTS[listKey];

  const items = definition.companies.map((company) => {
    const revenueMatch = resolveMarketRow(company.code, company.market, revenueMaps);
    const quoteMatch = resolveMarketRow(company.code, revenueMatch.market, quoteMaps);
    const market = quoteMatch.row ? quoteMatch.market : revenueMatch.market;
    const revenueRow = revenueMatch.row;
    const quoteRow = quoteMatch.row;
    const announcements = (majorByCode.get(company.code) || []).slice(0, 3);
    const otcInsti = market === "otc" ? tpexInstiMap.get(company.code) : null;

    const item = {
      code: company.code,
      market,
      name: String(pickValue(revenueRow || quoteRow || {}, ["公司名稱", "Name", "CompanyName"]) || company.code).trim(),
      industry: String(pickValue(revenueRow || {}, ["產業別"]) || "未分類").trim(),
      chain: company.chain,
      focus: company.focus,
      note: company.note,
      dataMonth: rocMonthToLabel(pickValue(revenueRow || {}, ["資料年月"])),
      revenue: normalizeNumber(pickValue(revenueRow || {}, ["營業收入-當月營收"])),
      revenueMoM: normalizeNumber(pickValue(revenueRow || {}, ["營業收入-上月比較增減(%)"])),
      revenueYoY: normalizeNumber(pickValue(revenueRow || {}, ["營業收入-去年同月增減(%)"])),
      cumulativeYoY: normalizeNumber(pickValue(revenueRow || {}, ["累計營業收入-前期比較增減(%)"])),
      closingPrice: normalizeNumber(pickValue(quoteRow || {}, ["ClosingPrice", "Close"])),
      priceChange:
        normalizeNumber(pickValue(quoteRow || {}, ["Change"])) ??
        signedNumber(pickValue(quoteRow || {}, ["漲跌"]), pickValue(quoteRow || {}, ["漲跌點數"])),
      tradeValue: normalizeNumber(pickValue(quoteRow || {}, ["TradeValue", "TransactionAmount"])),
      announcementCount: announcements.length,
      catalystCount: announcements.filter((entry) => entry.hasCatalyst).length,
      announcements,
      otcInstitutionNet: normalizeNumber(
        pickValue(otcInsti || {}, [
          "TotalDifference",
          "ForeignInvestorsInclude MainlandAreaInvestors-Difference",
          "Foreign Investors include Mainland Area Investors (Foreign Dealers excluded)-Difference",
        ]),
      ),
    };

    item.signal = computeSignal(item, listKey);
    item.revenueDisplay = formatRevenueFromThousand(item.revenue);
    item.tradeValueDisplay = formatLargeNumber(item.tradeValue);
    item.otcInstitutionNetDisplay = formatLargeNumber(item.otcInstitutionNet);
    return item;
  });

  const sortedItems = [...items].sort((left, right) => {
    if (right.signal.score !== left.signal.score) return right.signal.score - left.signal.score;
    if ((right.revenueYoY ?? -999) !== (left.revenueYoY ?? -999)) {
      return (right.revenueYoY ?? -999) - (left.revenueYoY ?? -999);
    }
    return (right.tradeValue ?? 0) - (left.tradeValue ?? 0);
  });

  const metrics = {
    total: sortedItems.length,
    strong: sortedItems.filter((item) => item.signal.tone === "strong").length,
    positive: sortedItems.filter((item) => item.signal.tone === "positive").length,
    neutral: sortedItems.filter((item) => item.signal.tone === "neutral").length,
    negative: sortedItems.filter((item) => item.signal.tone === "negative").length,
    withCatalyst: sortedItems.filter((item) => item.catalystCount > 0).length,
  };

  return {
    key: listKey,
    title: definition.title,
    summary: definition.summary,
    cadence: definition.cadence,
    metrics,
    items: sortedItems,
    topIdeas: sortedItems.slice(0, 4),
  };
}

async function buildDashboardPayload() {
  const [
    twseRevenue,
    tpexRevenue,
    twseMajor,
    tpexMajor,
    twseQuotes,
    tpexQuotes,
    twseIndices,
    tpexHighlightRows,
    tpexInstiSummary,
    tpexInstiDetail,
  ] = await Promise.all([
    fetchJson(SOURCES.twseRevenue),
    fetchJson(SOURCES.tpexRevenue),
    fetchJson(SOURCES.twseMajor),
    fetchJson(SOURCES.tpexMajor),
    fetchJson(SOURCES.twseQuotes),
    fetchJson(SOURCES.tpexQuotes),
    fetchJson(SOURCES.twseIndices),
    fetchJson(SOURCES.tpexHighlight),
    fetchJson(SOURCES.tpexInstiSummary),
    fetchJson(SOURCES.tpexInstiDetail),
  ]);

  const revenueMaps = {
    listed: mapByCode(twseRevenue, "公司代號"),
    otc: mapByCode(tpexRevenue, "公司代號"),
  };

  const quoteMaps = {
    listed: mapByCode(twseQuotes, "Code"),
    otc: mapByCode(tpexQuotes, "SecuritiesCompanyCode"),
  };

  const majorEntries = [
    ...twseMajor.map((entry) => parseMajorEntry(entry, "listed")),
    ...tpexMajor.map((entry) => parseMajorEntry(entry, "otc")),
  ]
    .filter((entry) => entry.code)
    .sort((left, right) => `${right.date} ${right.time}`.localeCompare(`${left.date} ${left.time}`));

  const watchCodes = new Set(
    Object.values(WATCHLISTS).flatMap((list) => list.companies.map((company) => company.code)),
  );

  const majorByCode = new Map();
  for (const entry of majorEntries) {
    if (!watchCodes.has(entry.code) || entry.isRoutine) continue;
    if (!majorByCode.has(entry.code)) majorByCode.set(entry.code, []);
    if (majorByCode.get(entry.code).length < 5) {
      majorByCode.get(entry.code).push(entry);
    }
  }

  const tpexInstiMap = mapByCode(tpexInstiDetail, "SecuritiesCompanyCode");
  const taiex =
    twseIndices.find((item) => String(item["指數"] || "").includes("發行量加權股價指數")) ||
    twseIndices.find((item) => String(item["指數"] || "").includes("寶島股價指數")) ||
    twseIndices[0];
  const otcOverview = Array.isArray(tpexHighlightRows) ? tpexHighlightRows[0] : tpexHighlightRows;
  const otcClose = normalizeNumber(otcOverview?.CloseIndex);
  const otcChange = normalizeNumber(otcOverview?.IndexChange);
  const otcPreviousClose = otcClose !== null && otcChange !== null ? otcClose - otcChange : null;

  const payload = {
    generatedAt: new Date().toISOString(),
    marketOverview: {
      listed: {
        label: "加權指數",
        date: rocDateToIso(taiex?.["日期"]),
        close: normalizeNumber(taiex?.["收盤指數"]),
        change: signedNumber(taiex?.["漲跌"], taiex?.["漲跌點數"]),
        changePct: signedNumber(taiex?.["漲跌"], taiex?.["漲跌百分比"]),
      },
      otc: {
        label: "櫃買指數",
        date: rocDateToIso(otcOverview?.Date),
        close: otcClose,
        change: otcChange,
        changePct:
          otcPreviousClose && otcChange !== null
            ? Number(((otcChange / otcPreviousClose) * 100).toFixed(2))
            : null,
        riseCount: normalizeNumber(otcOverview?.PriceRiseCompanyNumbers),
        fallCount: normalizeNumber(otcOverview?.PriceDeclineCompanyNumbers),
        flatCount: normalizeNumber(otcOverview?.PriceFlatCompanyNumbers),
      },
      otcInstitutionSummary: tpexInstiSummary.map((item) => ({
        investor: item.Investor,
        net: normalizeNumber(item.Net),
      })),
    },
    sourceStatus: {
      monthlyRevenueMonth: rocMonthToLabel(
        pickValue(twseRevenue[0] || {}, ["資料年月"]) || pickValue(tpexRevenue[0] || {}, ["資料年月"]),
      ),
      twseMajorDate: rocDateToIso(pickValue(twseMajor[0] || {}, ["發言日期", "出表日期"])),
      tpexMajorDate: rocDateToIso(pickValue(tpexMajor[0] || {}, ["發言日期", "Date"])),
    },
  };

  payload.lists = {
    semiconductor: buildWatchlist("semiconductor", revenueMaps, quoteMaps, majorByCode, tpexInstiMap),
    nonElectronics: buildWatchlist("nonElectronics", revenueMaps, quoteMaps, majorByCode, tpexInstiMap),
  };

  payload.announcements = majorEntries
    .filter((entry) => watchCodes.has(entry.code) && !entry.isRoutine)
    .slice(0, 20);

  return payload;
}

await mkdir(dataDir, { recursive: true });
const payload = await buildDashboardPayload();
await writeFile(dataFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`wrote ${dataFile}`);
