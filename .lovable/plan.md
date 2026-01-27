

# Add ElevenLabs Scribe v2 (Batch) as Primary STT with Gemini Fallback

## Overview

This change updates the `voice-to-text` edge function to use ElevenLabs Scribe v2 (batch API) as the primary transcription provider, with automatic fallback to Gemini 3 Pro if ElevenLabs fails.

---

## Current vs. New Architecture

| Provider | Role | API Type | Strengths |
|----------|------|----------|-----------|
| **ElevenLabs** `scribe_v2` | Primary | REST (batch) | Optimized for speech, 99+ languages, speaker diarization |
| **Gemini** `gemini-3-pro-preview` | Fallback | REST (multimodal) | Already configured, good Taglish support |

---

## Fallback Chain Flow

```text
Audio Blob
    │
    ▼
┌─────────────────────────┐
│  ElevenLabs scribe_v2   │──── Success ────▶ Return transcription
│  (Primary)              │
└────────────┬────────────┘
             │ Fail (error/timeout)
             ▼
┌─────────────────────────┐
│  Gemini 3 Pro           │──── Success ────▶ Return transcription
│  (Fallback)             │
└────────────┬────────────┘
             │ Fail
             ▼
        Return error
```

---

## Implementation

### File: `supabase/functions/voice-to-text/index.ts`

**Changes:**

1. Add ElevenLabs transcription function
2. Add fallback logic (try ElevenLabs first, then Gemini)
3. Update analytics to track which provider succeeded

**New Function - ElevenLabs Batch Transcription:**
```typescript
async function transcribeWithElevenLabs(audioBase64: string): Promise<string> {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  // Decode base64 to binary
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create form data with audio file
  const formData = new FormData();
  const audioBlob = new Blob([bytes], { type: 'audio/webm' });
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model_id', 'scribe_v2');
  // Auto-detect language for Taglish support
  // formData.append('language_code', 'tgl'); // Optional: can force Tagalog

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.text;
}
```

**Updated Main Logic - Fallback Chain:**
```typescript
// Try ElevenLabs first
let transcription: string | null = null;
let provider = 'elevenlabs';

try {
  console.log('[voice-to-text] Trying ElevenLabs Scribe v2...');
  transcription = await transcribeWithElevenLabs(audio);
  console.log('[voice-to-text] ElevenLabs success');
} catch (elevenLabsError) {
  console.warn('[voice-to-text] ElevenLabs failed, falling back to Gemini:', elevenLabsError);
  provider = 'gemini';
  
  // Fallback to Gemini
  const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    // ... existing Gemini logic
  });
  
  // ... process Gemini response
  transcription = result.choices?.[0]?.message?.content?.trim();
}
```

---

## Analytics Tracking

The `stt_analytics` table will now capture which provider was used:

| model_provider | model_version | status |
|----------------|---------------|--------|
| `elevenlabs` | `scribe_v2` | `success` |
| `gemini` | `gemini-3-pro-preview` | `success` (fallback) |

This allows you to monitor:
- ElevenLabs success rate
- How often Gemini fallback is triggered
- Latency comparison between providers

---

## ElevenLabs Batch API Details

**Endpoint:** `POST https://api.elevenlabs.io/v1/speech-to-text`

**Request:**
- `file`: Audio file (webm, mp3, wav, etc.)
- `model_id`: `scribe_v2`
- `language_code`: Optional (auto-detect if omitted)
- `tag_audio_events`: Optional (detect laughter, music, etc.)
- `diarize`: Optional (identify speakers)

**Response:**
```json
{
  "text": "The transcribed text",
  "words": [
    { "text": "The", "start": 0.0, "end": 0.1 },
    { "text": "transcribed", "start": 0.12, "end": 0.5 }
  ]
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/voice-to-text/index.ts` | Add ElevenLabs function, implement fallback chain |

---

## Benefits

1. **Better Speech Recognition**: ElevenLabs is purpose-built for speech (vs Gemini which is general-purpose multimodal)
2. **Automatic Redundancy**: If ElevenLabs is down or rate-limited, Gemini takes over seamlessly
3. **Filipino Support**: ElevenLabs supports Tagalog (`tgl`) and English, handles code-switching
4. **Offline-First Still Works**: Recording is local, only transcription needs network (after stop)
5. **Analytics Visibility**: Track provider performance to optimize over time

---

## Trade-offs

| Aspect | ElevenLabs Primary | Gemini Only |
|--------|-------------------|-------------|
| Latency | ~1-3s | ~2-4s |
| Cost | Uses ElevenLabs credits | Uses Lovable AI credits |
| Taglish accuracy | Excellent | Good |
| Fallback | Gemini backup | None |

---

## Testing Checklist

After implementation:
- [ ] ElevenLabs transcription works for Filipino speech
- [ ] Fallback to Gemini triggers when ElevenLabs fails
- [ ] Analytics show correct provider attribution
- [ ] Error messages are user-friendly
- [ ] Offline queue still works (audio saved, transcribed on reconnect)

