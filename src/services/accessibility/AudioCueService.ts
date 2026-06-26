// AudioCueService.ts — blind-coding audio feedback system (Sprint 9)
// Uses Web Speech API (screen reader) + AudioContext (tones) for eyes-free coding

export type CueEvent =
  | 'file-saved'
  | 'file-opened'
  | 'error-detected'
  | 'error-cleared'
  | 'ai-thinking'
  | 'ai-done'
  | 'commit-success'
  | 'commit-error'
  | 'collab-joined'
  | 'collab-peer-joined'
  | 'collab-peer-left'
  | 'panel-switched'
  | 'secret-detected'
  | 'build-success'
  | 'build-error';

export interface CueConfig {
  enabled: boolean;
  speechEnabled: boolean;
  tonesEnabled: boolean;
  volume: number;           // 0–1
  speechRate: number;       // 0.5–2
  voiceIndex: number;       // index into speechSynthesis.getVoices()
}

const DEFAULT_CONFIG: CueConfig = {
  enabled: false,           // off by default — user must enable
  speechEnabled: true,
  tonesEnabled: true,
  volume: 0.4,
  speechRate: 1.1,
  voiceIndex: 0,
};

// Tone definitions: [frequency Hz, duration ms, waveType]
type WaveType = 'sine' | 'square' | 'triangle' | 'sawtooth';
const TONES: Record<CueEvent, [number, number, WaveType][]> = {
  'file-saved':        [[523, 80, 'sine'], [659, 80, 'sine']],                  // C5 E5 — quick up
  'file-opened':       [[440, 60, 'sine'], [554, 60, 'sine'], [659, 100, 'sine']], // A4 C#5 E5
  'error-detected':    [[200, 150, 'square']],                                  // low buzz
  'error-cleared':     [[523, 100, 'sine'], [784, 120, 'sine']],               // up sweep
  'ai-thinking':       [[330, 60, 'triangle'], [330, 60, 'triangle']],          // double pulse
  'ai-done':           [[659, 80, 'sine'], [784, 80, 'sine'], [1047, 100, 'sine']], // rising triad
  'commit-success':    [[523, 80, 'sine'], [659, 80, 'sine'], [784, 100, 'sine']],  // C E G
  'commit-error':      [[300, 120, 'square'], [200, 200, 'square']],            // descending buzz
  'collab-joined':     [[440, 100, 'sine'], [554, 100, 'sine']],
  'collab-peer-joined':[[660, 80, 'sine']],
  'collab-peer-left':  [[440, 80, 'sine'], [330, 120, 'sine']],
  'panel-switched':    [[440, 50, 'triangle']],                                 // neutral click
  'secret-detected':   [[100, 200, 'square'], [150, 200, 'square']],           // alarm
  'build-success':     [[523, 60, 'sine'], [659, 60, 'sine'], [784, 60, 'sine'], [1047, 120, 'sine']],
  'build-error':       [[300, 150, 'square'], [250, 100, 'square'], [200, 200, 'square']],
};

const SPEECH: Record<CueEvent, string> = {
  'file-saved':         'Saved',
  'file-opened':        'File opened',
  'error-detected':     'Error detected',
  'error-cleared':      'Errors cleared',
  'ai-thinking':        'AI thinking',
  'ai-done':            'AI response ready',
  'commit-success':     'Commit successful',
  'commit-error':       'Commit failed',
  'collab-joined':      'Collaboration session started',
  'collab-peer-joined': 'Peer joined',
  'collab-peer-left':   'Peer left',
  'panel-switched':     '',  // silent — announced by panel label
  'secret-detected':    'Warning: secret detected in file',
  'build-success':      'Build successful',
  'build-error':        'Build failed',
};

class AudioCueService {
  private ctx: AudioContext | null = null;
  private config: CueConfig = { ...DEFAULT_CONFIG };
  private speechQueue: string[] = [];
  private speaking = false;

  load() {
    try {
      const stored = localStorage.getItem('devnoder-audio-cues');
      if (stored) this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {}
  }

  save() {
    localStorage.setItem('devnoder-audio-cues', JSON.stringify(this.config));
  }

  getConfig(): CueConfig { return { ...this.config }; }

  updateConfig(patch: Partial<CueConfig>) {
    this.config = { ...this.config, ...patch };
    this.save();
  }

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  private async playTones(event: CueEvent): Promise<void> {
    if (!this.config.tonesEnabled) return;
    const tones = TONES[event];
    if (!tones?.length) return;

    const ctx = this.getCtx();
    let time = ctx.currentTime;

    for (const [freq, dur, wave] of tones) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type      = wave;
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(this.config.volume * 0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur / 1000 + 0.01);
      time += dur / 1000 * 0.8;
    }
  }

  private speakNext(): void {
    if (this.speaking || !this.speechQueue.length) return;
    const text = this.speechQueue.shift()!;
    if (!text) { this.speakNext(); return; }

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = this.config.speechRate;
    utt.volume = this.config.volume;
    const voices = speechSynthesis.getVoices();
    if (voices[this.config.voiceIndex]) utt.voice = voices[this.config.voiceIndex];
    utt.onend = () => { this.speaking = false; this.speakNext(); };
    utt.onerror = () => { this.speaking = false; this.speakNext(); };
    this.speaking = true;
    speechSynthesis.speak(utt);
  }

  private speak(text: string): void {
    if (!this.config.speechEnabled || !text) return;
    this.speechQueue.push(text);
    this.speakNext();
  }

  /** Trigger a cue event. No-op if audio cues disabled. */
  cue(event: CueEvent, customText?: string): void {
    if (!this.config.enabled) return;
    this.playTones(event).catch(() => {});
    this.speak(customText ?? SPEECH[event]);
  }

  /** Announce a panel name when switching */
  announcePanel(panelLabel: string): void {
    if (!this.config.enabled || !this.config.speechEnabled) return;
    this.speak(`${panelLabel} panel`);
    this.playTones('panel-switched').catch(() => {});
  }

  /** Read out selected code — for screen-reader users */
  readCode(code: string): void {
    if (!this.config.enabled || !this.config.speechEnabled) return;
    const preview = code.slice(0, 200).replace(/\s+/g, ' ').trim();
    this.speak(preview);
  }

  getVoices(): SpeechSynthesisVoice[] {
    return speechSynthesis.getVoices();
  }

  isSupported(): boolean {
    return 'AudioContext' in window && 'speechSynthesis' in window;
  }
}

export const audioCueService = new AudioCueService();
