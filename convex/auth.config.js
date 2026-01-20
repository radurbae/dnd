export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL,
      applicationID: process.env.CLERK_AUDIENCE
    }
  ]
};
