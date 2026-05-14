import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1e3a8a_0%,#0f172a_38%,#020617_100%)] px-6 py-12">
      <Card className="w-full max-w-md border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur">
        <CardContent className="space-y-5 p-6">
          <PageHeaderCard
            icon={<LockKeyhole className="h-5 w-5" />}
            title="Iniciar sesión"
            description="Accede a tu dashboard de presupuestos y APUs."
          />
          <LoginForm />
          <p className="text-center text-sm text-slate-500">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="font-medium text-sky-700">
              Regístrate
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
