"use client";

import { DemoProjectTour, type DemoProjectTourConfig } from "@/components/onboarding/demo-project-tour";

export function DemoProjectGuide({
  config,
  autoOpen = false,
}: {
  config: DemoProjectTourConfig;
  autoOpen?: boolean;
}) {
  return <DemoProjectTour config={config} showGuideCard autoOpen={autoOpen} />;
}
