import type { Metadata } from "next";
import "./theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Opportunity Automation",
  description: "A local workspace for discovering and pursuing job opportunities.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
