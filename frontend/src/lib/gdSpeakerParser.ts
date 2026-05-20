export type GDSpeaker = 'MODERATOR' | 'Sarah' | 'James' | 'Priya' | 'David' | 'USER';

export interface ParsedGDBlock {
  speaker: GDSpeaker;
  text: string;
}

// Matches: "**Sarah:**", "[Sarah]:", "SARAH:", "Sarah says:"
const SPEAKER_REGEX =
  /^(?:\*{1,2})?(?:\[)?(MODERATOR|Sarah|James|Priya|David)(?:\])?(?:\*{1,2})?[\s:：]+/i;

export function parseGDBlock(raw: string): ParsedGDBlock {
  const trimmed = raw.trim();
  const match = trimmed.match(SPEAKER_REGEX);
  if (match) {
    const speaker = (
      match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
    ) as GDSpeaker;
    // Normalize MODERATOR
    const normalized = speaker === ('Moderator' as GDSpeaker)
      ? 'MODERATOR'
      : speaker;
    return {
      speaker: normalized as GDSpeaker,
      text: trimmed.slice(match[0].length).trim(),
    };
  }
  return { speaker: 'MODERATOR', text: trimmed }; // default fallback
}
