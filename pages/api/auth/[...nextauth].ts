import NextAuth, { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import argon2 from "argon2";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { recordAuditEvent } from "../../../lib/auditLog";

// DEMO MODE — staging only. When DEMO_MODE=true (set ONLY on the staging
// deployment, never in production) we additionally enable an email/password
// "Credentials" provider so controlled, non-Microsoft demo accounts can sign
// in. In production DEMO_MODE is unset, so this provider is never registered
// and Azure AD remains the sole authentication path.
const DEMO_MODE = process.env.DEMO_MODE === "true";

// Validate required environment variables at startup
const requiredEnvVars = {
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(", ")}`);
}

const providers: NextAuthOptions["providers"] = [
  AzureADProvider({
    clientId: process.env.AZURE_CLIENT_ID || "",
    clientSecret: process.env.AZURE_CLIENT_SECRET || "",
    tenantId: process.env.AZURE_TENANT || "common",
    authorization: {
      params: {
        scope: "openid profile email offline_access User.Read Mail.Send",
        prompt: "select_account",
      },
    },
  }),
];

// Staging-only demo login. Validates an email/password against the `demo_users`
// table (which lives only in the staging Supabase project) and then links the
// session to the matching `app_users` row so HRIMS auto-detection and approver
// resolution work exactly as they do for a real Microsoft sign-in.
if (DEMO_MODE) {
  providers.push(
    CredentialsProvider({
      id: "credentials",
      name: "Demo Account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Defence in depth: never authorize via credentials outside demo mode.
        if (process.env.DEMO_MODE !== "true") return null;
        if (!supabaseAdmin) {
          console.error("Demo authorize: supabaseAdmin not initialized");
          return null;
        }
        const email = credentials?.email?.trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        // 1. Look up the controlled demo account (staging-only table)
        const { data: demo, error: demoErr } = await supabaseAdmin
          .from("demo_users")
          .select("email, password_hash, display_name, is_active")
          .ilike("email", email)
          .limit(1)
          .single();

        if (demoErr || !demo || demo.is_active === false) return null;

        // 2. Verify the password against the stored argon2 hash
        let valid = false;
        try {
          valid = await argon2.verify(demo.password_hash, password);
        } catch (err) {
          console.error("Demo authorize: argon2 verify failed", err);
          valid = false;
        }
        if (!valid) return null;

        // 3. Link to the app_users row (seeded with a matching email). This row
        //    supplies the org/role and is what the rest of the app keys on.
        const { data: appUser } = await supabaseAdmin
          .from("app_users")
          .select("id, organization_id, role, display_name, email")
          .ilike("email", demo.email)
          .limit(1)
          .single();

        if (!appUser) {
          console.error(`Demo authorize: no app_users row for ${demo.email}`);
          return null;
        }

        return {
          id: appUser.id,
          email: appUser.email,
          name: appUser.display_name || demo.display_name || appUser.email,
          org_id: appUser.organization_id,
          role: appUser.role || "requester",
        } as any;
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-build-only",
  debug: true, // Enable debug mode to see errors in logs
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours - session expires after this time
    // Reduce token size to avoid cookie chunking issues
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // No maxAge means cookie is deleted when browser closes (session cookie)
      },
    },
  },
  pages: {
    error: "/auth/error", // Custom error page
    // NextAuth redirects OAuth* errors to the signin page (not the error page),
    // so we point signin at the error page too. Real sign-in is initiated by
    // calling signIn("azure-ad") directly, which bypasses this page.
    signIn: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Demo credentials are already validated in `authorize` against the
        // controlled demo_users table; skip the Azure tenant registration check.
        if (account?.provider === "credentials") {
          return DEMO_MODE;
        }

        if (!supabaseAdmin) {
          console.error("supabaseAdmin not initialized - check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
          return false;
        }

        // profile contains oid and tid from Azure AD
        const tid = (profile as any)?.tid;
        if (!tid) {
          console.error("No tenant ID (tid) in profile");
          return false;
        }

        // Look up organization by Azure tenant ID
        const { data: org, error } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("azure_tenant_id", tid)
          .limit(1)
          .single();

        if (error) {
          console.error("Supabase error in signIn:", error.message);
        }

        if (!org) {
          // Organization not registered - deny sign in
          console.log(`Sign-in denied: tenant ${tid} not registered`);
          return false;
        }

        return true;
      } catch (err) {
        console.error("signIn callback error:", err);
        return false;
      }
    },

    async jwt({ token, user, account, profile }) {
      try {
        // Demo credentials sign-in: the authorize() callback already resolved
        // the app_users row, so copy its identity onto the token and skip all
        // Azure/Graph-specific logic (there is no MS access token here).
        if (account?.provider === "credentials" && user) {
          const u = user as any;
          token.user_id = u.id;
          token.org_id = u.org_id;
          token.role = u.role;
          token.email = u.email;
          return token;
        }

        // On first sign in, capture Microsoft Graph tokens for downstream
        // delegated calls (e.g. /me/sendMail used by the e-sign invite flow).
        if (account?.access_token) {
          token.ms_access_token = account.access_token;
          token.ms_refresh_token = account.refresh_token ?? token.ms_refresh_token;
          token.ms_expires_at = account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 55 * 60 * 1000;
        } else if (
          token.ms_refresh_token &&
          typeof token.ms_expires_at === "number" &&
          Date.now() > token.ms_expires_at - 60 * 1000
        ) {
          // Token expired (or about to) — refresh silently using offline_access
          try {
            const tenant = process.env.AZURE_TENANT || "common";
            const params = new URLSearchParams({
              client_id: process.env.AZURE_CLIENT_ID || "",
              client_secret: process.env.AZURE_CLIENT_SECRET || "",
              grant_type: "refresh_token",
              refresh_token: token.ms_refresh_token as string,
              scope: "openid profile email offline_access User.Read Mail.Send",
            });
            const resp = await fetch(
              `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
              {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString(),
              }
            );
            if (resp.ok) {
              const refreshed = await resp.json();
              token.ms_access_token = refreshed.access_token;
              token.ms_expires_at = Date.now() + refreshed.expires_in * 1000;
              if (refreshed.refresh_token) {
                token.ms_refresh_token = refreshed.refresh_token;
              }
            } else {
              console.error("MS token refresh failed:", await resp.text());
              token.ms_access_token = undefined;
            }
          } catch (refreshErr) {
            console.error("MS token refresh error:", refreshErr);
          }
        }

        // On first sign in, always capture the email from all possible Azure AD sources
        if (profile || user) {
          const resolvedEmail =
            (profile as any)?.email ||
            (profile as any)?.preferred_username ||
            (profile as any)?.upn ||
            (profile as any)?.mail ||
            user?.email ||
            token.email;
          if (resolvedEmail) {
            token.email = resolvedEmail;
          }
        }

        // On first sign in, add org_id and azure_oid to token
        if (profile && supabaseAdmin) {
          const tid = (profile as any)?.tid;
          const oid = (profile as any)?.oid;
          const email = token.email; // Already resolved above from all sources

          // Find organization
          const { data: org, error: orgError } = await supabaseAdmin
            .from("organizations")
            .select("id")
            .eq("azure_tenant_id", tid)
            .limit(1)
            .single();

          if (orgError) {
            console.error("Supabase error fetching org in jwt:", orgError.message);
          }

          if (org?.id) {
            token.org_id = org.id;
            token.azure_oid = oid;

            // Check if user already exists
            const { data: existingUser } = await supabaseAdmin
              .from("app_users")
              .select("id, role, profile_picture_url, display_name")
              .eq("organization_id", org.id)
              .eq("azure_oid", oid)
              .single();

            let profilePictureUrl = existingUser?.profile_picture_url || null;
            let displayName = existingUser?.display_name || token.name || user?.name || null;

            // If user doesn't have a profile picture, try to fetch from Microsoft Graph
            if (!profilePictureUrl && account?.access_token) {
              try {
                const photoResponse = await fetch(
                  "https://graph.microsoft.com/v1.0/me/photo/$value",
                  {
                    headers: {
                      Authorization: `Bearer ${account.access_token}`,
                    },
                  }
                );

                if (photoResponse.ok) {
                  const photoBuffer = await photoResponse.arrayBuffer();
                  const buffer = Buffer.from(photoBuffer);
                  
                  // Upload to Supabase storage
                  const filePath = `${existingUser?.id || oid}.png`;
                  const { error: uploadError } = await supabaseAdmin.storage
                    .from("profile_pictures")
                    .upload(filePath, buffer, {
                      contentType: "image/png",
                      upsert: true,
                    });

                  if (!uploadError) {
                    const { data: { publicUrl } } = supabaseAdmin.storage
                      .from("profile_pictures")
                      .getPublicUrl(filePath);
                    profilePictureUrl = publicUrl;
                  } else {
                    console.error("Error uploading MS profile picture:", uploadError.message);
                  }
                }
              } catch (photoErr) {
                console.error("Error fetching MS profile picture:", photoErr);
              }
            }

            // Upsert user record in app_users
            const upsertData: any = {
              organization_id: org.id,
              azure_oid: oid,
              email: email,
              display_name: displayName,
            };

            // Only set profile_picture_url if we fetched one and user doesn't have one
            if (profilePictureUrl && !existingUser?.profile_picture_url) {
              upsertData.profile_picture_url = profilePictureUrl;
            }

            const { data: appUser, error: userError } = await supabaseAdmin
              .from("app_users")
              .upsert(upsertData, { onConflict: "organization_id,azure_oid" })
              .select("id, role")
              .single();

            if (userError) {
              console.error("Supabase error upserting user in jwt:", userError.message);
            }

            if (appUser) {
              token.user_id = appUser.id;
              token.role = appUser.role;
              // Note: profile_picture_url and display_name are NOT stored in JWT to reduce cookie size
              // They should be fetched from the database when needed via useCurrentUser hook
            }
          }
        }
      } catch (err) {
        console.error("jwt callback error:", err);
      }
      return token;
    },

    async session({ session, token }) {
      // Expose org_id, user_id, and role to the client session
      // Note: profile_picture_url and display_name are fetched via useCurrentUser hook to reduce JWT size
      if (session.user) {
        (session.user as any).org_id = token.org_id;
        (session.user as any).azure_oid = token.azure_oid;
        (session.user as any).id = token.user_id;
        (session.user as any).role = token.role;
        // Ensure email is always available on the session
        if (token.email) {
          session.user.email = token.email as string;
        }
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful sign in
      if (url === baseUrl || url.startsWith(baseUrl + '/')) {
        return baseUrl + '/dashboard';
      }
      return url;
    },
  },

  // Immutable security audit trail for authentication lifecycle events.
  events: {
    async signIn({ user, account }) {
      await recordAuditEvent({
        category: "security",
        action: "auth.login",
        severity: "notice",
        actor: { email: user?.email || null, name: user?.name || null },
        details: { provider: account?.provider || "unknown" },
      });
    },
    async signOut({ token }) {
      await recordAuditEvent({
        category: "security",
        action: "auth.logout",
        organizationId: (token as any)?.org_id || null,
        actor: {
          id: (token as any)?.user_id || null,
          email: (token as any)?.email || null,
          name: (token as any)?.name || null,
        },
      });
    },
  },
};

export default NextAuth(authOptions);
