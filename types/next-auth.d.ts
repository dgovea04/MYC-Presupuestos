import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      avatarUrl?: string | null;
      phone?: string | null;
      jobTitle?: string | null;
      bio?: string | null;
      role?: "ADMIN" | "USER";
      status?: "ACTIVE" | "SUSPENDED";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    avatarUrl?: string | null;
    phone?: string | null;
    jobTitle?: string | null;
    bio?: string | null;
    role?: "ADMIN" | "USER";
    status?: "ACTIVE" | "SUSPENDED";
  }
}
