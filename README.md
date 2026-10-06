# MassyChat Backend

Real-time messaging backend built with Node.js, Express, Socket.IO, and PostgreSQL.

## Prerequisites

- Node.js 16+
- PostgreSQL 12+
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/John865-act/MassyChat-Backend.git
cd MassyChat-Backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your database credentials
```

4. Create PostgreSQL database:
```bash
psql -U postgres
CREATE DATABASE massychat;
\q
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/signin` - Sign in a user
- `GET /api/auth/me` - Get current user (requires auth token)

### Conversations
- `GET /api/conversations` - Get all conversations for user
- `POST /api/conversations` - Create a new conversation
- `GET /api/conversations/:id` - Get conversation details

### Messages
- `GET /api/messages/conversation/:conversationId` - Get messages in a conversation
- `POST /api/messages/conversation/:conversationId/read` - Mark messages as read

## Socket.IO Events

### Client -> Server
- `conversation:join` - Join a conversation room
- `conversation:leave` - Leave a conversation room
- `message:send` - Send a new message
- `user:typing` - Broadcast typing indicator
- `message:markAsRead` - Mark messages as read

### Server -> Client
- `message:new` - New message received
- `user:typing` - User is typing
- `message:read` - Messages marked as read
- `joined:room` - Successfully joined conversation room

## Environment Variables

See `.env.example` for all available configuration options.

## Database Schema

- `users` - User accounts
- `conversations` - Chat conversations
- `conversation_participants` - Users in conversations
- `messages` - Chat messages

## License

MIT
