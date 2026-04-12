import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        loginId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { loginId: credentials.loginId as string },
        });

        if (!user || user.password !== (credentials.password as string)) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.loginId,
        };
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
