'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';

export default function MyAccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{
    handle?: string;
    linkedSailorSlug?: string;
    linkedSailorName?: string;
  } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(getFirebaseDb(), 'users', u.uid));
        setProfile(snap.exists() ? (snap.data() as typeof profile) : null);
      } else {
        setProfile(null);
      }
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="card">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <h1>My account</h1>
        <p className="lede">Sign in to manage your handle and linked sailor.</p>
        <Link className="btn btn-primary" href="/claim">
          Claim your handle
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="eyebrow">Account</div>
      <h1>My SailorPath</h1>
      <p className="lede">Signed in as {user.email}</p>

      <section className="card" style={{ marginTop: '1.25rem' }}>
        <h2>Profile</h2>
        <div className="timeline" style={{ marginTop: '0.75rem' }}>
          <div className="timeline-item">
            <div>
              <strong>Handle</strong>
              <span>{profile?.handle ? `sailorpath.com/${profile.handle}` : 'Not set'}</span>
            </div>
          </div>
          <div className="timeline-item">
            <div>
              <strong>Linked sailor</strong>
              <span>
                {profile?.linkedSailorName || profile?.linkedSailorSlug || 'Not linked yet'}
              </span>
            </div>
          </div>
        </div>
        <div className="hero-actions" style={{ marginTop: '1.25rem' }}>
          <Link className="btn btn-primary" href="/claim">
            Continue claim
          </Link>
          {profile?.linkedSailorSlug && (
            <Link className="btn btn-secondary" href={`/s/${profile.linkedSailorSlug}`}>
              Open sailor page
            </Link>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => signOut(getFirebaseAuth())}>
            Sign out
          </button>
        </div>
      </section>
    </>
  );
}
