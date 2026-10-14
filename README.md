# Employee Time Tracking Application

A full-stack web application for tracking and reporting employee hourly work across different clients.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Material UI
- **Backend:** Node.js, Express, SQLite (in-memory), JWT authentication

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run dev    # runs on http://localhost:3001

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev    # runs on http://localhost:5173
```

## Usage

1. Open `http://localhost:5173` in your browser
2. Enter any email address to log in
3. Add clients and track work hours
4. View reports and export as CSV or PDF

## License

This project is for internal use.
