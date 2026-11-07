'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { useSession } from '@/lib/session';

export default function LoginPage(): ReactNode {
  const router = useRouter();
  const { data: user } = useSession();

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-2xl font-semibold text-on-surface">POS</span>
        <p className="text-sm text-on-surface-variant">
          Sistema de punto de venta
        </p>
      </div>
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}
