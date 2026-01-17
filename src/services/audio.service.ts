import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  // Signal to expose frequency data for visualization
  frequencyData = signal<Uint8Array>(new Uint8Array(0));
  isRecording = signal<boolean>(false);

  private animationFrameId: number | null = null;

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Audio Context for visualization
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      // Start Visualizer Loop
      this.visualize();

      // Setup Recorder
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject('No recorder initialized');
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' }); // Use webm for browser compatibility
        const base64 = await this.blobToBase64(audioBlob);
        this.cleanup();
        resolve(base64);
      };

      this.mediaRecorder.stop();
      this.isRecording.set(false);
    });
  }

  private visualize() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!this.isRecording()) {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        // Reset visualization
        this.frequencyData.set(new Uint8Array(bufferLength)); 
        return;
      }

      this.animationFrameId = requestAnimationFrame(draw);
      this.analyser!.getByteFrequencyData(dataArray);
      // Update signal
      this.frequencyData.set(new Uint8Array(dataArray));
    };

    draw();
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.frequencyData.set(new Uint8Array(0));
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}