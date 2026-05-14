import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1e3a8a_0%,#0f172a_38%,#020617_100%)] px-6 py-12">
      <Card className="w-full max-w-lg border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur">
        <CardContent className="space-y-5 p-6">
          <PageHeaderCard
            icon={<Building2 className="h-5 w-5" />}
            title="Crear cuenta"
            description="Empieza con tu empresa o perfil profesional y deja lista la base para trabajar proyectos y presupuestos."
          />
          <RegisterForm />
          <p className="text-center text-sm text-slate-500">
            ¿Ya tienes acceso?{" "}
            <Link href="/login" className="font-medium text-sky-700">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
