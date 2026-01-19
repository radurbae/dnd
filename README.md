# Convex Real-Time Chat

A real-time lobby + room chat built with Next.js and Convex.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Convex project and run the dev server:
   ```bash
   npx convex dev
   ```
3. Set the Convex URL in your environment:
   ```bash
   cp .env.local.example .env.local
   # Add NEXT_PUBLIC_CONVEX_URL and CONVEX_URL from the Convex dashboard
   # Add OPENAI_API_KEY for the Dungeon Master responses
   ```
4. Start Next.js:
   ```bash
   npm run dev
   ```

## Deployment notes (Vercel)

- Set `CONVEX_URL`, `NEXT_PUBLIC_CONVEX_URL`, and `OPENAI_API_KEY` in Vercel
  environment variables.
- The build runs `npx convex codegen` before `next build` to generate
  `convex/_generated/*`.

## Notes

- Room size is capped at 4 players.
- Player names are randomly generated per session.
