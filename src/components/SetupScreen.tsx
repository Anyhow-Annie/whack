type SetupScreenProps = {
  onEnter: () => void
}

export function SetupScreen({ onEnter }: SetupScreenProps) {
  return (
    <main className="screen">
      <p className="pill">Local preview</p>
      <h1>Living Organizational Memory</h1>
      <p className="lede">
        Firebase is not connected. The workspace uses sample projects stored in this browser tab
        so you can try the interface. Nothing is saved to a server, and it clears when you refresh.
      </p>
      <section className="card">
        <h2>Open the sample workspace</h2>
        <p className="muted">
          Fill in <code>.env.local</code> later when you want sign-in, Firestore, and Storage.
          Until then, this preview does not call Firebase.
        </p>
        <button type="button" onClick={onEnter}>Enter preview</button>
      </section>
    </main>
  )
}
