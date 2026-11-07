import React, { use } from 'react';
import KioskPage from '../page';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BrandKioskPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const { slug } = unwrappedParams;

  return <KioskPage initialSlug={slug} />;
}

