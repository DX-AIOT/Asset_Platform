'use client';

import { useParams } from 'next/navigation';
import { AssetForm } from '@/components/assets/AssetForm';

export default function EditAssetPage() {
  const { id } = useParams<{ id: string }>();
  return <AssetForm mode="edit" itemId={id} />;
}
