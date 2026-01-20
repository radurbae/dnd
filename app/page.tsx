import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main>
      <header className="grid">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="badge">Real-time Convex Chat</span>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl">
              Gather your party and start a room.
            </h1>
            <p className="muted mt-3 max-w-xl">
              Sign in to save your progress and jump into a live campaign.
            </p>
          </div>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>

      <section className="grid two mt-8">
        <div className="card">
          <h2 className="text-2xl">Enter the campaign</h2>
          <p className="muted mt-2 mb-5">
            Your character, rolls, and progress sync to your account.
          </p>
          <SignedOut>
            <SignInButton mode="modal">
              <button type="button">Sign In</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/game" className="inline-flex">
              <button type="button">Enter Campaign</button>
            </Link>
          </SignedIn>
        </div>

        <div className="card">
          <h2 className="text-2xl">What to expect</h2>
          <p className="muted mt-2">
            Create a room, roll dice, and let the Dungeon Master guide the story
            in real time.
          </p>
        </div>
      </section>
    </main>
  );
}
