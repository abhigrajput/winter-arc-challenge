'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Rest timer (§8.1). Counts down, vibrates on zero where the browser allows it.
 *
 * The deadline is stored as a timestamp rather than a tick count, so the timer
 * stays accurate when the tab is backgrounded and the interval is throttled.
 */

const PRESETS = [60, 90, 120, 180] as const;

interface State {
  duration: number;
  /** Epoch ms when the timer ends; null while paused or idle. */
  deadline: number | null;
  /** Seconds left while paused. */
  paused: number | null;
  remaining: number;
}

type Action =
  | { type: 'start'; duration: number; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'reset' }
  | { type: 'tick'; now: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return {
        duration: action.duration,
        deadline: action.now + action.duration * 1000,
        paused: null,
        remaining: action.duration,
      };
    case 'pause': {
      if (state.deadline === null) return state;
      const left = Math.max(0, Math.ceil((state.deadline - action.now) / 1000));
      return { ...state, deadline: null, paused: left, remaining: left };
    }
    case 'resume': {
      if (state.paused === null) return state;
      return { ...state, deadline: action.now + state.paused * 1000, paused: null };
    }
    case 'reset':
      return { ...state, deadline: null, paused: null, remaining: state.duration };
    case 'tick': {
      if (state.deadline === null) return state;
      const left = Math.max(0, Math.ceil((state.deadline - action.now) / 1000));
      if (left === state.remaining) return state;
      return { ...state, remaining: left, deadline: left === 0 ? null : state.deadline };
    }
  }
}

export function RestTimer({ defaultSeconds = 90 }: { defaultSeconds?: number }) {
  const [state, dispatch] = useReducer(reducer, {
    duration: defaultSeconds,
    deadline: null,
    paused: null,
    remaining: defaultSeconds,
  });

  const wasRunning = useRef(false);

  useEffect(() => {
    if (state.deadline === null) return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 250);
    return () => window.clearInterval(id);
  }, [state.deadline]);

  // Buzz once as it hits zero. Vibration is unsupported on iOS Safari and may
  // be blocked elsewhere, so it is a nicety, never the only signal.
  useEffect(() => {
    if (state.remaining === 0 && wasRunning.current) {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        // Ignored: the visible timer is the real feedback.
      }
    }
    wasRunning.current = state.deadline !== null;
  }, [state.remaining, state.deadline]);

  const start = useCallback(
    (seconds: number) => dispatch({ type: 'start', duration: seconds, now: Date.now() }),
    [],
  );

  const running = state.deadline !== null;
  const done = state.remaining === 0;
  const minutes = Math.floor(state.remaining / 60);
  const seconds = state.remaining % 60;

  return (
    <div className="sticky bottom-16 z-10 space-y-3 rounded-lg border border-border bg-card/95 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="label-xs flex items-center gap-1.5">
          <Timer className="size-3.5" aria-hidden />
          Rest
        </span>
        <span
          aria-live="polite"
          className={cn(
            'font-mono text-2xl tabular-nums',
            done && state.duration > 0 ? 'text-primary' : '',
          )}
        >
          {minutes}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      <div className="flex gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => start(preset)}
            className={cn(
              'flex-1 rounded-md border border-input py-2 font-mono text-xs transition-colors hover:bg-accent',
              state.duration === preset && running ? 'border-primary text-primary' : '',
            )}
          >
            {preset}s
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            running
              ? dispatch({ type: 'pause', now: Date.now() })
              : state.paused !== null
                ? dispatch({ type: 'resume', now: Date.now() })
                : start(state.duration)
          }
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-input py-2 text-xs transition-colors hover:bg-accent"
        >
          {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {running ? 'Pause' : state.paused !== null ? 'Resume' : 'Start'}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'reset' })}
          aria-label="Reset timer"
          className="rounded-md border border-input px-3 transition-colors hover:bg-accent"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
