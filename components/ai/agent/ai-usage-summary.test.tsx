/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiUsageSummary } from "./ai-usage-summary";
describe("AiUsageSummary", () => { it("shows effective attribution", () => { render(<AiUsageSummary provider="openai" model="gpt-5-mini" source="WORKSPACE" billingScope="WORKSPACE" />); expect(screen.getByText("Proveedor: openai")).toBeTruthy(); expect(screen.getByText("Cobro: WORKSPACE")).toBeTruthy(); }); });
