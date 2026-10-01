'use client';

import { useEffect, useReducer } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * §8.8 timer for minute-based tasks. Counts up and reports the elapsed
 * minutes, so the caller can log them and auto-complete at the target.
 *
 * Elapsed time is derived from a start timestamp rather than accumulated tick
 * by tick, so a backgrounded tab (where intervals are throttled) still shows
 * the right number when it comes back.
 */

interface State {
  startedAt: number | null;
  /** Seconds banked from earlier runs in this sitting. */
  banked: number;
  elapsed: number;
}

type Action =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'reset' }
  | { type: 'tick'; now: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return state.startedAt !== null ? state : { ...state, startedAt: action.now };
    case 'pause': {
      if (state.startedAt === null) return state;
      const banked = state.banked + Math.floor((action.now - state.startedAt) / 1000);
      return { startedAt: null, banked, elapsed: banked };
    }
    case 'reset':
      return { startedAt: null, banked: 0, elapsed: 0 };
    case 'tick': {
      if (state.startedAt === null) return state;
      const elapsed = state.banked + Math.floor((action.now - state.startedAt) / 1000);
      return elapsed === state.elapsed ? state : { ...state, elapsed };
    }
  }
}

export function TaskTimer({
  targetMinutes,
  loggedMinutes,
  onStop,
}: {
  targetMinutes: number;
  loggedMinutes: number;
  /** Called with total minutes to record (already logged plus this session). */
  onStop: (minutes: number) => void;
}) {
  const [state, dispatch] = useReducer(reducer, { startedAt: null, banked: 0, elapsed: 0 });

  useEffect(() => {
    if (state.startedAt === null) return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 500);
    return () => window.clearInterval(id);
  }, [state.startedAt]);

  const running = state.startedAt !== null;
  const minutes = Math.floor(state.elapsed / 60);
  const seconds = state.elapsed % 60;
  const projected = loggedMinutes + Math.round(state.elapsed / 60);
  const reached = projected >= targetMinutes;

  function stop() {
    const total = loggedMinutes + Math.round(state.elapsed / 60);
    dispatch({ type: 'reset' });
    onStop(total);
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn('font-mono text-xs tabular-nums', reached ? 'text-primary' : 'text-muted-foreground')}
        aria-live="off"
      >
        {minutes}:{String(seconds).padStart(2, '0')}
      </span>

      <button
        type="button"
        onClick={() =>
          running
            ? dispatch({ type: 'pause', now: Date.now() })
            : dispatch({ type: 'start', now: Date.now() })
        }
        aria-label={running ? 'Pause timer' : 'Start timer'}
        className="flex size-8 items-center justify-center rounded border border-input transition-colors hover:bg-accent"
      >
        {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </button>

      <button
        type="button"
        onClick={stop}
        disabled={state.elapsed === 0}
        aria-label="Log timer and stop"
        className="flex size-8 items-center justify-center rounded border border-input transition-colors hover:bg-accent disabled:opacity-40"
      >
        <Square className="size-3.5" />
      </button>
    </div>
  );
}
