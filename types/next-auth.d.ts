import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      org_id?: string;
      azure_oid?: string;
      role?: string;
    };
  }

  interface Profile {
    oid?: string;
    tid?: string;
    email?: string;
    name?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    org_id?: string;
    azure_oid?: string;
    user_id?: string;
    role?: string;
  }
}
