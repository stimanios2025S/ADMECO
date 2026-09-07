export type StockItem = {
  id: string; name: string; unit: string; quantity: number;
  reserved: number; available: number; low_stock: boolean;
};

export type MaterialEstimate = { material: string; qty: number; unit: string };

export type StockMovement = {
  id: string; stock_item_id: string; movement_type: string;
  quantity: number; note?: string; created_at: string;
};

export function calcReservationNeeded(
  standardMaterials: MaterialEstimate[],
  itemQuantity: number
): { material: string; qty: number; unit: string }[] {
  return standardMaterials.map((m) => ({
    material: m.material,
    qty: +(m.qty * itemQuantity).toFixed(3),
    unit: m.unit
  }));
}

export function stockHealth(item: StockItem): "ok" | "low" | "critical" {
  if (item.available <= 0) return "critical";
  if (item.low_stock) return "low";
  return "ok";
}

export function fmtQty(qty: number, unit: string): string {
  return `${qty.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${unit}`;
}
