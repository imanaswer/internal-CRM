import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { isAllowedGoogleProfile, resolveRole } from "@/lib/auth-domain";

const tempEnabled =
  process.env.ALLOW_TEMP_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    Google({
      authorization: { params: { hd: process.env.ALLOWED_DOMAIN, prompt: "select_account" } },
    }),
    ...(tempEnabled
      ? [
          Credentials({
            name: "Temp Login",
            credentials: { username: {}, password: {} },
            authorize: (c) => {
              if (!c?.username || !c?.password || !process.env.TEMP_LOGIN_USER || !process.env.TEMP_LOGIN_PASSWORD) return null;
              if (
                c?.username === process.env.TEMP_LOGIN_USER &&
                c?.password === process.env.TEMP_LOGIN_PASSWORD
              ) {
                return {
                  id: "temp",
                  email: "temp@local.dev",
                  name: "Temp User",
                  role: process.env.TEMP_LOGIN_ROLE ?? "MANAGER",
                } as any;
              }
              return null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "credentials") {
        if (!tempEnabled) return false;
        // Give the temp login a real User row so FK-backed writes
        // (activities, locks) work exactly as they do for Google users.
        const role = (process.env.TEMP_LOGIN_ROLE === "EMPLOYEE" ? "EMPLOYEE" : "MANAGER") as
          | "EMPLOYEE"
          | "MANAGER";
        await prisma.user.upsert({
          where: { email: "temp@local.dev" },
          update: { role },
          create: { email: "temp@local.dev", name: "Temp User", role },
        });
        return true;
      }
      if (account?.provider === "google") {
        if (!isAllowedGoogleProfile(profile as any)) return false;
        const email = profile!.email!;
        const role = resolveRole(email, process.env.MANAGER_EMAILS ?? "");
        await prisma.user.upsert({
          where: { email },
          update: { name: profile!.name ?? email, role },
          create: { email, name: profile!.name ?? email, role },
        });
        return true;
      }
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        if (token.email) {
          const db = await prisma.user.findUnique({ where: { email: token.email } });
          if (db) {
            token.uid = db.id;
            token.role = db.role;
            token.designation = db.designation;
            token.name = db.name;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = token.uid as string;
      (session.user as any).role = token.role;
      (session.user as any).designation = token.designation ?? null;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
