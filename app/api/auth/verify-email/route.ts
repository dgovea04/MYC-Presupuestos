import { NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/auth/email-verification";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?verified=0&reason=invalid", url));
  }

  const result = await consumeEmailVerificationToken(token);

  if (result.status === "verified") {
    return NextResponse.redirect(new URL("/login?verified=1", url));
  }

  return NextResponse.redirect(new URL(`/login?verified=0&reason=${result.status}`, url));
}
