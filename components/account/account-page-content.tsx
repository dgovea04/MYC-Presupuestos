"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight, Bot, Coins, KeyRound, Mail, Shield, Upload, UserRound, Zap } from "lucide-react";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { formatDate } from "@/lib/utils";
import type { AccountMembershipRecord, AccountRecord } from "@/types/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_PROFILE_ERROR = "No se pudo guardar tu perfil.";
const DEFAULT_AVATAR_ERROR = "No se pudo guardar la imagen de perfil.";
const DEFAULT_PASSWORD_ERROR = "No se pudo actualizar la contrasena.";

export function AccountPageContent({
  initialAccount,
  membership,
}: {
  initialAccount: AccountRecord;
  membership?: AccountMembershipRecord;
}) {
  const [account, setAccount] = useState(initialAccount);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="space-y-6">
        <Card className="border-slate-200">
          <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900 p-2 text-white">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Mi perfil</CardTitle>
                <CardDescription>Edita tus datos personales, tu foto y la seguridad de tu cuenta.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <AccountProfileForm account={account} onSaved={setAccount} />
            <AccountAvatarForm account={account} onSaved={setAccount} />
            <AccountPasswordForm />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:sticky xl:top-5">
        {membership ? <AccountMembershipCard account={account} membership={membership} /> : null}
        <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <CardHeader>
            <CardTitle>Resumen de cuenta</CardTitle>
            <CardDescription>Vista rapida del estado actual de tu cuenta de acceso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              {account.avatarUrl ? (
                <Image
                  alt={`Avatar de ${account.name}`}
                  className="h-16 w-16 rounded-full object-cover"
                  height={64}
                  src={account.avatarUrl}
                  width={64}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-700">
                  {getInitials(account.name, account.email)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{account.name}</p>
                <p className="truncate text-sm text-slate-500">{account.email}</p>
              </div>
            </div>

            <SummaryRow label="Correo" value={account.email} />
            <SummaryRow label="Cargo" value={account.jobTitle || "No definido"} />
            <SummaryRow label="Telefono" value={account.phone || "No definido"} />
            <SummaryRow label="Perfil" value={account.bio || "Sin descripcion"} />
            <SummaryRow label="Miembro desde" value={formatDate(account.createdAt, "DD_MMM_YYYY")} />
            <SummaryRow label="Avatar" value={account.avatarUrl ? "Imagen cargada" : "Iniciales"} />
            <SummaryRow label="Seguridad" value="Contrasena protegida" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccountMembershipCard({
  account,
  membership,
}: {
  account: AccountRecord;
  membership: AccountMembershipRecord;
}) {
  const upgradeHref = buildMembershipMailto(account, "upgrade");
  const tokensHref = buildMembershipMailto(account, "tokens");
  const usagePercent = membership.allowance > 0 ? Math.min(100, Math.round((membership.consumedTokens / membership.allowance) * 100)) : 0;

  return (
    <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-sky-600 p-2 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Membresia e IA</CardTitle>
            <CardDescription>Consulta tu plan y tokens disponibles. Estos datos no son editables desde tu cuenta.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Plan actual</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{membership.planName}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
              {membership.planSlug || "sin-plan"}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <TokenMetric icon={<Zap className="h-4 w-4" />} label="Disponibles" value={formatTokenNumber(membership.availableTokens)} />
          <TokenMetric icon={<Coins className="h-4 w-4" />} label="Cupo mensual" value={formatTokenNumber(membership.allowance)} />
          <TokenMetric icon={<Bot className="h-4 w-4" />} label="Consumidos" value={formatTokenNumber(membership.consumedTokens)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Uso del periodo</span>
            <span>{usagePercent}%</span>
          </div>
          <progress
            aria-label="Uso de tokens IA del periodo"
            className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-sky-600 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-sky-600"
            max={100}
            value={usagePercent}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <AccountActionLink href={upgradeHref} label="Upgrade membresia" />
          <AccountActionLink href={tokensHref} label="Agregar tokens" />
        </div>
      </CardContent>
    </Card>
  );
}

function TokenMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-slate-500">
        <span className="text-sky-600">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function AccountActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
    >
      {label}
      <ArrowUpRight className="h-4 w-4" />
    </a>
  );
}

function formatTokenNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function buildMembershipMailto(account: AccountRecord, intent: "upgrade" | "tokens") {
  const subject = intent === "upgrade" ? "Solicitud de upgrade de membresia" : "Solicitud para agregar tokens IA";
  const body =
    intent === "upgrade"
      ? `Hola equipo MYC,\n\nQuiero solicitar un upgrade de membresia para la cuenta ${account.email}.\n\nGracias.`
      : `Hola equipo MYC,\n\nQuiero agregar tokens IA para la cuenta ${account.email}.\n\nGracias.`;

  return `mailto:soporte@mycpresupuestos.pe?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function AccountProfileForm({ account, onSaved }: { account: AccountRecord; onSaved: (account: AccountRecord) => void }) {
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone);
  const [jobTitle, setJobTitle] = useState(account.jobTitle);
  const [bio, setBio] = useState(account.bio);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, jobTitle, bio }),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response, DEFAULT_PROFILE_ERROR));
        return;
      }

      const savedAccount = (await response.json()) as AccountRecord;
      onSaved(savedAccount);
      setSuccess("Perfil actualizado correctamente.");
      broadcastAccountChange();
    } catch {
      setError(DEFAULT_PROFILE_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">Perfil personal</p>
        <p className="text-sm text-slate-500">Tu correo se muestra como referencia y no es editable en esta version.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accountName">Nombre</Label>
          <Input id="accountName" disabled={pending} required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accountEmail">Correo</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="accountEmail" className="pl-9" disabled value={account.email} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="accountPhone">Telefono</Label>
          <Input id="accountPhone" disabled={pending} placeholder="987654321" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accountJobTitle">Cargo</Label>
          <Input
            id="accountJobTitle"
            disabled={pending}
            placeholder="Ingeniera Residente"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountBio">Descripcion profesional</Label>
        <textarea
          id="accountBio"
          className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 disabled:pointer-events-none disabled:opacity-50"
          disabled={pending}
          maxLength={320}
          placeholder="Especialista en costos, presupuestos y control de obra."
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
      </div>

      <InlineFeedback error={error} success={success} />

      <div className="flex justify-end">
        <Button disabled={pending} type="submit">{pending ? "Guardando..." : "Guardar perfil"}</Button>
      </div>
    </form>
  );
}

function AccountAvatarForm({ account, onSaved }: { account: AccountRecord; onSaved: (account: AccountRecord) => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Selecciona una imagen antes de subirla.");
      return;
    }

    setPending(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.set("avatar", selectedFile);

      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setError(await getErrorMessage(response, DEFAULT_AVATAR_ERROR));
        return;
      }

      const savedAccount = (await response.json()) as AccountRecord;
      onSaved(savedAccount);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setSuccess("Imagen de perfil actualizada.");
      broadcastAccountChange();
    } catch {
      setError(DEFAULT_AVATAR_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/account/avatar", {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await getErrorMessage(response, DEFAULT_AVATAR_ERROR));
        return;
      }

      const savedAccount = (await response.json()) as AccountRecord;
      onSaved(savedAccount);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setSuccess("Avatar eliminado correctamente.");
      broadcastAccountChange();
    } catch {
      setError(DEFAULT_AVATAR_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={handleUpload}>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">Foto de perfil</p>
        <p className="text-sm text-slate-500">Acepta JPG o PNG de hasta 2 MB. Asi tu foto tambien podra salir en PDF y Excel.</p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        {account.avatarUrl ? (
          <Image
            alt={`Avatar de ${account.name}`}
            className="h-20 w-20 rounded-full object-cover"
            height={80}
            src={account.avatarUrl}
            width={80}
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-xl font-semibold text-sky-700">
            {getInitials(account.name, account.email)}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={inputId}>Nueva imagen</Label>
          <Input
            ref={inputRef}
            accept="image/jpeg,image/png"
            disabled={pending}
            id="accountAvatar"
            name="accountAvatar"
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-sm text-slate-500">
            {selectedFile
              ? selectedFile.name
              : account.avatarUrl?.toLowerCase().endsWith(".webp")
                ? "Tu avatar actual sigue visible en la app, pero para exportes conviene reemplazarlo por PNG o JPG."
                : "Aun no seleccionaste ninguna imagen."}
          </p>
        </div>
      </div>

      <InlineFeedback error={error} success={success} />

      <div className="flex flex-wrap justify-end gap-3">
        <Button disabled={pending || !account.avatarUrl} type="button" variant="outline" onClick={handleRemove}>
          Quitar imagen
        </Button>
        <Button disabled={pending || !selectedFile} type="submit">
          <Upload className="mr-2 h-4 w-4" />
          {pending ? "Subiendo..." : "Subir imagen"}
        </Button>
      </div>
    </form>
  );
}

function AccountPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response, DEFAULT_PASSWORD_ERROR));
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Contrasena actualizada correctamente.");
      broadcastAccountChange();
    } catch {
      setError(DEFAULT_PASSWORD_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-900">Seguridad</p>
        </div>
        <p className="text-sm text-slate-500">Cambia tu contrasena validando primero tu clave actual.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PasswordField
          id="currentPassword"
          disabled={pending}
          label="Contrasena actual"
          value={currentPassword}
          onChange={setCurrentPassword}
        />
        <PasswordField
          id="newPassword"
          disabled={pending}
          label="Nueva contrasena"
          value={newPassword}
          onChange={setNewPassword}
        />
        <PasswordField
          id="confirmPassword"
          disabled={pending}
          label="Confirmacion"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
      </div>

      <InlineFeedback error={error} success={success} />

      <div className="flex justify-end">
        <Button disabled={pending} type="submit">
          <KeyRound className="mr-2 h-4 w-4" />
          {pending ? "Guardando..." : "Cambiar contrasena"}
        </Button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  disabled,
  label,
  value,
  onChange,
}: {
  id: string;
  disabled: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} disabled={disabled} required type="password" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function InlineFeedback({ error, success }: { error: string; success: string }) {
  return (
    <>
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}
    </>
  );
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim() || "MYC";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() ?? "MY";
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function broadcastAccountChange() {
  broadcastAppDataChange(["/account", "/dashboard", "/projects", "/budgets", "/resources", "/settings"]);
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload: unknown = await response.json();

    if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {}

  return fallback;
}
