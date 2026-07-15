'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { validateHandle } from '@/lib/handles';

type SailorHit = {
  slug: string;
  name: string;
  club?: string;
  fleets?: string[];
};

type Step = 1 | 2 | 3 | 4;

export default function ClaimPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState<'register' | 'signin'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'free' | 'taken' | 'invalid'>(
    'idle'
  );
  const [handleError, setHandleError] = useState('');
  const [search, setSearch] = useState('');
  const [sailors, setSailors] = useState<SailorHit[]>([]);
  const [selected, setSelected] = useState<SailorHit | null>(null);
  const [guardianOk, setGuardianOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ handle: string; slug: string | null } | null>(null);
  const [existingProfile, setExistingProfile] = useState<{
    handle?: string;
    linkedSailorSlug?: string;
  } | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        try {
          const snap = await getDoc(doc(getFirebaseDb(), 'users', u.uid));
          if (snap.exists()) {
            const d = snap.data();
            setExistingProfile({
              handle: d.handle,
              linkedSailorSlug: d.linkedSailorSlug,
            });
            if (d.handle) setHandle(d.handle);
          } else {
            setExistingProfile(null);
          }
        } catch {
          setExistingProfile(null);
        }
      } else {
        setExistingProfile(null);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/data/official-snapshot.json', { cache: 'force-cache' });
        if (!res.ok) return;
        const snap = await res.json();
        const list: SailorHit[] = (snap.sailors || []).map(
          (s: { slug: string; name: string; club?: string; fleets?: Record<string, unknown> }) => ({
            slug: s.slug,
            name: s.name,
            club: s.club,
            fleets: s.fleets ? Object.keys(s.fleets) : [],
          })
        );
        if (!cancelled) setSailors(list);
      } catch (e) {
        console.warn('Could not load sailor list for claim', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const step: Step = useMemo(() => {
    if (done) return 4;
    if (!user) return 1;
    if (!existingProfile?.handle && !done) {
      // still on handle if not saved
      if (handleStatus === 'free' || existingProfile?.handle) {
        /* fall through */
      }
    }
    if (user && !existingProfile?.handle) return 2;
    if (user && existingProfile?.handle && !existingProfile?.linkedSailorSlug) return 3;
    if (user && existingProfile?.handle && existingProfile?.linkedSailorSlug) return 4;
    if (user) return 2;
    return 1;
  }, [user, existingProfile, done, handleStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return sailors
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.includes(q) ||
          (s.club && s.club.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [search, sailors]);

  async function checkHandleAvailability(h: string) {
    const v = validateHandle(h);
    if (!v.ok) {
      setHandleStatus('invalid');
      setHandleError(v.error);
      return null;
    }
    setHandleStatus('checking');
    setHandleError('');
    try {
      const snap = await getDoc(doc(getFirebaseDb(), 'handles', v.handle));
      if (snap.exists()) {
        const owner = snap.data()?.uid;
        if (user && owner === user.uid) {
          setHandleStatus('free');
          return v.handle;
        }
        setHandleStatus('taken');
        setHandleError('That handle is already taken.');
        return null;
      }
      setHandleStatus('free');
      return v.handle;
    } catch (e) {
      console.error(e);
      setHandleStatus('invalid');
      setHandleError('Could not check handle. Check Firestore rules / connection.');
      return null;
    }
  }

  const onAuth = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      setBusy(true);
      try {
        const auth = getFirebaseAuth();
        if (mode === 'register') {
          await createUserWithEmailAndPassword(auth, email.trim(), password);
        } else {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        }
      } catch (err: unknown) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
        if (code === 'auth/email-already-in-use') setError('Email already registered — sign in instead.');
        else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password')
          setError('Invalid email or password.');
        else if (code === 'auth/weak-password') setError('Password should be at least 6 characters.');
        else if (code === 'auth/operation-not-allowed')
          setError('Email/password sign-in is not enabled in Firebase Console yet.');
        else setError('Authentication failed. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [email, password, mode]
  );

  async function saveHandle(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setBusy(true);
    try {
      const h = await checkHandleAvailability(handle);
      if (!h) {
        setBusy(false);
        return;
      }
      const db = getFirebaseDb();
      // Reserve handle
      await setDoc(doc(db, 'handles', h), {
        uid: user.uid,
        email: user.email,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email,
          handle: h,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setExistingProfile((p) => ({ ...p, handle: h }));
    } catch (err) {
      console.error(err);
      setError('Could not reserve handle. It may have just been taken, or rules need updating.');
    } finally {
      setBusy(false);
    }
  }

  async function linkSailor(e: FormEvent) {
    e.preventDefault();
    if (!user || !existingProfile?.handle) return;
    if (!selected) {
      setError('Select a sailor from the official rankings list.');
      return;
    }
    if (!guardianOk) {
      setError('Confirm you are the sailor or a parent/guardian.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const db = getFirebaseDb();
      // Ensure sailor not already claimed by someone else
      const q = query(
        collection(db, 'users'),
        where('linkedSailorSlug', '==', selected.slug)
      );
      const existing = await getDocs(q);
      const conflict = existing.docs.find((d) => d.id !== user.uid);
      if (conflict) {
        setError('That sailor profile is already linked to another account.');
        setBusy(false);
        return;
      }
      await setDoc(
        doc(db, 'users', user.uid),
        {
          linkedSailorSlug: selected.slug,
          linkedSailorName: selected.name,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'handles', existingProfile.handle),
        {
          linkedSailorSlug: selected.slug,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await setDoc(doc(db, 'claims', user.uid), {
        handle: existingProfile.handle,
        sailorSlug: selected.slug,
        sailorName: selected.name,
        createdAt: serverTimestamp(),
      });
      setDone({ handle: existingProfile.handle, slug: selected.slug });
      setExistingProfile((p) => ({ ...p, linkedSailorSlug: selected.slug }));
    } catch (err) {
      console.error(err);
      setError('Could not link sailor. Check Firestore rules and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function skipLink() {
    if (!user || !existingProfile?.handle) return;
    setDone({ handle: existingProfile.handle, slug: null });
  }

  if (!authReady) {
    return (
      <div className="card claim-card">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <div className="eyebrow">Claim your identity</div>
      <h1>Claim your handle</h1>
      <p className="lede" style={{ marginBottom: '1.5rem' }}>
        Create an account, reserve <strong>sailorpath.com/your-handle</strong>, and link it to an
        official Optimist sailor on the rankings board.
      </p>

      <ol className="claim-steps">
        <li className={step >= 1 ? 'is-active' : ''}>1 · Account</li>
        <li className={step >= 2 ? 'is-active' : ''}>2 · Handle</li>
        <li className={step >= 3 ? 'is-active' : ''}>3 · Link sailor</li>
        <li className={step >= 4 ? 'is-active' : ''}>4 · Done</li>
      </ol>

      {error && <div className="notice">{error}</div>}

      {/* Step 1 */}
      {!user && (
        <section className="card claim-card">
          <h2>{mode === 'register' ? 'Create account' : 'Sign in'}</h2>
          <p className="sub">Email and password · Firebase Auth</p>
          <form onSubmit={onAuth} className="claim-form">
            <div className="fl">
              <label className="fl-lbl" htmlFor="claim-email">
                Email
              </label>
              <input
                id="claim-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="fl">
              <label className="fl-lbl" htmlFor="claim-password">
                Password
              </label>
              <input
                id="claim-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <p className="muted" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
            {mode === 'register' ? (
              <>
                Already have an account?{' '}
                <button type="button" className="linkish" onClick={() => setMode('signin')}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{' '}
                <button type="button" className="linkish" onClick={() => setMode('register')}>
                  Register
                </button>
              </>
            )}
          </p>
        </section>
      )}

      {/* Step 2 */}
      {user && !existingProfile?.handle && !done && (
        <section className="card claim-card">
          <h2>Choose your handle</h2>
          <p className="sub">
            Signed in as {user.email}.{' '}
            <button type="button" className="linkish" onClick={() => signOut(getFirebaseAuth())}>
              Sign out
            </button>
          </p>
          <form onSubmit={saveHandle} className="claim-form">
            <div className="fl">
              <label className="fl-lbl" htmlFor="claim-handle">
                Handle
              </label>
              <div className="handle-input-row">
                <span className="handle-prefix">sailorpath.com/</span>
                <input
                  id="claim-handle"
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value);
                    setHandleStatus('idle');
                  }}
                  onBlur={() => {
                    if (handle.trim()) checkHandleAvailability(handle);
                  }}
                  placeholder="alex-reyes"
                  autoComplete="off"
                  required
                />
              </div>
              {handleStatus === 'checking' && <p className="muted">Checking…</p>}
              {handleStatus === 'free' && <p className="form-ok">Handle is available.</p>}
              {handleError && <p className="form-error">{handleError}</p>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || handleStatus === 'taken'}>
              {busy ? 'Saving…' : 'Reserve handle'}
            </button>
          </form>
        </section>
      )}

      {/* Step 3 */}
      {user && existingProfile?.handle && !existingProfile?.linkedSailorSlug && !done && (
        <section className="card claim-card">
          <h2>Link an official sailor</h2>
          <p className="sub">
            Handle <strong>{existingProfile.handle}</strong> is yours. Search the rankings list and
            select your sailor.
          </p>
          <form onSubmit={linkSailor} className="claim-form">
            <div className="fl">
              <label className="fl-lbl" htmlFor="claim-search">
                Search by name or club
              </label>
              <input
                id="claim-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type at least 2 characters…"
                autoComplete="off"
              />
            </div>
            {filtered.length > 0 && (
              <ul className="claim-sailor-list">
                {filtered.map((s) => (
                  <li key={s.slug}>
                    <button
                      type="button"
                      className={`claim-sailor-btn ${selected?.slug === s.slug ? 'is-selected' : ''}`}
                      onClick={() => setSelected(s)}
                    >
                      <strong>{s.name}</strong>
                      <span>
                        {s.club || '—'}
                        {s.fleets?.length ? ` · ${s.fleets.join(', ')}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected && (
              <p className="form-ok">
                Selected: <strong>{selected.name}</strong> ({selected.slug})
              </p>
            )}
            <label className="claim-check">
              <input
                type="checkbox"
                checked={guardianOk}
                onChange={(e) => setGuardianOk(e.target.checked)}
              />
              I am this sailor, or a parent/guardian acting on their behalf.
            </label>
            <div className="hero-actions">
              <button type="submit" className="btn btn-primary" disabled={busy || !selected}>
                {busy ? 'Linking…' : 'Link sailor'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={skipLink}>
                Skip for now
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Step 4 */}
      {(done || (existingProfile?.handle && existingProfile?.linkedSailorSlug)) && user && (
        <section className="card claim-card">
          <h2>You’re claimed</h2>
          <p className="sub">Your SailorPath identity is ready.</p>
          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
            <div className="stat">
              <strong style={{ fontSize: '1.1rem' }}>
                /{done?.handle || existingProfile?.handle}
              </strong>
              <span>Handle</span>
            </div>
            <div className="stat">
              <strong style={{ fontSize: '1.1rem' }}>
                {done?.slug || existingProfile?.linkedSailorSlug || '—'}
              </strong>
              <span>Linked sailor</span>
            </div>
          </div>
          <div className="hero-actions">
            {(done?.slug || existingProfile?.linkedSailorSlug) && (
              <Link
                className="btn btn-primary"
                href={`/s/${done?.slug || existingProfile?.linkedSailorSlug}`}
              >
                View sailor profile
              </Link>
            )}
            <Link className="btn btn-secondary" href="/my">
              My account
            </Link>
            <Link className="btn btn-secondary" href="/">
              Home
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
