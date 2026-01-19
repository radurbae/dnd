"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

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

export default function Home() {
  const [playerName] = useState(() => createPlayerName());
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

  const createRoom = useMutation(api.rooms.createRoom);
  const joinRoom = useMutation(api.rooms.joinRoom);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const sendMessage = useMutation(api.messages.send);
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
    api.players.getByRoomAndName,
    roomCode ? { roomCode, playerName } : "skip"
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
  }, [playerSheet]);

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
      await upsertPlayer({
        roomCode: joined.roomCode,
        playerName,
        className,
        hp,
        inventory
      });
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
      await upsertPlayer({
        roomCode: joined.roomCode,
        playerName,
        className,
        hp,
        inventory
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
      setError(rollCommand.error);
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

  const handleSaveCharacter = async () => {
    if (!roomCode) {
      return;
    }

    setIsBusy(true);
    try {
      await upsertPlayer({
        roomCode,
        playerName,
        className,
        hp,
        inventory
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update character sheet."
      );
    } finally {
      setIsBusy(false);
    }
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

  return (
    <main>
      <header className="grid">
        <div>
          <span className="badge">Real-time Convex Chat</span>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)", marginTop: 16 }}>
            Gather your party and start a room.
          </h1>
          <p className="muted" style={{ marginTop: 12, maxWidth: 560 }}>
            Your player name is <strong>{playerName}</strong>. Create a lobby or
            join with a code to sync messages instantly.
          </p>
        </div>
      </header>

      {error && (
        <div className="notice" style={{ marginTop: 24 }}>
          {error}
        </div>
      )}

      {!roomCode ? (
        <section className="grid two" style={{ marginTop: 32 }}>
          <div className="card">
            <h2 style={{ fontSize: "1.6rem", marginBottom: 8 }}>Lobby</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              Spin up a fresh room and invite up to 3 more players.
            </p>
            <button type="button" onClick={handleCreateRoom} disabled={isBusy}>
              Create a room
            </button>
          </div>

          <div className="card">
            <h2 style={{ fontSize: "1.6rem", marginBottom: 8 }}>Join a room</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              Paste the room code your host shared.
            </p>
            <div className="grid" style={{ gap: 12 }}>
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
        <section className="grid three" style={{ marginTop: 32 }}>
          <aside className="card player-sidebar">
            <h3 style={{ fontSize: "1.3rem", marginBottom: 12 }}>
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
              <h2 style={{ fontSize: "1.6rem" }}>Room {roomCode}</h2>
              <p className="muted" style={{ marginTop: 6 }}>
                Messages sync instantly for everyone in this room.
              </p>
            </div>

            <div className="message-list">
              {messages?.length ? (
                messages.map((msg) => (
                  <div key={msg._id} className="message-row">
                    <div
                      className={`message ${
                        msg.kind === "system"
                          ? "system"
                          : msg.playerName === "Dungeon Master"
                          ? "dm"
                          : "user"
                      }`}
                    >
                      <strong>
                        {msg.kind === "system"
                          ? "System Event"
                          : msg.playerName}{" "}
                        · {timeFormatter.format(msg.createdAt)}
                      </strong>
                      <div>
                        {msg.kind === "system"
                          ? `${msg.playerName} ${msg.body}`
                          : msg.body}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="muted">No messages yet. Break the silence!</div>
              )}
              {roomCode && (isAiStreaming || aiStream) && (
                <div className="message-row">
                  <div className="message dm">
                    <strong>Dungeon Master · streaming</strong>
                    <div>
                      {aiStream ||
                        "The Dungeon Master is plotting the next twist..."}
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
              className="message-form composer"
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
              <h3 style={{ fontSize: "1.3rem", marginBottom: 12 }}>
                Room status
              </h3>
              <div className="grid" style={{ gap: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    Room code
                  </div>
                  <div className="room-code">{roomCode}</div>
                </div>
              <div>
                <div className="muted" style={{ fontSize: "0.9rem" }}>
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
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    Party leader
                  </div>
                  <div className="player-pill">{room.leaderName}</div>
                </div>
              )}
            </div>
          </aside>

            <aside className="card">
              <h3 style={{ fontSize: "1.3rem", marginBottom: 12 }}>
                Game State
              </h3>
              <div className="grid" style={{ gap: 16 }}>
                <div>
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    Turn Mode
                  </div>
                  <div className="toggle-row" style={{ marginTop: 8 }}>
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
                    <div className="muted" style={{ marginTop: 6 }}>
                      Only the party leader can toggle Turn Mode or end the
                      turn.
                    </div>
                  )}
                </div>

                <div>
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
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
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    Your character sheet
                  </div>
                  <div className="grid" style={{ gap: 10, marginTop: 8 }}>
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
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}
