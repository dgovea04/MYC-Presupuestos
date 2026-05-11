import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await getAuthSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,#0f172a_0%,#0b1120_100%)] px-6 py-20 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.03)_100%)]" />
      <div className="relative z-10 grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-8">
          <div className="inline-flex rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm text-sky-100">
            MVP inicial para presupuestos APU en Perú
          </div>
          <div className="space-y-5">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white">
              Crea presupuestos de obra profesionales con una experiencia tipo Excel moderna.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Gestiona obras, partidas, subpartidas, APUs, insumos y reportes en PDF/Excel desde una sola plataforma.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg">Empezar gratis</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                Iniciar sesión
              </Button>
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/8 p-6 shadow-2xl backdrop-blur">
          <div className="rounded-2xl bg-white p-5 text-slate-900">
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Costo directo</p>
                <p className="mt-1 font-semibold">S/ 98,220</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">GG + Utilidad</p>
                <p className="mt-1 font-semibold">S/ 17,680</p>
              </div>
              <div className="rounded-2xl bg-sky-50 p-3">
                <p className="text-xs text-sky-600">Total</p>
                <p className="mt-1 font-semibold text-sky-700">S/ 136,762</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-right">Parcial</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-3">01.01</td>
                    <td className="px-3 py-3">Muros</td>
                    <td className="px-3 py-3 text-right">S/ 28,500</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-3">01.02</td>
                    <td className="px-3 py-3">Concreto armado</td>
                    <td className="px-3 py-3 text-right">S/ 41,120</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-3">01.03</td>
                    <td className="px-3 py-3">Acabados</td>
                    <td className="px-3 py-3 text-right">S/ 28,600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
