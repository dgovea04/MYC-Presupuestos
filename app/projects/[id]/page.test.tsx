import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getProjectAttachments: vi.fn(),
  getProjectOverviewById: vi.fn(),
  getProjectOtherSections: vi.fn(),
  getUserSettings: vi.fn(),
  listProjectActivityEvents: vi.fn(),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/onboarding/demo-project-guide", () => ({
  DemoProjectGuide: () => <div>5 minutos para conocer MC Presupuestos</div>,
}));

vi.mock("@/components/exports/export-panel", () => ({
  ExportPanel: () => null,
}));

vi.mock("@/components/projects/project-activity-history", () => ({
  ProjectActivityHistory: () => null,
}));

vi.mock("@/components/projects/project-attachment-upload", () => ({
  ProjectAttachmentUpload: () => null,
}));

vi.mock("@/components/projects/project-budget-sections", () => ({
  ProjectBudgetSections: () => null,
}));

vi.mock("@/components/ui/action-button", () => ({
  ActionButton: () => null,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/context-badges", () => ({
  ContextBadge: () => null,
  ProjectStatusBadge: () => null,
}));

vi.mock("@/components/ui/info-cards", () => ({
  InfoCard: () => null,
}));

vi.mock("@/components/ui/page-header-card", () => ({
  PageHeaderCard: () => null,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/activity-events", () => ({
  listProjectActivityEvents: mocks.listProjectActivityEvents,
}));

vi.mock("@/lib/data/attachments", () => ({
  getProjectAttachments: mocks.getProjectAttachments,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectOverviewById: mocks.getProjectOverviewById,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

vi.mock("@/lib/db/serializers", () => ({
  decimalToNumber: (value: number) => value,
}));

vi.mock("@/lib/exports/definitions", () => ({
  getExportDefinition: () => ({ id: "project_package" }),
}));

vi.mock("@/lib/projects/general-budget", () => ({
  resolveProjectGeneralBudget: () => null,
}));

vi.mock("@/lib/projects/labels", () => ({
  buildingSubtypeLabel: () => null,
  contractTypeLabel: () => null,
  projectCategoryLabel: () => null,
}));

vi.mock("@/lib/projects/other-sections", () => ({
  getProjectOtherSections: mocks.getProjectOtherSections,
}));

vi.mock("@/lib/utils", () => ({
  ensureDate: (value: Date) => value,
  formatDate: () => "13/08/2026",
}));

vi.mock("@/lib/work-schedule/calendar", () => ({
  formatWorkDaysLabel: () => "Lun-Vie",
}));

import ProjectDetailPage from "@/app/projects/[id]/page";

describe("ProjectDetailPage demo guide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectAttachments.mockResolvedValue([]);
    mocks.getProjectOtherSections.mockReturnValue([]);
    mocks.getUserSettings.mockResolvedValue({ dateFormat: "DD/MM/YYYY" });
    mocks.listProjectActivityEvents.mockResolvedValue([]);
  });

  it("renders the five-minute guide for a demo project", async () => {
    mocks.getProjectOverviewById.mockResolvedValue(createProject({ isDemo: true }));

    const tree = await ProjectDetailPage({ params: Promise.resolve({ id: "project-1" }) });

    expect(renderToStaticMarkup(tree)).toContain("5 minutos para conocer MC Presupuestos");
  });

  it("does not render the five-minute guide for a non-demo project", async () => {
    mocks.getProjectOverviewById.mockResolvedValue(createProject({ isDemo: false }));

    const tree = await ProjectDetailPage({ params: Promise.resolve({ id: "project-1" }) });

    expect(renderToStaticMarkup(tree)).not.toContain("5 minutos para conocer MC Presupuestos");
  });
});

function createProject({ isDemo }: { isDemo: boolean }) {
  return {
    id: "project-1",
    name: "Edificio Multifamiliar - Demo",
    isDemo,
    clientName: null,
    location: null,
    projectCategory: null,
    workCalendar: null,
    updatedAt: new Date("2026-08-13T00:00:00.000Z"),
    status: "PLANNING",
    company: { name: "Constructora Demo" },
    budgets: [],
  };
}
