import { vi } from 'vitest';

export class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: any) => void) | null = null;
  onstop: (() => void) | null = null;
  stream: MediaStream;

  constructor(stream: MediaStream, options?: any) {
    this.stream = stream;
  }

  start() {
    this.state = 'recording';
    // Simulate data available after a short delay
    setTimeout(() => {
      if (this.ondataavailable) {
        const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
        this.ondataavailable({ data: mockBlob });
      }
    }, 100);
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }
}

export const mockGetUserMedia = () => {
  const mockStream = {
    getTracks: vi.fn(() => [
      {
        stop: vi.fn(),
        kind: 'audio',
        enabled: true,
      },
    ]),
  } as unknown as MediaStream;

  Object.defineProperty(global.navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
  });

  (global as any).MediaRecorder = MockMediaRecorder;

  return mockStream;
};

export const cleanupMediaMocks = () => {
  delete (global as any).MediaRecorder;
};
