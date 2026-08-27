# NOVA

Turn goals into completed work.

An autonomous AI agent that researches, plans, executes and verifies digital work.

## Setup

1. Copy `.env.example` to `.env`
2. Run `npm install` at the root
3. Run `docker-compose up -d` to start local PostgreSQL and Redis

## Database

1. Generate Prisma client: `cd packages/database && npx prisma generate`
2. Push schema to database: `cd packages/database && npx prisma db push`

## Running Locally

- **Backend API**: `cd apps/api && npm run dev`
- **Frontend App**: `cd apps/web && npm run dev`
