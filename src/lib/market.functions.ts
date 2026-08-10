import { createServerFn } from "@tanstack/react-start";

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketTime: number;
};

export type SeriesPoint = { t: number; p: number };

async function fetchChart(symbol: string, range: string, interval: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Market data unavailable (${res.status})`);
  const json = (await res.json()) as any;
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data for symbol");
  return result;
}

function toQuote(result: any): Quote {
  const m = result.meta ?? {};
  const price = Number(m.regularMarketPrice ?? 0);
  const prev = Number(m.chartPreviousClose ?? m.previousClose ?? price);
  return {
    symbol: String(m.symbol ?? ""),
    name: String(m.longName ?? m.shortName ?? m.symbol ?? ""),
    price,
    previousClose: prev,
    change: price - prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : 0,
    currency: String(m.currency ?? "USD"),
    dayHigh: Number(m.regularMarketDayHigh ?? 0),
    dayLow: Number(m.regularMarketDayLow ?? 0),
    volume: Number(m.regularMarketVolume ?? 0),
    marketTime: Number(m.regularMarketTime ?? 0) * 1000,
  };
}

export const getQuotes = createServerFn({ method: "GET" })
  .inputValidator((data: { symbols: string[] }) => ({
    symbols: (data?.symbols ?? []).slice(0, 200).map((s) => String(s).toUpperCase()),
  }))

  .handler(async ({ data }) => {
    const results = await Promise.allSettled(
      data.symbols.map(async (s) => toQuote(await fetchChart(s, "1d", "5m"))),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
      .map((r) => r.value);
  });

export const getSeries = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string; range: string }) => ({
    symbol: String(data?.symbol ?? "AAPL").toUpperCase(),
    range: ["1d", "5d", "1mo", "6mo", "1y"].includes(data?.range) ? data.range : "1d",
  }))
  .handler(async ({ data }) => {
    const interval =
      data.range === "1d"
        ? "1m"
        : data.range === "5d"
          ? "5m"
          : data.range === "1mo"
            ? "30m"
            : "1d";
    const result = await fetchChart(data.symbol, data.range, interval);
    const stamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const series: SeriesPoint[] = [];
    for (let i = 0; i < stamps.length; i++) {
      const p = closes[i];
      const t = stamps[i];
      if (typeof p === "number" && Number.isFinite(p) && typeof t === "number") {
        series.push({ t: t * 1000, p });
      }
    }
    return { quote: toQuote(result), series };
  });
