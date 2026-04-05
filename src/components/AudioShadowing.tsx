import { useState, useRef, ChangeEvent, useEffect, MouseEvent, ClipboardEvent } from 'react';
import { Play, Loader2, Image as ImageIcon, Volume2, Settings2, BookOpen, User, Headphones, History, Trash2, Volume1, Mic, Pencil, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { extractTextFromImage, generateAudio, suggestTitle } from '../lib/gemini';
import { pcmBase64ToWavBlob } from '../lib/audioUtils';
import { ShadowingPlayer } from './ShadowingPlayer';
import {
  saveGeneration,
  loadHistory,
  deleteGeneration,
  updateGenerationTitle,
  getAudioPublicUrl,
  type AudioGeneration,
} from '../lib/storageService';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const STYLES = [
  { label: 'Default', value: '' },
  { label: 'Slowly & Clearly', value: 'slowly and clearly, enunciating every word' },
  { label: 'Cheerful', value: 'cheerfully and energetically' },
  { label: 'Professional', value: 'in a professional and calm tone' },
  { label: 'Storyteller', value: 'like a storyteller, with dramatic pauses' }
];

export function AudioShadowing() {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [voice, setVoice] = useState('Kore');
  const [style, setStyle] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [history, setHistory] = useState<AudioGeneration[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  
  const [isShadowingMode, setIsShadowingMode] = useState(false);
  const [shadowingData, setShadowingData] = useState<{text: string, audioUrl: string} | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load history from Supabase on mount
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      const items = await loadHistory(20);
      setHistory(items);
      setIsLoadingHistory(false);
    };
    fetchHistory();
  }, []);

  const handleSaveGeneration = async (newTitle: string, newText: string, newVoice: string, newStyle: string, base64Audio: string): Promise<boolean> => {
    const saved = await saveGeneration(newTitle, newText, newVoice, newStyle, base64Audio);
    if (saved) {
      setHistory(prev => [saved, ...prev]);
      return true;
    }
    return false;
  };

  const loadHistoryItem = (item: AudioGeneration) => {
    setText(item.text);
    setTitle(item.title || '');
    setVoice(item.voice);
    setStyle(item.style);
    if (item.audio_storage_path) {
      const url = getAudioPublicUrl(item.audio_storage_path);
      setAudioUrl(url);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteHistoryItem = async (id: string, storagePath: string | null, e: MouseEvent) => {
    e.stopPropagation();
    const success = await deleteGeneration(id, storagePath);
    if (success) {
      setHistory(prev => prev.filter(h => h.id !== id));
    }
  };

  const handleStartEditTitle = (item: AudioGeneration, e: MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(item.id);
    setEditingTitleValue(item.title || '');
  };

  const handleSaveEditTitle = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    const newTitle = editingTitleValue.trim() || 'Untitled Lesson';
    const success = await updateGenerationTitle(id, newTitle);
    if (success) {
      setHistory(prev => prev.map(h => h.id === id ? { ...h, title: newTitle } : h));
    } else {
      setError('Failed to save title. Please check your Supabase UPDATE policy.');
    }
    setEditingTitleId(null);
  };

  const openShadowingMode = (textToShadow: string, urlToShadow: string) => {
    setShadowingData({ text: textToShadow, audioUrl: urlToShadow });
    setIsShadowingMode(true);
  };

  const processImageFile = async (file: File) => {
    setIsExtracting(true);
    setError(null);
    try {
      const extractedText = await extractTextFromImage(file);
      // Clear previous content and audio, replace with new extracted text
      setText(extractedText);
      setTitle('');
      setAudioUrl(null);
    } catch (err) {
      setError('Failed to extract text from image. Please try again.');
      console.error(err);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processImageFile(file);
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await processImageFile(file);
        }
        break;
      }
    }
  };

  const handlePreviewVoice = async (voiceName: string, e: MouseEvent) => {
    e.stopPropagation();
    if (previewingVoice) return;
    
    setPreviewingVoice(voiceName);
    try {
      // Keep voice preview caching in localStorage (small data, fast access)
      const cacheKey = `beci_preview_${voiceName}`;
      let base64 = localStorage.getItem(cacheKey);
      
      if (!base64) {
        base64 = await generateAudio(`Hi, I am ${voiceName}. This is how I sound.`, voiceName, '');
        try {
          localStorage.setItem(cacheKey, base64);
        } catch (e) {
          // Ignore quota errors for previews
        }
      }
      
      const blob = pcmBase64ToWavBlob(base64);
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    } catch (err) {
      console.error("Preview failed", err);
    } finally {
      setPreviewingVoice(null);
    }
  };

  const handleGenerateAudio = async () => {
    if (!text.trim()) {
      setError('Please enter some text to generate audio.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);

    try {
      // Generate audio and suggest title in parallel
      const [base64Audio, suggested] = await Promise.all([
        generateAudio(text, voice, style),
        title.trim() ? Promise.resolve(title) : suggestTitle(text),
      ]);

      const suggestedTitle = title.trim() || suggested;
      setTitle(suggestedTitle);

      const blob = pcmBase64ToWavBlob(base64Audio);
      const url = URL.createObjectURL(blob);

      setAudioUrl(url);

      // Save to Supabase and show error if it fails
      const saved = await handleSaveGeneration(suggestedTitle, text, voice, style, base64Audio);
      if (!saved) {
        setError('Audio generated but failed to save. Check console for details.');
      }
    } catch (err) {
      setError('Failed to generate audio. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <audio ref={audioRef} className="hidden" />
      
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Audio & Shadowing</h2>
        <p className="text-slate-500 mt-2 text-base md:text-lg">Convert text to natural-sounding speech. Paste an image directly to extract text!</p>
      </header>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm md:text-base"
        >
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-500" />
                Reading Text
              </h3>
              
              <div className="w-full sm:w-auto">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtracting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 sm:py-1.5 rounded-md transition-colors disabled:opacity-50"
                >
                  {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                  {isExtracting ? 'Extracting...' : 'Upload Image'}
                </button>
              </div>
            </div>
            
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Paste your English text here, or paste (Ctrl+V) an image to extract text..."
              className="w-full h-64 md:h-80 p-4 md:p-6 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 leading-relaxed text-base md:text-lg"
            />
          </div>
        </div>

        {/* Right Column: Controls & Output */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4 md:mb-6">
              <Settings2 size={18} className="text-indigo-500" />
              Voice Settings
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <User size={16} className="text-slate-400" />
                  Voice Model
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VOICES.map(v => (
                    <div key={v} className="relative flex">
                      <button
                        onClick={() => setVoice(v)}
                        className={`flex-1 px-3 py-2 text-sm rounded-l-lg border transition-all text-left ${
                          voice === v 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium shadow-sm z-10' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {v}
                      </button>
                      <button
                        onClick={(e) => handlePreviewVoice(v, e)}
                        disabled={previewingVoice !== null}
                        title="Preview Voice"
                        className={`px-2 py-2 border-y border-r rounded-r-lg transition-colors flex items-center justify-center ${
                          voice === v ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                        } disabled:opacity-50`}
                      >
                        {previewingVoice === v ? <Loader2 size={14} className="animate-spin" /> : <Volume1 size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Volume2 size={16} className="text-slate-400" />
                  Reading Style
                </label>
                <select 
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm md:text-base"
                >
                  {STYLES.map(s => (
                    <option key={s.label} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="mt-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lesson Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Auto-suggested when you generate audio..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
              </div>

              <button
                onClick={handleGenerateAudio}
                disabled={isGenerating || !text.trim()}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating Audio...
                  </>
                ) : (
                  <>
                    <Headphones size={18} />
                    Generate Audio
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Audio Player */}
          {audioUrl && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-md p-4 md:p-6 text-white"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center gap-2 min-w-0">
                  <Play size={18} className="fill-white shrink-0" />
                  <span className="truncate">{title || 'Ready to Shadow'}</span>
                </h3>
                <button
                  onClick={() => openShadowingMode(text, audioUrl)}
                  className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Mic size={16} /> Shadowing Mode
                </button>
              </div>
              <audio 
                controls 
                src={audioUrl} 
                className="w-full h-10 md:h-12 rounded-lg outline-none"
                autoPlay
              />
              <p className="text-indigo-100 text-xs md:text-sm mt-4 text-center">
                Listen carefully and repeat after the speaker.
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* History Section */}
      {isLoadingHistory ? (
        <div className="mt-8 md:mt-12 flex items-center justify-center gap-2 text-slate-400 py-8">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading history...</span>
        </div>
      ) : history.length > 0 && (
        <div className="mt-8 md:mt-12">
          <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2 mb-4 md:mb-6">
            <History className="text-indigo-500" />
            Recent Generations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((item) => (
              <div 
                key={item.id} 
                onClick={() => loadHistoryItem(item)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    {editingTitleId === item.id ? (
                      <div className="flex items-center gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditTitle(item.id, e as unknown as MouseEvent); }}
                          className="flex-1 text-sm font-semibold text-slate-800 border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button
                          onClick={(e) => handleSaveEditTitle(item.id, e)}
                          className="text-green-600 hover:text-green-700 p-0.5"
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mb-1 group/title">
                        <h4 className="font-semibold text-slate-800 text-sm truncate">{item.title || 'Untitled Lesson'}</h4>
                        <button
                          onClick={(e) => handleStartEditTitle(item, e)}
                          className="text-slate-300 hover:text-indigo-500 opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 shrink-0"
                          title="Edit title"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-md">
                        {item.voice}
                      </span>
                      {item.style && (
                        <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md truncate max-w-[100px]">
                          {STYLES.find(s => s.value === item.style)?.label || 'Custom'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteHistoryItem(item.id, item.audio_storage_path, e)}
                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="text-slate-600 text-sm line-clamp-3 mb-3 flex-1">
                  {item.text}
                </p>
                <div className="text-xs text-slate-400 mt-auto pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span>{new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <div className="flex items-center gap-3">
                    {item.audio_storage_path && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = getAudioPublicUrl(item.audio_storage_path!);
                          openShadowingMode(item.text, url);
                        }}
                        className="text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                      >
                        <Mic size={12} /> Shadow
                      </button>
                    )}
                    <span className="text-indigo-500 font-medium flex items-center gap-1">
                      <Play size={12} className="fill-indigo-500" /> Play
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isShadowingMode && shadowingData && (
        <ShadowingPlayer 
          text={shadowingData.text} 
          audioUrl={shadowingData.audioUrl} 
          onClose={() => setIsShadowingMode(false)} 
        />
      )}
    </div>
  );
}
