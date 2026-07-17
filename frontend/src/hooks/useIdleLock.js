import { useEffect, useRef, useState, useCallback } from 'react';

// Persisted in sessionStorage (survives page refresh, cleared when the
// tab/browser closes) so a refresh while locked doesn't silently resume
// the session without the password check.
const LOCK_KEY = 'eit_staff_locked';
const ACTIVITY_KEY = 'eit_staff_last_activity';

/**
 * Locks after `minutes` of no mouse/keyboard/touch activity.
 * Returns { locked, unlock } — `unlock` should be called only after the
 * caller has verified the password via POST /api/admin/unlock.
 */
export function useIdleLock(minutes) {
  const [locked, setLocked] = useState(() => {
    if (sessionStorage.getItem(LOCK_KEY) === 'true') return true;
    // Also lock immediately if more time has passed than the idle
    // threshold since the last recorded activity — covers the case of
    // closing the tab/laptop lid and reopening after being away.
    const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
    if (last && Date.now() - last > minutes * 60 * 1000) return true;
    return false;
  });
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (locked) return; // don't reset while locked — only explicit unlock() clears it
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      sessionStorage.setItem(LOCK_KEY, 'true');
      setLocked(true);
    }, minutes * 60 * 1000);
  }, [minutes, locked]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  const unlock = useCallback(() => {
    sessionStorage.setItem(LOCK_KEY, 'false');
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    setLocked(false);
  }, []);

  return { locked, unlock };
}
