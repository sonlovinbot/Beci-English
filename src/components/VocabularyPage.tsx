import { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import {
  GraduationCap, Plus, ListChecks, Brain, Search, Check, Loader2, Trash2,
  ArrowLeft, ArrowRight, Volume2, Image as ImageIcon, BookOpen, Sparkles,
  Eye, CheckCircle2, XCircle, Trophy, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  type VocabularyWord,
  addWordsBulk,
  addWord,
  loadMyVocabulary,
  loadDueVocabulary,
  updateWordSrs,
  deleteWord,
  enrichWord,
  getWordsInMyList,
} from '../lib/vocabularyService';
import { WORD_LISTS, type WordListSource, type SeedWord } from '../data/wordLists';
import { fetchDictionary, fetchPexelsImage } from '../lib/dictionaryApi';
import { extractTextFromImage } from '../lib/gemini';

type Tab = 'add' | 'list' | 'review';
type FilterLevel = 'all' | 'due' | '1' | '2' | '3' | '4' | '5';

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-700 border-red-300',
  2: 'bg-orange-100 text-orange-700 border-orange-300',
  3: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  4: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  5: 'bg-blue-100 text-blue-700 border-blue-300',
};

export function VocabularyPage() {
  const [tab, setTab] = useState<Tab>('add');
  const [myWords, setMyWords] = useState<VocabularyWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMyWords = async () => {
    setIsLoading(true);
    const data = await loadMyVocabulary();
    setMyWords(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMyWords();
  }, []);

  const dueCount = useMemo(() => {
    const now = new Date();
    return myWords.filter(w => new Date(w.next_review_at) <= now).length;
  }, [myWords]);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <GraduationCap className="text-indigo-500" size={32} />
          Vocabulary
        </h2>
        <p className="text-slate-500 mt-2 text-base md:text-lg">Học từ vựng với phương pháp lặp lại ngắt quãng.</p>
      </header>

      {/* Tab bar */}
      <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-sm border border-slate-200 mb-6">
        {([
          { key: 'add' as Tab, label: 'Thêm từ', icon: <Plus size={16} /> },
          { key: 'list' as Tab, label: `Danh sách (${myWords.length})`, icon: <ListChecks size={16} /> },
          { key: 'review' as Tab, label: 'Ôn tập', icon: <Brain size={16} />, badge: dueCount },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all relative ${
              tab === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'add' && <AddTab onAdded={fetchMyWords} />}
      {tab === 'list' && <MyListTab words={myWords} isLoading={isLoading} onRefresh={fetchMyWords} />}
      {tab === 'review' && <ReviewTab onDone={fetchMyWords} />}
    </div>
  );
}

// =========================================================================
// Tab 1: Add Vocabulary
// =========================================================================

function AddTab({ onAdded }: { onAdded: () => void }) {
  const [subTab, setSubTab] = useState<'list' | 'ocr'>('list');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setSubTab('list')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            subTab === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <BookOpen size={14} className="inline mr-1.5" /> Từ danh sách có sẵn
        </button>
        <button
          onClick={() => setSubTab('ocr')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            subTab === 'ocr' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <ImageIcon size={14} className="inline mr-1.5" /> Upload ảnh sách
        </button>
      </div>

      {subTab === 'list' ? <AddFromList onAdded={onAdded} /> : <AddFromOcr onAdded={onAdded} />}
    </div>
  );
}

// --- Tab 1a: From preset list ---

function AddFromList({ onAdded }: { onAdded: () => void }) {
  const [source, setSource] = useState<WordListSource>('oxford3000');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alreadyAdded, setAlreadyAdded] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [addProgress, setAddProgress] = useState<{ done: number; total: number } | null>(null);

  const list = WORD_LISTS[source];

  useEffect(() => {
    // Check which words user already has
    const allWords = list.words.map(w => w.word);
    getWordsInMyList(allWords).then(set => setAlreadyAdded(set));
    setSelected(new Set());
  }, [source]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return list.words;
    return list.words.filter(w =>
      w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
    );
  }, [query, list.words]);

  const toggle = (word: string) => {
    if (alreadyAdded.has(word.toLowerCase())) return;
    const next = new Set(selected);
    if (next.has(word)) next.delete(word);
    else next.add(word);
    setSelected(next);
  };

  const handleAddSelected = async () => {
    const seedWords = list.words.filter(w => selected.has(w.word));
    if (seedWords.length === 0) return;

    setIsAdding(true);
    setAddProgress({ done: 0, total: seedWords.length });

    // Add each word, lazily enrich with dictionary + image in parallel
    let done = 0;
    for (const w of seedWords) {
      const inserted = await addWord({
        word: w.word,
        part_of_speech: w.pos,
        meaning_vi: w.meaning,
        source,
      });

      // Fire-and-forget enrichment — don't block the add flow
      if (inserted) {
        Promise.all([fetchDictionary(w.word), fetchPexelsImage(w.word)])
          .then(([dict, img]) => {
            if (!dict && !img) return;
            enrichWord(inserted.id, {
              phonetic: dict?.phonetic || null,
              audio_url: dict?.audio || null,
              meaning_en: dict?.meaningEn || null,
              example_en: dict?.example || null,
              synonyms: dict?.synonyms?.length ? dict.synonyms : null,
              antonyms: dict?.antonyms?.length ? dict.antonyms : null,
              image_url: img,
            });
          })
          .catch(() => {});
      }

      done++;
      setAddProgress({ done, total: seedWords.length });
    }

    setIsAdding(false);
    setAddProgress(null);
    setSelected(new Set());

    // Refresh "already added" set and parent
    const allWords = list.words.map(w => w.word);
    getWordsInMyList(allWords).then(set => setAlreadyAdded(set));
    onAdded();
  };

  return (
    <>
      {/* Source + search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex gap-2">
          {(Object.keys(WORD_LISTS) as WordListSource[]).map(key => (
            <button
              key={key}
              onClick={() => setSource(key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                source === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {WORD_LISTS[key].label}
              <span className="ml-2 text-xs opacity-75">({WORD_LISTS[key].words.length})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm theo từ hoặc nghĩa tiếng Việt..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Word cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(w => {
          const already = alreadyAdded.has(w.word.toLowerCase());
          const isSelected = selected.has(w.word);
          return (
            <button
              key={w.word}
              onClick={() => toggle(w.word)}
              disabled={already}
              className={`bg-white rounded-xl border-2 p-4 text-left transition-all ${
                already ? 'border-slate-200 opacity-50 cursor-not-allowed' :
                isSelected ? 'border-indigo-500 shadow-md' : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="font-semibold text-slate-800">{w.word}</h4>
                {already ? (
                  <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Đã có</span>
                ) : isSelected ? (
                  <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                ) : (
                  <div className="w-5 h-5 border-2 border-slate-300 rounded-full" />
                )}
              </div>
              <p className="text-xs text-slate-400 italic">{w.pos}</p>
              <p className="text-sm text-slate-600 mt-1">{w.meaning}</p>
            </button>
          );
        })}
      </div>

      {/* Floating add button */}
      {selected.size > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30"
        >
          <button
            onClick={handleAddSelected}
            disabled={isAdding}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-6 rounded-full shadow-lg transition-all flex items-center gap-2"
          >
            {isAdding ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Đang thêm {addProgress?.done}/{addProgress?.total}...
              </>
            ) : (
              <>
                <Plus size={18} />
                Thêm {selected.size} từ vào danh sách của tôi
              </>
            )}
          </button>
        </motion.div>
      )}
    </>
  );
}

// --- Tab 1b: OCR Upload ---

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'as', 'from', 'into',
  'and', 'or', 'but', 'so', 'if', 'that', 'this', 'these', 'those', 'there',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'can', 'not', 'no', 'yes', 'all', 'some', 'any', 'each',
  'more', 'most', 'much', 'many', 'very', 'too', 'also', 'just', 'only', 'than',
  'then', 'when', 'where', 'why', 'how', 'what', 'who', 'which', 'whose',
  'one', 'two', 'three', 'here', 'out', 'up', 'down', 'over', 'under', 'about',
]);

function extractCandidateWords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s-']/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  return [...new Set(tokens)].slice(0, 200);
}

function AddFromOcr({ onAdded }: { onAdded: () => void }) {
  const [text, setText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alreadyAdded, setAlreadyAdded] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [addProgress, setAddProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsExtracting(true);
    setError(null);
    try {
      const results: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const t = await extractTextFromImage(files[i]);
        results.push(t);
      }
      setText(results.join('\n\n'));
    } catch (err) {
      setError('Không trích xuất được text từ ảnh. Thử lại nhé.');
      console.error(err);
    } finally {
      setIsExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleConfirmText = async () => {
    const words = extractCandidateWords(text);
    if (words.length === 0) {
      setError('Không tìm thấy từ nào đáng học. Kiểm tra lại text.');
      return;
    }
    setCandidates(words);
    const already = await getWordsInMyList(words);
    setAlreadyAdded(already);
    setSelected(new Set(words.filter(w => !already.has(w))));
  };

  const toggle = (word: string) => {
    if (alreadyAdded.has(word)) return;
    const next = new Set(selected);
    if (next.has(word)) next.delete(word);
    else next.add(word);
    setSelected(next);
  };

  const handleAddSelected = async () => {
    const list = [...selected];
    if (list.length === 0) return;
    setIsAdding(true);
    setAddProgress({ done: 0, total: list.length });

    let done = 0;
    for (const word of list) {
      // Lazy dictionary fetch to get meaning
      const dict = await fetchDictionary(word);
      const inserted = await addWord({
        word,
        phonetic: dict?.phonetic || undefined,
        part_of_speech: dict?.partOfSpeech || undefined,
        meaning_en: dict?.meaningEn || undefined,
        example_en: dict?.example || undefined,
        audio_url: dict?.audio || undefined,
        synonyms: dict?.synonyms?.length ? dict.synonyms : undefined,
        antonyms: dict?.antonyms?.length ? dict.antonyms : undefined,
        source: 'ocr',
      });

      if (inserted) {
        fetchPexelsImage(word).then(img => {
          if (img) enrichWord(inserted.id, { image_url: img });
        }).catch(() => {});
      }

      done++;
      setAddProgress({ done, total: list.length });
    }

    setIsAdding(false);
    setAddProgress(null);
    setCandidates([]);
    setSelected(new Set());
    setText('');
    onAdded();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Upload area */}
      {candidates.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isExtracting}
            className="w-full py-6 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex flex-col items-center gap-2"
          >
            {isExtracting ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm">Đang đọc ảnh...</span>
              </>
            ) : (
              <>
                <ImageIcon size={24} />
                <span className="text-sm">Chọn 1 hoặc nhiều ảnh sách tiếng Anh</span>
              </>
            )}
          </button>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Text trích xuất sẽ hiện ở đây. Bạn có thể sửa nếu OCR sai..."
            className="w-full h-48 p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y"
          />

          {text.trim() && (
            <button
              onClick={handleConfirmText}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles size={16} /> Tách các từ đáng học
            </button>
          )}
        </div>
      )}

      {/* Candidate words */}
      {candidates.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Tìm thấy <strong className="text-slate-800">{candidates.length}</strong> từ, đã chọn {selected.size}.
            </p>
            <button
              onClick={() => { setCandidates([]); setSelected(new Set()); setText(''); }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Làm lại
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {candidates.map(w => {
              const already = alreadyAdded.has(w);
              const isSelected = selected.has(w);
              return (
                <button
                  key={w}
                  onClick={() => toggle(w)}
                  disabled={already}
                  className={`px-3 py-2 rounded-lg border-2 text-sm text-left transition-all ${
                    already ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' :
                    isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' :
                    'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {w} {already && <span className="text-[9px] ml-1">(đã có)</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Floating add button */}
      {selected.size > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30"
        >
          <button
            onClick={handleAddSelected}
            disabled={isAdding}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-6 rounded-full shadow-lg transition-all flex items-center gap-2"
          >
            {isAdding ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Đang thêm {addProgress?.done}/{addProgress?.total}...
              </>
            ) : (
              <>
                <Plus size={18} />
                Thêm {selected.size} từ
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
}

// =========================================================================
// Tab 2: My List
// =========================================================================

function MyListTab({
  words,
  isLoading,
  onRefresh,
}: {
  words: VocabularyWord[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [query, setQuery] = useState('');

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    let list = words;
    if (filter === 'due') {
      list = list.filter(w => new Date(w.next_review_at) <= now);
    } else if (filter !== 'all') {
      list = list.filter(w => w.srs_level === parseInt(filter));
    }
    const q = query.toLowerCase().trim();
    if (q) {
      list = list.filter(w =>
        w.word.toLowerCase().includes(q) ||
        (w.meaning_vi || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [words, filter, query, now]);

  const dueCount = useMemo(
    () => words.filter(w => new Date(w.next_review_at) <= now).length,
    [words, now]
  );

  const handleDelete = async (id: string) => {
    const ok = await deleteWord(id);
    if (ok) onRefresh();
  };

  const daysUntilReview = (dateStr: string): string => {
    const d = new Date(dateStr);
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (diff <= 0) return 'Đến hạn ôn';
    if (diff === 1) return 'Còn 1 ngày';
    return `Còn ${diff} ngày`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
        <Loader2 size={20} className="animate-spin" /> Đang tải...
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <ListChecks size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg">Chưa có từ nào. Thêm từ ở tab "Thêm từ" nhé!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md p-4 text-white flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">Đang học <strong>{words.length}</strong> từ</p>
          {dueCount > 0 && (
            <p className="text-xs opacity-75 mt-0.5">{dueCount} từ đến hạn ôn</p>
          )}
        </div>
      </div>

      {/* Filter + search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([
            { v: 'all' as FilterLevel, label: 'Tất cả' },
            { v: 'due' as FilterLevel, label: `Đến hạn (${dueCount})`, red: true },
            { v: '1' as FilterLevel, label: 'Mức 1' },
            { v: '2' as FilterLevel, label: 'Mức 2' },
            { v: '3' as FilterLevel, label: 'Mức 3' },
            { v: '4' as FilterLevel, label: 'Mức 4' },
            { v: '5' as FilterLevel, label: 'Mức 5' },
          ]).map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.v
                  ? f.red ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm từ..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(w => (
          <div key={w.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group">
            <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
              {w.image_url ? (
                <img src={w.image_url} alt={w.word} className="w-full h-full object-cover" />
              ) : (
                <div className="text-slate-400 text-xs">Chưa có ảnh</div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-800 truncate">{w.word}</h4>
                  {w.phonetic && <p className="text-xs text-slate-400">/{w.phonetic}/</p>}
                </div>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="Xoá"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-sm text-slate-600 truncate">{w.meaning_vi || '—'}</p>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[w.srs_level]}`}>
                  Mức {w.srs_level}
                </span>
                <span className={`text-[10px] ${new Date(w.next_review_at) <= now ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                  {daysUntilReview(w.next_review_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// Tab 3: Review
// =========================================================================

function ReviewTab({ onDone }: { onDone: () => void }) {
  const [queue, setQueue] = useState<VocabularyWord[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<{ correct: number; wrong: number }>({ correct: 0, wrong: 0 });

  useEffect(() => {
    loadDueVocabulary(20).then(data => {
      setQueue(data);
      setIsLoading(false);
      setIdx(0);
      setRevealed(false);
      setFinished(data.length === 0);
      setResults({ correct: 0, wrong: 0 });
    });
  }, []);

  const current = queue[idx];

  // Keyboard shortcuts
  useEffect(() => {
    if (finished || isLoading) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && e.key === '1') {
        rate(false);
      } else if (revealed && e.key === '2') {
        rate(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const rate = async (remembered: boolean) => {
    if (!current) return;
    await updateWordSrs(current.id, remembered);
    setResults(r => ({
      correct: r.correct + (remembered ? 1 : 0),
      wrong: r.wrong + (remembered ? 0 : 1),
    }));

    if (idx + 1 >= queue.length) {
      setFinished(true);
      onDone();
    } else {
      setIdx(idx + 1);
      setRevealed(false);
    }
  };

  const playAudio = () => {
    if (current?.audio_url) {
      new Audio(current.audio_url).play().catch(() => {});
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
        <Loader2 size={20} className="animate-spin" /> Đang tải...
      </div>
    );
  }

  if (finished) {
    const total = results.correct + results.wrong;
    return (
      <div className="text-center py-12">
        {total === 0 ? (
          <>
            <Trophy size={64} className="mx-auto mb-4 text-amber-400" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Hoàn thành! Quay lại sau.</h3>
            <p className="text-slate-500 text-sm">Không có từ nào đến hạn ôn hôm nay.</p>
            <p className="text-slate-500 text-sm mt-1">Trong lúc chờ, bạn có thể thêm từ mới ở tab "Thêm từ".</p>
          </>
        ) : (
          <>
            <Trophy size={64} className="mx-auto mb-4 text-amber-400" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Xong phiên ôn!</h3>
            <p className="text-slate-600 mb-1">Đã ôn <strong>{total}</strong> từ</p>
            <p className="text-sm text-slate-500">
              Đúng: <strong className="text-green-600">{results.correct}</strong>
              {' · '}
              Không nhớ: <strong className="text-red-600">{results.wrong}</strong>
            </p>
            <button
              onClick={() => {
                setIsLoading(true);
                loadDueVocabulary(20).then(data => {
                  setQueue(data);
                  setIdx(0);
                  setRevealed(false);
                  setFinished(data.length === 0);
                  setResults({ correct: 0, wrong: 0 });
                  setIsLoading(false);
                });
              }}
              className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-xl transition-colors inline-flex items-center gap-2"
            >
              <RotateCcw size={16} /> Ôn tiếp
            </button>
          </>
        )}
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{idx + 1} / {queue.length} từ</span>
        <div className="flex-1 mx-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${((idx) / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-xs">
          <CheckCircle2 size={12} className="inline text-green-500" /> {results.correct}
          {' · '}
          <XCircle size={12} className="inline text-red-500" /> {results.wrong}
        </span>
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden"
        >
          {/* Image */}
          <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
            {current.image_url ? (
              <img src={current.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-400 text-sm">Chưa có ảnh</div>
            )}
          </div>

          <div className="p-6 md:p-8">
            {/* Word + phonetic + audio (always visible) */}
            <div className="text-center">
              <h3 className="text-3xl md:text-4xl font-bold text-slate-800">{current.word}</h3>
              {(current.phonetic || current.audio_url) && (
                <p className="text-slate-500 mt-2 flex items-center justify-center gap-2">
                  {current.phonetic && <span>/{current.phonetic}/</span>}
                  {current.audio_url && (
                    <button
                      onClick={playAudio}
                      className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-colors"
                      title="Phát âm"
                    >
                      <Volume2 size={18} />
                    </button>
                  )}
                </p>
              )}
              {current.part_of_speech && (
                <p className="text-xs text-slate-400 italic mt-1">{current.part_of_speech}</p>
              )}
            </div>

            {/* English hints (always visible — guess the meaning) */}
            <div className="mt-6 space-y-3">
              {current.meaning_en && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Definition</p>
                  <p className="text-sm text-slate-700">{current.meaning_en}</p>
                </div>
              )}

              {current.example_en && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold mb-1">Example</p>
                  <p className="text-sm text-slate-700 italic">"{current.example_en}"</p>
                </div>
              )}

              {current.synonyms && current.synonyms.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold mb-2">Synonyms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {current.synonyms.slice(0, 8).map(s => (
                      <span key={s} className="text-xs bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {current.antonyms && current.antonyms.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-rose-600 font-semibold mb-2">Antonyms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {current.antonyms.slice(0, 6).map(s => (
                      <span key={s} className="text-xs bg-white text-rose-700 border border-rose-200 px-2 py-0.5 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!current.meaning_en && !current.example_en && !(current.synonyms && current.synonyms.length) && !(current.antonyms && current.antonyms.length) && (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-6 text-center">
                  <p className="text-xs text-slate-400">Chưa có thông tin tiếng Anh. Bấm hiện đáp án để xem nghĩa tiếng Việt.</p>
                </div>
              )}
            </div>

            {/* Reveal button or Vietnamese answer */}
            {!revealed && (
              <div className="mt-6 text-center">
                <p className="text-slate-400 text-sm mb-3">Đoán nghĩa rồi bấm để kiểm tra</p>
                <button
                  onClick={() => setRevealed(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl inline-flex items-center gap-2"
                >
                  <Eye size={18} /> Hiện nghĩa tiếng Việt
                </button>
                <p className="text-xs text-slate-400 mt-2">Phím tắt: Space</p>
              </div>
            )}

            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 space-y-3 overflow-hidden"
                >
                  {/* Vietnamese meaning */}
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-1">Nghĩa tiếng Việt</p>
                    <p className="text-xl font-semibold text-slate-800">{current.meaning_vi || '—'}</p>
                    {current.example_vi && (
                      <p className="text-xs text-slate-500 mt-2 italic">→ {current.example_vi}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => rate(false)}
                      className="bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle size={18} /> Không nhớ
                      <span className="text-[10px] opacity-70">[1]</span>
                    </button>
                    <button
                      onClick={() => rate(true)}
                      className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} /> Nhớ rồi
                      <span className="text-[10px] opacity-70">[2]</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
