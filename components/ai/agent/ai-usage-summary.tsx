import { Badge } from "@/components/ui/badge";

type Props = { provider?: string | null; model?: string | null; source?: string | null; billingScope?: string | null };
export function AiUsageSummary({ provider, model, source, billingScope }: Props) { return <div className="flex flex-wrap gap-2 text-xs" aria-label="Resumen de ejecución IA"><Badge variant="secondary">Proveedor: {provider ?? "automático"}</Badge><Badge variant="secondary">Modelo: {model ?? "predeterminado"}</Badge><Badge variant="secondary">Credencial: {source ?? "plataforma"}</Badge><Badge variant="secondary">Cobro: {billingScope ?? "plataforma"}</Badge></div>; }
