"use client";

import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { MixerProvider } from "@/contexts/MixerContext";
import { CartProvider } from "@/contexts/CartContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  // 🎯 PERFORMANCE FIX: Always provide AuthProvider for upload modal compatibility
  // The modal handles its own authentication, but needs the provider for form components
  return (
    <DndProvider backend={HTML5Backend}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <MixerProvider>
              {children}
            </MixerProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </DndProvider>
  );
} 