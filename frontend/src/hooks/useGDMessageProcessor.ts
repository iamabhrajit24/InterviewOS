import { useEffect, useRef } from 'react';
import { useInterviewStore } from '@/store/interviewStore';
import { parseGDBlock } from '@/lib/gdSpeakerParser';
import { speakAs, GD_VOICE_PROFILES, resolveVoice } from '@/lib/gdVoiceProfiles';

export function useGDMessageProcessor() {
  const {
    currentAiStream, messages, isAiSpeaking,
    setRevealedAiStream, setIsAiSpeaking,
    setGdActiveSpeaker, gdActiveSpeaker,
    appendGdSpeakerHistory, config,
    addMessageToHistory, finalizeAiStream,
    recorder,
    view
  } = useInterviewStore();

  // Queue of parsed blocks waiting to be spoken
  const blockQueue = useRef<Array<{speaker: string; text: string}>>([]);
  const isProcessing = useRef(false);

  function processQueue() {
    if (isProcessing.current || blockQueue.current.length === 0) return;
    isProcessing.current = true;

    const block = blockQueue.current.shift()!;
    // CRITICAL: capture speaker in local const — closure safety (Rule #4)
    const activeSpeaker = block.speaker;

    setGdActiveSpeaker(activeSpeaker as any);
    setRevealedAiStream('');

    // Append history
    appendGdSpeakerHistory({
      speaker: activeSpeaker,
      timestamp: Date.now(),
      charCount: block.text.length
    });

    let revealed = '';
    const profile = GD_VOICE_PROFILES[activeSpeaker] ?? GD_VOICE_PROFILES['MODERATOR'];
    const voice = resolveVoice(profile.voiceHint);
    const voiceOptions = { pitch: profile.pitch, rate: profile.rate, voice };

    if (recorder) {
      recorder.speakAndRecord(
        block.text,
        voiceOptions,
        (charIndex: number) => {
          revealed = block.text.slice(0, charIndex + 10);
          setRevealedAiStream(`**${activeSpeaker}**: ${revealed}`);
        }
      ).then(() => {
        addMessageToHistory({
          role: 'ai',
          content: `**${activeSpeaker}**: ${block.text}`
        });
        setRevealedAiStream('');
        setGdActiveSpeaker(null);
        isProcessing.current = false;
        
        if (blockQueue.current.length === 0) {
          finalizeAiStream();
        } else {
          setTimeout(processQueue, 380);
        }
      });
    } else {
      speakAs(
        activeSpeaker,
        block.text,
        (charIndex) => {
          revealed = block.text.slice(0, charIndex + 10);
          setRevealedAiStream(`**${activeSpeaker}**: ${revealed}`);
        },
        () => {
          addMessageToHistory({
            role: 'ai',
            content: `**${activeSpeaker}**: ${block.text}`
          });
          setRevealedAiStream('');
          setGdActiveSpeaker(null);
          isProcessing.current = false;
          
          if (blockQueue.current.length === 0) {
            finalizeAiStream();
          } else {
            // Process next block after a brief natural pause
            setTimeout(processQueue, 380);
          }
        }
      );
    }
    setIsAiSpeaking(true);
  }

  // When a new complete AI message arrives, parse it into speaker blocks
  useEffect(() => {
    if (config.type !== 'gd') return;
    if (!currentAiStream || !isAiSpeaking || isProcessing.current) return;

    // Split on double-newline — each block = one speaker turn
    const rawBlocks = currentAiStream.split(/\n{2,}/);
    rawBlocks.forEach(raw => {
      if (!raw.trim()) return;
      const parsed = parseGDBlock(raw);
      // Only queue if has actual text content
      if (parsed.text.length > 2) {
        blockQueue.current.push(parsed);
      }
    });

    processQueue();
  }, [currentAiStream, isAiSpeaking]);

  // Halt all background queues and cancel active speaking when session is ended or AI stops speaking / is interrupted
  useEffect(() => {
    if (view !== 'live' || !isAiSpeaking) {
      blockQueue.current = [];
      isProcessing.current = false;
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
    }
  }, [view, isAiSpeaking]);
}
