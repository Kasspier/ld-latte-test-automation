import Link from "next/link";

export default function NotFound() {
  return (
    <main className="boot">
      <span className="eyebrow">404</span>
      <h1>Страница не найдена</h1>
      <Link className="button primary" href="/">
        К моим заявкам
      </Link>
    </main>
  );
}
