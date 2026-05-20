"use client";

import { motion } from "framer-motion";
import { 
  Briefcase, Code, Users, Shuffle, Building2, ChevronRight 
} from "lucide-react";
import { useInterviewStore, InterviewType } from "@/store/interviewStore";
import { cn } from "@/lib/utils";

const types = [
  { id: 'hr', title: 'HR Interview', icon: Briefcase, desc: 'Focus on behavioral questions, cultural fit, and soft skills.', color: 'from-blue-500 to-cyan-400' },
  { id: 'technical', title: 'Technical Interview', icon: Code, desc: 'Deep dive into your technical stack, problem solving, and DSA.', color: 'from-purple-600 to-indigo-400' },
  { id: 'gd', title: 'Group Discussion', icon: Users, desc: 'Simulate a multi-participant GD moderated by an AI.', color: 'from-orange-500 to-amber-400' },
  { id: 'mixed', title: 'Mixed Interview', icon: Shuffle, desc: 'A blend of HR and technical evaluation for full assessment.', color: 'from-emerald-500 to-teal-400' },
  { id: 'mock-company', title: 'Company Specific', icon: Building2, desc: 'Interview tailored to a specific company culture and tech bar.', color: 'from-rose-500 to-pink-400' },
];

export function TypeSelection() {
  const { config, updateConfig, setSetupStep } = useInterviewStore();

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-white mb-4">What would you like to practice?</h1>
        <p className="text-zinc-400">Select an interview type to customize your simulation experience.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {types.map((type, idx) => (
          <motion.div
            key={type.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              updateConfig({ type: type.id as InterviewType });
              setSetupStep(2);
            }}
            className={cn(
              "group relative p-6 rounded-2xl cursor-pointer border-2 transition-all duration-300 bg-zinc-900/50 backdrop-blur-xl",
              config.type === type.id 
                ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                : "border-zinc-800 hover:border-zinc-700"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br transition-transform group-hover:scale-110",
              type.color
            )}>
              <type.icon className="w-6 h-6 text-white" />
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-2">{type.title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">{type.desc}</p>
            
            <div className="flex items-center text-sm font-medium text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Select Mode <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
