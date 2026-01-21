"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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

const CHARACTER_RACES = [
  "Human",
  "Elf",
  "Dwarf",
  "Halfling",
  "Tiefling",
  "Dragonborn"
];

const EQUIPMENT_SETS = [
  [
    { name: "Torch", type: "tool", quantity: 2 },
    { name: "Rope", type: "tool", quantity: 1 },
    { name: "Rations", type: "supply", quantity: 3 }
  ],
  [
    { name: "Herbal kit", type: "tool", quantity: 1 },
    { name: "Compass", type: "tool", quantity: 1 },
    { name: "Bedroll", type: "supply", quantity: 1 }
  ],
  [
    { name: "Throwing knives", type: "weapon", quantity: 3 },
    { name: "Lockpicks", type: "tool", quantity: 1 },
    { name: "Smoke bomb", type: "gear", quantity: 1 }
  ],
  [
    { name: "Spellbook", type: "focus", quantity: 1 },
    { name: "Ink", type: "supply", quantity: 1 },
    { name: "Crystal focus", type: "focus", quantity: 1 }
  ],
  [
    { name: "Shield", type: "armor", quantity: 1 },
    { name: "Whetstone", type: "tool", quantity: 1 },
    { name: "Traveler's cloak", type: "gear", quantity: 1 }
  ],
  [
    { name: "Map case", type: "tool", quantity: 1 },
    { name: "Chalk", type: "tool", quantity: 2 },
    { name: "Grappling hook", type: "gear", quantity: 1 }
  ]
];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_TOTAL = 27;
const STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA"
};

const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
};

const CLASS_MINIMUMS: Record<
  string,
  (stats: Record<(typeof STAT_KEYS)[number], number>) => string | null
> = {
  Wizard: (stats) =>
    stats.int >= 13 ? null : "Your magic is too weak! Increase INT to 13.",
  Fighter: (stats) =>
    stats.str >= 13 || stats.dex >= 13
      ? null
      : "Fighters need 13+ STR or DEX.",
  Rogue: (stats) =>
    stats.dex >= 13 ? null : "Rogues need 13+ DEX."
};

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

const DAMAGE_TAG_REGEX = /\[\[DAMAGE:\s*([^\]]+?)\s+(\d+)\]\]/g;

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
  const race = CHARACTER_RACES[Math.floor(Math.random() * CHARACTER_RACES.length)];
  const hp = Math.floor(Math.random() * 9) + 8;
  const equipment =
    EQUIPMENT_SETS[Math.floor(Math.random() * EQUIPMENT_SETS.length)];
  const stats = [...STANDARD_ARRAY].sort(() => Math.random() - 0.5);
  const [str, dex, con, int, wis, cha] = stats;

  return {
    className,
    race,
    hp,
    equipment,
    stats: { str, dex, con, int, wis, cha }
  };
}

function statCost(score: number) {
  return POINT_BUY_COST[score] ?? Infinity;
}

function clampStat(score: number) {
  return Math.min(15, Math.max(8, score));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function Home() {
  const { isLoaded, user } = useUser();
  const searchParams = useSearchParams();
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
  const [race, setRace] = useState("Human");
  const [hp, setHp] = useState(12);
  const [stats, setStats] = useState({
    str: 8,
    dex: 8,
    con: 8,
    int: 8,
    wis: 8,
    cha: 8
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [backstory, setBackstory] = useState("");
  const [equipment, setEquipment] = useState<
    Array<{ name: string; type: string; quantity: number }>
  >([]);
  const [statusNote, setStatusNote] = useState("Ready");
  const [characterStep, setCharacterStep] = useState(1);
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [detailsLocked, setDetailsLocked] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [hasGeneratedCharacter, setHasGeneratedCharacter] = useState(false);
  type PendingMessage = {
    _id: string;
    body: string;
    playerName: string;
    createdAt: number;
    kind: "chat";
  };

  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const leftPanelRef = useRef<any>(null);
  const rightPanelRef = useRef<any>(null);
  const processedDamageRef = useRef<Set<string>>(new Set());

  const createRoom = useMutation(api.rooms.createRoom);
  const joinRoom = useMutation(api.rooms.joinRoom);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const sendMessage = useMutation(api.messages.send);
  const createCharacter = useMutation(api.players.createCharacter);
  const upsertPlayer = useMutation(api.players.upsert);
  const applyDamage = useMutation(api.players.applyDamageByName);
  const startAdventure = useMutation(api.rooms.startAdventure);
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
  const dmActive = room?.dmActive ?? false;
  const readyMap = useMemo(() => {
    const map = new Map<string, string>();
    party?.forEach((member) => {
      map.set(member.playerName, member.status ?? "Ready");
    });
    return map;
  }, [party]);
  const readyCount =
    participants?.filter((member) => readyMap.has(member.playerName)).length ?? 0;
  const pointsUsed = useMemo(
    () =>
      STAT_KEYS.reduce((sum, key) => sum + statCost(stats[key]), 0),
    [stats]
  );
  const pointsRemaining = POINT_BUY_TOTAL - pointsUsed;
  const classWarning = useMemo(() => {
    const validator = CLASS_MINIMUMS[className];
    return validator ? validator(stats) : null;
  }, [className, stats]);

  const inputLocked = isBusy || dmActive;
  const canSend = message.trim().length > 0 && !inputLocked;
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
    setRace(playerSheet.race ?? "Human");
    setHp(playerSheet.hp);
    setStats(
      playerSheet.stats ?? {
        str: 8,
        dex: 8,
        con: 8,
        int: 8,
        wis: 8,
        cha: 8
      }
    );
    setSkills(playerSheet.skills ?? []);
    setBackstory(playerSheet.backstory ?? "");
    setEquipment(playerSheet.equipment ?? []);
    setStatusNote(playerSheet.status ?? "Ready");
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
    setRace(generated.race);
    setHp(generated.hp);
    setEquipment(generated.equipment);
    setStats(generated.stats);
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
    if (!messages?.length || !roomCode) {
      return;
    }

    const pending = messages.filter(
      (msg) =>
        msg.playerName === "Dungeon Master" &&
        !processedDamageRef.current.has(msg._id)
    );

    if (!pending.length) {
      return;
    }

    pending.forEach((msg) => {
      const matches = Array.from(msg.body.matchAll(DAMAGE_TAG_REGEX));
      matches.forEach((match) => {
        const name = match[1]?.trim();
        const amount = Number(match[2]);
        if (!name || Number.isNaN(amount)) {
          return;
        }
        applyDamage({ roomCode, playerName: name, amount }).catch(() => {
          // Ignore damage sync errors.
        });
      });
      processedDamageRef.current.add(msg._id);
    });
  }, [applyDamage, messages, roomCode]);

  useEffect(() => {
    if (!messages?.length || pendingMessages.length === 0) {
      return;
    }

    setPendingMessages((current) =>
      current.filter(
        (pending) =>
          !messages.some(
            (msg) =>
              msg.playerName === pending.playerName &&
              msg.body === pending.body &&
              Math.abs(msg.createdAt - pending.createdAt) < 10000
          )
      )
    );
  }, [messages, pendingMessages.length]);

  useEffect(() => {
    if (!slashActive) {
      setShowSlashMenu(false);
    }
  }, [slashActive]);

  useEffect(() => {
    const roomParam = searchParams.get("room");
    if (!roomParam || roomCode || autoJoinAttempted) {
      return;
    }

    setAutoJoinAttempted(true);
    setIsBusy(true);
    joinRoom({ roomCode: roomParam, playerName })
      .then((joined) => {
        setRoomCode(joined.roomCode);
        setParticipantId(joined.participantId);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to join campaign."
        );
      })
      .finally(() => {
        setIsBusy(false);
      });
  }, [autoJoinAttempted, joinRoom, playerName, roomCode, searchParams]);

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
      const optimisticId = `pending-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
      const optimisticMessage: PendingMessage = {
        _id: optimisticId,
        body: message,
        playerName,
        createdAt: Date.now(),
        kind: "chat"
      };
      setPendingMessages((current) => [...current, optimisticMessage]);
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
        race,
        stats,
        status: statusNote,
        className,
        hp,
        skills,
        backstory,
        equipment
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
      await upsertPlayer({
        roomCode,
        playerName,
        race,
        stats,
        status: statusNote,
        className,
        hp,
        skills,
        backstory,
        equipment
      });
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
    setRace(generated.race);
    setHp(generated.hp);
    setEquipment(generated.equipment);
    setStats(generated.stats);
    setSkills([]);
    setBackstory("");
    setDetailsLocked(false);
  };

  const handleStartAdventure = async () => {
    if (!roomCode) {
      return;
    }
    setIsBusy(true);
    try {
      await startAdventure({ roomCode, leaderName: playerName });
      triggerAiResponse(roomCode);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start adventure."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateDetails = async () => {
    if (!roomCode) {
      setError("Join a room before generating details.");
      return;
    }

    if (backstory.trim()) {
      const confirmed = window.confirm(
        "This will replace your current backstory and items. Are you sure?"
      );
      if (!confirmed) {
        return;
      }
    }

    setError(null);
    setIsGeneratingDetails(true);
    try {
      const response = await fetch("/api/character-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          className,
          race
        })
      });
      if (!response.ok) {
        throw new Error("Detail generation failed.");
      }
      const data = (await response.json()) as {
        backstory: string;
        skills: string[];
        equipment: Array<{ name: string; type: string; quantity: number }>;
      };

      setBackstory(data.backstory ?? "");
      setSkills(Array.isArray(data.skills) ? data.skills : []);
      setEquipment(Array.isArray(data.equipment) ? data.equipment : []);
      setDetailsLocked(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate details."
      );
    } finally {
      setIsGeneratingDetails(false);
    }
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

  const stripDamageTags = (text: string) =>
    text.replace(DAMAGE_TAG_REGEX, "").trim();

  const visibleMessages = useMemo(() => {
    if (!messages?.length) {
      return pendingMessages;
    }
    if (!pendingMessages.length) {
      return messages;
    }
    return [...messages, ...pendingMessages];
  }, [messages, pendingMessages]);

  useEffect(() => {
    const isCollapsed = leftPanelRef.current?.isCollapsed?.() ?? false;
    setLeftCollapsed(isCollapsed);
  }, []);

  useEffect(() => {
    const isCollapsed = rightPanelRef.current?.isCollapsed?.() ?? false;
    setRightCollapsed(isCollapsed);
  }, []);

  const renderCharacterWizard = () => {
    if (!roomCode) {
      return null;
    }

    return (
      <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-8">
        <div className="text-xs uppercase text-zinc-500">Character Setup</div>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-100">
          Shape your hero
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Complete the ritual before the adventure begins.
        </p>

        <div className="mt-8 space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          {characterStep === 1 && (
            <div className="space-y-4">
              <div className="text-xs uppercase text-zinc-500">
                Step 1 · Class, Race & Stats
              </div>
              <div className="grid gap-4">
                <label className="text-sm text-zinc-400">
                  Class
                  <select
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100"
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                  >
                    {CHARACTER_CLASSES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-zinc-400">
                  Race
                  <select
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100"
                    value={race}
                    onChange={(event) => setRace(event.target.value)}
                  >
                    {CHARACTER_RACES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between text-xs uppercase text-zinc-500">
                  <span>Point Buy</span>
                  <span>{pointsRemaining} points remaining</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-zinc-300">
                  {STAT_KEYS.map((key) => {
                    const score = stats[key];
                    const canIncrease =
                      score < 15 &&
                      statCost(score + 1) - statCost(score) <= pointsRemaining;
                    const canDecrease = score > 8;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span>{STAT_LABELS[key]}</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-zinc-800 text-zinc-200 disabled:opacity-40"
                            onClick={() =>
                              setStats((current) => ({
                                ...current,
                                [key]: clampStat(current[key] - 1)
                              }))
                            }
                            disabled={!canDecrease}
                          >
                            -
                          </button>
                          <span className="w-6 text-center">{score}</span>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-zinc-800 text-zinc-200 disabled:opacity-40"
                            onClick={() =>
                              setStats((current) => ({
                                ...current,
                                [key]: clampStat(current[key] + 1)
                              }))
                            }
                            disabled={!canIncrease}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {pointsRemaining !== 0 && (
                  <div className="mt-3 text-xs text-rose-400">
                    {pointsRemaining > 0
                      ? "Spend all 27 points to continue."
                      : "Too many points spent. Reduce a stat."}
                  </div>
                )}
                {classWarning && (
                  <div className="mt-2 text-xs text-rose-400">
                    {classWarning}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setCharacterStep(2)}
                  disabled={pointsRemaining !== 0 || Boolean(classWarning)}
                >
                  Next
                </Button>
                <Button variant="ghost" onClick={handleRandomizeCharacter}>
                  Randomize
                </Button>
              </div>
            </div>
          )}

          {characterStep === 2 && (
            <div className="space-y-4">
              <div className="text-xs uppercase text-zinc-500">
                Step 2 · Story & Gear
              </div>
              <label className="text-sm text-zinc-400">
                Backstory
                <textarea
                  className="mt-2 min-h-[120px]"
                  placeholder="A short hook..."
                  value={backstory}
                  onChange={(event) => setBackstory(event.target.value)}
                />
              </label>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleGenerateDetails}
                  disabled={isGeneratingDetails}
                >
                  Generate Details
                </Button>
                {detailsLocked && (
                  <span className="text-xs text-zinc-500">
                    Locked after generation.
                  </span>
                )}
                {isGeneratingDetails && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="h-4 w-4 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
                    Generating...
                  </div>
                )}
              </div>
              <div className="grid gap-4">
                <div>
                  <div className="text-xs uppercase text-zinc-500">Skills</div>
                  <div className="mt-2 grid gap-2">
                    {skills.map((skill, index) => (
                      <input
                        key={`${skill}-${index}`}
                        value={skill}
                        onChange={(event) => {
                          const next = [...skills];
                          next[index] = event.target.value;
                          setSkills(next);
                        }}
                        placeholder="Skill"
                        disabled={detailsLocked}
                      />
                    ))}
                    <Button
                      variant="ghost"
                      onClick={() => setSkills((current) => [...current, ""])}
                      disabled={detailsLocked}
                    >
                      Add skill
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-zinc-500">
                    Equipment
                  </div>
                  <div className="mt-2 grid gap-3">
                    {equipment.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="grid gap-2 md:grid-cols-[2fr_1fr_90px]"
                      >
                        <input
                          value={item.name}
                          onChange={(event) => {
                            const next = [...equipment];
                            next[index] = {
                              ...next[index],
                              name: event.target.value
                            };
                            setEquipment(next);
                          }}
                          placeholder="Item name"
                          disabled={detailsLocked}
                        />
                        <input
                          value={item.type}
                          onChange={(event) => {
                            const next = [...equipment];
                            next[index] = {
                              ...next[index],
                              type: event.target.value
                            };
                            setEquipment(next);
                          }}
                          placeholder="Type"
                          disabled={detailsLocked}
                        />
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => {
                            const next = [...equipment];
                            next[index] = {
                              ...next[index],
                              quantity: Math.max(
                                1,
                                Number(event.target.value || 1)
                              )
                            };
                            setEquipment(next);
                          }}
                          placeholder="Qty"
                          disabled={detailsLocked}
                        />
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setEquipment((current) => [
                          ...current,
                          { name: "", type: "", quantity: 1 }
                        ])
                      }
                      disabled={detailsLocked}
                    >
                      Add equipment
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setCharacterStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setCharacterStep(3)}>Next</Button>
              </div>
            </div>
          )}

          {characterStep === 3 && (
            <div className="space-y-4">
              <div className="text-xs uppercase text-zinc-500">
                Step 3 · Ready Up
              </div>
              <input
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
                placeholder="Status (e.g. Ready)"
              />
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setCharacterStep(2)}>
                  Back
                </Button>
                <Button onClick={handleCreateCharacter} disabled={isBusy}>
                  Ready Up
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

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
          ) : !playerSheet ? (
            renderCharacterWizard()
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
                            <div className="text-xs uppercase text-zinc-500">
                              Race
                            </div>
                            <div className="text-sm text-zinc-200">{race}</div>
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
                              {STAT_KEYS.map((key) => (
                                <div
                                  key={key}
                                  className="flex items-center justify-between"
                                >
                                  <span>{STAT_LABELS[key]}</span>
                                  <span>{stats[key]}</span>
                                </div>
                              ))}
                            </div>
                            {skills.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs uppercase text-zinc-500">
                                  Skills
                                </div>
                                <div className="text-xs text-zinc-400">
                                  {skills.join(", ")}
                                </div>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Button
                                variant="ghost"
                                onClick={handleSaveCharacter}
                                disabled={isBusy}
                              >
                                Save character
                              </Button>
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
                          {equipment.length ? (
                            <ul className="space-y-2 text-sm text-zinc-400">
                              {equipment.map((item, index) => (
                                <li key={`${item.name}-${index}`}>
                                  {item.name || "Unnamed item"} · {item.type || "gear"}{" "}
                                  ×{item.quantity}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-sm text-zinc-500">
                              No equipment yet.
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel defaultSize={60} minSize={40} className="bg-zinc-950">
                <div className="relative flex h-full flex-col">
                  {(leftCollapsed || rightCollapsed) && (
                    <div className="pointer-events-none absolute left-0 right-0 top-3 z-20 flex items-center justify-between px-4">
                      <div className="flex-1">
                        {leftCollapsed && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              leftPanelRef.current?.expand?.();
                              setLeftCollapsed(false);
                            }}
                            className="pointer-events-auto rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-200 shadow-lg shadow-black/40"
                            aria-label="Open left panel"
                          >
                            <Menu className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex-1 text-right">
                        {rightCollapsed && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              rightPanelRef.current?.expand?.();
                              setRightCollapsed(false);
                            }}
                            className="pointer-events-auto rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-200 shadow-lg shadow-black/40"
                            aria-label="Open right panel"
                          >
                            <Menu className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
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
                  {(room?.status ?? "lobby") === "lobby" && (
                    <div className="border-b border-zinc-900 px-6 py-4 text-sm text-zinc-400">
                      Waiting in the lobby. OOC chat is open.{" "}
                      {isLeader
                        ? "Start the adventure when everyone is ready."
                        : "Await the host to start the adventure."}
                      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-xs text-zinc-400">
                        <div className="flex items-center justify-between text-[11px] uppercase text-zinc-500">
                          <span>Party readiness</span>
                          <span>
                            {readyCount}/{participantCount} ready
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {participants?.map((member) => {
                            const status =
                              readyMap.get(member.playerName) ??
                              "Creating character";
                            return (
                              <div
                                key={member._id}
                                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                              >
                                <div className="text-sm text-zinc-200">
                                  {member.playerName}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  {status}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {isLeader && (
                        <div className="mt-3">
                          <Button onClick={handleStartAdventure} disabled={isBusy}>
                            Start Adventure
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <ScrollArea className="flex-1 px-6 pb-32">
                    <div className="mx-auto w-full max-w-3xl py-8">
                      {error && (
                        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-rose-300">
                          {error}
                        </div>
                      )}
                      {visibleMessages.length ? (
                        visibleMessages.map((msg) => {
                          const isSystem = msg.kind === "system";
                          const isDm = msg.playerName === "Dungeon Master";
                          const isPending =
                            typeof msg._id === "string" &&
                            msg._id.startsWith("pending-");
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
                                      {stripDamageTags(msg.body)}
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
                                    <div
                                      className={`prose prose-invert prose-zinc mt-2 max-w-none text-zinc-300 ${
                                        isPending ? "opacity-60" : ""
                                      }`}
                                    >
                                      {renderWithMentions(stripDamageTags(msg.body))}
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
                      {roomCode && (dmActive || isAiStreaming || aiStream) && (
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
                          className="text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => sendRoll(20)}
                          disabled={inputLocked}
                          aria-label="Quick roll"
                        >
                          <Dice6 className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          className="text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={inputLocked}
                          aria-label="Upload"
                        >
                          <Upload className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="flex-1">
                        <textarea
                          className="min-h-[44px] w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder={
                            dmActive
                              ? "The Dungeon Master is plotting..."
                              : "Write a message..."
                          }
                          value={message}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setMessage(nextValue);
                            setShowSlashMenu(nextValue.trim().startsWith("/"));
                          }}
                          disabled={inputLocked}
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
                              turnModeEnabled && member.status === "Active";
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
