import { create } from 'zustand';

export type InterviewType = 'hr' | 'technical' | 'gd' | 'mixed' | 'mock-company';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface InterviewConfig {
  type: InterviewType;
  role: string;
  experienceLevel: ExperienceLevel;
  skills: string[];
  settings: {
    duration: number;
    webcamEnabled: boolean;
    micEnabled: boolean;
    voiceEnabled: boolean;
    difficulty: string;
  };
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface InterviewState {
  // Navigation
  view: 'landing' | 'setup' | 'live' | 'report';
  setupStep: number;

  // Configuration
  config: InterviewConfig;

  // WebSocket/Live State
  ws: WebSocket | null;
  isConnected: boolean;
  isInitializing: boolean;
  messages: Message[];
  currentAiStream: string; // The network stream (hidden)
  revealedAiStream: string; // The stream shown in the transcript
  isAiSpeaking: boolean;

  // GD-specific
  gdTopic: string;
  gdActiveSpeaker: string | null;
  gdSpeakerQueue: string[];
  gdRoundComplete: boolean;
  gdSpeakerHistory: Array<{speaker: string; timestamp: number; charCount: number}>;

  // Coding & Latency states
  showCodeEditor: boolean;
  submittedCode: string | null;
  recorder: any; // MixedAudioRecorder instance
  elapsedSeconds: number; // Stored elapsed session time

  // Actions
  setView: (view: 'landing' | 'setup' | 'live' | 'report') => void;
  setSetupStep: (step: number) => void;
  updateConfig: (updates: Partial<InterviewConfig>) => void;

  // Socket Actions
  connectWs: () => void;
  disconnectWs: () => void;
  sendMessage: (text: string) => void;
  interruptAi: () => void;
  startInterview: () => void;
  setRevealedAiStream: (text: string) => void;
  setIsAiSpeaking: (speaking: boolean) => void;
  addMessageToHistory: (message: any) => void;
  finalizeAiStream: () => void;
  resetSession: () => void;
  audioBlobUrl: string | null;
  setAudioBlobUrl: (url: string | null) => void;
  setGdActiveSpeaker: (s: string | null) => void;
  setGdSpeakerQueue: (q: string[]) => void;
  setGdRoundComplete: (v: boolean) => void;
  appendGdSpeakerHistory: (entry: {speaker: string; timestamp: number; charCount: number}) => void;
  setShowCodeEditor: (show: boolean) => void;
  setSubmittedCode: (code: string | null) => void;
  setRecorder: (recorder: any) => void;
  setElapsedSeconds: (s: number) => void;
}

export const useInterviewStore = create<InterviewState>((set, get) => ({
  view: 'landing',
  setupStep: 1,

  config: {
    type: 'technical',
    role: '',
    experienceLevel: 'beginner',
    skills: [],
    settings: {
      duration: 30,
      webcamEnabled: true,
      micEnabled: true,
      voiceEnabled: true,
      difficulty: 'medium',
    }
  },

  ws: null,
  isConnected: false,
  isInitializing: false,
  messages: [],
  currentAiStream: '',
  revealedAiStream: '',
  isAiSpeaking: false,
  gdTopic: '',
  gdActiveSpeaker: null,
  gdSpeakerQueue: [],
  gdRoundComplete: false,
  gdSpeakerHistory: [],
  showCodeEditor: false,
  submittedCode: null,
  audioBlobUrl: null,
  recorder: null,
  elapsedSeconds: 0,

  setAudioBlobUrl: (url) => set({ audioBlobUrl: url }),
  setElapsedSeconds: (s) => set({ elapsedSeconds: s }),
  setGdActiveSpeaker: (s) => set({ gdActiveSpeaker: s }),
  setGdSpeakerQueue: (q) => set({ gdSpeakerQueue: q }),
  setGdRoundComplete: (v) => set({ gdRoundComplete: v }),
  appendGdSpeakerHistory: (entry) => set((state) => ({ gdSpeakerHistory: [...state.gdSpeakerHistory, entry] })),
  setShowCodeEditor: (show) => set({ showCodeEditor: show }),
  setSubmittedCode: (code) => set({ submittedCode: code }),
  setView: (view) => set({ view }),
  setSetupStep: (step) => set({ setupStep: step }),
  updateConfig: (updates) => set((state) => ({
    config: { ...state.config, ...updates }
  })),

  connectWs: () => {
    set({ isInitializing: true });
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ isConnected: true, ws, isInitializing: false });
      const { config } = get();
      ws.send(JSON.stringify({ action: 'START_INTERVIEW', config }));
    };

    ws.onclose = () => set({
      isConnected: false,
      ws: null,
      isInitializing: false,
      isAiSpeaking: false,
      currentAiStream: '',
    });

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'session_initialized') {
        set({ isInitializing: false });
        if (data.gd_topic) {
          set({ gdTopic: data.gd_topic });
        }
      } else if (data.type === 'token') {
        set((state) => {
          const newStream = state.currentAiStream + data.content;
          const codingKeywords = ['```', 'write a function', 'write code', 'implement', 'coding challenge', 'solve this problem', 'write a program'];
          const shouldShowEditor = state.showCodeEditor || codingKeywords.some(kw => newStream.toLowerCase().includes(kw));
          
          return {
            currentAiStream: newStream,
            showCodeEditor: shouldShowEditor
          };
        });
      } else if (data.type === 'message_complete') {
        // Network stream complete. AI is now "speaking" what was streamed.
        set((state) => ({
          isAiSpeaking: true,
          revealedAiStream: '',
        }));
      } else if (data.type === 'interrupt_ack') {
        set((state) => ({
          messages: [...state.messages, { role: 'ai', content: state.revealedAiStream + ' [Interrupted]' }],
          currentAiStream: '',
          revealedAiStream: '',
          isAiSpeaking: false,
        }));
      }
    };
  },

  disconnectWs: () => {
    const { ws } = get();
    if (ws) ws.close();
    set({ ws: null, isConnected: false, isAiSpeaking: false, currentAiStream: '', revealedAiStream: '' });
  },

  sendMessage: (text: string) => {
    const { ws, messages } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      set({ messages: [...messages, { role: 'user', content: text }] });
      ws.send(JSON.stringify({ action: 'USER_MESSAGE', text }));
    }
  },

  interruptAi: () => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'INTERRUPT' }));
    }
    // Stop local TTS immediately
    if (typeof window !== 'undefined') {
      (window as any).__speechCancelled = true;
      window.speechSynthesis.cancel();
    }
  },

  startInterview: () => {
    set({ view: 'live', messages: [], currentAiStream: '', revealedAiStream: '', gdTopic: '', showCodeEditor: false, submittedCode: null, elapsedSeconds: 0 });
  },

  setRevealedAiStream: (text: string) => {
    set({ revealedAiStream: text });
  },

  setIsAiSpeaking: (speaking: boolean) => {
    set({ isAiSpeaking: speaking });
  },

  addMessageToHistory: (message: any) => {
    set((state) => ({ messages: [...state.messages, message] }));
  },

  finalizeAiStream: () => {
    set((state) => ({
      // We don't push the whole chunk here anymore if we pushed it in chunks!
      // But for backward compatibility for non-GD we can push if currentAiStream is not empty and not handled
      // Actually we'll handle it entirely inside the speak function.
      currentAiStream: '',
      revealedAiStream: '',
      isAiSpeaking: false,
    }));
  },

  resetSession: () => {
    get().disconnectWs();
    set({
      view: 'landing',
      setupStep: 1,
      messages: [],
      currentAiStream: '',
      revealedAiStream: '',
      isAiSpeaking: false,
      gdTopic: '',
      gdActiveSpeaker: null,
      gdSpeakerQueue: [],
      gdRoundComplete: false,
      gdSpeakerHistory: [],
      showCodeEditor: false,
      submittedCode: null,
      recorder: null,
      elapsedSeconds: 0,
    });
  },

  setRecorder: (recorder: any) => {
    set({ recorder });
  }
}));
