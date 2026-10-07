import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MahinBook — make room for good things",
  description: "A little more meaningful, a little more together. Your community starts here.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
