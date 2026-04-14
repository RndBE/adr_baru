import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { createHash } from "crypto";

/**
 * Check password against both bcrypt and legacy MD5 hashes.
 * Supports migration from CI3 MD5 passwords.
 */
async function verifyPassword(
  inputPassword: string,
  storedHash: string
): Promise<boolean> {
  // Try bcrypt first (new passwords)
  try {
    const bcryptMatch = await compare(inputPassword, storedHash);
    if (bcryptMatch) return true;
  } catch {
    // Not a valid bcrypt hash, try MD5
  }

  // Fallback to MD5 (legacy CI3 passwords)
  const md5Hash = createHash("md5").update(inputPassword).digest("hex");
  return md5Hash === storedHash;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user) return null;

        const isValid = await verifyPassword(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: String(user.id_user),
          name: user.nama,
          email: user.username, // Using username as email field
          role: user.level_user,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { userId?: string }).userId = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
