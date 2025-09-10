"use client";

import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  // 🎯 PERFORMANCE FIX: Always provide AuthProvider for upload modal compatibility
  // The modal handles its own authentication, but needs the provider for form components
  return (
    <DndProvider backend={HTML5Backend}>
      <ToastProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ToastProvider>
    </DndProvider>
  );
} 