import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DM Script",
  description: "Веб-версия материалов мастера для D&D-сессий."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
