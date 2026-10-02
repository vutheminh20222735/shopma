import type { Role } from '../features/accounts/types';

export type Notice = {
  text: string;
  error?: boolean;
};

export type Run = (fn: () => Promise<any>, message?: string) => Promise<any>;
export type NavCatalog = (gender?: string, mode?: string) => void;
export type SwitchRole = (role: Role | 'exit') => Promise<unknown>;
