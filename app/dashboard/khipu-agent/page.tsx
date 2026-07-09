import { AgentWorkspace } from "@/components/ai/AgentWorkspace";

export const metadata = {
  title: "Khipu Agent - MC Presupuestos",
  description: "Asistente técnico agéntico para presupuestos de obra.",
};

export default function KhipuAgentPage() {
  return (
    <div className="p-4">
      <AgentWorkspace className="h-[calc(100vh-5rem)]" />
    </div>
  );
}
