"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export const SCENIC_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_123836_11a3c5e0-713f-4bef-a8e9-7dd93bdea3b0.mp4";
export const SCENIC_POSTER_URL =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/693205bf-8048-456a-879e-4e0a1b85a098.webp";

type BackdropMode = "video" | "poster";

export function getBackdropMode(pathname: string | null): BackdropMode {
  return pathname === "/" || pathname === "/login" || pathname === "/setup" ? "video" : "poster";
}

export function shouldRenderVideo(mode: BackdropMode, prefersReducedMotion: boolean, videoFailed: boolean): boolean {
  return mode === "video" && !prefersReducedMotion && !videoFailed;
}

export default function ScenicBackdrop() {
  const pathname = usePathname();
  const mode = getBackdropMode(pathname);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener?.("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener?.("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    setVideoFailed(false);
  }, [mode]);

  const renderVideo = shouldRenderVideo(mode, prefersReducedMotion, videoFailed);

  return (
    <div className="scenic-backdrop" aria-hidden="true">
      <div className="scenic-backdrop__poster" style={{ backgroundImage: `url("${SCENIC_POSTER_URL}")` }} />
      {renderVideo && (
        <video
          className="scenic-backdrop__video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={SCENIC_POSTER_URL}
          onError={() => setVideoFailed(true)}
        >
          <source src={SCENIC_VIDEO_URL} type="video/mp4" />
        </video>
      )}
      <div className="scenic-backdrop__scrim" />
    </div>
  );
}
