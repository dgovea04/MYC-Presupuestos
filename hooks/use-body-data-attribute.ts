import { useEffect } from "react";

export function useBodyDataAttribute(attributeName: string, value = "true") {
  useEffect(() => {
    const counterAttributeName = `${attributeName}-count`;
    const currentCount = Number.parseInt(document.body.getAttribute(counterAttributeName) ?? "0", 10);
    const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;

    document.body.setAttribute(attributeName, value);
    document.body.setAttribute(counterAttributeName, String(nextCount));

    return () => {
      const mountedCount = Number.parseInt(document.body.getAttribute(counterAttributeName) ?? "0", 10);
      const nextMountedCount = Number.isFinite(mountedCount) ? mountedCount - 1 : 0;

      if (nextMountedCount <= 0) {
        document.body.removeAttribute(attributeName);
        document.body.removeAttribute(counterAttributeName);
        return;
      }

      document.body.setAttribute(counterAttributeName, String(nextMountedCount));
    };
  }, [attributeName, value]);
}
