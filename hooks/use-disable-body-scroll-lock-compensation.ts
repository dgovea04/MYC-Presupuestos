import { useEffect } from "react";

const COUNTER_ATTRIBUTE = "data-scroll-lock-compensation-disabled-count";

export function useDisableBodyScrollLockCompensation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const body = document.body;
    const currentCount = Number.parseInt(body.getAttribute(COUNTER_ATTRIBUTE) ?? "0", 10);
    const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;

    body.setAttribute(COUNTER_ATTRIBUTE, String(nextCount));

    const syncBodyStyles = () => {
      if (!body.hasAttribute("data-scroll-locked")) {
        body.style.removeProperty("margin-right");
        body.style.removeProperty("padding-right");
        body.style.removeProperty("overflow");
        body.style.removeProperty("overscroll-behavior");
        return;
      }

      body.style.setProperty("margin-right", "0px", "important");
      body.style.setProperty("padding-right", "0px", "important");
      body.style.setProperty("overflow", "auto", "important");
      body.style.setProperty("overscroll-behavior", "auto", "important");
    };

    syncBodyStyles();

    const observer = new MutationObserver(syncBodyStyles);
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked"],
    });

    return () => {
      observer.disconnect();

      const mountedCount = Number.parseInt(body.getAttribute(COUNTER_ATTRIBUTE) ?? "0", 10);
      const remainingCount = Number.isFinite(mountedCount) ? mountedCount - 1 : 0;

      if (remainingCount <= 0) {
        body.removeAttribute(COUNTER_ATTRIBUTE);
        body.style.removeProperty("margin-right");
        body.style.removeProperty("padding-right");
        body.style.removeProperty("overflow");
        body.style.removeProperty("overscroll-behavior");
        return;
      }

      body.setAttribute(COUNTER_ATTRIBUTE, String(remainingCount));
    };
  }, [enabled]);
}
