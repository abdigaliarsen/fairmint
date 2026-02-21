"use client";

import { useState, useEffect, useCallback } from "react";

interface SpotlightOverlayProps {
  targetSelector: string;
  onRectChange?: (rect: DOMRect | null) => void;
}

export default function SpotlightOverlay({
  targetSelector,
  onRectChange,
}: SpotlightOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    // Find the first visible element matching the selector
    // (both desktop and mobile nav may share the same data-tour attribute)
    const elements = document.querySelectorAll(
      `[data-tour="${targetSelector}"]`
    );
    let visibleEl: Element | null = null;
    for (const el of elements) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        visibleEl = el;
        break;
      }
    }

    if (!visibleEl) {
      setRect(null);
      onRectChange?.(null);
      return;
    }

    const r = visibleEl.getBoundingClientRect();
    setRect(r);
    onRectChange?.(r);

    // Scroll into view if needed
    const inView =
      r.top >= 0 &&
      r.left >= 0 &&
      r.bottom <= window.innerHeight &&
      r.right <= window.innerWidth;
    if (!inView) {
      visibleEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetSelector, onRectChange]);

  useEffect(() => {
    updateRect();

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    // Watch for DOM changes that might move the target
    const observer = new MutationObserver(updateRect);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      observer.disconnect();
    };
  }, [updateRect]);

  if (!rect) return null;

  const padding = 8;
  const x = rect.left - padding;
  const y = rect.top - padding;
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;

  return (
    <svg
      className="pointer-events-auto fixed inset-0 z-[60]"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <defs>
        <mask id="spotlight-mask">
          {/* White = visible overlay area */}
          <rect width="100%" height="100%" fill="white" />
          {/* Black = transparent cutout */}
          <rect x={x} y={y} width={w} height={h} rx={8} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.6)"
        mask="url(#spotlight-mask)"
      />
    </svg>
  );
}
