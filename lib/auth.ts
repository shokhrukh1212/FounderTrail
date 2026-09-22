import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { config } from "./config";
import { getPool, query } from "./db";

const fallbackSecret = "foundertrail-build-only-secret-disabled";
const googleConfigured = Boolean(config.auth.googleClientId && config.auth.googleClientSecret);

export const auth = betterAuth({
  appName: config.siteName,
  baseURL: config.siteUrl,
  basePath: "/api/auth",
  secret: config.auth.secret || fallbackSecret,
  database: getPool(),
  trustedOrigins: [config.siteUrl],
  user: {
    modelName: "app_users",
    fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" },
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "member", input: false },
    },
  },
  session: {
    modelName: "auth_sessions",
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    fields: {
      expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at",
      ipAddress: "ip_address", userAgent: "user_agent", userId: "user_id",
    },
  },
  account: {
    modelName: "auth_accounts",
    fields: {
      accountId: "account_id", providerId: "provider_id", userId: "user_id",
      accessToken: "access_token", refreshToken: "refresh_token", idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at", refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at", updatedAt: "updated_at",
    },
    // Google is the sole public provider. Linking is limited to Google's verified
    // identity/email signal; different-email and arbitrary-provider linking stay off.
    accountLinking: { enabled: true, trustedProviders: ["google"], allowDifferentEmails: false },
    encryptOAuthTokens: true,
  },
  verification: {
    modelName: "auth_verifications",
    fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" },
  },
  socialProviders: googleConfigured ? {
    google: {
      clientId: config.auth.googleClientId,
      clientSecret: config.auth.googleClientSecret,
      scope: ["openid", "email", "profile"],
      requireEmailVerification: true,
    },
  } : {},
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  plugins: [nextCookies()],
});

export type CurrentUser = { id: string; name: string; email: string; role: "member" | "admin" };

export async function currentUserFromHeaders(headers: Headers): Promise<CurrentUser | null> {
  if (!config.auth.secret) return null;
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  const row = await query<{ role: "member" | "admin"; deleted_at: Date | null }>(
    `SELECT role,deleted_at FROM app_users WHERE id=$1`, [session.user.id],
  );
  if (!row[0] || row[0].deleted_at) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: row[0].role };
}
