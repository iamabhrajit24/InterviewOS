"use client";

import { useInterviewStore } from "@/store/interviewStore";
import { WebcamPanel } from "../webcam/WebcamPanel";
import { Controls } from "./Controls";
import { Timer, Info, AlertTriangle, XCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function InterviewSidebar({
  isListening,
  onToggleListen,
  seconds,
}: {
  isListening: boolean;
  onToggleListen: () => void;
  seconds: number;
}) {
  const { isConnected, config, isAiSpeaking, sendMessage, disconnectWs, setView, setElapsedSeconds } =
    useInterviewStore();

  // Webcam violation tracking
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  
  const [showEndModal, setShowEndModal] = useState(false);

  const handleEndSession = () => {
    setShowEndModal(false);
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    disconnectWs();
    setElapsedSeconds(seconds); // Save final exact elapsed seconds!
    setView('report');
  };


  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Called by WebcamPanel when the camera track ends (user closed cam mid-interview)
  const handleWebcamLost = useCallback(() => {
    const newCount = violationCount + 1;
    setViolationCount(newCount);

    if (newCount === 1) {
      // First violation — warn the user
      setShowWarning(true);
      // AI sends a warning message through the transcript
      sendMessage(
        "[SYSTEM: Webcam was turned off. This is a violation. One more time and the interview will be terminated.]"
      );
      setTimeout(() => setShowWarning(false), 8000);
    } else {
      // Second violation — disqualify
      setDisqualified(true);
      sendMessage(
        "[SYSTEM: Webcam turned off a second time. Interview terminated. You are disqualified.]"
      );
      setTimeout(() => {
        disconnectWs();
        setElapsedSeconds(seconds); // Save final exact elapsed seconds!
        setView("report");
      }, 4000);
    }
  }, [violationCount, sendMessage, disconnectWs, setView, seconds, setElapsedSeconds]);

  if (disqualified) {
    return (
      <div className="w-80 flex flex-col gap-4 shrink-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-950/50 border-2 border-red-500 rounded-3xl p-8 flex flex-col items-center text-center gap-4"
        >
          <XCircle className="w-16 h-16 text-red-400" />
          <h2 className="text-xl font-bold text-white">Interview Terminated</h2>
          <p className="text-red-300 text-sm leading-relaxed">
            Your webcam was turned off twice during the interview. You have been
            disqualified. Redirecting to report...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-80 flex flex-col gap-4 shrink-0">
      {/* Webcam Panel — Hidden in GD mode as it moves to center grid */}
      {config.type !== 'gd' && (
        <div className="relative">
          <WebcamPanel isListening={isListening} onWebcamLost={handleWebcamLost} />

          {/* Warning overlay on first violation */}
          <AnimatePresence>
            {showWarning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-2xl border-2 border-amber-500 bg-amber-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4 text-center z-10"
              >
                <AlertTriangle className="w-10 h-10 text-amber-400 animate-bounce" />
                <p className="text-amber-300 font-bold text-base">⚠ Camera Off — Warning!</p>
                <p className="text-amber-400 text-xs leading-relaxed">
                  Turn your camera back on immediately. One more violation will result in
                  disqualification.
                </p>
                <span className="text-xs text-amber-500 font-semibold uppercase tracking-widest">
                  Violation 1 / 2
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Status & Timer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Timer className="w-4 h-4" />
            <span className="text-sm font-medium">Session Time</span>
          </div>
          <span className="text-white font-mono font-bold text-lg">{formatTime(seconds)}</span>
        </div>

        <div className="h-px bg-zinc-800" />

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">AI Status</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider",
                isAiSpeaking
                  ? "bg-blue-500/20 text-blue-400 animate-pulse"
                  : "bg-zinc-800 text-zinc-500"
              )}
            >
              {isAiSpeaking ? "Speaking" : "Listening"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Connection</span>
            <span
              className={cn(
                "flex items-center gap-1.5",
                isConnected ? "text-green-500" : "text-red-500"
              )}
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isConnected ? "bg-green-500" : "bg-red-500"
                )}
              />
              {isConnected ? "Stable" : "Offline"}
            </span>
          </div>
          {violationCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Violations</span>
              <span className="text-amber-400 font-bold text-xs">{violationCount} / 2</span>
            </div>
          )}
        </div>
      </div>

      {/* Mic Toggle */}
      <Controls
        isListening={isListening}
        isConnected={isConnected}
        onToggleListen={onToggleListen}
      />

      <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300 leading-relaxed">
          {config.type === 'gd' 
            ? "Group Discussion mode active. 5 participants in the room." 
            : "Webcam must remain on throughout the interview. Two violations will result in disqualification."}
        </p>
      </div>

      <button
        onClick={() => setShowEndModal(true)}
        className="w-full mt-auto py-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 rounded-xl font-semibold transition-colors border border-red-500/30 text-sm"
      >
        End Session
      </button>

      {/* End Session Modal */}
      <AnimatePresence>
        {showEndModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-md w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-2">End Interview Session?</h3>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Are you sure you want to end the interview? The AI will stop, and your final report will be generated immediately.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowEndModal(false)}
                  className="px-4 py-2 rounded-xl text-zinc-300 font-semibold hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndSession}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 transition-all"
                >
                  Confirm End
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
