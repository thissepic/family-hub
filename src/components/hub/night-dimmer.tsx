"use client";

import { useEffect, useState } from "react";

interface NightDimmerProps {
  enabled: boolean;
  startTime: string | null; // "HH:MM"
  endTime: string | null; // "HH:MM"
}

function isInDimPeriod(start: string, end: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight periods (e.g., 22:00 - 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function NightDimmer({ enabled, startTime, endTime }: NightDimmerProps) {
  const [dimmed, setDimmed] = useState(false);

  useEffect(() => {
    if (!enabled || !startTime || !endTime) {
      setDimmed(false);
      return;
    }

    // Check immediately
    setDimmed(isInDimPeriod(startTime, endTime));

    // Check every minute
    const timer = setInterval(() => {
      setDimmed(isInDimPeriod(startTime, endTime));
    }, 60_000);

    return () => clearInterval(timer);
  }, [enabled, startTime, endTime]);

  if (!dimmed) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 pointer-events-none z-50 transition-opacity duration-1000"
      aria-hidden="true"
    />
  );
}
