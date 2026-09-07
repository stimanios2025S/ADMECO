export const yieldCoeff = (good: number, expected: number) =>
  expected > 0 ? good / expected : 0;

export const scrapPct = (good: number, scrap: number) =>
  good + scrap > 0 ? (scrap / (good + scrap)) * 100 : 0;

export const isScrapAlert = (g: number, s: number) => scrapPct(g, s) > 5;

export const isOverdue = (actual: number, est: number) => actual > est;

export const fmtVariance = (actual: number, est: number) => {
  const d = actual - est;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(1)} min`;
};
