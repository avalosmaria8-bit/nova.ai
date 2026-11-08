# Nova AI

Nova is a lightweight, general-purpose AI assistant with a calm, focused chat experience. It has a fully usable on-device demo mode and becomes a live AI app after you add an OpenAI API key.

## What is included

- A responsive chat interface with conversation history stored locally in the browser
- Quick-start prompts for writing, learning, planning, and brainstorming
- Dark-mode preference, saved locally
- A server-side `/api/chat` route that keeps `OPENAI_API_KEY` out of the browser
- Friendly demo responses when no key has been configured

## Run it

1. Install Node.js 18 or newer.
2. In this folder, copy `.env.example` to `.env` and add your `OPENAI_API_KEY`.
3. Start the app with `npm start`.
4. Visit `http://localhost:3000`.

Without `.env`, the interface still works in demo mode so the product experience can be explored safely.

## Production notes

Before deployment, add authentication, a persistent database, rate limits, abuse monitoring, and a secure secret manager. Do not deploy the demo mode as the sole access control for a public service.
