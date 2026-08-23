import { NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/auth/email-verification";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const nextPath = getSafeNextPath(url.searchParams.get("next"));

  if (!token) {
    return redirectToLogin(url, "0", "invalid", nextPath);
  }

  const result = await consumeEmailVerificationToken(token);

  if (result.status === "verified") {
    return redirectToLogin(url, "1", null, nextPath);
  }

  return redirectToLogin(url, "0", result.status, nextPath);
}

function redirectToLogin(url: URL, verified: "0" | "1", reason: string | null, nextPath: string | null) {
  const params = new URLSearchParams({ verified });
  if (reason) params.set("reason", reason);
  if (nextPath) params.set("next", nextPath);
  return NextResponse.redirect(new URL(`/login?${params.toString()}`, url));
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
