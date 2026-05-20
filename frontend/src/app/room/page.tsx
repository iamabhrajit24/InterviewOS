'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, Settings, Users, MessageSquare, Play, HelpCircle, Loader2, Volume2, ShieldAlert } from 'lucide-react';
import Navbar from '@/components/ui/Navbar';
import { useToast } from '@/components/ui/Toast';
import { io, Socket } from 'socket.io-client';

export default function CollabRoomPage() {
  const [roomId, setRoomId] = useState('demo-room-101');
  const [role, setRole] = useState<'Interviewer' | 'Candidate'>('Candidate');
  const [joined, setJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<'lobby' | 'session'>('lobby');
  
  // Device toggle status
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);

  // Diagnostic states
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [micActive, setMicActive] = useState(false);

  // WebRTC States
  const [hasRoomWebcam, setHasRoomWebcam] = useState(false);
  const [peerRole, setPeerRole] = useState<string | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [customTopic, setCustomTopic] = useState('System Design Tradeoffs');

  // HTML Element Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Connection Instances
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { toast } = useToast();

  // 1. Run Mic & Audio Diagnostics (Real-time Volume Meter using Web Audio API!)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('user');
      if (!u) {
        window.location.href = '/login?redirect=' + window.location.pathname;
        return;
      }
    }

    let stream: MediaStream | null = null;
    
    const initMicCheck = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicActive(true);

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setVolumeLevel(Math.min(100, Math.round((average / 128) * 100)));
          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      } catch (err) {
        console.error('Audio Diagnostic failed:', err);
        setMicActive(false);
      }
    };

    initMicCheck();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 2. Initialize and join signaling session room
  const handleJoinRoom = async () => {
    try {
      let userStream: MediaStream;
      let camOk = false;
      try {
        // Attempt full access first
        userStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        camOk = true;
      } catch (err: any) {
        console.warn("Full audio+video getUserMedia failed in room lobby, trying audio-only fallback...", err);
        // Fallback to audio-only
        userStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
        camOk = false;
        toast("Webcam source locked/unavailable. Standby fallback visualizer active.", "info");
      }

      setHasRoomWebcam(camOk);
      localStreamRef.current = userStream;
      
      if (localVideoRef.current && camOk) {
        localVideoRef.current.srcObject = userStream;
      }

      // Connect to Socket.io Signaling Server (Namespace /room)
      const socket = io('http://localhost:8080/room');
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Collab] Connected to signaling gateway');
        socket.emit('join-room', { roomId, role });
      });

      socket.on('room-joined', ({ users }: { users: any[] }) => {
        toast(`Joined room ${roomId} successfully!`, 'success');
        setJoined(true);
        setActiveTab('session');
        
        // Find existing peer
        const other = users.find((u: any) => u.socketId !== socket.id);
        if (other) {
          setPeerRole(other.role);
          setPeerConnected(true);
          initiateWebRTCCall();
        }
      });

      socket.on('peer-connected', ({ role: otherRole }: { role: string }) => {
        toast(`A new ${otherRole} has entered the room!`, 'info');
        setPeerRole(otherRole);
        setPeerConnected(true);
        initiateWebRTCCall();
      });

      socket.on('suggested-question', ({ question }: { question: string }) => {
        setSuggestedQuestion(question);
        setLoadingQuestion(false);
        toast('New AI Suggested question distributed to the room!', 'bell');
      });

      socket.on('offer', async ({ sdp, peerId }: { sdp: any; peerId: string }) => {
        await handleOffer(sdp);
      });

      socket.on('answer', async ({ sdp }: { sdp: any }) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      });

      socket.on('ice-candidate', async ({ candidate }: { candidate: any }) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socket.on('peer-disconnected', () => {
        toast('The other participant has left the simulation room.', 'error');
        setPeerConnected(false);
        setPeerRole(null);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

    } catch (err: any) {
      toast(`Could not access devices: ${err.message}`, 'error');
    }
  };

  // 3. WebRTC Peer Connection Handlers
  const initiateWebRTCCall = async () => {
    if (!localStreamRef.current || !socketRef.current) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;

    // Push local tracks to peer
    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', { candidate: event.candidate, roomId });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit('offer', { sdp: offer, roomId });
  };

  const handleOffer = async (sdp: RTCSessionDescriptionInit) => {
    if (!localStreamRef.current || !socketRef.current) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', { candidate: event.candidate, roomId });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit('answer', { sdp: answer, roomId });
  };

  // 4. Request dynamic AI suggested question
  const requestAISuggestion = () => {
    if (!socketRef.current) return;
    setLoadingQuestion(true);
    socketRef.current.emit('suggest-question', { roomId, topic: customTopic });
  };

  // 5. Cleanup connections on leave
  const handleLeaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomId });
      socketRef.current.disconnect();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setJoined(false);
    setActiveTab('lobby');
    setPeerConnected(false);
    setSuggestedQuestion(null);
    toast('Left collaborative mock room.', 'info');
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setVideoOn(track.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setAudioOn(track.enabled);
      }
    }
  };

  return (
    <main className="min-h-screen bg-[#030303] text-zinc-50 relative overflow-hidden font-sans pb-16">
      <div className="noise-bg" />
      
      {/* Background atmosphere radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none z-0" />

      <Navbar />

      <div className="z-10 relative max-w-5xl mx-auto px-6 pt-12 space-y-8">
        
        {/* Lobby State Selection Render */}
        {activeTab === 'lobby' ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Lobby form */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden space-y-5">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ PEER_ROOM_LOBBY ]</span>
                <h2 className="text-xl font-light text-white tracking-tight uppercase">Enter Mock Room</h2>

                <div className="space-y-4">
                  {/* Room ID field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Room ID</label>
                    <input
                      type="text"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-200"
                    />
                  </div>

                  {/* Role Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Select Role</label>
                    <div className="grid grid-cols-2 gap-3 font-mono text-[10px] uppercase">
                      <button
                        onClick={() => setRole('Candidate')}
                        className={`py-3 px-4 rounded-xl border transition-colors ${
                          role === 'Candidate'
                            ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                            : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Candidate
                      </button>
                      <button
                        onClick={() => setRole('Interviewer')}
                        className={`py-3 px-4 rounded-xl border transition-colors ${
                          role === 'Interviewer'
                            ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                            : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Interviewer
                      </button>
                    </div>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={handleJoinRoom}
                    className="w-full relative overflow-hidden group/btn flex items-center justify-center gap-4 text-xs font-mono tracking-widest text-white uppercase py-4 rounded-xl border border-zinc-800 hover:border-white bg-transparent transition-colors duration-300"
                  >
                    <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                    <span className="relative z-10 flex items-center gap-2 group-hover/btn:text-indigo-950 group-hover/btn:font-bold">
                      INITIALIZE_CALL
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mic diagnostic check */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden space-y-6">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ HARDWARE_STABILITY_SCANNER ]</span>
                <h2 className="text-xl font-light text-white tracking-tight uppercase">Mic diagnostic Check</h2>

                {micActive ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">Microphone Input Signal:</span>
                      <span className="text-indigo-400 font-bold">{volumeLevel}% volume</span>
                    </div>

                    {/* Volume progress meter */}
                    <div className="w-full h-4 bg-zinc-950 border border-zinc-850 rounded-full overflow-hidden relative p-[2px]">
                      <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full"
                        animate={{ width: `${volumeLevel}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    </div>

                    <p className="text-[10px] text-zinc-500 leading-relaxed font-mono uppercase">
                      Ensure your sound is clear, and the latency counter shows green highlights!
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-950/10 border border-rose-900/30 rounded-xl flex gap-3 text-xs text-rose-300 font-mono">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="font-bold">Microphone Signal Offline</p>
                      <p className="text-rose-400/80 mt-1">Please enable audio capture permissions in your browser bar.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Active Call State Render */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Main Video Stream Container (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Webcam Video feeds grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Local feed */}
                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden aspect-video relative shadow-inner flex items-center justify-center">
                  {hasRoomWebcam ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30 animate-pulse mx-auto mb-2">
                        <Mic className="w-4 h-4 text-indigo-400" />
                      </div>
                      <span className="text-[9px] font-mono tracking-widest text-zinc-550 uppercase">[ STANDBY FALLBACK ACTIVE ]</span>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md border border-zinc-800 rounded-lg py-1.5 px-3 text-[10px] font-mono uppercase tracking-wider text-zinc-300">
                    {role} (You)
                  </div>
                </div>

                {/* Remote feed */}
                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden aspect-video relative shadow-inner flex items-center justify-center">
                  {peerConnected ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center font-mono text-xs text-zinc-600 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-500" />
                      <span>[ WAITING_FOR_PEER_CONNECTION ]</span>
                    </div>
                  )}
                  {peerConnected && (
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md border border-zinc-800 rounded-lg py-1.5 px-3 text-[10px] font-mono uppercase tracking-wider text-zinc-300">
                      {peerRole} (Remote Peer)
                    </div>
                  )}
                </div>

              </div>

              {/* Hardware Toggles & Action bar */}
              <div className="flex justify-between items-center bg-zinc-900/30 border border-zinc-800 p-4 rounded-xl">
                <div className="flex gap-3">
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-xl border transition-colors ${
                      videoOn 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-300' 
                        : 'bg-rose-950/20 border-rose-900/40 text-rose-400'
                    }`}
                  >
                    {videoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleAudio}
                    className={`p-3 rounded-xl border transition-colors ${
                      audioOn 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-300' 
                        : 'bg-rose-950/20 border-rose-900/40 text-rose-400'
                    }`}
                  >
                    {audioOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={handleLeaveRoom}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono tracking-widest uppercase py-3 px-6 rounded-xl transition-colors"
                >
                  DISCONNECT_CALL
                </button>
              </div>

            </div>

            {/* AI Suggested Question Panel (1/3 width) */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden space-y-6 flex flex-col justify-between h-full min-h-[350px]">
                <div className="space-y-4">
                  <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ COGNITIVE_MOCK_PANEL ]</span>
                  <h2 className="text-xl font-light text-white tracking-tight uppercase">AI Mock Prompts</h2>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Target debate topic</label>
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-300"
                    />
                  </div>

                  {/* Suggestion Card Display */}
                  {suggestedQuestion && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-indigo-950/15 border border-indigo-900/40 rounded-xl space-y-2 mt-4"
                    >
                      <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" /> AI Suggestion
                      </span>
                      <p className="text-xs text-zinc-200 leading-relaxed font-mono">{suggestedQuestion}</p>
                    </motion.div>
                  )}
                </div>

                <button
                  onClick={requestAISuggestion}
                  disabled={loadingQuestion}
                  className="w-full relative overflow-hidden group/btn flex items-center justify-center gap-4 text-xs font-mono tracking-widest text-white uppercase py-4 rounded-xl border border-zinc-800 hover:border-white bg-transparent transition-colors duration-300 disabled:opacity-40"
                >
                  {loadingQuestion ? (
                    <span className="relative z-10 flex items-center gap-2 text-indigo-950">
                      <Loader2 className="w-4 h-4 animate-spin" /> GENERATING...
                    </span>
                  ) : (
                    <>
                      <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                      <span className="relative z-10 flex items-center gap-2 group-hover/btn:text-indigo-950 group-hover/btn:font-bold">
                        SUGGEST_MOCK_QUESTION
                      </span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </motion.div>
        )}

      </div>
    </main>
  );
}
