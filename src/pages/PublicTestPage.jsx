import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { testQuestionsGet, testSubmitPublic, testTokenValidate } from '../api/test';

function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function PublicTestPage() {
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [valid, setValid] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState('');
  const [questions, setQuestions] = useState([]);

  const [fullName, setFullName] = useState('');
  const [applyingFor, setApplyingFor] = useState('');
  const [source, setSource] = useState('');
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        if (!token) {
          if (cancelled) return;
          setValid(false);
          setExpiresAt('');
          setSubmitted(false);
          setSubmittedAt('');
          setQuestions([]);
          setAnswers({});
          return;
        }

        const v = await testTokenValidate({ token });
        if (cancelled) return;

        setValid(Boolean(v.valid));
        setExpiresAt(v.expiresAt || '');
        setSubmitted(Boolean(v.submitted));
        setSubmittedAt('');
        setQuestions([]);
        setAnswers({});

        if (!v.valid || v.submitted) return;

        const q = await testQuestionsGet({ token });
        if (cancelled) return;

        if (q.alreadySubmitted) {
          setSubmitted(true);
          setSubmittedAt('');
          return;
        }

        setQuestions(q.questions || []);
      } catch (e) {
        if (cancelled) return;
        setValid(false);
        setExpiresAt('');
        setSubmitted(false);
        setSubmittedAt('');
        setQuestions([]);
        toast.error(e?.message || 'Failed to load test');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit() {
    if (loading || submitting) return;
    try {
      if (!token) return;
      if (!String(fullName).trim()) {
        toast.error('Full Name required');
        return;
      }
      if (!String(applyingFor).trim()) {
        toast.error('Applying For required');
        return;
      }
      if (!String(source).trim()) {
        toast.error('Source required');
        return;
      }

      for (const q of questions) {
        const v = answers[q.id];
        if (!String(v ?? '').trim()) {
          toast.error(`Answer required for question ${q.id}`);
          return;
        }
      }

      setSubmitting(true);
      const res = await testSubmitPublic({
        token,
        fullName: String(fullName).trim(),
        applyingFor: String(applyingFor).trim(),
        source: String(source).trim(),
        answers,
      });

      setSubmitted(true);
      setSubmittedAt(res?.submittedAt || '');
      toast.success('Test submitted');
    } catch (e) {
      const msg = e?.message || 'Submit failed';
      if (String(msg).toUpperCase().includes('ALREADY_SUBMITTED')) {
        setSubmitted(true);
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <div className="card" style={{ marginTop: 10 }}>
        <h2 style={{ marginTop: 0 }}>Online Test</h2>

        {loading ? (
          <div className="small">Loading...</div>
        ) : !token ? (
          <div className="small">Missing token in URL.</div>
        ) : !valid ? (
          <div className="small">Invalid or expired token.</div>
        ) : submitted ? (
          <div className="card" style={{ background: '#fafafa' }}>
            <strong>Test submitted</strong>
            <div className="small" style={{ marginTop: 8 }}>
              Thank you. Your response has been submitted.
            </div>
            {submittedAt ? <div className="small" style={{ marginTop: 6 }}>Submitted: {fmtDateTime(submittedAt)}</div> : null}
          </div>
        ) : (
          <>
            <div className="small">Token valid{expiresAt ? ` (expires: ${fmtDateTime(expiresAt)})` : ''}</div>

            <div style={{ height: 12 }} />

            <div className="card" style={{ background: '#fafafa' }}>
              <strong>Candidate Details</strong>
              <div style={{ height: 10 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <div>
                  <div className="small">Full Name</div>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <div className="small">Applying For</div>
                  <input
                    value={applyingFor}
                    onChange={(e) => setApplyingFor(e.target.value)}
                    placeholder="Applying For"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <div className="small">Source</div>
                  <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" disabled={submitting} />
                </div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="card" style={{ background: '#fafafa' }}>
              <strong>Questions</strong>

              <div style={{ height: 10 }} />

              {questions.length === 0 ? (
                <div className="small">No questions loaded.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                  {questions.map((q) => (
                    <div key={q.id} className="card" style={{ background: '#fff' }}>
                      <div style={{ fontWeight: 700 }}>{q.id}.</div>
                      <div className="small" style={{ marginTop: 6 }}>
                        {q.prompt}
                      </div>
                      <div style={{ height: 8 }} />
                      <input
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                        placeholder="Your answer"
                        disabled={submitting}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ height: 12 }} />
              <button className="button primary" type="button" onClick={onSubmit} disabled={submitting || questions.length === 0}>
                {submitting ? 'Submitting...' : 'Submit Test'}
              </button>
            </div>

            <div className="small" style={{ marginTop: 12 }}>
              Do not refresh after submit. One attempt only.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

