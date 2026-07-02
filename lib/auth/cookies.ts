const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";

export const authSessionCookieName = `${useSecureCookies ? "__Secure-" : ""}myc-presupuestos.session-token`;
