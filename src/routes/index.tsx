import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BidAsk, Clock, LivePrice, Panel, StatCards, Tape } from "@/components/terminal";
import { TradeModal } from "@/components/trade-modal";
import { getQuotes, getSeries, type Quote } from "@/lib/market.functions";
import { getCurrentUser, logout } from "@/lib/auth.functions";
import { reportNetWorth } from "@/lib/leaderboard.functions";
import {
  applyTrade,
  defaultPortfolio,
  loadPortfolio,
  num,
  pct,
  savePortfolio,
  totalValue,
  usd,
  type Portfolio,
} from "@/lib/portfolio";
import { searchUniverse, UNIVERSE, UNIVERSE_BY_SYMBOL } from "@/lib/universe";

const RANGES = [
  { key: "1d", label: "1D" },
  { key: "5d", label: "5D" },
  { key: "1mo", label: "1M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1R" },
];

const FILTERS = ["All", "Stock", "ETF"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  All: "All",
  Stock: "Stocks",
  ETF: "ETF",
};

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  head: () => ({
    meta: [
      { title: "BURZA·SIM — real-market paper trading simulator" },
      {
        name: "description",
        content:
          "Trade hundreds of real stocks and ETFs with $100,000 in virtual capital. Live prices, instrument search, charts, portfolio, and trade history.",
      },
      { property: "og:title", content: "BURZA·SIM — real-market simulator" },
      {
        property: "og:description",
        content:
          "Hundreds of real stocks and ETFs, live prices, search, and a virtual portfolio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Terminal,
});

function Terminal() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const [portfolio, setPortfolio] = useState<Portfolio>(() => defaultPortfolio());
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [symbol, setSymbol] = useState("AAPL");
  const [range, setRange] = useState("1d");
  const [trade, setTrade] = useState<{ symbol: string; side: "B" | "S" } | null>(null);

  if (!hydrated && typeof window !== "undefined") {
    setHydrated(true);
    setPortfolio(loadPortfolio(user.id));
  }

  const update = useCallback(
    (next: Portfolio) => {
      savePortfolio(next, user.id);
      setPortfolio(next);
    },
    [user.id],
  );

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  const results = useMemo(() => {
    const base = query.trim() ? searchUniverse(query, 60) : UNIVERSE;
    const filtered = filter === "All" ? base : base.filter((i) => i.kind === filter);
    return query.trim() ? filtered : filtered.slice(0, 0);
  }, [query, filter]);

  // The default view (no search) always shows the first 150 instruments
  // from the full universe (respecting the Stock/ETF filter), instead of
  // depending on the watchlist stored in the browser — this guarantees
  // enough instruments show up even for accounts with an old/empty watchlist.
  const DEFAULT_LIST_LIMIT = 150;

  const defaultList = useMemo(() => {
    const base = filter === "All" ? UNIVERSE : UNIVERSE.filter((i) => i.kind === filter);
    return base.slice(0, DEFAULT_LIST_LIMIT);
  }, [filter]);

  const listSymbols = useMemo(() => {
    const shown = query.trim() ? results.map((i) => i.symbol) : defaultList.map((i) => i.symbol);
    return Array.from(new Set([...shown, ...Object.keys(portfolio.holdings), symbol]));
  }, [query, results, defaultList, portfolio.holdings, symbol]);

  const quotesQuery = useQuery({
    queryKey: ["quotes", listSymbols],
    queryFn: () => getQuotes({ data: { symbols: listSymbols } }),
    // With a 150-item watchlist, a 3s interval risks hitting Yahoo Finance's
    // rate limit (150 requests every 3s adds up). 8s is a safer middle ground —
    // the LivePrice/BidAsk 1s tick keeps it feeling live in between.
    refetchInterval: 8000,
    placeholderData: (prev: Quote[] | undefined) => prev,
  });

  const seriesQuery = useQuery({
    queryKey: ["series", symbol, range],
    queryFn: () => getSeries({ data: { symbol, range } }),
    refetchInterval: 3000,
  });

  const quotes = quotesQuery.data ?? [];
  const bySymbol = useMemo(() => {
    const m: Record<string, Quote> = {};
    for (const q of quotes) m[q.symbol] = q;
    return m;
  }, [quotes]);

  const prices = useMemo(() => {
    const p: Record<string, number> = {};
    for (const q of quotes) p[q.symbol] = q.price;
    return p;
  }, [quotes]);

  // Pošle aktuální hodnotu portfolia na server pro žebříček (/leaderboard).
  // Server jinak o portfoliích nic neví — ta žijí jen v localStorage klienta.
  const netWorth = totalValue(portfolio, prices);
  useEffect(() => {
    if (!hydrated || quotes.length === 0) return;
    reportNetWorth({ data: { userId: user.id, name: user.name, value: netWorth } }).catch(
      () => {},
    );
  }, [hydrated, netWorth, quotes.length, user.id, user.name]);

  const rows = query.trim() ? results : defaultList;

  const selected = UNIVERSE_BY_SYMBOL[symbol];
  const detail = seriesQuery.data?.quote ?? bySymbol[symbol];
  const up = (detail?.change ?? 0) >= 0;

  const toggleWatch = (sym: string) => {
    const inList = portfolio.watchlist.includes(sym);
    update({
      ...portfolio,
      watchlist: inList
        ? portfolio.watchlist.filter((s) => s !== sym)
        : [...portfolio.watchlist, sym],
    });
  };

  const confirmTrade = (qty: number) => {
    if (!trade) return;
    const price = prices[trade.symbol] ?? bySymbol[trade.symbol]?.price ?? 0;
    const next = applyTrade(portfolio, trade.symbol, trade.side, qty, price);
    if (next) update(next);
    setTrade(null);
  };

  const reset = () => {
    if (!window.confirm("Are you sure you want to reset the portfolio to $100,000?")) return;
    update(defaultPortfolio());
  };

  const tradeQuote = trade ? bySymbol[trade.symbol] : undefined;
  const holdingIds = Object.keys(portfolio.holdings);

  return (
    <main className="mx-auto max-w-6xl p-3 md:p-6">
      <div className="overflow-hidden rounded-[10px] border border-border-soft bg-background">
        <header className="flex items-center justify-between border-b border-border-soft px-5 pb-3 pt-4">
          <div>
            <div className="disp flex items-center gap-2 text-[19px] font-bold tracking-wide">
              <span className="size-2 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              BURZA·SIM
            </div>
            <p className="mt-0.5 text-[11px] text-faint">
              {UNIVERSE.length} real stocks and ETFs · virtual capital ·{" "}
              <Link to="/live" className="text-primary hover:underline">
                live markets overview
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs">
              <div className="font-semibold text-foreground">{user.name}</div>
              <Link
                to="/leaderboard"
                className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Leaderboard
              </Link>
              {" · "}
              <Link
                to="/admin"
                className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Statistics
              </Link>
              {" · "}
              <button
                onClick={handleLogout}
                className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Log out
              </button>
            </div>
            <Clock />
          </div>
        </header>

        <Tape quotes={quotes.slice(0, 14)} />

        <div className="flex flex-col gap-4 px-5 pb-6 pt-4">
          <StatCards portfolio={portfolio} prices={prices} />

          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <Panel
              title={query.trim() ? "Search results" : "Market overview"}
              hint={`${rows.length} instruments`}
            >
              <div className="mb-3 flex flex-wrap gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Hledej akcii nebo ETF (AAPL, Tesla, S&P 500…)"
                  className="min-w-[200px] flex-1 rounded-[7px] border border-border bg-[var(--bg2)] px-3 py-2 text-[12.5px] text-foreground outline-none placeholder:text-faint focus:border-primary"
                />
                <div className="flex rounded-[7px] border border-border-soft p-[3px]">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-[5px] px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                        filter === f
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {FILTER_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      {["Instrument", "Bid / Ask", "Change", ""].map((h, i) => (
                        <th
                          key={i}
                          className="sticky top-0 border-b border-border-soft bg-panel px-2 pb-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => {
                      const q = bySymbol[i.symbol];
                      const owned = portfolio.holdings[i.symbol];
                      const watched = portfolio.watchlist.includes(i.symbol);
                      return (
                        <tr
                          key={i.symbol}
                          onClick={() => setSymbol(i.symbol)}
                          className={`cursor-pointer border-b border-border-soft last:border-0 ${
                            i.symbol === symbol ? "bg-panel2" : "hover:bg-panel2/60"
                          }`}
                        >
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold">{i.symbol}</span>
                              <span className="rounded border border-border-soft px-1 text-[9px] uppercase text-faint">
                                {i.kind} · {i.market}
                              </span>
                            </div>
                            <div className="max-w-[180px] truncate text-[10.5px] text-faint">
                              {i.name}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {q ? <BidAsk anchorPrice={q.price} /> : "—"}
                          </td>
                          <td
                            className={`num px-2 py-2 ${
                              (q?.changePercent ?? 0) >= 0 ? "text-up" : "text-down"
                            }`}
                          >
                            {q ? pct(q.changePercent) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrade({ symbol: i.symbol, side: "B" });
                              }}
                              className="rounded-md border border-up/35 bg-panel2 px-2.5 py-1 text-[11.5px] font-semibold text-up transition-colors hover:bg-up-soft"
                            >
                              Buy
                            </button>
                            {owned && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTrade({ symbol: i.symbol, side: "S" });
                                }}
                                className="ml-1.5 rounded-md border border-down/35 bg-panel2 px-2.5 py-1 text-[11.5px] font-semibold text-down transition-colors hover:bg-down-soft"
                              >
                                Sell
                              </button>
                            )}
                            <button
                              title={watched ? "Remove from watchlist" : "Add to watchlist"}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWatch(i.symbol);
                              }}
                              className={`ml-1.5 rounded-md border border-border-soft px-2 py-1 text-[11.5px] transition-colors hover:text-foreground ${
                                watched ? "text-gold" : "text-faint"
                              }`}
                            >
                              {watched ? "★" : "☆"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-6 text-center text-xs text-faint">
                          Nothing found — try a different name or ticker.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel
              title={selected?.name ?? symbol}
              hint={detail ? `${detail.currency} · ${symbol}` : symbol}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-semibold">
                    <LivePrice anchorPrice={detail?.price} />
                  </span>
                  {detail && (
                    <span className={`num text-sm ${up ? "text-up" : "text-down"}`}>
                      {up ? "▲" : "▼"} {num(Math.abs(detail.change))} (
                      {num(Math.abs(detail.changePercent))} %)
                    </span>
                  )}
                </div>
                <div className="flex gap-1 rounded-lg border border-border-soft p-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setRange(r.key)}
                      className={`num rounded px-2 py-1 text-[11px] transition-colors ${
                        range === r.key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-panel2"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 h-[230px]">
                {seriesQuery.data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={seriesQuery.data.series}
                      margin={{ left: 0, right: 6, top: 6 }}
                    >
                      <defs>
                        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={up ? "var(--up)" : "var(--down)"}
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="100%"
                            stopColor={up ? "var(--up)" : "var(--down)"}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        tickFormatter={(t: number) =>
                          range === "1d"
                            ? new Date(t).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : new Date(t).toLocaleDateString("en-US", {
                                day: "2-digit",
                                month: "2-digit",
                              })
                        }
                        tick={{ fill: "var(--faint)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={40}
                      />
                      <YAxis
                        domain={["dataMin", "dataMax"]}
                        tick={{ fill: "var(--faint)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tickFormatter={(v: number) => num(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--panel2)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(t) => new Date(Number(t)).toLocaleString("en-US")}
                        formatter={(v) => [num(Number(v)), "Cena"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="p"
                        stroke={up ? "var(--up)" : "var(--down)"}
                        strokeWidth={2}
                        fill="url(#fill)"
                        isAnimationActive={false}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-faint">
                    {seriesQuery.isError ? "Data not available." : "Loading chart…"}
                  </div>
                )}
              </div>

              {detail && (
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Day high", num(detail.dayHigh)],
                    ["Day low", num(detail.dayLow)],
                    ["Prev. close", num(detail.previousClose)],
                    ["Volume", detail.volume.toLocaleString("en-US")],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-md border border-border-soft bg-panel2 px-2.5 py-1.5"
                    >
                      <dt className="text-[10px] uppercase tracking-[0.5px] text-faint">
                        {label}
                      </dt>
                      <dd className="num mt-0.5 text-[12.5px]">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setTrade({ symbol, side: "B" })}
                  className="flex-1 rounded-md border border-up/35 bg-panel2 py-2 text-[12.5px] font-semibold text-up transition-colors hover:bg-up-soft"
                >
                  Buy {symbol}
                </button>
                <button
                  onClick={() => setTrade({ symbol, side: "S" })}
                  disabled={!portfolio.holdings[symbol]}
                  className="flex-1 rounded-md border border-down/35 bg-panel2 py-2 text-[12.5px] font-semibold text-down transition-colors hover:bg-down-soft disabled:opacity-40"
                >
                  Sell {symbol}
                </button>
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Positions" hint={`${holdingIds.length} open`}>
              {holdingIds.length === 0 ? (
                <p className="py-3.5 text-center text-xs text-faint">
                  You don't own any instruments yet.
                </p>
              ) : (
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      {["Instrument", "Qty", "Value", "P/L"].map((h) => (
                        <th
                          key={h}
                          className="border-b border-border-soft px-2 pb-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdingIds.map((id) => {
                      const h = portfolio.holdings[id]!;
                      const price = prices[id] ?? h.avgCost;
                      const cost = h.qty * h.avgCost;
                      const pl = h.qty * price - cost;
                      const plPct = cost ? (pl / cost) * 100 : 0;
                      return (
                        <tr key={id} className="border-b border-border-soft last:border-0">
                          <td className="px-2 py-2">
                            <div className="font-semibold">{id}</div>
                            <div className="text-[10.5px] text-faint">avg. {usd(h.avgCost)}</div>
                          </td>
                          <td className="num px-2 py-2">{h.qty}</td>
                          <td className="num px-2 py-2">{usd(h.qty * price)}</td>
                          <td className={`num px-2 py-2 ${pl >= 0 ? "text-up" : "text-down"}`}>
                            {pl >= 0 ? "+" : ""}
                            {usd(pl)}
                            <div className="text-[10px]">{pct(plPct)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="Trade history">
              {portfolio.tx.length === 0 ? (
                <p className="py-3.5 text-center text-xs text-faint">
                  No trades yet.
                </p>
              ) : (
                <div className="max-h-[260px] overflow-y-auto">
                  {portfolio.tx.slice(0, 20).map((t, i) => (
                    <div
                      key={`${t.t}-${i}`}
                      className="flex items-center justify-between border-b border-border-soft py-2 text-xs last:border-0"
                    >
                      <div>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.4px] ${
                            t.side === "B" ? "bg-up-soft text-up" : "bg-down-soft text-down"
                          }`}
                        >
                          {t.side === "B" ? "BUY" : "SELL"}
                        </span>
                        <b className="ml-1.5">{t.symbol}</b>
                        <div className="text-[10.5px] text-faint">
                          {t.qty} ks · {usd(t.price)}/ks ·{" "}
                          {new Date(t.t).toLocaleString("en-US")}
                        </div>
                      </div>
                      <span className="num text-right">{usd(t.total)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex justify-end">
                <button
                  onClick={reset}
                  className="rounded-md border border-border-soft px-2.5 py-1.5 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  Resetovat portfolio
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {trade && (
        <TradeModal
          symbol={trade.symbol}
          name={UNIVERSE_BY_SYMBOL[trade.symbol]?.name ?? trade.symbol}
          price={prices[trade.symbol] ?? tradeQuote?.price ?? 0}
          changePercent={tradeQuote?.changePercent ?? 0}
          cash={portfolio.cash}
          ownedQty={portfolio.holdings[trade.symbol]?.qty ?? 0}
          side={trade.side}
          onSide={(side) => setTrade({ ...trade, side })}
          onClose={() => setTrade(null)}
          onConfirm={confirmTrade}
        />
      )}
    </main>
  );
}
