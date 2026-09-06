"use client";
import { get, set } from "idb-keyval";

const KEY = "mes-offline-queue-v1";
export type QueuedOp = {
  id: string;
  type: "STEP_SCAN" | "STEP_COMPLETE" | "MATERIAL_LOG" | "SPLIT" | "TRANSFER_VERIFY";
  payload: any;
  createdAt: string;
  attempts: number;
};

export async function enqueue(op: Omit<QueuedOp, "id" | "createdAt" | "attempts">) {
  const q = (await get<QueuedOp[]>(KEY)) ?? [];
  q.push({ ...op, id: crypto.randomUUID(), createdAt: new Date().toISOString(), attempts: 0 });
  await set(KEY, q);
  return q.length;
}
export async function peek(): Promise<QueuedOp[]> { return (await get<QueuedOp[]>(KEY)) ?? []; }
export async function removeIds(ids: string[]) {
  const q = (await get<QueuedOp[]>(KEY)) ?? [];
  await set(KEY, q.filter((o) => !ids.includes(o.id)));
}
export async function queueCount() { return (await peek()).length; }
