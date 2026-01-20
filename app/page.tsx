import Link from "next/link";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 pb-20">
        <div className="space-y-6">
          <div className="text-xs uppercase text-zinc-500">The Gateway</div>
          <h1 className="text-4xl font-semibold text-zinc-100 sm:text-5xl">
            Dungeon [AI]
          </h1>
          <p className="max-w-xl text-sm text-zinc-400">
            Step into a persistent campaign or watch a world unfold.
          </p>
          <div className="flex flex-wrap gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-zinc-900"
                >
                  Enter World
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/tavern" className="inline-flex">
                <button
                  type="button"
                  className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-zinc-900"
                >
                  Enter World
                </button>
              </Link>
            </SignedIn>
            <Link
              href="/spectate"
              className="inline-flex rounded-xl border border-zinc-800 px-5 py-2 text-sm text-zinc-300"
            >
              Spectate
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
