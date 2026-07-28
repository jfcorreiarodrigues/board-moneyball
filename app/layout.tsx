import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Businessmap CSV Importer",
  description:
    "Importação massiva de cartões para o Businessmap (Kanbanize) a partir de ficheiros CSV.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
