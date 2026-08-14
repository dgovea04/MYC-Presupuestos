import { LockKeyhole } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1e3a8a_0%,#0f172a_38%,#020617_100%)] px-6 py-12">
      <Card className="w-full max-w-md border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur">
        <CardContent className="space-y-5 p-6">
          <PageHeaderCard
            icon={<LockKeyhole className="h-5 w-5" />}
            title="Cambiar contrasena"
            description="Define una nueva contrasena para recuperar el acceso a tu cuenta."
          />
          <PasswordResetForm />
        </CardContent>
      </Card>
    </main>
  );
}
