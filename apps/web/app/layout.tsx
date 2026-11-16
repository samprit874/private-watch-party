import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dudu & Bubu - Watch Party',
  description: 'Synchronized virtual cinema for Dudu & Bubu and friends',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-cinema-950 text-gray-100 antialiased selection:bg-cinema-accent selection:text-white">
        {children}
      </body>
    </html>
  );
}
