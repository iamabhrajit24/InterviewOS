"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, Trophy } from "lucide-react";
import { useInterviewStore, ExperienceLevel } from "@/store/interviewStore";
import { cn } from "@/lib/utils";

const levels = [
  { id: 'beginner', title: 'Beginner / Fresher', icon: Zap, desc: 'Focus on core concepts, fundamentals, and entry-level behavioral questions.', color: 'text-green-400' },
  { id: 'intermediate', title: 'Intermediate', icon: ShieldCheck, desc: 'Expect practical scenarios, system design basics, and deeper technical analysis.', color: 'text-blue-400' },
  { id: 'advanced', title: 'Advanced / Senior', icon: Trophy, desc: 'Senior level scrutiny: complex system architecture, leadership, and deep tech expertise.', color: 'text-purple-400' },
];

export function ExperienceSelection() {
  const { config, updateConfig, setSetupStep } = useInterviewStore();

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold text-white mb-3">Experience Level</h1>
        <p className="text-zinc-400">Choose the seniority level for your mock interview.</p>
      </motion.div>

      <div className="space-y-4 mb-10">
        {levels.map((level) => (
          <motion.div
            key={level.id}
            whileHover={{ x: 5 }}
            onClick={() => updateConfig({ experienceLevel: level.id as ExperienceLevel })}
            className={cn(
              "p-6 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-6",
              config.experienceLevel === level.id 
                ? "bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <div className={cn("p-3 rounded-xl bg-zinc-800", level.color)}>
              <level.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">{level.title}</h3>
              <p className="text-sm text-zinc-400">{level.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-center gap-4">
        <button 
          onClick={() => setSetupStep(2)}
          className="px-8 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 transition-all"
        >
          Back
        </button>
        <button 
          onClick={() => setSetupStep(4)}
          className="px-10 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
        >
          Next Step
        </button>
      </div>
    </div>
  );
}
