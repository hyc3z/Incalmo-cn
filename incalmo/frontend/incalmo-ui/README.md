# Incalmo Seminar Studio

A standalone React/Nginx UI for seminar replay and observing Incalmo operations.

## See the demo

Designed for seminar storytelling: interactive topology, stage-by-stage replay, projector-friendly presentation mode, evidence details, and Markdown/JSON exports. Start the UI on its own; enable the attack lab separately when needed.

The images below show the built-in **illustrative scenario**, not results from an actual assessment.

![Presentation mode with network topology, attack stages, and event explanations](../../../docs/screenshots/seminar-studio-overview.jpg)

![Findings register with severity filters, targets, and evidence labels](../../../docs/screenshots/seminar-studio-findings.jpg)

## Container deployment

From the repository's `docker/` directory:

```bash
docker compose up --build -d
```

Open `http://localhost:3000/`. Only the UI runs by default. Its authored replay works without the backend, target containers, API keys, or model calls.

For actual recordings and live controls, enable the lab:

```bash
docker compose --profile lab up -d
```

This adds `attacker`, `webserver`, and `db`. It does not start an attack strategy. To stop the lab while keeping the UI available:

```bash
docker compose --profile lab stop attacker webserver db
```

Updating the UI does not require rebuilding the attack engine:

```bash
docker compose build ui
docker compose up -d ui
```

## Separation of responsibilities

- The UI Dockerfile installs npm dependencies from `registry.npmmirror.com`, builds the React app, and serves it with Nginx.
- No backend source, logs, Docker socket, or API credentials are mounted into the UI container.
- Nginx proxies browser requests under `/api/` to `attacker:8888`, stripping the `/api` prefix. SSE buffering is disabled for the original operator console.
- The backend hostname is resolved at request time. An absent backend does not prevent the static UI from starting.
- UI and backend share only `control_network`; the UI is not attached to the lab target networks.
- Flask serves API responses only. The former `/studio/` static handler and build-copy script have been removed. The UI container redirects its own `/studio/` bookmarks to `/`.

## Development

```bash
npm ci --legacy-peer-deps --registry=https://registry.npmmirror.com
REACT_APP_API_BASE_URL=http://localhost:8888 npm start
```

Production defaults to same-origin `/api`. Never include API credentials in frontend environment variables. The existing React 19 / React Scripts dependency tree requires legacy peer dependency resolution.

```bash
npm run build
CI=true npm test -- --watchAll=false --runInBand App.seminar.test.js
```

The seminar view is read-only. The separate Operator console contains live controls that can execute actions and incur API charges. The existing local access boundary remains unchanged; no multi-user authentication is added.
