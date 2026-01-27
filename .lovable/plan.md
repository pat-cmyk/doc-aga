
Goal: Fix the “Speak to Doc Aga” button getting stuck showing a checkmark (VoiceRecordButton in `preview` state), which currently blocks any follow-up voice recordings even though the user wants continuous back-and-forth conversation.

What’s actually happening (root cause)
- In `src/lib/voiceStateMachine.ts`, the `PROCESSING_COMPLETE` action always transitions to `state: 'preview'` (line ~167–176).
- In `src/components/ui/VoiceRecordButton.tsx`, the UI shows a check icon when `state === 'preview'` (line ~269–271).
- The “start recording” click handler currently only starts recording if `state === 'idle' || state === 'error'` (line ~227–233).
- The `useVoiceRecording.startRecording()` function also refuses to start unless state is `idle` or `error` (line ~165–168).
Result: once the first transcription completes, the voice FSM enters `preview`, and clicking the button does nothing. That’s exactly the stuck behavior you’re seeing.

Why the previous change didn’t fix it
- Setting `showPreview={false}` only changes the toast behavior inside `VoiceRecordButton` (it does not change the FSM transition). The FSM still goes to `preview` and stays there until `PREVIEW_CONFIRM`, `PREVIEW_CANCEL`, or `RESET` is dispatched.

Implementation approach (minimal change, aligns with current architecture)
We’ll fix this at the UI integration layer (VoiceRecordButton) so we don’t break other flows that may intentionally use preview. Specifically:
1) Allow “follow-up” recordings when the FSM is in `preview`
   - Update `VoiceRecordButton`’s `handleClick`:
     - If `state === 'preview'`, we will:
       - call `reset()` (already provided by `useVoiceRecording`)
       - then call `startRecording()` after a tiny delay (e.g., `setTimeout(..., 50)`) to ensure the reducer state updates to `idle` before start.
   - This makes the checkmark state effectively “ready for next recording” with one tap, even if something left us in preview.

2) Optional: Auto-reset when `showPreview={false}` (Doc Aga mode)
   - Since Doc Aga voice should behave like push-to-talk chat (not “confirm transcript”), we’ll also add a small effect:
     - When `state` becomes `preview` and `showPreview === false`, automatically call `reset()` shortly after.
   - This removes the checkmark quickly and returns the button to the microphone state automatically, which matches user expectations for continuous conversation.
   - This is safer than changing the core FSM, because other parts of the app may rely on manual confirmation in preview.

Files to change
A) `src/components/ui/VoiceRecordButton.tsx`
- Change `handleClick` logic to handle `preview`:
  - Current:
    - start only from `idle` or `error`
  - New:
    - if `preview`: `reset()` then `startRecording()` after a short timeout
- Add an effect to auto-reset preview when `showPreview={false}`:
  - `useEffect(() => { if (state === 'preview' && !showPreview) { setTimeout(() => reset(), 250); } }, [state, showPreview, reset])`
  - Keep the delay small (200–400ms) so the user still briefly sees “success” state, but it won’t block follow-ups.
- Ensure any timers are cleaned up (store timeout id in a ref and clear on unmount/state change) to avoid leaks.

B) (No change needed) `src/components/farmhand/DocAgaConsultation.tsx`
- You already added `showPreview={false}`; we keep it.

C) (Verify) `src/components/DocAga.tsx`
- It already has `showPreview={false}` (based on prior note); we’ll keep it.
- If it doesn’t in some rendering branch, we’ll add it consistently.

Testing plan (what we’ll verify in preview)
1) Open Doc Aga and record one voice query
2) Confirm after response returns:
   - the button returns to mic automatically (if auto-reset enabled), or
   - if it shows the check briefly, tapping it immediately starts a new recording
3) Record a second follow-up question (voice) without refreshing
4) Ensure the button never becomes “dead” in check state again
5) Also verify other voice-enabled forms (if any) still behave as expected:
   - For areas where `showPreview` is left as default (true), the check/preview behavior remains intact unless the user taps again (which should now work too).

Edge cases covered
- If the app is still `loading` (Doc Aga is processing / streaming response), the VoiceRecordButton remains disabled via `disabled={... || loading}` in the parent, so we won’t start recording mid-response.
- If the state is `offline_queued`, it remains disabled as before.
- If a user taps very fast while transitioning states, the `reset()` + delayed `startRecording()` pattern prevents the “Cannot start from state: preview” guard in `useVoiceRecording`.

Success criteria
- After any voice query, the user can immediately trigger another voice follow-up without refreshing and without the button becoming unresponsive.
- The “checkmark” state no longer blocks conversation.
