'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      toast('Welcome back to InterviewOS!', 'success');
      
      // Save local session info
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('auth_token', data.token);

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const redirectPath = params.get('redirect');
          window.location.href = redirectPath || '/';
        }
      }, 1000);

    } catch (err: any) {
      toast(err.message || 'Invalid email or password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030303] text-zinc-50 flex items-center justify-center relative overflow-hidden font-sans p-6">
      <div className="noise-bg" />
      
      {/* Background radial atmosphere glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-10 relative overflow-hidden"
      >
        {/* Border accent glow */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        <div className="text-center mb-8">
          <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ AUTHORIZATION_REQUIRED ]</span>
          <h1 className="text-3xl font-light text-white tracking-tight mt-2 uppercase">
            Interview<span className="font-serif italic text-transparent bg-clip-text bg-gradient-to-br from-zinc-300 to-zinc-500 font-normal">OS</span>
          </h1>
          <p className="text-zinc-400 text-xs tracking-wider mt-2 font-mono uppercase">Access key required</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email field */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Secure Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-zinc-600 outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-600 transition-colors"
                placeholder="Enter email address"
                required
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Access Code</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-zinc-600 outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-600 transition-colors"
                placeholder="Enter access password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden group/btn flex items-center justify-center gap-4 text-xs font-mono tracking-widest text-white uppercase py-4 rounded-xl border border-zinc-800 hover:border-white bg-transparent transition-colors duration-300"
          >
            <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
            
            {loading ? (
              <span className="relative z-10 flex items-center gap-2 text-indigo-950">
                <Loader2 className="w-4 h-4 animate-spin" />
                VERIFYING_ACCESS
              </span>
            ) : (
              <span className="relative z-10 flex items-center gap-2 group-hover/btn:text-indigo-950 group-hover/btn:font-bold">
                INITIATE_CONNECTION <ArrowRight className="w-4 h-4 text-zinc-500 group-hover/btn:text-indigo-950" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-zinc-800/60 pt-6">
          <p className="text-xs text-zinc-500">
            First time conducting Cognitive Practice?{' '}
            <a href="/signup" className="text-zinc-300 hover:text-white underline font-mono">
              CREATE_ACCOUNT
            </a>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
