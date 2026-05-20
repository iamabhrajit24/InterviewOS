"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useInterviewStore, InterviewType, ExperienceLevel } from '@/store/interviewStore';
import { motion, AnimatePresence } from 'framer-motion';
import { GD_VOICE_PROFILES, getVoiceForProfile, getProfileByName } from '@/lib/voiceProfiles';
import { Camera, Mic, Monitor, ShieldCheck, Download, Sparkles, AlertTriangle, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

import dynamic from 'next/dynamic';

// Live Components
import { InterviewSidebar } from '@/components/interview/InterviewSidebar';
import { StatsSidebar } from '@/components/interview/StatsSidebar';
import { AiAvatar } from '@/components/voice/AiAvatar';
import { TranscriptArea } from '@/components/transcript/TranscriptArea';

const GdGrid = dynamic(() => import('@/components/interview/GdGrid').then(mod => mod.GdGrid), { ssr: false });
const CodeEditor = dynamic(() => import('@/components/interview/CodeEditor').then(mod => mod.CodeEditor), { ssr: false });
const ReportView = dynamic(() => import('@/components/interview/ReportView').then(mod => mod.ReportView), { ssr: false });
import { useGDMessageProcessor } from '@/hooks/useGDMessageProcessor';
import { MixedAudioRecorder } from '@/lib/mixedAudioRecorder';

function DiagnosticsCamera({ onStatus }: { onStatus: (status: 'OK' | 'ERROR') => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasWebcam, setHasWebcam] = useState(false);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        // Try the standard video stream (works 100% on laptop & desktop cameras)
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        activeStream = s;
        setStream(s);
        setHasWebcam(true);
        onStatus('OK');
      } catch (err) {
        console.warn("Standard camera lookup failed, trying facingMode constraint:", err);
        try {
          // Fallback to mobile front-facing constraint
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
          activeStream = s;
          setStream(s);
          setHasWebcam(true);
          onStatus('OK');
        } catch (err2) {
          console.error("All camera constraints failed:", err2);
          setHasWebcam(false);
          // Set to OK dynamically so the standby fallback handles it without blocking the user
          onStatus('OK');
        }
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn("Video play failed:", err);
      });
    }
  }, [stream]);

  return (
    <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl flex items-center justify-center min-h-[250px] overflow-hidden relative w-full h-full">
       <div className="absolute inset-0 bg-blue-500/5 mix-blend-screen pointer-events-none z-10" />
       <video 
         ref={videoRef} 
         className={cn("w-full h-full object-cover scale-x-[-1] z-0 absolute inset-0", !hasWebcam && "opacity-0 pointer-events-none")} 
         playsInline 
         muted 
         autoPlay 
       />
       {!hasWebcam && (
         <div className="flex flex-col items-center gap-4 z-10 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30 animate-pulse">
              <Video className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-400">[ STANDBY FALLBACK ACTIVE ]</span>
         </div>
       )}
    </div>
  );
}

export default function InterviewRoom() {
  const { 
    view, setupStep, config,
    connectWs, disconnectWs, 
    messages, currentAiStream, revealedAiStream, isAiSpeaking, 
    sendMessage, interruptAi, setView, gdTopic,
    updateConfig, setSetupStep, startInterview, resetSession,
    isInitializing, setRevealedAiStream, finalizeAiStream,
    setAudioBlobUrl, audioBlobUrl, addMessageToHistory, showCodeEditor, setRecorder, setElapsedSeconds
  } = useInterviewStore();
  
  useGDMessageProcessor();

  const [isListening, setIsListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [targetedTopic, setTargetedTopic] = useState<string | null>(null);

  // Resume aware setup & Memory indicators
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [suggestedRoles, setSuggestedRoles] = useState<string[]>([]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [includeWeakTopics, setIncludeWeakTopics] = useState(true);

  useEffect(() => {
    const fetchLatestResumeAndMemory = async () => {
      try {
        const [resRes, analRes] = await Promise.all([
          fetch('/api/resume/versions'),
          fetch('/api/analytics')
        ]);

        if (resRes.ok) {
          const data = await resRes.json();
          if (data.versions && data.versions.length > 0) {
            const latest = data.versions[data.versions.length - 1];
            setResumeSkills(latest.parsedData?.skills || []);
            
            // Inferred roles based on skills & parsed target role
            const skills = latest.parsedData?.skills || [];
            const inferred: string[] = [];
            const parsedRole = latest.parsedData?.suggestedRole;
            if (parsedRole) {
              inferred.push(parsedRole);
            }
            if (skills.some((s: string) => /react|next|vue|angular|frontend/i.test(s))) {
              if (!inferred.includes('Frontend Developer')) inferred.push('Frontend Developer');
            }
            if (skills.some((s: string) => /node|express|fastapi|django|backend/i.test(s))) {
              if (!inferred.includes('Backend Engineer')) inferred.push('Backend Engineer');
            }
            if (skills.some((s: string) => /pytorch|tensorflow|ml|python/i.test(s))) {
              if (!inferred.includes('AI/ML Engineer')) inferred.push('AI/ML Engineer');
            }
            if (skills.some((s: string) => /docker|k8s|aws|devops/i.test(s))) {
              if (!inferred.includes('DevOps Engineer')) inferred.push('DevOps Engineer');
            }
            if (inferred.length === 0) inferred.push('Fullstack Engineer');
            
            setSuggestedRoles(inferred);
            if (inferred.length > 0) {
              updateConfig({ role: inferred[0] });
            }
          }
        }

        if (analRes.ok) {
          const data = await analRes.json();
          if (data.weakTopics && data.weakTopics.length > 0) {
            setWeakTopics(data.weakTopics);
          }
        }
      } catch (err) {
        console.error("Setup page fetch failed:", err);
      }
    };
    fetchLatestResumeAndMemory();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const topic = params.get('targetTopic');
      const roleParam = params.get('targetRole');
      if (topic || roleParam) {
        setTargetedTopic(topic || roleParam || 'General');
        updateConfig({
          type: 'technical',
          ...(topic ? { skills: [topic] } : {}),
          ...(roleParam ? { role: roleParam } : {})
        });
        setSetupStep(5); // Jump straight to Settings!
      }
    }
  }, [updateConfig, setSetupStep]);
  
  // Real-time Diagnostics states
  const [systemLinkStatus, setSystemLinkStatus] = useState<'CHECKING' | 'SECURE' | 'OFFLINE'>('CHECKING');
  const [videoStatus, setVideoStatus] = useState<'CHECKING' | 'OK' | 'ERROR'>('CHECKING');
  const [audioStatus, setAudioStatus] = useState<'CHECKING' | 'OK' | 'ERROR'>('CHECKING');
  const [engineStateStatus, setEngineStateStatus] = useState<'CHECKING' | 'READY' | 'ERROR'>('CHECKING');
  const [cameraRetryKey, setCameraRetryKey] = useState(0);

  const retrySystemCheck = async () => {
    setSystemLinkStatus('CHECKING');
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
    const healthUrl = wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '/health');
    try {
      const res = await fetch(healthUrl, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        setSystemLinkStatus('SECURE');
      } else {
        setSystemLinkStatus('OFFLINE');
      }
    } catch (err) {
      setSystemLinkStatus(navigator.onLine ? 'SECURE' : 'OFFLINE');
    }
  };

  const retryAudioCheck = () => {
    setAudioStatus('CHECKING');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        setAudioStatus('OK');
        stream.getTracks().forEach(t => t.stop());
      })
      .catch(() => {
        setAudioStatus('ERROR');
      });
  };

  const retryVideoCheck = () => {
    setVideoStatus('CHECKING');
    setCameraRetryKey(prev => prev + 1);
  };

  useEffect(() => {
    if (setupStep !== 6) return;

    setSystemLinkStatus('CHECKING');
    setAudioStatus('CHECKING');
    // Note: Video status is checked via the DiagnosticsCamera component's mount and its onStatus callback!

    // 1. Check System Link
    retrySystemCheck();

    // 2. Check Audio Node
    retryAudioCheck();
  }, [setupStep]);

  useEffect(() => {
    if (setupStep !== 6) return;
    if (videoStatus === 'OK' && audioStatus === 'OK' && systemLinkStatus === 'SECURE') {
      setEngineStateStatus('READY');
    } else if (videoStatus === 'ERROR' || audioStatus === 'ERROR' || systemLinkStatus === 'OFFLINE') {
      setEngineStateStatus('ERROR');
    } else {
      setEngineStateStatus('CHECKING');
    }
  }, [videoStatus, audioStatus, systemLinkStatus, setupStep]);

  // Ref for speech recognition and audio recording
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mixedRecorderRef = useRef<MixedAudioRecorder | null>(null);

  useEffect(() => {
    if (view !== 'live') return;

    // Setup Browser Speech Recognition API
    const SpeechRecognition = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (interimTranscript.length > 2 || finalTranscript.length > 2) {
          if (isAiSpeaking && config.type !== 'gd') interruptAi();
        }

        silenceTimerRef.current = setTimeout(() => {
          if (finalTranscript.trim()) {
            if (config.type !== 'gd' || !isAiSpeaking) {
              sendMessage(finalTranscript.trim());
            }
            recognitionRef.current.stop();
            setTimeout(() => { if (isListening) recognitionRef.current.start(); }, 100);
          }
        }, 1500); 
      };
      
      recognitionRef.current.onend = () => {
        if (isListening) recognitionRef.current.start();
      };
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [view, isListening, isAiSpeaking]);

  const getSpeechSynthesisVoices = () => {
    if (typeof window === 'undefined') return [] as SpeechSynthesisVoice[];
    return window.speechSynthesis.getVoices() || [];
  };
  const speakText = (text: string, speaker: string) => {
    // Force cancellation for responsive character swapping
    window.speechSynthesis.cancel();
    if (typeof window !== 'undefined') {
      (window as any).__speechCancelled = false;
    }
    
    const profile = getProfileByName(speaker); // Dynamically fetch profile
    const voices = getSpeechSynthesisVoices();
    const voice = getVoiceForProfile(profile, voices);
    
    if (mixedRecorderRef.current) {
      mixedRecorderRef.current.speakAndRecord(
        text,
        { pitch: profile.pitch, rate: profile.rate, voice },
        (charIndex) => {
          setRevealedAiStream(text.slice(0, charIndex + 10));
        }
      ).then(() => {
        addMessageToHistory({ role: 'ai', content: text });
        finalizeAiStream();
      });
    } else {
      // Split text into chunks of max 180 characters to prevent Chrome SpeechSynthesis crashes
      const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
      const chunks: string[] = [];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > 180) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += ' ' + sentence;
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim());

      const playFallbackTTS = async () => {
        let cumulativeChars = 0;
        for (let idx = 0; idx < chunks.length; idx++) {
          if (typeof window !== 'undefined' && (window as any).__speechCancelled === true) {
            break;
          }
          const chunk = chunks[idx];
          await new Promise<void>((resolveChunk) => {
            const utterance = new SpeechSynthesisUtterance(chunk);
            if (voice) utterance.voice = voice;
            utterance.pitch = profile.pitch;
            utterance.rate = profile.rate;
            
            const chunkWatchdog = setTimeout(() => {
              resolveChunk();
            }, Math.max(3000, chunk.length * 80));

            // Ultra-smooth backup timer-based word typewriter
            const words = chunk.split(' ');
            let wordIdx = 0;
            let timer: any = null;

            utterance.onstart = () => {
              if ((window as any).__speechCancelled === true) return;
              const rateMultiplier = profile.rate || 1.0;
              const msPerWord = Math.max(200, 380 / rateMultiplier); // dynamic WPM
              timer = setInterval(() => {
                if ((window as any).__speechCancelled === true) {
                  if (timer) clearInterval(timer);
                  return;
                }
                wordIdx++;
                if (wordIdx <= words.length) {
                  const revealedWords = words.slice(0, wordIdx).join(' ');
                  setRevealedAiStream(text.slice(0, cumulativeChars + revealedWords.length));
                } else {
                  if (timer) clearInterval(timer);
                }
              }, msPerWord);
            };

            utterance.onboundary = (event) => {
              if ((window as any).__speechCancelled === true) {
                if (timer) clearInterval(timer);
                clearTimeout(chunkWatchdog);
                resolveChunk();
                return;
              }
              if (event.name === 'word') {
                setRevealedAiStream(text.slice(0, cumulativeChars + event.charIndex + event.charLength));
              }
            };
            
            utterance.onend = () => {
              if (timer) clearInterval(timer);
              setRevealedAiStream(text.slice(0, cumulativeChars + chunk.length));
              clearTimeout(chunkWatchdog);
              resolveChunk();
            };
            utterance.onerror = () => {
              if (timer) clearInterval(timer);
              clearTimeout(chunkWatchdog);
              resolveChunk();
            };

            if ((window as any).__speechCancelled === true) {
               if (timer) clearInterval(timer);
               clearTimeout(chunkWatchdog);
               resolveChunk();
               return;
             }
             window.speechSynthesis.speak(utterance);
          });
          cumulativeChars += chunk.length + 1; // plus space
        }
        addMessageToHistory({ role: 'ai', content: text });
        finalizeAiStream();
      };
      
      playFallbackTTS();
    }
  };

  // TTS implementation with multi-voice support
  useEffect(() => {
    if (config.type === 'gd') return; // Handled by useGDMessageProcessor

    // Only speak when network streaming is finished
    if (
      view === 'live' &&
      isAiSpeaking && 
      currentAiStream && 
      !revealedAiStream &&
      config.settings.voiceEnabled
    ) {
      if (!currentAiStream.includes('[Interrupted]')) {
        window.speechSynthesis.cancel();
        
        speakText(currentAiStream, 'AI');
      } else {
        finalizeAiStream();
      }
    } else if (view === 'live' && isAiSpeaking && currentAiStream && !config.settings.voiceEnabled) {
      // If voice disabled, just mock a fast typing effect
      let i = 0;
      const id = setInterval(() => {
         i += 5;
         if (i >= currentAiStream.length) {
            clearInterval(id);
            finalizeAiStream();
         } else {
            setRevealedAiStream(currentAiStream.slice(0, i));
         }
      }, 50);
      return () => clearInterval(id);
    }
  }, [isAiSpeaking, currentAiStream, view, config.type, config.settings.voiceEnabled]);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (isAiSpeaking) interruptAi();
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // Rendering logic for setup wizard
  useEffect(() => {
    if (view !== 'live') {
      if (mixedRecorderRef.current) {
        const rec = mixedRecorderRef.current;
        mixedRecorderRef.current = null; // Prevent double-stop!
        rec.stop().then(blob => {
           if (blob.size > 0 && !audioBlobUrl) {
             setAudioBlobUrl(URL.createObjectURL(blob));
           }
        });
      }
      setSeconds(0);
      return;
    }
    
    // Start Audio Recording for the entire session
    const initRecorder = async () => {
      try {
        // Enumerate devices to prioritize bluetooth earpods or headsets
        let constraints: MediaStreamConstraints = { audio: true };
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(d => d.kind === 'audioinput');
          const priorityKeywords = ['bluetooth', 'earpods', 'headset', 'buds', 'airpods', 'wireless', 'hands-free'];
          const bestDevice = audioInputs.find(device => 
            priorityKeywords.some(kw => device.label.toLowerCase().includes(kw))
          );
          if (bestDevice && bestDevice.deviceId) {
            console.log("Prioritizing audio input device:", bestDevice.label);
            constraints = { audio: { deviceId: { ideal: bestDevice.deviceId } } };
          }
        } catch (e) {
          console.warn("Failed to query best audio input device, falling back to default", e);
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (deviceErr) {
          console.warn("Targeted audio device failed (e.g. bluetooth disconnect), falling back to default microphone", deviceErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        mixedRecorderRef.current = new MixedAudioRecorder();
        await mixedRecorderRef.current.init(stream);
        setRecorder(mixedRecorderRef.current);
        mixedRecorderRef.current.start();

        // Hardware devices completely resolved. Connect WebSocket safely without UI congestion!
        console.log("Hardware acquired. Establishing real-time connection...");
        connectWs();
      } catch (err) {
        console.warn("Session recording failed entirely, connecting socket as last fallback", err);
        connectWs();
      }
    };
    
    initRecorder();
    
    const interval = setInterval(() => {
      setSeconds(s => {
        const next = s + 1;
        const totalDurationSeconds = config.settings.duration * 60;
        
        if (next === totalDurationSeconds - 10) {
           if (isListening) {
             recognitionRef.current?.stop();
             setIsListening(false);
           }
           const utterance = new SpeechSynthesisUtterance("Time is up. Let's wrap up the interview and see your report.");
           window.speechSynthesis.speak(utterance);
        }

        if (next >= totalDurationSeconds) {
           clearInterval(interval);
           disconnectWs();
           setTimeout(() => {
             setElapsedSeconds(totalDurationSeconds);
             setView('report');
           }, 0);
           return next;
        }
        
        return next;
      });
    }, 1000);
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel(); // Terminate any lingering AI voices instantly!
      }
      if (mixedRecorderRef.current) {
        const rec = mixedRecorderRef.current;
        mixedRecorderRef.current = null; // Prevent double-stop!
        rec.stop().then(blob => {
           if (blob.size > 0 && !audioBlobUrl) {
             setAudioBlobUrl(URL.createObjectURL(blob));
           }
        });
      }
    };
  }, [config.settings.duration, isListening, view, setAudioBlobUrl, disconnectWs, setView]);

  // Setup Flow Orchestration
  const renderSetupFlow = () => {
    switch (setupStep) {
      case 1:
        return (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-light text-white mb-4 uppercase tracking-widest">What would you like to practice?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'hr', label: 'HR Interview', desc: 'Behavioral & Cultural' },
                { id: 'technical', label: 'Technical Interview', desc: 'DSA & Architecture' },
                { id: 'gd', label: 'Group Discussion', desc: 'Multi-Participant Debate' },
                { id: 'mixed', label: 'Mixed Assessment', desc: 'Comprehensive Review' },
              ].map(t => (
                <div 
                  key={t.id}
                  onClick={() => { updateConfig({ type: t.id as InterviewType }); setSetupStep(2); }}
                  className={cn(
                    "border border-zinc-900 bg-zinc-950/20 hover:border-zinc-700 p-5 rounded-xl transition-all duration-300 cursor-pointer group",
                    config.type === t.id ? "border-blue-500/50 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : ""
                  )}
                >
                  <h3 className="text-zinc-200 font-mono text-sm tracking-widest uppercase mb-1">{t.label}</h3>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest">{t.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-6">
              <button 
                onClick={() => { resetSession(); window.location.href = '/'; }} 
                className="text-zinc-600 hover:text-zinc-400 font-mono text-[10px] tracking-widest uppercase transition-colors"
              >
                ← Exit to Dashboard
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-light text-white mb-4 uppercase tracking-widest">Target Role</h2>
            
            {suggestedRoles.length > 0 && (
              <div className="bg-indigo-950/20 border border-indigo-900/60 p-4 rounded-xl mb-2 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
                <span className="text-[9px] font-mono tracking-widest text-indigo-400 uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Suggested from latest Resume
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestedRoles.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => updateConfig({ role })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs font-mono uppercase transition-all cursor-pointer",
                        config.role === role ? "border-indigo-400 bg-indigo-500/10 text-white shadow-[0_0_10px_rgba(99,102,241,0.2)]" : "border-zinc-850 bg-zinc-950/30 text-zinc-400 hover:text-white"
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-2">
              {['Frontend Developer', 'Backend Engineer', 'Product Manager', 'Data Scientist', 'DevOps Engineer', 'UI/UX Designer'].map(role => (
                <div 
                  key={role} 
                  onClick={() => updateConfig({ role })} 
                  className={cn("border border-zinc-900 bg-zinc-950/20 hover:border-zinc-700 p-3 rounded-lg cursor-pointer transition-colors text-center text-xs font-mono uppercase text-zinc-400 hover:text-zinc-200", config.role === role ? "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "")}
                >
                  {role}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
               <span className="text-zinc-600 font-mono text-[10px] tracking-widest uppercase">Or Enter Custom Role:</span>
               <input 
                 type="text" 
                 placeholder="e.g. Senior Mobile Engineer" 
                 value={config.role}
                 onChange={(e) => updateConfig({ role: e.target.value })}
                 className="bg-zinc-950/40 border border-zinc-900 rounded-lg text-zinc-200 focus:border-zinc-500 focus:outline-none px-4 py-3 font-mono text-sm uppercase transition-colors"
               />
            </div>
            <div className="flex items-center gap-4 mt-6">
               <button onClick={() => setSetupStep(1)} className="text-zinc-600 hover:text-zinc-400 font-mono text-[10px] tracking-widest uppercase transition-colors">← Back</button>
               <button 
                 onClick={() => { if (config.role.trim()) setSetupStep(3); }} 
                 className={cn("relative overflow-hidden group/btn flex items-center gap-4 text-xs font-mono tracking-widest uppercase py-2 px-4 border-b transition-all duration-300", config.role.trim() ? "text-white border-zinc-800 hover:border-white cursor-pointer bg-transparent" : "text-zinc-600 border-zinc-900 opacity-50 cursor-not-allowed")}
               >
                 <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                 <span className="relative z-10 transition-all group-hover/btn:text-indigo-950 group-hover/btn:font-bold">CONTINUE</span>
               </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-light text-white mb-4 uppercase tracking-widest">Experience Level</h2>
            <div className="flex flex-col gap-3">
              {[
                { id: 'beginner', label: 'Beginner / Fresher', desc: '0-2 years experience' },
                { id: 'intermediate', label: 'Intermediate', desc: '3-5 years experience' },
                { id: 'advanced', label: 'Advanced / Senior', desc: '5+ years experience' }
              ].map(lvl => (
                <div 
                  key={lvl.id}
                  onClick={() => updateConfig({ experienceLevel: lvl.id as ExperienceLevel })}
                  className={cn(
                    "border border-zinc-900 bg-zinc-950/20 hover:border-zinc-700 p-4 rounded-xl transition-all duration-300 cursor-pointer flex justify-between items-center",
                    config.experienceLevel === lvl.id ? "border-zinc-500 bg-zinc-900/50" : ""
                  )}
                >
                  <div>
                    <h3 className="text-zinc-200 font-mono text-sm tracking-widest uppercase">{lvl.label}</h3>
                    <p className="text-zinc-600 text-[10px] uppercase tracking-widest mt-1">{lvl.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-8">
               <button onClick={() => setSetupStep(2)} className="text-zinc-600 hover:text-zinc-400 font-mono text-[10px] tracking-widest uppercase transition-colors">← Back</button>
               <button onClick={() => setSetupStep(4)} className="relative overflow-hidden group/btn flex items-center gap-4 text-xs font-mono tracking-widest text-white uppercase py-2 px-4 border-b border-zinc-800 hover:border-white bg-transparent transition-colors duration-300">
                 <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                 <span className="relative z-10 transition-all group-hover/btn:text-indigo-950 group-hover/btn:font-bold">CONTINUE</span>
               </button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-light text-white mb-4 uppercase tracking-widest">Tech Stack / Skills</h2>
            
            {resumeSkills.length > 0 && (
              <div className="bg-indigo-950/20 border border-indigo-900/60 p-4 rounded-xl mb-2 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
                <span className="text-[9px] font-mono tracking-widest text-indigo-400 uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Auto-Detected Resume Tech Stack
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {resumeSkills.map(skill => {
                    const isActive = config.skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          const newSkills = isActive ? config.skills.filter(s => s !== skill) : [...config.skills, skill];
                          updateConfig({ skills: newSkills });
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg border text-[10px] font-mono uppercase transition-all cursor-pointer",
                          isActive ? "border-indigo-400 bg-indigo-500/15 text-white shadow-[0_0_10px_rgba(99,102,241,0.2)]" : "border-zinc-850 bg-zinc-950/30 text-zinc-400 hover:text-white"
                        )}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-2">
              {['React', 'Node.js', 'Python', 'AWS', 'System Design', 'Docker', 'SQL', 'TypeScript'].map(skill => {
                 const isActive = config.skills.includes(skill);
                 return (
                   <div 
                     key={skill} 
                     onClick={() => {
                       const newSkills = isActive ? config.skills.filter(s => s !== skill) : [...config.skills, skill];
                       updateConfig({ skills: newSkills });
                     }} 
                     className={cn("border px-3 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-mono uppercase", isActive ? "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]" : "text-zinc-400 border-zinc-900 bg-zinc-950/20 hover:border-zinc-700 hover:text-zinc-200")}
                   >
                     {skill}
                   </div>
                 )
              })}
            </div>
            <div className="flex flex-col gap-2">
               <span className="text-zinc-600 font-mono text-[10px] tracking-widest uppercase">Or Enter Custom Skills:</span>
               <input 
                 type="text" 
                 placeholder="e.g. Next.js, Redis, TailwindCSS (comma separated)" 
                 value={config.skills.join(', ')}
                 onChange={(e) => updateConfig({ skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                 className="bg-zinc-950/40 border border-zinc-900 rounded-lg text-zinc-200 focus:border-zinc-500 focus:outline-none px-4 py-3 font-mono text-sm uppercase transition-colors"
               />
            </div>
            <div className="flex items-center gap-4 mt-6">
               <button onClick={() => setSetupStep(3)} className="text-zinc-600 hover:text-zinc-400 font-mono text-[10px] tracking-widest uppercase transition-colors">← Back</button>
               <button 
                 onClick={() => { if (config.skills.length > 0) setSetupStep(5); }} 
                 className={cn("relative overflow-hidden group/btn flex items-center gap-4 text-xs font-mono tracking-widest uppercase py-2 px-4 border-b transition-all duration-300", config.skills.length > 0 ? "text-white border-zinc-800 hover:border-white cursor-pointer bg-transparent" : "text-zinc-600 border-zinc-900 opacity-50 cursor-not-allowed")}
               >
                 <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                 <span className="relative z-10 transition-all group-hover/btn:text-indigo-950 group-hover/btn:font-bold">CONTINUE</span>
               </button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-light text-white mb-4 uppercase tracking-widest">Session Settings</h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border border-zinc-900 bg-zinc-950/20 p-4 rounded-xl">
                 <span className="text-zinc-200 font-mono text-sm tracking-widest uppercase">Duration (Minutes)</span>
                 <select 
                   value={config.settings.duration}
                   onChange={(e) => updateConfig({ settings: { ...config.settings, duration: Number(e.target.value) } })}
                   className="bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs px-2 py-1 rounded outline-none"
                 >
                   <option value={15}>15 MIN</option>
                   <option value={30}>30 MIN</option>
                   <option value={45}>45 MIN</option>
                   <option value={60}>60 MIN</option>
                 </select>
              </div>
              <div className="flex items-center justify-between border border-zinc-900 bg-zinc-950/20 p-4 rounded-xl">
                 <span className="text-zinc-200 font-mono text-sm tracking-widest uppercase">AI Strictness</span>
                 <select 
                   value={config.settings.difficulty}
                   onChange={(e) => updateConfig({ settings: { ...config.settings, difficulty: e.target.value } })}
                   className="bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs px-2 py-1 rounded outline-none"
                 >
                   <option value="easy">LENIENT</option>
                   <option value="medium">STANDARD</option>
                   <option value="hard">STRICT</option>
                 </select>
              </div>
            </div>

            {weakTopics.length > 0 && (
              <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-3 relative overflow-hidden mb-2">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIncludeWeakTopics(!includeWeakTopics)}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <div>
                      <h4 className="text-xs font-mono font-bold text-zinc-300 uppercase text-left">Struggled in last session:</h4>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase mt-0.5 text-left">Focus areas are active</p>
                    </div>
                  </div>
                  
                  {/* Compact Yes/No switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">{includeWeakTopics ? "INCLUDED" : "EXCLUDED"}</span>
                    <div 
                      className={cn(
                        "w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center",
                        includeWeakTopics ? "bg-amber-500" : "bg-zinc-800"
                      )}
                    >
                      <motion.div 
                        layout 
                        className="w-4 h-4 rounded-full bg-black shadow-md"
                        animate={{ x: includeWeakTopics ? 16 : 0 }}
                      />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {includeWeakTopics && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-2 pt-2 border-t border-zinc-900"
                    >
                      <p className="text-[10px] text-zinc-400 font-mono uppercase text-left">
                        The AI interviewer will seamlessly weave the following topics into today's scenario:
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {weakTopics.slice(0, 3).map((topic) => (
                          <span key={topic} className="text-[9px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex items-center gap-4 mt-8">
               <button onClick={() => setSetupStep(4)} className="text-zinc-600 hover:text-zinc-400 font-mono text-[10px] tracking-widest uppercase transition-colors">← Back</button>
               <button onClick={() => setSetupStep(6)} className="relative overflow-hidden group/btn flex items-center gap-4 text-xs font-mono tracking-widest text-white uppercase py-2 px-4 border-b border-zinc-800 hover:border-white bg-transparent transition-colors duration-300">
                 <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                 <span className="relative z-10 transition-all group-hover/btn:text-indigo-950 group-hover/btn:font-bold">CONTINUE</span>
               </button>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            <DiagnosticsCamera key={cameraRetryKey} onStatus={(status) => setVideoStatus(status)} />
            <div className="flex flex-col justify-center gap-6">
              <h2 className="text-2xl font-light text-white mb-2 uppercase tracking-widest">Diagnostics</h2>
              <div className="space-y-4">
                 <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                   <div className="flex items-center gap-3"><Monitor className="w-4 h-4 text-zinc-500" /><span className="font-mono text-xs text-zinc-400 uppercase tracking-widest">System Link</span></div>
                   <div className="flex items-center gap-2">
                     <span className={cn(
                       "text-xs font-bold font-mono tracking-widest",
                       systemLinkStatus === 'SECURE' && "text-green-500",
                       systemLinkStatus === 'CHECKING' && "text-yellow-500 animate-pulse",
                       systemLinkStatus === 'OFFLINE' && "text-red-500"
                     )}>{systemLinkStatus === 'CHECKING' ? 'CHECKING...' : systemLinkStatus}</span>
                     {systemLinkStatus === 'OFFLINE' && (
                       <button onClick={retrySystemCheck} className="text-[9px] font-mono text-zinc-400 hover:text-white uppercase border border-zinc-800 px-1.5 py-0.5 rounded transition-colors bg-transparent">Retry</button>
                     )}
                   </div>
                 </div>
                 <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                   <div className="flex items-center gap-3"><Camera className="w-4 h-4 text-zinc-500" /><span className="font-mono text-xs text-zinc-400 uppercase tracking-widest">Video Node</span></div>
                   <div className="flex items-center gap-2">
                     <span className={cn(
                       "text-xs font-bold font-mono tracking-widest",
                       videoStatus === 'OK' && "text-green-500",
                       videoStatus === 'CHECKING' && "text-yellow-500 animate-pulse",
                       videoStatus === 'ERROR' && "text-red-500"
                     )}>{videoStatus === 'CHECKING' ? 'CHECKING...' : videoStatus}</span>
                     {videoStatus === 'ERROR' && (
                       <button onClick={retryVideoCheck} className="text-[9px] font-mono text-zinc-400 hover:text-white uppercase border border-zinc-800 px-1.5 py-0.5 rounded transition-colors bg-transparent">Retry</button>
                     )}
                   </div>
                 </div>
                 <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                   <div className="flex items-center gap-3"><Mic className="w-4 h-4 text-zinc-500" /><span className="font-mono text-xs text-zinc-400 uppercase tracking-widest">Audio Node</span></div>
                   <div className="flex items-center gap-2">
                     <span className={cn(
                       "text-xs font-bold font-mono tracking-widest",
                       audioStatus === 'OK' && "text-green-500",
                       audioStatus === 'CHECKING' && "text-yellow-500 animate-pulse",
                       audioStatus === 'ERROR' && "text-red-500"
                     )}>{audioStatus === 'CHECKING' ? 'CHECKING...' : audioStatus}</span>
                     {audioStatus === 'ERROR' && (
                       <button onClick={retryAudioCheck} className="text-[9px] font-mono text-zinc-400 hover:text-white uppercase border border-zinc-800 px-1.5 py-0.5 rounded transition-colors bg-transparent">Retry</button>
                     )}
                   </div>
                 </div>
                 <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                   <div className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-zinc-500" /><span className="font-mono text-xs text-zinc-400 uppercase tracking-widest">Engine State</span></div>
                   <span className={cn(
                     "text-xs font-bold font-mono tracking-widest",
                     engineStateStatus === 'READY' && "text-green-500",
                     engineStateStatus === 'CHECKING' && "text-yellow-500 animate-pulse",
                     engineStateStatus === 'ERROR' && "text-red-500"
                   )}>{engineStateStatus === 'CHECKING' ? 'CHECKING...' : engineStateStatus}</span>
                 </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                 <button onClick={() => setSetupStep(5)} className="text-zinc-600 hover:text-zinc-400 font-mono text-[10px] tracking-widest uppercase transition-colors">← Back</button>
                 <button 
                   onClick={() => { if (engineStateStatus === 'READY') startInterview(); }} 
                   disabled={engineStateStatus !== 'READY'}
                   className={cn(
                     "relative overflow-hidden group/btn flex items-center gap-4 text-xs font-mono tracking-widest uppercase py-2 px-4 border-b transition-all duration-300 bg-transparent",
                     engineStateStatus === 'READY' 
                       ? "text-white border-zinc-800 hover:border-white cursor-pointer" 
                       : "text-zinc-600 border-zinc-900 opacity-50 cursor-not-allowed"
                   )}
                 >
                   <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                   <span className="relative z-10 transition-all group-hover/btn:text-indigo-950 group-hover/btn:font-bold">INITIALIZE_ENGINE</span>
                   <span className="relative z-10 transition-all group-hover/btn:text-indigo-950 group-hover/btn:translate-x-1 text-zinc-500">→</span>
                 </button>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#030303] group text-zinc-50 overflow-hidden font-sans select-none p-0">
      
      {/* 2. The Unified Atmosphere (Depth Layers) */}
      <div className="noise-bg" />
      <div className="absolute top-1/2 left-1/4 w-[1100px] h-[250px] bg-blue-600/10 rounded-full blur-[140px] rotate-[-8deg] mix-blend-screen animate-light-drift z-0 pointer-events-none" />
      <div className="absolute top-[40%] left-1/3 w-[800px] h-[180px] bg-indigo-500/10 rounded-full blur-[120px] rotate-[-15deg] mix-blend-screen z-0 pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-zinc-800/10 rounded-full blur-[160px] z-0 pointer-events-none" />

      {/* 4. Interactive Column Divider Laser Lines */}
      <div className="absolute top-0 bottom-0 left-1/3 w-[1px] bg-zinc-900/30 hidden lg:block overflow-hidden z-20 pointer-events-none">
        <div className="absolute left-0 w-full h-[180px] bg-gradient-to-b from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 animate-laser transition-opacity duration-500" />
      </div>
      <div className="absolute top-0 bottom-0 left-2/3 w-[1px] bg-zinc-900/30 hidden lg:block overflow-hidden z-20 pointer-events-none">
        <div className="absolute left-0 w-full h-[180px] bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 animate-laser transition-opacity duration-500 [animation-delay:0.75s]" />
      </div>

      {/* Initialization Overlay */}
      <AnimatePresence>
        {isInitializing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-[#030303]/80 backdrop-blur-xl flex flex-col items-center justify-center gap-6"
          >
            <div className="relative w-20 h-20">
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                 className="absolute inset-0 border-4 border-blue-500/20 border-t-blue-500 rounded-full"
               />
               <motion.div 
                 animate={{ rotate: -360 }}
                 transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                 className="absolute inset-2 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"
               />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-widest font-mono">Initializing Session</h2>
              <p className="text-zinc-500 text-sm animate-pulse font-mono uppercase tracking-widest">Setting up {config.type} environment...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Top Navigation Meta Row */}
      <header className="flex-none h-16 border-b border-white/5 z-30 w-full grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-6 px-8 lg:px-0 items-center font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
        <div className="lg:pl-16 flex items-center">
          [ {view === 'live' ? 'SESSION_ACTIVE' : view === 'report' ? 'ANALYSIS_COMPLETE' : 'CORE_ENGINE_ACTIVE'} ]
        </div>
        <div className="lg:pl-12 hidden lg:flex items-center">
          <a href="/" onClick={(e) => { e.preventDefault(); resetSession(); window.location.href = '/'; }} className="hover:text-white transition-colors">
            Interview<span className="font-serif italic text-transparent bg-clip-text bg-gradient-to-br from-zinc-200 to-zinc-400 font-normal ml-0.5">OS</span>
          </a>
        </div>
        <div className="lg:pl-12 lg:pr-16 flex items-center lg:justify-end">
          {view === 'setup' ? (
             <span className="font-serif italic text-transparent bg-clip-text bg-gradient-to-br from-zinc-200 to-zinc-400 font-normal text-[10px]">
               [STEP {setupStep} / 6]
             </span>
          ) : view === 'live' ? `TIME_ELAPSED // ${seconds}s` : `BETA V1.2.0 — STABLE`}
        </div>
      </header>

      {/* 3. Center Main Matrix */}
      <main className="flex-1 overflow-y-auto custom-scrollbar min-h-0 z-30 w-full flex flex-col">
        {view === 'setup' ? (
          <div className="flex-1 flex flex-col justify-center items-center w-full h-full py-8 px-6 md:px-12 lg:px-24">
             <div className="w-full max-w-6xl min-h-[580px] bg-zinc-950/20 border border-zinc-900/60 rounded-3xl p-8 md:p-12 lg:p-16 backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px]" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px]" />
                
                <div className="relative z-10 flex-1 flex flex-col justify-center">
                   {targetedTopic && (
                     <div className="mb-6 border border-blue-500/25 bg-blue-500/5 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-mono tracking-wider text-blue-400">
                       <span className="flex items-center gap-2">
                         <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping shrink-0" />
                         [ TARGETED_PRACTICE_NODE: {targetedTopic.toUpperCase()} ]
                       </span>
                       <button 
                         onClick={() => { setTargetedTopic(null); updateConfig({ skills: [] }); setSetupStep(1); }} 
                         className="text-zinc-500 hover:text-white transition-colors text-[10px]"
                       >
                         CLEAR_TARGET
                       </button>
                     </div>
                   )}
                   <AnimatePresence mode="wait">
                     <motion.div className="w-full" key={setupStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                       {renderSetupFlow()}
                     </motion.div>
                   </AnimatePresence>
                </div>
             </div>
          </div>
        ) : (
          <div className={cn("flex-1 min-h-0 w-full grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-6 py-6", view === 'landing' ? "max-w-7xl mx-auto px-8 lg:px-16 items-center" : "px-8 lg:px-0 items-stretch")}>
          
          {view === 'landing' && (
            <>
              <div className="lg:col-span-2 h-full flex flex-col justify-center">
                 <h1 className="text-6xl md:text-8xl lg:text-9xl font-light text-white tracking-tight leading-none uppercase mb-6">
                   Master<br />Your Next<br />Interview
                 </h1>
              </div>
              <div className="flex flex-col justify-center items-start border-t border-zinc-900 lg:border-t-0 pt-8 lg:pt-0 lg:pl-12">
                 {/* 5. Signature Primary Triggers */}
                 <button onClick={() => setView('setup')} className="relative overflow-hidden group/btn flex items-center gap-4 text-xs font-mono tracking-widest text-white uppercase py-2 px-4 border-b border-zinc-800 hover:border-white bg-transparent transition-colors duration-300">
                   <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                   <span className="relative z-10 transition-all group-hover/btn:text-indigo-950 group-hover/btn:font-bold">SETUP_SESSION</span>
                   <span className="relative z-10 transition-all group-hover/btn:text-indigo-950 group-hover/btn:translate-x-1 text-zinc-500">→</span>
                 </button>
              </div>
            </>
          )}

          {view === 'report' && (
            <div className="lg:col-span-3 lg:px-16 h-full overflow-y-auto pb-12 pt-6">
               <ReportView />
            </div>
          )}

        {view === 'live' && (
          <>
            <div className="lg:pl-16 h-full flex flex-col min-h-0 independent-scroll">
               <InterviewSidebar isListening={isListening} onToggleListen={toggleListen} seconds={seconds} />
            </div>

            <div className="lg:col-span-2 lg:pl-12 lg:pr-16 h-full flex flex-col min-h-0 gap-6 overflow-hidden">
               <div className="flex-1 bg-black/40 border border-zinc-800/50 rounded-2xl flex flex-col relative overflow-hidden backdrop-blur-md shadow-2xl">
                 {config.type === 'gd' ? (
                   <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 min-h-0 bg-black/10">
                         <GdGrid gdTopic={gdTopic} />
                      </div>
                      <div className="h-64 border-t border-zinc-800/50 bg-zinc-950/80">
                         <TranscriptArea messages={messages} revealedAiStream={revealedAiStream} currentAiStream={currentAiStream} />
                      </div>
                   </div>
                 ) : (config.type === 'technical' || config.type === 'mixed') && showCodeEditor ? (
                   <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-full w-full">
                     <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                       <CodeEditor />
                     </div>
                     <div className="w-full lg:w-[40%] flex flex-col bg-zinc-950/80 border-t lg:border-t-0 lg:border-l border-zinc-800/50 overflow-hidden">
                        <div className="p-4 border-b border-zinc-800/50">
                          <AiAvatar isAiSpeaking={isAiSpeaking} phase={config.type === 'technical' ? "Technical Deep-Dive" : "Mixed Assessment Challenge"} />
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto max-h-[calc(100vh-160px)] custom-scrollbar">
                           <TranscriptArea messages={messages} revealedAiStream={revealedAiStream} currentAiStream={currentAiStream} />
                        </div>
                     </div>
                   </div>
                 ) : (
                   <div className="flex-1 flex flex-col overflow-hidden h-full w-full">
                     <div className="p-4 border-b border-zinc-800/50 shrink-0">
                       <AiAvatar isAiSpeaking={isAiSpeaking} phase="Interview Active" />
                     </div>
                     <div className="flex-1 min-h-0 bg-zinc-950/80 overflow-y-auto max-h-[calc(100vh-160px)] custom-scrollbar">
                        <TranscriptArea messages={messages} revealedAiStream={revealedAiStream} currentAiStream={currentAiStream} />
                     </div>
                   </div>
                 )}
               </div>
            </div>
          </>
        )}
        </div>
        )}
      </main>

      {/* 3. Bottom Footer Metadata */}
      <footer className="flex-none h-20 border-t border-white/5 z-30 w-full grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-6 px-8 lg:px-0 items-center font-mono text-[9px] tracking-wider text-zinc-600 uppercase bg-[#030303]">
        <div className="lg:pl-16">BUILT FOR NEXT-GEN COGNITIVE PRACTICE</div>
        <div className="lg:pl-12 hidden lg:flex items-center">LATENCY_CRITICAL // 2026</div>
        <div className="lg:pl-12 lg:pr-16 flex lg:justify-end">SECURE_SESSION_LOCKED</div>
      </footer>
    </div>
  );
}
