"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeSteps } from "@/hooks/useRealtimeSteps";

export default function OrderLiveRefresh({ orderId }: { orderId: string }) {
  const tick = useRealtimeSteps(orderId);
  const router = useRouter();
  useEffect(() => { if (tick > 0) router.refresh(); }, [tick, router]);
  return null;
}
