"use client";

import { DemoProjectTour, type DemoProjectTourConfig } from "@/components/onboarding/demo-project-tour";

export function DemoProjectGuide({ config }: { config: DemoProjectTourConfig }) {
  return <DemoProjectTour config={config} showGuideCard />;
}
