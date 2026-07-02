"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RecentTrack } from "@/lib/queries";
import { artistHref, trackHref } from "@/lib/utils";

const ADVANCE_MS = 7000;
/** How long a manual poke holds off the auto-advance. */
const HANDS_OFF_MS = 12000;

/** Intrinsic size of /cover-wall.jpg — every overlay is placed in % of this
 * frame, so they stay glued to the painted deck at any viewport size. */
const IMG_W = 1361;
const IMG_H = 768;

/**
 * The cover: the mural photograph fills the screen, and the app projects
 * itself onto the paint. The deck's LCD is masked with a live readout of the
 * most recent plays, and the painted << / PLAY / >> buttons get invisible
 * hit-areas — play is the way in.
 *
 * The stage keeps the image's exact aspect ratio and cover-fits the viewport,
 * so overlays positioned in stage-% always land on the same pixels of the
 * mural. Overlay type is sized in cqw against the stage for the same reason.
 */
export function MuralDeck({ tracks }: { tracks: RecentTrack[] }) {
  const [i, setI] = useState(0);
  const [handsOffUntil, setHandsOffUntil] = useState(0);

  const len = tracks.length;
  const t = len ? tracks[i] : undefined;

  useEffect(() => {
    if (len < 2) return;
    const id = setInterval(() => {
      if (Date.now() >= handsOffUntil) setI((v) => (v + 1) % len);
    }, ADVANCE_MS);
    return () => clearInterval(id);
  }, [len, handsOffUntil]);

  function bump(delta: number) {
    if (!len) return;
    setI((v) => (v + delta + len) % len);
    setHandsOffUntil(Date.now() + HANDS_OFF_MS);
  }

  return (
    <div className="cv-scene">
      <style>{css}</style>

      {/* blurred fill for viewports the stage crop can't cover (tall phones) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cv-backdrop" src="/cover-wall.jpg" alt="" aria-hidden />

      <div className="cv-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="cv-img"
          src="/cover-wall.jpg"
          alt="Graffiti mural of a cassette deck on a green and black wall, tagged solo stereo"
          fetchPriority="high"
        />

        {/* live readout masking the painted LCD text */}
        <div className="cv-lcd" onWheel={(e) => bump(e.deltaY > 0 ? 1 : -1)}>
          <div className="cv-lcd-lines" key={i}>
            <span className="cv-line cv-line-head">
              {">>>"} now playing {">>>"}
            </span>
            {t ? (
              <>
                <span className="cv-line">
                  artist:{" "}
                  <Link className="cv-link" href={artistHref(t.artistName)}>
                    {t.artistName}
                  </Link>
                </span>
                <span className="cv-line">album: {t.albumName ?? "—"}</span>
                <span className="cv-line">
                  track:{" "}
                  <Link
                    className="cv-link"
                    href={trackHref(t.artistName, t.trackName)}
                  >
                    {t.trackName}
                  </Link>
                </span>
              </>
            ) : (
              <>
                <span className="cv-line">no tape loaded</span>
                <span className="cv-line">import your history</span>
                <span className="cv-line">to begin</span>
              </>
            )}
          </div>
        </div>

        {/* hit-areas over the painted transport — play is the way in */}
        <button
          type="button"
          className="cv-btn cv-prev"
          aria-label="previous track"
          onClick={() => bump(-1)}
        />
        <Link className="cv-btn cv-play" href="/overview" aria-label="play — enter the archive" />
        <button
          type="button"
          className="cv-btn cv-next"
          aria-label="next track"
          onClick={() => bump(1)}
        />
      </div>
    </div>
  );
}

const css = `
.cv-scene {
  /* break out of main's max-w-6xl to own the whole viewport */
  position: relative;
  left: 50%;
  margin-left: -50vw;
  width: 100vw;
  height: 100svh;
  overflow: hidden;
  background: #070a07;
}
.cv-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(28px) brightness(0.4);
  transform: scale(1.15);
}
.cv-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  aspect-ratio: ${IMG_W} / ${IMG_H};
  /* contain, don't cover: the whole piece stays visible and the blurred
   * wall backdrop fills whatever the viewport aspect leaves over */
  width: min(100vw, ${((100 * IMG_W) / IMG_H).toFixed(2)}svh);
  container-type: inline-size;
}
.cv-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ---- the LCD readout ------------------------------------------------------ */
.cv-lcd {
  position: absolute;
  left: 46.3%;
  top: 54.5%;
  width: 20.7%;
  height: 18.0%;
  display: flex;
  align-items: center;
  background: #030503;
  border-radius: 0.35cqw;
  box-shadow:
    0 0 1.2cqw #030503,
    inset 0 0 1.6cqw rgb(60 220 110 / 8%);
}
.cv-lcd::after {
  /* CRT scanlines so the mask reads as part of the painted screen */
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(
    0deg,
    rgb(0 0 0 / 35%) 0 1px,
    transparent 1px 3px
  );
  pointer-events: none;
}
.cv-lcd-lines {
  min-width: 0;
  width: 100%;
  padding: 0 0.6cqw;
  display: flex;
  flex-direction: column;
  gap: 0.15cqw;
  animation: cv-in 500ms ease;
}
@keyframes cv-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.cv-line {
  font-family: var(--font-lcd), monospace;
  font-size: 1.65cqw;
  line-height: 1.25;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #4be387;
  text-shadow: 0 0 0.6cqw rgb(75 227 135 / 70%);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cv-line-head {
  color: #6ff2a0;
  text-shadow: 0 0 0.8cqw rgb(111 242 160 / 85%);
}
.cv-link { color: inherit; text-decoration: none; }
.cv-link:hover { text-decoration: underline; text-underline-offset: 0.25em; }

/* ---- transport hit-areas --------------------------------------------------- */
.cv-btn {
  position: absolute;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 0.5cqw;
  transition: box-shadow 150ms ease;
}
.cv-btn:hover {
  box-shadow:
    0 0 2.2cqw rgb(90 255 140 / 45%),
    inset 0 0 1.2cqw rgb(90 255 140 / 25%);
}
.cv-btn:active { transform: translateY(0.15cqw); }
.cv-btn:focus-visible {
  outline: 2px solid #4be387;
  outline-offset: 3px;
}
.cv-prev { left: 37.3%; top: 85.5%; width: 4.4%; height: 5.9%; }
.cv-play { left: 43.6%; top: 85.2%; width: 10.8%; height: 6.4%; }
.cv-next { left: 56.4%; top: 85.5%; width: 4.6%; height: 5.9%; }

/* tall/narrow screens: fit the deck by width, blurred wall fills the rest */
@media (max-aspect-ratio: 4/5) {
  .cv-stage { width: 160vw; }
}
@media (prefers-reduced-motion: reduce) {
  .cv-lcd-lines { animation: none; }
}
`;
