// ============================================
// Dawn Library — Audio Engine Module
// 절차적 사운드: 빗소리, 바람, 종이 사각거림, 감성 무드
// ============================================

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;

    // 노드 참조
    this.rainGain = null;
    this.windGain = null;
    this.rainFilter = null;
    this.windFilter = null;

    // Mood 노드
    this.moodFilter = null;   // Low-pass for mood
    this.moodReverb = null;   // ConvolverNode for reverb
    this.moodReverbGain = null;
    this.moodDryGain = null;
    this.masterGain = null;

    // 현재 감성 점수
    this.currentSentiment = 0;
  }

  init() {
    if (this.started) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.started = true;

    // Master output with mood processing
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;

    // Mood Low-pass Filter
    this.moodFilter = this.ctx.createBiquadFilter();
    this.moodFilter.type = 'lowpass';
    this.moodFilter.frequency.value = 800;
    this.moodFilter.Q.value = 0.7;

    // Reverb (impulse response)
    this.moodReverb = this.ctx.createConvolver();
    this._createReverbIR();

    this.moodReverbGain = this.ctx.createGain();
    this.moodReverbGain.gain.value = 0.15; // wet
    this.moodDryGain = this.ctx.createGain();
    this.moodDryGain.gain.value = 0.85;

    // Routing: masterGain → moodFilter → (dry + reverb) → destination
    this.masterGain.connect(this.moodFilter);
    this.moodFilter.connect(this.moodDryGain);
    this.moodFilter.connect(this.moodReverb);
    this.moodReverb.connect(this.moodReverbGain);
    this.moodDryGain.connect(this.ctx.destination);
    this.moodReverbGain.connect(this.ctx.destination);

    this._initRain();
    this._initWind();
  }

  /** 리버브 임펄스 응답 생성 (절차적) */
  _createReverbIR() {
    const len = this.ctx.sampleRate * 2.5; // 2.5초 리버브
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
    }
    this.moodReverb.buffer = buf;
  }

  /** 빗소리 — 브라운 노이즈 + 밴드패스 */
  _initRain() {
    const buf = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }
    buf.buffer = buffer;
    buf.loop = true;

    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = 'bandpass';
    this.rainFilter.frequency.value = 800;
    this.rainFilter.Q.value = 0.5;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;

    buf.connect(this.rainFilter).connect(this.rainGain).connect(this.masterGain);
    buf.start();
  }

  /** 바람 — 로우패스 화이트노이즈 + LFO */
  _initWind() {
    const buf = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    buf.buffer = buffer;
    buf.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain).connect(this.windFilter.frequency);
    lfo.start();

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;

    buf.connect(this.windFilter).connect(this.windGain).connect(this.masterGain);
    buf.start();
  }

  /**
   * 종이 사각거림 (Paper Rustle) — 절차적 SFX
   * 짧은 화이트노이즈 버스트 + 하이패스 필터 + 급격한 감쇠
   * @param {number} intensity - 0.0~1.0 (기본 0.3)
   */
  paperRustle(intensity = 0.3) {
    if (!this.ctx || !this.started) return;

    const now = this.ctx.currentTime;
    // 매번 살짝 다른 파라미터로 자연스러움 확보
    const duration = 0.02 + Math.random() * 0.03; // 20-50ms
    const freq = 2000 + Math.random() * 2000;     // 2000-4000Hz
    const gain = 0.03 * intensity + Math.random() * 0.02 * intensity;

    // 노이즈 버스트 생성
    const sampleCount = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // 하이패스 필터
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = freq;
    hp.Q.value = 0.5 + Math.random() * 0.5;

    // 급격한 감쇠 엔벨로프
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // 직접 destination으로 (무드 필터 우회 — 종이 소리는 항상 선명)
    source.connect(hp).connect(env).connect(this.ctx.destination);
    source.start(now);
    source.stop(now + duration + 0.01);
  }

  /**
   * 감성 무드 적용 — Low-pass + Reverb 실시간 변주
   * @param {number} sentiment - -1.0 ~ +1.0
   */
  applyMood(sentiment) {
    if (!this.ctx || !this.started) return;
    this.currentSentiment = sentiment;

    const now = this.ctx.currentTime;
    const transitionTime = 1.5; // 1.5초에 걸쳐 부드럽게

    // sentiment < 0 (슬픈): Low-pass ↓ (300-500Hz), Reverb wet ↑
    // sentiment > 0 (밝은): Low-pass ↑ (800-1200Hz), Reverb wet ↓
    const t = (sentiment + 1) / 2; // 0~1로 정규화

    const lpFreq = 300 + t * 900;      // 300Hz(슬픔) ~ 1200Hz(밝음)
    const reverbWet = 0.35 - t * 0.3;  // 0.35(슬픔) ~ 0.05(밝음)
    const dryLevel = 1 - reverbWet;

    this.moodFilter.frequency.linearRampToValueAtTime(lpFreq, now + transitionTime);
    this.moodReverbGain.gain.linearRampToValueAtTime(reverbWet, now + transitionTime);
    this.moodDryGain.gain.linearRampToValueAtTime(dryLevel, now + transitionTime);
  }

  /**
   * 크로스페이드 — 뷰 전환 시 오디오 부드럽게 전환
   * @param {'menu'|'reading'} fromState
   * @param {'menu'|'reading'} toState
   */
  crossfade(fromState, toState) {
    if (!this.ctx || !this.started) return;

    const now = this.ctx.currentTime;
    const dur = 1.5; // 1.5초 크로스페이드

    if (toState === 'reading') {
      // 읽기 모드: 볼륨 살짝 줄이고 무드 필터 적용
      this.masterGain.gain.linearRampToValueAtTime(0.7, now + dur * 0.5);
      this.masterGain.gain.linearRampToValueAtTime(0.85, now + dur);
    } else {
      // 메뉴 모드: 볼륨 정상, 무드 필터 중립
      this.masterGain.gain.linearRampToValueAtTime(1.0, now + dur);
      this.applyMood(0); // 중립 감성
    }
  }

  /**
   * 영감의 울림 (Zen Bell) — 글 열 때 맑은 종소리
   * 사인파 주파수 스윕 + 2배음 레이어 + 긴 감쇠
   */
  zenBell() {
    if (!this.ctx || !this.started) return;
    const now = this.ctx.currentTime;

    // 기본음 (A5 → A4 스윕)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(440, now + 1.5);

    // 2배음 (옥타브 위, 더 작게)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now);
    osc2.frequency.exponentialRampToValueAtTime(880, now + 1);

    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.06, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.025, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc1.connect(gain1).connect(this.ctx.destination);
    osc2.connect(gain2).connect(this.ctx.destination);
    osc1.start(now); osc1.stop(now + 2.5);
    osc2.start(now); osc2.stop(now + 1.5);
  }

  /**
   * 침묵의 깊이 (Deep Drone) — 장면 전환 시 낮은 공명
   * 삼각파 저주파 + 미세한 디튠 레이어
   */
  deepDrone() {
    if (!this.ctx || !this.started) return;
    const now = this.ctx.currentTime;
    const dur = 2.5;

    // 기본 드론 (A2 = 110Hz)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 110;

    // 디튠 레이어 (+3Hz 비트)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 113;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.8);  // 천천히 올라옴
    gain.gain.linearRampToValueAtTime(0, now + dur);      // 천천히 사라짐

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.02, now + 0.8);
    gain2.gain.linearRampToValueAtTime(0, now + dur);

    osc.connect(gain).connect(this.ctx.destination);
    osc2.connect(gain2).connect(this.ctx.destination);
    osc.start(now); osc.stop(now + dur);
    osc2.start(now); osc2.stop(now + dur);
  }

  /**
   * 마지막 문장 (Final Resonance) — 마지막 장면의 여운
   * 다중 하모닉스 + 매우 긴 감쇠로 광채 같은 울림
   */
  finalResonance() {
    if (!this.ctx || !this.started) return;
    const now = this.ctx.currentTime;

    // 3개 하모닉스: 기본음, 5도, 옥타브
    const freqs = [220, 330, 440];
    const gains = [0.05, 0.03, 0.02];
    const durs = [5, 4, 3.5];

    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gains[i], now + 1);
      g.gain.exponentialRampToValueAtTime(0.001, now + durs[i]);

      osc.connect(g).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + durs[i]);
    });
  }

  /** 음소거 토글 — masterGain을 0으로 */
  toggleMute() {
    if (!this.masterGain) return false;
    const now = this.ctx.currentTime;
    if (this.masterGain.gain.value > 0.01) {
      this._prevMasterGain = this.masterGain.gain.value;
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.3);
      return true; // muted
    } else {
      this.masterGain.gain.linearRampToValueAtTime(this._prevMasterGain || 1, now + 0.3);
      return false; // unmuted
    }
  }

  /** 슬라이더 연동 */
  setRainVolume(val) {
    if (this.rainGain) this.rainGain.gain.value = val / 100 * 0.3;
  }

  setWindVolume(val) {
    if (this.windGain) this.windGain.gain.value = val / 100 * 0.15;
  }

  /** 초기 볼륨 설정 */
  setInitialVolumes(rain, wind) {
    if (this.rainGain) this.rainGain.gain.value = rain / 100 * 0.3;
    if (this.windGain) this.windGain.gain.value = wind / 100 * 0.15;
  }
}
