"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AiAvatarProps {
  isAiSpeaking: boolean;
  phase?: string;
  speakerName?: string; // NEW PROP: Tracks which specific AI identity is active
}

export function AiAvatar({ isAiSpeaking, phase = "Introduction", speakerName = "Moderator" }: AiAvatarProps) {
  // Generate visual initials cleanly (e.g., "Sarah" -> "SA", "Moderator" -> "MD")
  const getInitials = (name: string) => {
    if (!name) return "AI";
    if (name.toUpperCase() === "MODERATOR") return "MD";
    return name.substring(0, 2).toUpperCase();
  };

  // Determine sub-label description based on character role
  const getRoleTitle = (name: string) => {
    if (name.toUpperCase() === "MODERATOR") return "Panel Moderator";
    if (name.toUpperCase() === "AI" || name.toUpperCase() === "AI INTERVIEWER") return "AI Agent Node";
    return `AI Participant // ${name}`;
  };

  return (
    // Clean, border-bottom container matching the InterviewOS editorial framework
    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-900/50 shrink-0 w-full select-none font-sans">
      <div className="relative">
        <div className={cn(
          "w-14 h-14 rounded-full bg-gradient-to-tr from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-bold tracking-widest text-zinc-100 shadow-xl transition-all duration-500",
          isAiSpeaking && "border-blue-500/50 shadow-blue-500/10 bg-zinc-900"
        )}>
          {getInitials(speakerName)}
        </div>

        {/* Luminous dynamic radar ripple ring when speaking */}
        {isAiSpeaking && (
          <motion.div
            className="absolute inset-0 rounded-full border border-blue-500/40"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
          />
        )}
      </div>

      <div className="flex flex-col items-start gap-0.5">
        {/* Dynamic header name assignment */}
        <h2 className="text-sm font-medium tracking-wide text-white uppercase">{speakerName}</h2>
        <p className="text-xs text-zinc-500 font-mono tracking-wider">
          {isAiSpeaking ? `[ ${getRoleTitle(speakerName).toUpperCase()} _ TALKING ]` : '[ WAITING_IN_STACK ]'}
        </p>
      </div>

      {/* Structural matrix phase layout badge */}
      <div className="ml-auto px-4 py-1.5 bg-zinc-950/40 rounded-none border border-zinc-900 font-mono text-[10px] tracking-widest text-zinc-400 uppercase">
        PHASE: {phase}
      </div>
    </div>
  );
}