import type { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import './globals.css';
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>; }
