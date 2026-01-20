import { defineAuthConfig } from "convex/server";

export default defineAuthConfig({
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL
    }
  ]
});
