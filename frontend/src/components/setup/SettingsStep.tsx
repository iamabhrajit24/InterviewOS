"use client";

import { motion } from "framer-motion";
import { Camera, Mic, Volume2, Clock, BarChart3 } from "lucide-react";
import { useInterviewStore } from "@/store/interviewStore";
import { cn } from "@/lib/utils";

export function SettingsStep() {
  const { config, updateConfig, setSetupStep } = useInterviewStore();

  const toggle = (field: keyof typeof config.settings) => {
    updateConfig({ 
      settings: { ...config.settings, [field]: !config.settings[field] } 
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold text-white mb-3">Interview Settings</h1>
        <p className="text-zinc-400">Fine-tune the interview environment.</p>
      </motion.div>

      <div className="space-y-4 mb-10">
        {/* Toggle List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'webcamEnabled', label: 'Webcam Feed', icon: Camera, mandatory: true },
            { id: 'micEnabled', label: 'Microphone', icon: Mic, mandatory: false },
            { id: 'voiceEnabled', label: 'AI Voice', icon: Volume2, mandatory: false },
          ].map((item) => (
            <button
              key={item.id}
              // Webcam is mandatory — cannot be toggled off
              onClick={() => !item.mandatory && toggle(item.id as any)}
              className={cn(
                "p-5 rounded-2xl border transition-all flex items-center justify-between",
                (config.settings as any)[item.id]
                  ? "bg-blue-600/10 border-blue-500 text-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500",
                item.mandatory && "cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <div className="text-left">
                  <span className="font-medium block">{item.label}</span>
                  {item.mandatory && (
                    <span className="text-xs text-amber-400 font-normal">Required for interview</span>
                  )}
                </div>
              </div>
              <div className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                (config.settings as any)[item.id] ? "bg-blue-500" : "bg-zinc-700",
                item.mandatory && "opacity-60"
              )}>
                <div className={cn(
                  "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                  (config.settings as any)[item.id] ? "left-6" : "left-1"
                )} />
              </div>
            </button>
          ))}
          
          {/* Difficulty Dropdown (Simple version) */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3 text-zinc-400">
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium text-white">Difficulty</span>
            </div>
            <select 
              value={config.settings.difficulty}
              onChange={(e) => updateConfig({ settings: { ...config.settings, difficulty: e.target.value } })}
              className="bg-black border border-zinc-800 rounded-lg text-sm p-1 px-2 focus:outline-none"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Duration Slider Placeholder */}
        <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
           <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3 text-white">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="font-medium">Estimated Duration</span>
             </div>
             <span className="text-blue-400 font-bold">{config.settings.duration} min</span>
           </div>
           <input 
            type="range" min="5" max="60" step="5"
            value={config.settings.duration}
            onChange={(e) => updateConfig({ settings: { ...config.settings, duration: parseInt(e.target.value) } })}
            className="w-full accent-blue-500 bg-zinc-800 rounded-lg h-2"
           />
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button 
          onClick={() => setSetupStep(4)}
          className="px-8 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 transition-all"
        >
          Back
        </button>
        <button 
          onClick={() => setSetupStep(6)}
          className="px-10 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
        >
          Final Check
        </button>
      </div>
    </div>
  );
}
