'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, LineChart, PieChart, TrendingUp, AlertTriangle, Play, HelpCircle, ArrowRight } from 'lucide-react';
import Navbar from '@/components/ui/Navbar';
import { useToast } from '@/components/ui/Toast';
import { LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as RBarChart, Bar, Cell } from 'recharts';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>({
    totalSessions: 0,
    avgScore: 0,
    topWeakTopic: '',
    categoryBreakdown: {},
    scoreTrends: [],
    weakTopics: [],
    resumeTimeline: []
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('user');
      if (!u) {
        window.location.href = '/login?redirect=' + window.location.pathname;
        return;
      }
    }
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Fetch analytics failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const handlePracticeTopic = (topic: string) => {
    toast(`Targeted simulation created for: ${topic}`, 'success');
    setTimeout(() => {
      // Redirect to interview setup with prefilled query
      window.location.href = `/interview?targetTopic=${encodeURIComponent(topic)}`;
    }, 1000);
  };

  // Convert category breakdown to array format for Recharts
  const barData = Object.keys(stats.categoryBreakdown).map(cat => ({
    name: cat,
    value: stats.categoryBreakdown[cat]
  }));

  const COLORS = ['#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#312e81'];

  return (
    <main className="min-h-screen bg-[#030303] text-zinc-50 relative overflow-hidden font-sans pb-16">
      <div className="noise-bg" />
      
      {/* Background atmosphere glow */}
      <div className="absolute top-1/4 left-1/4 w-[800px] h-[300px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none z-0" />

      <Navbar />

      <div className="z-10 relative max-w-5xl mx-auto px-6 pt-12 space-y-10">
        
        {/* Header Info */}
        <div className="border-b border-zinc-900 pb-8">
          <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ COGNITIVE_METRICS_DASHBOARD ]</span>
          <h1 className="text-4xl font-light text-white tracking-tight mt-1 uppercase">
            Performance Analytics
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Track your cognitive performance, historical growth parameters, and trace resume milestone upgrades.
          </p>
        </div>

        {/* 1. Core Summary Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card: Practice Session Count */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-2xl relative overflow-hidden space-y-2">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Simulations completed</span>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-5xl font-light tracking-tight text-white">{stats.totalSessions}</span>
              <span className="text-xs text-zinc-500 font-mono">sessions</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono uppercase">Cumulative active engagement</p>
          </div>

          {/* Card: Cumulative Average Score */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-2xl relative overflow-hidden space-y-2">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Average Score Index</span>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-5xl font-light tracking-tight text-indigo-400">{stats.avgScore}%</span>
              <span className="text-xs text-zinc-500 font-mono">rating</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono uppercase">Performance accuracy threshold</p>
          </div>

          {/* Card: Top Growth Node */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-2xl relative overflow-hidden space-y-2">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/10 to-transparent" />
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Primary Growth Node</span>
            <div className="pt-3">
              <span className="text-lg font-mono text-zinc-200 uppercase truncate block">
                {stats.topWeakTopic || 'DB Sharding keys'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono uppercase pt-2 flex items-center gap-1 text-amber-500">
              <AlertTriangle className="w-3.5 h-3.5" /> Priorities target item
            </p>
          </div>

        </div>

        {/* 2. Recharts Graphical Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Trend chart card */}
          <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-2xl space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                Score Progression Timeline
              </span>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RLineChart data={stats.scoreTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={9} domain={[0, 100]} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: 10 }} />
                  <Line type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </RLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category distribution chart */}
          <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-2xl space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Simulation distribution
              </span>
            </div>
            <div className="h-[220px] w-full">
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                    <XAxis dataKey="name" stroke="#52525b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: 10 }} />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </RBarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs">
                  [ NO_CATEGORIES_TO_DISPLAY ]
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 3. Targeted Weak Topics (With Practice CTA) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Practice checklist column */}
          <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Growth Focus Area Index</span>
            <div className="divide-y divide-zinc-900">
              {stats.weakTopics?.length > 0 ? (
                stats.weakTopics.map((topic: string, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-4 text-xs font-mono">
                    <span className="text-zinc-200">{topic}</span>
                    <button
                      onClick={() => handlePracticeTopic(topic)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-white border-b border-transparent hover:border-white pb-0.5 transition-all"
                    >
                      <Play className="w-3 h-3" /> PRACTICE_TOPIC
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 font-mono py-4">No critical growth prioritizations recorded yet.</p>
              )}
            </div>
          </div>

          {/* Timeline side card */}
          <div className="lg:col-span-1 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Profile Growth Timeline</span>
            
            <div className="space-y-6 pt-2 relative before:absolute before:top-4 before:bottom-2 before:left-[11px] before:w-[1px] before:bg-zinc-800">
              {stats.resumeTimeline?.map((item: any, idx: number) => (
                <div key={idx} className="relative pl-7 space-y-1">
                  <div className="absolute left-[7px] top-[5px] w-2 h-2 rounded-full bg-indigo-500 border border-zinc-950" />
                  
                  <div className="flex justify-between items-baseline gap-2">
                    <h4 className="text-xs font-medium text-white">{item.title}</h4>
                    <span className="text-[9px] font-mono text-zinc-500">{item.date}</span>
                  </div>

                  <p className="text-[10px] text-zinc-400 font-mono">
                    Skills expanded: <span className="text-indigo-400">+{item.skillsAdded}</span>
                  </p>
                  
                  {item.projectsAdded?.length > 0 && (
                    <div className="pt-0.5 flex flex-wrap gap-1">
                      {item.projectsAdded.map((proj: string, pIdx: number) => (
                        <span key={pIdx} className="text-[8px] font-mono bg-zinc-950 text-zinc-500 px-1 py-0.5 rounded">
                          {proj}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
