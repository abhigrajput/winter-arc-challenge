'use client';

import { useEffect, useState, type RefObject } from 'react';
import { scrollProgress } from '@/lib/landing/capability';

/**
 * Scroll progress through a tall section, 0..1, without framer-motion on the
 * critical path. One passive scroll listener, coalesced to one read per frame.
 * Consumers either poll get() (the WebGL loop) or subscribe (SVG / text).
 */

export interface ProgressSource {
  get(): number;
  subscribe(listener: (value: number) => void): () => void;
}

interface ProgressStore extends ProgressSource {
  set(value: number): void;
}

/** A tiny observable number. Lives outside React: it changes every scroll frame. */
function createProgressStore(): ProgressStore {
  let value = 0;
  const listeners = new Set<(value: number) => void>();
  return {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener);
      listener(value);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next) {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener(value);
    },
  };
}

export function useSectionProgress(section: RefObject<HTMLElement | null>): ProgressSource {
  const [store] = useState(createProgressStore);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      store.set(scrollProgress(rect.top, rect.height, window.innerHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [section, store]);

  return store;
}
