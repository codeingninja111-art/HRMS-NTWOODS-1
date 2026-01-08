import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { trainingMasterList, trainingMasterUpsert } from '../../api/training';
import { Spinner } from '../ui/Spinner';

function joinDocLines(docs) {
  if (!Array.isArray(docs) || !docs.length) return '';
  return docs.filter(Boolean).map((x) => String(x)).join('\n');
}

export function AdminTrainingForm({ token }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  function normalizeVideoLinks_(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const cleaned = list.map((x) => String(x || '').trim()).filter(Boolean);
    return cleaned.length ? cleaned : [''];
  }

  const [form, setForm] = useState({
    training_id: '',
    name: '',
    department: '',
    description: '',
    video_links: [''],
    documentsLines: '',
  });

  async function load() {
    setLoading(true);
    try {
      const res = await trainingMasterList(token);
      setItems(res.items ?? []);
    } catch (e) {
      toast.error(e?.message || 'Failed to load trainings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSave = useMemo(() => !!String(form.name || '').trim() && !!String(form.department || '').trim(), [form]);

  async function onSave(e) {
    e?.preventDefault?.();
    if (!canSave) {
      toast.error('Name and Department are required');
      return;
    }
    setBusy(true);
    try {
      const videoLinks = normalizeVideoLinks_(form.video_links).filter(Boolean);
      const payload = {
        training_id: String(form.training_id || '').trim() || undefined,
        name: String(form.name || '').trim(),
        department: String(form.department || '').trim(),
        description: String(form.description || '').trim(),
        video_links: videoLinks,
        documentsLines: String(form.documentsLines || ''),
      };
      const res = await trainingMasterUpsert(token, payload);
      toast.success(payload.training_id ? 'Training updated' : 'Training created');
      setForm({ training_id: '', name: '', department: '', description: '', video_links: [''], documentsLines: '' });
      await load();
      if (res?.training_id) {
        // no-op
      }
    } catch (e2) {
      toast.error(e2?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>Training Builder (Templates)</h3>
        <div style={{ marginLeft: 'auto' }}>
          <button className="button" type="button" onClick={load} disabled={loading}>
            {loading ? <Spinner size={14} /> : null}
            Refresh
          </button>
        </div>
      </div>

      <div style={{ height: 10 }} />

      <form onSubmit={onSave} className="card" style={{ background: '#fafafa' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Training Name (e.g., CRM)"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            style={{ minWidth: 220 }}
          />
          <input
            placeholder="Department (e.g., Accounts)"
            value={form.department}
            onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
            style={{ minWidth: 180 }}
          />
        </div>

        <div style={{ height: 10 }} />

        <div>
          <label className="small" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>Video URLs</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {(form.video_links || []).map((v, idx) => (
              <div key={idx} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  placeholder={`Video URL ${idx + 1}`}
                  value={v}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      video_links: (p.video_links || []).map((x, i) => (i === idx ? e.target.value : x)),
                    }))
                  }
                  style={{ minWidth: 240, flex: 1 }}
                />
                <button
                  className="button"
                  type="button"
                  disabled={busy}
                  onClick={() => setForm((p) => ({ ...p, video_links: [...(p.video_links || []), ''] }))}
                >
                  + Add
                </button>
                <button
                  className="button danger"
                  type="button"
                  disabled={busy || (form.video_links || []).length <= 1}
                  onClick={() =>
                    setForm((p) => {
                      const next = (p.video_links || []).filter((_x, i) => i !== idx);
                      return { ...p, video_links: next.length ? next : [''] };
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div>
          <label className="small" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ height: 10 }} />

        <div>
          <label className="small" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>Documents (one URL or Drive fileId per line)</label>
          <textarea
            value={form.documentsLines}
            onChange={(e) => setForm((p) => ({ ...p, documentsLines: e.target.value }))}
            rows={3}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="button primary" type="submit" disabled={busy || !canSave}>
            {busy ? <Spinner size={14} /> : null}
            {form.training_id ? 'Update Template' : 'Create Template'}
          </button>
          <button
            className="button"
            type="button"
            onClick={() => setForm({ training_id: '', name: '', department: '', description: '', video_links: [''], documentsLines: '' })}
            disabled={busy}
          >
            Clear
          </button>
        </div>
      </form>

      <div style={{ height: 12 }} />
      <div className="small">{loading ? 'Loading…' : `${items.length} templates`}</div>

      <div style={{ height: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        {items.map((t) => (
          <div key={t.training_id} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div className="small" style={{ color: 'var(--gray-500)', marginTop: 2 }}>{t.department}</div>
              </div>
              <button
                className="button"
                type="button"
                onClick={() =>
                  setForm({
                    training_id: t.training_id,
                    name: t.name || '',
                    department: t.department || '',
                    description: t.description || '',
                    video_links: normalizeVideoLinks_(t.video_links || (t.video_link ? [t.video_link] : [])),
                    documentsLines: joinDocLines(t.documents),
                  })
                }
              >
                Edit
              </button>
            </div>
            {Array.isArray(t.video_links) && t.video_links.length ? (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {t.video_links.map((u, idx) => (
                  <button
                    key={u || idx}
                    className="button"
                    type="button"
                    onClick={() => window.open(u, '_blank', 'noopener,noreferrer')}
                  >
                    Open Video {idx + 1}
                  </button>
                ))}
              </div>
            ) : t.video_link ? (
              <div style={{ marginTop: 8 }}>
                <button className="button" type="button" onClick={() => window.open(t.video_link, '_blank', 'noopener,noreferrer')}>
                  Open Video
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
