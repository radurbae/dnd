"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useUser
} from "@clerk/nextjs";
import {
  ArrowUp,
  Backpack,
  Dice6,
  Menu,
  ScrollText,
  Upload,
  Users
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../components/ui/hover-card";
import { Button } from "../../components/ui/button";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from "../../components/ui/resizable";
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
  "Shield, whetstone, traveler's cloak",
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [hasGeneratedCharacter, setHasGeneratedCharacter] = useState(false);
  const leftPanelRef = useRef<any>(null);
  const rightPanelRef = useRef<any>(null);

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
  };

  const partyLookup = useMemo(() => {
    const lookup = new Map<
      string,
      { playerName: string; className: string; hp: number }
    >();
    party?.forEach((member) => {
      lookup.set(member.playerName.toLowerCase(), member);
    });
    return lookup;
  }, [party]);

  const mentionRegex = useMemo(() => {
    if (!party?.length) {
      return null;
    }
    const names = [...party]
      .map((member) => member.playerName)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex);
    if (!names.length) {
      return null;
    }
    return new RegExp(`(${names.join("|")})`, "gi");
  }, [party]);

  const renderWithMentions = (text: string) => {
    if (!mentionRegex) {
      return text;
    }
    const parts = text.split(mentionRegex);
    return parts.map((part, index) => {
      const key = `${part}-${index}`;
      if (!part) {
        return null;
      }
      const member = partyLookup.get(part.toLowerCase());
      if (!member) {
        return part;
      }
      const status = member.hp <= 3 ? "Wounded" : "Ready";
      return (
        <HoverCard key={key}>
          <HoverCardTrigger className="cursor-help border-b border-zinc-600/60 text-zinc-100">
            {part}
          </HoverCardTrigger>
          <HoverCardContent>
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-100">
                {member.playerName}
              </div>
              <div className="text-xs text-zinc-400">
                Class: {member.className}
              </div>
              <div className="text-xs text-zinc-400">HP: {member.hp}</div>
              <div className="text-xs text-zinc-400">Status: {status}</div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    });
  };

  const renderMarkdownWithMentions = (children: React.ReactNode) => {
    return React.Children.map(children, (child) => {
      if (typeof child === "string") {
        return renderWithMentions(child);
      }
      return child;
    });
  };

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat("en", { timeStyle: "short" }),
    []
  );

  useEffect(() => {
    const isCollapsed = leftPanelRef.current?.isCollapsed?.() ?? false;
    setLeftCollapsed(isCollapsed);
  }, []);

  useEffect(() => {
    const isCollapsed = rightPanelRef.current?.isCollapsed?.() ?? false;
    setRightCollapsed(isCollapsed);
  }, []);

  if (!isLoaded) {
    return <main className="grid place-items-center">Loading...</main>;
  }

  return (
    <main>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="h-screen w-full">
          {!roomCode ? (
            <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-12">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-zinc-500">Lobby</div>
                  <div className="text-lg font-medium text-zinc-100">
                    Dungeon Chronicle
                  </div>
                </div>
                <UserButton afterSignOutUrl="/sign-in" />
              </div>

              {error && (
                <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <section className="space-y-6">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
                  <h2 className="text-lg font-medium text-zinc-100">Lobby</h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Start a room and invite your party.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={handleCreateRoom}
                    disabled={isBusy}
                  >
                    Create a room
                  </Button>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
                  <h2 className="text-lg font-medium text-zinc-100">Join</h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Enter a room code to connect.
                  </p>
                  <div className="mt-4 space-y-3">
                    <input
                      placeholder="e.g. FJ2K8Q"
                      value={roomInput}
                      onChange={(event) => setRoomInput(event.target.value)}
                    />
                    <Button
                      variant="ghost"
                      onClick={handleJoinRoom}
                      disabled={isBusy}
                    >
                      Join room
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <ResizablePanelGroup orientation="horizontal" className="h-full">
              <ResizablePanel
                panelRef={leftPanelRef}
                defaultSize={20}
                minSize={8}
                collapsible
                collapsedSize={4}
                className="bg-zinc-900/50"
              >
                <div className="flex h-full flex-col border-r border-zinc-900">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-xs uppercase text-zinc-500">
                      The Soul
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        leftPanelRef.current?.collapse?.();
                        setLeftCollapsed(true);
                      }}
                      className="text-zinc-500"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </div>
                  {leftCollapsed ? (
                    <div className="flex flex-1 flex-col items-center gap-4 px-2 pt-8 text-zinc-500">
                      <button
                        type="button"
                        onClick={() => {
                          leftPanelRef.current?.expand?.();
                          setLeftCollapsed(false);
                        }}
                        className="rounded-full border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-200"
                      >
                        <Menu className="h-4 w-4" />
                      </button>
                      <ScrollText className="h-4 w-4" />
                      <Backpack className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex-1 px-4 pb-6">
                      <Tabs defaultValue="stats">
                        <TabsList className="border-0 bg-transparent">
                          <TabsTrigger value="stats">Stats</TabsTrigger>
                          <TabsTrigger value="backpack">Backpack</TabsTrigger>
                        </TabsList>
                        <TabsContent value="stats">
                          <div className="space-y-4 text-sm text-zinc-400">
                            <div className="text-xs uppercase text-zinc-500">
                              Class
                            </div>
                            <div className="text-sm text-zinc-200">
                              {className}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs uppercase">
                                <span>HP</span>
                                <span>{hp}</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-zinc-800">
                                <div
                                  className="h-2 rounded-full bg-zinc-500"
                                  style={{
                                    width: `${Math.min(100, (hp / 20) * 100)}%`
                                  }}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span>STR</span>
                                <span>12</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>DEX</span>
                                <span>11</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>INT</span>
                                <span>14</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {!playerSheet ? (
                                <Button
                                  variant="ghost"
                                  onClick={handleCreateCharacter}
                                  disabled={isBusy}
                                >
                                  Create character
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  onClick={handleSaveCharacter}
                                  disabled={isBusy}
                                >
                                  Save character
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                onClick={handleRandomizeCharacter}
                                disabled={isBusy}
                              >
                                Regenerate
                              </Button>
                            </div>
                          </div>
                        </TabsContent>
                        <TabsContent value="backpack">
                          <ul className="space-y-2 text-sm text-zinc-400">
                            {inventory.split(",").map((item) => (
                              <li key={item.trim()}>{item.trim()}</li>
                            ))}
                          </ul>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel defaultSize={60} minSize={40} className="bg-zinc-950">
                <div className="relative flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-3">
                    <div>
                      <div className="text-xs uppercase text-zinc-500">
                        {room?.summary ? "Campaign" : "Untitled Campaign"}
                      </div>
                      <div className="text-base text-zinc-100">
                        {room?.summary ? "The Oathbound" : "The Vision"}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {turnModeEnabled ? "Turn Mode" : "Free Play"}
                    </div>
                  </div>

                  <ScrollArea className="flex-1 px-6">
                    <div className="mx-auto w-full max-w-3xl py-8">
                      {error && (
                        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-rose-300">
                          {error}
                        </div>
                      )}
                      {messages?.length ? (
                        messages.map((msg) => {
                          const isSystem = msg.kind === "system";
                          const isDm = msg.playerName === "Dungeon Master";
                          const rollMatch = isSystem
                            ? msg.body.match(/rolled\s+d\d+:\s*(\d+)/i)
                            : null;
                          return (
                            <div key={msg._id} className="mb-6">
                              {isSystem ? (
                                <div className="text-xs text-zinc-500">
                                  {rollMatch ? (
                                    <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                                      [Roll: {rollMatch[1]}]
                                    </span>
                                  ) : (
                                    msg.body
                                  )}
                                </div>
                              ) : isDm ? (
                                <div className="border-l-2 border-zinc-700 bg-gradient-to-r from-zinc-800/40 to-transparent pl-4">
                                  <div className="text-xs uppercase text-zinc-500">
                                    Dungeon Master · {timeFormatter.format(msg.createdAt)}
                                  </div>
                                  <div className="prose prose-invert prose-zinc mt-2 max-w-none text-zinc-200">
                                    <ReactMarkdown
                                      components={{
                                        h3: ({ children }) => (
                                          <h3 className="text-base font-semibold text-zinc-100">
                                            {renderMarkdownWithMentions(children)}
                                          </h3>
                                        ),
                                        p: ({ children }) => (
                                          <p>{renderMarkdownWithMentions(children)}</p>
                                        ),
                                        li: ({ children }) => (
                                          <li>{renderMarkdownWithMentions(children)}</li>
                                        )
                                      }}
                                    >
                                      {msg.body}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-4">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-xs font-medium text-zinc-200 ring-1 ring-zinc-800">
                                    {getInitials(msg.playerName)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-sm text-zinc-100">
                                      {msg.playerName}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                      {timeFormatter.format(msg.createdAt)}
                                    </div>
                                    <div className="prose prose-invert prose-zinc mt-2 max-w-none text-zinc-300">
                                      {renderWithMentions(msg.body)}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-sm text-zinc-500">
                          No messages yet.
                        </div>
                      )}
                      {roomCode && (isAiStreaming || aiStream) && (
                        <div className="mb-6 border-l-2 border-zinc-700 bg-gradient-to-r from-zinc-800/40 to-transparent pl-4">
                          <div className="text-xs uppercase text-zinc-500">
                            Dungeon Master · streaming
                          </div>
                          <div className="prose prose-invert prose-zinc mt-2 max-w-none text-zinc-200">
                            {aiStream ||
                              "The Dungeon Master is plotting the next twist..."}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <form
                    className="absolute inset-x-0 bottom-6 mx-auto w-full max-w-3xl px-6"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSendMessage();
                    }}
                  >
                    <div className="flex items-end gap-3 rounded-3xl border border-zinc-800 bg-zinc-900 px-4 py-3 shadow-lg shadow-black/40 focus-within:ring-1 focus-within:ring-white/20">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-zinc-500 transition hover:text-zinc-200"
                          onClick={() => sendRoll(20)}
                          aria-label="Quick roll"
                        >
                          <Dice6 className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          className="text-zinc-500 transition hover:text-zinc-200"
                          aria-label="Upload"
                        >
                          <Upload className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="flex-1">
                        <textarea
                          className="min-h-[44px] w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                          placeholder="Write a message..."
                          value={message}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setMessage(nextValue);
                            setShowSlashMenu(nextValue.trim().startsWith("/"));
                          }}
                        />
                        {showSlashMenu && (
                          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2 text-sm text-zinc-300">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-zinc-800/70"
                              onClick={() => handleSlashSelect("/roll d20")}
                            >
                              /roll <span className="text-xs text-zinc-500">Roll a d20</span>
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-zinc-800/70"
                              onClick={() => handleSlashSelect("/whisper ")}
                            >
                              /whisper <span className="text-xs text-zinc-500">Private note</span>
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-zinc-800/70"
                              onClick={() => handleSlashSelect("/inventory ")}
                            >
                              /inventory <span className="text-xs text-zinc-500">List gear</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={!canSend}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-zinc-900 disabled:opacity-50"
                        aria-label="Send"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                </div>
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel
                panelRef={rightPanelRef}
                defaultSize={20}
                minSize={8}
                collapsible
                collapsedSize={4}
                className="bg-zinc-900/50"
              >
                <div className="flex h-full flex-col border-l border-zinc-900">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-xs uppercase text-zinc-500">
                      The World
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        rightPanelRef.current?.collapse?.();
                        setRightCollapsed(true);
                      }}
                      className="text-zinc-500"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </div>
                  {rightCollapsed ? (
                    <div className="flex flex-1 flex-col items-center gap-4 px-2 pt-8 text-zinc-500">
                      <button
                        type="button"
                        onClick={() => {
                          rightPanelRef.current?.expand?.();
                          setRightCollapsed(false);
                        }}
                        className="rounded-full border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-200"
                      >
                        <Menu className="h-4 w-4" />
                      </button>
                      <Users className="h-4 w-4" />
                      <ScrollText className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col gap-6 px-4 pb-6">
                      <div>
                        <div className="text-xs uppercase text-zinc-500">
                          Party list
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {party?.map((member) => {
                            const isActive =
                              turnModeEnabled && member.playerName === room?.leaderName;
                            return (
                              <div
                                key={member._id}
                                className={`flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-zinc-200 ring-1 ring-zinc-800 ${
                                  isActive ? "ring-emerald-500" : ""
                                }`}
                              >
                                {getInitials(member.playerName)}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase text-zinc-500">
                          Room info
                        </div>
                        <div className="mt-3 text-sm text-zinc-400">
                          Dungeon Entrance. Lantern light flickers against wet stone.
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="text-xs uppercase text-zinc-500">
                          System log
                        </div>
                        <ScrollArea className="mt-3 h-40 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2">
                          <div className="space-y-2 text-xs text-zinc-400">
                            {messages
                              ?.filter((msg) => msg.kind === "system")
                              .slice(-12)
                              .map((msg) => (
                                <div key={msg._id}>{msg.body}</div>
                              )) || <div>No rolls yet.</div>}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
      </SignedIn>
    </main>
  );
}
