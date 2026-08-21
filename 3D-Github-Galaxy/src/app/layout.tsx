import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '3D GitHub Galaxy • Astronomical Developer Universe',
  description: 'Transform GitHub developer metrics and repositories into an interactive 3D celestial galaxy.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-space-950 text-slate-100 antialiased overflow-hidden font-sans select-none">
        {children}
      </body>
    </html>
  );
}
