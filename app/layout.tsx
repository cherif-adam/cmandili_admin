import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Amana Admin",
  description: "Tableau de bord administrateur Amana",
};

/**
 * Applies the stored theme before first paint. Doing this in a React effect
 * instead would render the default theme first and visibly repaint — the
 * "flash of wrong theme" every themed site has to solve this way.
 */
const themeInit = `
(function(){try{
  var t = localStorage.getItem('amana-theme');
  if(!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
}catch(e){document.documentElement.dataset.theme='light';}})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.className} data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
