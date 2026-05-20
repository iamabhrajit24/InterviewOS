"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/ui/Navbar';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { 
  Cpu, FileText, BarChart3, Video, Play, ArrowRight, 
  Sparkles, Clock, Calendar, CheckCircle2, AlertTriangle, 
  Plus, History, User, LogOut 
} from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Dashboard Analytics & Resume Data state
  const [stats, setStats] = useState<any>({
    totalSessions: 0,
    avgScore: 0,
    weakTopics: [],
    scoreTrends: []
  });
  const [resumeData, setResumeData] = useState<any>(null);
  const [roomIdInput, setRoomIdInput] = useState('demo-room-101');

  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const { toast } = useToast();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      toast('Please enter both email and password', 'error');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      toast('Access granted! Initializing hub...', 'success');
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('auth_token', data.token);

      setTimeout(() => {
        setUser(data.user);
      }, 1000);
    } catch (err: any) {
      toast(err.message || 'Incorrect credentials', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authName || !authEmail || !authPassword) {
      toast('Please fill in all profile fields', 'error');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile generation failed');

      toast('Cognitive ID registered! Welcome to the hub.', 'success');
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('auth_token', data.token);

      setTimeout(() => {
        setUser(data.user);
      }, 1000);
    } catch (err: any) {
      toast(err.message || 'Error creating profile', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check user login
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('user');
      if (u) {
        try {
          setUser(JSON.parse(u));
        } catch (_) {}
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;

    // 2. Fetch Live Analytics & Resume info to populate Command Center
    const fetchDashboardData = async () => {
      try {
        const [analRes, resRes] = await Promise.all([
          fetch('/api/analytics'),
          fetch('/api/resume/versions')
        ]);

        if (analRes.ok) {
          const analData = await analRes.json();
          setStats(analData);
        }

        if (resRes.ok) {
          const resData = await resRes.json();
          if (resData.versions && resData.versions.length > 0) {
            setResumeData(resData.versions[resData.versions.length - 1]);
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard statistics:', err);
      }
    };

    fetchDashboardData();
  }, [user]);

  const handlePracticeTopic = (topic: string) => {
    toast(`Focus simulation prefilled for: ${topic}`, 'success');
    setTimeout(() => {
      window.location.href = `/interview?targetTopic=${encodeURIComponent(topic)}`;
    }, 1000);
  };

  const handleStartSuggested = (type: string, skills: string[], role?: string) => {
    toast(`Configuring suggested ${type} simulation...`, 'info');
    setTimeout(() => {
      let url = `/interview?targetTopic=${encodeURIComponent(skills.join(','))}`;
      if (role) {
        url += `&targetRole=${encodeURIComponent(role)}`;
      }
      window.location.href = url;
    }, 1000);
  };

  // RENDER A: LANDING PAGE FOR LOGGED OUT USERS
  const renderLandingPage = () => {
    return (
      <main className="group flex min-h-screen w-screen flex-col justify-between bg-[#030303] text-zinc-50 relative overflow-hidden font-sans p-0">
        <div className="noise-bg" />
        
        {/* Background Atmosphere */}
        <div className="absolute top-1/2 left-1/4 w-[1100px] h-[250px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0 rotate-[-8deg] mix-blend-screen" />
        <div className="absolute top-[40%] left-1/3 w-[800px] h-[180px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none z-0 rotate-[-15deg] mix-blend-screen" />
        <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-zinc-800/10 rounded-full blur-[160px] pointer-events-none z-0" />

        {/* Top Navbar Info Row */}
        <div className="z-30 w-full flex justify-between items-center px-8 lg:px-16 pt-8 font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
          <div>[ CORE_ENGINE_ACTIVE ]</div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>[ SYSTEM_READY ]</span>
          </div>
        </div>

        {/* Editorial Split Grid */}
        <div className="z-30 w-full max-w-7xl mx-auto px-6 lg:px-16 my-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-12">
          
          {/* LEFT SIDE CONTENT: occupies 7 cols on large screen */}
          <div className="lg:col-span-7 space-y-8 flex flex-col justify-center text-left">
            <div className="overflow-hidden">
              <motion.h1
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="text-6xl md:text-7xl lg:text-8xl font-light text-white tracking-tight leading-none uppercase"
              >
                Interview<span className="font-serif italic text-transparent bg-clip-text bg-gradient-to-br from-zinc-200 to-zinc-400 font-normal">OS</span>
              </motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-zinc-400 text-sm md:text-base tracking-wide leading-relaxed font-normal text-left max-w-xl"
            >
              The production-grade AI interview simulator. Upload your resume, configure targeted focus parameters, and test cognitive abilities in simulated rooms.
            </motion.p>

            {/* Core features listing */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl pt-6 border-t border-zinc-900/60"
            >
              <div className="flex gap-3 items-start text-left">
                <div className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-indigo-400 shrink-0 mt-0.5">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-zinc-200 tracking-wider">Technical Mode</h4>
                  <p className="text-[10px] text-zinc-500 uppercase mt-1 tracking-wider leading-snug">Practice stack-specific follow-ups and live code evaluation.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start text-left">
                <div className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-emerald-400 shrink-0 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-zinc-200 tracking-wider">Resume Aware</h4>
                  <p className="text-[10px] text-zinc-500 uppercase mt-1 tracking-wider leading-snug">Interviews tailored strictly to your stored candidate profile.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start text-left">
                <div className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-indigo-400 shrink-0 mt-0.5">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-zinc-200 tracking-wider">Collab Rooms</h4>
                  <p className="text-[10px] text-zinc-500 uppercase mt-1 tracking-wider leading-snug">Practice in real-time alongside team peers and reviewers.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start text-left">
                <div className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-emerald-400 shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-zinc-200 tracking-wider">Core Analytics</h4>
                  <p className="text-[10px] text-zinc-500 uppercase mt-1 tracking-wider leading-snug">Trace weakness records and competency timelines.</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* RIGHT SIDE: EMBEDDED LOGIN/SIGNUP FORM */}
          <div className="lg:col-span-5 w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-full bg-zinc-900/40 backdrop-blur-xl border border-zinc-850 p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
            >
              {/* Top border accent line */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

              {/* Tab Switcher */}
              <div className="flex border-b border-zinc-900 mb-6 pb-2 justify-start gap-6 font-mono text-[10px] tracking-widest uppercase">
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setAuthEmail(''); setAuthPassword(''); setAuthName(''); }}
                  className={cn(
                    "pb-2 transition-all cursor-pointer border-none bg-transparent font-mono text-[10px] tracking-widest",
                    authTab === 'login' ? "text-white font-bold border-b border-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  [ ACCESS_CENTER ]
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setAuthEmail(''); setAuthPassword(''); setAuthName(''); }}
                  className={cn(
                    "pb-2 transition-all cursor-pointer border-none bg-transparent font-mono text-[10px] tracking-widest",
                    authTab === 'signup' ? "text-white font-bold border-b border-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  [ CREATE_PROFILE ]
                </button>
              </div>

              {authTab === 'login' ? (
                /* Login Form */
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div className="text-left space-y-2">
                    <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Secure Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-zinc-850 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-200 transition-colors"
                      placeholder="Enter verified email"
                      required
                    />
                  </div>

                  <div className="text-left space-y-2">
                    <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Access Code</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-zinc-850 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-200 transition-colors"
                      placeholder="Enter access code"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full relative overflow-hidden group/btn flex items-center justify-center gap-4 text-[10px] font-mono tracking-widest text-white uppercase py-4 rounded-xl border border-zinc-850 hover:border-white bg-transparent transition-colors duration-300 cursor-pointer"
                  >
                    <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                    {authLoading ? (
                      <span className="relative z-10 text-indigo-950 font-bold">VERIFYING_ACCESS...</span>
                    ) : (
                      <span className="relative z-10 flex items-center gap-2 group-hover/btn:text-indigo-950 group-hover/btn:font-bold">
                        ACCESS_HUB <ArrowRight className="w-4 h-4 text-zinc-500 group-hover/btn:text-indigo-950" />
                      </span>
                    )}
                  </button>
                </form>
              ) : (
                /* Signup Form */
                <form onSubmit={handleSignupSubmit} className="space-y-5">
                  <div className="text-left space-y-2">
                    <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Candidate Name</label>
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-zinc-850 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-200 transition-colors"
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="text-left space-y-2">
                    <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Secure Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-zinc-850 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-200 transition-colors"
                      placeholder="Establish secure email"
                      required
                    />
                  </div>

                  <div className="text-left space-y-2">
                    <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Access Code</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-zinc-850 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-200 transition-colors"
                      placeholder="Establish password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full relative overflow-hidden group/btn flex items-center justify-center gap-4 text-[10px] font-mono tracking-widest text-white uppercase py-4 rounded-xl border border-zinc-850 hover:border-white bg-transparent transition-colors duration-300 cursor-pointer"
                  >
                    <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                    {authLoading ? (
                      <span className="relative z-10 text-indigo-950 font-bold">ESTABLISHING_IDENTITY...</span>
                    ) : (
                      <span className="relative z-10 flex items-center gap-2 group-hover/btn:text-indigo-950 group-hover/btn:font-bold">
                        REGISTER_IDENTITY <ArrowRight className="w-4 h-4 text-zinc-500 group-hover/btn:text-indigo-950" />
                      </span>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>

        </div>

        {/* Footer */}
        <div className="z-30 w-full flex justify-between items-center px-8 lg:px-16 pb-8 font-mono text-[9px] tracking-wider text-zinc-600 uppercase pt-4 border-t border-zinc-900/30">
          <div>BUILT FOR NEXT-GEN COGNITIVE PRACTICE</div>
          <div className="hidden sm:block">LATENCY_CRITICAL // 2026</div>
        </div>
      </main>
    );
  };

  // RENDER B: COMMAND CENTER DASHBOARD FOR LOGGED IN USERS
  const renderDashboard = () => {
    const resumeSkills = resumeData?.parsedData?.skills || [];
    const suggestedRole = resumeData?.parsedData?.suggestedRole || '';
    const resumeUpdated = resumeData?.uploadedAt ? new Date(resumeData.uploadedAt).toLocaleDateString() : 'N/A';
    const resumeName = resumeData?.versionName || 'No resume uploaded';

    return (
      <main className="min-h-screen bg-[#030303] text-zinc-50 relative overflow-hidden font-sans pb-16">
        <div className="noise-bg" />
        
        {/* Background radial accent glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-blue-600/5 rounded-full blur-[140px] pointer-events-none z-0" />

        <Navbar />

        <div className="z-10 relative max-w-7xl mx-auto px-6 pt-12 space-y-8">
          {/* Dashboard Header Banner */}
          <div className="border-b border-zinc-900 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ OPERATIONAL_COMMAND_CENTER ]</span>
              <h1 className="text-4xl font-light text-white tracking-tight mt-1 uppercase">
                Welcome back, {user?.name.split(' ')[0]}
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Configure next-gen practice, trace skill updates, and review real-time AI evaluations.
              </p>
            </div>
            
            <div className="flex bg-zinc-900/50 border border-zinc-800/80 px-4 py-2.5 rounded-xl items-center gap-3 text-xs font-mono text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>[ HUB_ONLINE // SECURE ]</span>
            </div>
          </div>

          {/* Core Command Center Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT AREA: Occupies 2 columns */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Section: Start simulation & suggestions */}
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 relative overflow-hidden space-y-5">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/15 to-transparent" />
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ SIMULATION_LAUNCH_PAD ]</span>
                <h2 className="text-xl font-light text-white uppercase tracking-tight">Configure New Practice</h2>

                {/* Suggestions cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1: Technical Interview */}
                  <div className="p-4 bg-zinc-950/80 border border-zinc-900 hover:border-zinc-750 rounded-xl transition-all flex flex-col justify-between h-[160px] group">
                    <div>
                      <div className="flex justify-between items-start">
                        <Cpu className="w-6 h-6 text-indigo-400" />
                        <span className="text-[9px] font-mono text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded uppercase">Technical</span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-3 uppercase tracking-wide">Technical Mode</h3>
                      <p className="text-[11px] text-zinc-500 mt-1 leading-normal uppercase">Practice stack specific follow-up questions and debug scripts.</p>
                    </div>
                    <a href="/interview" className="text-[10px] font-mono text-indigo-400 group-hover:text-white transition-colors flex items-center gap-1 mt-4">
                      LAUNCH_MODE <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </div>

                  {/* Option 2: Resume-Aware Mode */}
                  <div className="p-4 bg-zinc-950/80 border border-zinc-900 hover:border-zinc-750 rounded-xl transition-all flex flex-col justify-between h-[160px] group">
                    <div>
                      <div className="flex justify-between items-start">
                        <FileText className="w-6 h-6 text-emerald-400" />
                        <span className="text-[9px] font-mono text-emerald-500/25 bg-emerald-950/20 px-2 py-0.5 rounded uppercase">Resume Aware</span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-3 uppercase tracking-wide">Project Defense</h3>
                      <p className="text-[11px] text-zinc-500 mt-1 leading-normal uppercase">The AI challenges architectural projects and skills explicitly parsed from your resume.</p>
                    </div>
                    
                    {resumeSkills.length > 0 ? (
                      <button 
                        onClick={() => handleStartSuggested('Project Defense', resumeSkills.slice(0, 3), suggestedRole)}
                        className="text-[10px] font-mono text-emerald-400 hover:text-white transition-colors text-left flex items-center gap-1 mt-4 border-none bg-transparent cursor-pointer"
                      >
                        RUN_RESUME_SETUP <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <a href="/resume" className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors flex items-center gap-1 mt-4">
                        UPLOAD_RESUME_FIRST <ArrowRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* suggested types chip panel */}
                {resumeSkills.length > 0 && (
                  <div className="pt-2 border-t border-zinc-900 space-y-2">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block">SUGGESTED TECH INTERVIEWS:</span>
                    <div className="flex flex-wrap gap-2">
                      {resumeSkills.slice(0, 5).map((skill: string) => (
                        <button
                          key={skill}
                          onClick={() => handlePracticeTopic(skill)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-900 bg-zinc-950/50 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all font-mono text-[10px] uppercase cursor-pointer"
                        >
                          {skill} Interview
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section: Weak topics & targeted practice */}
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 space-y-4">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ WEAKNESS_CORRECTION_DECK ]</span>
                <h2 className="text-xl font-light text-white uppercase tracking-tight">Active Growth Tasks</h2>
                <div className="divide-y divide-zinc-900">
                  {stats.weakTopics && stats.weakTopics.length > 0 ? (
                    stats.weakTopics.slice(0, 4).map((topic: string, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-3.5 text-xs font-mono">
                        <div className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-zinc-300">{topic}</span>
                        </div>
                        <button
                          onClick={() => handlePracticeTopic(topic)}
                          className="text-[10px] text-indigo-400 hover:text-white font-mono uppercase transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none"
                        >
                          PRACTICE_NODE <Play className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs font-mono text-zinc-600">
                      [ NO_CRITICAL_WEAKNESSES_DETECTED_YET ]
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Recent sessions */}
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 space-y-4">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ RUNTIME_HISTORY ]</span>
                <h2 className="text-xl font-light text-white uppercase tracking-tight">Recent Sessions</h2>
                
                {stats.scoreTrends && stats.scoreTrends.length > 0 ? (
                  <div className="divide-y divide-zinc-900">
                    {stats.scoreTrends.slice().reverse().map((sess: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-3.5 text-xs font-mono">
                        <div className="flex items-center gap-4">
                          <History className="w-4 h-4 text-zinc-500" />
                          <div>
                            <p className="text-zinc-200 uppercase font-semibold">Technical Simulation Run</p>
                            <p className="text-[10px] text-zinc-500 lowercase mt-0.5">{sess.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-indigo-400 font-bold">{sess.score}% score</span>
                          <a 
                            href="/analytics" 
                            className="border border-zinc-800 hover:border-white text-[10px] px-3 py-1 rounded-md text-zinc-300 hover:text-white transition-colors"
                          >
                            OPEN_REPORT
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center border border-dashed border-zinc-900 rounded-xl font-mono text-xs text-zinc-500 space-y-2">
                    <History className="w-6 h-6 mx-auto text-zinc-700" />
                    <p>[ SIMULATION_RECORDS_EMPTY ]</p>
                    <a href="/interview" className="inline-block mt-2 text-indigo-400 hover:text-white border-b border-indigo-400/30">Start your first simulation →</a>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT AREA: Occupies 1 column */}
            <div className="lg:col-span-1 space-y-8">
              
              {/* Card D: Resume Profile */}
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 relative overflow-hidden space-y-4">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/15 to-transparent" />
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ LIVE_RESUME_METADATA ]</span>
                <h3 className="text-lg font-light text-white uppercase">Profile Asset</h3>

                <div className="p-3.5 bg-zinc-950/80 border border-zinc-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono text-zinc-200 truncate max-w-[180px]">{resumeName}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-900">
                    <span>Uploaded:</span>
                    <span>{resumeUpdated}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Active parsed skills:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {resumeSkills.length > 0 ? (
                      resumeSkills.slice(0, 8).map((s: string, idx: number) => (
                        <span key={idx} className="bg-zinc-950 border border-zinc-900 text-zinc-400 text-[9px] font-mono py-1 px-2.5 rounded-lg">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs font-mono text-zinc-600">[ Skills Unparsed ]</span>
                    )}
                  </div>
                </div>

                <a 
                  href="/resume" 
                  className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-mono tracking-wider text-white uppercase py-3 rounded-xl border border-zinc-850 hover:border-white bg-transparent transition-all"
                >
                  UPLOAD_NEW_ASSET <Plus className="w-4 h-4" />
                </a>
              </div>

              {/* Card E: Collaborative WebRTC mock rooms */}
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 relative overflow-hidden space-y-4">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ COGNITIVE_ROOMS ]</span>
                <h3 className="text-lg font-light text-white uppercase">Mock Classrooms</h3>
                
                <p className="text-[11px] text-zinc-400 font-mono uppercase leading-normal">Enter room code below to practice alongside colleagues with live audio/video and smart prompts.</p>
                
                <div className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 focus:border-zinc-700 outline-none rounded-xl py-2.5 px-4 text-xs font-mono text-zinc-200"
                    placeholder="Enter Room ID"
                  />

                  <button
                    onClick={() => {
                      if (roomIdInput.trim()) {
                        window.location.href = `/room?roomId=${encodeURIComponent(roomIdInput)}`;
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 text-xs font-mono tracking-wider text-indigo-400 hover:text-white uppercase py-3 rounded-xl border border-zinc-850 hover:border-indigo-500 bg-transparent transition-all cursor-pointer"
                  >
                    ENTER_MOCK_ROOM <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card F: Average index stats preview */}
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 relative overflow-hidden space-y-4">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ EVALUATION_SCORE_TIMELINE ]</span>
                <h3 className="text-lg font-light text-white uppercase">Competency Grade</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-zinc-950/80 border border-zinc-900 rounded-xl text-center">
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">Completed</span>
                    <span className="text-2xl font-light text-white tracking-tight mt-1 block">{stats.totalSessions}</span>
                  </div>
                  <div className="p-3 bg-zinc-950/80 border border-zinc-900 rounded-xl text-center">
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">Average</span>
                    <span className="text-2xl font-light text-indigo-400 tracking-tight mt-1 block">{stats.avgScore}%</span>
                  </div>
                </div>

                <a 
                  href="/analytics" 
                  className="w-full text-center block text-[10px] font-mono text-zinc-500 hover:text-white uppercase pt-2"
                >
                  VIEW_FULL_TREND_ANALYTICS →
                </a>
              </div>

            </div>

          </div>
        </div>
      </main>
    );
  };

  // 3. Main Conditional Render Wrapper
  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase animate-pulse">[ SECURE_DASHBOARD_INITIALIZING ]</span>
      </div>
    );
  }

  return user ? renderDashboard() : renderLandingPage();
}