// File Path = warehouse-frontend\app\page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      if (isAuthenticated()) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    };

    check();
  }, [router]);

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <div className="text-center text-white">
        <div className="conveyor-wrapper mx-auto mb-6">
          <div className="belt"></div>

          <div className="box box-1"></div>
          <div className="box box-2"></div>
          <div className="box box-3"></div>
        </div>

        <p className="text-white text-xl font-semibold mt-4 tracking-wide">
          Preparing Warehouse...
        </p>
        <p className="text-purple-200 text-sm">Loading...</p>
      </div>
    </div>
  );
}
