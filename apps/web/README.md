# OpsFlow Web

React + TypeScript + Vite front end for OpsFlow. Setup and architecture are described in the [main README](../../README.md).

```bash
npm ci
npm run dev    # http://localhost:5173, proxies /api to http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Component and unit tests (Vitest, Testing Library) |
| `npm run lint` | ESLint |
| `npm run build` | Type check and production build |

The access token is kept in memory only; the refresh token is an httpOnly cookie. `src/api/client.ts` refreshes once on a 401 and retries, sharing one refresh request per tab and serializing tabs with a Web Lock. Permission checks in `src/features/organizations/permissions.ts` only decide which controls to show; the API enforces them.
