import React, { useEffect, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useAuth } from '../../auth/useAuth';
import { Badge } from '../ui/Badge';
import { getNavSections } from './nav';

function normalizeRole_(role) {
  const r = String(role || '').trim().toUpperCase();
  return r || null;
}

function roleAllowed_(role, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const r = normalizeRole_(role);
  return !!r && allowedRoles.map(normalizeRole_).includes(r);
}

function allowPortal_(canPortal, portalKey, fallbackAllowed) {
  if (!portalKey) return fallbackAllowed;
  const v = typeof canPortal === 'function' ? canPortal(portalKey) : null;
  if (v === true || v === false) return v;
  return fallbackAllowed;
}

export function Sidebar({ collapsed, onToggleCollapsed }) {
  const { me, role, legacyRole, permissions, canPortal } = useAuth();

  const effectiveRole = legacyRole || role;
  const sections = useMemo(() => getNavSections(), []);
  const prefetchedRef = useRef(new Set());

  const visibleSections = useMemo(() => {
    const out = [];
    for (const s of sections) {
      const items = (s.items || []).filter((it) => {
        const fallbackAllowed = roleAllowed_(effectiveRole, it.roles);
        return allowPortal_(canPortal, it.portalKey, fallbackAllowed);
      });
      if (items.length > 0) out.push({ ...s, items });
    }
    return out;
  }, [sections, canPortal, effectiveRole]);

  const roleBadge = normalizeRole_(me?.role) || normalizeRole_(effectiveRole) || 'USER';

  function prefetch_(it) {
    const fn = it?.preload;
    if (typeof fn !== 'function') return;
    const key = String(it?.to || it?.key || '');
    if (key && prefetchedRef.current.has(key)) return;
    if (key) prefetchedRef.current.add(key);
    try {
      fn();
    } catch {
      // ignore
    }
  }

  // Prefetch visible routes progressively (helps INP on navigation).
  useEffect(() => {
    const flat = [];
    for (const s of visibleSections) {
      for (const it of s.items || []) {
        if (typeof it?.preload === 'function') flat.push(it);
      }
    }

    const toPrefetch = flat;
    if (toPrefetch.length === 0) return;

    if (typeof window === 'undefined') return;

    if (typeof window.requestIdleCallback === 'function') {
      let idleId = null;
      let delayId = null;
      let cancelled = false;
      let idx = 0;

      function step(deadline) {
        if (cancelled) return;
        const t0 = performance.now();

        while (idx < toPrefetch.length) {
          // Keep each idle slice small to avoid long tasks and input delay.
          const overBudget = performance.now() - t0 > 12;
          const noTime = typeof deadline?.timeRemaining === 'function' ? deadline.timeRemaining() < 8 : false;
          if (overBudget || noTime) break;
          prefetch_(toPrefetch[idx]);
          idx += 1;
        }

        if (idx < toPrefetch.length && !cancelled) {
          idleId = window.requestIdleCallback(step, { timeout: 2000 });
        }
      }

      // Delay start so page load is not impacted and the UI becomes interactive first.
      delayId = window.setTimeout(() => {
        if (cancelled) return;
        idleId = window.requestIdleCallback(step, { timeout: 2000 });
      }, 1800);

      return () => {
        cancelled = true;
        if (delayId) window.clearTimeout(delayId);
        if (idleId) window.cancelIdleCallback?.(idleId);
      };
    }

    let cancelled = false;
    let idx = 0;
    let t = null;

    function tick() {
      if (cancelled) return;
      const t0 = performance.now();
      while (idx < toPrefetch.length && performance.now() - t0 < 12) {
        prefetch_(toPrefetch[idx]);
        idx += 1;
      }
      if (idx < toPrefetch.length && !cancelled) {
        t = window.setTimeout(tick, 350);
      }
    }

    t = window.setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      if (t) window.clearTimeout(t);
    };
  }, [visibleSections]);

  return (
    <aside className={cn('sidebar', collapsed && 'is-collapsed')}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">NT</div>
          {!collapsed ? (
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-title">HRMS Portal</div>
              <div className="sidebar-subtitle">
                <Badge variant="blue">{roleBadge}</Badge>
                {permissions ? <span className="sidebar-permDot" /> : null}
              </div>
            </div>
          ) : null}
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u00BB' : '\u00AB'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {visibleSections.map((s) => (
          <div key={s.key} className="sidebar-section">
            {!collapsed ? <div className="sidebar-sectionTitle">{s.title}</div> : null}
            <div className="sidebar-links">
              {s.items.map((it) => (
                <NavLink
                  key={it.key}
                  to={it.to}
                  className={({ isActive }) => cn('sidebar-link', isActive && 'is-active')}
                  onMouseEnter={() => prefetch_(it)}
                  onFocus={() => prefetch_(it)}
                  onPointerDown={() => prefetch_(it)}
                >
                  <span className="sidebar-linkIcon" aria-hidden="true">
                    {'\u2022'}
                  </span>
                  {!collapsed ? <span className="sidebar-linkLabel">{it.label}</span> : null}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
