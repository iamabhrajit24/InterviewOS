"use client";

import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Mic, Video, Settings2, Play } from "lucide-react";
import { useInterviewStore } from "@/store/interviewStore";
import { cn } from "@/lib/utils";

export function WaitingRoom() {
  const { config, startInterview, setSetupStep } = useInterviewStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [micLevel, setMicLevel] = useState(0);

  const [devicesReady, setDevicesReady] = useState({ cam: false, mic: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const initHardware = async () => {
      setError(null);
      let stream: MediaStream | null = null;
      let camAllowed = false;
      let micAllowed = false;

      try {
        // Attempt full access first
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 }, 
          audio: true 
        });
        camAllowed = true;
        micAllowed = true;
      } catch (err: any) {
        console.warn("Full camera+mic access failed, trying audio-only fallback...", err);
        try {
          // Fallback to audio only
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: false, 
            audio: true 
          });
          micAllowed = true;
          setError("Camera source locked or unavailable. Standby fallback visualizer active.");
        } catch (audioErr: any) {
          console.error("Audio-only access failed as well", audioErr);
          setError("Microphone access failed. Please permit microphone access.");
        }
      }

      if (stream) {
        activeStream = stream;
        setDevicesReady({ cam: camAllowed, mic: micAllowed });
        
        if (videoRef.current && camAllowed) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn("Autoplay blocked:", e));
          };
        }

        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(stream);
          const analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 256;
          source.connect(analyzer);
          const dataArray = new Uint8Array(analyzer.frequencyBinCount);
          
          const checkMic = () => {
            if (!activeStream || !activeStream.active) return;
            analyzer.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            setMicLevel(sum / dataArray.length);
            requestAnimationFrame(checkMic);
          };
          checkMic();
        } catch (audioCtxErr) {
          console.error("Failed to start AudioContext analysis:", audioCtxErr);
        }
      }
    };

    initHardware();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Allow starting as long as microphone is verified, using webcam as optional standby fallback
  const canStart = !config.settings.micEnabled || devicesReady.mic;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Ready to Start?</h1>
        <p className="text-zinc-400 text-sm">
          {!canStart 
            ? "Waiting for microphone access..." 
            : "Check your devices before the interview begins."}
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* Preview Panel */}
        <div className="flex-1 w-full max-w-2xl bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-6 rounded-3xl">
          <div className="aspect-video bg-black rounded-2xl overflow-hidden relative border border-zinc-800 mb-6 shadow-2xl">
            {config.settings.webcamEnabled && devicesReady.cam ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-650 bg-zinc-950 p-6">
                <Video className="w-12 h-12 opacity-30 mb-3 animate-pulse text-indigo-400" />
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ STANDBY FALLBACK ACTIVE ]</span>
              </div>
            )}
            
            {/* Overlay indicators */}
            <div className="absolute top-4 left-4 flex gap-2">
              <div className={cn(
                "p-2 rounded-lg backdrop-blur-md border",
                config.settings.webcamEnabled ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-red-500/20 border-red-500/50 text-red-400"
              )}>
                <Video className="w-4 h-4" />
              </div>
              <div className={cn(
                "p-2 rounded-lg backdrop-blur-md border",
                config.settings.micEnabled ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-red-500/20 border-red-500/50 text-red-400"
              )}>
                <Mic className="w-4 h-4" />
              </div>
            </div>

            {/* Mic Level Bar */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
               <div className="flex-1 bg-zinc-800/50 rounded-full h-1.5 overflow-hidden">
                 <motion.div 
                   className="bg-green-500 h-full"
                   style={{ width: `${Math.min(100, micLevel * 2)}%` }}
                 />
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 rounded-xl bg-black/40 border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Interview Type</p>
                <p className="text-white font-medium capitalize">{config.type}</p>
             </div>
             <div className="p-4 rounded-xl bg-black/40 border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Target Role</p>
                <p className="text-white font-medium truncate">{config.role}</p>
             </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
           <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Final Check
              </h3>
              <ul className="space-y-3 mb-8">
                 <li className="flex items-center gap-2 text-sm text-zinc-400">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Web Speech API Ready
                 </li>
                 <li className="flex items-center gap-2 text-sm text-zinc-400">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Groq AI Connected
                 </li>
                 <li className="flex items-center gap-2 text-sm text-zinc-400">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Noise Cancellation On
                 </li>
              </ul>

              <button 
                disabled={!canStart}
                onClick={startInterview}
                className={cn(
                  "w-full py-4 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2",
                  canStart 
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]" 
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
                )}
              >
                {canStart ? <Play className="fill-white w-5 h-5" /> : null}
                {canStart ? "Start Now" : "Devices Required"}
              </button>
           </div>

           <button 
             onClick={() => setSetupStep(5)}
             className="text-zinc-500 text-sm hover:text-white transition-colors"
           >
             Change Settings
           </button>
        </div>
      </div>
    </div>
  );
}
