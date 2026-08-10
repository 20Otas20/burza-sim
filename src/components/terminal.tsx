import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/market.functions";
import { useLiveTick } from "@/lib/live-price";
import {
  investedValue,
  num,
  pct,
  START_CASH,
  usd,
  type Portfolio,
} from "@/lib/portfolio";

export function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[9px] border border-border-soft bg-panel px-4 py-3.5 ${className}`}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="disp text-[13.5px] font-semibold">{title}</h2>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

// Zobrazuje živě tikající cenu ukotvenou na `anchorPrice` (poslední reálná
// hodnota ze serveru). Krátce zabliká zeleně/červeně při každé změně směru.
export function LivePrice({
  anchorPrice,
  digits = 2,
  className = "",
}: {
  anchorPrice: number | undefined;
  digits?: number;
  className?: string;
}) {
  const tick = useLiveTick(anchorPrice);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevDirection = useRef<string | null>(null);

  useEffect(() => {
    if (!tick || tick.direction === "flat") return;
    if (tick.direction !== prevDirection.current) {
      setFlash(tick.direction);
      prevDirection.current = tick.direction;
      const t = setTimeout(() => setFlash(null), 650);
      return () => clearTimeout(t);
    }
  }, [tick]);

  const price = tick?.price ?? anchorPrice;
  if (price == null) return <span className="text-faint">—</span>;

  return (
    <span
      className={`num inline-block rounded px-1 transition-colors ${
        flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : ""
      } ${className}`}
    >
      {num(price, digits)}
    </span>
  );
}

// Bid/ask pár pod sebou, jak je zvykem na profesionálních platformách.
export function BidAsk({ anchorPrice }: { anchorPrice: number | undefined }) {
  const tick = useLiveTick(anchorPrice);
  if (!tick) return <span className="text-faint">—</span>;
  return (
    <span className="num inline-flex flex-col items-end leading-tight">
      <span className="text-down">{num(tick.bid)}</span>
      <span className="text-up text-[10.5px]">{num(tick.ask)}</span>
    </span>
  );
}

export function Tape({ quotes }: { quotes: Quote[] }) {
  if (quotes.length === 0) {
    return (
      <div className="border-y border-border-soft bg-[var(--bg2)] py-[7px] text-center text-[12px] text-faint">
        Načítám reálná tržní data…
      </div>
    );
  }
  const items = quotes.map((q) => (
    <span key={q.symbol} className="inline-flex items-baseline gap-[7px] px-[18px] text-[12.5px]">
      <span className="font-semibold text-muted-foreground">{q.symbol}</span>
      <span className={`num font-semibold ${q.change >= 0 ? "text-up" : "text-down"}`}>
        <LivePrice anchorPrice={q.price} /> {q.change >= 0 ? "▲" : "▼"} {pct(q.changePercent)}
      </span>
    </span>
  ));
  return (
    <div className="overflow-hidden whitespace-nowrap border-y border-border-soft bg-[var(--bg2)]">
      <div className="tape-scroll inline-block py-[7px]">
        {items}
        {items}
      </div>
    </div>
  );
}

export function StatCards({
  portfolio,
  prices,
}: {
  portfolio: Portfolio;
  prices: Record<string, number>;
}) {
  const invested = investedValue(portfolio, prices);
  const value = portfolio.cash + invested;
  const pl = value - START_CASH;
  const plPct = (pl / START_CASH) * 100;

  let openPl = 0;
  for (const [sym, h] of Object.entries(portfolio.holdings)) {
    const price = prices[sym] ?? h.avgCost;
    openPl += (price - h.avgCost) * h.qty;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card label="Celková hodnota" value={usd(value)}>
        <span className={`num ${pl >= 0 ? "text-up" : "text-down"}`}>
          {pl >= 0 ? "+" : ""}
          {usd(pl)} ({pct(plPct)})
        </span>
      </Card>
      <Card label="Hotovost" value={usd(portfolio.cash)}>
        <span className="text-faint">{((portfolio.cash / value) * 100).toFixed(1)} % portfolia</span>
      </Card>
      <Card label="Investováno" value={usd(invested)}>
        <span className="text-faint">
          {Object.keys(portfolio.holdings).length} otevřených pozic
        </span>
      </Card>
      <Card
        label="Nerealizovaný P/L"
        value={`${openPl >= 0 ? "+" : ""}${usd(openPl)}`}
        valueClass={openPl >= 0 ? "text-up" : "text-down"}
      >
        <span className="text-faint">z aktuálních tržních cen</span>
      </Card>
    </div>
  );
}

function Card({
  label,
  value,
  valueClass = "",
  children,
}: {
  label: string;
  value: string;
  valueClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[9px] border border-border-soft bg-panel px-3.5 py-3">
      <p className="mb-1.5 text-[11px] uppercase tracking-[0.6px] text-faint">{label}</p>
      <p className={`num text-[19px] font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-[11.5px]">{children}</p>
    </div>
  );
}

export function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const update = () => setNow(new Date().toLocaleTimeString("cs-CZ"));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right text-xs text-muted-foreground">
      <b className="num text-foreground">{now}</b>
      <br />
      reálná data · živé tikání
    </div>
  );
}
