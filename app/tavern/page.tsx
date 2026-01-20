"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { RedirectToSignIn, SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

export default function TavernPage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [roomInput, setRoomInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const createRoom = useMutation(api.rooms.createRoom);
  const myCharacters = useQuery(api.players.listMine, {});

  if (!isLoaded) {
    return <main className="min-h-screen px-6 py-12">Loading...</main>;
  }

  const handleCreateCampaign = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const leaderName =
        user?.fullName ||
        user?.username ||
        user?.primaryEmailAddress?.emailAddress ||
        "Adventurer";
      const { code } = await createRoom({ leaderName });
      router.push(`/game?room=${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinCampaign = () => {
    if (!roomInput.trim()) {
      setError("Enter a room code.");
      return;
    }
    router.push(`/game?room=${roomInput.trim()}`);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-12">
          <header className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase text-zinc-500">The Tavern</div>
              <h1 className="mt-2 text-3xl font-semibold text-zinc-100">
                Welcome back, {user?.firstName || "Adventurer"}.
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Create a campaign, join a room, or browse your past characters.
              </p>
            </div>
            <UserButton afterSignOutUrl="/" />
          </header>

          {error && (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          <section className="mt-10 grid gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
              <h2 className="text-lg font-medium text-zinc-100">
                Create Campaign
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Host a new world and invite your party.
              </p>
              <button
                type="button"
                onClick={handleCreateCampaign}
                disabled={isBusy}
                className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900"
              >
                Create Campaign
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
              <h2 className="text-lg font-medium text-zinc-100">Join Campaign</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Enter a room code to join an ongoing adventure.
              </p>
              <div className="mt-4 space-y-3">
                <input
                  placeholder="Room code"
                  value={roomInput}
                  onChange={(event) => setRoomInput(event.target.value)}
                />
                <button
                  type="button"
                  onClick={handleJoinCampaign}
                  className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200"
                >
                  Join Campaign
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
              <h2 className="text-lg font-medium text-zinc-100">My Grimoire</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Your previous characters and campaigns.
              </p>
              <div className="mt-4 space-y-3">
                {myCharacters?.length ? (
                  myCharacters.map((character) => (
                    <div
                      key={character._id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3"
                    >
                      <div className="text-sm text-zinc-100">
                        {character.playerName}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {character.className} · {character.hp} HP · Room {character.roomCode}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-500">
                    No saved characters yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </SignedIn>
    </main>
  );
}
