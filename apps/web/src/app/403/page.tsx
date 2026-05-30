'use client';

import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
          <ShieldOff className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">403</h1>
        <p className="mt-2 text-lg font-medium text-gray-700">Access Denied</p>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to view this page.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
