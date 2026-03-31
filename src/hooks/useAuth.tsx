"use client";

import { createContext, useContext } from "react";

type AuthUser = {
  id: string;
  primaryEmailAddress?: {
    emailAddress: string;
  };
};

type GetTokenOptions = {
  template?: string;
};

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isSignedIn: boolean;
  getToken: (options?: GetTokenOptions) => Promise<string | null>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  loading: true,
  isSignedIn: false,
  getToken: async () => null,
  signOut: async () => {},
};

export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
