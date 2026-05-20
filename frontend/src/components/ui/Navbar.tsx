'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, User, LogOut, FileText, BarChart3, Video, Home } from 'lucide-react';
import { useInterviewStore } from '@/store/interviewStore';

export default function Navbar() {
  const [aiStatus, setAiStatus] = useState<{ active_provider: string; status: string }>({
    active_provider: 'groq',
    status: 'green'
  });
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // 1. Fetch User session
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('user');
      if (u) {
        try {
          setUser(JSON.parse(u));
        } catch (_) {}
      }
    }

    // 2. Poll AI Backend status
    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/ai/status');
        if (res.ok) {
          const data = await res.json();
          setAiStatus(data);
        }
      } catch (err) {
        // Fallback offline
        setAiStatus({ active_provider: 'unavailable', status: 'red' });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 7000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  };

  return (
    <nav className="w-full bg-[#030303]/80 backdrop-blur-xl border-b border-zinc-900 px-6 py-4 flex justify-between items-center z-40 relative">
      {/* Brand Logo */}
      <a href="/" className="flex items-center gap-2 group">
        <span className="text-xl font-light tracking-tight text-white uppercase">
          Interview<span className="font-serif italic text-transparent bg-clip-text bg-gradient-to-br from-zinc-200 to-zinc-400 font-normal">OS</span>
        </span>
      </a>

      {/* Main Nav Links */}
      <div className="hidden md:flex items-center gap-6 text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
        <a href="/" className="flex items-center gap-1.5 hover:text-white transition-colors">
          <Home className="w-3.5 h-3.5 text-zinc-500" />
          Dashboard
        </a>
        <a href="/interview" className="flex items-center gap-1.5 hover:text-white transition-colors">
          <Cpu className="w-3.5 h-3.5 text-zinc-500" />
          Simulation
        </a>
        <a href="/resume" className="flex items-center gap-1.5 hover:text-white transition-colors">
          <FileText className="w-3.5 h-3.5 text-zinc-500" />
          Resume
        </a>
        <a href="/analytics" className="flex items-center gap-1.5 hover:text-white transition-colors">
          <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
          Analytics
        </a>
        <a href="/room" className="flex items-center gap-1.5 hover:text-white transition-colors">
          <Video className="w-3.5 h-3.5 text-zinc-500" />
          Collab Room
        </a>
      </div>

      {/* Status Indicators & Auth Actions */}
      <div className="flex items-center gap-6">
        
        {/* AI STATUS INDICATOR */}
        <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wider">
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              aiStatus.status === 'green' ? 'bg-emerald-400' :
              aiStatus.status === 'yellow' ? 'bg-amber-400' : 'bg-rose-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              aiStatus.status === 'green' ? 'bg-emerald-500' :
              aiStatus.status === 'yellow' ? 'bg-amber-500' : 'bg-rose-500'
            }`} />
          </div>
          <span className="text-zinc-400 uppercase">
            AI: {aiStatus.active_provider === 'groq' ? 'Groq' : aiStatus.active_provider === 'gemini' ? 'Gemini' : 'Offline'}
          </span>
        </div>

        {/* User state */}
        {user ? (
          <div className="relative flex items-center border-l border-zinc-800 pl-6">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white transition-colors bg-transparent border-0 outline-none cursor-pointer focus:outline-none"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold font-mono text-xs shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline font-mono font-medium">{user.name}</span>
            </button>

            {menuOpen && (
              <>
                {/* Backdrop overlay to close dropdown */}
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setMenuOpen(false)}
                />
                
                {/* Premium Dropdown menu */}
                <div className="absolute right-0 top-9 mt-2 w-56 bg-zinc-950/95 backdrop-blur-xl border border-zinc-850 rounded-xl p-2 shadow-2xl z-50 flex flex-col font-mono text-[10px] uppercase tracking-wider text-zinc-400 space-y-1">
                  <div className="px-3 py-2 border-b border-zinc-900 flex flex-col gap-0.5">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-left">Active Candidate</span>
                    <span className="text-zinc-200 font-medium truncate text-xs text-left">{user.name}</span>
                    <span className="text-zinc-600 truncate text-[8px] lowercase font-sans text-left">{user.email}</span>
                  </div>
                  
                  <a 
                    href="/" 
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-white transition-colors text-left"
                  >
                    <Home className="w-3.5 h-3.5" /> Dashboard Hub
                  </a>

                  <a 
                    href="/interview" 
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-white transition-colors text-left"
                  >
                    <Cpu className="w-3.5 h-3.5" /> Simulation Room
                  </a>

                  <a 
                    href="/resume" 
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-white transition-colors text-left"
                  >
                    <FileText className="w-3.5 h-3.5" /> Resume Analyzer
                  </a>

                  <a 
                    href="/analytics" 
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-white transition-colors text-left"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Performance Stats
                  </a>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg hover:bg-rose-950/20 hover:text-rose-400 text-rose-500 border-0 bg-transparent transition-colors mt-1 pt-2 border-t border-zinc-900 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> End Session
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4 font-mono text-[10px] tracking-wider pl-4 border-l border-zinc-800">
            <a
              href="/login"
              className="text-zinc-400 hover:text-white uppercase transition-colors"
            >
              LOGIN
            </a>
            <a
              href="/signup"
              className="border border-zinc-800 hover:border-white bg-transparent text-white px-3 py-1.5 rounded-lg uppercase tracking-widest text-[9px] transition-all duration-300 font-bold shadow-[0_0_15px_rgba(255,255,255,0.02)]"
            >
              SIGN UP
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
