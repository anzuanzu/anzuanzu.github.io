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

const ELECTRONICS_KEYWORDS = [
  "半導體",
  "電子零組件",
  "電腦及週邊設備",
  "光電",
  "通信網路",
  "電子通路",
  "資訊服務",
  "其他電子",
  "數位雲端",
];

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

const WATCH_META = new Map(
  Object.entries(WATCHLISTS).flatMap(([lens, definition]) =>
    definition.companies.map((company) => [company.code, { ...company, lens }]),
  ),
);
const MIN_BOARD_REVENUE = 100000;
const MIN_SIGNAL_REVENUE = 50000;

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

function formatSignedNumber(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "無資料";
  return `${value > 0 ? "+" : value < 0 ? "" : ""}${value.toFixed(digits)}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "無資料";
  return `${value > 0 ? "+" : value < 0 ? "" : ""}${value.toFixed(2)}%`;
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
      "user-agent": "tw-chain-terminal-v2/1.0",
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

function resolveLens(code, industry, watchMeta) {
  if (watchMeta) {
    return {
      lens: watchMeta.lens,
      lensLabel: WATCHLISTS[watchMeta.lens].title,
      chain: watchMeta.chain,
      focus: watchMeta.focus,
      note: watchMeta.note,
      watchlist: true,
    };
  }

  const safeIndustry = String(industry || "未分類").trim();

  if (safeIndustry.includes("半導體")) {
    return {
      lens: "semiconductor",
      lensLabel: WATCHLISTS.semiconductor.title,
      chain: safeIndustry,
      focus: "全市場半導體掃描",
      note: "非核心觀察池，來自全市場掃描。",
      watchlist: false,
    };
  }

  if (!ELECTRONICS_KEYWORDS.some((keyword) => safeIndustry.includes(keyword))) {
    return {
      lens: "nonElectronics",
      lensLabel: WATCHLISTS.nonElectronics.title,
      chain: safeIndustry,
      focus: "全市場非電子掃描",
      note: "非核心觀察池，來自全市場掃描。",
      watchlist: false,
    };
  }

  return {
    lens: "market",
    lensLabel: "全市場",
    chain: safeIndustry,
    focus: "全市場掃描",
    note: "非核心觀察池，僅納入全市場排行。",
    watchlist: false,
  };
}

function compactDriver(label, impact, weight) {
  return { label, impact, weight };
}

function computeSignal(item) {
  const drivers = [];
  let score = 0;

  if (item.revenueYoY >= 40) {
    score += 4;
    drivers.push(compactDriver("營收年增超過 40%", "positive", 4));
  } else if (item.revenueYoY >= 20) {
    score += 3;
    drivers.push(compactDriver("營收年增超過 20%", "positive", 3));
  } else if (item.revenueYoY >= 8) {
    score += 2;
    drivers.push(compactDriver("營收年增轉強", "positive", 2));
  } else if (item.revenueYoY >= 0) {
    score += 1;
    drivers.push(compactDriver("營收維持正成長", "positive", 1));
  } else if (item.revenueYoY <= -20) {
    score -= 3;
    drivers.push(compactDriver("營收年減超過 20%", "negative", -3));
  } else if (item.revenueYoY < 0) {
    score -= 1;
    drivers.push(compactDriver("營收年減", "negative", -1));
  }

  if (item.revenueMoM >= 10) {
    score += 2;
    drivers.push(compactDriver("營收月增超過 10%", "positive", 2));
  } else if (item.revenueMoM >= 0) {
    score += 1;
    drivers.push(compactDriver("營收月增為正", "positive", 1));
  } else if (item.revenueMoM <= -10) {
    score -= 2;
    drivers.push(compactDriver("營收月減超過 10%", "negative", -2));
  } else if (item.revenueMoM < 0) {
    score -= 1;
    drivers.push(compactDriver("營收月減", "negative", -1));
  }

  if (item.cumulativeYoY >= 20) {
    score += 2;
    drivers.push(compactDriver("累計營收趨勢強", "positive", 2));
  } else if (item.cumulativeYoY >= 5) {
    score += 1;
    drivers.push(compactDriver("累計營收維持改善", "positive", 1));
  } else if (item.cumulativeYoY <= -10) {
    score -= 1;
    drivers.push(compactDriver("累計營收仍在下行", "negative", -1));
  }

  if (item.priceChange >= 3) {
    score += 1;
    drivers.push(compactDriver("股價日變動偏強", "positive", 1));
  } else if (item.priceChange <= -3) {
    score -= 1;
    drivers.push(compactDriver("股價日變動偏弱", "negative", -1));
  }

  if (item.catalystCount > 0) {
    score += 1;
    drivers.push(compactDriver("近期有重大訊息催化", "positive", 1));
  }

  if (item.tradeValue !== null && item.tradeValue >= 2000000000) {
    score += 1;
    drivers.push(compactDriver("成交值高於 20 億", "positive", 1));
  }

  if (item.lens === "semiconductor" && item.chain.includes("設備") && item.revenueYoY >= 15) {
    score += 1;
    drivers.push(compactDriver("設備環節與景氣轉折同步", "positive", 1));
  }

  if (item.lens === "nonElectronics" && /航運|航空|物流/.test(item.chain) && item.revenueMoM >= 5) {
    score += 1;
    drivers.push(compactDriver("運輸鏈月增動能轉強", "positive", 1));
  }

  if (item.market === "otc" && item.otcInstitutionNet !== null) {
    if (item.otcInstitutionNet >= 2000) {
      score += 1;
      drivers.push(compactDriver("櫃買法人買超", "positive", 1));
    } else if (item.otcInstitutionNet <= -2000) {
      score -= 1;
      drivers.push(compactDriver("櫃買法人賣超", "negative", -1));
    }
  }

  score = Math.max(0, Math.min(10, score));

  if (score >= 8) return { score, label: "強訊號", tone: "strong", drivers };
  if (score >= 6) return { score, label: "正向觀察", tone: "positive", drivers };
  if (score >= 4) return { score, label: "中性監看", tone: "neutral", drivers };
  return { score, label: "偏弱等待", tone: "negative", drivers };
}

function buildAlertFlags(item) {
  const flags = [];

  const hasMeaningfulRevenue = item.revenue !== null && item.revenue >= MIN_BOARD_REVENUE;

  if ((hasMeaningfulRevenue || item.watchlist) && item.signal.score >= 8 && item.catalystCount > 0) {
    flags.push("strongWithCatalyst");
  }
  if ((hasMeaningfulRevenue || item.watchlist) && item.revenueYoY >= 30 && (item.priceChange === null || item.priceChange <= 1)) {
    flags.push("revenuePriceLag");
  }
  if ((hasMeaningfulRevenue || item.watchlist) && item.revenueYoY <= -15 && item.priceChange >= 2) {
    flags.push("priceAheadOfFundamentals");
  }
  if ((hasMeaningfulRevenue || item.watchlist) && item.tradeValue >= 2000000000 && item.catalystCount > 0) {
    flags.push("eventDrivenVolume");
  }
  if (item.market === "otc" && item.otcInstitutionNet >= 2000) flags.push("otcInstitutionSupport");

  return flags;
}

function resolveMarketRow(code, preferredMarket, maps) {
  const preferred = maps[preferredMarket]?.get(code) || null;
  if (preferred) return { row: preferred, market: preferredMarket };

  const fallbackMarket = preferredMarket === "listed" ? "otc" : "listed";
  const fallback = maps[fallbackMarket]?.get(code) || null;
  if (fallback) return { row: fallback, market: fallbackMarket };

  return { row: null, market: preferredMarket };
}

function buildCompanyItem({
  code,
  market,
  revenueRow,
  quoteRow,
  announcements,
  otcInsti,
  watchMeta,
}) {
  const name = String(
    pickValue(revenueRow || quoteRow || {}, ["公司名稱", "Name", "CompanyName", "SecuritiesCompanyName"]) || code,
  ).trim();
  const industry = String(
    pickValue(revenueRow || quoteRow || {}, ["產業別", "Category"]) || "未分類",
  ).trim();
  const lensInfo = resolveLens(code, industry, watchMeta);

  const item = {
    code,
    market,
    marketLabel: market === "listed" ? "上市" : "上櫃",
    name,
    industry,
    lens: lensInfo.lens,
    lensLabel: lensInfo.lensLabel,
    watchlist: lensInfo.watchlist,
    chain: lensInfo.chain,
    focus: lensInfo.focus,
    note: lensInfo.note,
    dataMonth: rocMonthToLabel(pickValue(revenueRow || {}, ["資料年月"])),
    revenue: normalizeNumber(pickValue(revenueRow || {}, ["營業收入-當月營收"])),
    revenueMoM: normalizeNumber(pickValue(revenueRow || {}, ["營業收入-上月比較增減(%)"])),
    revenueYoY: normalizeNumber(pickValue(revenueRow || {}, ["營業收入-去年同月增減(%)"])),
    cumulativeYoY: normalizeNumber(pickValue(revenueRow || {}, ["累計營業收入-前期比較增減(%)"])),
    closingPrice: normalizeNumber(pickValue(quoteRow || {}, ["ClosingPrice", "Close"])),
    priceChange:
      normalizeNumber(pickValue(quoteRow || {}, ["Change"])) ??
      signedNumber(pickValue(quoteRow || {}, ["漲跌"]), pickValue(quoteRow || {}, ["漲跌點數"])),
    tradeValue: normalizeNumber(
      pickValue(quoteRow || {}, ["TradeValue", "TransactionAmount", "TradingValue"]),
    ),
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

  item.signal = computeSignal(item);
  item.alertFlags = buildAlertFlags(item);
  item.revenueDisplay = formatRevenueFromThousand(item.revenue);
  item.tradeValueDisplay = formatLargeNumber(item.tradeValue);
  item.otcInstitutionNetDisplay = formatLargeNumber(item.otcInstitutionNet);
  item.priceChangeDisplay = formatSignedNumber(item.priceChange);
  item.revenueYoYDisplay = formatPercent(item.revenueYoY);
  item.revenueMoMDisplay = formatPercent(item.revenueMoM);
  item.cumulativeYoYDisplay = formatPercent(item.cumulativeYoY);
  item.searchText = `${item.code} ${item.name} ${item.industry} ${item.chain} ${item.focus}`.toLowerCase();
  return item;
}

function sortUniverse(items) {
  return [...items].sort((left, right) => {
    if (right.signal.score !== left.signal.score) return right.signal.score - left.signal.score;
    if ((right.catalystCount ?? 0) !== (left.catalystCount ?? 0)) return right.catalystCount - left.catalystCount;
    if ((right.revenueYoY ?? -999) !== (left.revenueYoY ?? -999)) {
      return (right.revenueYoY ?? -999) - (left.revenueYoY ?? -999);
    }
    return (right.tradeValue ?? 0) - (left.tradeValue ?? 0);
  });
}

function compactRow(item) {
  return {
    code: item.code,
    name: item.name,
    market: item.market,
    marketLabel: item.marketLabel,
    industry: item.industry,
    lens: item.lens,
    lensLabel: item.lensLabel,
    watchlist: item.watchlist,
    chain: item.chain,
    focus: item.focus,
    signal: item.signal,
    revenueDisplay: item.revenueDisplay,
    revenueYoY: item.revenueYoY,
    revenueYoYDisplay: item.revenueYoYDisplay,
    revenueMoM: item.revenueMoM,
    revenueMoMDisplay: item.revenueMoMDisplay,
    cumulativeYoY: item.cumulativeYoY,
    cumulativeYoYDisplay: item.cumulativeYoYDisplay,
    closingPrice: item.closingPrice,
    priceChange: item.priceChange,
    priceChangeDisplay: item.priceChangeDisplay,
    tradeValue: item.tradeValue,
    tradeValueDisplay: item.tradeValueDisplay,
    catalystCount: item.catalystCount,
    announcementCount: item.announcementCount,
    dataMonth: item.dataMonth,
    alertFlags: item.alertFlags,
  };
}

function buildStrategy(listKey, itemsByCode) {
  const definition = WATCHLISTS[listKey];
  const items = sortUniverse(
    definition.companies
      .map((company) => itemsByCode.get(company.code))
      .filter(Boolean),
  );

  const metrics = {
    total: items.length,
    strong: items.filter((item) => item.signal.tone === "strong").length,
    positive: items.filter((item) => item.signal.tone === "positive").length,
    neutral: items.filter((item) => item.signal.tone === "neutral").length,
    negative: items.filter((item) => item.signal.tone === "negative").length,
    withCatalyst: items.filter((item) => item.catalystCount > 0).length,
    avgScore:
      items.length > 0
        ? Number((items.reduce((sum, item) => sum + item.signal.score, 0) / items.length).toFixed(2))
        : null,
  };

  return {
    key: listKey,
    title: definition.title,
    summary: definition.summary,
    cadence: definition.cadence,
    metrics,
    items: items.map(compactRow),
    topIdeas: items.slice(0, 5).map(compactRow),
  };
}

function topBy(items, predicate, compare, limit = 12) {
  return items.filter(predicate).sort(compare).slice(0, limit).map(compactRow);
}

function buildAlerts(items) {
  const alerts = [];

  for (const item of items) {
    if (item.alertFlags.includes("strongWithCatalyst")) {
      alerts.push({
        level: "high",
        title: "強訊號 + 催化事件",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 同時具備高分訊號與近期重大催化，適合優先驗證。`,
      });
    }

    if (item.alertFlags.includes("revenuePriceLag")) {
      alerts.push({
        level: "medium",
        title: "營收強但價格未充分反映",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 營收年增強，但股價日變動仍偏平，需檢查市場是否尚未形成共識。`,
      });
    }

    if (item.alertFlags.includes("priceAheadOfFundamentals")) {
      alerts.push({
        level: "medium",
        title: "價格領先基本面",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 基本面仍偏弱，但價格偏強，需提防敘事交易過熱。`,
      });
    }

    if (item.alertFlags.includes("eventDrivenVolume")) {
      alerts.push({
        level: "high",
        title: "事件驅動成交放大",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 近期催化伴隨大量成交，適合納入盤後追蹤與隔日計畫。`,
      });
    }

    if (item.alertFlags.includes("otcInstitutionSupport")) {
      alerts.push({
        level: "low",
        title: "櫃買法人支持",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 出現櫃買法人買超，適合作為籌碼面輔助驗證。`,
      });
    }
  }

  const priority = { high: 3, medium: 2, low: 1 };
  return alerts
    .sort((left, right) => {
      if (priority[right.level] !== priority[left.level]) return priority[right.level] - priority[left.level];
      return right.signalScore - left.signalScore;
    })
    .slice(0, 24);
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

  const majorByCode = new Map();
  for (const entry of majorEntries) {
    if (entry.isRoutine) continue;
    if (!majorByCode.has(entry.code)) majorByCode.set(entry.code, []);
    if (majorByCode.get(entry.code).length < 4) {
      majorByCode.get(entry.code).push(entry);
    }
  }

  const tpexInstiMap = mapByCode(tpexInstiDetail, "SecuritiesCompanyCode");
  const items = [];

  for (const row of twseRevenue) {
    const code = String(row["公司代號"] || "").trim();
    if (!code) continue;
    items.push(
      buildCompanyItem({
        code,
        market: "listed",
        revenueRow: row,
        quoteRow: quoteMaps.listed.get(code),
        announcements: majorByCode.get(code) || [],
        otcInsti: null,
        watchMeta: WATCH_META.get(code),
      }),
    );
  }

  for (const row of tpexRevenue) {
    const code = String(row["公司代號"] || "").trim();
    if (!code) continue;
    items.push(
      buildCompanyItem({
        code,
        market: "otc",
        revenueRow: row,
        quoteRow: quoteMaps.otc.get(code),
        announcements: majorByCode.get(code) || [],
        otcInsti: tpexInstiMap.get(code),
        watchMeta: WATCH_META.get(code),
      }),
    );
  }

  for (const [code, watchMeta] of WATCH_META) {
    if (items.some((item) => item.code === code)) continue;
    const revenueMatch = resolveMarketRow(code, watchMeta.market, revenueMaps);
    const quoteMatch = resolveMarketRow(code, revenueMatch.market, quoteMaps);
    items.push(
      buildCompanyItem({
        code,
        market: quoteMatch.row ? quoteMatch.market : revenueMatch.market,
        revenueRow: revenueMatch.row,
        quoteRow: quoteMatch.row,
        announcements: majorByCode.get(code) || [],
        otcInsti: tpexInstiMap.get(code),
        watchMeta,
      }),
    );
  }

  const sortedUniverse = sortUniverse(items);
  const itemsByCode = new Map(sortedUniverse.map((item) => [item.code, item]));
  const taiex =
    twseIndices.find((item) => String(item["指數"] || "").includes("發行量加權股價指數")) ||
    twseIndices.find((item) => String(item["指數"] || "").includes("寶島股價指數")) ||
    twseIndices[0];
  const otcOverview = Array.isArray(tpexHighlightRows) ? tpexHighlightRows[0] : tpexHighlightRows;
  const otcClose = normalizeNumber(otcOverview?.CloseIndex);
  const otcChange = normalizeNumber(otcOverview?.IndexChange);
  const otcPreviousClose = otcClose !== null && otcChange !== null ? otcClose - otcChange : null;

  const breadth = {
    strong: sortedUniverse.filter((item) => item.signal.tone === "strong").length,
    positive: sortedUniverse.filter((item) => item.signal.tone === "positive").length,
    neutral: sortedUniverse.filter((item) => item.signal.tone === "neutral").length,
    negative: sortedUniverse.filter((item) => item.signal.tone === "negative").length,
  };

  const boards = {
    topSignal: topBy(
      sortedUniverse,
      (item) => item.signal.score >= 6 && ((item.revenue ?? 0) >= MIN_SIGNAL_REVENUE || item.watchlist),
      (left, right) => right.signal.score - left.signal.score || (right.revenueYoY ?? -999) - (left.revenueYoY ?? -999),
    ),
    semiconductorLeaders: topBy(
      sortedUniverse,
      (item) => item.lens === "semiconductor" && ((item.revenue ?? 0) >= MIN_SIGNAL_REVENUE || item.watchlist),
      (left, right) =>
        right.signal.score - left.signal.score ||
        (right.revenueYoY ?? -999) - (left.revenueYoY ?? -999) ||
        (right.tradeValue ?? 0) - (left.tradeValue ?? 0),
    ),
    nonElectronicsLeaders: topBy(
      sortedUniverse,
      (item) => item.lens === "nonElectronics" && ((item.revenue ?? 0) >= MIN_SIGNAL_REVENUE || item.watchlist),
      (left, right) =>
        right.signal.score - left.signal.score ||
        (right.revenueYoY ?? -999) - (left.revenueYoY ?? -999) ||
        (right.tradeValue ?? 0) - (left.tradeValue ?? 0),
    ),
    topTradeValue: topBy(
      sortedUniverse,
      (item) => item.tradeValue !== null && ((item.revenue ?? 0) >= MIN_SIGNAL_REVENUE || item.watchlist),
      (left, right) => (right.tradeValue ?? 0) - (left.tradeValue ?? 0),
    ),
    catalysts: topBy(
      sortedUniverse,
      (item) => item.catalystCount > 0 && ((item.revenue ?? 0) >= MIN_BOARD_REVENUE || item.watchlist),
      (left, right) =>
        right.catalystCount - left.catalystCount ||
        right.signal.score - left.signal.score ||
        (right.tradeValue ?? 0) - (left.tradeValue ?? 0),
    ),
    laggards: topBy(
      sortedUniverse,
      (item) => item.signal.score <= 4,
      (left, right) =>
        left.signal.score - right.signal.score ||
        (left.revenueYoY ?? 999) - (right.revenueYoY ?? 999),
    ),
  };

  const boardCodes = new Set(
    Object.values(boards).flatMap((rows) => rows.map((row) => row.code)),
  );
  const alerts = buildAlerts(sortedUniverse);
  const detailCodes = new Set([
    ...WATCH_META.keys(),
    ...boardCodes,
    ...alerts.map((alert) => alert.code),
    ...majorEntries.slice(0, 24).map((entry) => entry.code),
  ]);
  const detailEntries = [];

  for (const item of sortedUniverse) {
    if (!detailCodes.has(item.code)) continue;
    detailEntries.push([
      item.code,
      {
        code: item.code,
        market: item.market,
        marketLabel: item.marketLabel,
        name: item.name,
        industry: item.industry,
        lens: item.lens,
        lensLabel: item.lensLabel,
        watchlist: item.watchlist,
        chain: item.chain,
        focus: item.focus,
        note: item.note,
        dataMonth: item.dataMonth,
        revenueDisplay: item.revenueDisplay,
        revenueYoYDisplay: item.revenueYoYDisplay,
        revenueMoMDisplay: item.revenueMoMDisplay,
        cumulativeYoYDisplay: item.cumulativeYoYDisplay,
        closingPrice: item.closingPrice,
        priceChangeDisplay: item.priceChangeDisplay,
        tradeValueDisplay: item.tradeValueDisplay,
        otcInstitutionNetDisplay: item.otcInstitutionNetDisplay,
        catalystCount: item.catalystCount,
        announcementCount: item.announcementCount,
        alertFlags: item.alertFlags,
        announcements: item.announcements,
        signal: {
          score: item.signal.score,
          label: item.signal.label,
          tone: item.signal.tone,
          scoreDisplay: `${item.signal.score}/10`,
          drivers: item.signal.drivers,
        },
      },
    ]);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    marketOverview: {
      listed: {
        label: "加權指數",
        date: rocDateToIso(taiex?.["日期"]),
        close: normalizeNumber(taiex?.["收盤指數"]),
        closeDisplay: normalizeNumber(taiex?.["收盤指數"])?.toLocaleString("zh-TW") || "無資料",
        change: signedNumber(taiex?.["漲跌"], taiex?.["漲跌點數"]),
        changeDisplay: formatSignedNumber(signedNumber(taiex?.["漲跌"], taiex?.["漲跌點數"])),
        changePct: signedNumber(taiex?.["漲跌"], taiex?.["漲跌百分比"]),
        changePctDisplay: formatPercent(signedNumber(taiex?.["漲跌"], taiex?.["漲跌百分比"])),
      },
      otc: {
        label: "櫃買指數",
        date: rocDateToIso(otcOverview?.Date),
        close: otcClose,
        closeDisplay: otcClose?.toLocaleString("zh-TW") || "無資料",
        change: otcChange,
        changeDisplay: formatSignedNumber(otcChange),
        changePct:
          otcPreviousClose && otcChange !== null
            ? Number(((otcChange / otcPreviousClose) * 100).toFixed(2))
            : null,
        changePctDisplay: formatPercent(
          otcPreviousClose && otcChange !== null
            ? Number(((otcChange / otcPreviousClose) * 100).toFixed(2))
            : null,
        ),
        riseCount: normalizeNumber(otcOverview?.PriceRiseCompanyNumbers),
        fallCount: normalizeNumber(otcOverview?.PriceDeclineCompanyNumbers),
        flatCount: normalizeNumber(otcOverview?.PriceFlatCompanyNumbers),
      },
      breadth,
      otcInstitutionSummary: tpexInstiSummary.map((item) => ({
        investor: item.Investor,
        net: normalizeNumber(item.Net),
        netDisplay: formatLargeNumber(normalizeNumber(item.Net)),
      })),
    },
    sourceStatus: {
      monthlyRevenueMonth: rocMonthToLabel(
        pickValue(twseRevenue[0] || {}, ["資料年月"]) || pickValue(tpexRevenue[0] || {}, ["資料年月"]),
      ),
      twseMajorDate: rocDateToIso(pickValue(twseMajor[0] || {}, ["發言日期", "出表日期"])),
      tpexMajorDate: rocDateToIso(pickValue(tpexMajor[0] || {}, ["發言日期", "Date"])),
      universeSize: sortedUniverse.length,
    },
    coverage: {
      universeTotal: sortedUniverse.length,
      listedCount: sortedUniverse.filter((item) => item.market === "listed").length,
      otcCount: sortedUniverse.filter((item) => item.market === "otc").length,
      watchlistCount: sortedUniverse.filter((item) => item.watchlist).length,
      semiconductorLensCount: sortedUniverse.filter((item) => item.lens === "semiconductor").length,
      nonElectronicsLensCount: sortedUniverse.filter((item) => item.lens === "nonElectronics").length,
      breadth,
    },
    presets: [
      { key: "market", label: "全市場掃描" },
      { key: "semiconductor", label: "半導體鏈" },
      { key: "nonElectronics", label: "非電子鏈" },
      { key: "watchlist", label: "核心觀察池" },
      { key: "catalysts", label: "事件催化" },
      { key: "divergence", label: "量價背離" },
    ],
    boards,
    alerts,
    strategies: {
      semiconductor: buildStrategy("semiconductor", itemsByCode),
      nonElectronics: buildStrategy("nonElectronics", itemsByCode),
    },
    leaderboard: sortedUniverse.map(compactRow),
    detailByCode: Object.fromEntries(detailEntries),
    announcements: majorEntries.filter((entry) => !entry.isRoutine).slice(0, 32),
  };

  return payload;
}

await mkdir(dataDir, { recursive: true });
const payload = await buildDashboardPayload();
await writeFile(dataFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`wrote ${dataFile}`);
