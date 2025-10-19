/**
 * Compress audio blob to reduce storage size
 * Target: <500KB per recording for IndexedDB efficiency
 */
export async function compressAudio(blob: Blob): Promise<Blob> {
  const TARGET_SIZE_KB = 500;
  const currentSizeKB = blob.size / 1024;

  // If already small enough, return as-is
  if (currentSizeKB <= TARGET_SIZE_KB) {
    return blob;
  }

  try {
    // Use Web Audio API to re-encode at lower bitrate
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Create offline context with lower sample rate
    const offlineContext = new OfflineAudioContext(
      1, // mono
      audioBuffer.length,
      22050 // lower sample rate (from 48000)
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    const renderedBuffer = await offlineContext.startRendering();

    // Convert to WAV (simpler format, smaller size)
    const wav = audioBufferToWav(renderedBuffer);
    const compressedBlob = new Blob([wav], { type: 'audio/wav' });

    console.log(`Audio compressed: ${currentSizeKB.toFixed(0)}KB -> ${(compressedBlob.size / 1024).toFixed(0)}KB`);
    
    return compressedBlob;
  } catch (error) {
    console.error('Audio compression failed, using original:', error);
    return blob; // Fallback to original
  }
}

/**
 * Convert AudioBuffer to WAV format
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels: Float32Array[] = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(buffer.numberOfChannels);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels); // byte rate
  setUint16(buffer.numberOfChannels * 2); // block align
  setUint16(16); // bits per sample

  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4);

  // Write interleaved data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let sample;
  while (pos < length) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return arrayBuffer;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
