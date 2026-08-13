import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    name: string;
    role: string;
    branchId: number;
    branchName: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
      branchId: number;
      branchName: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    branchId?: number;
    branchName?: string;
  }
}
