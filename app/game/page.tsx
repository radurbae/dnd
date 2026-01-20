"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useUser
} from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const ADJECTIVES = [
  "Brave",
  "Crimson",
  "Lucky",
  "Mighty",
  "Quiet",
  "Sly",
  "Golden",
  "Stormy",
  "Arcane",
  "Wild"
];

const CREATURES = [
  "Falcon",
  "Fox",
  "Golem",
  "Lynx",
  "Puma",
  "Raven",
  "Stag",
  "Tiger",
  "Wyvern",
  "Wolf"
];

const CHARACTER_CLASSES = [
  "Fighter",
  "Wizard",
  "Rogue",
  "Cleric",
  "Ranger",
  "Bard",
  "Paladin",
  "Druid"
];

const INVENTORY_SETS = [
  "Torch, rope, rations",
  "Herbal kit, compass, bedroll",
  "Throwing knives, lockpicks, smoke bomb",
  "Spellbook, ink, crystal focus",
  "Shield, whetstone, traveler’s cloak",
  "Map case, chalk, grappling hook"
];

function createPlayerName() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const creature = CREATURES[Math.floor(Math.random() * CREATURES.length)];
  const tag = String(Math.floor(Math.random() * 90) + 10);
  return `${adjective} ${creature} ${tag}`;
}

function parseRollCommand(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/roll")) {
    return null;
  }

  const match = trimmed.match(/^\/roll\s+d(\d+)$/i);
  if (!match) {
    return { error: "Use /roll d20 to roll a twenty-sided die." };
  }

  const sides = Number(match[1]);
  if (Number.isNaN(sides) || sides <= 0) {
    return { error: "Invalid die size." };
  }

  if (sides !== 20) {
    return { error: "Only d20 rolls are supported right now." };
  }

  const result = Math.floor(Math.random() * sides) + 1;
  return { sides, result };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function generateCharacter() {
  const className =
    CHARACTER_CLASSES[Math.floor(Math.random() * CHARACTER_CLASSES.length)];
  const hp = Math.floor(Math.random() * 9) + 8;
  const inventory =
    INVENTORY_SETS[Math.floor(Math.random() * INVENTORY_SETS.length)];

  return { className, hp, inventory };
}

export default function Home() {
  const { isLoaded, user } = useUser();
  const [fallbackName] = useState(() => createPlayerName());
  const playerName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    fallbackName;
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<Id<"participants"> | null>(
    null
  );
  const [roomInput, setRoomInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [aiStream, setAiStream] = useState("");
  const [aiStartedAt, setAiStartedAt] = useState<number | null>(null);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [className, setClassName] = useState("Fighter");
  const [hp, setHp] = useState(12);
  const [inventory, setInventory] = useState("Torch, rope, rations");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showDiceMenu, setShowDiceMenu] = useState(false);
  const [diceRoll, setDiceRoll] = useState<number | null>(null);
  const [diceStamp, setDiceStamp] = useState(0);
  const [hasGeneratedCharacter, setHasGeneratedCharacter] = useState(false);

  const createRoom = useMutation(api.rooms.createRoom);
  const joinRoom = useMutation(api.rooms.joinRoom);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const sendMessage = useMutation(api.messages.send);
  const createCharacter = useMutation(api.players.createCharacter);
  const upsertPlayer = useMutation(api.players.upsert);
  const setTurnMode = useMutation(api.rooms.setTurnMode);

  const participants = useQuery(
    api.rooms.listParticipants,
    roomCode ? { roomCode } : "skip"
  );

  const room = useQuery(
    api.rooms.getByCode,
    roomCode ? { roomCode } : "skip"
  );

  const playerSheet = useQuery(
    api.players.getMyCharacter,
    roomCode ? { roomCode } : "skip"
  );

  const party = useQuery(
    api.players.listByRoom,
    roomCode ? { roomCode } : "skip"
  );

  const messages = useQuery(
    api.messages.list,
    roomCode ? { roomCode } : "skip"
  );

  const participantCount = participants?.length ?? 0;
  const isLeader = room?.leaderName === playerName;
  const turnModeEnabled = room?.turnMode ?? false;

  const canSend = message.trim().length > 0 && !isBusy;
  const slashActive = message.trim().startsWith("/");

  useEffect(() => {
    if (!participantId) {
      return;
    }

    return () => {
      leaveRoom({ participantId }).catch(() => {
        // Ignore cleanup errors.
      });
    };
  }, [participantId, leaveRoom]);

  useEffect(() => {
    if (!playerSheet) {
      return;
    }

    setClassName(playerSheet.className);
    setHp(playerSheet.hp);
    setInventory(playerSheet.inventory);
    setHasGeneratedCharacter(true);
  }, [playerSheet]);

  useEffect(() => {
    setHasGeneratedCharacter(false);
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode || playerSheet || hasGeneratedCharacter) {
      return;
    }

    const generated = generateCharacter();
    setClassName(generated.className);
    setHp(generated.hp);
    setInventory(generated.inventory);
    setHasGeneratedCharacter(true);
  }, [roomCode, playerSheet, hasGeneratedCharacter]);

  useEffect(() => {
    if (!aiStartedAt || !messages?.length) {
      return;
    }

    const hasFinal = messages.some(
      (msg) =>
        msg.playerName === "Dungeon Master" && msg.createdAt >= aiStartedAt
    );

    if (hasFinal) {
      setAiStream("");
      setAiStartedAt(null);
      setIsAiStreaming(false);
    }
  }, [aiStartedAt, messages]);

  useEffect(() => {
    if (!slashActive) {
      setShowSlashMenu(false);
    }
  }, [slashActive]);

  const handleCreateRoom = async () => {
    setError(null);
    setIsBusy(true);

    try {
      const { code } = await createRoom({ leaderName: playerName });
      const joined = await joinRoom({ roomCode: code, playerName });
      setRoomCode(joined.roomCode);
      setParticipantId(joined.participantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomInput.trim()) {
      setError("Enter a room code.");
      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      const joined = await joinRoom({
        roomCode: roomInput,
        playerName
      });
      setRoomCode(joined.roomCode);
      setParticipantId(joined.participantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendMessage = async () => {
    if (!roomCode || !canSend) {
      return;
    }

    const rollCommand = parseRollCommand(message);
    if (rollCommand && "error" in rollCommand) {
      setError(rollCommand.error ?? "Invalid roll command.");
      return;
    }

    if (rollCommand && "result" in rollCommand) {
      await sendRoll(rollCommand.sides, rollCommand.result);
      return;
    }

    setError(null);
    setIsBusy(true);
    try {
      const sendResult = await sendMessage({
        roomCode,
        playerName,
        body: message
      });
      setMessage("");
      setShowSlashMenu(false);
      setShowDiceMenu(false);
      if (!turnModeEnabled) {
        triggerAiResponse(roomCode);
      }
      if (sendResult?.needsSummary) {
        triggerSummary(roomCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setIsBusy(false);
    }
  };

  const sendRoll = async (sides: number, result?: number) => {
    if (!roomCode) {
      return;
    }

    const rollResult = result ?? Math.floor(Math.random() * sides) + 1;
    setDiceRoll(rollResult);
    setDiceStamp(Date.now());

    setError(null);
    setIsBusy(true);
    try {
      const sendResult = await sendMessage({
        roomCode,
        playerName,
        body: `rolled d${sides}: ${rollResult}`,
        kind: "system"
      });
      setMessage("");
      setShowSlashMenu(false);
      setShowDiceMenu(false);
      if (!turnModeEnabled) {
        triggerAiResponse(roomCode);
      }
      if (sendResult?.needsSummary) {
        triggerSummary(roomCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to roll.");
    } finally {
      setIsBusy(false);
    }
  };

  const triggerAiResponse = async (roomCodeValue: string) => {
    if (playerName === "Dungeon Master") {
      return;
    }

    setIsAiStreaming(true);
    setAiStream("");
    const startedAt = Date.now();
    setAiStartedAt(startedAt);

    try {
      const response = await fetch("/api/dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ roomCode: roomCodeValue, playerName })
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to reach the Dungeon Master.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        setAiStream((prev) => prev + decoder.decode(value, { stream: true }));
      }
      setIsAiStreaming(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The Dungeon Master is silent."
      );
      setIsAiStreaming(false);
    }
  };

  const triggerSummary = async (roomCodeValue: string) => {
    try {
      await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ roomCode: roomCodeValue })
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update the summary."
      );
    }
  };

  const handleToggleTurnMode = async (enabled: boolean) => {
    if (!roomCode || !isLeader) {
      return;
    }

    setIsBusy(true);
    try {
      await setTurnMode({ roomCode, leaderName: playerName, enabled });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update Turn Mode."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleEndTurn = async () => {
    if (!roomCode || !isLeader || !turnModeEnabled) {
      return;
    }

    await triggerAiResponse(roomCode);
  };

  const handleCreateCharacter = async () => {
    if (!roomCode) {
      return;
    }

    setIsBusy(true);
    try {
      await createCharacter({
        roomCode,
        playerName,
        className,
        hp,
        inventory
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create character."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveCharacter = async () => {
    if (!roomCode) {
      return;
    }

    setIsBusy(true);
    try {
      await upsertPlayer({ roomCode, playerName, className, hp, inventory });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update character sheet."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRandomizeCharacter = () => {
    const generated = generateCharacter();
    setClassName(generated.className);
    setHp(generated.hp);
    setInventory(generated.inventory);
  };

  const handleSlashSelect = (command: string) => {
    setMessage(command);
    setShowSlashMenu(false);
    setShowDiceMenu(false);
  };

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat("en", { timeStyle: "short" }),
    []
  );

  if (!isLoaded) {
    return <main className="grid place-items-center">Loading...</main>;
  }

  return (
    <main>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <header className="grid">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="badge">Real-time Convex Chat</span>
              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl">
                Gather your party and start a room.
              </h1>
              <p className="muted mt-3 max-w-xl">
                Your player name is <strong>{playerName}</strong>. Create a lobby or
                join with a code to sync messages instantly.
              </p>
            </div>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </header>

      {error && (
        <div className="notice mt-6">
          {error}
        </div>
      )}

      {!roomCode ? (
        <section className="grid two mt-8">
          <div className="card">
            <h2 className="text-2xl">Lobby</h2>
            <p className="muted mt-2 mb-5">
              Spin up a fresh room and invite up to 3 more players.
            </p>
            <button type="button" onClick={handleCreateRoom} disabled={isBusy}>
              Create a room
            </button>
          </div>

          <div className="card">
            <h2 className="text-2xl">Join a room</h2>
            <p className="muted mt-2 mb-5">
              Paste the room code your host shared.
            </p>
            <div className="grid">
              <input
                placeholder="e.g. FJ2K8Q"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
              />
              <button
                type="button"
                onClick={handleJoinRoom}
                className="secondary"
                disabled={isBusy}
              >
                Join room
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid three mt-8">
          <aside className="card player-sidebar">
            <h3 className="text-xl">
              Player Cards
            </h3>
            <div className="player-card-list">
              {party?.map((member) => {
                const hpPercent = Math.max(0, Math.min(100, member.hp));
                return (
                  <div key={member._id} className="player-card">
                    <div className="player-avatar">
                      {getInitials(member.playerName)}
                    </div>
                    <div className="player-info">
                      <div className="player-name">{member.playerName}</div>
                      <div className="hp-bar">
                        <div
                          className={`hp-fill ${
                            hpPercent < 20 ? "danger" : ""
                          }`}
                          style={{ width: `${hpPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {!party?.length && (
                <div className="muted">
                  No character sheets yet. Add yours in Game State.
                </div>
              )}
            </div>
          </aside>

          <div className="card chat-window">
            <div>
              <h2 className="text-2xl">Room {roomCode}</h2>
              <p className="muted mt-2">
                Messages sync instantly for everyone in this room.
              </p>
            </div>

            <div className="message-list">
              {messages?.length ? (
                messages.map((msg) => (
                  <div key={msg._id} className="message-row mb-6">
                    <div
                      className={`message ${
                        msg.kind === "system"
                          ? "system"
                          : msg.playerName === "Dungeon Master"
                          ? "dm"
                          : "user"
                      }`}
                    >
                      <div className="message-avatar">
                        {getInitials(
                          msg.kind === "system" ? "System" : msg.playerName
                        )}
                      </div>
                      <div className="message-content">
                        <div className="message-header">
                          <span className="message-name">
                            {msg.kind === "system"
                              ? "System Event"
                              : msg.playerName}
                          </span>
                          <span className="message-time">
                            {timeFormatter.format(msg.createdAt)}
                          </span>
                        </div>
                        <div className="message-body">
                          {msg.kind === "system"
                            ? `${msg.playerName} ${msg.body}`
                            : msg.body}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="muted">No messages yet. Break the silence!</div>
              )}
              {roomCode && (isAiStreaming || aiStream) && (
                <div className="message-row mb-6">
                  <div className="message dm">
                    <div className="message-avatar">DM</div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-name">Dungeon Master</span>
                        <span className="message-time">streaming</span>
                      </div>
                      <div className="message-body">
                        {aiStream ||
                          "The Dungeon Master is plotting the next twist..."}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {diceRoll !== null && (
              <div
                key={diceStamp}
                className={`dice-tray ${
                  diceRoll === 20 ? "crit" : diceRoll === 1 ? "fail" : ""
                }`}
              >
                <div className="dice-number">{diceRoll}</div>
                <div className="dice-label">D20 Roll</div>
              </div>
            )}

            <form
              className="message-form composer mb-6"
              onSubmit={(event) => {
                event.preventDefault();
                handleSendMessage();
              }}
            >
              <div className="composer-inner">
                <div className="composer-input">
                  <textarea
                    placeholder="Share a move, strategy, or greeting..."
                    value={message}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setMessage(nextValue);
                      setShowSlashMenu(nextValue.trim().startsWith("/"));
                      setShowDiceMenu(false);
                    }}
                  />
                  {showSlashMenu && (
                    <div className="composer-menu">
                      <button
                        type="button"
                        onClick={() => handleSlashSelect("/roll d20")}
                      >
                        /roll <span className="muted">Roll a d20</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSlashSelect("/whisper ")}
                      >
                        /whisper <span className="muted">Private note</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSlashSelect("/inventory ")}
                      >
                        /inventory <span className="muted">List gear</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="composer-actions">
                  <button type="submit" disabled={!canSend}>
                    Send message
                  </button>
                  <div className="dice-wrap">
                    <button
                      type="button"
                      className="secondary"
                      aria-label="Quick roll"
                      onClick={() => setShowDiceMenu((prev) => !prev)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="M3.5 7.2 12 2.5l8.5 4.7v9.6L12 21.5 3.5 16.8V7.2Z" />
                        <path d="M12 2.5v9.8l8.5-5.1M12 12.3 3.5 7.2" />
                        <circle cx="12" cy="12.2" r="1.2" />
                      </svg>
                    </button>
                    {showDiceMenu && (
                      <div className="composer-menu dice-menu">
                        <button type="button" onClick={() => sendRoll(20)}>
                          Roll d20
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSlashSelect("/roll d20")}
                        >
                          Insert /roll
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="sidebar">
            <aside className="card">
              <h3 className="text-xl">
                Room status
              </h3>
              <div className="grid">
                <div>
                  <div className="muted text-sm">
                    Room code
                  </div>
                  <div className="room-code">{roomCode}</div>
                </div>
              <div>
                <div className="muted text-sm">
                  Players ({participantCount}/4)
                </div>
                <div className="players">
                  {participants?.map((participant) => (
                    <span key={participant._id} className="player-pill">
                      {participant.playerName}
                    </span>
                  ))}
                </div>
              </div>
              {room?.leaderName && (
                <div>
                  <div className="muted text-sm">
                    Party leader
                  </div>
                  <div className="player-pill">{room.leaderName}</div>
                </div>
              )}
            </div>
          </aside>

            <aside className="card">
              <h3 className="text-xl">
                Game State
              </h3>
              <div className="grid">
                <div>
                  <div className="muted text-sm">
                    Turn Mode
                  </div>
                  <div className="toggle-row mt-2">
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={turnModeEnabled}
                        disabled={!isLeader || isBusy}
                        onChange={(event) =>
                          handleToggleTurnMode(event.target.checked)
                        }
                      />
                      <span className="toggle-track" aria-hidden="true" />
                      <span className="toggle-label">
                        {turnModeEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={handleEndTurn}
                      disabled={!turnModeEnabled || !isLeader || isAiStreaming}
                    >
                      End Turn
                    </button>
                  </div>
                  {!isLeader && (
                    <div className="muted mt-2">
                      Only the party leader can toggle Turn Mode or end the
                      turn.
                    </div>
                  )}
                </div>

                <div>
                  <div className="muted text-sm">
                    Party roster
                  </div>
                  <div className="players">
                    {party?.map((member) => (
                      <span key={member._id} className="player-pill">
                        {member.playerName} · {member.className} · {member.hp} HP
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="muted text-sm">
                    Your character sheet
                  </div>
                  {!playerSheet ? (
                    <div className="grid mt-2">
                      <div className="muted text-sm">
                        Generated by the worldbuilder. Tweak if you like.
                      </div>
                      <input
                        value={className}
                        onChange={(event) => setClassName(event.target.value)}
                        placeholder="Class"
                      />
                      <input
                        type="number"
                        min={0}
                        value={hp}
                        onChange={(event) =>
                          setHp(Number(event.target.value || 0))
                        }
                        placeholder="HP"
                      />
                      <textarea
                        value={inventory}
                        onChange={(event) => setInventory(event.target.value)}
                        placeholder="Inventory"
                      />
                      <div className="grid">
                        <button
                          type="button"
                          onClick={handleCreateCharacter}
                          disabled={isBusy}
                        >
                          Create character
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={handleRandomizeCharacter}
                          disabled={isBusy}
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid mt-2">
                      <input
                        value={className}
                        onChange={(event) => setClassName(event.target.value)}
                        placeholder="Class"
                      />
                      <input
                        type="number"
                        min={0}
                        value={hp}
                        onChange={(event) =>
                          setHp(Number(event.target.value || 0))
                        }
                        placeholder="HP"
                      />
                      <textarea
                        value={inventory}
                        onChange={(event) => setInventory(event.target.value)}
                        placeholder="Inventory"
                      />
                      <button
                        type="button"
                        className="secondary"
                        onClick={handleSaveCharacter}
                        disabled={isBusy}
                      >
                        Save character
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}
      </SignedIn>
    </main>
  );
}
