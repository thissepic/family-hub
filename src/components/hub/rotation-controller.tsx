"use client";

import { useEffect, useState, useCallback } from "react";

interface RotationControllerProps {
  enabled: boolean;
  intervalSec: number;
  totalPages: number;
  children: (currentPage: number) => React.ReactNode;
}

export function RotationController({
  enabled,
  intervalSec,
  totalPages,
  children,
}: RotationControllerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [paused, setPaused] = useState(false);

  const advance = useCallback(() => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  }, [totalPages]);

  // Auto-advance
  useEffect(() => {
    if (!enabled || paused || totalPages <= 1) return;

    const timer = setInterval(advance, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [enabled, paused, intervalSec, totalPages, advance]);

  // Reset when pages change
  useEffect(() => {
    setCurrentPage(0);
  }, [totalPages]);

  if (!enabled || totalPages <= 1) {
    return <>{children(0)}</>;
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      className="relative"
    >
      {children(currentPage)}

      {/* Page indicators */}
      <div className="flex items-center justify-center gap-2 py-3">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`h-2 rounded-full transition-all ${
              i === currentPage
                ? "w-6 bg-primary"
                : "w-2 bg-muted-foreground/30"
            }`}
            aria-label={`Page ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
