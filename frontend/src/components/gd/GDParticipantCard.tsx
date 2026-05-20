import { motion, AnimatePresence } from 'framer-motion';
import { useInterviewStore } from '@/store/interviewStore';

interface Props {
  speaker: string;
  label: string;
  role: string;
  avatarInitial: string;
  accentColor: string; // e.g. 'sapphire', 'emerald', 'amber', 'rose'
}

const ACCENT_MAP: Record<string, string> = {
  sapphire: 'border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.2)]',
  emerald:  'border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]',
  amber:    'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
  rose:     'border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
  neutral:  'border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]',
};

export function GDParticipantCard({ speaker, label, role, avatarInitial, accentColor }: Props) {
  const { gdActiveSpeaker, revealedAiStream } = useInterviewStore();
  const isActive = gdActiveSpeaker === speaker;
  const accent = ACCENT_MAP[accentColor] ?? ACCENT_MAP['neutral'];

  return (
    <motion.div
      layout
      animate={{
        scale: isActive ? 1.04 : 0.97,
        opacity: isActive ? 1 : 0.55,
        zIndex: isActive ? 10 : 1,
        y: isActive ? -6 : 0,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`relative rounded-xl border bg-white/[0.03] backdrop-blur-sm p-3
                  shadow-lg transition-colors duration-300
                  ${isActive ? accent : 'border-white/8 shadow-black/20'}`}
    >
      {/* Avatar */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`relative w-9 h-9 rounded-full flex items-center justify-center
                         text-sm font-mono font-bold bg-white/5
                         ${isActive ? 'ring-2 ring-offset-1 ring-offset-[#030303]' : ''}`}
             style={isActive ? { color: 'currentColor' } : {}}>
          {avatarInitial}
          {/* Pulsating mic indicator when speaking */}
          {isActive && (
            <motion.span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full
                         bg-emerald-400 border-2 border-[#030303]"
              animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-white/90 leading-none">{label}</p>
          <p className="text-[10px] font-mono text-white/35 mt-0.5">{role}</p>
        </div>
      </div>

      {/* Live subtitle bar — only visible when this speaker is active */}
      <AnimatePresence>
        {isActive && revealedAiStream && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-[11px] text-white/70 leading-relaxed line-clamp-3
                          border-t border-white/8 pt-2 mt-1 font-light">
              {revealedAiStream.replace(/^[^:]+:\s*/, '')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "SPEAKING" label */}
      {isActive && (
        <span className="absolute top-2 right-2 text-[9px] font-mono font-bold
                         text-emerald-400 tracking-widest uppercase">
          SPEAKING
        </span>
      )}
    </motion.div>
  );
}
