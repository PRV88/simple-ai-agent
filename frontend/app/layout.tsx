import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple AI - Admin & pgvector Knowledge Engine",
  description: "Next.js Admin Flow for Authentication, Document Knowledge Ingestion, and Semantic pgvector Search.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
