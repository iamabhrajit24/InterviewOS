export class MixedAudioRecorder {
  private audioCtx: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;

  /**
   * Initialize: connect mic stream to the mixing destination.
   * Call this when the interview starts.
   */
  async init(micStream: MediaStream): Promise<void> {
    this.micStream = micStream;
    this.audioCtx = new AudioContext({ sampleRate: 16000 }); // 16kHz = efficient
    this.destination = this.audioCtx.createMediaStreamDestination();

    // Connect mic
    this.micSource = this.audioCtx.createMediaStreamSource(micStream);
    const micGain = this.audioCtx.createGain();
    micGain.gain.value = 1.0;
    this.micSource.connect(micGain);
    micGain.connect(this.destination);

    // MediaRecorder on the mixed stream
    const options = this.getBestMimeType();
    this.mediaRecorder = new MediaRecorder(this.destination.stream, options);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
  }

  async playAndRecordGoogleTTS(text: string, onBoundary: (charIndex: number) => void): Promise<void> {
    const audioCtx = this.audioCtx;
    const destination = this.destination;
    if (!audioCtx || !destination) throw new Error("Recorder not initialized");

    // Split text into chunks of max 180 characters (Google TTS limit is 200)
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
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

    // Fetch and decode all audio buffers
    const buffers: AudioBuffer[] = [];
    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("TTS fetch failed");
      const arrayBuffer = await response.arrayBuffer();
      // Decode audio data
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      buffers.push(audioBuffer);
    }

    // Play buffers sequentially
    let startTime = audioCtx.currentTime;
    
    return new Promise((resolve) => {
      let completed = 0;
      
      buffers.forEach((buffer, idx) => {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.9;
        
        source.connect(gainNode);
        gainNode.connect(destination);
        gainNode.connect(audioCtx.destination);
        
        source.start(startTime);
        
        source.onended = () => {
          completed++;
          if (completed === buffers.length) {
            resolve();
          }
        };
        
        const duration = buffer.duration;
        const charsInChunk = chunks[idx].length;
        const totalCharsPrior = chunks.slice(0, idx).reduce((sum, c) => sum + c.length, 0);
        
        const words = chunks[idx].split(' ');
        let wordStartChar = 0;
        let cumulativeTime = 0;
        
        words.forEach((word) => {
          const wordDuration = (word.length / charsInChunk) * duration;
          const targetCharIndex = totalCharsPrior + wordStartChar;
          
          setTimeout(() => {
            if (audioCtx.state !== 'closed') {
              onBoundary(targetCharIndex);
            }
          }, (startTime - audioCtx.currentTime + cumulativeTime) * 1000);
          
          cumulativeTime += wordDuration;
          wordStartChar += word.length + 1;
        });

        startTime += duration + 0.1; // 100ms pause between chunks
      });
    });
  }

  async speakAndRecord(
    text: string,
    voiceOptions: { pitch: number; rate: number; voice: SpeechSynthesisVoice | null },
    onBoundary: (charIndex: number) => void
  ): Promise<void> {
    // Note: playAndRecordGoogleTTS is bypassed because Google Translate TTS blocks direct local frontend requests (CORS).
    // Bypassing directly to local SpeechSynthesis gives us INSTANT, zero-latency, high-reliability offline speech synthesis!
    
    // Reset cancellation flag
    if (typeof window !== 'undefined') {
      (window as any).__speechCancelled = false;
      window.speechSynthesis.cancel();
    }

    const audioCtx = this.audioCtx;
    const destination = this.destination;

    let osc: OscillatorNode | null = null;
    let oscGain: GainNode | null = null;
    if (audioCtx && destination) {
      try {
        osc = audioCtx.createOscillator();
        oscGain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        
        osc.connect(oscGain);
        oscGain.connect(destination);
        osc.start();
      } catch (err) {
        console.error("Error creating record oscillator:", err);
      }
    }

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

    return new Promise(async (resolve) => {
      let isDone = false;
      const cleanup = () => {
        if (isDone) return;
        isDone = true;
        if (osc) {
          try { osc.stop(); } catch (err) {}
        }
      };

      let cumulativeChars = 0;

      for (let idx = 0; idx < chunks.length; idx++) {
        // Interruption checks
        if (isDone || (typeof window !== 'undefined' && (window as any).__speechCancelled === true)) {
          break;
        }

        const chunk = chunks[idx];
        await new Promise<void>((resolveChunk) => {
          const utterance = new SpeechSynthesisUtterance(chunk);
          utterance.pitch = voiceOptions.pitch;
          utterance.rate = voiceOptions.rate;
          if (voiceOptions.voice) utterance.voice = voiceOptions.voice;

          // Safety watchdog per chunk: resolve after estimated speech duration + 3s grace
          const chunkWatchdog = setTimeout(() => {
            console.warn("Chunk watchdog triggered.");
            resolveChunk();
          }, Math.max(3000, chunk.length * 80));

          // Ultra-smooth backup timer-based word typewriter
          const words = chunk.split(' ');
          let wordIdx = 0;
          let timer: any = null;

          utterance.onstart = () => {
            if ((window as any).__speechCancelled === true) return;
            const rateMultiplier = voiceOptions.rate || 1.0;
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
            if (e.name === 'word') {
              onBoundary(cumulativeChars + e.charIndex);
            }
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

      cleanup();
      resolve();
    });
  }

  /**
   * Inject AI speech as a MediaStream from an AudioBuffer.
   * Use this if you convert TTS to audio via a server-side TTS (e.g. ElevenLabs).
   * For browser speechSynthesis, use speakAndRecord() above.
   */
  injectAudioBuffer(buffer: AudioBuffer): void {
    if (!this.audioCtx || !this.destination) return;
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = this.audioCtx.createGain();
    gain.gain.value = 0.85; // slightly lower than mic
    source.connect(gain);
    gain.connect(this.destination);
    source.start();
  }

  start(): void {
    if (this.mediaRecorder?.state === 'inactive') {
      this.chunks = [];
      this.mediaRecorder.start(1000); // collect chunks every 1s
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob([]));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType ?? 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        
        // Stop all microphone stream tracks to cleanly turn off laptop microphone recording indicator!
        if (this.micStream) {
          this.micStream.getTracks().forEach(t => t.stop());
          this.micStream = null;
        }

        // Close AudioContext only after MediaRecorder has completely stopped and flushed all final chunks!
        if (this.audioCtx && this.audioCtx.state !== 'closed') {
          this.audioCtx.close().catch(() => {});
        }
        
        resolve(blob);
      };
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    });
  }

  private getBestMimeType(): MediaRecorderOptions {
    // Prefer opus/webm — best compression for speech
    const preferred = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of preferred) {
      if (MediaRecorder.isTypeSupported(type)) {
        return { mimeType: type, audioBitsPerSecond: 32000 }; // 32kbps = efficient
      }
    }
    return { audioBitsPerSecond: 32000 }; // browser default
  }
}
