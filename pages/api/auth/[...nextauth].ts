import NextAuth, { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

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

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_CLIENT_ID || "",
      clientSecret: process.env.AZURE_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_TENANT || "common",
      authorization: {
        params: {
          scope: "openid profile email User.Read",
          prompt: "select_account",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-build-only",
  debug: true, // Enable debug mode to see errors in logs
  pages: {
    error: "/auth/error", // Custom error page
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
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
        // On first sign in, add org_id and azure_oid to token
        if (profile && supabaseAdmin) {
          const tid = (profile as any)?.tid;
          const oid = (profile as any)?.oid;
          const email = (profile as any)?.email || token.email;

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
            token.email = email;

            // Check if user already exists
            const { data: existingUser } = await supabaseAdmin
              .from("app_users")
              .select("id, role, profile_picture_url")
              .eq("organization_id", org.id)
              .eq("azure_oid", oid)
              .single();

            let profilePictureUrl = existingUser?.profile_picture_url || null;

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
              display_name: token.name || user?.name || null,
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
      if (session.user) {
        (session.user as any).org_id = token.org_id;
        (session.user as any).azure_oid = token.azure_oid;
        (session.user as any).id = token.user_id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
