# English City Campus

An AI-powered English learning platform with audio shadowing, listening tests, and background listening. Built with React, Google Gemini AI, and Supabase.

## Features

### Audio & Shadowing
- Upload images to extract English text (OCR via Gemini)
- Generate natural-sounding audio with 5 AI voices
- 10+ reading styles including custom input (angry, sad, cheerful, etc.)
- AI auto-suggests lesson titles
- Shadowing mode with word-by-word highlighting, phonetics (IPA), and recording

### Listening Menu
- Playlist of all your generated audio
- Music-player experience: play/pause, previous/next, loop modes
- Volume control, minimized mode
- Script display with word highlighting during playback
- Background listening support

### Listening Test
- AI generates 3 test types from any audio lesson:
  - **Multiple Choice** (5-10 questions)
  - **True / False** (5-8 statements)
  - **Fill in the Blanks** (~40% content words removed)
- 3 difficulty levels: Easy (A2), Medium (B1), Hard (B2)
- "Check Answer" preview (blue = correct, red = wrong, no answer revealed)
- Per-section submit with final score breakdown
- Tests saved to DB for reuse without re-generating

### All Audio Players
- Playback speed: 0.5x, 0.75x, 1x, 1.25x, 1.5x
- Rewind buttons: -5s, -10s, -15s
- Progress bar with seek

### Settings
- Profile info, change password, sign out

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                     │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ AuthPage │  │   Sidebar    │  │    Main Content    │  │
│  │(Sign In/ │  │ Navigation   │  │                    │  │
│  │ Sign Up) │  │              │  │ ┌────────────────┐ │  │
│  └──────────┘  │ - Audio &    │  │ │AudioShadowing  │ │  │
│                │   Shadowing  │  │ │ - Image OCR    │ │  │
│                │ - Listening  │  │ │ - TTS Generate │ │  │
│                │ - Listening  │  │ │ - History      │ │  │
│                │   Test       │  │ └────────────────┘ │  │
│                │ - Settings   │  │ ┌────────────────┐ │  │
│                └──────────────┘  │ │ListeningMenu   │ │  │
│                                  │ │ - Playlist     │ │  │
│                                  │ │ - Bottom Player│ │  │
│                                  │ └────────────────┘ │  │
│                                  │ ┌────────────────┐ │  │
│                                  │ │ListeningTest   │ │  │
│                                  │ │ - AI Questions │ │  │
│                                  │ │ - Scoring      │ │  │
│                                  │ └────────────────┘ │  │
│                                  │ ┌────────────────┐ │  │
│                                  │ │ShadowingPlayer │ │  │
│                                  │ │ - Word Sync    │ │  │
│                                  │ │ - Recording    │ │  │
│                                  │ └────────────────┘ │  │
│                                  │ ┌────────────────┐ │  │
│                                  │ │SettingsPage    │ │  │
│                                  │ └────────────────┘ │  │
│                                  └───────────────────┘   │
└───────────────┬──────────────────────┬───────────────────┘
                │                      │
     ┌──────────▼──────────┐  ┌────────▼────────┐
     │   Google Gemini AI  │  │    Supabase     │
     │                     │  │                 │
     │ - gemini-3-flash    │  │ - Auth (email)  │
     │   (OCR, phonetics,  │  │ - PostgreSQL    │
     │    titles, tests,   │  │   - audio_gen   │
     │    word timings)    │  │   - listen_test │
     │                     │  │ - Storage       │
     │ - gemini-2.5-flash  │  │   (WAV files)   │
     │   -preview-tts      │  │ - RLS policies  │
     │   (Text-to-Speech)  │  │                 │
     └─────────────────────┘  └─────────────────┘
```

## Project Structure

```
src/
├── App.tsx                    # Root app with page routing
├── main.tsx                   # React entry point
├── index.css                  # Tailwind CSS imports
├── components/
│   ├── AudioControls.tsx      # Shared speed + rewind controls
│   ├── AudioShadowing.tsx     # Main audio generation & history
│   ├── AuthPage.tsx           # Sign in / sign up
│   ├── ListeningMenu.tsx      # Audio playlist player
│   ├── ListeningTest.tsx      # AI-generated tests & scoring
│   ├── SettingsPage.tsx       # User settings
│   ├── ShadowingPlayer.tsx    # Full-screen shadowing mode
│   └── Sidebar.tsx            # Navigation sidebar
└── lib/
    ├── audioUtils.ts          # PCM to WAV conversion
    ├── auth.tsx               # Auth context & hooks
    ├── gemini.ts              # Google Gemini API (OCR, TTS, tests)
    ├── storageService.ts      # Supabase DB & storage operations
    └── supabase.ts            # Supabase client init
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Build | Vite |
| AI | Google Gemini (Flash + TTS) |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (WAV files) |
| Icons | Lucide React |
| Animations | Motion (Framer Motion) |

## Setup

### Prerequisites
- Node.js 18+
- [Google Gemini API key](https://ai.google.dev/)
- [Supabase project](https://supabase.com/) (free tier works)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env.local` and fill in:
```
GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run database migrations
Run these SQL files in **Supabase Dashboard > SQL Editor** (in order):
1. `supabase_migration.sql` — base schema
2. `supabase_auth_migration.sql` — auth + RLS policies
3. `supabase_title_migration.sql` — title column
4. `supabase_update_policy_migration.sql` — update policy
5. `supabase_listening_tests_migration.sql` — listening tests table

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy to Vercel
1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

## Database Schema

```sql
-- Audio generations (lessons)
audio_generations (
  id UUID PRIMARY KEY,
  title TEXT,
  text TEXT,
  voice TEXT,
  style TEXT,
  audio_storage_path TEXT,
  user_id UUID → auth.users,
  created_at TIMESTAMPTZ
)

-- Listening tests & scores
listening_tests (
  id UUID PRIMARY KEY,
  audio_generation_id UUID → audio_generations,
  user_id UUID → auth.users,
  difficulty TEXT,
  test_data JSONB,
  score_mc INTEGER,
  score_tf INTEGER,
  score_fill INTEGER,
  score_total INTEGER,
  score_max INTEGER,
  completed BOOLEAN,
  created_at TIMESTAMPTZ
)
```

## License

MIT
