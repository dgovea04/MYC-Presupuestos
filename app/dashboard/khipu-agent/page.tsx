import { redirect } from "next/navigation";

export const metadata = {
  title: "Khipu - MC Presupuestos",
  description: "Asistente tecnico y agente para presupuestos de obra.",
};

export default function KhipuAgentRedirectPage() {
  redirect("/ai?mode=agent");
}
