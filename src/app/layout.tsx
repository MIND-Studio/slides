import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider, Button } from "@mind-studio/ui";
import { mind } from "@mind-studio/ui/themes";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import { StandaloneOnly } from "@/components/StandaloneOnly";

export const metadata: Metadata = {
  title: "Mind Slides — agentic decks from a controlled block set",
  description:
    "Describe a deck, watch it render. An agent fills a fixed set of slide blocks; a serializer turns the validated spec into a Slidev presentation. No hand-written CSS — and your decks live in your pod.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-mind-theme="mind" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <ThemeProvider
          theme={mind}
          defaultTheme="dark"
          enableSystem={false}
          storageKey="mind-slides-theme"
        >
          <StandaloneOnly>
            <Masthead />
          </StandaloneOnly>
          <main className="flex-1">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}

function Masthead() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-10 sm:py-4">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="whitespace-nowrap text-xl font-semibold tracking-tight sm:text-2xl">
            Mind Slides
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">
            <span className="text-primary">●</span> decks, generated
          </span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <Button asChild variant="ghost" size="sm">
            <Link href="/studio">Studio</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/connect">Connect pod</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
