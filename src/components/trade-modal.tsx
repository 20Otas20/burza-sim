import { useEffect, useState } from "react";
import { num, pct, usd } from "@/lib/portfolio";

export function TradeModal({
  symbol,
  name,
  price,
  changePercent,
  cash,
  ownedQty,
  side,
  onSide,
  onClose,
  onConfirm,
}: {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  cash: number;
  ownedQty: number;
  side: "B" | "S";
  onSide: (s: "B" | "S") => void;
  onClose: () => void;
  onConfirm: (qty: number) => void;
}) {
  const [qtyText, setQtyText] = useState("1");
  const qty = Math.max(0, parseInt(qtyText, 10) || 0);
  const total = qty * price;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const error =
    !price
      ? "Cena zatím není k dispozici."
      : side === "B" && total > cash
        ? "Nedostatek hotovosti."
        : side === "S" && qty > ownedQty
          ? "Nevlastníš tolik kusů."
          : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.1_0.01_258_/_0.7)] backdrop-blur-[2px] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[340px] rounded-xl border border-border bg-panel p-5 shadow-2xl">
        <h3 className="disp text-base font-semibold">{name}</h3>
        <p className="mb-4 text-[11.5px] text-faint">
          {symbol} · tržní cena <b className="num text-foreground">{usd(price)}</b>{" "}
          <span className={`num ${changePercent >= 0 ? "text-up" : "text-down"}`}>
            {pct(changePercent)}
          </span>
        </p>

        <div className="mb-3.5 flex rounded-[7px] border border-border-soft bg-[var(--bg2)] p-[3px]">
          {(["B", "S"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSide(s)}
              className={`flex-1 rounded-[5px] py-1.5 text-xs font-semibold transition-colors ${
                side === s
                  ? s === "B"
                    ? "bg-up-soft text-up"
                    : "bg-down-soft text-down"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "B" ? "Koupit" : "Prodat"}
            </button>
          ))}
        </div>

        <label className="mb-1.5 block text-[11px] text-faint" htmlFor="qty">
          Počet kusů
        </label>
        <input
          id="qty"
          type="number"
          min={1}
          step={1}
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value)}
          className="num mb-3 w-full rounded-[7px] border border-border bg-[var(--bg2)] px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary"
        />

        <Row label="Cena za kus" value={usd(price)} />
        <Row label="Celkem" value={usd(total)} />
        <Row
          label={side === "B" ? "Hotovost k dispozici" : "Vlastněných kusů"}
          value={side === "B" ? usd(cash) : num(ownedQty, 0)}
        />

        <p className="min-h-[16px] pt-1.5 text-[11px] text-down">{error}</p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border-soft py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            Zrušit
          </button>
          <button
            disabled={!!error || qty <= 0}
            onClick={() => onConfirm(qty)}
            className={`flex-1 rounded-md border py-2 text-[13px] font-semibold transition-colors disabled:opacity-40 ${
              side === "B"
                ? "border-up/35 text-up hover:bg-up-soft"
                : "border-down/35 text-down hover:bg-down-soft"
            }`}
          >
            {side === "B" ? "Koupit" : "Prodat"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-[3px] text-xs text-muted-foreground">
      <span>{label}</span>
      <b className="num text-foreground">{value}</b>
    </div>
  );
}
