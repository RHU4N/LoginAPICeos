# LoginAPICeos

- Node 24 matches Azure. Install with npm ci; run npm run lint, npm test and npm run test:integration.
- Integration tests use MongoMemoryServer only. Never point test runners at production MongoDB or mutate hosted users/history/IoT data.
- Keep JWT in HttpOnly secure production cookies; preserve exact CORS/CSRF origins, service-key isolation and bounded proxy trust.
- Inspect private setting presence only; never print .env, JWT_SECRET, MONGO_URI, service keys, cookies or private responses.
- Production Swagger remains disabled unless explicitly authorized. Azure deployment uses the existing OIDC workflow.
- Use rg and focused reads/tests; reuse findings, bound output and run full checks once before delivery. Avoid redundant docs and simple-task subagents.
