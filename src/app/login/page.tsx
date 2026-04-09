import { Suspense } from 'react';
import LoginContent from './LoginContent';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-[#00d4ff] border-t-transparent rounded-full" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
