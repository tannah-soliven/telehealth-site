# Telehealth Monorepo (Scaffold)

## Structure

- `backend/`: Node.js + Express + TypeScript API
- `frontend/`: React + TypeScript + Vite + Shadcn/UI (Tailwind)

## Quickstart

Install dependencies:

```bash
npm install
```

Run backend (defaults to `http://localhost:4000`):

```bash
npm run dev -w backend
```

Run frontend (defaults to `http://localhost:5173`):

```bash
npm run dev -w frontend
```

## Environment

Backend:

- Copy `backend/.env.example` to `backend/.env`
- Update `FRONTEND_ORIGIN` if your frontend runs elsewhere

