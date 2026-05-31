import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const dataFile = path.join(dataDir, "dashboard.json");
const etfTrackDir = path.join(dataDir, "etf-tracks");
const sourceCacheDir = path.join(dataDir, "source-cache");
const execFileAsync = promisify(execFile);
const curlBinary = process.platform === "win32" ? "curl.exe" : "curl";
const browserUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const retryableHttpStatuses = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const sourceFetchStates = new Map();

const ETF_TRACKS = [
  {
    ticker: "00981A",
    name: "00981A 主動統一台股增長",
    issuer: "統一投信",
    fundCode: "49YTW",
    sourceUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=49YTW",
    historyFile: path.join(etfTrackDir, "00981A.json"),
  },
];

const ETF_TRACK_REGISTRY = [
  {
    ticker: "00981A",
    name: "00981A 主動統一台股增長",
    shortName: "主動台股增長",
    issuer: "統一投信",
    category: "Taiwan Active",
    fundCode: "49YTW",
    sourceUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=49YTW",
    sourceLabel: "Official issuer PCF / holdings page",
    sourceHost: "www.ezmoney.com.tw",
    historyFile: path.join(etfTrackDir, "00981A.json"),
  },
  {
    ticker: "00403A",
    name: "00403A 主動統一升級50",
    shortName: "主動升級50",
    issuer: "統一投信",
    category: "Taiwan Active",
    fundCode: "63YTW",
    sourceUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=63YTW",
    sourceLabel: "Official issuer PCF / holdings page",
    sourceHost: "www.ezmoney.com.tw",
    historyFile: path.join(etfTrackDir, "00403A.json"),
  },
  {
    ticker: "00939",
    name: "00939 統一台灣高息動能",
    shortName: "台灣高息動能",
    issuer: "統一投信",
    category: "Taiwan Equity",
    fundCode: "46YTW",
    sourceUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=46YTW",
    sourceLabel: "Official issuer PCF / holdings page",
    sourceHost: "www.ezmoney.com.tw",
    historyFile: path.join(etfTrackDir, "00939.json"),
  },
  {
    ticker: "009811",
    name: "009811 統一美國50",
    shortName: "美國50",
    issuer: "統一投信",
    category: "US Equity",
    fundCode: "50YTW",
    sourceUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=50YTW",
    sourceLabel: "Official issuer PCF / holdings page",
    sourceHost: "www.ezmoney.com.tw",
    historyFile: path.join(etfTrackDir, "009811.json"),
  },
  {
    ticker: "00757",
    name: "00757 統一FANG+",
    shortName: "FANG+",
    issuer: "統一投信",
    category: "US Tech",
    fundCode: "36YTW",
    sourceUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=36YTW",
    sourceLabel: "Official issuer PCF / holdings page",
    sourceHost: "www.ezmoney.com.tw",
    historyFile: path.join(etfTrackDir, "00757.json"),
  },
  {
    ticker: "00988A",
    name: "00988A 主動統一全球創新",
    shortName: "主動全球創新",
    issuer: "統一投信",
    category: "Global Active",
    fundCode: "61YTW",
    sourceUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=61YTW",
    sourceLabel: "Official issuer PCF / holdings page",
    sourceHost: "www.ezmoney.com.tw",
    historyFile: path.join(etfTrackDir, "00988A.json"),
  },
];

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

const EVENT_RULES = [
  { type: "new_order", label: "新接單", weight: 3, keywords: ["接單", "訂單", "長約", "簽約", "中標"] },
  { type: "capacity_expansion", label: "擴產建廠", weight: 3, keywords: ["擴產", "擴建", "建廠", "新廠", "新產線", "產能"] },
  { type: "mass_production", label: "量產出貨", weight: 3, keywords: ["量產", "試產", "導入", "出貨"] },
  { type: "strategic_partnership", label: "策略合作", weight: 2, keywords: ["策略合作", "合作備忘錄", "聯盟", "合資"] },
  { type: "mna", label: "併購收購", weight: 4, keywords: ["合併", "收購", "公開收購", "股權轉換"] },
  { type: "buyback", label: "庫藏股", weight: 2, keywords: ["庫藏股", "買回股份", "買回庫藏股"] },
  { type: "capital_raise", label: "增資籌資", weight: 2, keywords: ["現金增資", "增資", "私募", "可轉換公司債", "公司債", "GDR"] },
  { type: "asset_transaction", label: "資產交易", weight: 2, keywords: ["取得", "處分", "不動產", "廠房", "設備交易"] },
  { type: "price_adjustment", label: "價格調整", weight: 2, keywords: ["漲價", "調漲", "報價", "價格調整"] },
  { type: "regulatory_approval", label: "法規核准", weight: 4, keywords: ["核准", "許可", "認證", "藥證", "許可證", "通過審查"] },
  { type: "supply_chain_shift", label: "供應鏈轉折", weight: 2, keywords: ["交期", "缺料", "去庫存", "庫存", "拉貨", "急單"] },
  { type: "governance_change", label: "治理異動", weight: 1, keywords: ["董事長", "經營權", "董事改選", "法人董事", "董監"] },
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sourceCacheFile(sourceKey) {
  return path.join(sourceCacheDir, `${sourceKey}.json`);
}

function isRetryableFetchError(error) {
  if (retryableHttpStatuses.has(error?.status)) return true;
  if (error?.name === "TypeError") return true;
  return false;
}

async function fetchJson(sourceKey, url, options = {}) {
  const { retries = 3, allowStaleCache = true } = options;
  const cacheFile = sourceCacheFile(sourceKey);
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "tw-chain-terminal-v2/1.0",
          accept: "application/json, text/plain, */*",
        },
      });

      if (!response.ok) {
        const error = new Error(`${response.status} ${response.statusText} @ ${url}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const fetchedAt = new Date().toISOString();
      await writeFile(cacheFile, `${JSON.stringify({ sourceKey, url, fetchedAt, data }, null, 2)}\n`, "utf8");
      sourceFetchStates.set(sourceKey, {
        status: "live",
        url,
        fetchedAt,
        attempts: attempt,
        cacheUsed: false,
      });
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < retries && isRetryableFetchError(error)) {
        await sleep(attempt * 1200);
        continue;
      }
      break;
    }
  }

  if (allowStaleCache) {
    const cached = await readJsonFileOr(cacheFile, null);
    if (cached?.data) {
      sourceFetchStates.set(sourceKey, {
        status: "stale-cache",
        url,
        fetchedAt: cached.fetchedAt || null,
        attempts: retries,
        cacheUsed: true,
        error: String(lastError?.message || lastError),
      });
      console.warn(
        `[source-cache] ${sourceKey} fell back to cached snapshot from ${cached.fetchedAt || "unknown time"} after ${String(lastError?.message || lastError)}`,
      );
      return cached.data;
    }
  }

  sourceFetchStates.set(sourceKey, {
    status: "failed",
    url,
    fetchedAt: null,
    attempts: retries,
    cacheUsed: false,
    error: String(lastError?.message || lastError),
  });
  throw lastError;
}

async function fetchHtmlWithCurl(url) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tw-chain-terminal-"));
  const cookieFile = path.join(tempDir, "cookies.txt");

  try {
    const { stdout } = await execFileAsync(
      curlBinary,
      [
        "-sS",
        "-L",
        "--compressed",
        "--max-redirs",
        "10",
        "-A",
        browserUserAgent,
        "-c",
        cookieFile,
        "-b",
        cookieFile,
        url,
      ],
      {
        maxBuffer: 24 * 1024 * 1024,
      },
    );
    return stdout;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function readJsonFileOr(filePath, fallbackValue) {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (error && error.code === "ENOENT") return fallbackValue;
    throw error;
  }
}

function decodeHtmlEntities(value) {
  if (value === null || value === undefined) return "";

  let output = String(value);
  for (let index = 0; index < 5; index += 1) {
    const decoded = output
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&nbsp;", " ");

    if (decoded === output) break;
    output = decoded;
  }

  return output;
}

function extractEmbeddedJson(html, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<div id="${escapedId}" data-content="([\\s\\S]*?)" style="display:none;"><\\/div>`);
  const match = html.match(regex);
  if (!match) {
    throw new Error(`Missing embedded payload: ${id}`);
  }
  return JSON.parse(decodeHtmlEntities(match[1]));
}

function formatHoldingWeight(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value.toFixed(2)}%`;
}

function formatWeightChange(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value > 0 ? "+" : value < 0 ? "" : ""}${value.toFixed(2)} pt`;
}

function formatShareCount(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return Math.round(value).toLocaleString("zh-TW");
}

function formatShareDelta(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value > 0 ? "+" : value < 0 ? "" : ""}${Math.round(value).toLocaleString("zh-TW")}`;
}

function normalizeEtfDetail(detail) {
  const weightPct = Number((normalizeNumber(detail.NavRate) || 0).toFixed(2));
  const shares = normalizeNumber(detail.Share) || 0;
  const amount = normalizeNumber(detail.Amount) || 0;
  const rawTranDate = String(detail.TranDate || "").slice(0, 10) || null;

  return {
    code: String(detail.DetailCode || "").trim(),
    name: String(detail.DetailName || "").trim(),
    rawTranDate,
    shares,
    sharesDisplay: formatShareCount(shares),
    amount,
    amountDisplay: formatLargeNumber(amount),
    weightPct,
    weightDisplay: formatHoldingWeight(weightPct),
    contractMonth: String(detail.MTH || "").trim() || null,
    position: String(detail.Position || "").trim() || null,
  };
}

function normalizeEtfBalance(asset) {
  const value = normalizeNumber(asset?.Value);
  return {
    code: String(asset?.AssetCode || "").trim(),
    name: String(asset?.AssetName || "").trim(),
    value,
    valueDisplay: formatLargeNumber(value),
  };
}

function compareEtfHoldings(currentHoldings, previousHoldings) {
  const currentMap = new Map(currentHoldings.map((holding) => [holding.code, holding]));
  const previousMap = new Map(previousHoldings.map((holding) => [holding.code, holding]));

  const added = [];
  const removed = [];
  const increased = [];
  const reduced = [];
  const unchanged = [];

  for (const current of currentHoldings) {
    const previous = previousMap.get(current.code);
    if (!previous) {
      added.push({
        code: current.code,
        name: current.name,
        currentShares: current.shares,
        currentSharesDisplay: current.sharesDisplay,
        currentWeightPct: current.weightPct,
        currentWeightDisplay: current.weightDisplay,
      });
      continue;
    }

    const shareDelta = Number((current.shares - previous.shares).toFixed(0));
    const weightDelta = Number((current.weightPct - previous.weightPct).toFixed(2));
    const entry = {
      code: current.code,
      name: current.name,
      currentShares: current.shares,
      currentSharesDisplay: current.sharesDisplay,
      previousShares: previous.shares,
      previousSharesDisplay: previous.sharesDisplay,
      shareDelta,
      shareDeltaDisplay: formatShareDelta(shareDelta),
      currentWeightPct: current.weightPct,
      currentWeightDisplay: current.weightDisplay,
      previousWeightPct: previous.weightPct,
      previousWeightDisplay: previous.weightDisplay,
      weightDelta,
      weightDeltaDisplay: formatWeightChange(weightDelta),
    };

    if (shareDelta > 0) {
      increased.push(entry);
    } else if (shareDelta < 0) {
      reduced.push(entry);
    } else {
      unchanged.push(entry);
    }
  }

  for (const previous of previousHoldings) {
    if (currentMap.has(previous.code)) continue;
    removed.push({
      code: previous.code,
      name: previous.name,
      previousShares: previous.shares,
      previousSharesDisplay: previous.sharesDisplay,
      previousWeightPct: previous.weightPct,
      previousWeightDisplay: previous.weightDisplay,
    });
  }

  const byCurrentWeight = (left, right) => (right.currentWeightPct ?? 0) - (left.currentWeightPct ?? 0);
  const byPreviousWeight = (left, right) => (right.previousWeightPct ?? 0) - (left.previousWeightPct ?? 0);
  const byAbsoluteWeightDelta = (left, right) =>
    Math.abs(right.weightDelta ?? 0) - Math.abs(left.weightDelta ?? 0) ||
    Math.abs(right.shareDelta ?? 0) - Math.abs(left.shareDelta ?? 0);

  added.sort(byCurrentWeight);
  removed.sort(byPreviousWeight);
  increased.sort(byAbsoluteWeightDelta);
  reduced.sort(byAbsoluteWeightDelta);
  unchanged.sort(byCurrentWeight);

  return {
    added,
    removed,
    increased,
    reduced,
    unchanged,
    topWeightUp: [...increased].sort((left, right) => (right.weightDelta ?? 0) - (left.weightDelta ?? 0)).slice(0, 8),
    topWeightDown: [...reduced].sort((left, right) => (left.weightDelta ?? 0) - (right.weightDelta ?? 0)).slice(0, 8),
  };
}

function summarizeEtfConcentration(holdings) {
  const top3 = holdings.slice(0, 3).reduce((sum, holding) => sum + (holding.weightPct || 0), 0);
  const top5 = holdings.slice(0, 5).reduce((sum, holding) => sum + (holding.weightPct || 0), 0);
  const top10 = holdings.slice(0, 10).reduce((sum, holding) => sum + (holding.weightPct || 0), 0);

  return {
    top3Pct: Number(top3.toFixed(2)),
    top5Pct: Number(top5.toFixed(2)),
    top10Pct: Number(top10.toFixed(2)),
    top3Display: formatHoldingWeight(top3),
    top5Display: formatHoldingWeight(top5),
    top10Display: formatHoldingWeight(top10),
  };
}

function buildEtfWatchlistOverlap(holdings) {
  const overlapRows = holdings
    .map((holding) => {
      const watchMeta = WATCH_META.get(holding.code);
      if (!watchMeta) return null;
      return {
        code: holding.code,
        name: holding.name,
        weightPct: holding.weightPct,
        weightDisplay: holding.weightDisplay,
        sharesDisplay: holding.sharesDisplay,
        lens: watchMeta.lens,
        lensLabel: WATCHLISTS[watchMeta.lens].title,
        chain: watchMeta.chain,
        focus: watchMeta.focus,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.weightPct - left.weightPct);

  const semiconductorRows = overlapRows.filter((row) => row.lens === "semiconductor");
  const nonElectronicsRows = overlapRows.filter((row) => row.lens === "nonElectronics");

  return {
    totalCount: overlapRows.length,
    totalWeightPct: Number(overlapRows.reduce((sum, row) => sum + row.weightPct, 0).toFixed(2)),
    totalWeightDisplay: formatHoldingWeight(overlapRows.reduce((sum, row) => sum + row.weightPct, 0)),
    semiconductorCount: semiconductorRows.length,
    semiconductorWeightPct: Number(semiconductorRows.reduce((sum, row) => sum + row.weightPct, 0).toFixed(2)),
    semiconductorWeightDisplay: formatHoldingWeight(semiconductorRows.reduce((sum, row) => sum + row.weightPct, 0)),
    nonElectronicsCount: nonElectronicsRows.length,
    nonElectronicsWeightPct: Number(nonElectronicsRows.reduce((sum, row) => sum + row.weightPct, 0).toFixed(2)),
    nonElectronicsWeightDisplay: formatHoldingWeight(nonElectronicsRows.reduce((sum, row) => sum + row.weightPct, 0)),
    rows: overlapRows.slice(0, 12),
  };
}

function buildEtfTrendSeries(snapshots, limit = 6) {
  const latestHoldings = snapshots.at(-1)?.holdings || [];
  const trackedCodes = latestHoldings.slice(0, limit).map((holding) => holding.code);

  return trackedCodes.map((code) => {
    const latestHolding = latestHoldings.find((holding) => holding.code === code);
    const points = snapshots.map((snapshot) => {
      const holding = snapshot.holdings.find((entry) => entry.code === code);
      return {
        date: snapshot.snapshotDate,
        weightPct: Number(((holding?.weightPct || 0)).toFixed(2)),
        shares: holding?.shares || 0,
      };
    });
    const firstWeightPct = points[0]?.weightPct ?? 0;
    const latestWeightPct = points.at(-1)?.weightPct ?? 0;

    return {
      code,
      name: latestHolding?.name || code,
      latestWeightPct: Number(latestWeightPct.toFixed(2)),
      latestWeightDisplay: formatHoldingWeight(latestWeightPct),
      changeFromFirstPct: Number((latestWeightPct - firstWeightPct).toFixed(2)),
      changeFromFirstDisplay: formatWeightChange(latestWeightPct - firstWeightPct),
      points,
    };
  });
}

function buildEtfTrackPayload(track, snapshots) {
  const latestSnapshot = snapshots.at(-1) || null;
  const previousSnapshot = snapshots.length > 1 ? snapshots.at(-2) : null;
  const latestHoldings = latestSnapshot?.holdings || [];
  const comparison = previousSnapshot
    ? compareEtfHoldings(latestHoldings, previousSnapshot?.holdings || [])
    : {
        added: [],
        removed: [],
        increased: [],
        reduced: [],
        unchanged: [],
        topWeightUp: [],
        topWeightDown: [],
      };
  const concentration = summarizeEtfConcentration(latestHoldings);
  const watchlistOverlap = buildEtfWatchlistOverlap(latestHoldings);
  const trendSeries = buildEtfTrendSeries(snapshots);

  return {
    ticker: track.ticker,
    name: track.name,
    shortName: track.shortName || track.name,
    issuer: track.issuer,
    category: track.category || "ETF",
    fundCode: track.fundCode,
    sourceUrl: track.sourceUrl,
    sourceLabel: track.sourceLabel || "Official issuer holdings page",
    sourceHost: track.sourceHost || null,
    sourceKind: "official_raw",
    historyLength: snapshots.length,
    latestSnapshotDate: latestSnapshot?.snapshotDate || null,
    latestEditTime: latestSnapshot?.editTime || null,
    latestFetchedAt: latestSnapshot?.fetchedAt || null,
    previousSnapshotDate: previousSnapshot?.snapshotDate || null,
    navPerUnit: latestSnapshot?.navPerUnit ?? null,
    navPerUnitDisplay:
      latestSnapshot?.navPerUnit === null || latestSnapshot?.navPerUnit === undefined
        ? "--"
        : latestSnapshot.navPerUnit.toFixed(2),
    outstandingUnits: latestSnapshot?.outstandingUnits ?? null,
    outstandingUnitsDisplay: formatShareCount(latestSnapshot?.outstandingUnits ?? null),
    netAsset: latestSnapshot?.netAsset ?? null,
    netAssetDisplay: formatLargeNumber(latestSnapshot?.netAsset ?? null),
    holdingsCount: latestHoldings.length,
    futuresCount: latestSnapshot?.futures.length || 0,
    topHoldings: latestHoldings.slice(0, 10),
    futures: latestSnapshot?.futures || [],
    balances: latestSnapshot?.balances || [],
    concentration,
    watchlistOverlap,
    trendSeries,
    recentSnapshotDates: snapshots.slice(-10).map((snapshot) => snapshot.snapshotDate),
    operationTrail: {
      comparisonReady: Boolean(previousSnapshot),
      compareDate: latestSnapshot?.snapshotDate || null,
      baseDate: previousSnapshot?.snapshotDate || null,
      added: comparison.added.slice(0, 8),
      removed: comparison.removed.slice(0, 8),
      increased: comparison.increased.slice(0, 8),
      reduced: comparison.reduced.slice(0, 8),
      topWeightUp: comparison.topWeightUp,
      topWeightDown: comparison.topWeightDown,
      counts: {
        added: comparison.added.length,
        removed: comparison.removed.length,
        increased: comparison.increased.length,
        reduced: comparison.reduced.length,
        unchanged: comparison.unchanged.length,
      },
    },
  };
}

function buildEtfFlowRadar(trackDashboards) {
  const createBucket = () => new Map();
  const buckets = {
    consensusAdds: createBucket(),
    consensusCuts: createBucket(),
    newEntries: createBucket(),
    exits: createBucket(),
  };

  const upsertAggregate = (map, code, name) => {
    if (!map.has(code)) {
      const watchMeta = WATCH_META.get(code);
      map.set(code, {
        code,
        name,
        inUniverse: Boolean(DETAIL_META.get(code)),
        lens: watchMeta?.lens || null,
        lensLabel: watchMeta ? WATCHLISTS[watchMeta.lens].title : "Universe",
        chain: watchMeta?.chain || null,
        focus: watchMeta?.focus || null,
        etfs: new Set(),
        actionCounts: {
          added: 0,
          removed: 0,
          increased: 0,
          reduced: 0,
        },
        shareDelta: 0,
        weightDelta: 0,
        currentWeightPct: 0,
        previousWeightPct: 0,
      });
    }

    return map.get(code);
  };

  const addEntry = (map, track, row, action) => {
    const entry = upsertAggregate(map, row.code, row.name);
    entry.etfs.add(track.ticker);
    entry.actionCounts[action] += 1;

    if (action === "added") {
      entry.shareDelta += row.currentShares || 0;
      entry.weightDelta += row.currentWeightPct || 0;
      entry.currentWeightPct += row.currentWeightPct || 0;
      return;
    }

    if (action === "removed") {
      entry.shareDelta -= row.previousShares || 0;
      entry.weightDelta -= row.previousWeightPct || 0;
      entry.previousWeightPct += row.previousWeightPct || 0;
      return;
    }

    entry.shareDelta += row.shareDelta || 0;
    entry.weightDelta += row.weightDelta || 0;
    entry.currentWeightPct += row.currentWeightPct || 0;
    entry.previousWeightPct += row.previousWeightPct || 0;
  };

  const comparisonReadyTracks = trackDashboards.filter((track) => track.operationTrail?.comparisonReady);

  for (const track of comparisonReadyTracks) {
    for (const row of track.operationTrail?.increased || []) {
      addEntry(buckets.consensusAdds, track, row, "increased");
    }
    for (const row of track.operationTrail?.added || []) {
      addEntry(buckets.consensusAdds, track, row, "added");
      addEntry(buckets.newEntries, track, row, "added");
    }
    for (const row of track.operationTrail?.reduced || []) {
      addEntry(buckets.consensusCuts, track, row, "reduced");
    }
    for (const row of track.operationTrail?.removed || []) {
      addEntry(buckets.consensusCuts, track, row, "removed");
      addEntry(buckets.exits, track, row, "removed");
    }
  }

  const finalizeRows = (map, mode) => {
    const rows = Array.from(map.values()).map((entry) => {
      const etfList = Array.from(entry.etfs).sort();
      return {
        code: entry.code,
        name: entry.name,
        inUniverse: entry.inUniverse,
        lens: entry.lens,
        lensLabel: entry.lensLabel,
        chain: entry.chain,
        focus: entry.focus,
        etfCount: etfList.length,
        etfs: etfList,
        etfDisplay: etfList.join(" / "),
        shareDelta: Math.round(entry.shareDelta),
        shareDeltaDisplay: formatShareDelta(entry.shareDelta),
        weightDelta: Number(entry.weightDelta.toFixed(2)),
        weightDeltaDisplay: formatWeightChange(entry.weightDelta),
        currentWeightPct: Number(entry.currentWeightPct.toFixed(2)),
        currentWeightDisplay: formatHoldingWeight(entry.currentWeightPct),
        previousWeightPct: Number(entry.previousWeightPct.toFixed(2)),
        previousWeightDisplay: formatHoldingWeight(entry.previousWeightPct),
        actionCounts: entry.actionCounts,
      };
    });

    if (mode === "buy") {
      rows.sort(
        (left, right) =>
          right.etfCount - left.etfCount ||
          (right.weightDelta ?? 0) - (left.weightDelta ?? 0) ||
          (right.shareDelta ?? 0) - (left.shareDelta ?? 0),
      );
    } else if (mode === "sell") {
      rows.sort(
        (left, right) =>
          right.etfCount - left.etfCount ||
          Math.abs(right.weightDelta ?? 0) - Math.abs(left.weightDelta ?? 0) ||
          Math.abs(right.shareDelta ?? 0) - Math.abs(left.shareDelta ?? 0),
      );
    } else if (mode === "new") {
      rows.sort(
        (left, right) =>
          right.etfCount - left.etfCount ||
          (right.currentWeightPct ?? 0) - (left.currentWeightPct ?? 0),
      );
    } else if (mode === "exit") {
      rows.sort(
        (left, right) =>
          right.etfCount - left.etfCount ||
          (right.previousWeightPct ?? 0) - (left.previousWeightPct ?? 0),
      );
    }

    return rows.slice(0, 16);
  };

  const latestCompareDate =
    comparisonReadyTracks
      .map((track) => track.operationTrail?.compareDate)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  const touchedSet = new Set([
    ...buckets.consensusAdds.keys(),
    ...buckets.consensusCuts.keys(),
    ...buckets.newEntries.keys(),
    ...buckets.exits.keys(),
  ]);

  return {
    trackedCount: trackDashboards.length,
    comparisonReadyCount: comparisonReadyTracks.length,
    latestCompareDate,
    touchedCount: touchedSet.size,
    consensusAdds: finalizeRows(buckets.consensusAdds, "buy"),
    consensusCuts: finalizeRows(buckets.consensusCuts, "sell"),
    newEntries: finalizeRows(buckets.newEntries, "new"),
    exits: finalizeRows(buckets.exits, "exit"),
  };
}

async function fetchEtfTrack(track) {
  const html = await fetchHtmlWithCurl(track.sourceUrl);
  const assets = extractEmbeddedJson(html, "DataAsset");
  const stockAsset = assets.find((asset) => String(asset.AssetCode || "").toUpperCase() === "ST") || null;
  const futuresAsset = assets.find((asset) => String(asset.AssetCode || "").toUpperCase() === "GD") || null;
  const navAsset = assets.find((asset) => String(asset.AssetCode || "").toUpperCase() === "NAV") || null;
  const unitAsset = assets.find((asset) => String(asset.AssetCode || "").toUpperCase() === "OUT_UNIT") || null;
  const navPerUnitAsset = assets.find((asset) => String(asset.AssetCode || "").toUpperCase() === "P_UNIT") || null;

  const holdings = (stockAsset?.Details || [])
    .map(normalizeEtfDetail)
    .filter((detail) => detail.code)
    .sort((left, right) => right.weightPct - left.weightPct || right.amount - left.amount);
  const futures = (futuresAsset?.Details || [])
    .map(normalizeEtfDetail)
    .filter((detail) => detail.code)
    .sort((left, right) => right.weightPct - left.weightPct || right.amount - left.amount);
  const balances = assets
    .filter((asset) => ["CASH", "GDM", "PAY", "APAR", "RP"].includes(String(asset.AssetCode || "").toUpperCase()))
    .map(normalizeEtfBalance);
  const snapshotDate =
    holdings[0]?.rawTranDate ||
    futures[0]?.rawTranDate ||
    String(stockAsset?.EditDate || futuresAsset?.EditDate || navAsset?.EditDate || "").slice(0, 10) ||
    null;

  const snapshot = {
    snapshotDate,
    editTime:
      String(stockAsset?.EditDate || futuresAsset?.EditDate || navAsset?.EditDate || "").trim() || null,
    fetchedAt: new Date().toISOString(),
    navPerUnit: normalizeNumber(navPerUnitAsset?.Value),
    outstandingUnits: normalizeNumber(unitAsset?.Value),
    netAsset: normalizeNumber(navAsset?.Value),
    holdings,
    futures,
    balances,
  };

  return {
    track,
    snapshot,
  };
}

async function loadEtfTrackState(track) {
  const existing = await readJsonFileOr(track.historyFile, {
    ticker: track.ticker,
    name: track.name,
    issuer: track.issuer,
    fundCode: track.fundCode,
    sourceUrl: track.sourceUrl,
    sourceLabel: track.sourceLabel || null,
    sourceHost: track.sourceHost || null,
    snapshots: [],
  });
  let latest = null;

  try {
    latest = await fetchEtfTrack(track);
  } catch (error) {
    if ((existing.snapshots || []).length === 0) {
      throw error;
    }

    return {
      history: existing,
      dashboard: {
        ...buildEtfTrackPayload(track, existing.snapshots || []),
        staleReason: error.message,
      },
    };
  }

  const snapshots = [...(existing.snapshots || [])];
  const existingIndex = snapshots.findIndex((snapshot) => snapshot.snapshotDate === latest.snapshot.snapshotDate);

  if (existingIndex >= 0) {
    snapshots.splice(existingIndex, 1, latest.snapshot);
  } else {
    snapshots.push(latest.snapshot);
  }

  snapshots.sort((left, right) => String(left.snapshotDate).localeCompare(String(right.snapshotDate)));
  const trimmedSnapshots = snapshots.slice(-180);
  const history = {
    ticker: track.ticker,
    name: track.name,
    issuer: track.issuer,
    fundCode: track.fundCode,
    sourceUrl: track.sourceUrl,
    sourceLabel: track.sourceLabel || null,
    sourceHost: track.sourceHost || null,
    snapshots: trimmedSnapshots,
  };

  return {
    history,
    dashboard: buildEtfTrackPayload(track, trimmedSnapshots),
  };
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
  const text = `${subject} ${summary}`;
  const events = EVENT_RULES.flatMap((rule) => {
    const matchedKeywords = rule.keywords.filter((keyword) => text.includes(keyword));
    if (!matchedKeywords.length) return [];
    return [{
      type: rule.type,
      label: rule.label,
      weight: rule.weight,
      matchedKeywords,
    }];
  });
  const catalysts = events.filter((event) => event.weight >= 2);
  const hasCatalyst = catalysts.length > 0;

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
    events,
    catalysts,
    eventTypes: events.map((event) => event.type),
    catalystTypes: catalysts.map((event) => event.type),
    eventWeightTotal: events.reduce((sum, event) => sum + event.weight, 0),
    catalystWeightTotal: catalysts.reduce((sum, event) => sum + event.weight, 0),
    primaryEventLabel: events.sort((left, right) => right.weight - left.weight)[0]?.label || null,
  };
}

function isoDateDiffDays(dateA, dateB = new Date()) {
  if (!dateA) return null;
  const parsed = new Date(`${dateA}T00:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((dateB.getTime() - parsed.getTime()) / 86400000);
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

  if (item.eventScore >= 7) {
    score += 2;
    drivers.push(compactDriver("事件分數高，公告與價格確認度較完整", "positive", 2));
  } else if (item.eventScore >= 4) {
    score += 1;
    drivers.push(compactDriver("事件分數中高，適合排入優先追蹤", "positive", 1));
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

function computeEventScore(item) {
  const drivers = [];
  let score = 0;

  if (item.catalystWeightTotal >= 8) {
    score += 4;
    drivers.push(compactDriver("高權重事件密集", "positive", 4));
  } else if (item.catalystWeightTotal >= 5) {
    score += 3;
    drivers.push(compactDriver("多個中高權重事件", "positive", 3));
  } else if (item.catalystWeightTotal >= 2) {
    score += 2;
    drivers.push(compactDriver("具備可交易事件", "positive", 2));
  } else if (item.eventWeightTotal > 0) {
    score += 1;
    drivers.push(compactDriver("有事件但權重偏低", "neutral", 1));
  }

  if (item.maxEventWeight >= 4) {
    score += 2;
    drivers.push(compactDriver("存在高嚴重度事件", "positive", 2));
  } else if (item.maxEventWeight >= 3) {
    score += 1;
    drivers.push(compactDriver("存在中高嚴重度事件", "positive", 1));
  }

  if (item.daysSinceLatestEvent !== null) {
    if (item.daysSinceLatestEvent <= 3) {
      score += 1;
      drivers.push(compactDriver("事件在近 3 日內發生", "positive", 1));
    } else if (item.daysSinceLatestEvent <= 7) {
      score += 1;
      drivers.push(compactDriver("事件在近 7 日內發生", "positive", 1));
    }
  }

  if (item.catalystCount > 0 && item.tradeValue >= 2000000000) {
    score += 1;
    drivers.push(compactDriver("事件伴隨大量成交", "positive", 1));
  }

  if (item.catalystCount > 0 && item.priceChange >= 1) {
    score += 1;
    drivers.push(compactDriver("事件後價格有初步確認", "positive", 1));
  }

  if (
    item.eventTypes.length > 0 &&
    item.eventTypes.every((type) => type === "governance_change") &&
    item.catalystTypes.length === 0
  ) {
    score = Math.max(0, score - 1);
    drivers.push(compactDriver("治理異動偏行政事件", "negative", -1));
  }

  score = Math.max(0, Math.min(10, score));
  return { score, drivers };
}

function computeEventConfirmation(item) {
  if (item.catalystCount === 0) {
    return {
      level: "none",
      label: "無事件",
      note: "目前沒有可交易事件。",
    };
  }

  const recentEvent = item.daysSinceLatestEvent !== null && item.daysSinceLatestEvent <= 7;
  const strongPrice = item.priceChange !== null && item.priceChange >= 2;
  const weakPrice = item.priceChange !== null && item.priceChange <= -1;
  const strongVolume = item.tradeValue !== null && item.tradeValue >= 2000000000;

  if (recentEvent && strongPrice && strongVolume) {
    return {
      level: "confirmed",
      label: "已確認",
      note: "事件後價格與量能已有初步確認。",
    };
  }

  if (recentEvent && weakPrice) {
    return {
      level: "failed",
      label: "確認失敗",
      note: "事件後價格未跟進，需警覺敘事失效。",
    };
  }

  if (recentEvent) {
    return {
      level: "pending",
      label: "待確認",
      note: "事件已出現，但價格或量能確認仍不足。",
    };
  }

  return {
    level: "stale",
    label: "已鈍化",
    note: "事件已過觀察期，需回到基本面驗證。",
  };
}

function computeEventStrengthV2(item) {
  const drivers = [];
  let score = 0;

  if (item.catalystWeightTotal >= 8) {
    score += 3;
    drivers.push(compactDriver("Heavy catalyst cluster", "positive", 3));
  } else if (item.catalystWeightTotal >= 5) {
    score += 2;
    drivers.push(compactDriver("Multi-catalyst setup", "positive", 2));
  } else if (item.catalystWeightTotal >= 2) {
    score += 1;
    drivers.push(compactDriver("Tradeable catalyst exists", "positive", 1));
  } else if (item.eventWeightTotal > 0) {
    drivers.push(compactDriver("Event exists but catalyst weight is light", "neutral", 0));
  }

  if (item.maxEventWeight >= 3) {
    score += 1;
    drivers.push(compactDriver(item.maxEventWeight >= 4 ? "Primary event is high-impact" : "Primary event is meaningful", "positive", 1));
  }

  if (
    item.eventTypes.length > 0 &&
    item.eventTypes.every((type) => type === "governance_change") &&
    item.catalystTypes.length === 0
  ) {
    score = Math.max(0, score - 1);
    drivers.push(compactDriver("Governance-only event is usually weak", "negative", -1));
  }

  score = Math.max(0, Math.min(4, score));
  return {
    score,
    label: `${score}/4`,
    note:
      score >= 3
        ? "Event strength is high."
        : score >= 2
          ? "Event strength is actionable."
          : score >= 1
            ? "Event strength is light."
            : "No strong catalyst weight yet.",
    drivers,
  };
}

function computeMarketConfirmationV2(item) {
  if (item.catalystCount === 0) {
    return {
      score: 0,
      level: "none",
      label: "None",
      note: "No catalyst to confirm in price or turnover.",
      drivers: [compactDriver("No catalyst yet", "neutral", 0)],
    };
  }

  const recentEvent = item.daysSinceLatestEvent !== null && item.daysSinceLatestEvent <= 7;
  const staleWindow = item.daysSinceLatestEvent !== null && item.daysSinceLatestEvent <= 30;
  const strongPrice = item.priceChange !== null && item.priceChange >= 2;
  const modestPrice = item.priceChange !== null && item.priceChange >= 1;
  const weakPrice = item.priceChange !== null && item.priceChange <= -1;
  const strongVolume = item.tradeValue !== null && item.tradeValue >= 2000000000;
  const drivers = [];

  if (recentEvent && strongPrice && strongVolume) {
    return {
      score: 3,
      level: "confirmed",
      label: "Confirmed",
      note: "Price and turnover are validating the event.",
      drivers: [
        compactDriver("Price confirmed", "positive", 2),
        compactDriver("Turnover confirmed", "positive", 1),
      ],
    };
  }

  if (recentEvent && weakPrice) {
    return {
      score: 0,
      level: "failed",
      label: "Failed",
      note: "Price action rejected the event.",
      drivers: [compactDriver("Price rejected the event", "negative", -1)],
    };
  }

  if (recentEvent && (modestPrice || strongVolume)) {
    if (modestPrice) drivers.push(compactDriver("Price reaction started", "positive", 1));
    if (strongVolume) drivers.push(compactDriver("Turnover picked up", "positive", 1));
    return {
      score: 2,
      level: "pending",
      label: "Partial",
      note: "Market is reacting, but confirmation is incomplete.",
      drivers,
    };
  }

  if (recentEvent) {
    return {
      score: 1,
      level: "pending",
      label: "Pending",
      note: "Fresh event, but price and turnover have not confirmed it yet.",
      drivers: [compactDriver("Fresh event; awaiting market response", "neutral", 1)],
    };
  }

  if (staleWindow && modestPrice) {
    return {
      score: 1,
      level: "stale",
      label: "Late",
      note: "Reaction came after the initial event window.",
      drivers: [compactDriver("Late price follow-through", "neutral", 1)],
    };
  }

  return {
    score: 0,
    level: "stale",
    label: "Stale",
    note: "Event is outside the active setup window.",
    drivers: [compactDriver("Event window has cooled off", "neutral", 0)],
  };
}

function computeFundamentalFollowThroughV2(item) {
  if (item.catalystCount === 0) {
    return {
      score: 0,
      label: "0/3",
      note: "No catalyst yet, so there is no follow-through to grade.",
      drivers: [compactDriver("No event-follow-through context", "neutral", 0)],
    };
  }

  const drivers = [];
  let score = 0;

  if (item.revenueYoY >= 20) {
    score += 1;
    drivers.push(compactDriver("Revenue YoY is validating the thesis", "positive", 1));
  } else if (item.revenueYoY < 0) {
    drivers.push(compactDriver("Revenue YoY is not yet validating the thesis", "negative", -1));
  }

  if (item.revenueMoM >= 5) {
    score += 1;
    drivers.push(compactDriver("Revenue MoM is improving", "positive", 1));
  } else if (item.revenueMoM < 0) {
    drivers.push(compactDriver("Revenue MoM softened", "negative", -1));
  }

  if (item.cumulativeYoY >= 5) {
    score += 1;
    drivers.push(compactDriver("Cumulative trend is supportive", "positive", 1));
  } else if (item.cumulativeYoY < 0) {
    drivers.push(compactDriver("Cumulative trend is still weak", "negative", -1));
  }

  score = Math.max(0, Math.min(3, score));
  return {
    score,
    label: `${score}/3`,
    note:
      score >= 2
        ? "Fundamentals are following the event."
        : score === 1
          ? "Fundamental follow-through is mixed."
          : "Fundamentals have not confirmed the event yet.",
    drivers,
  };
}

function computeEventScoreV2(item) {
  const breakdown = {
    strength: computeEventStrengthV2(item),
    marketConfirmation: computeMarketConfirmationV2(item),
    fundamentalFollowThrough: computeFundamentalFollowThroughV2(item),
  };
  const score = Math.max(
    0,
    Math.min(
      10,
      breakdown.strength.score + breakdown.marketConfirmation.score + breakdown.fundamentalFollowThrough.score,
    ),
  );

  return {
    score,
    drivers: [
      ...breakdown.strength.drivers,
      ...breakdown.marketConfirmation.drivers,
      ...breakdown.fundamentalFollowThrough.drivers,
    ],
    breakdown,
  };
}

function classifyHighValueEventV2(item) {
  if (item.catalystCount === 0) {
    return { active: false, label: "No catalyst", note: "No event to classify." };
  }

  if (
    item.eventScore >= 7 &&
    item.eventStrength.score >= 3 &&
    (item.marketConfirmation.score >= 2 || item.fundamentalFollowThrough.score >= 2) &&
    item.eventConfirmation.level !== "failed"
  ) {
    return {
      active: true,
      label: "High-value",
      note: "Strong event with market or fundamental validation.",
    };
  }

  if (item.eventScore >= 5 && item.eventStrength.score >= 2) {
    return {
      active: false,
      label: "Watch",
      note: "Meaningful event, but validation is incomplete.",
    };
  }

  return {
    active: false,
    label: "Low-value",
    note: "Event exists, but its trading value is still limited.",
  };
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
  if (item.catalystTypes.includes("mna")) flags.push("mnaEvent");
  if (item.catalystTypes.includes("buyback")) flags.push("buybackEvent");
  if (item.catalystTypes.includes("new_order") && (item.priceChange === null || item.priceChange <= 1)) {
    flags.push("newOrderWithoutPriceReaction");
  }
  if (item.catalystTypes.includes("capacity_expansion") && item.eventScore >= 6) {
    flags.push("capacityExpansionFollowThrough");
  }
  if (item.catalystTypes.includes("regulatory_approval")) flags.push("regulatoryBinaryEvent");
  if (item.eventConfirmation.level === "pending" && item.daysSinceLatestEvent !== null && item.daysSinceLatestEvent <= 3) {
    flags.push("eventPendingConfirmation");
  }
  if (item.eventConfirmation.level === "confirmed") flags.push("eventConfirmed");
  if (item.highValueEvent?.active) flags.push("highValueEvent");

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

  const eventMap = new Map();
  const eventTimeline = [];
  for (const announcement of announcements) {
    for (const event of announcement.events || []) {
      const existing = eventMap.get(event.type);
      if (!existing || event.weight > existing.weight) {
        eventMap.set(event.type, { ...event });
      }
    }

    if ((announcement.events || []).length > 0) {
      eventTimeline.push({
        date: announcement.date,
        time: announcement.time,
        subject: announcement.subject,
        summary: announcement.summary,
        labels: announcement.events.map((event) => event.label),
        types: announcement.events.map((event) => event.type),
        weightTotal: announcement.eventWeightTotal,
      });
    }
  }

  item.eventTypes = [...eventMap.keys()];
  item.eventLabels = [...eventMap.values()].map((event) => event.label);
  item.primaryEventLabel = [...eventMap.values()].sort((left, right) => right.weight - left.weight)[0]?.label || null;
  item.primaryEventType = [...eventMap.values()].sort((left, right) => right.weight - left.weight)[0]?.type || null;
  item.eventWeightTotal = [...eventMap.values()].reduce((sum, event) => sum + event.weight, 0);
  item.maxEventWeight = [...eventMap.values()].reduce((max, event) => Math.max(max, event.weight), 0);
  item.catalystTypes = [...new Set(
    announcements.flatMap((entry) => (entry.catalysts || []).map((event) => event.type)),
  )];
  item.catalystLabels = [...new Set(
    announcements.flatMap((entry) => (entry.catalysts || []).map((event) => event.label)),
  )];
  item.catalystWeightTotal = item.catalystTypes
    .map((type) => EVENT_RULES.find((rule) => rule.type === type)?.weight || 0)
    .reduce((sum, weight) => sum + weight, 0);
  item.daysSinceLatestEvent = eventTimeline.length ? isoDateDiffDays(eventTimeline[0].date) : null;
  item.eventTimeline = eventTimeline.slice(0, 6);
  const eventScore = computeEventScoreV2(item);
  item.eventScore = eventScore.score;
  item.eventDrivers = eventScore.drivers;
  item.eventStrength = eventScore.breakdown.strength;
  item.marketConfirmation = eventScore.breakdown.marketConfirmation;
  item.fundamentalFollowThrough = eventScore.breakdown.fundamentalFollowThrough;
  item.eventConfirmation = {
    level: item.marketConfirmation.level,
    label: item.marketConfirmation.label,
    note: item.marketConfirmation.note,
  };
  item.highValueEvent = classifyHighValueEventV2(item);

  item.signal = computeSignal(item);
  item.alertFlags = buildAlertFlags(item);
  item.revenueDisplay = formatRevenueFromThousand(item.revenue);
  item.tradeValueDisplay = formatLargeNumber(item.tradeValue);
  item.otcInstitutionNetDisplay = formatLargeNumber(item.otcInstitutionNet);
  item.priceChangeDisplay = formatSignedNumber(item.priceChange);
  item.revenueYoYDisplay = formatPercent(item.revenueYoY);
  item.revenueMoMDisplay = formatPercent(item.revenueMoM);
  item.cumulativeYoYDisplay = formatPercent(item.cumulativeYoY);
  item.eventScoreDisplay = `${item.eventScore}/10`;
  item.eventStrengthDisplay = item.eventStrength.label;
  item.marketConfirmationDisplay = `${item.marketConfirmation.score}/3`;
  item.fundamentalFollowThroughDisplay = item.fundamentalFollowThrough.label;
  item.daysSinceLatestEventDisplay =
    item.daysSinceLatestEvent === null ? "無資料" : `${item.daysSinceLatestEvent} 日前`;
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
    eventScore: item.eventScore,
    eventScoreDisplay: item.eventScoreDisplay,
    eventStrength: item.eventStrength,
    eventStrengthDisplay: item.eventStrengthDisplay,
    marketConfirmationScore: item.marketConfirmation?.score ?? 0,
    marketConfirmationDisplay: item.marketConfirmationDisplay,
    fundamentalFollowThrough: item.fundamentalFollowThrough,
    fundamentalFollowThroughDisplay: item.fundamentalFollowThroughDisplay,
    catalystCount: item.catalystCount,
    catalystTypes: item.catalystTypes,
    catalystLabels: item.catalystLabels,
    eventTypes: item.eventTypes,
    eventLabels: item.eventLabels,
    primaryEventLabel: item.primaryEventLabel,
    daysSinceLatestEvent: item.daysSinceLatestEvent,
    daysSinceLatestEventDisplay: item.daysSinceLatestEventDisplay,
    eventConfirmation: item.eventConfirmation,
    highValueEvent: item.highValueEvent,
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
    if (item.alertFlags.includes("highValueEvent")) {
      alerts.push({
        level: "high",
        title: "High-value event",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} has a strong event setup with validation in price, turnover, or fundamentals.`,
      });
    }
    if (item.alertFlags.includes("strongWithCatalyst")) {
      alerts.push({
        level: "high",
        title: "強訊號 + 催化事件",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 同時具備高分訊號與近期重大催化${item.primaryEventLabel ? `，主事件為${item.primaryEventLabel}` : ""}，適合優先驗證。`,
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

    if (item.alertFlags.includes("mnaEvent")) {
      alerts.push({
        level: "high",
        title: "併購 / 收購事件",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 出現併購或公開收購類事件，需快速判斷價格是否已反映條件與對價。`,
      });
    }

    if (item.alertFlags.includes("buybackEvent")) {
      alerts.push({
        level: "medium",
        title: "庫藏股事件",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 出現庫藏股事件，可與估值、籌碼與價格表現一起驗證。`,
      });
    }

    if (item.alertFlags.includes("newOrderWithoutPriceReaction")) {
      alerts.push({
        level: "medium",
        title: "接單事件尚未完全反映",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 有接單或簽約類事件，但價格尚未明顯回應，適合檢查市場認知差。`,
      });
    }

    if (item.alertFlags.includes("capacityExpansionFollowThrough")) {
      alerts.push({
        level: "medium",
        title: "擴產事件需追蹤落地",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 有擴產建廠類事件，接下來要追營收、交機與法說口徑是否跟上。`,
      });
    }

    if (item.alertFlags.includes("regulatoryBinaryEvent")) {
      alerts.push({
        level: "high",
        title: "法規核准 / 二元事件",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 有法規核准或認證事件，屬於二元型催化，需特別注意後續落地與價格波動。`,
      });
    }

    if (item.alertFlags.includes("eventPendingConfirmation")) {
      alerts.push({
        level: "medium",
        title: "事件待價格確認",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 近 3 日內有事件，但價格或量能尚未完整確認，適合列入觀察清單。`,
      });
    }

    if (item.alertFlags.includes("eventConfirmed")) {
      alerts.push({
        level: "high",
        title: "事件已獲價格確認",
        code: item.code,
        name: item.name,
        marketLabel: item.marketLabel,
        lensLabel: item.lensLabel,
        signalScore: item.signal.score,
        message: `${item.name} 事件後已有價格與量能確認，可轉入後續追蹤與風險管理。`,
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
  const etfTrackStates = [];
  for (const track of ETF_TRACK_REGISTRY) {
    etfTrackStates.push(await loadEtfTrackState(track));
  }
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
    fetchJson("twseRevenue", SOURCES.twseRevenue),
    fetchJson("tpexRevenue", SOURCES.tpexRevenue),
    fetchJson("twseMajor", SOURCES.twseMajor),
    fetchJson("tpexMajor", SOURCES.tpexMajor),
    fetchJson("twseQuotes", SOURCES.twseQuotes),
    fetchJson("tpexQuotes", SOURCES.tpexQuotes),
    fetchJson("twseIndices", SOURCES.twseIndices),
    fetchJson("tpexHighlight", SOURCES.tpexHighlight),
    fetchJson("tpexInstiSummary", SOURCES.tpexInstiSummary),
    fetchJson("tpexInstiDetail", SOURCES.tpexInstiDetail),
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
    highValueEvents: topBy(
      sortedUniverse,
      (item) => item.highValueEvent?.active,
      (left, right) =>
        right.eventScore - left.eventScore ||
        (right.marketConfirmation?.score ?? 0) - (left.marketConfirmation?.score ?? 0) ||
        (right.fundamentalFollowThrough?.score ?? 0) - (left.fundamentalFollowThrough?.score ?? 0),
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
        eventScore: item.eventScore,
        eventScoreDisplay: item.eventScoreDisplay,
        eventStrength: item.eventStrength,
        eventStrengthDisplay: item.eventStrengthDisplay,
        marketConfirmation: item.marketConfirmation,
        marketConfirmationDisplay: item.marketConfirmationDisplay,
        fundamentalFollowThrough: item.fundamentalFollowThrough,
        fundamentalFollowThroughDisplay: item.fundamentalFollowThroughDisplay,
        primaryEventLabel: item.primaryEventLabel,
        eventLabels: item.eventLabels,
        catalystLabels: item.catalystLabels,
        daysSinceLatestEvent: item.daysSinceLatestEvent,
        daysSinceLatestEventDisplay: item.daysSinceLatestEventDisplay,
        eventConfirmation: item.eventConfirmation,
        highValueEvent: item.highValueEvent,
        catalystCount: item.catalystCount,
        announcementCount: item.announcementCount,
        alertFlags: item.alertFlags,
        announcements: item.announcements,
        eventTimeline: item.eventTimeline,
        signal: {
          score: item.signal.score,
          label: item.signal.label,
          tone: item.signal.tone,
          scoreDisplay: `${item.signal.score}/10`,
          drivers: item.signal.drivers,
        },
        eventDrivers: item.eventDrivers,
      },
    ]);
  }

  const etfTrackDashboards = etfTrackStates.map((state) => state.dashboard);
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
      etfTrackDate: etfTrackStates
        .map((state) => state.dashboard.latestSnapshotDate)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
      etfTrackCount: etfTrackStates.length,
      universeSize: sortedUniverse.length,
      sourceHealth: Object.fromEntries(
        [...sourceFetchStates.entries()].sort(([left], [right]) => left.localeCompare(right)),
      ),
    },
    sourceCatalog: {
      officialRaw: [
        { label: "TWSE OpenAPI", url: SOURCES.twseRevenue },
        { label: "TPEx OpenAPI", url: SOURCES.tpexRevenue },
        { label: "TWSE Major Announcements", url: SOURCES.twseMajor },
        { label: "TPEx Major Announcements", url: SOURCES.tpexMajor },
      ],
      etfIssuerRaw: ETF_TRACK_REGISTRY.map((track) => ({
        ticker: track.ticker,
        label: track.sourceLabel || "Official issuer holdings page",
        url: track.sourceUrl,
        host: track.sourceHost || null,
      })),
      modelDerived: [
        "Signal score",
        "Event score",
        "Lens classification",
        "Watchlist overlap",
        "Operation trail",
        "ETF Flow Radar",
        "Alerts and rankings",
      ],
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
    eventTypeOptions: EVENT_RULES.map((rule) => ({
      value: rule.type,
      label: rule.label,
    })),
    eventWindowOptions: [
      { value: "all", label: "全部時間窗" },
      { value: "3d", label: "近 3 日" },
      { value: "7d", label: "近 7 日" },
      { value: "30d", label: "近 30 日" },
    ],
    eventConfirmationOptions: [
      { value: "all", label: "全部確認狀態" },
      { value: "confirmed", label: "已確認" },
      { value: "pending", label: "待確認" },
      { value: "failed", label: "確認失敗" },
      { value: "stale", label: "已鈍化" },
      { value: "none", label: "無事件" },
    ],
    boards,
    alerts,
    strategies: {
      semiconductor: buildStrategy("semiconductor", itemsByCode),
      nonElectronics: buildStrategy("nonElectronics", itemsByCode),
    },
    etfTracks: Object.fromEntries(etfTrackStates.map((state) => [state.history.ticker, state.dashboard])),
    etfFlowRadar: buildEtfFlowRadar(etfTrackDashboards),
    leaderboard: sortedUniverse.map(compactRow),
    detailByCode: Object.fromEntries(detailEntries),
    announcements: majorEntries.filter((entry) => !entry.isRoutine).slice(0, 32),
  };

  return {
    payload,
    etfTrackStates,
  };
}

await mkdir(dataDir, { recursive: true });
await mkdir(etfTrackDir, { recursive: true });
await mkdir(sourceCacheDir, { recursive: true });
const { payload, etfTrackStates } = await buildDashboardPayload();
await writeFile(dataFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await Promise.all(
  etfTrackStates.map((state) => {
    const track = ETF_TRACK_REGISTRY.find((item) => item.ticker === state.history.ticker);
    return writeFile(track.historyFile, `${JSON.stringify(state.history, null, 2)}\n`, "utf8");
  }),
);
console.log(`wrote ${dataFile}`);
