"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface WebcamPanelProps {
  isListening: boolean;
  // For live interview mode: callback when webcam goes offline
  onWebcamLost?: () => void;
}

export function WebcamPanel({ isListening, onWebcamLost }: WebcamPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasWebcam, setHasWebcam] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const startWebcam = useCallback(async () => {
    // Release any existing stream first to avoid NotReadableError
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
      }

      // Listen for the track ending (user kills cam from OS or another app takes it)
      if (stream.getVideoTracks()[0]) {
        stream.getVideoTracks()[0].onended = () => {
          setHasWebcam(false);
          setWebcamError("Camera disconnected.");
          onWebcamLost?.();
        };
      }

      setHasWebcam(true);
      setWebcamError(null);
    } catch (err: any) {
      setHasWebcam(false);
      if (err.name === "NotReadableError") {
        setWebcamError("Camera is in use by another app.");
      } else if (err.name === "NotAllowedError") {
        setWebcamError("Camera permission denied.");
      } else {
        setWebcamError("Camera unavailable.");
      }
    }
  }, [onWebcamLost]);

  // Try starting webcam on mount
  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      await startWebcam();
      if (!isMounted && streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
    run();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => {
          t.stop();
          t.enabled = false;
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [startWebcam]);

  // Render high-tech visualizer when webcam is unavailable
  useEffect(() => {
    if (hasWebcam) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high resolution matching bounding box
    const handleResize = () => {
      canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);

    let animationId: number;
    let phase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 1. Sleek dark dashboard background with grid lines
      ctx.fillStyle = "#0c0c0e";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(63, 63, 70, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 25;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 2. Dynamic high-tech target scanner ring in center
      const midX = w / 2;
      const midY = h / 2;
      const baseRadius = Math.min(w, h) * 0.22;

      ctx.strokeStyle = isListening ? "rgba(34, 197, 94, 0.1)" : "rgba(99, 102, 241, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(midX, midY, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Outer dashed scan line
      ctx.strokeStyle = isListening ? "rgba(34, 197, 94, 0.15)" : "rgba(99, 102, 241, 0.1)";
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(midX, midY, baseRadius + 15, phase * 0.2, phase * 0.2 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // 3. Dual phase-shifted voice sine waves
      ctx.lineWidth = 2.5;

      // Secondary soft background wave
      ctx.strokeStyle = isListening ? "rgba(34, 197, 94, 0.2)" : "rgba(99, 102, 241, 0.15)";
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const amplitude = isListening ? h * 0.15 : h * 0.04;
        const freq = 0.008;
        const y = midY + Math.sin(x * freq - phase + 1.5) * amplitude * Math.sin((x / w) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Primary active voice wave
      ctx.strokeStyle = isListening ? "rgba(34, 197, 94, 0.45)" : "rgba(99, 102, 241, 0.35)";
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const amplitude = isListening ? h * 0.22 : h * 0.06;
        const freq = 0.006;
        const y = midY + Math.sin(x * freq + phase) * amplitude * Math.sin((x / w) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      phase += isListening ? 0.08 : 0.025;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [hasWebcam, isListening]);

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden aspect-video lg:aspect-[4/3] border-2 transition-colors duration-500",
        isListening
          ? "border-green-500/80 shadow-[0_0_20px_rgba(34,197,94,0.25)]"
          : hasWebcam
          ? "border-zinc-800"
          : "border-indigo-500/20"
      )}
    >
      {hasWebcam ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1] bg-black"
        />
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full h-full block bg-[#0c0c0e]"
        />
      )}

      {/* Floating Standby Indicators */}
      {!hasWebcam && (
        <>
          <div className="absolute top-4 left-4 bg-zinc-950/80 px-2.5 py-1 rounded-md text-[9px] font-mono text-zinc-400 border border-zinc-850 tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            [ Secure Standby Mode ]
          </div>

          <div className="absolute inset-x-0 bottom-16 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              {webcamError || "Camera standby mode active"}
            </p>
          </div>
          
          <button
            onClick={startWebcam}
            className="absolute bottom-4 right-4 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg text-[9px] font-mono tracking-widest uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 z-20"
          >
            <RefreshCw className="w-3 h-3 animate-spin-[5s]" /> Retry Camera
          </button>
        </>
      )}

      <div className="absolute bottom-4 left-4 bg-black/75 px-3 py-1 rounded-md text-[10px] font-mono tracking-widest uppercase backdrop-blur-sm border border-zinc-850 flex items-center gap-2">
        You{" "}
        {isListening && (
          <span className="text-green-400 animate-pulse text-[9px] font-bold">● Mic Active</span>
        )}
      </div>
    </div>
  );
}
