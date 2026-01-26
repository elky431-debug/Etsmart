'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle, HelpCircle } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email, password);
      // Redirect to dashboard is handled by AuthContext
      router.push('/dashboard?section=analyze');
    } catch (err: any) {
      setError(err.message || 'Incorrect email or password');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'An error occurred with Google sign-in');
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#00d4ff]/5 via-white to-[#00c9b7]/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#00c9b7]/10 rounded-full blur-[100px]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md z-10"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center mb-10 group">
          <Logo size="lg" showText={true} />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 p-8 md:p-10"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back!
            </h1>
            <p className="text-slate-600">
              Sign in to access your dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00d4ff] transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00d4ff] transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00d4ff] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-[#00d4ff] focus:ring-[#00d4ff] focus:ring-2 cursor-pointer" 
                />
                <span className="text-slate-600 group-hover:text-slate-900 transition-colors">Remember me</span>
              </label>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-bold rounded-xl hover:shadow-xl hover:shadow-[#00d4ff]/30 transition-all shadow-lg shadow-[#00d4ff]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>

            {/* Forgot Password Button */}
            <Link href="/forgot-password">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-slate-700 font-semibold rounded-xl border-2 border-slate-200 hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all shadow-sm"
              >
                <HelpCircle size={18} />
                Forgot password?
              </motion.button>
            </Link>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-400 font-medium">ou</span>
            </div>
          </div>

          <motion.button 
            type="button"
            onClick={handleGoogleSignIn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 bg-white text-slate-700 font-semibold rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
          >
            Continue with Google
          </motion.button>

          <p className="text-center text-slate-600 mt-8">
            Don't have an account?{' '}
            <Link href="/register" className="text-[#00d4ff] hover:text-[#00c9b7] font-semibold transition-colors">
              Create account
            </Link>
          </p>
        </motion.div>

        <p className="text-center text-slate-400 text-sm mt-8">
          By signing in, you agree to our{' '}
          <a href="#" className="text-slate-500 hover:text-[#00d4ff] transition-colors">terms of service</a>
        </p>
      </motion.div>
    </div>
  );
}
