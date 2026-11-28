
import React from 'react';
import { centroid, buildRuns, offsetRun, midOfPolyline } from '../../lib/geometry';
import { MAPFONT, SELECTED_INK } from '../../theme/tokens';
import { SQFT } from '../../lib/units';

/**
 * The figures that appear around the raised plot: one dimension per
 * straight side, and the plot's number and area in the middle.
 *
 * CORNER-CURVED PLOTS: the curve (fillet) is drawn by the plot shape
 * only. It gets NO dimension of its own, and each straight side is
 * measured as if the corner were square, i.e. out to the point where
 * the two straight sides would meet. So a curved plot reads like a
 * plain rectangle, with the curve shown inside it.
 */

const SCALE = 1.35;
const CENTRE_SCALE = 1.15;

/* A run is a curve when it has several segments and its direction
   turns by more than this between the first and last segment. */
const CURVE_MIN_TURN_DEG = 8;

const isCurveRun = (run) => {
  if (run.segs.length < 2) return false;
  const f = run.segs[0];
  const l = run.segs[run.segs.length - 1];
  const a = Math.atan2(f.p2[1] - f.p1[1], f.p2[0] - f.p1[0]);
  const b = Math.atan2(l.p2[1] - l.p1[1], l.p2[0] - l.p1[0]);
  let d = (Math.abs(a - b) * 180) / Math.PI;
  if (d > 180) d = 360 - d;
  return d > CURVE_MIN_TURN_DEG;
};

// infinite lines through (p1,p2) of two straight runs → their meeting point
function meet(r1, r2) {
  const a1 = r1.segs[0].p1;
  const a2 = r1.segs[r1.segs.length - 1].p2;
  const b1 = r2.segs[0].p1;
  const b2 = r2.segs[r2.segs.length - 1].p2;
  const d1 = [a2[0] - a1[0], a2[1] - a1[1]];
  const d2 = [b2[0] - b1[0], b2[1] - b1[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-9) return null;   // parallel
  const t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / den;
  return [a1[0] + t * d1[0], a1[1] + t * d1[1]];
}

/* Straight runs only, each stretched to the virtual square corners. */
const MIN_SIDE = 0.35;        // m: shorter straight bits are slivers, not sides
const COLLINEAR_DEG = 12;     // runs this close in direction are one side

const chord = (r) => {
  const f = r.segs[0].p1;
  const l = r.segs[r.segs.length - 1].p2;
  return { dx: l[0] - f[0], dy: l[1] - f[1], len: Math.hypot(l[0] - f[0], l[1] - f[1]) };
};
const turnBetween = (r1, r2) => {
  const a = chord(r1), b = chord(r2);
  let d = (Math.abs(Math.atan2(a.dy, a.dx) - Math.atan2(b.dy, b.dx)) * 180) / Math.PI;
  if (d > 180) d = 360 - d;
  return d;
};
const joinRuns = (r1, r2) => ({ ...r1, segs: [...r1.segs, ...r2.segs] });

/* Straight runs only: curves and slivers dropped, collinear pieces
   joined into one side (so 1.51 m + 14.56 m becomes one top side). */
function cleanStraight(runs) {
  const out = [];
  let sep = false;          // a curve has been seen since the last kept side
  let leadingSep = false;
  runs.forEach((r) => {
    if (isCurveRun(r)) { sep = true; return; }
    if (chord(r).len < MIN_SIDE) return;
    const prev = out[out.length - 1];
    if (prev && !sep && turnBetween(prev, r) < COLLINEAR_DEG) {
      out[out.length - 1] = joinRuns(prev, r);
    } else {
      if (!out.length) leadingSep = sep;
      out.push(r);
    }
    sep = false;
  });
  // the ring closes: last and first may be one side too
  if (out.length > 2 && !sep && !leadingSep && turnBetween(out[out.length - 1], out[0]) < COLLINEAR_DEG) {
    out[0] = joinRuns(out.pop(), out[0]);
  }

  // pieces lying on the SAME line (even with a curve or sliver between
  // them) are one side: the top edge and its stub beside the curve
  const sameLine = (r1, r2) => {
    if (turnBetween(r1, r2) >= COLLINEAR_DEG) return false;
    const a = r1.segs[0].p1;
    const { dx, dy, len } = chord(r1);
    const p = r2.segs[0].p1;
    const dist = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / (len || 1);
    return dist < 0.4;
  };
  for (let i = 0; i < out.length && out.length > 2; ) {
    const j = (i + 1) % out.length;
    if (j !== i && sameLine(out[i], out[j])) {
      // keep the pieces in walking order, ending at the later one
      out[i] = j === 0 ? joinRuns(out[i], out[0]) : joinRuns(out[i], out[j]);
      out.splice(j, 1);
    } else {
      i++;
    }
  }
  return out;
}

function squareSides(runs) {
  const straight = cleanStraight(runs);
  const n = straight.length;
  if (n < 2) return straight;

  return straight
    .map((run, i) => {
    const prev = straight[(i - 1 + n) % n];
    const next = straight[(i + 1) % n];
    const first = run.segs[0].p1;
    const last = run.segs[run.segs.length - 1].p2;
    const len0 = Math.hypot(last[0] - first[0], last[1] - first[1]);
    const maxReach = len0 * 3 + 5;   // ignore wild intersections

    const pick = (other, fallback) => {
      const m = meet(run, other);
      if (!m) return fallback;
      return Math.hypot(m[0] - fallback[0], m[1] - fallback[1]) <= maxReach ? m : fallback;
    };

    const p1 = pick(prev, first);
    const p2 = pick(next, last);
    return {
      ...run,
      segs: [{ ...run.segs[0], p1, p2 }],
      len: Math.hypot(p2[0] - p1[0], p2[1] - p1[1]),
    };
    })
    .filter((r) => r.len >= MIN_SIDE);   // never print a 0.00 m side
}

export default function DimensionOverlay({ plot }) {
  const c = centroid(plot.pts);
  const ir = plot.ir || 3;

  const off = (0.50 + ir * 0.02) * SCALE;
  const txt = 0.60 * SCALE;
  const tick = txt * 0.8;
  const hair = 0.045 * SCALE;

  const num = Math.min(ir * 0.27, 3.4) * CENTRE_SCALE;
  const sqm = num * 0.35;
  const sqftSize = num * 0.55;

  const runs = squareSides(buildRuns(plot.pts, plot.sides, c));

  return (
    <g style={{ pointerEvents: 'none' }}>
      {runs.map((run, ri) => {
        const poly = offsetRun(run, off);
        const first = run.segs[0];
        const last = run.segs[run.segs.length - 1];
        const a = poly[0];
        const b = poly[poly.length - 1];
        const { p: mid, tan } = midOfPolyline(poly);

        const t0 = [poly[1][0] - poly[0][0], poly[1][1] - poly[0][1]];
        const t1 = [b[0] - poly[poly.length - 2][0], b[1] - poly[poly.length - 2][1]];
        const perp = (t) => {
          const L = Math.hypot(t[0], t[1]) || 1;
          return [(-t[1] / L) * tick, (t[0] / L) * tick];
        };
        const k0 = perp(t0);
        const k1 = perp(t1);

        let deg = (Math.atan2(tan[1], tan[0]) * 180) / Math.PI;
        if (deg > 90) deg -= 180;
        if (deg < -90) deg += 180;

        const mn = [-tan[1], tan[0]];
        const away = (mn[0] * (mid[0] - c[0]) + mn[1] * (mid[1] - c[1])) > 0 ? 1 : -1;
        const lx = mid[0] + mn[0] * away * txt * 0.85;
        const ly = mid[1] + mn[1] * away * txt * 0.85;

        const d = `M${poly.map((p) => `${p[0]} ${p[1]}`).join('L')}`;

        return (
          <g key={`run${ri}`}>
            <line
              x1={first.p1[0]} y1={first.p1[1]} x2={a[0]} y2={a[1]}
              stroke="#FFFFFF" strokeWidth={hair}
              strokeDasharray={`${hair * 4} ${hair * 3}`} opacity="0.7"
            />
            <line
              x1={last.p2[0]} y1={last.p2[1]} x2={b[0]} y2={b[1]}
              stroke="#FFFFFF" strokeWidth={hair}
              strokeDasharray={`${hair * 4} ${hair * 3}`} opacity="0.7"
            />
            <path
              d={d} fill="none" stroke="#FFFFFF" strokeWidth={hair}
              strokeDasharray={`${hair * 5} ${hair * 3}`} opacity="0.9"
              strokeLinejoin="round" strokeLinecap="round"
            />
            <line
              x1={a[0] - k0[0]} y1={a[1] - k0[1]} x2={a[0] + k0[0]} y2={a[1] + k0[1]}
              stroke="#FFFFFF" strokeWidth={hair * 1.4}
            />
            <line
              x1={b[0] - k1[0]} y1={b[1] - k1[1]} x2={b[0] + k1[0]} y2={b[1] + k1[1]}
              stroke="#FFFFFF" strokeWidth={hair * 1.4}
            />
            <text
              x={lx} y={ly} transform={`rotate(${deg} ${lx} ${ly})`}
              textAnchor="middle" dy="0.35em"
              fontFamily={MAPFONT} fontSize={txt} fontWeight="600" fill="#FFFFFF"
              stroke="#1A1614" strokeWidth={txt * 0.14} strokeOpacity="0.55"
              paintOrder="stroke"
            >
              {run.len.toFixed(2)} m
            </text>
          </g>
        );
      })}

      <text
        x={c[0]} y={c[1] - num * 0.60} textAnchor="middle" dy="0.35em"
        fontFamily={MAPFONT} fontSize={num} fontWeight="600"
        letterSpacing={-num * 0.02} fill={SELECTED_INK}
      >
        {plot.name}
      </text>
      <text
        x={c[0]} y={c[1] + num * 0.52} textAnchor="middle" dy="0.35em"
        fontFamily={MAPFONT} fontSize={sqm} fontWeight="500" fill={SELECTED_INK} opacity="0.85"
      >
        {plot.area.toFixed(2)} m²
      </text>
      <text
        x={c[0]} y={c[1] + num * 1.12} textAnchor="middle" dy="0.35em"
        fontFamily={MAPFONT} fontSize={sqftSize} fontWeight="600" fill={SELECTED_INK}
      >
        {(plot.area * SQFT).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ft²
      </text>
    </g>
  );
}