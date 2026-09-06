export const stepQrPayload = (orderNumber: string, stepOrder: number, hash: string) =>
  `MES:STEP:${orderNumber}:${stepOrder}:${hash}`;

export const manifestQrPayload = (manifestQr: string) => `MES:MNF:${manifestQr}`;

export function parseQr(text: string):
  | { kind: "STEP"; orderNumber: string; stepOrder: number; hash: string }
  | { kind: "MNF"; manifest: string }
  | { kind: "UNKNOWN"; raw: string } {
  const s = text.trim();
  if (s.startsWith("MES:STEP:")) {
    const [, , orderNumber, stepStr, hash] = s.split(":");
    return { kind: "STEP", orderNumber, stepOrder: Number(stepStr), hash };
  }
  if (s.startsWith("MES:MNF:")) return { kind: "MNF", manifest: s.replace("MES:MNF:", "") };
  if (s.startsWith("MNF-")) return { kind: "MNF", manifest: s };
  return { kind: "UNKNOWN", raw: s };
}
