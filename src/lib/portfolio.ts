export type Holding = { qty: number; avgCost: number };

export type Tx = {
  symbol: string;
  side: "B" | "S";
  qty: number;
  price: number;
  total: number;
  t: number;
};

export type Portfolio = {
  cash: number;
  holdings: Record<string, Holding>;
  tx: Tx[];
  watchlist: string[];
};

export const START_CASH = 100000;

// Výchozí watchlist — 150 titulů napříč sektory a trhy (akcie i ETF), aby po
// prvním spuštění bylo hned na co koukat, i než si člověk vytvoří vlastní.
export const DEFAULT_WATCHLIST = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "GOOGL",
  "TSLA",
  "INTC",
  "MU",
  "ORCL",
  "NOW",
  "UBER",
  "SQ",
  "DIS",
  "COIN",
  "SMCI",
  "ZM",
  "CRWD",
  "ANET",
  "KLAC",
  "ON",
  "TEAM",
  "APP",
  "MDB",
  "PINS",
  "EA",
  "INTU",
  "WFC",
  "C",
  "MA",
  "SCHW",
  "MET",
  "USB",
  "COF",
  "ICE",
  "MCO",
  "PFE",
  "UNH",
  "GILD",
  "VRTX",
  "ZTS",
  "SYK",
  "CI",
  "DXCM",
  "PEP",
  "SBUX",
  "COST",
  "LOW",
  "DE",
  "RTX",
  "F",
  "LCID",
  "DPZ",
  "KMB",
  "KHC",
  "ROST",
  "ETSY",
  "EMR",
  "ITW",
  "UNP",
  "CVX",
  "OXY",
  "NEE",
  "EOG",
  "WMB",
  "AEP",
  "APD",
  "DOW",
  "TMUS",
  "PARA",
  "UAL",
  "RCL",
  "BKNG",
  "PLD",
  "SPG",
  "SAP.DE",
  "DTE.DE",
  "BMW.DE",
  "DBK.DE",
  "IFX.DE",
  "MUV2.DE",
  "FRE.DE",
  "CON.DE",
  "OR.PA",
  "AI.PA",
  "RMS.PA",
  "DG.PA",
  "INGA.AS",
  "NESN.SW",
  "UBSG.SW",
  "MAERSK-B.CO",
  "HM-B.ST",
  "ISP.MI",
  "ITX.MC",
  "SHEL.L",
  "AZN.L",
  "RR.L",
  "VOD.L",
  "RIO.L",
  "TSCO.L",
  "MONET.PR",
  "COLT.PR",
  "STOCK.PR",
  "RY.TO",
  "CNQ.TO",
  "CNR.TO",
  "CSL.AX",
  "JD",
  "XPEV",
  "TCEHY",
  "TM",
  "WIT",
  "GRAB",
  "9984.T",
  "SPY",
  "QQQ",
  "GLD",
  "IVV",
  "DIA",
  "VTI",
  "ACWI",
  "VEA",
  "EEM",
  "EWG",
  "INDA",
  "EWA",
  "EWY",
  "XLK",
  "XLE",
  "XLI",
  "XLU",
  "XLB",
  "SMH",
  "ARKK",
  "ICLN",
  "LIT",
  "JETS",
  "VNQ",
  "VIG",
  "KWEB",
  "IBB",
  "KRE",
  "MOO",
  "AGG",
  "TLT",
  "SHY",
  "LQD",
  "MUB",
  "IAU",
  "USO",
  "PDBC",
  "IWDA.AS",
  "VUSA.AS",
  "EXS1.DE",
  "EIMI.L",
  "CSPX.L",
];

export function defaultPortfolio(): Portfolio {
  return { cash: START_CASH, holdings: {}, tx: [], watchlist: [...DEFAULT_WATCHLIST] };
}

// Portfolio je teď vázané na konkrétního uživatele, takže klíč v localStorage
// obsahuje jeho id. Bez přihlášeného uživatele (userId undefined) se používá
// společný "guest" klíč jako dřív.
function storeKey(userId?: string) {
  return `burza_live_portfolio_v1:${userId ?? "guest"}`;
}

export function loadPortfolio(userId?: string): Portfolio {
  if (typeof window === "undefined") return defaultPortfolio();
  try {
    const raw = window.localStorage.getItem(storeKey(userId));
    if (raw) {
      const p = JSON.parse(raw) as Partial<Portfolio>;
      return {
        cash: typeof p.cash === "number" ? p.cash : START_CASH,
        holdings: p.holdings ?? {},
        tx: p.tx ?? [],
        watchlist: p.watchlist?.length ? p.watchlist : [...DEFAULT_WATCHLIST],
      };
    }
  } catch {
    /* ignore */
  }
  return defaultPortfolio();
}

export function savePortfolio(p: Portfolio, userId?: string) {
  try {
    window.localStorage.setItem(storeKey(userId), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export const num = (n: number, digits = 2) =>
  new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);

export const usd = (n: number) => `${num(n)} $`;
export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)} %`;

export function investedValue(p: Portfolio, prices: Record<string, number>) {
  let v = 0;
  for (const [sym, h] of Object.entries(p.holdings)) {
    const price = prices[sym];
    if (price) v += h.qty * price;
    else v += h.qty * h.avgCost;
  }
  return v;
}

export function totalValue(p: Portfolio, prices: Record<string, number>) {
  return p.cash + investedValue(p, prices);
}

export function applyTrade(
  p: Portfolio,
  symbol: string,
  side: "B" | "S",
  qty: number,
  price: number,
): Portfolio | null {
  if (qty <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const total = qty * price;
  const holdings = { ...p.holdings };
  let cash = p.cash;

  if (side === "B") {
    if (total > cash) return null;
    cash -= total;
    const h = holdings[symbol] ?? { qty: 0, avgCost: 0 };
    holdings[symbol] = {
      qty: h.qty + qty,
      avgCost: (h.avgCost * h.qty + total) / (h.qty + qty),
    };
  } else {
    const h = holdings[symbol];
    if (!h || qty > h.qty) return null;
    cash += total;
    if (h.qty - qty <= 0) delete holdings[symbol];
    else holdings[symbol] = { ...h, qty: h.qty - qty };
  }

  return {
    ...p,
    cash,
    holdings,
    tx: [{ symbol, side, qty, price, total, t: Date.now() }, ...p.tx].slice(0, 80),
  };
}
