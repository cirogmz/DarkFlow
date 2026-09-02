'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';

export default function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const activeBrand = useAppStore((state) => state.activeBrand);

  const primaryColor = activeBrand?.primaryColor || '#F59E0B'; // default to Amber/Orange
  
  // Calculate a hover variant (darker hex color)
  // For a simple hex shade shift: if it's #F59E0B, we can darken it
  let primaryHover = '#D97706';
  if (primaryColor.startsWith('#')) {
    const hex = primaryColor.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.max(0, (num >> 16) - 20);
    const g = Math.max(0, ((num >> 8) & 0x00ff) - 20);
    const b = Math.max(0, (num & 0x0000ff) - 20);
    primaryHover = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  return (
    <div
      style={{
        '--brand-primary': primaryColor,
        '--brand-primary-hover': primaryHover,
      } as React.CSSProperties}
      className="min-h-screen flex flex-col"
    >
      {children}
    </div>
  );
}
