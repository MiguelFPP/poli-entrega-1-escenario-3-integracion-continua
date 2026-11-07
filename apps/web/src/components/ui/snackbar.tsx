'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Icon } from './icons';

export interface SnackbarAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface SnackbarOptions {
  readonly action?: SnackbarAction;
}

export interface SnackbarContextValue {
  show: (message: string, options?: SnackbarOptions) => void;
}

interface SnackbarItem {
  readonly id: number;
  readonly message: string;
  readonly action?: SnackbarAction;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

/** Acceso al sistema de notificaciones. Requiere un `SnackbarProvider` ancestro. */
export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar debe usarse dentro de un SnackbarProvider');
  }
  return context;
}

export interface SnackbarProviderProps {
  readonly children?: ReactNode;
  readonly duration?: number;
}

export function SnackbarProvider({
  children,
  duration = 5000,
}: SnackbarProviderProps): ReactNode {
  const [items, setItems] = useState<SnackbarItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((message: string, options?: SnackbarOptions) => {
    nextId.current += 1;
    const item: SnackbarItem = options?.action
      ? { id: nextId.current, message, action: options.action }
      : { id: nextId.current, message };
    setItems((current) => [...current, item]);
  }, []);

  const value = useMemo<SnackbarContextValue>(() => ({ show }), [show]);

  return (
    <SnackbarContext.Provider value={value}>
      <ToastPrimitive.Provider
        duration={duration}
        swipeDirection="right"
        label="Notificaciones"
      >
        {children}
        {items.map((item) => {
          const action = item.action;
          return (
            <ToastPrimitive.Root
              key={item.id}
              open
              type="background"
              duration={duration}
              onOpenChange={(open) => {
                if (!open) {
                  dismiss(item.id);
                }
              }}
              className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface shadow-lg"
            >
              <ToastPrimitive.Title className="flex-1">
                {item.message}
              </ToastPrimitive.Title>
              {action ? (
                <ToastPrimitive.Action
                  altText={action.label}
                  onClick={() => {
                    action.onClick();
                    dismiss(item.id);
                  }}
                  className="rounded-full px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {action.label}
                </ToastPrimitive.Action>
              ) : null}
              <ToastPrimitive.Close
                aria-label="Cerrar notificación"
                className="grid size-7 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon name="close" size="size-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </SnackbarContext.Provider>
  );
}
