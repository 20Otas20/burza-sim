import { useEffect, useRef, useState } from "react";

export type LiveTick = {
  price: number;
  bid: number;
  ask: number;
  direction: "up" | "down" | "flat";
};

// Spread a "šum" mezi skutečnými aktualizacemi jsou v bazických bodech (1 bp = 0,01 %).
// Cena je vždy ukotvená na posledním reálném kurzu z Yahoo Finance — simulace jen
// vyplňuje čas mezi dotazy, aby to působilo živě, nikdy neuteče od reality.
const SPREAD_BPS = 2;
const JITTER_BPS = 3;
const TICK_MS = 1000;

export function useLiveTick(anchorPrice: number | undefined): LiveTick | null {
  const [tick, setTick] = useState<LiveTick | null>(null);
  const currentRef = useRef<number | undefined>(anchorPrice);
  const lastRef = useRef<number | undefined>(anchorPrice);

  // Nový reálný kurz ze serveru = nové ukotvení simulace.
  useEffect(() => {
    if (anchorPrice != null) currentRef.current = anchorPrice;
  }, [anchorPrice]);

  useEffect(() => {
    if (anchorPrice == null) return;
    const id = setInterval(() => {
      const base = currentRef.current ?? anchorPrice;
      const jitter = (Math.random() - 0.5) * 2 * (JITTER_BPS / 10000) * base;
      const next = Math.max(0.01, base + jitter);
      currentRef.current = next;
      const prev = lastRef.current ?? next;
      lastRef.current = next;
      const spread = (SPREAD_BPS / 10000) * next;
      setTick({
        price: next,
        bid: next - spread / 2,
        ask: next + spread / 2,
        direction: next > prev ? "up" : next < prev ? "down" : "flat",
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [anchorPrice]);

  return tick;
}
