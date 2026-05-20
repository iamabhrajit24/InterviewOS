export interface VoiceProfile {
  name: string;
  pitch: number;
  rate: number;
  style: string;
  gender: 'male' | 'female' | 'neutral';
  preferredVoices: string[];
}

export const GD_VOICE_PROFILES: Record<string, VoiceProfile> = {
  MODERATOR: {
    name: 'Moderator',
    pitch: 1.0,
    rate: 0.95,
    style: 'Professional corporate neutral voice',
    gender: 'neutral',
    preferredVoices: ['Google UK English Female', 'Microsoft Zira Desktop', 'Google US English']
  },
  SARAH: {
    name: 'Sarah',
    pitch: 1.1,
    rate: 1.05,
    style: 'UK Female Voice',
    gender: 'female',
    preferredVoices: ['Google UK English Female', 'Microsoft Susan', 'Google US English']
  },
  JAMES: {
    name: 'James',
    pitch: 0.8,
    rate: 0.9,
    style: 'Deep US Male Voice',
    gender: 'male',
    preferredVoices: ['Google US English', 'Microsoft David Desktop', 'Google UK English Male']
  },
  PRIYA: {
    name: 'Priya',
    pitch: 1.15,
    rate: 1.0,
    style: 'Indian Female Analytical Voice',
    gender: 'female',
    preferredVoices: ['Google India English Female', 'Microsoft Heera', 'Google UK English Female']
  },
  DAVID: {
    name: 'David',
    pitch: 0.9,
    rate: 0.95,
    style: 'Calm Practical Male Voice',
    gender: 'male',
    preferredVoices: ['Google UK English Male', 'Microsoft George', 'Microsoft David Desktop']
  },
  AI: {
    name: 'AI',
    pitch: 1.0,
    rate: 1.0,
    style: 'Professional Technical Voice',
    gender: 'neutral',
    preferredVoices: ['Google US English', 'Microsoft Zira Desktop', 'Google UK English Female']
  }
};

// NEW HELPER: Dynamically match speaker names from the AI text stream to a profile object
export function getProfileByName(speakerName: string): VoiceProfile {
  const normalized = speakerName.toUpperCase().trim();
  if (normalized.includes('MODERATOR')) return GD_VOICE_PROFILES.MODERATOR;
  if (normalized.includes('SARAH')) return GD_VOICE_PROFILES.SARAH;
  if (normalized.includes('JAMES')) return GD_VOICE_PROFILES.JAMES;
  if (normalized.includes('PRIYA')) return GD_VOICE_PROFILES.PRIYA;
  if (normalized.includes('DAVID')) return GD_VOICE_PROFILES.DAVID;
  return GD_VOICE_PROFILES.AI; // Fallback profile
}

export function getVoiceForProfile(profile: VoiceProfile, availableVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const candidate of profile.preferredVoices) {
    const match = availableVoices.find(v => v.name.includes(candidate) || v.lang.includes(candidate));
    if (match) return match;
  }
  return availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0] || null;
}