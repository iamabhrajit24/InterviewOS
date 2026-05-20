"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useInterviewStore } from "@/store/interviewStore";

interface ControlsProps {
  isListening: boolean;
  isConnected: boolean;
  onToggleListen: () => void;
}

export function Controls({ isListening, isConnected, onToggleListen }: ControlsProps) {


  return (
    <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-4 border border-zinc-800">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-medium">Session Controls</h3>
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 bg-black/50 px-3 py-1.5 rounded-full">
          <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")}></span>
          {isConnected ? 'WS Connected' : 'WS Disconnected'}
        </div>
      </div>
      
      <button 
        onClick={onToggleListen}
        className={cn(
          "w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
          isListening 
            ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30" 
            : "bg-white text-black hover:bg-zinc-200"
        )}
      >
        {isListening ? 'Stop Microphone' : 'Start Microphone'}
      </button>
    </div>
  );
}
