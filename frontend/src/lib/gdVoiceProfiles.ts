export interface VoiceProfile {
  pitch: number;   // 0.5 – 2.0
  rate: number;    // 0.5 – 2.0
  voiceHint: string; // partial name match for SpeechSynthesisVoice
}

export const GD_VOICE_PROFILES: Record<string, VoiceProfile> = {
  MODERATOR: { pitch: 1.0, rate: 0.92, voiceHint: 'Google UK English Male' },
  Sarah:     { pitch: 1.25, rate: 1.02, voiceHint: 'Google UK English Female' },
  James:     { pitch: 0.85, rate: 0.98, voiceHint: 'Google US English' },
  Priya:     { pitch: 1.15, rate: 1.05, voiceHint: 'Google हिन्दी' },  // fallback to Female
  David:     { pitch: 0.78, rate: 0.95, voiceHint: 'Google US English Male' },
};

export function resolveVoice(hint: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.name.toLowerCase().includes(hint.toLowerCase())) ??
    voices.find(v => v.lang.startsWith('en')) ??
    null
  );
}

export function speakAs(
  speaker: string,
  text: string,
  onBoundary: (charIndex: number) => void,
  onEnd: () => void
): void {
  if (typeof window === 'undefined') {
    onEnd();
    return;
  }

  const profile = GD_VOICE_PROFILES[speaker] ?? GD_VOICE_PROFILES['MODERATOR'];
  const voice = resolveVoice(profile.voiceHint);

  // Reset cancellation flag
  (window as any).__speechCancelled = false;

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

  const playSequentially = async () => {
    let cumulativeChars = 0;
    let isDone = false;

    for (let idx = 0; idx < chunks.length; idx++) {
      if (isDone || (window as any).__speechCancelled === true) {
        break;
      }
      const chunk = chunks[idx];
      await new Promise<void>((resolveChunk) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.pitch = profile.pitch;
        utterance.rate = profile.rate;
        if (voice) utterance.voice = voice;

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
              onBoundary(cumulativeChars + revealedWords.length);
            } else {
              if (timer) clearInterval(timer);
            }
          }, msPerWord);
        };

        utterance.onboundary = (e) => {
          if ((window as any).__speechCancelled === true) {
            if (timer) clearInterval(timer);
            clearTimeout(chunkWatchdog);
            resolveChunk();
            return;
          }
          if (e.name === 'word') onBoundary(cumulativeChars + e.charIndex);
        };
        utterance.onend = () => {
          if (timer) clearInterval(timer);
          onBoundary(cumulativeChars + chunk.length);
          clearTimeout(chunkWatchdog);
          resolveChunk();
        };
        utterance.onerror = () => {
          if (timer) clearInterval(timer);
          clearTimeout(chunkWatchdog);
          resolveChunk();
        };

        window.speechSynthesis.cancel();
        setTimeout(() => {
          if ((window as any).__speechCancelled === true) {
            if (timer) clearInterval(timer);
            clearTimeout(chunkWatchdog);
            resolveChunk();
            return;
          }
          window.speechSynthesis.speak(utterance);
        }, 40);
      });
      cumulativeChars += chunk.length + 1; // plus space
    }
    onEnd();
  };

  playSequentially();
}
