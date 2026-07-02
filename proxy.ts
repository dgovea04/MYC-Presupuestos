import { withAuth } from "next-auth/middleware";
import { authSessionCookieName } from "@/lib/auth/cookies";

export default withAuth({
  cookies: {
    sessionToken: {
      name: authSessionCookieName,
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/budgets/:path*", "/resources/:path*", "/settings/:path*"],
};
