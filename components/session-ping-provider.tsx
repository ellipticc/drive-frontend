"use client"

import { useSessionPing } from '@/hooks/use-session-ping';

export function SessionPingProvider() {
  useSessionPing();
  return null; // This component doesn't render anything
}