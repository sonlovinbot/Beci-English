import { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Repeat, Mic, Square, X } from 'lucide-react';
import { getPhonetics, getWordTimings, type WordTiming } from '../lib/gemini';
import { AudioControls } from './AudioControls';

interface ShadowingPlayerProps {
  text: string;
  audioUrl: string;
  onClose: () => void;
}

export function ShadowingPlayer({ text, audioUrl, onClose }: ShadowingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [phonetics, setPhonetics] = useState<string[]>([]);
  const [isLoadingPhonetics, setIsLoadingPhonetics] = useState(true);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [timingsReady, setTimingsReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const recordedAudioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const words = text.split(/\s+/).filter(w => w.length > 0);

  // Load phonetics on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingPhonetics(true);
    getPhonetics(text).then(res => {
      if (isMounted) {
        setPhonetics(res);
        setIsLoadingPhonetics(false);
      }
    });
    return () => { isMounted = false; };
  }, [text]);

  // Generate word timings once we know the audio duration
  useEffect(() => {
    if (duration <= 0 || timingsReady) return;
    let isMounted = true;
    getWordTimings(text, duration).then(timings => {
      if (isMounted && timings.length > 0) {
        setWordTimings(timings);
      }
      if (isMounted) setTimingsReady(true);
    });
    return () => { isMounted = false; };
  }, [duration, text, timingsReady]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.loop = isLooping;
    }
  }, [playbackRate, isLooping]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

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

  const handleEnded = () => {
    if (!isLooping) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedAudioUrl(url);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordedAudioUrl(null);

        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (err) {
        console.error("Error accessing microphone", err);
        alert("Could not access microphone. Please check permissions.");
      }
    }
  };

  // Determine current word index using AI-generated timings or fallback
  const adjustedTime = playbackRate !== 1 ? currentTime : currentTime;
  let currentWordIndex = -1;

  if (wordTimings.length > 0) {
    // Use AI word timings - account for playback rate
    for (let i = 0; i < wordTimings.length; i++) {
      const timing = wordTimings[i];
      if (adjustedTime >= timing.start && adjustedTime <= timing.end) {
        currentWordIndex = i;
        break;
      }
      // If between words, show the next word
      if (i < wordTimings.length - 1 && adjustedTime > timing.end && adjustedTime < wordTimings[i + 1].start) {
        currentWordIndex = i;
        break;
      }
    }
    // If past all timings, show last word
    if (currentWordIndex === -1 && wordTimings.length > 0 && adjustedTime > 0) {
      const last = wordTimings[wordTimings.length - 1];
      if (adjustedTime >= last.start) {
        currentWordIndex = wordTimings.length - 1;
      }
    }
  } else {
    // Fallback: character-based estimation
    const totalChars = words.reduce((acc, word) => acc + word.length, 0);
    const charsPerSecond = duration > 0 ? totalChars / duration : 0;
    const currentTotalChars = charsPerSecond * currentTime;
    let charCount = 0;
    for (let i = 0; i < words.length; i++) {
      charCount += words[i].length;
      if (currentTotalChars <= charCount) {
        currentWordIndex = i;
        break;
      }
    }
    if (currentWordIndex === -1 && words.length > 0) {
      currentWordIndex = words.length - 1;
    }
  }

  const currentWordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentWordRef.current && isPlaying) {
      currentWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentWordIndex, isPlaying]);

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-slate-800">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Mic className="text-indigo-400" /> Shadowing Mode
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex flex-wrap justify-start gap-x-3 gap-y-6 text-2xl md:text-3xl lg:text-4xl font-semibold leading-relaxed">
            {words.map((word, index) => {
              const isCurrent = index === currentWordIndex;
              const isPast = index < currentWordIndex;
              return (
                <div
                  key={index}
                  ref={isCurrent ? currentWordRef : null}
                  className="flex flex-col items-center"
                >
                  <span
                    className={`transition-colors duration-200 px-1 rounded-md ${
                      isCurrent ? 'text-indigo-400 bg-indigo-500/10' :
                      isPast ? 'text-slate-200' : 'text-slate-500'
                    }`}
                  >
                    {word}
                  </span>
                  <span className={`text-sm md:text-base mt-1 font-normal tracking-wide ${isCurrent ? 'text-indigo-300' : 'text-slate-600'}`}>
                    {phonetics[index] || (isLoadingPhonetics ? '...' : '')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-950 p-6 border-t border-slate-800">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {/* Progress Bar */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 w-12 text-right">
              {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
            </span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden relative cursor-pointer"
                 onClick={(e) => {
                   if (audioRef.current && duration) {
                     const rect = e.currentTarget.getBoundingClientRect();
                     const pos = (e.clientX - rect.left) / rect.width;
                     audioRef.current.currentTime = pos * duration;
                   }
                 }}>
              <div
                className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-100"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-sm text-slate-400 w-12">
              {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Speed + Rewind */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <AudioControls
              audioRef={audioRef}
              playbackRate={playbackRate}
              onPlaybackRateChange={setPlaybackRate}
              isPlaying={isPlaying}
              onPlayStateChange={setIsPlaying}
              variant="dark"
            />
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-2 rounded-full transition-colors ${isLooping ? 'text-indigo-400 bg-indigo-400/10' : 'text-slate-400 hover:text-white'}`}
              title="Loop"
            >
              <Repeat size={20} />
            </button>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-6">
              <button
                onClick={restart}
                className="p-3 text-slate-400 hover:text-white transition-colors"
                title="Restart"
              >
                <RotateCcw size={24} />
              </button>
              <button
                onClick={togglePlay}
                className="p-4 bg-white text-slate-900 rounded-full hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause size={32} className="fill-slate-900" /> : <Play size={32} className="fill-slate-900 ml-1" />}
              </button>
            </div>

            <div className="flex items-center gap-4">
              {recordedAudioUrl && (
                <button
                  onClick={() => {
                    if (recordedAudioRef.current) {
                      recordedAudioRef.current.play();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500 text-indigo-400 hover:bg-indigo-500/10 transition-colors text-sm font-medium"
                >
                  <Play size={16} /> Play Recording
                </button>
              )}
              <button
                onClick={toggleRecording}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isRecording ? <Square size={18} className="fill-white" /> : <Mic size={18} />}
                {isRecording ? 'Recording...' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />
      {recordedAudioUrl && <audio ref={recordedAudioRef} src={recordedAudioUrl} className="hidden" />}
    </div>
  );
}
