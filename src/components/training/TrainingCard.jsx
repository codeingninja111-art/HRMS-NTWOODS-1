import React, { useMemo } from 'react';
import { TrainingStatusBadge } from './TrainingStatusBadge';
import { openFile } from '../../utils/files';

function fmtDate(value) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function msToHuman(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function TrainingCard({ item, token, canUpdate, onStart, onComplete }) {
  const statusU = String(item?.status || '').toUpperCase();
  const docs = useMemo(() => {
    const list = Array.isArray(item?.documents) ? item.documents : [];
    return list.map((x) => String(x || '').trim()).filter(Boolean);
  }, [item]);

  const videos = useMemo(() => {
    const list = Array.isArray(item?.video_links)
      ? item.video_links
      : item?.video_link
        ? [item.video_link]
        : [];
    return list.map((x) => String(x || '').trim()).filter(Boolean);
  }, [item]);

  const timeTaken = useMemo(() => {
    const st = item?.start_time ? new Date(item.start_time) : null;
    const ct = item?.completion_time ? new Date(item.completion_time) : null;
    if (st && !Number.isNaN(st.getTime()) && ct && !Number.isNaN(ct.getTime())) {
      return msToHuman(ct.getTime() - st.getTime());
    }
    return '-';
  }, [item]);

  const borderLeft =
    statusU === 'COMPLETED'
      ? '4px solid #22c55e'
      : statusU === 'OVERDUE'
        ? '4px solid #ef4444'
        : statusU === 'IN_PROGRESS'
          ? '4px solid #3b82f6'
          : '4px solid #f59e0b';

  return (
    <div className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)', borderLeft }}>
      <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700 }}>{item?.training_name || item?.training_id}</div>
          <div className="small" style={{ color: 'var(--gray-500)', marginTop: 2 }}>
            {item?.department || '-'}
          </div>
          {item?.description ? (
            <div className="small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{item.description}</div>
          ) : null}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TrainingStatusBadge status={item?.status} />
            <span className="badge">Due: {fmtDate(item?.due_date)}</span>
            <span className="badge">Time: {timeTaken}</span>
          </div>
        </div>

        <div className="action-grid" style={{ minWidth: 220 }}>
          {videos.length === 1 ? (
            <button className="button" type="button" onClick={() => window.open(videos[0], '_blank', 'noopener,noreferrer')}>
              Open Video
            </button>
          ) : videos.length > 1 ? (
            <button className="button" type="button" onClick={() => window.open(videos[0], '_blank', 'noopener,noreferrer')}>
              Open Video 1
            </button>
          ) : null}

          {docs.length ? (
            <button
              className="button"
              type="button"
              onClick={() => openFile(docs[0], token)}
            >
              Open Document
            </button>
          ) : null}

          <button
            className="button"
            type="button"
            disabled={!canUpdate}
            onClick={() => onStart && onStart(item)}
          >
            {statusU === 'IN_PROGRESS' ? 'Resume' : 'Start'}
          </button>

          <button
            className="button primary"
            type="button"
            disabled={!canUpdate}
            onClick={() => onComplete && onComplete(item)}
          >
            Mark Complete
          </button>
        </div>
      </div>

      {docs.length > 1 ? (
        <div style={{ marginTop: 10 }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Documents</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {docs.map((u) => (
                <button
                  key={u}
                  className="button"
                  type="button"
                  onClick={() => openFile(u, token)}
                >
                  Open
                </button>
              ))}
          </div>
        </div>
      ) : null}

      {videos.length > 1 ? (
        <div style={{ marginTop: 10 }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Videos</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {videos.map((u, idx) => (
              <button
                key={`${idx}:${u}`}
                className="button"
                type="button"
                onClick={() => window.open(u, '_blank', 'noopener,noreferrer')}
              >
                Open {idx + 1}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
