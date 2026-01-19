import { ConvexHttpClient } from "convex/node";
import { summarizeRoom } from "../../lib/summarize";

function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    ""
  );
}

export async function POST(request: Request) {
  const { roomCode } = (await request.json()) as { roomCode?: string };

  if (!roomCode) {
    return new Response("Missing roomCode", { status: 400 });
  }

  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    return new Response("Missing CONVEX_URL", { status: 500 });
  }

  const convex = new ConvexHttpClient(convexUrl);
  await summarizeRoom(convex, roomCode);

  return new Response(null, { status: 204 });
}
