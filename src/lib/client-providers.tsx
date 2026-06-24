"use client";

import React from "react";
import { ToastProvider } from "@/components/toast-provider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
