'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, ChevronDown, ChevronUp, KeyRound, Shield, Building2 } from 'lucide-react';
import { Logo } from '@/components/branding/logo';
import { useLoginMutation } from '@/features/auth/authApi';

export default function LoginPage() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDemoCredentials, setShowDemoCredentials] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      const res = await login({ email: email.trim(), password }).unwrap();

      if (res.data?.user) {
        if (res.data.user.role === 'ADMIN') {
          router.push('/dashboard');
        } else {
          router.push('/orders');
        }
      }
    } catch (err: any) {
      const message =
        err?.data?.message ||
        err?.message ||
        'Unable to sign in. Please verify your credentials and try again.';
      setErrorMessage(message);
    }
  };

  const handleFillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div className="bg-white py-8 px-7 sm:px-8 border border-[#DDDBDA] rounded shadow-[0_2px_4px_rgba(0,0,0,0.08)]">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-2">
          <Logo size="lg" variant="full" />
        </div>
        <p className="text-xs font-semibold text-[#0176D3] uppercase tracking-wider">
          Trade Smarter. Scale Faster.
        </p>
        <h2 className="mt-4 text-xl font-bold text-[#181818] tracking-tight">
          Welcome back
        </h2>
        <p className="text-xs text-[#706E6B] mt-0.5">
          Sign in to your NexTrade account
        </p>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mb-5 bg-[#FDF3F2] border border-[#F8D7D2] rounded p-3 text-xs text-[#BA0517] flex items-start gap-2.5 animate-in fade-in duration-200">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-[#BA0517]" />
          <div className="leading-snug">
            <span className="font-semibold">Sign-in failed: </span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-[#444444] mb-1.5"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. admin@nextrade.com"
            disabled={isLoading}
            className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] placeholder-[#A09E9B] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-[#444444] mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full h-9 rounded border border-[#DDDBDA] pl-3 pr-10 text-sm text-[#181818] placeholder-[#A09E9B] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={isLoading}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#706E6B] hover:text-[#181818] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-9 mt-2 bg-[#0176D3] hover:bg-[#014486] text-white text-sm font-semibold rounded transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      {/* Demo Credentials Collapsible Hint Section */}
      <div className="mt-6 pt-5 border-t border-[#DDDBDA]">
        <button
          type="button"
          onClick={() => setShowDemoCredentials((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs text-[#706E6B] hover:text-[#181818] font-medium transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <KeyRound size={14} className="text-[#0176D3]" />
            Demo Credentials
          </span>
          {showDemoCredentials ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showDemoCredentials && (
          <div className="mt-3 space-y-2 bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded text-xs animate-in fade-in-50 duration-150">
            {/* Admin Credentials */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-white transition-colors">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold text-[#181818]">Admin Account</p>
                  <p className="text-[11px] text-[#706E6B]">admin@nextrade.com / Admin@123</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleFillDemo('admin@nextrade.com', 'Admin@123')}
                className="text-[11px] font-semibold text-[#0176D3] hover:underline shrink-0"
              >
                Use Admin
              </button>
            </div>

            {/* Dealer Credentials */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-white transition-colors border-t border-slate-200/60 pt-2">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-blue-600 shrink-0" />
                <div>
                  <p className="font-bold text-[#181818]">Dealer (Apex Hardware)</p>
                  <p className="text-[11px] text-[#706E6B]">apex@nextrade.com / Dealer@123</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleFillDemo('apex@nextrade.com', 'Dealer@123')}
                className="text-[11px] font-semibold text-[#0176D3] hover:underline shrink-0"
              >
                Use Dealer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
