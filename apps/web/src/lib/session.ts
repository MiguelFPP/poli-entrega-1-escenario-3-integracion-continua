'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api-client';

/** Rol del usuario; el MVP solo usa ADMIN, pero la API admite más. */
export type AuthRole = 'ADMIN' | (string & {});

export interface AuthUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: AuthRole;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface AuthSession {
  readonly user: AuthUser;
  readonly accessTokenExpiresIn: number;
  readonly refreshTokenExpiresIn: number;
}

export interface LoginVariables {
  readonly email: string;
  readonly password: string;
}

export const SESSION_QUERY_KEY = ['session'] as const;

/** Usuario de la sesión actual; 401 significa "sin sesión". */
export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => apiFetch<AuthUser>('/auth/me'),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: LoginVariables) =>
      apiFetch<AuthSession>('/auth/login', {
        method: 'POST',
        json: { email, password },
      }),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
