"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RecentTrack } from "@/lib/queries";
import { startLiquidMotion } from "./liquid-motion";

/** The approved Liquid Mercury study, connected to the archive's recent plays. */
export function LiquidDeck({ initialTracks }: { initialTracks: RecentTrack[] }) {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const holdUntil = useRef(0);
  const [selection, setSelection] = useState({ tracks: initialTracks, index: 0 });
  const [paused, setPaused] = useState(false);
  const { tracks, index } = selection;
  const track = tracks[index];

  useEffect(() => startLiquidMotion(root.current!, setPaused), []);

  useEffect(() => {
    const element = label.current!;
    const stereo = element.closest<HTMLElement>(".stereo")!;
    function fit() {
      const base = stereo.getBoundingClientRect().width * .012;
      element.style.fontSize = base + "px";
      const available = element.parentElement!.clientWidth - 4;
      if (available > 0 && element.scrollWidth > available) {
        element.style.fontSize = base * available / element.scrollWidth + "px";
      }
    }
    const observer = new ResizeObserver(fit);
    observer.observe(stereo);
    fit();
    return () => observer.disconnect();
  }, [track]);

  useEffect(() => {
    if (paused || tracks.length < 2) return;
    const timer = setInterval(() => {
      if (document.hidden || Date.now() < holdUntil.current) return;
      setSelection(s => ({ ...s, index: (s.index + 1) % s.tracks.length }));
    }, 9000);
    return () => clearInterval(timer);
  }, [paused, tracks.length]);

  useEffect(() => {
    let disposed = false;
    let active: AbortController | undefined;
    async function refresh() {
      if (document.hidden || active) return;
      active = new AbortController();
      const timeout = setTimeout(() => active?.abort(), 15000);
      try {
        const res = await fetch("/api/recent-tracks", { cache: "no-store", signal: active.signal });
        if (!res.ok) throw new Error("Recent listening unavailable");
        const data = await res.json();
        if (!Array.isArray(data.tracks) || !data.tracks.every((t: RecentTrack) =>
          typeof t.trackName === "string" && typeof t.artistName === "string" &&
          typeof t.playedAt === "string")) throw new Error("Invalid recent listening");
        if (!disposed) setSelection(s => {
          if (JSON.stringify(s.tracks) === JSON.stringify(data.tracks)) return s;
          return { tracks: data.tracks, index: 0 };
        });
      } catch {
        // Keep the last successful readout during a deploy or network outage.
      } finally {
        clearTimeout(timeout);
        active = undefined;
      }
    }
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      active?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  function bump(step: number) {
    holdUntil.current = Date.now() + 12000;
    setSelection(s => s.tracks.length ? { ...s, index: (s.index + step + s.tracks.length) % s.tracks.length } : s);
  }

  return <div className="liquid-deck" ref={root}>
    <div className="room" aria-label="Solo Stereo. Press the stereo's play button to enter the archive.">
      <div className="stereo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hardware" src="/concepts/assets/living-tape-branded.png" width="1536" height="1024" alt="A black stereo with solo stereo engraved into its face and a green cassette inside" fetchPriority="high" />
        <div className="liquid-window" aria-hidden="true"><canvas id="fluid" /></div>
        <div className="paper-label" title={track ? "Recently played · " + new Date(track.playedAt).toUTCString() : "No recent listening"}>
          <span id="tape-label" ref={label}>{track ? track.trackName + " — " + track.artistName : "No recent listening"}</span>
        </div>
        <div className="meter-face" role="img" aria-label="Animated left and right stereo level meters; ambient motion, not live audio measurement">
          <div className="meter-layout" aria-hidden="true">
            <span className="meter-unit">dB</span>
            <div className="meter-scale">{["−30", "−20", "−10", "−5", "0", "+3"].map((v, i) => <span key={v} style={{left: [0, 30.3, 60.6, 75.8, 90.9, 100][i] + "%"}}>{v}</span>)}</div>
            <span className="meter-channel">L</span><div className="meter-track"><span className="meter-fill" id="meter-left" /><span className="meter-peak" id="peak-left" /></div>
            <span className="meter-channel">R</span><div className="meter-track"><span className="meter-fill" id="meter-right" /><span className="meter-peak" id="peak-right" /></div>
          </div>
        </div>
        <button className="transport previous" onClick={() => bump(-1)} aria-label="Previous recent track" />
        <Link className="transport play" href="/overview" aria-label="Play — enter the archive" />
        <button className="transport next" onClick={() => bump(1)} aria-label="Next recent track" />
        <button className="transport stop" id="stop" aria-label="Pause animation" />
      </div>
    </div>
  </div>;
}
