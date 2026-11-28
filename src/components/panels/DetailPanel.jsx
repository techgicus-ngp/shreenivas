
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SQFT } from '../../lib/units';
import { STATUS } from '../../theme/status';

/* Public plot card. A clean specification sheet:
   Plot No. and Booking status in the header, then Area, Facing, Front road
   width, and a price calculator (Area x Plot Rate). */
const INK = '#2A1620';
const PLUM = '#5A2A3A';
const PLUM_DEEP = '#43202C';
const ACCENT = '#7B3B52';
const MUTED = '#76646C';
const LINE = '#ECE6E8';
const SURFACE = '#FAF7F8';
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const DOCK_BP = 1024; // at or below this the panel docks to a corner
const isDockNow = () => typeof window !== 'undefined'
  && window.matchMedia(`(max-width: ${DOCK_BP}px)`).matches;

/* "East", "north-east", "NE facing" -> compass bearing for the needle */
const BEARING = {
  n: 0, north: 0, ne: 45, northeast: 45, e: 90, east: 90, se: 135, southeast: 135,
  s: 180, south: 180, sw: 225, southwest: 225, w: 270, west: 270, nw: 315, northwest: 315,
};
const bearingOf = (f) => BEARING[f.toLowerCase().replace(/facing/g, '').replace(/[^a-z]/g, '')];

const inr = (n) => `₹ ${Math.round(n).toLocaleString('en-IN')}`;

/* 12,50,000 -> "₹ 12.50 Lakh", 2,10,00,000 -> "₹ 2.10 Crore" */
function compactINR(n) {
  const v = Math.round(n);
  if (v >= 10000000) return `₹ ${(v / 10000000).toFixed(2)} Crore`;
  if (v >= 100000) return `₹ ${(v / 100000).toFixed(2)} Lakh`;
  return null;
}

/* Road width: "30" -> "30 ft", "9 m" stays as typed */
function prettyRoad(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return /^\d+(\.\d+)?$/.test(s) ? `${s} ft` : s;
}

function Ico({ d, size = 16, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d && <path d={d} />}
      {children}
    </svg>
  );
}

function Compass({ deg, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <g style={{ transform: `rotate(${deg || 0}deg)`, transformOrigin: '12px 12px' }}>
        <path d="M12 4.5l3 7.5H9z" fill="currentColor" stroke="none" />
        <path d="M12 19.5L9 12h6z" fill="currentColor" stroke="none" opacity=".28" />
      </g>
    </svg>
  );
}

const RoadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3 4 21M16 3l4 18M12 4v3M12 10.5v3M12 17v3" />
  </svg>
);

const DocIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
const DownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </svg>
);

export default function DetailPanel({ plot, status, onClose, onReserve, sevenTwelveUrl }) {
  const [dl, setDl] = useState(false);
  const [dock, setDock] = useState(isDockNow);
  const [collapsed, setCollapsed] = useState(isDockNow); // chip on phones, open on laptops
  const [side, setSide] = useState('right');
  const [unit, setUnit] = useState('sqft');
  const [rate, setRate] = useState('');
  const boxRef = useRef(null);
  const reserveRef = useRef(onReserve);

  useEffect(() => { reserveRef.current = onReserve; }, [onReserve]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(`(max-width: ${DOCK_BP}px)`);
    const onChange = (e) => setDock(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* A different plot starts from its own recorded rate. */
  const d0 = (plot && plot.doc) || {};
  const recordedRate = d0.plotRate ?? d0.rate ?? d0.ratePerSqft ?? '';
  useEffect(() => {
    setRate(recordedRate === '' ? '' : String(recordedRate).replace(/[^\d.]/g, ''));
    setUnit('sqft');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plot && plot.name]);

  /* Tell the map which band the panel covers, so it can frame the plot in
     the space that is left. A closed chip reserves nothing. */
  useEffect(() => {
    const send = reserveRef.current;
    if (!send) return undefined;
    const el = boxRef.current;
    if (!plot || !el) { send({ right: 0, bottom: 0 }); return undefined; }

    const measure = () => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (dock) {
        if (collapsed) { send({ right: 0, bottom: 0 }); return; }
        if (side === 'right' && r.width <= vw * 0.62) {
          send({ right: Math.round(Math.max(vw - r.left, 0)), bottom: 0 });
        } else {
          send({ right: 0, bottom: Math.round(Math.max(vh - r.top, 0)) });
        }
        return;
      }
      send({ right: r.height > vh * 0.55 ? Math.round(Math.max(vw - r.left, 0)) : 0, bottom: 0 });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [plot, dock, collapsed, side]);

  useEffect(() => () => {
    if (reserveRef.current) reserveRef.current({ right: 0, bottom: 0 });
  }, []);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);
  const flip = useCallback(() => setSide((s) => (s === 'right' ? 'left' : 'right')), []);

  if (!plot) return null;

  const st = status[plot.name] || 'available';
  const stMeta = STATUS[st];
  const doc = plot.doc || {};

  const facing = String(doc.facing || '').trim();
  const road = prettyRoad(doc.frontRoadWidth ?? doc.roadWidth ?? doc.road_width ?? doc.frontRoad ?? doc.road);

  /* 7/12 extract: passed in, else whatever link the plot record carries. */
  const docUrl = String(
    sevenTwelveUrl || doc.sevenTwelveUrl || doc.sevenTwelve || doc.satbara || doc.doc712 || doc.extract712 || '',
  ).trim();

  const downloadDoc = async () => {
    if (!docUrl || dl) return;
    setDl(true);
    try {
      const res = await fetch(docUrl);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const t = blob.type || '';
      let ext = 'pdf';
      if (t.includes('jpeg')) ext = 'jpg';
      else if (t.includes('png')) ext = 'png';
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `7-12_Plot-${plot.name}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
    } catch {
      /* cross-origin or blocked: fall back to opening the file */
      window.open(docUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setDl(false);
    }
  };

  const sqftExact = plot.area * SQFT;
  const sqft = Math.round(sqftExact);
  const sqm = Math.round(plot.area);

  /* Calculator: Area x Plot Rate, in the unit the person picks. */
  const areaForCalc = unit === 'sqft' ? sqftExact : plot.area;
  const rateNum = parseFloat(rate);
  const hasRate = Number.isFinite(rateNum) && rateNum > 0;
  const total = hasRate ? areaForCalc * rateNum : 0;
  const words = hasRate ? compactINR(total) : null;
  const unitLabel = unit === 'sqft' ? 'sq ft' : 'm²';
  const areaForCalcLabel = Math.round(areaForCalc).toLocaleString('en-IN');

  return (
    <>
      <style>{`
        @keyframes panelIn { from { transform: translateX(14px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes dockIn { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }

        .pp { position: absolute; top: 12px; right: 12px; width: 320px; max-height: calc(100% - 24px);
          display: flex; flex-direction: column; background: #fff; color: ${INK};
          border: 1px solid ${LINE}; border-radius: 14px; z-index: 12; box-sizing: border-box; overflow: hidden;
          box-shadow: 0 1px 2px rgba(42,22,32,.06), 0 16px 36px -12px rgba(42,22,32,.34);
          animation: panelIn .26s cubic-bezier(.16,1,.3,1); font-family: ${SANS};
          -webkit-font-smoothing: antialiased; }
        .pp :focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
        .pp-head :focus-visible { outline-color: #fff; }

        /* ---------- header: plot number and booking status ---------- */
        .pp-head { flex: 0 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) auto;
          grid-template-areas: "lbl tools" "num status"; align-items: center; column-gap: 12px; row-gap: 2px;
          padding: 10px 8px 14px 18px; color: #fff;
          background: linear-gradient(135deg, ${PLUM} 0%, ${PLUM_DEEP} 100%); }
        .pp-title, .pp-id { display: contents; }
        .pp-pre { grid-area: lbl; font-size: 10.5px; font-weight: 600; line-height: 1; letter-spacing: .18em;
          text-transform: uppercase; color: rgba(255,255,255,.66); }
        .pp-name { grid-area: num; min-width: 0; font-size: 34px; font-weight: 700; line-height: 1.05; letter-spacing: -.02em;
          font-variant-numeric: lining-nums tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pp-statuswrap { grid-area: status; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; padding-right: 10px; }
        .pp-statuslbl { font-size: 9.5px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.6); }
        .pp-status { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px 5px 10px; border-radius: 999px;
          font-size: 12.5px; font-weight: 600; white-space: nowrap; color: #fff;
          background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.26); }
        .pp-status i { width: 8px; height: 8px; border-radius: 50%; background: var(--st); flex: 0 0 auto;
          box-shadow: 0 0 0 2px rgba(255,255,255,.9); }

        .pp-mini { display: none; font-size: 13px; font-weight: 500; color: rgba(255,255,255,.86); }
        .pp-mini b { font-weight: 700; color: #fff; }
        .pp-tools { grid-area: tools; justify-self: end; display: flex; align-items: center; }
        .pp-btn { background: none; border: 0; color: rgba(255,255,255,.78); cursor: pointer; width: 32px; height: 32px;
          border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 3px; }
        .pp-btn:hover { background: rgba(255,255,255,.14); color: #fff; }
        .pp-min { width: auto; min-width: 32px; padding: 0 6px; }
        .pp-chev { display: flex; transition: transform .2s ease; }
        .pp[data-collapsed="0"] .pp-chev { transform: rotate(180deg); }
        .pp-lbl { display: none; }
        .pp[data-collapsed="1"] .pp-title { cursor: pointer; }
        .pp-flip { display: none; }

        /* ---------- body ---------- */
        .pp-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch; display: block; }
        .pp-sec { padding: 14px 18px; border-top: 1px solid ${LINE}; }
        .pp-sec:first-child { border-top: 0; }
        .pp-k { font-size: 10.5px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: ${MUTED}; }

        /* area: two figures side by side */
        .pp-area { display: grid; grid-template-columns: 1fr 1fr; padding: 0; }
        .pp-area > div { padding: 14px 18px 15px; min-width: 0; }
        .pp-area > div + div { border-left: 1px solid ${LINE}; }
        .pp-area-v { margin-top: 6px; display: flex; align-items: baseline; gap: 5px; font-size: 26px; font-weight: 700;
          line-height: 1; letter-spacing: -.02em; color: ${INK}; font-variant-numeric: lining-nums tabular-nums; }
        .pp-area-v span { font-size: 12.5px; font-weight: 600; letter-spacing: 0; color: ${MUTED}; }

        /* specification rows */
        .pp-specs { padding-top: 4px; padding-bottom: 4px; margin: 0; }
        .pp-spec { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0;
          border-top: 1px solid ${LINE}; }
        .pp-spec:first-child { border-top: 0; }
        .pp-spec dt { margin: 0; font-size: 13px; font-weight: 500; color: ${MUTED}; }
        .pp-spec dd { margin: 0; display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 15px; font-weight: 600;
          text-align: right; overflow-wrap: anywhere; font-variant-numeric: lining-nums tabular-nums; }
        .pp-spec dd svg { flex: 0 0 auto; color: ${ACCENT}; }
        .pp-na { color: #A89AA0; font-weight: 500; }

        /* calculator */
        .pp-calc { background: ${SURFACE}; }
        .pp-calc-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .pp-calc-sub { font-size: 11.5px; font-weight: 500; color: ${MUTED}; }
        .pp-ctrl { margin-top: 11px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: stretch; }
        .pp-input { display: flex; align-items: center; min-width: 0; border: 1px solid #DDD3D7; border-radius: 10px; background: #fff;
          overflow: hidden; transition: border-color .14s ease, box-shadow .14s ease; }
        .pp-input:focus-within { border-color: ${ACCENT}; box-shadow: 0 0 0 3px rgba(123,59,82,.14); }
        .pp-input b { padding: 0 0 0 12px; font-size: 15px; font-weight: 600; color: ${MUTED}; }
        .pp-input input { flex: 1 1 auto; min-width: 0; width: 100%; border: 0; outline: 0; background: none; padding: 11px 10px 11px 8px;
          font: 600 16px ${SANS}; color: ${INK}; font-variant-numeric: tabular-nums; }
        .pp-input input::placeholder { color: #B5A8AE; font-weight: 500; }
        .pp-seg { display: inline-flex; padding: 3px; border: 1px solid #DDD3D7; border-radius: 10px; background: #fff; }
        .pp-seg button { border: 0; background: none; cursor: pointer; padding: 0 10px; border-radius: 7px;
          font: 600 12px ${SANS}; color: ${MUTED}; white-space: nowrap; }
        .pp-seg button:hover { color: ${INK}; }
        .pp-seg button[aria-pressed="true"] { background: ${PLUM}; color: #fff; }

        .pp-sum { margin: 12px 0 0; }
        .pp-sum-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 4px 0;
          font-size: 13px; color: ${MUTED}; font-variant-numeric: tabular-nums; }
        .pp-sum-row dt { margin: 0; }
        .pp-sum-row dd { margin: 0; font-weight: 600; color: ${INK}; text-align: right; }
        .pp-total { margin-top: 8px; padding-top: 12px; border-top: 1px dashed #D5C9CE; }
        .pp-total-k { font-size: 10.5px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: ${PLUM}; }
        .pp-total-v { margin-top: 4px; font-size: 28px; font-weight: 700; line-height: 1.1; letter-spacing: -.02em; color: ${PLUM};
          font-variant-numeric: lining-nums tabular-nums; overflow-wrap: anywhere; }
        .pp-total-v.is-empty { font-size: 13.5px; font-weight: 500; letter-spacing: 0; color: #A89AA0; }
        .pp-total-w { margin-top: 3px; font-size: 12.5px; font-weight: 500; color: ${MUTED}; }

        /* 7/12 actions */
        .pp-docs-acts { margin-top: 11px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px; }
        .pp-doc { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; padding: 0 10px;
          border-radius: 10px; font: 600 13px ${SANS}; text-decoration: none; cursor: pointer; white-space: nowrap;
          border: 1px solid ${PLUM}; background: ${PLUM}; color: #fff; transition: background .14s ease, border-color .14s ease; }
        .pp-doc:hover { background: ${PLUM_DEEP}; border-color: ${PLUM_DEEP}; }
        .pp-doc--ghost { background: #fff; color: ${PLUM}; }
        .pp-doc--ghost:hover { background: ${SURFACE}; color: ${PLUM_DEEP}; border-color: ${PLUM_DEEP}; }
        .pp-doc[disabled], .pp-doc[aria-disabled="true"] { opacity: .45; cursor: not-allowed; pointer-events: none; }
        .pp-docs-note { margin-top: 8px; font-size: 12px; color: ${MUTED}; }

        @media (min-width: ${DOCK_BP + 1}px) {
          .pp[data-collapsed="1"] { max-height: none; }
          .pp[data-collapsed="1"] .pp-body { display: none; }
        }

        /* tablet and phone: docked to a corner so the map stays free */
        @media (max-width: ${DOCK_BP}px) {
          .pp { top: auto; left: auto; right: 10px; bottom: calc(10px + env(safe-area-inset-bottom, 0px));
            width: min(340px, calc(100vw - 20px)); max-height: min(74vh, 600px);
            animation: dockIn .22s cubic-bezier(.16,1,.3,1); }
          .pp[data-side="left"] { left: 10px; right: auto; }
          .pp-flip { display: flex; }
          .pp[data-collapsed="1"] { max-height: none; }
          .pp[data-collapsed="1"] .pp-body { display: none; }
        }
        @media (max-width: 430px) {
          .pp { right: 8px; bottom: calc(8px + env(safe-area-inset-bottom, 0px)); width: calc(100vw - 16px); max-width: 360px; }
          .pp[data-side="left"] { left: 8px; }
        }

        /* phones, closed: plot, status, area, then one full-width button */
        @media (max-width: 640px) {
          .pp-btn { width: 36px; height: 36px; }
          .pp-min { min-width: 36px; }
          .pp[data-collapsed="1"] .pp-head { grid-template-areas: "lbl x" "num status" "mini mini" "tog tog";
            padding-bottom: 12px; }
          .pp[data-collapsed="1"] .pp-tools { display: contents; }
          .pp[data-collapsed="1"] .pp-close { grid-area: x; justify-self: end; }
          .pp[data-collapsed="1"] .pp-flip { display: none; }
          .pp[data-collapsed="1"] .pp-mini { grid-area: mini; display: block; margin-top: 6px; }
          .pp[data-collapsed="1"] .pp-min { grid-area: tog; width: 100%; height: 42px; margin-top: 10px; justify-content: center;
            gap: 6px; border-radius: 10px; background: #fff; color: ${PLUM}; font-size: 13px; font-weight: 600; }
          .pp[data-collapsed="1"] .pp-min:hover { background: ${SURFACE}; color: ${PLUM_DEEP}; }
          .pp[data-collapsed="1"] .pp-lbl { display: inline; }
          .pp[data-collapsed="1"] .pp-chev { transform: rotate(180deg); }
        }
        @media (max-width: 360px) { .pp .pp-flip { display: none; } .pp-area-v { font-size: 22px; } }
        @media (max-height: 460px) and (max-width: 900px) { .pp { width: min(320px, calc(100vw - 20px)); max-height: 86vh; } }
        @media (prefers-reduced-motion: reduce) { .pp { animation: none; } .pp-chev, .pp-input { transition: none; } }
      `}</style>

      <div
        className="pp"
        key={plot.name}
        ref={boxRef}
        style={{ '--st': stMeta.dot }}
        data-collapsed={collapsed ? '1' : '0'}
        data-side={side}
        role="dialog"
        aria-label={`Plot ${plot.name}`}
      >
        {/* Plot No. and Booking status */}
        <div className="pp-head">
          <div className="pp-title" onClick={collapsed ? toggle : undefined}>
            <div className="pp-id">
              <span className="pp-pre">Plot No.</span>
              <span className="pp-name">{plot.name}</span>
            </div>
            <div className="pp-statuswrap">
              <span className="pp-statuslbl">Booking status</span>
              <span className="pp-status"><i /><span>{stMeta.label}</span></span>
            </div>
          </div>

          <span className="pp-mini">
            <b>{sqft.toLocaleString('en-IN')} sq ft</b> · {sqm.toLocaleString('en-IN')} m²
          </span>

          <div className="pp-tools">
            <button type="button" className="pp-btn pp-flip" onClick={flip}
              title={side === 'right' ? 'Move to left corner' : 'Move to right corner'}
              aria-label={side === 'right' ? 'Move panel to left corner' : 'Move panel to right corner'}>
              <Ico d="M8 7 4 11l4 4M16 7l4 4-4 4M4 11h16" size={15} />
            </button>
            <button type="button" className="pp-btn pp-min" onClick={toggle} aria-expanded={!collapsed}
              title={collapsed ? 'Show full details' : 'Collapse'}
              aria-label={collapsed ? 'Show full details' : 'Collapse'}>
              <span className="pp-lbl">Show details</span>
              <span className="pp-chev"><Ico d="M6 9l6 6 6-6" size={15} /></span>
            </button>
            <button type="button" className="pp-btn pp-close" onClick={onClose} aria-label="Close plot details">
              <Ico d="M18 6 6 18M6 6l12 12" size={15} />
            </button>
          </div>
        </div>

        <div className="pp-body">
          {/* Area in sq ft and sq m */}
          <div className="pp-sec pp-area">
            <div>
              <div className="pp-k">Area · sq ft</div>
              <div className="pp-area-v">{sqft.toLocaleString('en-IN')}<span>sq ft</span></div>
            </div>
            <div>
              <div className="pp-k">Area · sq m</div>
              <div className="pp-area-v">{sqm.toLocaleString('en-IN')}<span>m²</span></div>
            </div>
          </div>

          {/* Facing and Front road width */}
          <dl className="pp-sec pp-specs">
            <div className="pp-spec">
              <dt>Facing</dt>
              <dd>
                {facing
                  ? (<><Compass deg={bearingOf(facing)} />{facing}</>)
                  : <span className="pp-na">Not specified</span>}
              </dd>
            </div>
            <div className="pp-spec">
              <dt>Front road width</dt>
              <dd>
                {road
                  ? (<><RoadIcon />{road}</>)
                  : <span className="pp-na">Not specified</span>}
              </dd>
            </div>
          </dl>

          {/* Calculator: Area x Plot Rate */}
          <div className="pp-sec pp-calc">
            <div className="pp-calc-top">
              <div className="pp-k">Price calculator</div>
              <div className="pp-calc-sub">Area × Plot rate</div>
            </div>

            <div className="pp-ctrl">
              <div className="pp-input">
                <b>₹</b>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={`Plot rate per ${unitLabel}`}
                  placeholder={`Rate per ${unitLabel}`}
                  value={rate}
                  onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
                />
              </div>
              <div className="pp-seg" role="group" aria-label="Rate unit">
                <button type="button" aria-pressed={unit === 'sqft'} onClick={() => setUnit('sqft')}>sq ft</button>
                <button type="button" aria-pressed={unit === 'sqm'} onClick={() => setUnit('sqm')}>sq m</button>
              </div>
            </div>

            <dl className="pp-sum">
              <div className="pp-sum-row">
                <dt>Area</dt>
                <dd>{areaForCalcLabel} {unitLabel}</dd>
              </div>
              <div className="pp-sum-row">
                <dt>Plot rate</dt>
                <dd>{hasRate ? `${inr(rateNum)} / ${unitLabel}` : '—'}</dd>
              </div>
            </dl>

            <div className="pp-total" aria-live="polite">
              <div className="pp-total-k">Total amount</div>
              {hasRate
                ? (<>
                    <div className="pp-total-v">{inr(total)}</div>
                    {words && <div className="pp-total-w">{words}</div>}
                  </>)
                : <div className="pp-total-v is-empty">Enter a plot rate to calculate</div>}
            </div>
          </div>

          {/* 7/12 extract: view and download */}
          {/* <div className="pp-sec">
            <div className="pp-k">Land record</div>
            <div className="pp-docs-acts">
              {docUrl ? (
                <a className="pp-doc" href={docUrl} target="_blank" rel="noopener noreferrer">
                  <DocIcon />
                  View 7/12
                </a>
              ) : (
                <span className="pp-doc" aria-disabled="true"><DocIcon />View 7/12</span>
              )}
              <button type="button" className="pp-doc pp-doc--ghost" onClick={downloadDoc}
                disabled={!docUrl || dl}>
                <DownIcon />
                {dl ? 'Preparing…' : 'Download'}
              </button>
            </div>
            {!docUrl && <div className="pp-docs-note">7/12 extract not uploaded for this plot.</div>}
          </div> */}
        </div>
      </div>
    </>
  );
}