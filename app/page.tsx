import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main>
      <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-12">
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="badge">Real-time Convex Chat</span>
            <h1 className="mt-4 text-3xl font-semibold text-zinc-100 sm:text-4xl">
              Gather your party and start a room.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-400">
              Sign in to save your progress and jump into a live campaign.
            </p>
          </div>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </header>

        <section className="mt-10 grid gap-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
            <h2 className="text-lg font-medium text-zinc-100">
              Enter the campaign
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
            Your character, rolls, and progress sync to your account.
            </p>
            <div className="mt-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900"
                  >
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/game" className="inline-flex">
                  <button
                    type="button"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900"
                  >
                    Enter Campaign
                  </button>
                </Link>
              </SignedIn>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
            <h2 className="text-lg font-medium text-zinc-100">
              What to expect
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
            Create a room, roll dice, and let the Dungeon Master guide the story
            in real time.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
