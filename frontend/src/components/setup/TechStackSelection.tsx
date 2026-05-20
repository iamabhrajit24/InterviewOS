"use client";

import { motion } from "framer-motion";
import { Plus, X, Search } from "lucide-react";
import { useInterviewStore } from "@/store/interviewStore";
import { useState } from "react";
import { cn } from "@/lib/utils";

const suggestions = ["React", "Next.js", "TypeScript", "Python", "Node.js", "PostgreSQL", "System Design", "Algorithms", "AWS", "Docker"];

export function TechStackSelection() {
  const { config, updateConfig, setSetupStep } = useInterviewStore();
  const [input, setInput] = useState("");

  const addSkill = (skill: string) => {
    if (skill && !config.skills.includes(skill)) {
      updateConfig({ skills: [...config.skills, skill] });
    }
    setInput("");
  };

  const removeSkill = (skill: string) => {
    updateConfig({ skills: config.skills.filter(s => s !== skill) });
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold text-white mb-3">Key Skills & Tech Stack</h1>
        <p className="text-zinc-400">Add the technologies you want the AI to focus on.</p>
      </motion.div>

      <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 mb-8">
        <div className="relative mb-6">
          <input 
            type="text"
            placeholder="Search or add skill..."
            className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-5 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill(input)}
          />
          <button 
            onClick={() => addSkill(input)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {config.skills.map(skill => (
            <motion.span
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={skill}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-sm font-medium"
            >
              {skill}
              <button onClick={() => removeSkill(skill)}><X className="w-3 h-3 hover:text-white" /></button>
            </motion.span>
          ))}
          {config.skills.length === 0 && <p className="text-zinc-600 text-sm">No skills added yet.</p>}
        </div>

        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Suggestions</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.filter(s => !config.skills.includes(s)).map(s => (
            <button
              key={s}
              onClick={() => addSkill(s)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-400 text-sm hover:bg-zinc-800 hover:text-white transition-all"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button 
          onClick={() => setSetupStep(3)}
          className="px-8 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 transition-all"
        >
          Back
        </button>
        <button 
          onClick={() => setSetupStep(5)}
          className="px-10 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
