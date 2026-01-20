import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";

export const metadata: Metadata = {
  title: "Convex Real-Time Chat",
  description: "A real-time chat lobby with rooms."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            <div className="mx-auto max-w-6xl">{children}</div>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
