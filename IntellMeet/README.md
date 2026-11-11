# IntellMeet

AI-powered meeting and collaboration platform built with the MERN stack.

**Features**
- Video conferencing (WebRTC mesh, Socket.io signaling) with screen sharing, mute and camera controls
- Live chat saved per meeting
- Live transcription (browser Web Speech API, attributed per speaker, saved to MongoDB)
- AI minutes after the meeting ends: summary, key points, decisions, action items (OpenAI)
- Action item tracking with check-off
- Workspaces with invite codes; meetings can be shared with a whole team
- JWT authentication, bcrypt password hashing, Helmet, rate limiting on auth routes

## Project structure

```
intellmeet/
  server/   Express API, Mongoose models, Socket.io, OpenAI service
  client/   React app (.js files, one CSS file per component or page)
```

## Run locally

Requirements: Node.js 18+, MongoDB running locally (or a MongoDB Atlas URI).

```bash
npm run install-all
cp server/.env.example server/.env   # then set JWT_SECRET (and MONGO_URI if needed)
npm run dev
```

- Client: http://localhost:3000
- API and sockets: http://localhost:5000

Set `OPENAI_API_KEY` in `server/.env` for full AI summaries. Without it, a basic built-in
summarizer runs so the app still works.

To test video with two participants, sign in as two different users in two browsers (or one normal
window and one private window) and share the meeting code shown at the top of the room.

## Production

```bash
npm run build                 # builds the React app
NODE_ENV=production npm start # Express serves API, sockets and the built client
```

Or with Docker: `docker compose up --build` (set `OPENAI_API_KEY` in your shell first).

## Notes

- Camera and microphone need HTTPS in production (localhost is exempt).
- WebRTC runs as a mesh, which suits small meetings (about 2 to 6 people). For larger meetings,
  add a media server (SFU) such as LiveKit or mediasoup and keep the rest of the app as is.
- For participants on strict networks, add a TURN server to `ICE` in `client/src/hooks/useWebRTC.js`.
- Live transcription requires Chrome or Edge (Web Speech API).

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /api/auth/register, /api/auth/login | Sign up and sign in |
| GET | /api/auth/me | Current user |
| GET, POST | /api/meetings | List and create meetings |
| GET | /api/meetings/room/:roomId | Join a meeting by code |
| GET, DELETE | /api/meetings/:id | Meeting details, delete (host) |
| PATCH | /api/meetings/:id/end | End meeting (host) and generate minutes |
| POST | /api/meetings/:id/summarize | Regenerate AI minutes |
| GET | /api/meetings/:id/messages, /transcript | Chat and transcript history |
| PATCH | /api/meetings/:id/action-items/:itemId | Mark an action item done |
| GET, POST | /api/workspaces | List and create workspaces |
| POST | /api/workspaces/join | Join with invite code |
| DELETE | /api/workspaces/:id/leave | Leave a workspace |
