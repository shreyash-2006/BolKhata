export interface AudioRecorderOptions {
  onAudioLevel?: (level: number) => void;
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioData: Float32Array[] = [];
  private sampleRate = 16000;
  private isRecording = false;
  private onAudioLevel?: (level: number) => void;

  constructor(options?: AudioRecorderOptions) {
    this.onAudioLevel = options?.onAudioLevel;
  }

  async start(): Promise<void> {
    this.audioData = [];
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: this.sampleRate });

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      const input = event.inputBuffer.getChannelData(0);
      this.audioData.push(new Float32Array(input));

      if (this.onAudioLevel) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
          sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / input.length);
        this.onAudioLevel(Math.min(1, rms * 5));
      }
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  async stop(): Promise<Blob> {
    this.isRecording = false;

    if (this.scriptProcessor && this.sourceNode) {
      this.scriptProcessor.disconnect();
      this.sourceNode.disconnect();
    }

    if (this.audioContext) {
      await this.audioContext.close();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }

    // Flatten all samples
    let totalLength = 0;
    for (const chunk of this.audioData) {
      totalLength += chunk.length;
    }

    const flatSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.audioData) {
      flatSamples.set(chunk, offset);
      offset += chunk.length;
    }

    return this.encodeWAV(flatSamples, this.sampleRate);
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write PCM 16-bit samples
    let index = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      index += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

