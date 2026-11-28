import React, { useEffect, useRef, useState } from 'react';
import { ACCENT, CANVAS, HAIR, MONO } from '../../theme/tokens';

/* ── THE TWO PDFs ────────────────────────────────────────────────────
   Both live in src/assets. If a file is named differently, change the
   import path below and nothing else.

   View opens the PDF in a new tab (the browser's own viewer);
   Download saves it under the name given in `file`. */
import naOrderPdf from '../../assets/na-order.pdf';
import commonDocsPdf from '../../assets/order-common-documents.pdf';

const DOCS = [
  {
    key: 'na', label: 'NA Order', sub: 'Non-agricultural order',
    url: naOrderPdf, file: 'NA-Order.pdf',
  },
  {
    key: 'common', label: 'Common Documents', sub: 'Order documents',
    url: commonDocsPdf, file: 'Order-Common-Documents.pdf',
  },
];

const INK = '#E7E1D5';

/* Below this the panel becomes a round button that opens a popover —
   the same 44 px control the compass is, so the right edge of a phone
   stays tidy. */
const PHONE_QUERY = '(max-width: 599px)';

/* ── responsive: follows the real viewport, not just the first render ─ */
function usePhone() {
  const get = () => (typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(PHONE_QUERY).matches
    : false);
  const [phone, setPhone] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    on();
    if (mq.addEventListener) mq.addEventListener('change', on);
    else mq.addListener(on);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', on);
      else mq.removeListener(on);
    };
  }, []);
  return phone;
}

/* hover / focus / press states, which inline styles cannot express */
const CSS = `
.dcb-act{transition:background .15s,border-color .15s,transform .1s,opacity .15s}
.dcb-act:hover{opacity:.92;border-color:${ACCENT}}
.dcb-act:active{transform:scale(.94)}
.dcb-act:focus-visible,.dcb-head:focus-visible,.dcb-fab:focus-visible{outline:2px solid ${ACCENT};outline-offset:2px}
.dcb-row{transition:background .15s}
.dcb-row:hover{background:rgba(255,255,255,.06)}
@keyframes dcb-in{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
.dcb-panel{animation:dcb-in .16s ease-out}
@media (prefers-reduced-motion:reduce){
  .dcb-panel{animation:none}
  .dcb-act,.dcb-row{transition:none}
}`;

/* ── icons: plain SVG, no dependency ─────────────────────────────── */
const svgProps = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round',
  style: { display: 'block', flex: 'none' },
};

const IconFile = () => (
  <svg {...svgProps} width="22" height="22">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);
const IconFolder = () => (
  <svg {...svgProps} width="22" height="22">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
const IconEye = () => (
  <svg {...svgProps}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconDownload = () => (
  <svg {...svgProps}>
    <path d="M12 4v11" />
    <path d="M7.5 11 12 15.5 16.5 11" />
    <path d="M5 19h14" />
  </svg>
);
const IconClose = () => (
  <svg {...svgProps} width="16" height="16">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const IconChevron = ({ up }) => (
  <svg
    {...svgProps}
    width="14"
    height="14"
    style={{ ...svgProps.style, transform: up ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* 44 px on a phone (the least a finger lands on reliably), 38 px with
   a mouse */
const action = (primary, size) => ({
  width: size, height: size,
  display: 'grid', placeItems: 'center',
  borderRadius: 10,
  textDecoration: 'none',
  cursor: 'pointer',
  color: primary ? CANVAS : INK,
  background: primary ? ACCENT : 'transparent',
  border: `1px solid ${primary ? ACCENT : HAIR}`,
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
});

function Row({ d, size }) {
  return (
    <div
      className="dcb-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 8px 8px 10px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${HAIR}`,
      }}
    >
      <span style={{ color: ACCENT, display: 'grid', placeItems: 'center' }}>
        <IconFile />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block', font: `600 12px/1.25 ${MONO}`, color: INK,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {d.label}
        </span>
        <span
          style={{
            display: 'block', marginTop: 3, font: `500 10px/1.25 ${MONO}`,
            color: INK, opacity: 0.55,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          PDF · {d.sub}
        </span>
      </span>

      <a
        className="dcb-act"
        href={d.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`View ${d.label}`}
        aria-label={`View ${d.label}`}
        style={action(true, size)}
      >
        <IconEye />
      </a>
      <a
        className="dcb-act"
        href={d.url}
        download={d.file}
        title={`Download ${d.label}`}
        aria-label={`Download ${d.label}`}
        style={action(false, size)}
      >
        <IconDownload />
      </a>
    </div>
  );
}

/**
 * Documents on the right edge, under the compass.
 *
 *   Desktop / tablet  a card with a collapsible header, open by default.
 *   Phone             a round 44 px button (like the compass) that opens
 *                     the same card as a popover; closes on a tap
 *                     outside, on Escape, or on its own × button.
 *
 * `top` and `right` come from the parent so it clears the compass and
 * the device's safe areas. The card is capped to the screen height and
 * scrolls, so a landscape phone never pushes it off the bottom.
 * Pointer events are stopped so a tap here never starts a camera drag
 * or an orbit.
 */
export default function DocButtons({ top = 0, right = 12 }) {
  const phone = usePhone();
  const [open, setOpen] = useState(!phone);
  const wrapRef = useRef(null);

  /* open on a big screen, shut on a phone — and re-decided if the
     window crosses the line (rotation, a resized window) */
  useEffect(() => { setOpen(!phone); }, [phone]);

  /* phone popover: outside tap and Escape close it */
  useEffect(() => {
    if (!phone || !open) return undefined;
    const away = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [phone, open]);

  const size = phone ? 44 : 38;

  const panel = (
    <div
      className="dcb-panel"
      role={phone ? 'dialog' : 'region'}
      aria-label="Documents"
      style={{
        width: phone ? 'min(320px, calc(100vw - 24px))' : 'clamp(240px, 22vw, 290px)',
        background: CANVAS,
        border: `1px solid ${HAIR}`,
        borderRadius: 16,
        boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        className="dcb-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 12px', cursor: 'pointer',
          background: 'transparent', border: 'none', color: INK,
          font: `700 11px/1 ${MONO}`, letterSpacing: 1, textTransform: 'uppercase',
          WebkitTapHighlightColor: 'transparent',
          WebkitAppearance: 'none', appearance: 'none',
        }}
      >
        <span style={{ color: ACCENT, display: 'grid' }}><IconFolder /></span>
        <span style={{ flex: 1, textAlign: 'left' }}>Documents</span>
        <span style={{ opacity: 0.6, fontWeight: 500 }}>{DOCS.length}</span>
        {phone ? <IconClose /> : <IconChevron up={open} />}
      </button>

      {open && (
        <div
          style={{
            display: 'grid', gap: 8, padding: '0 10px 10px',
            /* never taller than the screen under it; scrolls if it must */
            maxHeight: `calc(100vh - ${top}px - 90px)`,
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          }}
        >
          {DOCS.map((d) => <Row key={d.key} d={d} size={size} />)}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={wrapRef}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', zIndex: 6, top, right,
        display: 'grid', justifyItems: 'end', gap: 8,
      }}
    >
      <style>{CSS}</style>

      {phone && !open && (
        <button
          type="button"
          className="dcb-fab"
          onClick={() => setOpen(true)}
          title="Documents"
          aria-label="Open documents"
          aria-expanded="false"
          style={{
            position: 'relative',
            width: 44, height: 44, padding: 0,
            display: 'grid', placeItems: 'center',
            background: CANVAS, color: ACCENT,
            border: `1px solid ${HAIR}`, borderRadius: 22,
            cursor: 'pointer', touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            WebkitAppearance: 'none', appearance: 'none',
          }}
        >
          <IconFolder />
          <span
            style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 18, height: 18, padding: '0 4px', boxSizing: 'border-box',
              display: 'grid', placeItems: 'center',
              borderRadius: 9, background: ACCENT, color: CANVAS,
              font: `700 10px/1 ${MONO}`,
            }}
          >
            {DOCS.length}
          </span>
        </button>
      )}

      {(!phone || open) && panel}
    </div>
  );
}