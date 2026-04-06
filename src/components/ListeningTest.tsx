import { useState, useRef, useEffect } from 'react';
import {
  Loader2, Play, Pause, ChevronDown, ChevronUp, ClipboardCheck,
  Sparkles, RotateCcw, CheckCircle2, XCircle, ArrowLeft, Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  loadHistory,
  getAudioPublicUrl,
  type AudioGeneration,
} from '../lib/storageService';
import {
  generateListeningTest,
  type ListeningTest as ListeningTestType,
  type MultipleChoiceQuestion,
  type TrueFalseQuestion,
} from '../lib/gemini';

type Difficulty = 'easy' | 'medium' | 'hard';
type TestSection = 'multipleChoice' | 'trueFalse' | 'fillBlanks';

export function ListeningTest() {
  // Selection state
  const [audioList, setAudioList] = useState<AudioGeneration[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedAudio, setSelectedAudio] = useState<AudioGeneration | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  // Test state
  const [test, setTest] = useState<ListeningTestType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Answer state
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({});
  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [fillAnswers, setFillAnswers] = useState<Record<number, string>>({});

  // UI state
  const [activeSection, setActiveSection] = useState<TestSection>('multipleChoice');
  const [submitted, setSubmitted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Audio player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetch = async () => {
      setIsLoadingList(true);
      const items = await loadHistory(100);
      setAudioList(items.filter(i => i.audio_storage_path));
      setIsLoadingList(false);
    };
    fetch();
  }, []);

  const audioUrl = selectedAudio?.audio_storage_path
    ? getAudioPublicUrl(selectedAudio.audio_storage_path)
    : null;

  const handleGenerateTest = async () => {
    if (!selectedAudio) return;
    setIsGenerating(true);
    setError(null);
    setTest(null);
    setSubmitted(false);
    setMcAnswers({});
    setTfAnswers({});
    setFillAnswers({});
    setActiveSection('multipleChoice');

    try {
      const result = await generateListeningTest(selectedAudio.text, difficulty);
      setTest(result);
    } catch (err) {
      setError('Failed to generate test. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Scoring
  const getScore = () => {
    if (!test) return { mc: 0, mcTotal: 0, tf: 0, tfTotal: 0, fill: 0, fillTotal: 0, total: 0, max: 0 };

    let mc = 0;
    test.multipleChoice.forEach((q, i) => {
      if (mcAnswers[i] === q.correctIndex) mc++;
    });

    let tf = 0;
    test.trueFalse.forEach((q, i) => {
      if (tfAnswers[i] === q.correct) tf++;
    });

    let fill = 0;
    const fillTotal = test.fillBlanks.blanks.length;
    test.fillBlanks.blanks.forEach((answer, i) => {
      const userAnswer = (fillAnswers[i] || '').trim().toLowerCase();
      const correct = answer.trim().toLowerCase();
      if (userAnswer === correct) fill++;
    });

    const mcTotal = test.multipleChoice.length;
    const tfTotal = test.trueFalse.length;
    const total = mc + tf + fill;
    const max = mcTotal + tfTotal + fillTotal;

    return { mc, mcTotal, tf, tfTotal, fill, fillTotal, total, max };
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const handleRetry = () => {
    setSubmitted(false);
    setMcAnswers({});
    setTfAnswers({});
    setFillAnswers({});
    setActiveSection('multipleChoice');
  };

  const handleBackToSelect = () => {
    setSelectedAudio(null);
    setTest(null);
    setSubmitted(false);
    setMcAnswers({});
    setTfAnswers({});
    setFillAnswers({});
  };

  const formatTime = (t: number) =>
    `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  // --- Audio Selection Screen ---
  if (!selectedAudio) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <header className="mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Listening Test</h2>
          <p className="text-slate-500 mt-2 text-base md:text-lg">Choose an audio lesson, then AI will generate a test for you.</p>
        </header>

        {isLoadingList ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading your audio library...</span>
          </div>
        ) : audioList.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ClipboardCheck size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No audio lessons yet. Generate some audio first!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Difficulty Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
              <h3 className="font-semibold text-slate-800 mb-3">Difficulty Level</h3>
              <div className="flex gap-3">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all capitalize ${
                      difficulty === d
                        ? d === 'easy' ? 'bg-green-100 text-green-700 border-2 border-green-400'
                        : d === 'medium' ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400'
                        : 'bg-red-100 text-red-700 border-2 border-red-400'
                        : 'bg-slate-50 text-slate-600 border-2 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    {d === 'easy' ? 'Easy (A2)' : d === 'medium' ? 'Medium (B1)' : 'Hard (B2)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-700">Select a lesson to test</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[55vh] overflow-y-auto">
                {audioList.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedAudio(item)}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-indigo-50 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-indigo-200 transition-colors">
                      <Volume2 size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.title || 'Untitled Lesson'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.text.slice(0, 80)}...</p>
                    </div>
                    <div className="text-xs text-slate-400 shrink-0">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Test Screen ---
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleBackToSelect}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{selectedAudio.title || 'Untitled Lesson'}</h2>
          <p className="text-sm text-slate-500 capitalize">{difficulty} difficulty</p>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Audio Player */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-md p-4 mb-6 text-white">
        <div className="flex items-center gap-4">
          <button onClick={togglePlay} className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors shrink-0">
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-indigo-200 w-10 text-right">{formatTime(currentTime)}</span>
              <div
                className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  if (audioRef.current && duration) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
                  }
                }}
              >
                <div className="h-full bg-white transition-all duration-100" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
              <span className="text-xs text-indigo-200 w-10">{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        {/* Transcript toggle */}
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="mt-3 flex items-center gap-1 text-xs text-indigo-200 hover:text-white transition-colors"
        >
          Transcript {showTranscript ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <AnimatePresence>
          {showTranscript && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 bg-white/10 rounded-lg p-3 text-sm text-indigo-100 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {selectedAudio.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generate Button */}
      {!test && !isGenerating && (
        <div className="text-center py-12">
          <button
            onClick={handleGenerateTest}
            className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-4 px-8 rounded-2xl shadow-lg transition-all text-lg"
          >
            <Sparkles size={22} />
            Generate Test with AI
          </button>
          <p className="text-slate-400 text-sm mt-3">AI will create multiple choice, true/false, and fill-in-the-blank questions</p>
        </div>
      )}

      {isGenerating && (
        <div className="text-center py-16">
          <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-500">Generating your test...</p>
        </div>
      )}

      {/* Test Content */}
      {test && (
        <div className="space-y-6">
          {/* Section Tabs */}
          <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-sm border border-slate-200">
            {([
              { key: 'multipleChoice' as TestSection, label: 'Multiple Choice', count: test.multipleChoice.length },
              { key: 'trueFalse' as TestSection, label: 'True / False', count: test.trueFalse.length },
              { key: 'fillBlanks' as TestSection, label: 'Fill in Blanks', count: test.fillBlanks.blanks.length },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeSection === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs ${activeSection === tab.key ? 'text-indigo-200' : 'text-slate-400'}`}>
                  ({tab.count})
                </span>
              </button>
            ))}
          </div>

          {/* Score Banner */}
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
            >
              {(() => {
                const s = getScore();
                const pct = Math.round((s.total / s.max) * 100);
                const color = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600';
                return (
                  <div className="text-center">
                    <p className={`text-4xl font-bold ${color}`}>{pct}%</p>
                    <p className="text-slate-500 mt-1">{s.total} / {s.max} correct</p>
                    <div className="flex justify-center gap-6 mt-3 text-sm text-slate-500">
                      <span>MC: {s.mc}/{s.mcTotal}</span>
                      <span>T/F: {s.tf}/{s.tfTotal}</span>
                      <span>Fill: {s.fill}/{s.fillTotal}</span>
                    </div>
                    <div className="flex justify-center gap-3 mt-4">
                      <button onClick={handleRetry} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium text-sm hover:bg-indigo-200 transition-colors">
                        <RotateCcw size={16} /> Try Again
                      </button>
                      <button onClick={handleGenerateTest} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors">
                        <Sparkles size={16} /> New Test
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* Multiple Choice Section */}
          {activeSection === 'multipleChoice' && (
            <div className="space-y-4">
              {test.multipleChoice.map((q: MultipleChoiceQuestion, qi: number) => {
                const userAnswer = mcAnswers[qi];
                const isCorrect = submitted && userAnswer === q.correctIndex;
                const isWrong = submitted && userAnswer !== undefined && userAnswer !== q.correctIndex;
                return (
                  <div key={qi} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <p className="font-medium text-slate-800 mb-3">
                      <span className="text-indigo-500 mr-2">{qi + 1}.</span>
                      {q.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = userAnswer === oi;
                        const showCorrect = submitted && oi === q.correctIndex;
                        const showWrong = submitted && isSelected && oi !== q.correctIndex;
                        return (
                          <button
                            key={oi}
                            onClick={() => !submitted && setMcAnswers(prev => ({ ...prev, [qi]: oi }))}
                            disabled={submitted}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left text-sm transition-all ${
                              showCorrect ? 'border-green-400 bg-green-50 text-green-800' :
                              showWrong ? 'border-red-400 bg-red-50 text-red-800' :
                              isSelected ? 'border-indigo-400 bg-indigo-50 text-indigo-800' :
                              'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                              showCorrect ? 'border-green-500 bg-green-500 text-white' :
                              showWrong ? 'border-red-500 bg-red-500 text-white' :
                              isSelected ? 'border-indigo-500 bg-indigo-500 text-white' :
                              'border-slate-300 text-slate-400'
                            }`}>
                              {showCorrect ? <CheckCircle2 size={14} /> : showWrong ? <XCircle size={14} /> : String.fromCharCode(65 + oi)}
                            </span>
                            <span className="flex-1">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {submitted && isWrong && (
                      <p className="text-xs text-green-600 mt-2">Correct answer: {q.options[q.correctIndex]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* True/False Section */}
          {activeSection === 'trueFalse' && (
            <div className="space-y-4">
              {test.trueFalse.map((q: TrueFalseQuestion, qi: number) => {
                const userAnswer = tfAnswers[qi];
                const answered = userAnswer !== undefined;
                const isCorrect = submitted && answered && userAnswer === q.correct;
                const isWrong = submitted && answered && userAnswer !== q.correct;
                return (
                  <div key={qi} className={`bg-white rounded-xl shadow-sm border p-5 ${
                    isCorrect ? 'border-green-300' : isWrong ? 'border-red-300' : 'border-slate-200'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium text-slate-800 flex-1">
                        <span className="text-indigo-500 mr-2">{qi + 1}.</span>
                        {q.statement}
                      </p>
                      {submitted && (
                        isCorrect ? <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" /> :
                        isWrong ? <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" /> : null
                      )}
                    </div>
                    <div className="flex gap-3 mt-3">
                      {[true, false].map(val => {
                        const isSelected = userAnswer === val;
                        const showCorrect = submitted && val === q.correct;
                        const showWrong = submitted && isSelected && val !== q.correct;
                        return (
                          <button
                            key={String(val)}
                            onClick={() => !submitted && setTfAnswers(prev => ({ ...prev, [qi]: val }))}
                            disabled={submitted}
                            className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                              showCorrect ? 'border-green-400 bg-green-50 text-green-700' :
                              showWrong ? 'border-red-400 bg-red-50 text-red-700' :
                              isSelected ? 'border-indigo-400 bg-indigo-50 text-indigo-700' :
                              'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {val ? 'True' : 'False'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fill in Blanks Section */}
          {activeSection === 'fillBlanks' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6">
              <p className="text-sm text-slate-500 mb-4">Fill in the missing words from the transcript.</p>
              <div className="text-base leading-[2.5] text-slate-700">
                {(() => {
                  const parts = test.fillBlanks.textWithBlanks.split(/(___BLANK_\d+___)/g);
                  return parts.map((part, i) => {
                    const blankMatch = part.match(/___BLANK_(\d+)___/);
                    if (!blankMatch) return <span key={i}>{part}</span>;

                    const blankIndex = parseInt(blankMatch[1]) - 1;
                    const userVal = fillAnswers[blankIndex] || '';
                    const correctVal = test.fillBlanks.blanks[blankIndex];
                    const isCorrect = submitted && userVal.trim().toLowerCase() === correctVal?.trim().toLowerCase();
                    const isWrong = submitted && userVal.trim().toLowerCase() !== correctVal?.trim().toLowerCase();

                    return (
                      <span key={i} className="inline-flex items-center mx-1 align-baseline">
                        <span className="text-xs text-indigo-400 mr-1 font-mono">{blankIndex + 1}</span>
                        <input
                          type="text"
                          value={userVal}
                          onChange={(e) => !submitted && setFillAnswers(prev => ({ ...prev, [blankIndex]: e.target.value }))}
                          disabled={submitted}
                          placeholder="..."
                          className={`w-28 sm:w-36 border-b-2 bg-transparent text-center text-sm py-0.5 focus:outline-none transition-colors ${
                            isCorrect ? 'border-green-500 text-green-700' :
                            isWrong ? 'border-red-500 text-red-700' :
                            'border-indigo-300 focus:border-indigo-500 text-slate-800'
                          }`}
                        />
                        {isWrong && (
                          <span className="text-xs text-green-600 ml-1">({correctVal})</span>
                        )}
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Submit / Navigation */}
          {!submitted && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-slate-400">
                {(() => {
                  const mcCount = Object.keys(mcAnswers).length;
                  const tfCount = Object.keys(tfAnswers).length;
                  const fillCount = Object.values(fillAnswers).filter(v => v.trim()).length;
                  const total = mcCount + tfCount + fillCount;
                  const max = test.multipleChoice.length + test.trueFalse.length + test.fillBlanks.blanks.length;
                  return `${total} / ${max} answered`;
                })()}
              </div>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl shadow-sm transition-all"
              >
                <ClipboardCheck size={18} />
                Submit Answers
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
