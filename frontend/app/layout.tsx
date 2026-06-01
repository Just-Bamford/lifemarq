import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifemarq — Organ Donor Registry",
  description: "Immutable, blockchain-powered organ donor registry on Stellar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="navbar">
          <div className="container">
            <h1>Lifemarq</h1>
            <nav>
              <a href="/">Home</a>
              <a href="/donor">Donor Portal</a>
              <a href="/hospital">Hospital Query</a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
