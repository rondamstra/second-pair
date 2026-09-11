export function Header() {
  return (
    <header className="header">
      <div className="header__mark" aria-hidden="true">
        {'//'}
      </div>
      <div className="header__text">
        <h1 className="header__title">Second Pair</h1>
        <p className="header__tagline">
          A second pair of eyes on your deployment, before it ships.
        </p>
      </div>
    </header>
  )
}
