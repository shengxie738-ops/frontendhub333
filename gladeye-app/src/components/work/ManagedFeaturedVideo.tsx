'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { resolveFeaturedVideoSource } from './featured-video-source';

/** Reuse the exact five-identity resolver; never manage arbitrary local/remote media. */
export function isManagedFeaturedVideo(slug: string, layer: { source: string; vimeoId: string | null }): boolean {
  if (!layer.source.startsWith('/') || !layer.vimeoId) return false;
  const identity = `https://player.vimeo.com/progressive_redirect/playback/${layer.vimeoId}/rendition/1080p/file.mp4`;
  return resolveFeaturedVideoSource(slug, identity) === layer.source;
}

/** These resource bounds are implementation policy, not measured source IO options. */
const PREPARE_MARGIN = 200;
const VISIBLE_RATIO = 0.01;

export function useFeaturedMediaEnvironment(frame: RefObject<HTMLElement>, enabled: boolean) {
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (!enabled) return;
    const node = frame.current;
    if (!node) return;
    let alive = true;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => { if (alive) setReducedMotion(motion.matches); };
    const onVisibility = () => { if (alive) setPageVisible(document.visibilityState !== 'hidden'); };
    onMotion();
    onVisibility();
    motion.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);

    let disconnect: () => void;
    if (typeof IntersectionObserver !== 'undefined') {
      const nearby = new IntersectionObserver((entries) => {
        const entry = entries.filter(item => item.target === node).pop();
        if (alive && entry) setNear(entry.isIntersecting);
      }, { rootMargin: `${PREPARE_MARGIN}px 0px`, threshold: 0 });
      const viewport = new IntersectionObserver((entries) => {
        const entry = entries.filter(item => item.target === node).pop();
        if (alive && entry) setVisible(entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO);
      }, { rootMargin: '0px', threshold: VISIBLE_RATIO });
      nearby.observe(node);
      viewport.observe(node);
      disconnect = () => { nearby.disconnect(); viewport.disconnect(); };
    } else {
      // Bounded geometry fallback for environments without IntersectionObserver.
      const measure = () => {
        if (!alive) return;
        const rect = node.getBoundingClientRect();
        const horizontal = rect.right > 0 && rect.left < window.innerWidth;
        setNear(horizontal && rect.bottom > -PREPARE_MARGIN && rect.top < window.innerHeight + PREPARE_MARGIN);
        const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
        const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        setVisible(width * height / Math.max(1, rect.width * rect.height) >= VISIBLE_RATIO);
      };
      measure();
      window.addEventListener('scroll', measure, { passive: true });
      window.addEventListener('resize', measure);
      disconnect = () => { window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
    }
    return () => {
      alive = false;
      disconnect();
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, frame]);

  return { near, visible, pageVisible, reducedMotion };
}

/** Persistent decorative VIDEO: readiness and playback permission are independent. */
export function ManagedFeaturedVideo({
  source, prepare, active, visible, pageVisible, reducedMotion, onReady, onFailure,
}: {
  source: string;
  prepare: boolean;
  active: boolean;
  visible: boolean;
  pageVisible: boolean;
  reducedMotion: boolean;
  onReady: () => void;
  onFailure: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const loaded = useRef(false);
  const readyReported = useRef(false);
  const failedRef = useRef(false);
  const generation = useRef(0);
  const permitted = useRef(false);
  const callbacks = useRef({ onReady, onFailure });
  callbacks.current = { onReady, onFailure };

  const fail = useCallback(() => {
    if (failedRef.current) return;
    failedRef.current = true;
    permitted.current = false;
    generation.current++;
    videoRef.current?.pause();
    setFailed(true);
    callbacks.current.onFailure();
  }, []);

  const checkReady = useCallback(() => {
    const video = videoRef.current;
    if (!loaded.current || failedRef.current || !video?.isConnected || video.readyState < 3 || readyReported.current) return;
    readyReported.current = true;
    setReady(true);
    callbacks.current.onReady();
  }, []);

  useEffect(() => {
    if (prepare && !failed) setPrepared(true);
  }, [prepare, failed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!prepared || !video?.isConnected || loaded.current || failedRef.current) return;
    loaded.current = true;
    // Set the DOM property before loading or playing, including audio-bearing MP4s.
    video.muted = true;
    try {
      video.load();
      checkReady(); // Cached media can be ready before a canplay listener fires.
    } catch {
      fail();
    }
  }, [prepared, checkReady, fail]);

  useEffect(() => {
    const video = videoRef.current;
    const token = ++generation.current;
    permitted.current = Boolean(prepared && ready && !failed && active && visible && pageVisible && !reducedMotion && video?.isConnected);
    if (!video) return;
    video.muted = true;
    if (!permitted.current) {
      video.pause();
    } else {
      try {
        const playing = video.play();
        Promise.resolve(playing).then(() => {
          // An old completion must not restart a now-hidden/unmounted player,
          // or pause a newer activation that currently has playback permission.
          if (!permitted.current || !video.isConnected) video.pause();
        }, () => {
          if (token === generation.current && permitted.current && video.isConnected) fail();
        });
      } catch {
        fail();
      }
    }
    return () => {
      permitted.current = false;
      video.pause(); // Deliberately preserve currentTime and the mounted source.
    };
  }, [prepared, ready, failed, active, visible, pageVisible, reducedMotion, fail]);

  return (
    <video
      ref={videoRef}
      className="h-full w-full object-cover"
      src={prepared ? source : undefined}
      muted
      loop
      playsInline
      preload={prepared ? 'auto' : 'none'}
      onCanPlay={checkReady}
      onError={fail}
      aria-hidden
    />
  );
}
