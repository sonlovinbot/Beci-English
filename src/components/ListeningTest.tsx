import { useState, useRef, useEffect } from 'react';
import {
  Loader2, Play, Pause, ChevronDown, ChevronUp, ClipboardCheck,
  Sparkles, RotateCcw, CheckCircle2, XCircle, ArrowLeft, ArrowRight,
  Volume2, Trophy, History, Clock, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  loadHistory,
  getAudioPublicUrl,
  saveTest,
  updateTestScore,
  loadTestsForAudio,
  type AudioGeneration,
  type SavedTest,
} from '../lib/storageService';
import {
  generateListeningTest,
  type ListeningTest as ListeningTestType,
  type MultipleChoiceQuestion,
  type TrueFalseQuestion,
} from '../lib/gemini';
import { AudioControls } from './AudioControls';

type Difficulty = 'easy' | 'medium' | 'hard';
type TestStep = 'multipleChoice' | 'trueFalse' | 'fillBlanks' | 'results';

const STEP_ORDER: TestStep[] = ['multipleChoice', 'trueFalse', 'fillBlanks', 'results'];
const STEP_LABELS: Record<string, string> = {
  multipleChoice: 'Multiple Choice',
  trueFalse: 'True / False',
  fillBlanks: 'Fill in Blanks',
  results: 'Results',
};

export function ListeningTest() {
  // Selection state
  const [audioList, setAudioList] = useState<AudioGeneration[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedAudio, setSelectedAudio] = useState<AudioGeneration | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  // Saved tests
  const [savedTests, setSavedTests] = useState<SavedTest[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  // Test state
  const [test, setTest] = useState<ListeningTestType | null>(null);
  const [testDbId, setTestDbId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step-by-step state
  const [currentStep, setCurrentStep] = useState<TestStep>('multipleChoice');
  const [submittedSections, setSubmittedSections] = useState<Set<TestStep>>(new Set());
  const [checkingSections, setCheckingSections] = useState<Set<TestStep>>(new Set());

  // Answer state
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({});
  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [fillAnswers, setFillAnswers] = useState<Record<number, string>>({});

  // UI state
  const [showTranscript, setShowTranscript] = useState(false);

  // Audio player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
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

  // Load saved tests when audio is selected
  useEffect(() => {
    if (!selectedAudio) return;
    setIsLoadingSaved(true);
    loadTestsForAudio(selectedAudio.id).then(tests => {
      setSavedTests(tests);
      setIsLoadingSaved(false);
    });
  }, [selectedAudio?.id]);

  const audioUrl = selectedAudio?.audio_storage_path
    ? getAudioPublicUrl(selectedAudio.audio_storage_path)
    : null;

  const resetTestState = () => {
    setCurrentStep('multipleChoice');
    setSubmittedSections(new Set());
    setCheckingSections(new Set());
    setMcAnswers({});
    setTfAnswers({});
    setFillAnswers({});
    setTestDbId(null);
  };

  const handleGenerateTest = async () => {
    if (!selectedAudio) return;
    setIsGenerating(true);
    setError(null);
    setTest(null);
    resetTestState();

    try {
      const result = await generateListeningTest(selectedAudio.text, difficulty);
      setTest(result);

      // Save test to DB
      const saved = await saveTest(selectedAudio.id, difficulty, result);
      if (saved) {
        setTestDbId(saved.id);
        setSavedTests(prev => [saved, ...prev]);
      }
    } catch (err) {
      setError('Failed to generate test. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadSavedTest = (savedTest: SavedTest) => {
    setTest(savedTest.test_data as ListeningTestType);
    setTestDbId(savedTest.id);
    resetTestState();
    if (savedTest.completed) {
      // Show results directly for completed tests
      setSubmittedSections(new Set(['multipleChoice', 'trueFalse', 'fillBlanks']));
      setCurrentStep('results');
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

  // Scoring helpers
  const getMcScore = () => {
    if (!test) return { correct: 0, total: 0 };
    let correct = 0;
    test.multipleChoice.forEach((q, i) => {
      if (mcAnswers[i] === q.correctIndex) correct++;
    });
    return { correct, total: test.multipleChoice.length };
  };

  const getTfScore = () => {
    if (!test) return { correct: 0, total: 0 };
    let correct = 0;
    test.trueFalse.forEach((q, i) => {
      if (tfAnswers[i] === q.correct) correct++;
    });
    return { correct, total: test.trueFalse.length };
  };

  const getFillScore = () => {
    if (!test) return { correct: 0, total: 0 };
    let correct = 0;
    test.fillBlanks.blanks.forEach((answer, i) => {
      if ((fillAnswers[i] || '').trim().toLowerCase() === answer.trim().toLowerCase()) correct++;
    });
    return { correct, total: test.fillBlanks.blanks.length };
  };

  const getTotalScore = () => {
    const mc = getMcScore();
    const tf = getTfScore();
    const fill = getFillScore();
    return {
      mc: mc.correct, mcTotal: mc.total,
      tf: tf.correct, tfTotal: tf.total,
      fill: fill.correct, fillTotal: fill.total,
      total: mc.correct + tf.correct + fill.correct,
      max: mc.total + tf.total + fill.total,
    };
  };

  const handleSubmitSection = async () => {
    const newSubmitted = new Set(submittedSections);
    newSubmitted.add(currentStep);
    setSubmittedSections(newSubmitted);

    // Check if all 3 test sections are now submitted
    const allDone = newSubmitted.has('multipleChoice') && newSubmitted.has('trueFalse') && newSubmitted.has('fillBlanks');

    if (allDone) {
      // Save score to DB and go to results
      const s = getTotalScore();
      if (testDbId) {
        await updateTestScore(testDbId, s.mc, s.tf, s.fill, s.total, s.max);
        setSavedTests(prev => prev.map(t =>
          t.id === testDbId
            ? { ...t, score_mc: s.mc, score_tf: s.tf, score_fill: s.fill, score_total: s.total, score_max: s.max, completed: true }
            : t
        ));
      }
      setCurrentStep('results');
    }
    // Stay on current section so user can review, then navigate freely
  };

  const handleRetry = () => {
    resetTestState();
  };

  const handleBackToSelect = () => {
    setSelectedAudio(null);
    setTest(null);
    resetTestState();
    setSavedTests([]);
  };

  const formatTime = (t: number) =>
    `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  const isSectionSubmitted = (step: TestStep) => submittedSections.has(step);
  const isSectionChecking = (step: TestStep) => checkingSections.has(step);

  const handleCheckAnswer = (step: TestStep) => {
    setCheckingSections(prev => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step); // toggle off
      } else {
        next.add(step);
      }
      return next;
    });
  };

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
        <button onClick={handleBackToSelect} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
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
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
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
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="mt-2 flex items-center gap-1 text-xs text-indigo-200 hover:text-white transition-colors"
        >
          Transcript {showTranscript ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <AnimatePresence>
          {showTranscript && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 bg-white/10 rounded-lg p-3 text-sm text-indigo-100 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {selectedAudio.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Saved Tests + Generate */}
      {!test && !isGenerating && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <button
              onClick={handleGenerateTest}
              className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-4 px-8 rounded-2xl shadow-lg transition-all text-lg"
            >
              <Sparkles size={22} />
              Generate New Test
            </button>
            <p className="text-slate-400 text-sm mt-3">AI will create multiple choice, true/false, and fill-in-the-blank questions</p>
          </div>

          {/* Previous Tests */}
          {isLoadingSaved ? (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-4">
              <Loader2 size={16} className="animate-spin" /> Loading saved tests...
            </div>
          ) : savedTests.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <History size={16} className="text-indigo-500" />
                  Previous Tests
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {savedTests.map(st => {
                  const pct = st.score_max ? Math.round(((st.score_total || 0) / st.score_max) * 100) : null;
                  const color = pct !== null ? (pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600') : 'text-slate-400';
                  return (
                    <button
                      key={st.id}
                      onClick={() => handleLoadSavedTest(st)}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${st.completed ? 'bg-green-100' : 'bg-slate-100'}`}>
                        {st.completed ? <Trophy size={18} className="text-green-600" /> : <Clock size={18} className="text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 capitalize">{st.difficulty} test</p>
                        <p className="text-xs text-slate-400">{new Date(st.created_at).toLocaleString()}</p>
                      </div>
                      {st.completed && pct !== null ? (
                        <div className="text-right shrink-0">
                          <p className={`text-lg font-bold ${color}`}>{pct}%</p>
                          <p className="text-xs text-slate-400">{st.score_total}/{st.score_max}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-indigo-500 font-medium bg-indigo-50 px-2 py-1 rounded-md">Resume</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
          {/* Section Tabs - freely navigable */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-2 shadow-sm border border-slate-200">
            {STEP_ORDER.map((step, idx) => {
              const isActive = currentStep === step;
              const isDone = submittedSections.has(step);
              const allDone = submittedSections.has('multipleChoice') && submittedSections.has('trueFalse') && submittedSections.has('fillBlanks');
              const isResults = step === 'results';
              const canClick = isResults ? allDone : true;
              return (
                <div key={step} className="flex-1 flex items-center">
                  <button
                    onClick={() => canClick && setCurrentStep(step)}
                    disabled={!canClick}
                    className={`w-full py-2.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-center ${
                      isActive ? 'bg-indigo-600 text-white shadow-sm' :
                      isDone ? 'bg-green-100 text-green-700 cursor-pointer' :
                      !canClick ? 'text-slate-300 cursor-not-allowed' :
                      'text-slate-600 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    {isDone && !isResults && <CheckCircle2 size={14} className="inline mr-1" />}
                    {isResults && allDone && <Trophy size={14} className="inline mr-1" />}
                    {STEP_LABELS[step]}
                  </button>
                  {idx < STEP_ORDER.length - 1 && (
                    <ArrowRight size={14} className="text-slate-300 mx-0.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* RESULTS */}
          {currentStep === 'results' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                {(() => {
                  const s = getTotalScore();
                  const pct = s.max > 0 ? Math.round((s.total / s.max) * 100) : 0;
                  const color = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600';
                  const bg = pct >= 80 ? 'from-green-50 to-emerald-50' : pct >= 60 ? 'from-yellow-50 to-amber-50' : 'from-red-50 to-orange-50';
                  return (
                    <div className={`bg-gradient-to-br ${bg} rounded-xl p-8`}>
                      <Trophy size={48} className={`mx-auto mb-3 ${color}`} />
                      <p className={`text-5xl font-bold ${color}`}>{pct}%</p>
                      <p className="text-slate-600 mt-2 text-lg">{s.total} / {s.max} correct</p>
                      <div className="flex justify-center gap-8 mt-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-800">{s.mc}/{s.mcTotal}</p>
                          <p className="text-xs text-slate-500 mt-1">Multiple Choice</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-800">{s.tf}/{s.tfTotal}</p>
                          <p className="text-xs text-slate-500 mt-1">True / False</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-800">{s.fill}/{s.fillTotal}</p>
                          <p className="text-xs text-slate-500 mt-1">Fill Blanks</p>
                        </div>
                      </div>
                      <div className="flex justify-center gap-3 mt-6">
                        <button onClick={handleRetry} className="flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-700 rounded-xl font-medium text-sm hover:bg-indigo-50 transition-colors border border-indigo-200">
                          <RotateCcw size={16} /> Try Again
                        </button>
                        <button onClick={handleGenerateTest} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors">
                          <Sparkles size={16} /> New Test
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Review sections - clickable from step bar above */}
              <p className="text-sm text-slate-400 text-center">Click on a completed section above to review your answers.</p>
            </motion.div>
          )}

          {/* MULTIPLE CHOICE */}
          {currentStep === 'multipleChoice' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-lg">Multiple Choice</h3>
                <span className="text-sm text-slate-400">
                  {Object.keys(mcAnswers).length} / {test.multipleChoice.length} answered
                </span>
              </div>
              {test.multipleChoice.map((q: MultipleChoiceQuestion, qi: number) => {
                const userAnswer = mcAnswers[qi];
                const sectionDone = isSectionSubmitted('multipleChoice');
                const checking = isSectionChecking('multipleChoice') && !sectionDone;
                const checkCorrect = checking && userAnswer === q.correctIndex;
                const checkWrong = checking && userAnswer !== undefined && userAnswer !== q.correctIndex;
                const isCorrect = sectionDone && userAnswer === q.correctIndex;
                const isWrong = sectionDone && userAnswer !== undefined && userAnswer !== q.correctIndex;
                return (
                  <div key={qi} className={`bg-white rounded-xl shadow-sm border p-5 ${
                    checkCorrect ? 'border-blue-200' : checkWrong ? 'border-red-200' : 'border-slate-200'
                  }`}>
                    <p className="font-medium text-slate-800 mb-3">
                      <span className="text-indigo-500 mr-2">{qi + 1}.</span>{q.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = userAnswer === oi;
                        const showCorrect = sectionDone && oi === q.correctIndex;
                        const showWrong = sectionDone && isSelected && oi !== q.correctIndex;
                        // Check mode: only highlight the user's selected answer
                        const checkBlue = checking && isSelected && userAnswer === q.correctIndex;
                        const checkRed = checking && isSelected && userAnswer !== q.correctIndex;
                        return (
                          <button
                            key={oi}
                            onClick={() => !sectionDone && setMcAnswers(prev => ({ ...prev, [qi]: oi }))}
                            disabled={sectionDone}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left text-sm transition-all ${
                              showCorrect ? 'border-green-400 bg-green-50 text-green-800' :
                              showWrong ? 'border-red-400 bg-red-50 text-red-800' :
                              checkBlue ? 'border-blue-400 bg-blue-50 text-blue-800' :
                              checkRed ? 'border-red-300 bg-red-50/50 text-red-700' :
                              isSelected ? 'border-indigo-400 bg-indigo-50 text-indigo-800' :
                              'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                              showCorrect ? 'border-green-500 bg-green-500 text-white' :
                              showWrong ? 'border-red-500 bg-red-500 text-white' :
                              checkBlue ? 'border-blue-500 bg-blue-500 text-white' :
                              checkRed ? 'border-red-400 bg-red-400 text-white' :
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
                    {isWrong && <p className="text-xs text-green-600 mt-2">Correct: {q.options[q.correctIndex]}</p>}
                  </div>
                );
              })}

              {/* Section Submit */}
              {!isSectionSubmitted('multipleChoice') && (
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleCheckAnswer('multipleChoice')}
                    className={`flex items-center gap-2 font-medium py-3 px-5 rounded-xl shadow-sm transition-all text-sm ${
                      isSectionChecking('multipleChoice')
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Eye size={16} /> {isSectionChecking('multipleChoice') ? 'Hide Check' : 'Check Answer'}
                  </button>
                  <button
                    onClick={handleSubmitSection}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl shadow-sm transition-all"
                  >
                    <ClipboardCheck size={18} /> Submit
                  </button>
                </div>
              )}
              {isSectionSubmitted('multipleChoice') && (
                <div className="flex justify-between items-center pt-2">
                  <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={16} /> Score: {getMcScore().correct} / {getMcScore().total}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TRUE / FALSE */}
          {currentStep === 'trueFalse' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-lg">True / False</h3>
                <span className="text-sm text-slate-400">
                  {Object.keys(tfAnswers).length} / {test.trueFalse.length} answered
                </span>
              </div>
              {test.trueFalse.map((q: TrueFalseQuestion, qi: number) => {
                const userAnswer = tfAnswers[qi];
                const answered = userAnswer !== undefined;
                const sectionDone = isSectionSubmitted('trueFalse');
                const checking = isSectionChecking('trueFalse') && !sectionDone;
                const checkCorrect = checking && answered && userAnswer === q.correct;
                const checkWrong = checking && answered && userAnswer !== q.correct;
                const isCorrect = sectionDone && answered && userAnswer === q.correct;
                const isWrong = sectionDone && answered && userAnswer !== q.correct;
                return (
                  <div key={qi} className={`bg-white rounded-xl shadow-sm border p-5 ${
                    isCorrect ? 'border-green-300' : isWrong ? 'border-red-300' :
                    checkCorrect ? 'border-blue-200' : checkWrong ? 'border-red-200' : 'border-slate-200'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium text-slate-800 flex-1">
                        <span className="text-indigo-500 mr-2">{qi + 1}.</span>{q.statement}
                      </p>
                      {sectionDone && (
                        isCorrect ? <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" /> :
                        isWrong ? <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" /> : null
                      )}
                    </div>
                    <div className="flex gap-3 mt-3">
                      {[true, false].map(val => {
                        const isSelected = userAnswer === val;
                        const showCorrect = sectionDone && val === q.correct;
                        const showWrong = sectionDone && isSelected && val !== q.correct;
                        const checkBlue = checking && isSelected && userAnswer === q.correct;
                        const checkRed = checking && isSelected && userAnswer !== q.correct;
                        return (
                          <button
                            key={String(val)}
                            onClick={() => !sectionDone && setTfAnswers(prev => ({ ...prev, [qi]: val }))}
                            disabled={sectionDone}
                            className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                              showCorrect ? 'border-green-400 bg-green-50 text-green-700' :
                              showWrong ? 'border-red-400 bg-red-50 text-red-700' :
                              checkBlue ? 'border-blue-400 bg-blue-50 text-blue-700' :
                              checkRed ? 'border-red-300 bg-red-50/50 text-red-600' :
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

              {!isSectionSubmitted('trueFalse') && (
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleCheckAnswer('trueFalse')}
                    className={`flex items-center gap-2 font-medium py-3 px-5 rounded-xl shadow-sm transition-all text-sm ${
                      isSectionChecking('trueFalse')
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Eye size={16} /> {isSectionChecking('trueFalse') ? 'Hide Check' : 'Check Answer'}
                  </button>
                  <button
                    onClick={handleSubmitSection}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl shadow-sm transition-all"
                  >
                    <ClipboardCheck size={18} /> Submit
                  </button>
                </div>
              )}
              {isSectionSubmitted('trueFalse') && (
                <div className="flex justify-between items-center pt-2">
                  <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={16} /> Score: {getTfScore().correct} / {getTfScore().total}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* FILL IN BLANKS */}
          {currentStep === 'fillBlanks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-lg">Fill in the Blanks</h3>
                <span className="text-sm text-slate-400">
                  {Object.values(fillAnswers).filter((v: string) => v.trim()).length} / {test.fillBlanks.blanks.length} filled
                </span>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6">
                <p className="text-sm text-slate-500 mb-4">Fill in the missing words from the transcript.</p>
                <div className="text-base leading-[2.5] text-slate-700">
                  {(() => {
                    const sectionDone = isSectionSubmitted('fillBlanks');
                    const checking = isSectionChecking('fillBlanks') && !sectionDone;
                    const parts = test.fillBlanks.textWithBlanks.split(/(___BLANK_\d+___)/g);
                    return parts.map((part, i) => {
                      const blankMatch = part.match(/___BLANK_(\d+)___/);
                      if (!blankMatch) return <span key={i}>{part}</span>;

                      const blankIndex = parseInt(blankMatch[1]) - 1;
                      const userVal = fillAnswers[blankIndex] || '';
                      const correctVal = test.fillBlanks.blanks[blankIndex];
                      const isCorrect = sectionDone && userVal.trim().toLowerCase() === correctVal?.trim().toLowerCase();
                      const isWrong = sectionDone && userVal.trim().toLowerCase() !== correctVal?.trim().toLowerCase();
                      const checkCorrect = checking && userVal.trim() && userVal.trim().toLowerCase() === correctVal?.trim().toLowerCase();
                      const checkWrong = checking && userVal.trim() && userVal.trim().toLowerCase() !== correctVal?.trim().toLowerCase();

                      return (
                        <span key={i} className="inline-flex items-center mx-1 align-baseline">
                          <span className="text-xs text-indigo-400 mr-1 font-mono">{blankIndex + 1}</span>
                          <input
                            type="text"
                            value={userVal}
                            onChange={(e) => !sectionDone && setFillAnswers(prev => ({ ...prev, [blankIndex]: e.target.value }))}
                            disabled={sectionDone}
                            placeholder="..."
                            className={`w-28 sm:w-36 border-b-2 bg-transparent text-center text-sm py-0.5 focus:outline-none transition-colors ${
                              isCorrect ? 'border-green-500 text-green-700' :
                              isWrong ? 'border-red-500 text-red-700' :
                              checkCorrect ? 'border-blue-500 text-blue-700' :
                              checkWrong ? 'border-red-400 text-red-600' :
                              'border-indigo-300 focus:border-indigo-500 text-slate-800'
                            }`}
                          />
                          {isWrong && <span className="text-xs text-green-600 ml-1">({correctVal})</span>}
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>

              {!isSectionSubmitted('fillBlanks') && (
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleCheckAnswer('fillBlanks')}
                    className={`flex items-center gap-2 font-medium py-3 px-5 rounded-xl shadow-sm transition-all text-sm ${
                      isSectionChecking('fillBlanks')
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Eye size={16} /> {isSectionChecking('fillBlanks') ? 'Hide Check' : 'Check Answer'}
                  </button>
                  <button
                    onClick={handleSubmitSection}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl shadow-sm transition-all"
                  >
                    <ClipboardCheck size={18} /> Submit & See Results
                  </button>
                </div>
              )}
              {isSectionSubmitted('fillBlanks') && (
                <div className="flex justify-between items-center pt-2">
                  <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={16} /> Score: {getFillScore().correct} / {getFillScore().total}
                  </p>
                </div>
              )}
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
