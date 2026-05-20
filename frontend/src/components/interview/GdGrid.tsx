"use client";

import { useInterviewStore } from "@/store/interviewStore";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Star, Users, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";

import { GDParticipantCard } from "../gd/GDParticipantCard";

const AI_PARTICIPANTS = [
  { id: 'Sarah', name: 'Sarah',  avatarInitial: 'S', accentColor: 'sapphire', role: 'Assertive' },
  { id: 'James', name: 'James',  avatarInitial: 'J', accentColor: 'emerald', role: 'Skeptical' },
  { id: 'Priya', name: 'Priya',  avatarInitial: 'P', accentColor: 'amber', role: 'Analytical' },
  { id: 'David', name: 'David',  avatarInitial: 'D', accentColor: 'rose', role: 'Pragmatic' },
];

export function GdGrid({ gdTopic }: { gdTopic: string }) {
  const { messages, gdActiveSpeaker, currentAiStream } = useInterviewStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasWebcam, setHasWebcam] = useState(false);

  const moderatorSpeaking = gdActiveSpeaker === 'MODERATOR';
  
  // Detect USER_TURN signal
  const isUserTurn = currentAiStream?.includes('USER_TURN') ||
                     messages[messages.length - 1]?.content?.includes('USER_TURN');

  // Setup user webcam
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isMounted = true;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(() => {});
        }
        setHasWebcam(true);
      } catch (e: any) {
        // Prevent Next.js error overlay from blocking the UI
        console.warn("GD Webcam error:", e.message || e);
        setHasWebcam(false);
      }
    };
    startWebcam();
    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Topic Banner */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-zinc-800 flex items-center gap-3 shrink-0">
        <Megaphone className="w-4 h-4 text-blue-400 shrink-0" />
        <p className="text-sm text-zinc-300 font-medium line-clamp-1">
          <span className="text-zinc-500 text-xs uppercase tracking-widest mr-2">Topic</span>
          {gdTopic || "Loading topic..."}
        </p>
        {moderatorSpeaking && (
          <span className="ml-auto text-xs font-bold text-yellow-400 animate-pulse shrink-0">MODERATOR SPEAKING</span>
        )}
      </div>

      {/* 6-slot grid: 4 AI + You + Info */}
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 p-3 min-h-0 overflow-y-auto custom-scrollbar max-h-[calc(100vh-320px)] pr-1">
        
        {/* AI Participants */}
        {AI_PARTICIPANTS.map((ai) => (
          <GDParticipantCard
            key={ai.id}
            speaker={ai.id}
            label={ai.name}
            role={ai.role}
            avatarInitial={ai.avatarInitial}
            accentColor={ai.accentColor}
          />
        ))}

        {/* User (You) */}
        <div className={cn(
          "relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-all duration-500 min-h-[140px] flex items-center justify-center",
          isUserTurn
            ? "border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.4)] scale-[1.02]"
            : "border-zinc-700"
        )}>
          {hasWebcam ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30 animate-pulse mb-2">
                <Mic className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ STANDBY_MODE ]</span>
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/70 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10 z-10">
            <span className="text-xs font-bold text-white">You</span>
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          </div>

          {/* "Your Turn" flash */}
          <AnimatePresence>
            {isUserTurn && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-blue-600/10 flex items-center justify-center z-10"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl"
                >
                  🎤 Your Turn to Speak
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Participants info card */}
        <div className="relative rounded-xl bg-zinc-900/50 border border-zinc-800 p-3 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Participants</span>
          </div>
          {[...AI_PARTICIPANTS.map(p => p.name), 'You'].map((name, i) => (
            <div key={name} className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                name === 'You'
                  ? isUserTurn ? 'bg-blue-500 animate-pulse' : 'bg-zinc-600'
                  : gdActiveSpeaker === name
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-zinc-600'
              )} />
              <span className="text-xs text-zinc-400">{name}</span>
              {name === 'You' && <span className="text-[9px] text-blue-400 ml-auto">Candidate</span>}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
