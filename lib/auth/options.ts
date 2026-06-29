import { Prisma } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { registerUserWithCompany } from "@/lib/auth/registration";
import { getUserProfileColumnSupport } from "@/lib/data/user-profile-columns";
import { loginSchema } from "@/lib/validations/auth";

const authSecret =
  process.env.NEXTAUTH_SECRET ??
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production" ? undefined : "myc-presupuestos-dev-auth-secret");
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
const sessionCookieName = `${useSecureCookies ? "__Secure-" : ""}myc-presupuestos.session-token`;

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
  role: z.enum(["ADMIN", "USER"]).optional().default("USER"),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional().default("ACTIVE"),
});

type AuthUserRecord = z.infer<typeof authUserSchema>;

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
    passwordHash: parsedUser.data.passwordHash ?? null,
    role: parsedUser.data.role,
    status: parsedUser.data.status,
  };
}

async function getAuthUserByEmail(email: string) {
  const profileColumns = await getUserProfileColumnSupport();
  const rows = await prisma.$queryRaw<Array<unknown>>`
    SELECT "id", "name", "email", "passwordHash", "emailVerifiedAt", "role", "status"
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

async function getAuthUserById(userId: string) {
  const profileColumns = await getUserProfileColumnSupport();
  const rows = await prisma.$queryRaw<Array<unknown>>`
    SELECT "id", "name", "email", "role", "status"
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

function toSessionProfile(user: Pick<AuthUserRecord, "id" | "name" | "email" | "avatarUrl" | "phone" | "jobTitle" | "bio" | "role" | "status">) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    jobTitle: user.jobTitle,
    bio: user.bio,
    role: user.role,
    status: user.status,
  };
}

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: sessionCookieName,
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
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await getAuthUserByEmail(parsed.data.email);

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

        return toSessionProfile(user);
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
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
          return true;
        }

        try {
          await registerUserWithCompany({
            name: googleProfile.name ?? googleProfile.email.split("@")[0],
            email: googleProfile.email,
            avatarUrl: googleProfile.picture,
          });
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
            token.status = dbUser.status;
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
          token.status = "status" in user ? (user.status as "ACTIVE" | "SUSPENDED" | undefined) ?? "ACTIVE" : "ACTIVE";
        }

        const userId = token.id as string | undefined;

        if (userId) {
          const [company, membershipUser] = await Promise.all([
            prisma.company.findFirst({
              where: { userId },
              orderBy: { createdAt: "asc" },
              select: { id: true },
            }),
            prisma.user.findUnique({
              where: { id: userId },
              select: { membershipPlan: { select: { slug: true } } },
            }),
          ]);

          token.companyId = company?.id ?? null;
          token.plan = membershipUser?.membershipPlan?.slug ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        const currentUser = await getAuthUserById(token.id as string);

        session.user.id = token.id as string;
        session.user.name = currentUser?.name ?? (token.name as string | null | undefined) ?? session.user.name ?? null;
        session.user.email = currentUser?.email ?? (token.email as string | null | undefined) ?? session.user.email ?? null;
        session.user.avatarUrl = currentUser?.avatarUrl ?? (token.avatarUrl as string | null | undefined) ?? null;
        session.user.phone = currentUser?.phone ?? (token.phone as string | null | undefined) ?? null;
        session.user.jobTitle = currentUser?.jobTitle ?? (token.jobTitle as string | null | undefined) ?? null;
        session.user.bio = currentUser?.bio ?? (token.bio as string | null | undefined) ?? null;
        session.user.role = currentUser?.role ?? (token.role as "ADMIN" | "USER" | undefined) ?? "USER";
        session.user.status = currentUser?.status ?? (token.status as "ACTIVE" | "SUSPENDED" | undefined) ?? "ACTIVE";
        session.user.companyId = token.companyId ?? null;
        session.user.plan = token.plan ?? null;
      }

      return session;
    },
  },
};
