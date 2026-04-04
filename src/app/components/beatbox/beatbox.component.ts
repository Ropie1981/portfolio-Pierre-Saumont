import { Component, OnDestroy, signal, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AppStateService } from "../../services/app-state.service";
import { Track } from "../../app.models";

// BPM range 60–200 maps to knob rotation -135deg → +135deg
const BPM_MIN = 60;
const BPM_MAX = 200;
const KNOB_MIN_DEG = -135;
const KNOB_MAX_DEG = 135;

@Component({
  selector: "app-beatbox",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./beatbox.component.html",
  styleUrl: "./beatbox.component.scss",
})
export class BeatboxComponent implements OnDestroy {
  private appState = inject(AppStateService);
  private audioCtx: AudioContext | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private step = 0;

  // Knob drag state
  private knobDragActive = false;
  private knobDragStartY = 0;
  private knobDragStartBpm = 120;
  private knobMouseMoveBound = this.onKnobMouseMove.bind(this);
  private knobMouseUpBound = this.onKnobMouseUp.bind(this);

  isPlaying = signal(false);
  isExporting = signal(false);
  bpm = signal(120);
  activeStep = signal(-1);

  stepNumbers = Array.from({ length: 16 }, (_, i) => i + 1);

  // 9 notch markers around the knob arc
  knobNotches = Array.from({ length: 9 }, (_, i) => i + 1);

  // Map bpm to knob rotation in degrees
  knobDeg = computed(() => {
    const pct = (this.bpm() - BPM_MIN) / (BPM_MAX - BPM_MIN);
    return KNOB_MIN_DEG + pct * (KNOB_MAX_DEG - KNOB_MIN_DEG);
  });

  tracks: Track[] = [
    {
      name: "KICK",
      color: "purple",
      steps: Array(16).fill(false),
      volume: 1.2,
    },
    {
      name: "SNARE",
      color: "green",
      steps: Array(16).fill(false),
      volume: 1,
    },
    {
      name: "HH CLOSED",
      color: "pink",
      steps: Array(16).fill(false),
      volume: 0.8,
    },
    {
      name: "HH OPEN",
      color: "pink",
      steps: Array(16).fill(false),
      volume: 0.7,
    },
    { name: "CLAP", color: "green", steps: Array(16).fill(false), volume: 1 },
    { name: "TOM", color: "purple", steps: Array(16).fill(false), volume: 1 },
  ];

  ngOnDestroy() {
    this.clearTimer();
    this.audioCtx?.close();
    this.detachKnobListeners();
  }

  close() {
    this.stopPlayback();
    this.appState.closeBeatbox();
  }

  private getCtx(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    return this.audioCtx;
  }

  togglePlay() {
    this.isPlaying() ? this.stopPlayback() : this.startPlayback();
  }

  private startPlayback() {
    this.isPlaying.set(true);
    this.step = 0;
    this.startTimer();
  }

  private stopPlayback() {
    this.isPlaying.set(false);
    this.activeStep.set(-1);
    this.clearTimer();
  }

  private startTimer() {
    const ms = (60 / this.bpm() / 4) * 1000;
    this.intervalId = setInterval(() => {
      this.activeStep.set(this.step);
      this.tracks.forEach((track, i) => {
        if (track.steps[this.step]) this.playSound(i, track.volume);
      });
      this.step = (this.step + 1) % 16;
    }, ms);
  }

  private clearTimer() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  toggleStep(ti: number, si: number) {
    const steps = [...this.tracks[ti].steps];
    steps[si] = !steps[si];
    this.tracks[ti].steps = steps;
  }

  clearAll() {
    this.tracks.forEach((t) => {
      t.steps = Array(16).fill(false);
    });
  }

  randomize() {
    const density = [0.4, 0.2, 0.3, 0.1, 0.12, 0.05];
    this.tracks.forEach((t, i) => {
      t.steps = Array(16)
        .fill(false)
        .map(() => Math.random() < density[i]);
    });
    this.tracks[0].steps[0] = true;
  }

  onBpmChange(event: Event) {
    this.bpm.set(Number((event.target as HTMLInputElement).value));
    if (this.isPlaying()) {
      this.clearTimer();
      this.startTimer();
    }
  }

  private setBpm(value: number) {
    const clamped = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(value)));
    this.bpm.set(clamped);
    if (this.isPlaying()) {
      this.clearTimer();
      this.startTimer();
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async exportTrack(bars = 2): Promise<void> {
    if (this.isExporting()) return;
    this.isExporting.set(true);

    try {
      const sampleRate = 44100;
      const stepDuration = 60 / this.bpm() / 4; // seconds per 16th note
      const totalDuration = stepDuration * 16 * bars;
      // Add a small tail so the last hit decays cleanly (0.6 s)
      const totalSamples = Math.ceil((totalDuration + 0.6) * sampleRate);

      const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

      for (let bar = 0; bar < bars; bar++) {
        for (let si = 0; si < 16; si++) {
          const t = (bar * 16 + si) * stepDuration;
          this.tracks.forEach((track, ti) => {
            if (track.steps[si]) {
              this.renderSound(offlineCtx, ti, track.volume, t);
            }
          });
        }
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = this.encodeWav(renderedBuffer);
      this.downloadBlob(wavBlob, `beat_${this.bpm()}bpm.wav`);
    } finally {
      this.isExporting.set(false);
    }
  }

  /** Encode an AudioBuffer as a 16-bit stereo WAV Blob. */
  private encodeWav(buffer: AudioBuffer): Blob {
    const numChannels = 2;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.length;
    const blockAlign = numChannels * 2; // 16-bit = 2 bytes per sample per channel
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples * blockAlign;
    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);

    const write = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++)
        view.setUint8(offset + i, str.charCodeAt(i));
    };

    write(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bit depth
    write(36, "data");
    view.setUint32(40, dataSize, true);

    // Interleave L/R channels
    const left = buffer.getChannelData(0);
    // Use right channel if present, otherwise duplicate left (mono synthesis)
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

    let offset = 44;
    for (let i = 0; i < samples; i++) {
      view.setInt16(offset, Math.max(-1, Math.min(1, left[i])) * 0x7fff, true);
      offset += 2;
      view.setInt16(offset, Math.max(-1, Math.min(1, right[i])) * 0x7fff, true);
      offset += 2;
    }

    return new Blob([wavBuffer], { type: "audio/wav" });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    // Small delay before revoking so the browser has time to start the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Knob drag interaction ──────────────────────────────────────────────────

  onKnobMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.knobDragActive = true;
    this.knobDragStartY = event.clientY;
    this.knobDragStartBpm = this.bpm();
    window.addEventListener("mousemove", this.knobMouseMoveBound);
    window.addEventListener("mouseup", this.knobMouseUpBound);
  }

  onKnobTouchStart(event: TouchEvent) {
    event.preventDefault();
    this.knobDragActive = true;
    this.knobDragStartY = event.touches[0].clientY;
    this.knobDragStartBpm = this.bpm();
    window.addEventListener("touchmove", this.onKnobTouchMove.bind(this), {
      passive: false,
    });
    window.addEventListener("touchend", this.onKnobMouseUp.bind(this), {
      once: true,
    });
  }

  private onKnobMouseMove(event: MouseEvent) {
    if (!this.knobDragActive) return;
    const dy = this.knobDragStartY - event.clientY; // drag up = increase
    const delta = dy * ((BPM_MAX - BPM_MIN) / 120); // 120px = full range
    this.setBpm(this.knobDragStartBpm + delta);
  }

  private onKnobTouchMove(event: TouchEvent) {
    if (!this.knobDragActive) return;
    event.preventDefault();
    const dy = this.knobDragStartY - event.touches[0].clientY;
    const delta = dy * ((BPM_MAX - BPM_MIN) / 120);
    this.setBpm(this.knobDragStartBpm + delta);
  }

  private onKnobMouseUp() {
    this.knobDragActive = false;
    this.detachKnobListeners();
  }

  private detachKnobListeners() {
    window.removeEventListener("mousemove", this.knobMouseMoveBound);
    window.removeEventListener("mouseup", this.knobMouseUpBound);
  }

  getBeat(bi: number): boolean {
    const s = this.activeStep();
    return s >= bi * 4 && s < (bi + 1) * 4;
  }

  // ── Audio synthesis ────────────────────────────────────────────────────────
  // All synthesis methods accept BaseAudioContext so they work with both
  // the live AudioContext and the OfflineAudioContext used during export.

  private playSound(ti: number, vol: number) {
    const ctx = this.getCtx();
    this.renderSound(ctx, ti, vol, ctx.currentTime);
  }

  private renderSound(
    ctx: BaseAudioContext,
    ti: number,
    vol: number,
    t: number,
  ) {
    switch (ti) {
      case 0:
        this.kick(ctx, t, vol);
        break;
      case 1:
        this.snare(ctx, t, vol);
        break;
      case 2:
        this.hhClosed(ctx, t, vol);
        break;
      case 3:
        this.hhOpen(ctx, t, vol);
        break;
      case 4:
        this.clap(ctx, t, vol);
        break;
      case 5:
        this.tom(ctx, t, vol);
        break;
    }
  }

  private kick(ctx: BaseAudioContext, t: number, vol: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  private snare(ctx: BaseAudioContext, t: number, vol: number) {
    const len = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 1000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noise.connect(hpf);
    hpf.connect(ng);
    ng.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.2);
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.frequency.value = 100;
    og.gain.setValueAtTime(vol * 0.7, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(og);
    og.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  private hhClosed(ctx: BaseAudioContext, t: number, vol: number) {
    const dur = 0.06;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hpf);
    hpf.connect(g);
    g.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  private hhOpen(ctx: BaseAudioContext, t: number, vol: number) {
    const dur = 0.35;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hpf);
    hpf.connect(g);
    g.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  private clap(ctx: BaseAudioContext, t: number, vol: number) {
    for (let k = 0; k < 3; k++) {
      const off = k * 0.012;
      const dur = 0.06;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.frequency.value = 1200 + k * 300;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.6, t + off);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + dur);
      noise.connect(bpf);
      bpf.connect(g);
      g.connect(ctx.destination);
      noise.start(t + off);
      noise.stop(t + off + dur);
    }
  }

  private tom(ctx: BaseAudioContext, t: number, vol: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);
    g.gain.setValueAtTime(vol * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  }
}
