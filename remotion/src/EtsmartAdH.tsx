/**
 * EtsmartAdH — Version HORIZONTALE 1920×1080
 * Même contenu que EtsmartAd mais adapté au format paysage :
 *   - Layouts côte-à-côte pour Scene 2 (problème)
 *   - Grille 2×2 pour Scene 4 (features)
 *   - Dashboard plus large pour Scene 5
 */
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
import { DashboardMockup } from './DashboardMockup';

// ─── Brand colors ─────────────────────────────────────────────────────────────
const CYAN       = '#00d4ff';
const CYAN_LIGHT = '#5ce1ff';
const BG         = '#050508';
const CARD_BG    = '#0a0f1e';
const WHITE      = '#ffffff';
const GREY       = '#94A3B8';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
function fadeScene(frame: number, i0: number, i1: number, o0: number, o1: number) {
  return interpolate(frame, [i0, i1, o0, o1], [0, 1, 1, 0], clamp);
}

// ─── Particles (positions pour 1920×1080) ────────────────────────────────────
const PARTICLES = [
  { x: 80,   y: 120,  size: 5, phase: 0.0, speed: 0.022 },
  { x: 380,  y: 280,  size: 3, phase: 1.1, speed: 0.018 },
  { x: 720,  y: 90,   size: 7, phase: 2.1, speed: 0.026 },
  { x: 1060, y: 220,  size: 4, phase: 0.6, speed: 0.020 },
  { x: 1380, y: 340,  size: 2, phase: 1.7, speed: 0.031 },
  { x: 1680, y: 160,  size: 6, phase: 2.4, speed: 0.019 },
  { x: 1900, y: 480,  size: 3, phase: 0.9, speed: 0.024 },
  { x: 200,  y: 560,  size: 5, phase: 1.8, speed: 0.017 },
  { x: 520,  y: 760,  size: 4, phase: 2.9, speed: 0.028 },
  { x: 860,  y: 640,  size: 2, phase: 0.4, speed: 0.021 },
  { x: 1200, y: 820,  size: 7, phase: 1.2, speed: 0.016 },
  { x: 1540, y: 700,  size: 3, phase: 2.2, speed: 0.030 },
  { x: 1820, y: 900,  size: 5, phase: 0.7, speed: 0.023 },
  { x: 140,  y: 940,  size: 4, phase: 1.6, speed: 0.027 },
  { x: 440,  y: 1020, size: 6, phase: 2.7, speed: 0.020 },
  { x: 780,  y: 460,  size: 2, phase: 0.2, speed: 0.025 },
  { x: 1100, y: 580,  size: 4, phase: 1.0, speed: 0.018 },
  { x: 1440, y: 980,  size: 3, phase: 2.0, speed: 0.029 },
  { x: 1760, y: 560,  size: 5, phase: 0.5, speed: 0.022 },
  { x: 960,  y: 1040, size: 7, phase: 1.5, speed: 0.016 },
];

const Particles: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 1 }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    {PARTICLES.map((p, i) => {
      const osc    = (Math.sin(frame * p.speed + p.phase) * 0.5 + 0.5) * 0.7 * opacity;
      const floatY = Math.sin(frame * 0.012 + p.phase) * 20;
      const floatX = Math.cos(frame * 0.008 + p.phase) * 12;
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

// ─── SCENE 1 — Logo (0–90) ────────────────────────────────────────────────────
const Scene1H: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 0, 6, 60, 72);

  const ls = spring({ frame, fps, config: { stiffness: 320, damping: 18, mass: 0.7 } });
  const logoScale = interpolate(ls, [0, 1], [0.2, 1]);
  const logoOp    = interpolate(frame, [0, 8], [0, 1], clamp);

  const burstOp = interpolate(frame, [0, 6, 28, 50], [0, 0.7, 0.25, 0], clamp);
  const burstSc = interpolate(frame, [0, 28], [0.4, 1.6], clamp);

  const tl    = spring({ frame: frame - 20, fps, config: { stiffness: 200, damping: 14 } });
  const tagY  = interpolate(tl, [0, 1], [30, 0]);
  const tagOp = interpolate(frame, [20, 32], [0, 1], clamp);
  const lineW = interpolate(frame, [30, 52], [0, 1], clamp);

  const badgeS  = spring({ frame: frame - 38, fps, config: { stiffness: 240, damping: 14 } });
  const badgeSc = interpolate(badgeS, [0, 1], [0.6, 1]);
  const badgeOp = interpolate(frame, [38, 50], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <div style={{
        position: 'absolute', left: '50%', top: '45%',
        transform: `translate(-50%,-50%) scale(${burstSc})`,
        width: 900, height: 900, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(0,212,255,${burstOp * 0.40}) 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '45%',
        transform: `translate(-50%,-50%) scale(${1 + Math.sin(frame * 0.05) * 0.05})`,
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <Particles frame={frame} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <div style={{ transform: `scale(${logoScale})`, opacity: logoOp }}>
          <Img src={staticFile('logo.png')} style={{ width: 760, height: 253, objectFit: 'contain', display: 'block' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, transform: `translateY(${tagY}px)`, opacity: tagOp }}>
          <span style={{ color: WHITE, fontSize: 34, fontWeight: 600, textAlign: 'center', fontFamily: 'system-ui', letterSpacing: 0.5 }}>
            Le meilleur outil pour les dropshippers sur Etsy
          </span>
          <div style={{
            width: 600, height: 2,
            background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`,
            boxShadow: `0 0 12px ${CYAN}`,
            transformOrigin: 'center', transform: `scaleX(${lineW})`,
          }} />
        </div>
        <div style={{
          opacity: badgeOp, transform: `scale(${badgeSc})`,
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.30)',
          borderRadius: 9999, paddingInline: 28, paddingBlock: 12,
        }}>
          <span style={{ fontSize: 24, color: CYAN }}>✦</span>
          <span style={{ color: CYAN, fontSize: 22, fontWeight: 600, fontFamily: 'system-ui', letterSpacing: 1 }}>Propulsé par l'IA</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 2 — Problème (90–210) — layout côte-à-côte ────────────────────────
const Scene2H: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 85, 96, 198, 210);

  const s1 = spring({ frame: frame - 92, fps, config: { stiffness: 180, damping: 13 } });
  const x1 = interpolate(s1, [0, 1], [-160, 0]);
  const o1 = interpolate(frame, [92, 106], [0, 1], clamp);

  const s2 = spring({ frame: frame - 128, fps, config: { stiffness: 180, damping: 13 } });
  const x2 = interpolate(s2, [0, 1], [160, 0]);
  const o2 = interpolate(frame, [128, 142], [0, 1], clamp);

  const textFade = interpolate(frame, [168, 182], [1, 0], clamp);
  const lineX    = interpolate(frame, [172, 198], [0, 1], clamp);
  const lineOp   = interpolate(frame, [172, 180, 200, 210], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Particles frame={frame} opacity={0.35} />
      {/* Ligne verticale séparatrice */}
      <div style={{
        position: 'absolute', left: '50%', top: '15%', bottom: '15%', width: 1,
        background: `linear-gradient(to bottom, transparent, rgba(0,212,255,0.3), transparent)`,
        transform: 'translateX(-50%)',
        opacity: interpolate(frame, [100, 120], [0, 1], clamp) * textFade,
      }} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {/* Gauche */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `translateX(${x1}px)`, opacity: o1 * textFade,
          paddingInline: 80,
        }}>
          <span style={{ color: WHITE, fontSize: 72, fontWeight: 800, textAlign: 'center', fontFamily: 'system-ui', lineHeight: 1.1 }}>
            Tu vends<br />sur Etsy.
          </span>
        </div>
        {/* Droite */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `translateX(${x2}px)`, opacity: o2 * textFade,
          paddingInline: 80,
        }}>
          <span style={{ color: CYAN, fontSize: 66, fontWeight: 800, textAlign: 'center', fontFamily: 'system-ui', lineHeight: 1.1, textShadow: `0 0 30px rgba(0,212,255,0.4)` }}>
            Tu fais tout<br />à la main&nbsp;?
          </span>
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

// ─── SCENE 3 — Solution (210–360) ────────────────────────────────────────────
const Scene3H: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
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
        background: `radial-gradient(ellipse 60% 70% at 50% 48%, rgba(0,212,255,0.22) 0%, transparent 65%)`,
        transform: `scale(${haloScale})`,
      }} />
      <Particles frame={frame} opacity={0.5} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 50 }}>
        <div style={{ transform: `scale(${textScale})`, opacity: textOp, textAlign: 'center' }}>
          <span style={{ color: WHITE, fontSize: 110, fontWeight: 900, fontFamily: 'system-ui', lineHeight: 1.0, letterSpacing: -2 }}>Etsmart </span>
          <span style={{ color: CYAN, fontSize: 110, fontWeight: 900, fontFamily: 'system-ui', textShadow: `0 0 40px ${CYAN}` }}>fait tout.</span>
        </div>
        <div style={{
          opacity: badgeOp,
          transform: `perspective(700px) rotateX(${badgeRotateX}deg) scale(${badgeScale})`,
          background: 'linear-gradient(135deg, #004d6e 0%, #001a2e 100%)',
          border: `1.5px solid ${CYAN}`,
          borderRadius: 60, paddingInline: 56, paddingBlock: 22,
          boxShadow: `0 0 30px rgba(0,212,255,0.4), 0 0 80px rgba(0,212,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}>
          <span style={{ color: WHITE, fontSize: 36, fontWeight: 700, letterSpacing: 1, fontFamily: 'system-ui' }}>✦ Propulsé par l'IA</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 4 — Features (360–620) — grille 2×2 ───────────────────────────────
const FEATURES_H = [
  { icon: '🔍', title: 'Analyse produit IA',    subtitle: 'Score de saturation, revenus projetés', startRow: 0, startCol: 0 },
  { icon: '✍️', title: 'Listing Etsy optimisé', subtitle: 'Titre, tags, description SEO auto',      startRow: 0, startCol: 1 },
  { icon: '🖼️', title: 'Images produit IA',      subtitle: '7 visuels pro générés en 1 clic',        startRow: 1, startCol: 0 },
  { icon: '🔑', title: 'Keywords Etsy',          subtitle: 'Niches peu saturées, volume réel',        startRow: 1, startCol: 1 },
];

// Timings : ligne 1 à 380 (col 0 = 380, col 1 = 406), ligne 2 à 460 (col 0 = 460, col 1 = 486)
function featureStart(row: number, col: number) {
  return 380 + row * 80 + col * 26;
}

const FeatureCardH: React.FC<{
  frame: number; fps: number; icon: string; title: string; subtitle: string;
  row: number; col: number;
}> = ({ frame, fps, icon, title, subtitle, row, col }) => {
  const start = featureStart(row, col);
  const s  = spring({ frame: frame - start, fps, config: { stiffness: 190, damping: 16 } });
  const ty = interpolate(s, [0, 1], [60, 0]);
  const sc = interpolate(s, [0, 1], [0.88, 1]);
  const op = interpolate(frame, [start, start + 14], [0, 1], clamp);
  const glow = interpolate(frame, [start, start + 30, start + 80], [1, 0.5, 0.2], clamp);

  return (
    <div style={{
      transform: `translateY(${ty}px) scale(${sc})`, opacity: op,
      background: `linear-gradient(135deg, ${CARD_BG} 0%, #060d1a 100%)`,
      border: `1px solid rgba(0,212,255,${0.2 + glow * 0.5})`,
      borderRadius: 24, padding: '28px 32px',
      display: 'flex', alignItems: 'center', gap: 22,
      boxShadow: `0 0 ${20 + glow * 40}px rgba(0,212,255,${0.05 + glow * 0.2})`,
      flex: '1 1 0',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 16, flexShrink: 0,
        background: 'radial-gradient(circle, rgba(0,212,255,0.18) 0%, transparent 70%)',
        border: '1px solid rgba(0,212,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
      }}>{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ color: WHITE, fontSize: 30, fontWeight: 700, fontFamily: 'system-ui' }}>{title}</span>
        <span style={{ color: CYAN_LIGHT, fontSize: 20, fontFamily: 'system-ui', opacity: 0.85 }}>{subtitle}</span>
      </div>
    </div>
  );
};

const Scene4H: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 357, 368, 608, 620);
  const titleS  = spring({ frame: frame - 360, fps, config: { stiffness: 180, damping: 14 } });
  const titleOp = interpolate(frame, [360, 374], [0, 1], clamp);
  const subS    = spring({ frame: frame - 374, fps, config: { stiffness: 160, damping: 14 } });
  const subOp   = interpolate(frame, [374, 388], [0, 1], clamp);

  const row0 = FEATURES_H.filter((f) => f.startRow === 0);
  const row1 = FEATURES_H.filter((f) => f.startRow === 1);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Particles frame={frame} opacity={0.25} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 80, gap: 22 }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ opacity: titleOp, transform: `translateY(${interpolate(titleS, [0,1],[30,0])})` }}>
            <span style={{ color: CYAN, fontSize: 22, fontWeight: 600, letterSpacing: 7, textTransform: 'uppercase', fontFamily: 'system-ui' }}>
              Ce que tu obtiens
            </span>
          </div>
          <div style={{ opacity: subOp, transform: `translateY(${interpolate(subS, [0,1],[20,0])})` }}>
            <span style={{ color: WHITE, fontSize: 44, fontWeight: 800, fontFamily: 'system-ui', letterSpacing: -0.5 }}>
              Sur Etsmart, vous pouvez&nbsp;:
            </span>
          </div>
        </div>
        {/* Grille 2×2 */}
        <div style={{ display: 'flex', gap: 20, width: '100%' }}>
          {row0.map((f) => <FeatureCardH key={f.title} frame={frame} fps={fps} icon={f.icon} title={f.title} subtitle={f.subtitle} row={f.startRow} col={f.startCol} />)}
        </div>
        <div style={{ display: 'flex', gap: 20, width: '100%' }}>
          {row1.map((f) => <FeatureCardH key={f.title} frame={frame} fps={fps} icon={f.icon} title={f.title} subtitle={f.subtitle} row={f.startRow} col={f.startCol} />)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 5 — Gestionnaire (620–800) ────────────────────────────────────────
const Scene5H: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 617, 628, 788, 800);

  const zoomS = spring({ frame: frame - 622, fps, config: { stiffness: 120, damping: 18 } });
  const scale = interpolate(zoomS, [0, 1], [1.3, 1.0]);

  const rotS = spring({ frame: frame - 622, fps, config: { stiffness: 100, damping: 16 } });
  const rotY = interpolate(rotS, [0, 1], [15, 0]);

  const entryOp = interpolate(frame, [622, 640], [0, 1], clamp);

  const scrollStart = 622 + 60;
  const scrollS = spring({ frame: frame - scrollStart, fps, config: { stiffness: 60, damping: 20 } });
  const scrollY = interpolate(scrollS, [0, 1], [0, -360]);

  const labelOp = interpolate(frame, [622, 638], [0, 1], clamp);
  const labelS  = spring({ frame: frame - 622, fps, config: { stiffness: 180, damping: 14 } });
  const labelY  = interpolate(labelS, [0, 1], [30, 0]);

  const subtitleOp = interpolate(frame, [636, 654], [0, 1], clamp);
  const subtitleS  = spring({ frame: frame - 636, fps, config: { stiffness: 160, damping: 16 } });
  const subtitleY  = interpolate(subtitleS, [0, 1], [20, 0]);

  // Dashboard width pour 1920px : 1400px
  const DASH_W = 1400;
  const WIN_W  = 1500;
  const WIN_H  = 720;

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 48%, rgba(0,212,255,0.07) 0%, transparent 60%)' }} />
      <Particles frame={frame} opacity={0.15} />

      {/* Header texte */}
      <div style={{
        position: 'absolute', top: 40, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div style={{ opacity: labelOp, transform: `translateY(${labelY}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span style={{ color: CYAN, fontSize: 18, fontWeight: 600, letterSpacing: 6, textTransform: 'uppercase', fontFamily: 'system-ui' }}>Gestionnaire</span>
          <span style={{ color: WHITE, fontSize: 38, fontWeight: 800, fontFamily: 'system-ui', letterSpacing: -0.5 }}>Gérez toutes vos boutiques</span>
        </div>
        <div style={{ opacity: subtitleOp, transform: `translateY(${subtitleY}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 20, fontFamily: 'system-ui', textAlign: 'center' }}>
            Suivez vos ventes, commandes et profits de chaque boutique Etsy en quelques clics
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            {['📦 Transactions', '📊 Statistiques', '🌍 Commandes par pays'].map((b) => (
              <div key={b} style={{
                padding: '5px 14px', borderRadius: 9999,
                background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.22)',
                fontSize: 13, color: CYAN, fontFamily: 'system-ui', fontWeight: 500,
              }}>{b}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Dashboard window */}
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 180 }}>
        <div style={{
          opacity: entryOp,
          transform: `perspective(1400px) rotateY(${rotY}deg) scale(${scale})`,
          transformOrigin: 'center center',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: `0 0 100px rgba(0,212,255,0.15), 0 40px 100px rgba(0,0,0,0.7)`,
          border: '1px solid rgba(0,212,255,0.28)',
          width: WIN_W,
          height: WIN_H,
        }}>
          {/* macOS bar */}
          <div style={{
            height: 40, background: '#06080f',
            borderBottom: '1px solid rgba(0,212,255,0.15)',
            display: 'flex', alignItems: 'center', paddingInline: 16, gap: 7, flexShrink: 0,
          }}>
            {['#ff5f57','#febc2e','#28c840'].map((c) => (
              <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
            ))}
            <span style={{ color: '#3a4a5a', fontSize: 12, fontFamily: 'system-ui', marginLeft: 12 }}>etsmart.app/dashboard</span>
            <div style={{ marginLeft: 'auto', background: 'rgba(0,212,255,0.1)', borderRadius: 16, paddingInline: 12, paddingBlock: 4, border: '1px solid rgba(0,212,255,0.28)' }}>
              <span style={{ color: CYAN, fontSize: 12, fontWeight: 600, fontFamily: 'system-ui' }}>⟳ 1 842 crédits</span>
            </div>
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#000', height: WIN_H - 40 }}>
            <div style={{ transform: `translateY(${scrollY}px)`, transition: 'none' }}>
              <DashboardMockup width={DASH_W} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 6 — CTA (800–930) ─────────────────────────────────────────────────
const Scene6H: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 797, 808, 918, 930);

  const loop  = ((frame - 800) % 50) / 50;
  const loop2 = ((frame - 800 + 25) % 50) / 50;
  const pulseS   = interpolate(loop,  [0, 0.5, 1], [1, 1.08, 1]);
  const pulse2S  = interpolate(loop2, [0, 0.5, 1], [1, 1.12, 1]);
  const pulseOp  = interpolate(loop,  [0, 0.3, 1], [0.25, 0.08, 0.25]);
  const pulse2Op = interpolate(loop2, [0, 0.3, 1], [0.14, 0.04, 0.14]);

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
          position: 'absolute', left: '50%', top: '44%',
          transform: `translate(-50%,-50%) scale(${s})`,
          width: 900, height: 900, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(0,212,255,${o}) 0%, transparent 65%)`,
          pointerEvents: 'none',
        }} />
      ))}
      <Particles frame={frame} opacity={0.5} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 100, gap: 44 }}>
        <div style={{ transform: `scale(${ctaScale})`, opacity: ctaOp, textAlign: 'center' }}>
          <span style={{ color: WHITE, fontSize: 96, fontWeight: 900, fontFamily: 'system-ui', lineHeight: 1.1, letterSpacing: -2 }}>Commence </span>
          <span style={{ color: CYAN, fontSize: 96, fontWeight: 900, fontFamily: 'system-ui', lineHeight: 1.1, letterSpacing: -2, textShadow: `0 0 40px ${CYAN}` }}>gratuitement</span>
        </div>
        <div style={{ opacity: urlOp, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ color: CYAN_LIGHT, fontSize: 54, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: 1 }}>etsmart.app</span>
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
          paddingInline: 56, paddingBlock: 20, background: 'rgba(0,212,255,0.07)',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 50%, transparent 100%)',
            transform: `translateX(${shimmer}%)`, pointerEvents: 'none',
          }} />
          <span style={{ color: WHITE, fontSize: 34, fontWeight: 700, letterSpacing: 3, fontFamily: 'system-ui' }}>FREE &amp; PRO</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SCENE 7 — Fin (930–1050) ─────────────────────────────────────────────────
const Scene7H: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const op = fadeScene(frame, 927, 940, 1040, 1050);

  const ls = spring({ frame: frame - 934, fps, config: { stiffness: 150, damping: 14 } });
  const logoScale = interpolate(ls, [0, 1], [0.55, 1]);
  const logoOp    = interpolate(frame, [934, 950], [0, 1], clamp);

  const tagOp = interpolate(frame, [966, 982], [0, 1], clamp);
  const tagY  = interpolate(spring({ frame: frame - 966, fps, config: { stiffness: 140, damping: 13 } }), [0, 1], [30, 0]);

  const ringOp = interpolate(frame, [940, 970], [0, 0.55], clamp);
  const ringW = 640; const ringH = 260;

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Particles frame={frame} opacity={0.85} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'absolute',
            width: ringW, height: ringH,
            borderRadius: '50%',
            border: `1px solid rgba(0,212,255,${ringOp})`,
            boxShadow: `0 0 30px rgba(0,212,255,${ringOp * 0.5}), 0 0 60px rgba(0,212,255,${ringOp * 0.2})`,
            pointerEvents: 'none',
          }} />
          <div style={{ transform: `scale(${logoScale})`, opacity: logoOp, position: 'relative', zIndex: 1 }}>
            <Img src={staticFile('logo.png')} style={{ width: 560, height: 186, objectFit: 'contain', display: 'block' }} />
          </div>
        </div>
        <div style={{ width: 100, height: 2, background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`, boxShadow: `0 0 14px ${CYAN}`, opacity: logoOp }} />
        <div style={{ transform: `translateY(${tagY}px)`, opacity: tagOp, textAlign: 'center' }}>
          <span style={{ color: GREY, fontSize: 42, fontWeight: 400, fontFamily: 'system-ui' }}>Vends plus. </span>
          <span style={{ color: CYAN_LIGHT, fontSize: 42, fontWeight: 600, fontFamily: 'system-ui' }}>Travaille moins.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const EtsmartAdH: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '100px 100px',
      }} />
      <Scene1H frame={frame} fps={fps} />
      <Scene2H frame={frame} fps={fps} />
      <Scene3H frame={frame} fps={fps} />
      <Scene4H frame={frame} fps={fps} />
      <Scene5H frame={frame} fps={fps} />
      <Scene6H frame={frame} fps={fps} />
      <Scene7H frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};
