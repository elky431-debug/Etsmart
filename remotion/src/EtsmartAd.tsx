import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from 'remotion';
import React from 'react';
import { BackgroundAudio } from './audio-config';
import { DashboardMockup } from './DashboardMockup';

// ─── Brand colors ─────────────────────────────────────────────────────────────
const CYAN       = '#00d4ff';
const CYAN_LIGHT = '#5ce1ff';
const BG         = '#050508';
const CARD_BG    = '#0a0f1e';
const WHITE      = '#ffffff';
const GREY       = '#94A3B8';
const GREEN      = '#22c55e';
const ORANGE     = '#f97316';

// ─── Particles ────────────────────────────────────────────────────────────────
const PARTICLES: Array<{ x: number; y: number; size: number; phase: number; speed: number }> = [
  { x: 80,  y: 180,  size: 5, phase: 0.0, speed: 0.022 },
  { x: 310, y: 380,  size: 3, phase: 1.1, speed: 0.018 },
  { x: 540, y: 130,  size: 7, phase: 2.1, speed: 0.026 },
  { x: 760, y: 320,  size: 4, phase: 0.6, speed: 0.020 },
  { x: 990, y: 460,  size: 2, phase: 1.7, speed: 0.031 },
  { x: 170, y: 680,  size: 6, phase: 2.4, speed: 0.019 },
  { x: 420, y: 580,  size: 3, phase: 0.9, speed: 0.024 },
  { x: 640, y: 820,  size: 5, phase: 1.8, speed: 0.017 },
  { x: 880, y: 270,  size: 4, phase: 2.9, speed: 0.028 },
  { x: 60,  y: 950,  size: 2, phase: 0.4, speed: 0.021 },
  { x: 280, y: 1150, size: 7, phase: 1.2, speed: 0.016 },
  { x: 500, y: 1320, size: 3, phase: 2.2, speed: 0.030 },
  { x: 730, y: 1020, size: 5, phase: 0.7, speed: 0.023 },
  { x: 940, y: 1480, size: 4, phase: 1.6, speed: 0.027 },
  { x: 130, y: 1720, size: 6, phase: 2.7, speed: 0.020 },
  { x: 460, y: 1210, size: 2, phase: 0.2, speed: 0.025 },
  { x: 690, y: 420,  size: 4, phase: 1.0, speed: 0.018 },
  { x: 840, y: 840,  size: 3, phase: 2.0, speed: 0.029 },
  { x: 230, y: 1580, size: 5, phase: 0.5, speed: 0.022 },
  { x: 590, y: 1430, size: 7, phase: 1.5, speed: 0.016 },
];

const FEATURES: Array<{ icon: string; title: string; subtitle: string; start: number }> = [
  { icon: '🔍', title: 'Analyse produit IA',    subtitle: 'Score de saturation, revenus projetés', start: 368 },
  { icon: '✍️', title: 'Listing Etsy optimisé', subtitle: 'Titre, tags, description SEO auto',      start: 424 },
  { icon: '🖼️', title: 'Images produit IA',      subtitle: '7 visuels pro générés en 1 clic',        start: 480 },
  { icon: '🔑', title: 'Keywords Etsy',          subtitle: 'Niches peu saturées, volume réel',        start: 536 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

function fadeScene(frame: number, i0: number, i1: number, o0: number, o1: number) {
  return interpolate(frame, [i0, i1, o0, o1], [0, 1, 1, 0], clamp);
}

// ─── Particles component ──────────────────────────────────────────────────────
const Particles: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 1 }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    {PARTICLES.map((p, i) => {
      const osc    = (Math.sin(frame * p.speed + p.phase) * 0.5 + 0.5) * 0.7 * opacity;
      const floatY = Math.sin(frame * 0.012 + p.phase) * 22;
      const floatX = Math.cos(frame * 0.008 + p.phase) * 10;
      return (
        <div key={i} style={{
          position: 'absolute',
          left: p.x + floatX, top: p.y + floatY,
          width: p.size * 2, height: p.size * 2, borderRadius: '50%',
          background: CYAN, opacity: osc,
          boxShadow: `0 0 ${p.size * 5}px ${CYAN}, 0 0 ${p.size * 10}px rgba(0,212,255,0.3)`,
        }} />
      );
    })}
  </div>
);

// ─── SCENE 1 — Hook  0–90 ─────────────────────────────────────────────────────
const Scene1: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 0, 6, 60, 72);

  // Logo : pop élastique + glow burst
  const ls = spring({ frame, fps, config: { stiffness: 320, damping: 18, mass: 0.7 } });
  const logoScale = interpolate(ls, [0, 1], [0.2, 1]);
  const logoOp    = interpolate(frame, [0, 8], [0, 1], clamp);
  // Halo burst qui s'éteint ensuite
  const burstOp  = interpolate(frame, [0, 6, 28, 50], [0, 0.7, 0.25, 0], clamp);
  const burstSc  = interpolate(frame, [0, 28], [0.4, 1.6], clamp);

  // Sous-titre
  const tl    = spring({ frame: frame - 20, fps, config: { stiffness: 200, damping: 14 } });
  const tagY  = interpolate(tl, [0, 1], [30, 0]);
  const tagOp = interpolate(frame, [20, 32], [0, 1], clamp);
  const lineW = interpolate(frame, [30, 52], [0, 1], clamp);

  // Badge IA
  const badgeS  = spring({ frame: frame - 38, fps, config: { stiffness: 240, damping: 14 } });
  const badgeSc = interpolate(badgeS, [0, 1], [0.6, 1]);
  const badgeOp = interpolate(frame, [38, 50], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Halo burst derrière le logo */}
      <div style={{
        position: 'absolute', left: '50%', top: '40%',
        transform: `translate(-50%,-50%) scale(${burstSc})`,
        width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(0,212,255,${burstOp * 0.45}) 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      {/* Halo permanent lent */}
      <div style={{
        position: 'absolute', left: '50%', top: '40%',
        transform: `translate(-50%,-50%) scale(${1 + Math.sin(frame * 0.05) * 0.05})`,
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <Particles frame={frame} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        {/* Logo plus grand */}
        <div style={{ transform: `scale(${logoScale})`, opacity: logoOp }}>
          <Img
            src={staticFile('logo.png')}
            style={{ width: 640, height: 213, objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Sous-titre + ligne */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transform: `translateY(${tagY}px)`, opacity: tagOp }}>
          <span style={{ color: WHITE, fontSize: 30, fontWeight: 600, textAlign: 'center', fontFamily: 'system-ui', letterSpacing: 0.5 }}>
            Le meilleur outil pour les dropshippers sur Etsy
          </span>
          <div style={{
            width: 520, height: 2,
            background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`,
            boxShadow: `0 0 12px ${CYAN}`,
            transformOrigin: 'center', transform: `scaleX(${lineW})`,
          }} />
        </div>

        {/* Badge IA */}
        <div style={{
          opacity: badgeOp, transform: `scale(${badgeSc})`,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.30)',
          borderRadius: 9999, paddingInline: 24, paddingBlock: 10,
        }}>
          <span style={{ fontSize: 22, color: CYAN }}>✦</span>
          <span style={{ color: CYAN, fontSize: 20, fontWeight: 600, fontFamily: 'system-ui', letterSpacing: 1 }}>Propulsé par l'IA</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 2 — Problème  90–210 ───────────────────────────────────────────────
const Scene2: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 85, 96, 198, 210);

  const s1 = spring({ frame: frame - 92, fps, config: { stiffness: 180, damping: 13 } });
  const y1 = interpolate(s1, [0, 1], [90, 0]);
  const o1 = interpolate(frame, [92, 106], [0, 1], clamp);

  const s2 = spring({ frame: frame - 130, fps, config: { stiffness: 180, damping: 13 } });
  const y2 = interpolate(s2, [0, 1], [90, 0]);
  const o2 = interpolate(frame, [130, 144], [0, 1], clamp);

  const textFade = interpolate(frame, [168, 182], [1, 0], clamp);
  const lineX    = interpolate(frame, [172, 198], [0, 1], clamp);
  const lineOp   = interpolate(frame, [172, 180, 200, 210], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Particles frame={frame} opacity={0.35} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 70, gap: 30 }}>
        <div style={{ transform: `translateY(${y1}px)`, opacity: o1 * textFade, color: WHITE, fontSize: 68, fontWeight: 800, textAlign: 'center', fontFamily: 'system-ui', lineHeight: 1.1 }}>
          Tu vends sur Etsy.
        </div>
        <div style={{ transform: `translateY(${y2}px)`, opacity: o2 * textFade, color: CYAN, fontSize: 64, fontWeight: 800, textAlign: 'center', fontFamily: 'system-ui', lineHeight: 1.1 }}>
          Tu fais tout à la main&nbsp;?
        </div>
      </AbsoluteFill>
      <div style={{
        position: 'absolute', top: '50%', left: 0,
        width: `${lineX * 100}%`, height: 3,
        background: `linear-gradient(90deg, transparent, ${CYAN} 30%, ${CYAN_LIGHT} 70%, transparent)`,
        boxShadow: `0 0 20px ${CYAN}, 0 0 50px rgba(0,212,255,0.4)`,
        opacity: lineOp,
      }} />
    </AbsoluteFill>
  );
};

// ─── SCENE 3 — Solution  210–360 ──────────────────────────────────────────────
const Scene3: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 206, 216, 348, 360);

  const ts = spring({ frame: frame - 212, fps, config: { stiffness: 200, damping: 14 } });
  const textScale = interpolate(ts, [0, 1], [0.7, 1]);
  const textOp    = interpolate(frame, [212, 224], [0, 1], clamp);

  const bs = spring({ frame: frame - 252, fps, config: { stiffness: 220, damping: 16 } });
  const badgeScale   = interpolate(bs, [0, 1], [0.6, 1]);
  const badgeRotateX = interpolate(bs, [0, 1], [25, 0]);
  const badgeOp      = interpolate(frame, [252, 264], [0, 1], clamp);

  const haloScale = 1 + Math.sin(frame * 0.05) * 0.07;

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 75% 55% at 50% 48%, rgba(0,212,255,0.22) 0%, transparent 65%)`,
        transform: `scale(${haloScale})`,
      }} />
      <Particles frame={frame} opacity={0.5} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 70, gap: 44 }}>
        <div style={{ transform: `scale(${textScale})`, opacity: textOp, textAlign: 'center' }}>
          <span style={{ color: WHITE, fontSize: 78, fontWeight: 900, fontFamily: 'system-ui', lineHeight: 1.0, letterSpacing: -1 }}>Etsmart </span>
          <span style={{ color: CYAN, fontSize: 78, fontWeight: 900, fontFamily: 'system-ui', textShadow: `0 0 30px ${CYAN}` }}>fait tout.</span>
        </div>
        <div style={{
          opacity: badgeOp,
          transform: `perspective(700px) rotateX(${badgeRotateX}deg) scale(${badgeScale})`,
          background: 'linear-gradient(135deg, #004d6e 0%, #001a2e 100%)',
          border: `1.5px solid ${CYAN}`,
          borderRadius: 60, paddingInline: 44, paddingBlock: 18,
          boxShadow: `0 0 30px rgba(0,212,255,0.4), 0 0 80px rgba(0,212,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}>
          <span style={{ color: WHITE, fontSize: 32, fontWeight: 700, letterSpacing: 1, fontFamily: 'system-ui' }}>✦ Propulsé par l'IA</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 4 — Features  360–690 ──────────────────────────────────────────────
const FeatureCard: React.FC<{ frame: number; fps: number; icon: string; title: string; subtitle: string; start: number }> = ({
  frame, fps, icon, title, subtitle, start,
}) => {
  const s  = spring({ frame: frame - start, fps, config: { stiffness: 200, damping: 16 } });
  const tx = interpolate(s, [0, 1], [500, 0]);
  const sc = interpolate(s, [0, 1], [0.88, 1]);
  const op = interpolate(frame, [start, start + 12], [0, 1], clamp);
  const borderGlow = interpolate(frame, [start, start + 30, start + 70], [1, 0.5, 0.2], clamp);

  return (
    <div style={{
      transform: `translateX(${tx}px) scale(${sc})`, opacity: op,
      background: `linear-gradient(135deg, ${CARD_BG} 0%, #060d1a 100%)`,
      border: `1px solid rgba(0,212,255,${0.2 + borderGlow * 0.5})`,
      borderRadius: 22, padding: '24px 28px',
      display: 'flex', alignItems: 'center', gap: 20, width: '100%',
      boxShadow: `0 0 ${20 + borderGlow * 40}px rgba(0,212,255,${0.05 + borderGlow * 0.2})`,
    }}>
      <div style={{
        width: 66, height: 66, borderRadius: 14, flexShrink: 0,
        background: 'radial-gradient(circle, rgba(0,212,255,0.18) 0%, transparent 70%)',
        border: '1px solid rgba(0,212,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
      }}>{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ color: WHITE, fontSize: 30, fontWeight: 700, fontFamily: 'system-ui' }}>{title}</span>
        <span style={{ color: CYAN_LIGHT, fontSize: 22, fontFamily: 'system-ui', opacity: 0.85 }}>{subtitle}</span>
      </div>
    </div>
  );
};

const Scene4: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 357, 368, 608, 620);
  const titleS  = spring({ frame: frame - 360, fps, config: { stiffness: 180, damping: 14 } });
  const titleOp = interpolate(frame, [360, 374], [0, 1], clamp);
  const subS    = spring({ frame: frame - 374, fps, config: { stiffness: 160, damping: 14 } });
  const subOp   = interpolate(frame, [374, 388], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Particles frame={frame} opacity={0.25} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 55, gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ opacity: titleOp, transform: `translateY(${interpolate(titleS, [0,1],[30,0])})` }}>
            <span style={{ color: CYAN, fontSize: 24, fontWeight: 600, letterSpacing: 7, textTransform: 'uppercase', fontFamily: 'system-ui' }}>
              Ce que tu obtiens
            </span>
          </div>
          <div style={{ opacity: subOp, transform: `translateY(${interpolate(subS, [0,1],[20,0])})`, textAlign: 'center' }}>
            <span style={{ color: WHITE, fontSize: 34, fontWeight: 800, fontFamily: 'system-ui', letterSpacing: -0.3 }}>
              Sur Etsmart, vous pouvez&nbsp;:
            </span>
          </div>
        </div>
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} frame={frame} fps={fps} icon={f.icon} title={f.title} subtitle={f.subtitle} start={f.start} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 5 — Gestionnaire  620–800 ──────────────────────────────────────────

const MiniChart: React.FC<{ frame: number; revealStart: number }> = ({ frame, revealStart }) => {
  const progress = interpolate(frame, [revealStart, revealStart + 50], [0, 1], clamp);
  const W = 540; const H = 90;
  const data = [2, 4, 218, 14, 6, 4, 3, 4, 3, 2, 2, 3];
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * H * 0.88 - 4}`);
  const areaPoints = `0,${H} ${pts.join(' ')} ${W},${H}`;
  return (
    <svg width={W} height={H + 22} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CYAN} stopOpacity="0.4" />
          <stop offset="100%" stopColor={CYAN} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="rv"><rect x="0" y="-10" width={progress * W} height={H + 20} /></clipPath>
      </defs>
      <g clipPath="url(#rv)">
        <polygon points={areaPoints} fill="url(#cg)" />
        <polyline points={pts.join(' ')} fill="none" stroke={CYAN} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 5px ${CYAN})` }} />
      </g>
      {['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'].map((m, i) => (
        <text key={m} x={(i / 11) * W} y={H + 18} fontSize="12" fill={GREY} textAnchor="middle">{m}</text>
      ))}
    </svg>
  );
};

// Barre de navigation latérale miniature (comme le vrai)
const MiniSidebar: React.FC = () => (
  <div style={{
    width: 48, background: '#08101e', borderRight: '1px solid rgba(0,212,255,0.15)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    paddingTop: 16, gap: 18, flexShrink: 0,
  }}>
    {/* Logo petit "e" */}
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: CYAN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: BG, fontWeight: 900, fontSize: 16, fontFamily: 'system-ui' }}>e</span>
    </div>
    {/* Icônes mockées */}
    {['▦','⊞','⟳','★','☰','◎','⊘','⊟','⌂'].map((ic, i) => (
      <div key={i} style={{
        width: 34, height: 34, borderRadius: 8,
        background: i === 1 ? 'rgba(0,212,255,0.2)' : 'transparent',
        border: i === 1 ? `1px solid rgba(0,212,255,0.4)` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: i === 1 ? CYAN : '#3a4a5a', fontSize: 15,
      }}>{ic}</div>
    ))}
  </div>
);

// Panneau boutiques comme le vrai
const MiniShopPanel: React.FC = () => (
  <div style={{
    width: 170, background: '#070e1c', borderRight: '1px solid rgba(0,212,255,0.12)',
    padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
  }}>
    <div style={{ color: GREY, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'system-ui', marginBottom: 4 }}>Boutiques</div>
    {[
      { name: 'yo boss', active: true },
      { name: 'salut boso', active: false },
    ].map((s) => (
      <div key={s.name} style={{
        background: s.active ? 'rgba(0,212,255,0.12)' : 'transparent',
        border: s.active ? `1px solid rgba(0,212,255,0.35)` : '1px solid transparent',
        borderRadius: 10, padding: '8px 10px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: s.active ? CYAN : '#1e2d3d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12 }}>🏪</span>
        </div>
        <span style={{ color: s.active ? WHITE : GREY, fontSize: 14, fontWeight: s.active ? 600 : 400, fontFamily: 'system-ui' }}>{s.name}</span>
      </div>
    ))}
    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, paddingInline: 4 }}>
      <span style={{ color: CYAN, fontSize: 16 }}>+</span>
      <span style={{ color: GREY, fontSize: 13, fontFamily: 'system-ui' }}>Nouvelle boutique</span>
    </div>
  </div>
);

const Scene5Gestionnaire: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 617, 628, 788, 800);

  // Zoom-out : scale 1.4 → 1.0
  const zoomS = spring({ frame: frame - 622, fps, config: { stiffness: 120, damping: 18 } });
  const scale = interpolate(zoomS, [0, 1], [1.4, 1.0]);

  // Rotation 3D Y : 20deg → 0deg
  const rotS = spring({ frame: frame - 622, fps, config: { stiffness: 100, damping: 16 } });
  const rotY = interpolate(rotS, [0, 1], [20, 0]);

  // Fade-in global du bloc
  const entryOp = interpolate(frame, [622, 640], [0, 1], clamp);

  // Scroll automatique après 60 frames : translateY 0 → -320px
  const scrollStart = 622 + 60;
  const scrollS = spring({ frame: frame - scrollStart, fps, config: { stiffness: 60, damping: 20 } });
  const scrollY = interpolate(scrollS, [0, 1], [0, -400]);

  // Label "Gestionnaire"
  const labelOp = interpolate(frame, [622, 638], [0, 1], clamp);
  const labelS  = spring({ frame: frame - 622, fps, config: { stiffness: 180, damping: 14 } });
  const labelY  = interpolate(labelS, [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 48%, rgba(0,212,255,0.08) 0%, transparent 60%)' }} />
      <Particles frame={frame} opacity={0.15} />

      {/* Label au-dessus */}
      {(() => {
        const subtitleOp = interpolate(frame, [636, 654], [0, 1], clamp);
        const subtitleS  = spring({ frame: frame - 636, fps, config: { stiffness: 160, damping: 16 } });
        const subtitleY  = interpolate(subtitleS, [0, 1], [20, 0]);
        return (
          <div style={{
            position: 'absolute', top: 60, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <div style={{ opacity: labelOp, transform: `translateY(${labelY}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ color: CYAN, fontSize: 20, fontWeight: 600, letterSpacing: 6, textTransform: 'uppercase', fontFamily: 'system-ui' }}>Gestionnaire</span>
              <span style={{ color: WHITE, fontSize: 34, fontWeight: 800, fontFamily: 'system-ui', letterSpacing: -0.5 }}>Gérez toutes vos boutiques</span>
            </div>
            <div style={{ opacity: subtitleOp, transform: `translateY(${subtitleY}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.60)', fontSize: 18, fontFamily: 'system-ui', textAlign: 'center', maxWidth: 700, lineHeight: 1.4 }}>
                Suivez vos ventes, commandes et profits de chaque boutique Etsy en quelques clics
              </span>
              {/* Pill badges */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {['📦 Transactions', '📊 Statistiques', '🌍 Commandes par pays'].map((b) => (
                  <div key={b} style={{
                    padding: '5px 14px', borderRadius: 9999,
                    background: 'rgba(0,212,255,0.10)', border: '1px solid rgba(0,212,255,0.25)',
                    fontSize: 13, color: CYAN, fontFamily: 'system-ui', fontWeight: 500,
                  }}>{b}</div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dashboard mockup avec zoom-out + rotation 3D + scroll */}
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 220 }}>
        <div style={{
          opacity: entryOp,
          transform: `perspective(1200px) rotateY(${rotY}deg) scale(${scale})`,
          transformOrigin: 'center center',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: `0 0 80px rgba(0,212,255,0.18), 0 40px 100px rgba(0,0,0,0.7)`,
          border: '1px solid rgba(0,212,255,0.3)',
          width: 960,
          height: 680,
        }}>
          {/* Barre macOS */}
          <div style={{
            height: 44, background: '#06080f',
            borderBottom: '1px solid rgba(0,212,255,0.18)',
            display: 'flex', alignItems: 'center', paddingInline: 18, gap: 8, flexShrink: 0,
          }}>
            {['#ff5f57','#febc2e','#28c840'].map((c) => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
            ))}
            <span style={{ color: GREY, fontSize: 12, fontFamily: 'system-ui', marginLeft: 10 }}>etsmart.app/dashboard</span>
            <div style={{ marginLeft: 'auto', background: 'rgba(0,212,255,0.1)', borderRadius: 18, paddingInline: 12, paddingBlock: 4, border: '1px solid rgba(0,212,255,0.3)' }}>
              <span style={{ color: CYAN, fontSize: 12, fontWeight: 600, fontFamily: 'system-ui' }}>⟳ 1 842 crédits</span>
            </div>
          </div>

          {/* Contenu scrollable */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#000' }}>
            <div style={{ transform: `translateY(${scrollY}px)`, transition: 'none' }}>
              <DashboardMockup />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 6 — CTA  800–930 ───────────────────────────────────────────────────
const Scene6CTA: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 797, 808, 918, 930);

  const loop  = ((frame - 800) % 50) / 50;
  const loop2 = ((frame - 800 + 25) % 50) / 50;
  const pulseS  = interpolate(loop,  [0, 0.5, 1], [1, 1.10, 1]);
  const pulse2S = interpolate(loop2, [0, 0.5, 1], [1, 1.14, 1]);
  const pulseOp  = interpolate(loop,  [0, 0.3, 1], [0.28, 0.1, 0.28]);
  const pulse2Op = interpolate(loop2, [0, 0.3, 1], [0.16, 0.05, 0.16]);

  const cs = spring({ frame: frame - 806, fps, config: { stiffness: 220, damping: 15 } });
  const ctaScale = interpolate(cs, [0, 1], [0.75, 1]);
  const ctaOp    = interpolate(frame, [806, 820], [0, 1], clamp);

  const urlOp      = interpolate(frame, [830, 844], [0, 1], clamp);
  const underlineW = interpolate(frame, [846, 882], [0, 1], clamp);

  const badgeOp = interpolate(frame, [860, 876], [0, 1], clamp);
  const shimmer = interpolate(frame, [878, 928], [-110, 220], clamp);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {[{s: pulseS, o: pulseOp},{s: pulse2S, o: pulse2Op}].map(({s, o}, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '41%',
          transform: `translate(-50%,-50%) scale(${s})`,
          width: 640, height: 640, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(0,212,255,${o}) 0%, transparent 65%)`,
          pointerEvents: 'none',
        }} />
      ))}
      <Particles frame={frame} opacity={0.5} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 70, gap: 40 }}>
        <div style={{ transform: `scale(${ctaScale})`, opacity: ctaOp, textAlign: 'center' }}>
          <div style={{ color: WHITE,  fontSize: 72, fontWeight: 900, fontFamily: 'system-ui', lineHeight: 1.1, letterSpacing: -1 }}>Commence</div>
          <div style={{ color: CYAN, fontSize: 72, fontWeight: 900, fontFamily: 'system-ui', lineHeight: 1.1, letterSpacing: -1, textShadow: `0 0 40px ${CYAN}` }}>gratuitement</div>
        </div>
        <div style={{ opacity: urlOp, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ color: CYAN_LIGHT, fontSize: 46, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: 1 }}>etsmart.app</span>
          <div style={{
            width: '100%', height: 2.5,
            background: `linear-gradient(90deg, ${CYAN} 0%, ${CYAN_LIGHT} 100%)`,
            boxShadow: `0 0 12px ${CYAN}`,
            transformOrigin: 'left center', transform: `scaleX(${underlineW})`,
          }} />
        </div>
        <div style={{
          opacity: badgeOp, position: 'relative', overflow: 'hidden',
          border: `1.5px solid rgba(0,212,255,0.55)`, borderRadius: 60,
          paddingInline: 48, paddingBlock: 18, background: 'rgba(0,212,255,0.07)',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 50%, transparent 100%)',
            transform: `translateX(${shimmer}%)`, pointerEvents: 'none',
          }} />
          <span style={{ color: WHITE, fontSize: 30, fontWeight: 700, letterSpacing: 3, fontFamily: 'system-ui' }}>FREE &amp; PRO</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 7 — Fin  930–1050 ──────────────────────────────────────────────────
const Scene7End: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 927, 940, 1040, 1050);

  const ls = spring({ frame: frame - 934, fps, config: { stiffness: 150, damping: 14 } });
  const logoScale = interpolate(ls, [0, 1], [0.55, 1]);
  const logoOp    = interpolate(frame, [934, 950], [0, 1], clamp);

  const tagOp = interpolate(frame, [966, 982], [0, 1], clamp);
  const tagY  = interpolate(spring({ frame: frame - 966, fps, config: { stiffness: 140, damping: 13 } }), [0, 1], [30, 0]);

  const ringOp = interpolate(frame, [940, 970], [0, 0.55], clamp);
  // Taille du ring proportionnelle au logo (460px wide, ~153px high → ellipse autour)
  const ringW = 520; const ringH = 220;

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Particles frame={frame} opacity={0.85} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        {/* Ring centré sur le logo — même position que le logo dans le flex */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Ring derrière */}
          <div style={{
            position: 'absolute',
            width: ringW, height: ringH,
            borderRadius: '50%',
            border: `1px solid rgba(0,212,255,${ringOp})`,
            boxShadow: `0 0 30px rgba(0,212,255,${ringOp * 0.5}), 0 0 60px rgba(0,212,255,${ringOp * 0.2})`,
            pointerEvents: 'none',
          }} />
          {/* Logo centré */}
          <div style={{ transform: `scale(${logoScale})`, opacity: logoOp, position: 'relative', zIndex: 1 }}>
            <Img
              src={staticFile('logo.png')}
              style={{ width: 460, height: 153, objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>

        <div style={{ width: 90, height: 2, background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`, boxShadow: `0 0 14px ${CYAN}`, opacity: logoOp }} />
        <div style={{ transform: `translateY(${tagY}px)`, opacity: tagOp, textAlign: 'center', paddingInline: 60 }}>
          <span style={{ color: GREY, fontSize: 36, fontWeight: 400, fontFamily: 'system-ui' }}>Vends plus. </span>
          <span style={{ color: CYAN_LIGHT, fontSize: 36, fontWeight: 600, fontFamily: 'system-ui' }}>Travaille moins.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const EtsmartAd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />
      {/* <BackgroundAudio /> */}
      <Scene1              frame={frame} fps={fps} />
      <Scene2              frame={frame} fps={fps} />
      <Scene3              frame={frame} fps={fps} />
      <Scene4              frame={frame} fps={fps} />
      <Scene5Gestionnaire  frame={frame} fps={fps} />
      <Scene6CTA           frame={frame} fps={fps} />
      <Scene7End           frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};
