export const metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy</h1>
      <div className="card" style={{ marginTop: '1.25rem', lineHeight: 1.6 }}>
        <p>
          SailorPath shows official Singapore Optimist series information derived from the national
          ranking dataset: name, club, age band (not birth year), rank, scores, and regatta
          places.
        </p>
        <p>
          We do not publish school names or full dates of birth on public profile pages. Claimed
          profiles, parent accounts, and photo galleries will use separate consent and privacy
          controls.
        </p>
        <p className="muted">Contact the site operator to request corrections to official data.</p>
      </div>
    </>
  );
}
