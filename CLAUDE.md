# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- Runtime: Node.js + Express 4
- Deployment: Docker Compose

## Common Commands

### Development

```bash
docker compose up --build        # Start all services
docker compose up --build -d     # Start in background
docker compose down              # Stop all services
docker compose logs -f <service> # Tail logs for a service
```

### Running locally without Docker

```bash
npm install
npm run dev      # Start dev server
npm start        # Start production server
```

### Tests

```bash
npm test                        # Run all tests
npm test -- <file>              # Run a single test file
npm run test:watch              # Watch mode
```

### Lint

```bash
npm run lint
npm run lint -- --fix
```

## Project Structure

```
docker-compose.yml   # Service definitions
Dockerfile           # App container
src/                 # Application source
  index.js           # Entry point
.env.example         # Environment variable template
```

## Environment Variables

Copy `.env.example` to `.env` before starting. The Docker Compose setup reads from `.env` at the project root.

## Architecture Notes

Update this section as the project grows to describe service boundaries, data flow, and key design decisions.
