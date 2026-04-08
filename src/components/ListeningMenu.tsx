import { useState, useRef, useEffect, useCallback, type MouseEvent } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Trash2, Volume2, VolumeX, Loader2, ListMusic, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  loadHistory,
  deleteGeneration,
  getAudioPublicUrl,
  type AudioGeneration,
} from '../lib/storageService';
import { AudioControls } from './AudioControls';

export function ListeningMenu() {
  const [playlist, setPlaylist] = useState<AudioGeneration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopMode, setLoopMode] = useState<'none' | 'all' | 'one'>('none');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showScript, setShowScript] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const scriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPlaylist = async () => {
      setIsLoading(true);
      const items = await loadHistory(100);
      const withAudio = items.filter(i => i.audio_storage_path);
      setPlaylist(withAudio);
      setIsLoading(false);
    };
    fetchPlaylist();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const currentItem = currentIndex >= 0 ? playlist[currentIndex] : null;
  const currentAudioUrl = currentItem?.audio_storage_path
    ? getAudioPublicUrl(currentItem.audio_storage_path)
    : null;

  const playTrack = useCallback((index: number) => {
    if (index < 0 || index >= playlist.length) return;
    setCurrentIndex(index);
    setIsPlaying(true);
    // Audio will auto-play via effect below
  }, [playlist.length]);

  useEffect(() => {
    if (audioRef.current && currentAudioUrl) {
      audioRef.current.src = currentAudioUrl;
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [currentIndex, currentAudioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !currentAudioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    if (loopMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    const nextIndex = currentIndex + 1;
    if (nextIndex < playlist.length) {
      playTrack(nextIndex);
    } else if (loopMode === 'all') {
      playTrack(0);
    } else {
      setIsPlaying(false);
    }
  }, [currentIndex, playlist.length, loopMode, playTrack]);

  const playPrev = () => {
    if (currentIndex > 0) {
      playTrack(currentIndex - 1);
    } else if (loopMode === 'all' && playlist.length > 0) {
      playTrack(playlist.length - 1);
    }
  };

  const handleEnded = useCallback(() => {
    playNext();
  }, [playNext]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = pos * duration;
    }
  };

  const handleDelete = async (item: AudioGeneration, e: MouseEvent) => {
    e.stopPropagation();
    const success = await deleteGeneration(item.id, item.audio_storage_path);
    if (success) {
      const idx = playlist.indexOf(item);
      const newPlaylist = playlist.filter(p => p.id !== item.id);
      setPlaylist(newPlaylist);
      if (idx === currentIndex) {
        setIsPlaying(false);
        setCurrentIndex(newPlaylist.length > 0 ? Math.min(idx, newPlaylist.length - 1) : -1);
      } else if (idx < currentIndex) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  };

  const cycleLoopMode = () => {
    setLoopMode(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none');
  };

  // Word highlighting for script display
  const currentWords = currentItem ? currentItem.text.split(/\s+/).filter(w => w.length > 0) : [];
  const totalChars = currentWords.reduce((acc, w) => acc + w.length, 0);
  const charsPerSecond = duration > 0 ? totalChars / duration : 0;
  const currentCharPos = charsPerSecond * currentTime;
  let currentWordIndex = -1;
  let charCount = 0;
  for (let i = 0; i < currentWords.length; i++) {
    charCount += currentWords[i].length;
    if (currentCharPos <= charCount) {
      currentWordIndex = i;
      break;
    }
  }
  if (currentWordIndex === -1 && currentWords.length > 0) {
    currentWordIndex = currentWords.length - 1;
  }

  const currentWordRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (currentWordRef.current && isPlaying && showScript) {
      currentWordRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentWordIndex, isPlaying, showScript]);

  const formatTime = (t: number) =>
    `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading your audio library...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Listening</h2>
        <p className="text-slate-500 mt-2 text-base md:text-lg">Your audio library. Play, loop, and listen in the background.</p>
      </header>

      {playlist.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ListMusic size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No audio yet. Generate some audio first!</p>
        </div>
      ) : (
        <>
          {/* Playlist */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-28">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <ListMusic size={18} className="text-indigo-500" />
                {playlist.length} lesson{playlist.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {playlist.map((item, index) => {
                const isActive = index === currentIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => playTrack(index)}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors group ${
                      isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                      {isActive && isPlaying ? (
                        <div className="flex items-center gap-0.5">
                          <span className="w-1 h-4 bg-indigo-500 rounded-full animate-pulse" />
                          <span className="w-1 h-3 bg-indigo-500 rounded-full animate-pulse delay-75" />
                          <span className="w-1 h-5 bg-indigo-500 rounded-full animate-pulse delay-150" />
                        </div>
                      ) : (
                        <span className={`text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700' : 'text-slate-800'}`}>
                        {item.title || 'Untitled Lesson'}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {item.voice} · {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(item, e)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fixed Bottom Player */}
          <AnimatePresence>
            {currentItem && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white z-40 shadow-2xl"
              >
                {minimized ? (
                  // Minimized bar
                  <div className="flex items-center gap-3 px-4 py-2">
                    <button onClick={togglePlay} className="p-2">
                      {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{currentItem.title || 'Untitled Lesson'}</p>
                    </div>
                    <button onClick={() => setMinimized(false)} className="p-2 text-slate-400 hover:text-white">
                      <ListMusic size={18} />
                    </button>
                  </div>
                ) : (
                  // Full player
                  <div className="px-4 md:px-8 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0 flex-1 mr-4">
                        <p className="text-sm font-medium truncate">{currentItem.title || 'Untitled Lesson'}</p>
                        <p className="text-xs text-slate-400 truncate">{currentItem.voice} · {currentItem.text.slice(0, 60)}...</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setShowScript(!showScript)}
                          className={`p-1.5 rounded transition-colors ${showScript ? 'text-indigo-400 bg-indigo-400/10' : 'text-slate-400 hover:text-white'}`}
                          title={showScript ? 'Hide script' : 'Show script'}
                        >
                          <FileText size={16} />
                        </button>
                        <button onClick={() => setMinimized(true)} className="p-1 text-slate-400 hover:text-white">
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Script Panel */}
                    {showScript && (
                      <div
                        ref={scriptRef}
                        className="mb-3 max-h-32 overflow-y-auto bg-slate-800 rounded-lg p-3 text-sm leading-relaxed"
                      >
                        <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                          {currentWords.map((word, index) => {
                            const isCurrent = index === currentWordIndex && isPlaying;
                            const isPast = index < currentWordIndex;
                            return (
                              <span
                                key={index}
                                ref={isCurrent ? currentWordRef : null}
                                className={`transition-colors duration-150 px-0.5 rounded ${
                                  isCurrent ? 'text-indigo-300 bg-indigo-500/20 font-medium' :
                                  isPast ? 'text-slate-300' : 'text-slate-500'
                                }`}
                              >
                                {word}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-slate-400 w-10 text-right">{formatTime(currentTime)}</span>
                      <div
                        className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden cursor-pointer"
                        onClick={handleSeek}
                      >
                        <div
                          className="h-full bg-indigo-500 transition-all duration-100"
                          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-10">{formatTime(duration)}</span>
                    </div>

                    {/* Speed + Rewind */}
                    <div className="flex items-center justify-between mb-3">
                      <AudioControls
                        audioRef={audioRef}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={setPlaybackRate}
                        isPlaying={isPlaying}
                        onPlayStateChange={setIsPlaying}
                        variant="dark"
                        compact
                      />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={cycleLoopMode}
                          className={`p-2 rounded-full transition-colors ${
                            loopMode !== 'none' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'
                          }`}
                          title={loopMode === 'one' ? 'Repeat one' : loopMode === 'all' ? 'Repeat all' : 'No repeat'}
                        >
                          {loopMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        <button onClick={playPrev} className="p-2 text-slate-400 hover:text-white transition-colors">
                          <SkipBack size={20} />
                        </button>
                        <button
                          onClick={togglePlay}
                          className="p-3 bg-white text-slate-900 rounded-full hover:scale-105 transition-transform"
                        >
                          {isPlaying ? <Pause size={24} className="fill-slate-900" /> : <Play size={24} className="fill-slate-900 ml-0.5" />}
                        </button>
                        <button onClick={playNext} className="p-2 text-slate-400 hover:text-white transition-colors">
                          <SkipForward size={20} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className="p-2 text-slate-400 hover:text-white transition-colors"
                        >
                          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => {
                            setVolume(parseFloat(e.target.value));
                            setIsMuted(false);
                          }}
                          className="w-20 accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <audio
                  ref={audioRef}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleEnded}
                  className="hidden"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
