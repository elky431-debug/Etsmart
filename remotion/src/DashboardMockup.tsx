/**
 * DashboardMockup — reproduction visuelle du DashboardStoreManager Etsmart.
 * Données statiques fictives. Zero auth / API / useEffect / Tailwind.
 * Width = 960px pour s'adapter exactement à la fenêtre Remotion.
 */
import React from 'react';

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function donutArc(
  cx: number, cy: number,
  inner: number, outer: number,
  startDeg: number, endDeg: number
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const s = toRad(startDeg);
  const e = toRad(endDeg);
  const x1o = cx + outer * Math.cos(s);
  const y1o = cy + outer * Math.sin(s);
  const x2o = cx + outer * Math.cos(e);
  const y2o = cy + outer * Math.sin(e);
  const x1i = cx + inner * Math.cos(e);
  const y1i = cy + inner * Math.sin(e);
  const x2i = cx + inner * Math.cos(s);
  const y2i = cy + inner * Math.sin(s);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1o.toFixed(2)} ${y1o.toFixed(2)} A ${outer} ${outer} 0 ${large} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)} L ${x1i.toFixed(2)} ${y1i.toFixed(2)} A ${inner} ${inner} 0 ${large} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)} Z`;
}

// ─── Static mock data ─────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const CA_MONTHLY   = [0, 0, 150, 280, 420, 610, 790, 960, 1120, 1370, 1620, 1842];
const PROF_MONTHLY = [0, 0,  85, 162, 241, 355, 460, 555,  648,  798,  950, 1204];

const COUNTRIES_DATA = [
  { name: 'France',      value: 8, color: '#ef4444' },
  { name: 'États-Unis',  value: 5, color: '#22c55e' },
  { name: 'Belgique',    value: 4, color: '#3b82f6' },
  { name: 'Royaume-Uni', value: 2, color: '#ec4899' },
  { name: 'Allemagne',   value: 2, color: '#8b5cf6' },
];

const TOTAL_ORDERS = COUNTRIES_DATA.reduce((s, c) => s + c.value, 0);

const TRANSACTIONS = [
  { date: '2026-03-28', status: 'Envoyé',     label: '1 commande', dest: 'Paris France',       ca: 92,  net: 57 },
  { date: '2026-03-26', status: 'Envoyé',     label: '1 commande', dest: 'Lyon France',         ca: 87,  net: 54 },
  { date: '2026-03-25', status: 'À envoyer',  label: '1 commande', dest: 'New York États-Unis', ca: 110, net: 68 },
  { date: '2026-03-24', status: 'À envoyer',  label: '1 commande', dest: 'Bruxelles Belgique',  ca: 78,  net: 48 },
  { date: '2026-03-22', status: 'Envoyé',     label: '1 commande', dest: 'Berlin Allemagne',    ca: 95,  net: 59 },
  { date: '2026-03-20', status: 'À modifier', label: '1 commande', dest: 'Londres UK',          ca: 103, net: 63 },
];

// ─── Area chart ───────────────────────────────────────────────────────────────

const CW = 320; const CH = 120; const MAX_Y = 2000;

function pts(data: number[]) {
  return data.map((v, i) => ({ x: (i / (data.length - 1)) * CW, y: CH - (v / MAX_Y) * CH }));
}
function linePath(p: { x: number; y: number }[]) {
  return p.map((d, i) => `${i === 0 ? 'M' : 'L'} ${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
}
function areaPath(p: { x: number; y: number }[]) {
  return `${linePath(p)} L ${CW} ${CH} L 0 ${CH} Z`;
}

// ─── Donut chart ─────────────────────────────────────────────────────────────

const CX = 80; const CY = 80; const INNER = 38; const OUTER = 64;

const donutArcs = (() => {
  let cursor = -90;
  return COUNTRIES_DATA.map((c) => {
    const sweep = (c.value / TOTAL_ORDERS) * 360;
    const path = donutArc(CX, CY, INNER, OUTER, cursor, cursor + sweep - 1.5);
    cursor += sweep;
    return { ...c, path };
  });
})();

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ title, value, profit }: { title: string; value: string; profit?: boolean }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      padding: '14px 16px',
      borderRadius: 14,
      background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)',
      border: '1px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, margin: 0 }}>{title}</p>
      <p style={{ fontSize: 20, fontWeight: 700, marginTop: 6, margin: '6px 0 0', color: profit ? '#34d399' : '#ffffff', letterSpacing: '-0.02em' }}>{value}</p>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const s: Record<string, { bg: string; color: string }> = {
    'Envoyé':     { bg: 'rgba(16,185,129,0.2)',  color: '#34d399' },
    'À envoyer':  { bg: 'rgba(239,68,68,0.2)',   color: '#f87171' },
    'À modifier': { bg: 'rgba(245,158,11,0.2)',  color: '#fbbf24' },
  };
  const st = s[status] ?? s['À envoyer'];
  return (
    <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:9999, fontSize:9, fontWeight:600, background:st.bg, color:st.color }}>
      {status}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const DashboardMockup: React.FC<{ width?: number }> = ({ width = 960 }) => {
  const caPoints   = pts(CA_MONTHLY);
  const profPoints = pts(PROF_MONTHLY);

  return (
    <div style={{
      display: 'flex', flexDirection: 'row',
      width, minHeight: 636,
      background: '#000000',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#ffffff',
    }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 190, flexShrink: 0,
        background: 'linear-gradient(to bottom, #09090b, #000)',
        borderRight: '1px solid rgba(255,255,255,0.10)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0 }}>Gestion de vos boutiques Etsy</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3, margin: '3px 0 0' }}>Boutiques, produits et commandes</p>
        </div>
        <nav style={{ padding: 10, flex: 1 }}>
          {/* Dashboard button */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px',
            borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.22)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,212,255,0.9)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>Dashboard</span>
          </div>

          <p style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '16px 12px 5px', margin: 0 }}>Boutiques</p>

          {/* Active: Boutique 1 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px',
            borderRadius: 10, background: 'rgba(255,255,255,0.12)', marginBottom: 2,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>Boutique 1</span>
          </div>

          {/* Boutique 2 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px',
            borderRadius: 10, marginBottom: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Boutique 2</span>
          </div>

          {/* + Nouvelle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px',
            borderRadius: 10, border: '1px dashed rgba(255,255,255,0.12)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Nouvelle boutique</span>
          </div>
        </nav>
      </aside>

      {/* ── Main ── */}
      <main style={{
        flex: 1, minWidth: 0,
        padding: '18px 20px',
        background: 'linear-gradient(to bottom, #000, rgba(9,9,11,0.4), #000)',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>

        {/* Shop header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#f97316' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Boutique 1</h1>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>Tableau de bord</p>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <div style={{ padding: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <div style={{ padding: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </div>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
            borderRadius: 9, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.80)' }}>Produits</span>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            display: 'flex', borderRadius: 9999, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)', padding: 3, gap: 3, width: 'fit-content',
          }}>
            {['Gestion','Produits','Calendrier'].map((tab) => (
              <div key={tab} style={{
                padding: '5px 18px', borderRadius: 9999, fontSize: 11, cursor: 'default',
                fontWeight: tab === 'Gestion' ? 600 : 400,
                color: tab === 'Gestion' ? '#fff' : 'rgba(255,255,255,0.55)',
                background: tab === 'Gestion' ? 'rgba(255,255,255,0.18)' : 'transparent',
              }}>{tab}</div>
            ))}
          </div>
        </div>

        {/* Stats header + range */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.90)', margin: 0 }}>Statistiques</h2>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            borderRadius: 9999, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)', padding: 3,
          }}>
            {['7 jours','30 jours','Par mois','Depuis le début'].map((r) => (
              <div key={r} style={{
                padding: '4px 10px', borderRadius: 9999, fontSize: 10, cursor: 'default',
                fontWeight: r === '30 jours' ? 600 : 400,
                color: r === '30 jours' ? '#fff' : 'rgba(255,255,255,0.55)',
                background: r === '30 jours' ? 'rgba(255,255,255,0.18)' : 'transparent',
              }}>{r}</div>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <KpiCard title="CA Brut" value="1 842 €" />
          <KpiCard title="Net final (après AliExpress)" value="+1 204 €" profit />
          <KpiCard title="Panier moyen" value="87 €" />
          <KpiCard title="Commandes" value="21" />
        </div>

        {/* Charts row — area chart + donut side by side */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>

          {/* Area chart */}
          <div style={{
            flex: '1 1 0', minWidth: 0, padding: '14px 16px',
            borderRadius: 14,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0 }}>Évolution annuelle</p>
              <div style={{ padding: '2px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', fontSize: 10, color: 'rgba(255,255,255,0.70)', fontWeight: 600 }}>2026</div>
            </div>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', marginBottom: 8, marginTop: 2 }}>CA et profit par mois (janv. → déc.)</p>
            <svg width="100%" viewBox={`0 0 ${CW} ${CH + 18}`} preserveAspectRatio="none" style={{ display: 'block' }}>
              <defs>
                <linearGradient id="caFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00c9b7" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#00c9b7" stopOpacity={0} />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <line key={f} x1={0} y1={CH * (1 - f)} x2={CW} y2={CH * (1 - f)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              ))}
              <path d={areaPath(caPoints)} fill="url(#caFill)" />
              <path d={linePath(caPoints)} fill="none" stroke="#00d4ff" strokeWidth={1.8} />
              <path d={areaPath(profPoints)} fill="url(#profFill)" />
              <path d={linePath(profPoints)} fill="none" stroke="#00c9b7" strokeWidth={1.4} />
              {MONTHS_SHORT.map((m, i) => (
                <text key={m} x={(i / (MONTHS_SHORT.length - 1)) * CW} y={CH + 13}
                  textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.38)" fontFamily="system-ui">{m}</text>
              ))}
            </svg>
          </div>

          {/* Donut chart — Commandes par pays */}
          <div style={{
            width: 210, flexShrink: 0, padding: '14px 16px',
            borderRadius: 14,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0 }}>Commandes par pays</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', marginTop: 2, marginBottom: 10 }}>Répartition géographique</p>

            <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
              <svg width={160} height={160} viewBox="0 0 160 160">
                {donutArcs.map((arc) => (
                  <path key={arc.name} d={arc.path} fill={arc.color} opacity={0.92} />
                ))}
                <circle cx={CX} cy={CY} r={INNER - 3} fill="rgba(0,0,0,0.7)" />
              </svg>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{TOTAL_ORDERS}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>Total</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {COUNTRIES_DATA.map((c) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.80)', fontWeight: 600 }}>{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transactions table */}
        <div style={{
          padding: '14px 16px', borderRadius: 14,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0 }}>Transactions</p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', marginTop: 2, marginBottom: 10 }}>Liste des commandes de la boutique</p>

          {/* Search row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, flex: 1,
              padding: '7px 11px', borderRadius: 10,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>Rechercher par libellé, destination…</span>
            </div>
            <div style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(24,24,27,0.9)', border: '1px solid rgba(0,212,255,0.30)', fontSize: 10, color: 'rgba(255,255,255,0.70)' }}>Tous</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 10, background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.35)',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#00d4ff' }}>Nouvelle transaction</span>
            </div>
          </div>

          {/* Table */}
          <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.10)', overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '105px 1fr 1fr 65px 65px 65px 50px',
              background: 'rgba(24,24,27,0.85)', borderBottom: '1px solid rgba(255,255,255,0.10)',
              padding: '8px 12px',
            }}>
              {['Date & statut','Libellé','Destination','CA brut','CA net','Net final','Actions'].map((h) => (
                <span key={h} style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.50)' }}>{h}</span>
              ))}
            </div>
            {TRANSACTIONS.map((t, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '105px 1fr 1fr 65px 65px 65px 50px',
                padding: '9px 12px', alignItems: 'center',
                borderBottom: i < TRANSACTIONS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, color: '#fff' }}>{t.date}</span>
                  <Badge status={t.status} />
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.80)' }}>{t.label}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{t.dest}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{t.ca} €</span>
                <span style={{ fontSize: 10, color: '#67e8f9', fontWeight: 500 }}>{Math.round(t.ca * 0.885)} €</span>
                <span style={{ fontSize: 10, color: '#34d399', fontWeight: 500 }}>+{t.net} €</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
};
