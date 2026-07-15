'use client';

import { useState, type FormEvent } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';

export function FoundingForm({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const em = email.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError('Enter a valid email address.');
      setStatus('err');
      return;
    }
    setStatus('saving');
    try {
      const db = getFirebaseDb();
      await addDoc(collection(db, 'foundingMembers'), {
        email: em,
        name: name.trim() || null,
        note: note.trim() || null,
        createdAt: serverTimestamp(),
        source: 'sailorpath-home',
      });
      setStatus('ok');
      setName('');
      setEmail('');
      setNote('');
    } catch (err) {
      console.error(err);
      setStatus('err');
      setError(
        'Could not save your interest. Publish Firestore rules for foundingMembers, or try again later.'
      );
    }
  }

  if (status === 'ok') {
    return (
      <div className="founding-success">
        <strong>You’re on the founding list.</strong>
        <p className="muted">We’ll email you when founding membership opens fully.</p>
      </div>
    );
  }

  return (
    <form className={`founding-form ${compact ? 'is-compact' : ''}`} onSubmit={onSubmit}>
      {!compact && (
        <div className="fl">
          <label className="fl-lbl" htmlFor="founding-name">
            Name (optional)
          </label>
          <input
            id="founding-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
      )}
      <div className="fl">
        <label className="fl-lbl" htmlFor="founding-email">
          Email
        </label>
        <input
          id="founding-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      {!compact && (
        <div className="fl">
          <label className="fl-lbl" htmlFor="founding-note">
            Note (optional)
          </label>
          <textarea
            id="founding-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Club, sailor age group, or why you’re joining…"
            rows={3}
          />
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
        {status === 'saving' ? 'Joining…' : 'Join founding members'}
      </button>
    </form>
  );
}
