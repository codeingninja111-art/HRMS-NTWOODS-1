import React, { useState } from 'react';

export function Collapsible({
  title,
  subtitle,
  badge,
  children,
  defaultOpen = false,
  headerRight,
  variant = 'default', // 'default' | 'card' | 'section'
}) {
  const [open, setOpen] = useState(defaultOpen);

  const baseStyle =
    variant === 'card'
      ? {
          background: 'white',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }
      : variant === 'section'
        ? {
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }
        : {};

  return (
    <div style={baseStyle}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: variant === 'default' ? '8px 0' : '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          background: open && variant !== 'default' ? 'var(--gray-50)' : 'transparent',
          borderBottom: open && variant !== 'default' ? '1px solid var(--gray-200)' : 'none',
          transition: 'background var(--transition)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            fontSize: '12px',
            color: 'var(--gray-500)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition)',
          }}
        >
          ▸
        </span>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--gray-800)' }}>{title}</span>
            {badge ? <span className="badge blue">{badge}</span> : null}
          </div>
          {subtitle ? (
            <div className="small" style={{ marginTop: '2px' }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {headerRight ? <div onClick={(e) => e.stopPropagation()}>{headerRight}</div> : null}
      </div>

      {open ? <div style={{ padding: variant === 'default' ? '8px 0 8px 32px' : '16px' }}>{children}</div> : null}
    </div>
  );
}

export function ExpandableCard({ title, subtitle, badge, actions, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card" style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '16px',
          cursor: children ? 'pointer' : 'default',
        }}
        onClick={() => children && setOpen(!open)}
      >
        {children ? (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              fontSize: '12px',
              color: 'var(--gray-400)',
              background: 'var(--gray-100)',
              borderRadius: '6px',
              flexShrink: 0,
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition)',
            }}
          >
            ▸
          </span>
        ) : null}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--gray-900)' }}>{title}</span>
            {badge}
          </div>
          {subtitle ? (
            <div className="small" style={{ marginTop: '4px' }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}
          >
            {actions}
          </div>
        ) : null}
      </div>

      {open && children ? (
        <div style={{ padding: '0 16px 16px 52px', borderTop: '1px solid var(--gray-100)' }}>
          <div style={{ paddingTop: '16px' }}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

