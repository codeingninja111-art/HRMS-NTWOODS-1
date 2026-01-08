import React, { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';

let gsiLoadPromise = null;

function loadGsiScript_() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();

  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve, reject) => {
    try {
      const existing = document.querySelector('script[data-gsi-client="1"]');
      if (existing) {
        // If script exists, rely on polling below to detect readiness.
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gsi-client', '1');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Sign-In script'));
      document.head.appendChild(script);
    } catch (e) {
      reject(e);
    }
  });

  return gsiLoadPromise;
}

export function GoogleOAuthButton({ onCredential }) {
  const divRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | ready | unavailable

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (!divRef.current) return;

    let cancelled = false;
    let intervalId = null;
    let timeoutId = null;

    function tryRender_() {
      if (cancelled) return true;
      if (!window.google?.accounts?.id) return false;

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            const credential = response?.credential;
            if (credential) onCredential(credential);
          },
        });

        divRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(divRef.current, {
          theme: 'outline',
          size: 'large',
          width: 280,
          text: 'signin_with',
        });

        setStatus('ready');
        return true;
      } catch {
        return false;
      }
    }

    setStatus('idle');

    loadGsiScript_().catch(() => {
      if (!cancelled) setStatus('unavailable');
    });

    if (tryRender_()) return () => {};

    intervalId = window.setInterval(() => {
      if (tryRender_()) {
        if (intervalId) window.clearInterval(intervalId);
        intervalId = null;
      }
    }, 80);

    timeoutId = window.setTimeout(() => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = null;
      if (!cancelled) setStatus('unavailable');
    }, 5000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [onCredential]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="oauth-slot">
        <div className="small" style={{ minHeight: 44, display: 'grid', placeItems: 'center' }}>
          Missing VITE_GOOGLE_CLIENT_ID
        </div>
      </div>
    );
  }

  return (
    <div className="oauth-slot" aria-busy={status !== 'ready'}>
      <div ref={divRef} style={{ width: 280, minHeight: 44 }} />
    </div>
  );
}
