"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { useInterviewStore } from "@/store/interviewStore";

interface Message {
  role: 'user' | 'ai';
  content: string;
  speakerName?: string;
}

interface TranscriptAreaProps {
  messages: Message[];
  revealedAiStream?: string;
  currentAiStream?: string;
  isStatic?: boolean;
}

export function TranscriptArea({ messages, revealedAiStream, currentAiStream, isStatic }: TranscriptAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isAiSpeaking } = useInterviewStore();

  // Auto-scroll to bottom whenever messages or stream changes
  useEffect(() => {
    if (!isStatic && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, revealedAiStream, currentAiStream, isStatic]);

  const getSpeakerTag = (content: string, role: string) => {
    if (role === 'user') return { label: "[ YOU // INTERVIEWEE ]", color: "text-blue-400", name: "YOU" };
    
    let name = "MODERATOR";
    if (content.startsWith("**")) {
      const match = content.match(/^\*\*(.*?)\*\*/);
      if (match) name = match[1];
    } else if (content.includes(":")) {
      const match = content.match(/^(.*?):/);
      if (match) name = match[1];
    }
    
    const upperName = name.toUpperCase();
    const isMod = upperName.includes("MODERATOR");
    return { 
      label: isMod ? `[ MODERATOR // ${upperName} ]` : `[ PARTICIPANT // ${upperName} ]`, 
      color: isMod ? "text-zinc-500" : "text-blue-400",
      name: upperName
    };
  };

  const stripSpeakerPrefix = (content: string) => {
    return content.replace(/^\*\*(.*?)\*\*:\s*/, '$1: ').trim();
  };

  // Prevent flashing full text when TTS starts:
  // If isAiSpeaking is true, only render the word-by-word revealed text.
  // During network token-streaming, render currentAiStream.
  const activeStream = isAiSpeaking ? revealedAiStream : (currentAiStream || revealedAiStream);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth custom-scrollbar flex flex-col min-h-0"
    >
      {messages.length === 0 && !activeStream && (
         <div className="flex h-full items-center justify-center text-zinc-500 italic">
           The interview has started. Connecting to secure channel...
         </div>
      )}
      
      {messages.map((msg, i) => {
        const { label, color } = getSpeakerTag(msg.content, msg.role);
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i} 
            className="flex flex-col md:flex-row gap-4 border-b border-zinc-900/40 py-6"
          >
            {/* Metadata Slot (Left Column) */}
            <div className="w-full md:w-56 shrink-0 pt-1">
              <span className={cn("font-mono text-[10px] tracking-widest uppercase font-bold", color)}>
                {label}
              </span>
            </div>
            
            {/* Dialogue Slot (Right Column) */}
            <div className="flex-1 text-sm leading-relaxed text-zinc-300">
              {stripSpeakerPrefix(msg.content)}
            </div>
          </motion.div>
        );
      })}
      
      {/* Streaming Text */}
      {!isStatic && activeStream && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="flex flex-col md:flex-row gap-4 border-b border-zinc-900/40 py-6"
        >
          <div className="w-full md:w-56 shrink-0 pt-1">
            <span className={cn("font-mono text-[10px] tracking-widest uppercase font-bold", getSpeakerTag(activeStream, 'ai').color)}>
              {getSpeakerTag(activeStream, 'ai').label.replace(' ]', ' // STREAMING ]')}
            </span>
          </div>
          <div className="flex-1 text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {stripSpeakerPrefix(activeStream)}
            <span className="inline-block w-1.5 h-4 ml-1 bg-blue-500/80 animate-pulse align-middle rounded-full"></span>
          </div>
        </motion.div>
      )}

      {/* Extra spacing at bottom to prevent cutoff */}
      <div className="h-4 w-full shrink-0" />
    </div>
  );
}
