import { Undo2 } from 'lucide-react';

interface AudioControlsProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  variant?: 'light' | 'dark';
  compact?: boolean;
}

const RATES = [1, 0.75, 0.5, 1.25, 1.5];

export function AudioControls({
  audioRef,
  playbackRate,
  onPlaybackRateChange,
  isPlaying,
  onPlayStateChange,
  variant = 'dark',
  compact = false,
}: AudioControlsProps) {
  const rewind = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - seconds);
      if (!isPlaying) {
        audioRef.current.play();
        onPlayStateChange(true);
      }
    }
  };

  const cycleRate = () => {
    const idx = RATES.indexOf(playbackRate);
    const next = RATES[(idx + 1) % RATES.length];
    onPlaybackRateChange(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const isDark = variant === 'dark';
  const btnClass = isDark
    ? 'bg-white/10 hover:bg-white/20 text-white'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-700';
  const rateClass = isDark
    ? `${playbackRate !== 1 ? 'bg-indigo-500/30 text-indigo-300' : 'bg-white/10 text-white hover:bg-white/20'}`
    : `${playbackRate !== 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;

  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {/* Speed */}
      <button
        onClick={cycleRate}
        className={`${compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'} rounded-lg font-bold transition-colors ${rateClass}`}
        title="Playback speed"
      >
        {playbackRate}x
      </button>
      {/* Rewind buttons */}
      {[5, 10, 15].map(sec => (
        <button
          key={sec}
          onClick={() => rewind(sec)}
          className={`flex items-center gap-0.5 ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-xs'} rounded-lg font-medium transition-colors ${btnClass}`}
          title={`Rewind ${sec}s`}
        >
          <Undo2 size={compact ? 10 : 12} /> {sec}s
        </button>
      ))}
    </div>
  );
}
