import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js 설정.
 * - middleware.ts(Edge Runtime)와 auth.ts(Node Runtime) 양쪽에서 공유합니다.
 * - 여기에는 Node 전용 모듈(crypto, prisma 등)을 import 하면 안 됩니다.
 * - 실제 Credentials provider는 auth.ts에서 추가합니다.
 */
export const authConfig = {
  providers: [],
  pages: { signIn: "/" },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
