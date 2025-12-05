import NextAuth, { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      tenantId: process.env.AZURE_TENANT || "common",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
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

            // Upsert user record in app_users
            const { data: appUser, error: userError } = await supabaseAdmin
              .from("app_users")
              .upsert(
                {
                  organization_id: org.id,
                  azure_oid: oid,
                  email: email,
                  display_name: token.name || user?.name || null,
                },
                { onConflict: "organization_id,azure_oid" }
              )
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
