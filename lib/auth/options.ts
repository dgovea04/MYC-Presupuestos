import { Prisma } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";
import { authSessionCookieName } from "@/lib/auth/cookies";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { verifyAdminMfaCode } from "@/lib/auth/admin-mfa";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import {
  ensureUserHasCompany,
  registerUserWithCompanyAndDemo,
} from "@/lib/auth/registration";
import { getUserProfileColumnSupport } from "@/lib/data/user-profile-columns";
import { loginSchema } from "@/lib/validations/auth";
import { ensureDemoProjectForCompany } from "@/lib/onboarding/demo-project";
import { assignAutomaticBetaForUser } from "@/lib/beta/assignments";
import { trackServerEvent } from "@/lib/analytics/events";
import { listUserWorkspaces } from "@/lib/workspace/active-workspace";

const authSecret =
  process.env.NEXTAUTH_SECRET ??
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production" ? undefined : "myc-presupuestos-dev-auth-secret");
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
const AUTH_USER_PROCESS_CACHE_TTL_MS = 5_000;
const shouldUseAuthUserProcessCache = process.env.NODE_ENV !== "production" && process.env.VITEST !== "true";

const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  passwordHash: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  emailVerifiedAt: z.date().nullable().optional(),
  passwordChangedAt: z.date().nullable().optional(),
  sessionVersion: z.number().int().nonnegative().optional().default(0),
  role: z.enum(["ADMIN", "USER"]).optional().default("USER"),
  adminProfile: z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT", "BILLING_ADMIN", "AUDITOR"]).nullable().optional().default(null),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional().default("ACTIVE"),
  isSuperAdmin: z.boolean().optional().default(false),
  mfaEnabled: z.boolean().optional().default(false),
});

type AuthUserRecord = z.infer<typeof authUserSchema>;
type AuthUserCacheEntry = {
  expiresAt: number;
  value: Promise<AuthUserRecord | null>;
};

const authUserByIdCache = new Map<string, AuthUserCacheEntry>();

function normalizeAuthUser(row: unknown): AuthUserRecord | null {
  const parsedUser = authUserSchema.safeParse(row);

  if (!parsedUser.success) {
    return null;
  }

  return {
    ...parsedUser.data,
    avatarUrl: parsedUser.data.avatarUrl ?? null,
    phone: parsedUser.data.phone ?? null,
    jobTitle: parsedUser.data.jobTitle ?? null,
    bio: parsedUser.data.bio ?? null,
    emailVerifiedAt: parsedUser.data.emailVerifiedAt ?? null,
    passwordChangedAt: parsedUser.data.passwordChangedAt ?? null,
    sessionVersion: parsedUser.data.sessionVersion,
    passwordHash: parsedUser.data.passwordHash ?? null,
    role: parsedUser.data.role,
    adminProfile: parsedUser.data.adminProfile,
    status: parsedUser.data.status,
    isSuperAdmin: parsedUser.data.isSuperAdmin,
    mfaEnabled: parsedUser.data.mfaEnabled,
  };
}

async function getAuthUserByEmail(email: string) {
  const profileColumns = await getUserProfileColumnSupport();
  const rows = await prisma.$queryRaw<Array<unknown>>`
    SELECT "id", "name", "email", "passwordHash", "emailVerifiedAt", "passwordChangedAt", "sessionVersion", "role", "adminProfile", "status", "isSuperAdmin", "mfaEnabled"
    ${profileColumns.avatarUrl ? Prisma.sql`, "avatarUrl"` : Prisma.empty}
    ${profileColumns.phone ? Prisma.sql`, "phone"` : Prisma.empty}
    ${profileColumns.jobTitle ? Prisma.sql`, "jobTitle"` : Prisma.empty}
    ${profileColumns.bio ? Prisma.sql`, "bio"` : Prisma.empty}
    FROM "User"
    WHERE "email" = ${email}
    LIMIT 1
  `;

  return normalizeAuthUser(rows[0]);
}

async function getAuthUserById(userId: string, options?: { bypassCache?: boolean }) {
  const useCache = shouldUseAuthUserProcessCache && !options?.bypassCache;

  if (useCache) {
    const existing = authUserByIdCache.get(userId);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.value;
    }
  }

  const value = getAuthUserByIdFromDatabase(userId);

  if (useCache) {
    authUserByIdCache.set(userId, {
      expiresAt: Date.now() + AUTH_USER_PROCESS_CACHE_TTL_MS,
      value: value.catch((error: unknown) => {
        authUserByIdCache.delete(userId);
        throw error;
      }),
    });
  }

  return value;
}

async function getAuthUserByIdFromDatabase(userId: string) {
  const profileColumns = await getUserProfileColumnSupport();
  const rows = await prisma.$queryRaw<Array<unknown>>`
    SELECT "id", "name", "email", "role", "adminProfile", "status", "isSuperAdmin", "mfaEnabled", "passwordChangedAt", "sessionVersion"
    ${profileColumns.avatarUrl ? Prisma.sql`, "avatarUrl"` : Prisma.empty}
    ${profileColumns.phone ? Prisma.sql`, "phone"` : Prisma.empty}
    ${profileColumns.jobTitle ? Prisma.sql`, "jobTitle"` : Prisma.empty}
    ${profileColumns.bio ? Prisma.sql`, "bio"` : Prisma.empty}
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;

  return normalizeAuthUser(rows[0]);
}

function getCredentialLoginIp(headers: Record<string, unknown> | undefined) {
  const realIp = headers?.["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  const forwardedFor = headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

function toSessionProfile(user: Pick<AuthUserRecord, "id" | "name" | "email" | "avatarUrl" | "phone" | "jobTitle" | "bio" | "role" | "adminProfile" | "status" | "isSuperAdmin" | "mfaEnabled" | "sessionVersion">) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    jobTitle: user.jobTitle,
    bio: user.bio,
    role: user.role,
    adminProfile: user.adminProfile,
    status: user.status,
    isSuperAdmin: user.isSuperAdmin,
    mfaEnabled: user.mfaEnabled,
    sessionVersion: user.sessionVersion,
  };
}

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: authSessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "Código MFA", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const normalizedEmail = parsed.data.email.toLowerCase();
        const clientIp = getCredentialLoginIp(request.headers as Record<string, unknown> | undefined);
        const accountRateLimit = await consumeRateLimit({
          key: `credentials-login:account:${normalizedEmail}`,
          maxAttempts: 10,
          windowMs: 15 * 60 * 1000,
        });
        const originRateLimit = await consumeRateLimit({
          key: `credentials-login:origin:${clientIp}`,
          maxAttempts: 50,
          windowMs: 15 * 60 * 1000,
        });

        if (!accountRateLimit.allowed || !originRateLimit.allowed) {
          return null;
        }

        const user = await getAuthUserByEmail(normalizedEmail);

        if (!user?.passwordHash || user.status === "SUSPENDED") {
          return null;
        }

        const isValid = await verifyPassword(parsed.data.password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        if (!user.emailVerifiedAt) {
          return null;
        }

        if (user.isSuperAdmin && user.mfaEnabled) {
          if (!parsed.data.mfaCode) {
            throw new Error("MFA_REQUIRED");
          }

          if (!(await verifyAdminMfaCode(user.id, parsed.data.mfaCode))) {
            return null;
          }
        }

        return toSessionProfile(user);
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (isSafeCallbackUrl(url)) return url;
      return `${baseUrl}/dashboard`;
    },
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const googleProfile = profile as {
          email?: string;
          email_verified?: boolean;
          name?: string;
          picture?: string;
        };

        if (!googleProfile.email) {
          return false;
        }

        if (googleProfile.email_verified === false) {
          return false;
        }

        const existingUser = await getAuthUserByEmail(googleProfile.email);

        if (existingUser) {
          if (existingUser.status === "SUSPENDED") {
            return false;
          }

          if (existingUser.isSuperAdmin && existingUser.mfaEnabled) {
            return false;
          }

          try {
            const companyId = await ensureUserHasCompany(existingUser.id, {
              name: existingUser.name,
              email: existingUser.email,
            });

            await ensureDemoProjectForCompany({
              userId: existingUser.id,
              companyId,
              enabled: true,
            });
            await assignAutomaticBetaForUser(existingUser.id).catch(() => null);
          } catch {
            return false;
          }

          return true;
        }

        try {
          const registration = await registerUserWithCompanyAndDemo({
            name: googleProfile.name ?? googleProfile.email.split("@")[0],
            email: googleProfile.email,
            avatarUrl: googleProfile.picture,
            emailVerifiedAt: new Date(),
          });
          void assignAutomaticBetaForUser(registration.user.id).catch(() => undefined);
          void trackServerEvent("signup_completed", {
            userId: registration.user.id,
            companyId: registration.company.id,
            registration_method: "google",
            demo_status: registration.demoProject?.status ?? "unknown",
          }).catch(() => undefined);
        } catch {
          return false;
        }

        return true;
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        const isGoogle = account?.provider === "google";

        if (isGoogle) {
          const dbUser = await getAuthUserByEmail(user.email!);

          if (dbUser) {
            token.id = dbUser.id;
            token.name = dbUser.name;
            token.email = dbUser.email;
            token.avatarUrl = dbUser.avatarUrl ?? null;
            token.phone = dbUser.phone ?? null;
            token.jobTitle = dbUser.jobTitle ?? null;
            token.bio = dbUser.bio ?? null;
            token.role = dbUser.role;
            token.adminProfile = dbUser.adminProfile;
            token.status = dbUser.status;
            token.isSuperAdmin = dbUser.isSuperAdmin;
            token.mfaEnabled = dbUser.mfaEnabled;
            token.sessionVersion = dbUser.sessionVersion;
          }
        } else {
          token.id = user.id;
          token.name = user.name;
          token.email = user.email;
          token.avatarUrl = "avatarUrl" in user ? (user.avatarUrl as string | null | undefined) ?? null : null;
          token.phone = "phone" in user ? (user.phone as string | null | undefined) ?? null : null;
          token.jobTitle = "jobTitle" in user ? (user.jobTitle as string | null | undefined) ?? null : null;
          token.bio = "bio" in user ? (user.bio as string | null | undefined) ?? null : null;
          token.role = "role" in user ? (user.role as "ADMIN" | "USER" | undefined) ?? "USER" : "USER";
          token.adminProfile = "adminProfile" in user ? (user.adminProfile as "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "BILLING_ADMIN" | "AUDITOR" | null | undefined) ?? null : null;
          token.status = "status" in user ? (user.status as "ACTIVE" | "SUSPENDED" | undefined) ?? "ACTIVE" : "ACTIVE";
          token.isSuperAdmin = "isSuperAdmin" in user ? Boolean(user.isSuperAdmin) : false;
          token.mfaEnabled = "mfaEnabled" in user ? Boolean(user.mfaEnabled) : false;
          token.sessionVersion = "sessionVersion" in user && typeof user.sessionVersion === "number" ? user.sessionVersion : 0;
        }

        const userId = token.id as string | undefined;

        if (userId) {
          const [workspaces, membershipUser] = await Promise.all([
            listUserWorkspaces(userId),
            prisma.user.findUnique({
              where: { id: userId },
              select: { membershipPlan: { select: { slug: true } } },
            }),
          ]);

          token.companyId = workspaces[0]?.id ?? null;
          token.activeCompanyId = workspaces[0]?.id ?? null;
          token.workspaces = workspaces;
          token.plan = membershipUser?.membershipPlan?.slug ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        const currentUser = await getAuthUserById(token.id as string, { bypassCache: true });
        const sessionVersionMismatch = currentUser !== null && currentUser.sessionVersion !== Number(token.sessionVersion ?? 0);
        const sessionIssuedAt = typeof token.iat === "number" ? token.iat * 1000 : null;
        const passwordChangedAfterSession = Boolean(
          currentUser?.passwordChangedAt &&
            sessionIssuedAt &&
            currentUser.passwordChangedAt.getTime() > sessionIssuedAt,
        );

        const sessionInvalidated = !currentUser || currentUser.status === "SUSPENDED" || passwordChangedAfterSession || sessionVersionMismatch;
        session.user.id = sessionInvalidated ? "" : (token.id as string);
        session.user.name = currentUser?.name ?? (token.name as string | null | undefined) ?? session.user.name ?? null;
        session.user.email = currentUser?.email ?? (token.email as string | null | undefined) ?? session.user.email ?? null;
        session.user.avatarUrl = currentUser?.avatarUrl ?? (token.avatarUrl as string | null | undefined) ?? null;
        session.user.phone = currentUser?.phone ?? (token.phone as string | null | undefined) ?? null;
        session.user.jobTitle = currentUser?.jobTitle ?? (token.jobTitle as string | null | undefined) ?? null;
        session.user.bio = currentUser?.bio ?? (token.bio as string | null | undefined) ?? null;
        session.user.role = currentUser?.role ?? (token.role as "ADMIN" | "USER" | undefined) ?? "USER";
        session.user.adminProfile = currentUser?.adminProfile ?? (token.adminProfile as "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "BILLING_ADMIN" | "AUDITOR" | null | undefined) ?? null;
        session.user.status = currentUser?.status ?? (token.status as "ACTIVE" | "SUSPENDED" | undefined) ?? "ACTIVE";
        const isSuperAdmin = currentUser?.isSuperAdmin ?? Boolean(token.isSuperAdmin);
        session.user.mfaEnabled = currentUser?.mfaEnabled ?? Boolean(token.mfaEnabled);
        if (isSuperAdmin) {
          session.user.isSuperAdmin = true;
        } else {
          delete session.user.isSuperAdmin;
        }
        session.user.companyId = token.companyId ?? null;
        session.user.activeCompanyId = token.activeCompanyId ?? null;
        session.user.workspaces = Array.isArray(token.workspaces) ? token.workspaces : [];
        session.user.plan = token.plan ?? null;
      }

      return session;
    },
  },
};

function isSafeCallbackUrl(url: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000")
    .replace(/\/$/, "");
  const allowedPrefixes = [
    `${appUrl}/`,
    "/",
  ];
  return allowedPrefixes.some((prefix) => url.startsWith(prefix)) && !url.startsWith("//");
}
