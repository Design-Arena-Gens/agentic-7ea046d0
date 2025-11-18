import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Voiceover Studio',
  description: 'Create pro-level voiceovers with text-to-speech, recording, and script tools.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
