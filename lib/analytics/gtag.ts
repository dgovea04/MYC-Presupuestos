export type AnalyticsPrimitive = string | number | boolean | null | undefined;

export type GtagEventParams = Record<string, AnalyticsPrimitive>;

type ConsentStorageState = "denied" | "granted";

export type Gtag = {
  (command: "config", targetId: string, params?: GtagEventParams): void;
  (command: "consent", action: "default" | "update", params: {
    analytics_storage: ConsentStorageState;
    ad_storage: ConsentStorageState;
    wait_for_update?: number;
  }): void;
  (command: "event", eventName: string, params?: GtagEventParams): void;
  (command: "set", params: GtagEventParams): void;
};

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: Gtag;
  }
}

export function getGtag(): Gtag | null {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return null;
  }

  return window.gtag;
}

export {};
