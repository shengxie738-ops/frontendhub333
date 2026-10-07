/**
 * Ambient-audio manager, verbatim port of `class H` and its zustand store from
 * `page-4c279de0997d388f.js:11640-12400`.
 *
 * Kept constants: `maxVolume 1 / minVolume -1 / initial 0`, the
 * `currentVolume += (target - current) * min(1, 5*delta)` fade, the low-pass
 * `muffleBG(pct)` mapping (`frequency 20000 - 19000*pct`, `Q 1 + 4*pct`) and
 * "starts muted, `setLoop(true)`, `setVolume(0)`".
 *
 * zustand is not a dependency of this project, so the store is re-implemented
 * as a `useSyncExternalStore`-compatible singleton with the same method names.
 */
import { Audio, AudioLoader, AudioListener } from 'three';
import { ASSETS, AUDIO } from '../data/scene-settings';

export function assetUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export class AudioManager {
  listener: AudioListener | null = null;
  backgroundAudio: Audio<AudioNode> | null = null;
  audioContext: AudioContext | null = null;
  lowPassFilter: BiquadFilterNode | null = null;
  readonly audioLoader = new AudioLoader();

  maxVolume: number = AUDIO.maxVolume;
  minVolume: number = AUDIO.minVolume;
  currentVolume: number = AUDIO.initialVolume;
  currentVolumeTarget: number = AUDIO.initialVolume;
  isMuted: boolean = AUDIO.defaultMuted;
  isInitialized: boolean = false;
  isMuffled = false;

  init = async (): Promise<void> =>
    new Promise((resolve, reject) => {
      try {
        this.listener = new AudioListener();
        this.audioContext = this.listener.context;
        this.backgroundAudio = new Audio(this.listener);
        this.audioLoader.load(
          assetUrl(ASSETS.ambientAudio),
          (buffer: AudioBuffer) => {
            if (!this.backgroundAudio) return;
            this.backgroundAudio.setBuffer(buffer);
            this.backgroundAudio.setLoop(true);
            this.backgroundAudio.setVolume(0);
            this.isInitialized = true;
            this.setupLowPassFilter();
            resolve();
          },
          undefined,
          (event) => {
            reject(new Error(`audio load failed: ${String(event)}`));
          },
        );
      } catch (error) {
        reject(error instanceof Error ? error : new Error('audio init failed'));
      }
    });

  setupLowPassFilter(): void {
    if (!this.audioContext || !this.backgroundAudio) return;
    try {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = AUDIO.lowpassOpenHz;
      filter.Q.value = 0.5;
      this.backgroundAudio.setFilter(filter);
      filter.connect(this.audioContext.destination);
      this.lowPassFilter = filter;
    } catch {
      this.lowPassFilter = null;
    }
  }

  muteBackgroundMusic(): void {
    if (!this.backgroundAudio) return;
    this.currentVolumeTarget = this.minVolume;
    this.isMuted = true;
  }

  unmuteBackgroundMusic(): void {
    if (!this.backgroundAudio) return;
    // Chrome creates the AudioContext suspended when the page has not seen a
    // gesture yet; `Audio.play()` in three r154 never resumes it.
    if (this.audioContext && this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    if (!this.backgroundAudio.isPlaying) this.backgroundAudio.play();
    this.currentVolumeTarget = this.maxVolume;
    this.isMuted = false;
  }

  updateVolume(delta: number): void {
    const audio = this.backgroundAudio;
    if (!audio) return;
    if (
      (this.currentVolumeTarget !== this.maxVolume || this.currentVolume !== this.maxVolume) &&
      audio.isPlaying
    ) {
      this.currentVolume +=
        (this.currentVolumeTarget - this.currentVolume) * Math.min(1, AUDIO.fadeRate * delta);
      audio.setVolume(this.currentVolume);
      if (
        this.currentVolumeTarget === this.minVolume &&
        this.currentVolume < this.minVolume + 0.1
      ) {
        this.currentVolume = this.minVolume;
        audio.stop();
      }
      if (this.currentVolumeTarget === this.maxVolume && this.currentVolume > this.maxVolume - 0.1) {
        this.currentVolume = this.maxVolume;
      }
    }
  }

  stopBackgroundMusic(): void {
    this.backgroundAudio?.stop();
  }

  toggleMute(): boolean {
    if (this.isMuted) this.unmuteBackgroundMusic();
    else this.muteBackgroundMusic();
    return this.isMuted;
  }

  getMuteState(): boolean {
    return this.isMuted;
  }

  muffleBG(value: number): void {
    if (!this.backgroundAudio || !this.audioContext) return;
    try {
      const t = Math.max(0, Math.min(1, value));
      if (this.lowPassFilter) {
        this.lowPassFilter.frequency.value = AUDIO.lowpassOpenHz - AUDIO.lowpassRangeHz * t;
        this.lowPassFilter.Q.value = AUDIO.lowpassQBase + AUDIO.lowpassQRange * t;
      }
      this.isMuffled = t > 0.01;
    } catch {
      /* ignore audio graph races, never block the frame loop */
    }
  }

  destroy(): void {
    this.backgroundAudio?.stop();
    this.backgroundAudio?.disconnect();
    this.lowPassFilter?.disconnect();
    this.listener = null;
    this.backgroundAudio = null;
    this.isInitialized = false;
  }
}

/* ------------------------------------------------------------------ *
 * Store singleton (zustand replacement)
 * ------------------------------------------------------------------ */

export interface AudioStoreState {
  isMuted: boolean;
  isInitialized: boolean;
}

type Listener = () => void;

class AudioStore {
  private manager: AudioManager | null = null;
  private state: AudioStoreState = { isMuted: true, isInitialized: false };
  private readonly listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AudioStoreState => this.state;

  getServerSnapshot = (): AudioStoreState => this.state;

  private emit(force = false): void {
    const next: AudioStoreState = {
      isMuted: this.manager ? this.manager.isMuted : true,
      isInitialized: this.manager ? this.manager.isInitialized : false,
    };
    if (!force && next.isMuted === this.state.isMuted && next.isInitialized === this.state.isInitialized) {
      return;
    }
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  async initAudio(): Promise<void> {
    if (this.manager?.isInitialized) {
      this.manager.muffleBG(0);
      return;
    }
    try {
      if (!this.manager) this.manager = new AudioManager();
      await this.manager.init();
      this.emit(true);
    } catch {
      // audio failure must never block the page
      this.emit(true);
    }
  }

  toggleMute(): boolean {
    if (!this.manager) return this.state.isMuted;
    const muted = this.manager.toggleMute();
    this.emit(true);
    return muted;
  }

  updateVolume(delta: number): void {
    this.manager?.updateVolume(delta);
    // only re-renders subscribers when isMuted/isInitialized actually changed
    this.emit();
  }

  muffleBG(value: number): void {
    this.manager?.muffleBG(value);
  }

  muteBackgroundMusic(): void {
    this.manager?.muteBackgroundMusic();
    this.emit(true);
  }

  stopBackgroundMusic(): void {
    this.manager?.stopBackgroundMusic();
  }

  getManager(): AudioManager | null {
    return this.manager;
  }

  destroy(): void {
    this.manager?.destroy();
    this.manager = null;
    this.emit(true);
  }
}

export const audioStore = new AudioStore();
