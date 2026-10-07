'use client';

/**
 * Mounts the cloned Three.js valley and keeps React informed about it.
 *
 * Everything browser-only happens inside `useEffect`, so the component tree is
 * SSR-safe; the experience is destroyed on unmount (its own `destroy()` releases
 * the composer, render targets, geometries, materials, textures, the Lenis
 * instance, the rAF loop and every window listener).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { usePathname } from 'next/navigation';

import { HERO_TEXT } from '@/experience/data/scene-settings';
import {
  emptyDiagnostics,
  installQaBridge,
  registerExperience,
  registerPosterFallback,
} from '@/experience/qa-bridge';
import { HomeExperience, probeWebgl, type LoadStatus } from '@/experience/ValleyScene';
import type { DegradeReason, Diagnostics, QualityTier } from '@/experience/types';

export type ValleyPhase = 'booting' | 'live' | 'poster';

export interface UseFlowerValleyOptions {
  quality?: QualityTier;
  enableDormantLayers?: boolean;
  /** number of `hero_messages_bloks` — drives the message cycling formula */
  messageCount?: number;
  /** force the static poster (used by the degraded-path tests) */
  disabled?: boolean;
}

export interface UseFlowerValleyResult {
  containerRef: RefObject<HTMLDivElement>;
  phase: ValleyPhase;
  status: LoadStatus;
  progress: { loaded: number; total: number };
  percent: number;
  introDone: boolean;
  activeMessage: number;
  degradeReasons: DegradeReason[];
  diagnostics: Diagnostics;
  startHoverTransition: () => void;
  stopHoverTransition: () => void;
  startExitTransition: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildPosterDiagnostics(reasons: DegradeReason[]): Diagnostics {
  const support = probeWebgl();
  return {
    ...emptyDiagnostics(),
    mode: 'poster',
    degradeReasons: reasons,
    webgl2: support.webgl2,
    renderer: support.rendererName,
    dpr: typeof window === 'undefined' ? 0 : Math.min(2, window.devicePixelRatio),
    quality: 'high',
  };
}

export function useFlowerValley(options: UseFlowerValleyOptions = {}): UseFlowerValleyResult {
  const {
    quality,
    enableDormantLayers,
    messageCount = 1,
    disabled = false,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const experienceRef = useRef<HomeExperience | null>(null);
  const pathname = usePathname();

  const [phase, setPhase] = useState<ValleyPhase>('booting');
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [introDone, setIntroDone] = useState(false);
  const [activeMessage, setActiveMessage] = useState(0);
  const [degradeReasons, setDegradeReasons] = useState<DegradeReason[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>(() => emptyDiagnostics());

  /* ----------------------------- mount / unmount ----------------------------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const uninstallBridge = installQaBridge();

    const support = probeWebgl();
    const reasons: DegradeReason[] = [];
    if (!support.supported) reasons.push('webgl-unavailable');
    if (prefersReducedMotion()) reasons.push('prefers-reduced-motion');
    if (disabled) reasons.push('prefers-reduced-motion');

    if (reasons.length > 0) {
      const poster = buildPosterDiagnostics(reasons);
      setDegradeReasons(reasons);
      setDiagnostics(poster);
      registerPosterFallback(poster);
      setPhase('poster');
      setStatus('failed');
      setIntroDone(true);
      return () => {
        registerPosterFallback(null);
        uninstallBridge();
      };
    }

    let experience: HomeExperience;
    try {
      experience = new HomeExperience({
        container,
        quality,
        enableDormantLayers,
        onProgress: (loaded, total) => setProgress({ loaded, total }),
        onIntroDone: () => setIntroDone(true),
        onScrollProgress: (pct) => {
          // original: `Math.floor(messages.length * (2 * progress % 1))`
          const index = Math.floor(messageCount * ((HERO_TEXT.messageCycleFactor * pct) % 1));
          setActiveMessage(Math.max(0, Math.min(messageCount - 1, index)));
        },
      });
    } catch {
      const poster = buildPosterDiagnostics(['webgl-unavailable']);
      setDegradeReasons(['webgl-unavailable']);
      setDiagnostics(poster);
      registerPosterFallback(poster);
      setPhase('poster');
      setStatus('failed');
      return () => {
        registerPosterFallback(null);
        uninstallBridge();
      };
    }

    experienceRef.current = experience;
    registerExperience(experience);

    // status mirror — the scene resolves its assets asynchronously
    const poll = window.setInterval(() => {
      const next = experience.getDiagnostics();
      setDiagnostics(next);
      setStatus(experience.status);
      if (experience.status === 'ready') {
        setPhase('live');
      } else if (experience.status === 'failed') {
        setPhase('poster');
        const reasons2: DegradeReason[] =
          next.degradeReasons.length > 0 ? [...next.degradeReasons] : ['asset-load-failed'];
        setDegradeReasons(reasons2);
        registerPosterFallback(next);
        setIntroDone(true);
      }
    }, 150);

    return () => {
      window.clearInterval(poll);
      registerExperience(null);
      registerPosterFallback(null);
      experience.destroy();
      experienceRef.current = null;
      uninstallBridge();
    };
  }, [quality, enableDormantLayers, messageCount, disabled]);

  /* -------------------------- route-exit transition -------------------------- */
  useEffect(() => {
    const experience = experienceRef.current;
    if (!experience) return;
    if (pathname !== '/') experience.startExitTransition();
  }, [pathname]);

  const startHoverTransition = useCallback(() => {
    experienceRef.current?.startHoverTransition();
  }, []);

  const stopHoverTransition = useCallback(() => {
    experienceRef.current?.stopHoverTransition();
  }, []);

  const startExitTransition = useCallback(() => {
    experienceRef.current?.startExitTransition();
  }, []);

  const percent =
    progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;

  return {
    containerRef,
    phase,
    status,
    progress,
    percent,
    introDone,
    activeMessage,
    degradeReasons,
    diagnostics,
    startHoverTransition,
    stopHoverTransition,
    startExitTransition,
  };
}
