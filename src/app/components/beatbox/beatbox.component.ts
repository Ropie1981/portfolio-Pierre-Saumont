import { Component, OnDestroy, signal, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AppStateService } from "../../services/app-state.service";
import { Track } from "../../app.models";

// BPM range 60–200 maps to knob rotation -135deg → +135deg
const BPM_MIN = 60;
const BPM_MAX = 200;
const KNOB_MIN_DEG = -135;
const KNOB_MAX_DEG = 135;

export type SoundMode = "electro" | "hiphop" | "techno";

interface SoundModeOption {
  id: SoundMode;
  label: string;
}

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
  soundMode = signal<SoundMode>("electro");
  mobileStepPage = signal(0); // 0–3, each page shows 4 steps

  /** True when at least one step is active across any track. */
  hasPattern = signal(false);

  private updateHasPattern(): void {
    this.hasPattern.set(this.tracks.some((t) => t.steps.some((s) => s)));
  }

  // ── VU Meter ────────────────────────────────────────────────────────────────
  vuL = signal(0);
  vuR = signal(0);
  vuPeakL = signal(0);
  vuPeakR = signal(0);
  private vuDecayTimer: ReturnType<typeof setTimeout> | null = null;
  private vuPeakLTimer: ReturnType<typeof setTimeout> | null = null;
  private vuPeakRTimer: ReturnType<typeof setTimeout> | null = null;

  vuSegments = [
    { threshold: 0.07, zone: "green" },
    { threshold: 0.15, zone: "green" },
    { threshold: 0.23, zone: "green" },
    { threshold: 0.31, zone: "green" },
    { threshold: 0.39, zone: "green" },
    { threshold: 0.47, zone: "green" },
    { threshold: 0.55, zone: "green" },
    { threshold: 0.63, zone: "green" },
    { threshold: 0.72, zone: "yellow" },
    { threshold: 0.81, zone: "yellow" },
    { threshold: 0.9, zone: "red" },
    { threshold: 0.98, zone: "red" },
  ];

  vuPeakSegL = computed(() => {
    const peak = this.vuPeakL();
    return this.vuSegments.reduce(
      (acc, seg, i) => (peak >= seg.threshold ? i : acc),
      -1,
    );
  });

  vuPeakSegR = computed(() => {
    const peak = this.vuPeakR();
    return this.vuSegments.reduce(
      (acc, seg, i) => (peak >= seg.threshold ? i : acc),
      -1,
    );
  });

  private triggerVu(levelL: number, levelR: number) {
    // Left channel
    if (levelL > this.vuL()) this.vuL.set(levelL);
    if (levelL > this.vuPeakL()) {
      this.vuPeakL.set(levelL);
      if (this.vuPeakLTimer) clearTimeout(this.vuPeakLTimer);
      this.vuPeakLTimer = setTimeout(() => this.vuPeakL.set(0), 1400);
    }
    // Right channel — slight stereo wobble
    if (levelR > this.vuR()) this.vuR.set(levelR);
    if (levelR > this.vuPeakR()) {
      this.vuPeakR.set(levelR);
      if (this.vuPeakRTimer) clearTimeout(this.vuPeakRTimer);
      this.vuPeakRTimer = setTimeout(() => this.vuPeakR.set(0), 1400);
    }
    // Schedule decay
    if (this.vuDecayTimer) clearTimeout(this.vuDecayTimer);
    this.vuDecayTimer = setTimeout(() => this.vuDecay(), 55);
  }

  private vuDecay() {
    const l = this.vuL();
    const r = this.vuR();
    if (l <= 0 && r <= 0) return;
    this.vuL.set(Math.max(0, l - 0.1));
    this.vuR.set(Math.max(0, r - 0.1));
    this.vuDecayTimer = setTimeout(() => this.vuDecay(), 38);
  }
  // ────────────────────────────────────────────────────────────────────────────

  stepNumbers = Array.from({ length: 16 }, (_, i) => i + 1);

  // 9 notch markers around the knob arc
  knobNotches = Array.from({ length: 9 }, (_, i) => i + 1);

  soundModes: SoundModeOption[] = [
    { id: "electro", label: "SOUND 1" },
    { id: "hiphop", label: "SOUND 2" },
    { id: "techno", label: "SOUND 3" },
  ];

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
    { name: "SNARE", color: "green", steps: Array(16).fill(false), volume: 1 },
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
    if (this.vuDecayTimer) clearTimeout(this.vuDecayTimer);
    if (this.vuPeakLTimer) clearTimeout(this.vuPeakLTimer);
    if (this.vuPeakRTimer) clearTimeout(this.vuPeakRTimer);
  }

  close() {
    this.stopPlayback();
    this.appState.closeBeatbox();
  }

  setSoundMode(mode: SoundMode) {
    this.soundMode.set(mode);
  }

  prevMobilePage(): void {
    if (this.mobileStepPage() > 0) this.mobileStepPage.update((p) => p - 1);
  }

  nextMobilePage(): void {
    if (this.mobileStepPage() < 3) this.mobileStepPage.update((p) => p + 1);
  }

  /** Returns true when a step index belongs to the currently visible mobile page. */
  isStepInPage(si: number): boolean {
    const page = this.mobileStepPage();
    return si >= page * 4 && si < (page + 1) * 4;
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
      let rawL = 0;
      let rawR = 0;
      this.tracks.forEach((track, i) => {
        if (track.steps[this.step]) {
          this.playSound(i, track.volume);
          // Spread tracks loosely across L/R to give stereo character
          rawL += track.volume * (0.5 + (i % 2 === 0 ? 0.25 : -0.05));
          rawR += track.volume * (0.5 + (i % 2 !== 0 ? 0.25 : -0.05));
        }
      });
      if (rawL > 0 || rawR > 0) {
        this.triggerVu(Math.min(1, rawL * 0.38), Math.min(1, rawR * 0.38));
      }
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
    this.updateHasPattern();
  }

  clearAll() {
    this.tracks.forEach((t) => {
      t.steps = Array(16).fill(false);
    });
    this.updateHasPattern();
  }

  randomize() {
    const density = [0.4, 0.2, 0.3, 0.1, 0.12, 0.05];
    this.tracks.forEach((t, i) => {
      t.steps = Array(16)
        .fill(false)
        .map(() => Math.random() < density[i]);
    });
    this.tracks[0].steps[0] = true;
    this.updateHasPattern();
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
      const stepDuration = 60 / this.bpm() / 4;
      const totalDuration = stepDuration * 16 * bars;
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
      this.downloadBlob(
        wavBlob,
        `beat_${this.bpm()}bpm_${this.soundMode()}.wav`,
      );
    } finally {
      this.isExporting.set(false);
    }
  }

  private encodeWav(buffer: AudioBuffer): Blob {
    const numChannels = 2;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.length;
    const blockAlign = numChannels * 2;
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
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, dataSize, true);

    const left = buffer.getChannelData(0);
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
    const dy = this.knobDragStartY - event.clientY;
    const delta = dy * ((BPM_MAX - BPM_MIN) / 120);
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

  // ── Audio routing ──────────────────────────────────────────────────────────

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
    switch (this.soundMode()) {
      case "hiphop":
        this.renderHipHop(ctx, ti, vol, t);
        break;
      case "techno":
        this.renderTechno(ctx, ti, vol, t);
        break;
      default:
        this.renderElectro(ctx, ti, vol, t);
        break;
    }
  }

  private renderElectro(
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

  private renderHipHop(
    ctx: BaseAudioContext,
    ti: number,
    vol: number,
    t: number,
  ) {
    switch (ti) {
      case 0:
        this.kickHipHop(ctx, t, vol);
        break;
      case 1:
        this.snareHipHop(ctx, t, vol);
        break;
      case 2:
        this.hhClosedHipHop(ctx, t, vol);
        break;
      case 3:
        this.hhOpenHipHop(ctx, t, vol);
        break;
      case 4:
        this.clapHipHop(ctx, t, vol);
        break;
      case 5:
        this.tomHipHop(ctx, t, vol);
        break;
    }
  }

  private renderTechno(
    ctx: BaseAudioContext,
    ti: number,
    vol: number,
    t: number,
  ) {
    switch (ti) {
      case 0:
        this.kickTechno(ctx, t, vol);
        break;
      case 1:
        this.snareTechno(ctx, t, vol);
        break;
      case 2:
        this.hhClosedTechno(ctx, t, vol);
        break;
      case 3:
        this.hhOpenTechno(ctx, t, vol);
        break;
      case 4:
        this.clapTechno(ctx, t, vol);
        break;
      case 5:
        this.tomTechno(ctx, t, vol);
        break;
    }
  }

  // ── ELECTRO synthesis ──────────────────────────────────────────────────────

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

  // ── HIP-HOP synthesis ──────────────────────────────────────────────────────
  // Inspired by the SP-1200 / MPC3000 school: deep 808 sub-bass kick,
  // warm snare body, lazy open hats, round clap with long room tail.

  private kickHipHop(ctx: BaseAudioContext, t: number, vol: number) {
    // Deep 808-style sub-bass — pitch falls slowly from 75 Hz to 28 Hz
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const wave = ctx.createWaveShaper();
    //wave.curve = this.makeDistortionCurve(25) as Float32Array<ArrayBuffer>; // subtle warmth / saturation
    osc.connect(g);
    g.connect(wave);
    wave.connect(ctx.destination);
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.75);
    g.gain.setValueAtTime(vol * 1.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  private snareHipHop(ctx: BaseAudioContext, t: number, vol: number) {
    // Warm body tone
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.frequency.value = 180;
    og.gain.setValueAtTime(vol * 0.8, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(og);
    og.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);

    // Bandpass noise for "slap" character
    const len = Math.floor(ctx.sampleRate * 0.28);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 800;
    bpf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.9, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    noise.connect(bpf);
    bpf.connect(ng);
    ng.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.28);
  }

  private hhClosedHipHop(ctx: BaseAudioContext, t: number, vol: number) {
    // Slightly looser than Electro
    const dur = 0.09;
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
    g.gain.setValueAtTime(vol * 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hpf);
    hpf.connect(g);
    g.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  private hhOpenHipHop(ctx: BaseAudioContext, t: number, vol: number) {
    // Lazy, soulful — lower cutoff and longer decay
    const dur = 0.5;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.38, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hpf);
    hpf.connect(g);
    g.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  private clapHipHop(ctx: BaseAudioContext, t: number, vol: number) {
    // Two smacks + a long roomy tail simulating reverb body
    for (let k = 0; k < 2; k++) {
      const off = k * 0.018;
      const dur = 0.08;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.frequency.value = 900;
      bpf.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.7, t + off);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + dur);
      noise.connect(bpf);
      bpf.connect(g);
      g.connect(ctx.destination);
      noise.start(t + off);
      noise.stop(t + off + dur);
    }
    const tailDur = 0.38;
    const tailLen = Math.floor(ctx.sampleRate * tailDur);
    const tailBuf = ctx.createBuffer(1, tailLen, ctx.sampleRate);
    const td = tailBuf.getChannelData(0);
    for (let i = 0; i < tailLen; i++) td[i] = Math.random() * 2 - 1;
    const tailNoise = ctx.createBufferSource();
    tailNoise.buffer = tailBuf;
    const tailBpf = ctx.createBiquadFilter();
    tailBpf.type = "bandpass";
    tailBpf.frequency.value = 1100;
    tailBpf.Q.value = 1.2;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(vol * 0.22, t + 0.02);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + tailDur);
    tailNoise.connect(tailBpf);
    tailBpf.connect(tg);
    tg.connect(ctx.destination);
    tailNoise.start(t + 0.02);
    tailNoise.stop(t + 0.02 + tailDur);
  }

  private tomHipHop(ctx: BaseAudioContext, t: number, vol: number) {
    // Heavy, deep — big thud
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.5);
    g.gain.setValueAtTime(vol * 0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  // ── TECHNO synthesis ───────────────────────────────────────────────────────
  // Inspired by the TR-909 / Juno-style: punchy kick with transient click,
  // industrial snare, metallic hats, tight clap crack, pitch-sweep tom.

  private kickTechno(ctx: BaseAudioContext, t: number, vol: number) {
    // Punchy body: fast pitch sweep 200 → 50 Hz, tight 0.25 s envelope
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.05);
    g.gain.setValueAtTime(vol * 1.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t);
    osc.stop(t + 0.25);

    // High-freq transient click for articulation
    const click = ctx.createOscillator();
    const cg = ctx.createGain();
    click.frequency.value = 2000;
    cg.gain.setValueAtTime(vol * 0.65, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    click.connect(cg);
    cg.connect(ctx.destination);
    click.start(t);
    click.stop(t + 0.012);
  }

  private snareTechno(ctx: BaseAudioContext, t: number, vol: number) {
    // Industrial noise burst — only above 2.5 kHz survives
    const dur = 0.12;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 2500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hpf);
    hpf.connect(ng);
    ng.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);

    // Descending pitched snap for "crack" character
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);
    og.gain.setValueAtTime(vol * 0.6, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(og);
    og.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  private hhClosedTechno(ctx: BaseAudioContext, t: number, vol: number) {
    // Very short metallic tick — only top-of-spectrum content survives
    const dur = 0.04;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 10000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hpf);
    hpf.connect(g);
    g.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  private hhOpenTechno(ctx: BaseAudioContext, t: number, vol: number) {
    // Metallic sizzle — harsh, cutting, 9 kHz+
    const dur = 0.22;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 9000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hpf);
    hpf.connect(g);
    g.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  private clapTechno(ctx: BaseAudioContext, t: number, vol: number) {
    // Single tight industrial crack — no layering, no tail
    const dur = 0.05;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 1800;
    bpf.Q.value = 2.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(bpf);
    bpf.connect(g);
    g.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  private tomTechno(ctx: BaseAudioContext, t: number, vol: number) {
    // Industrial pitch-sweep: briefly rises then drops — mechanical punch
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.018);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.2);
    g.gain.setValueAtTime(vol * 0.85, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // ── Shared utility ─────────────────────────────────────────────────────────

  /** Soft-knee waveshaper for subtle harmonic warmth / saturation. */
  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
}
