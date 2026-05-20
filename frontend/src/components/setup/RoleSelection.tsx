"use client";

import { motion } from "framer-motion";
import { Search, UserCircle, Briefcase, Code, Brain, Database, Shield, Layout } from "lucide-react";
import { useInterviewStore } from "@/store/interviewStore";
import { useState } from "react";
import { cn } from "@/lib/utils";

const roles = [
  { id: 'frontend', title: 'Frontend Developer', icon: Layout },
  { id: 'backend', title: 'Backend Developer', icon: Code },
  { id: 'fullstack', title: 'Full Stack Developer', icon: Briefcase },
  { id: 'ai', title: 'AI/ML Engineer', icon: Brain },
  { id: 'data', title: 'Data Scientist', icon: Database },
  { id: 'devops', title: 'DevOps Engineer', icon: Shield },
];

export function RoleSelection() {
  const { config, updateConfig, setSetupStep } = useInterviewStore();
  const [customRole, setCustomRole] = useState(config.role);

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold text-white mb-3">Which role are you aiming for?</h1>
        <p className="text-zinc-400">This helps our AI tailor technical questions to your target position.</p>
      </motion.div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input 
          type="text"
          placeholder="Type your target role (e.g. Senior Java Engineer)..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          value={customRole}
          onChange={(e) => setCustomRole(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => {
              setCustomRole(role.title);
              updateConfig({ role: role.title });
            }}
            className={cn(
              "p-4 rounded-xl border transition-all flex flex-col items-center gap-2",
              customRole === role.title 
                ? "bg-blue-500/10 border-blue-500 text-blue-400" 
                : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
            )}
          >
            <role.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{role.title}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-4">
        <button 
          onClick={() => setSetupStep(1)}
          className="px-8 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 transition-all"
        >
          Back
        </button>
        <button 
          disabled={!customRole}
          onClick={() => {
            updateConfig({ role: customRole });
            setSetupStep(3);
          }}
          className="px-10 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
