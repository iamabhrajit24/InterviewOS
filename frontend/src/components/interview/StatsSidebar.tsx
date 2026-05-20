"use client";

import { useInterviewStore } from "@/store/interviewStore";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Target, Brain, LineChart, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatsSidebar() {
  const { config, messages } = useInterviewStore();
  
  // Simulated analytics for UI/UX demonstration
  const progress = Math.min(100, (messages.length / 10) * 100);
  const detectedSkills = config.skills.slice(0, 4);

  return (
    <div className="w-72 hidden xl:flex flex-col gap-4 shrink-0">
      {/* Progress Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
           <Target className="w-4 h-4 text-blue-500" /> Interview Progress
        </h3>
        <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
           <motion.div 
             className="absolute top-0 left-0 h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
             animate={{ width: `${progress}%` }}
           />
        </div>
        <div className="flex justify-between text-xs text-zinc-500 font-medium">
           <span>{Math.round(progress)}% Complete</span>
           <span>Step 2/5</span>
        </div>
      </div>

      {/* AI Real-time Observations */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex-1">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
           <Brain className="w-4 h-4 text-purple-500" /> Live Observations
        </h3>
        
        <div className="space-y-4">
           <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">Communication</span>
                <span className="text-xs text-green-400 font-bold">Good</span>
              </div>
              <div className="flex gap-1">
                 {[1,2,3,4,5].map(i => <div key={i} className={cn("flex-1 h-1 rounded-full", i <= 4 ? "bg-green-500" : "bg-zinc-800")} />)}
              </div>
           </div>

           <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">Technical Depth</span>
                <span className="text-xs text-blue-400 font-bold">Analyzing</span>
              </div>
              <div className="flex gap-1">
                 {[1,2,3,4,5].map(i => <div key={i} className={cn("flex-1 h-1 rounded-full", i <= 2 ? "bg-blue-500" : "bg-zinc-800")} />)}
              </div>
           </div>
        </div>

        <div className="mt-8">
           <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Detected Skills</p>
           <div className="flex flex-wrap gap-2">
              {detectedSkills.map(skill => (
                <div key={skill} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300 border border-zinc-700/50">
                   <CheckCircle2 className="w-3 h-3 text-green-500" /> {skill}
                </div>
              ))}
              {detectedSkills.length === 0 && <span className="text-xs text-zinc-700">Waiting for response...</span>}
           </div>
        </div>
      </div>

      {/* Sentiment/Energy Visualizer Placeholder */}
      <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-5 h-32 overflow-hidden relative">
         <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Sentiment Analytics</h3>
         <div className="absolute inset-x-0 bottom-0 h-16 opacity-50">
            {/* Simple wave animation */}
            <div className="flex items-end h-full gap-0.5 px-4">
              {[...Array(20)].map((_, i) => (
                <motion.div 
                  key={i}
                  className="flex-1 bg-blue-500/50"
                  animate={{ height: [10, 20 + Math.random() * 30, 10] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                />
              ))}
            </div>
         </div>
      </div>
    </div>
  );
}
