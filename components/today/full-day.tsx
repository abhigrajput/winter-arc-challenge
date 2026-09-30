'use client';

import { useEffect, useReducer } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * §8.10 full-day bonus. Fires once per local date, remembered in localStorage
 * so a refresh does not replay it, and honours prefers-reduced-motion.
 *
 * The "have we shown this already" check has to run after mount — localStorage
 * does not exist during SSR, and reading it while rendering would desync
 * hydration. So the effect dispatches once and the reducer decides; state is
 * never set straight from the effect body.
 */

type State = { phase: 'pending' | 'showing' | 'done' };
type Action = { type: 'decide'; alreadySeen: boolean } | { type: 'hide' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'decide':
      if (state.phase !== 'pending') return state;
      return { phase: action.alreadySeen ? 'done' : 'showing' };
    case 'hide':
      return { phase: 'done' };
  }
}

export function FullDayCelebration({ full, logDate }: { full: boolean; logDate: string }) {
  const [state, dispatch] = useReducer(reducer, { phase: 'pending' });
  const reduceMotion = useReducedMotion();
  const key = `wa_fullday_${logDate}`;

  useEffect(() => {
    if (!full) return;

    let alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(key) === '1';
      if (!alreadySeen) window.localStorage.setItem(key, '1');
    } catch {
      // Private mode or blocked storage: still celebrate, just do not remember.
    }

    dispatch({ type: 'decide', alreadySeen });

    const timer = window.setTimeout(() => dispatch({ type: 'hide' }), 2600);
    return () => window.clearTimeout(timer);
  }, [full, key]);

  return (
    <AnimatePresence>
      {full && state.phase === 'showing' ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="space-y-2 px-8 text-center"
          >
            <p className="label-xs">Full day</p>
            <p className="text-4xl font-semibold tracking-tight">Everything done.</p>
            <p className="text-sm text-muted-foreground">+20 bonus points.</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
