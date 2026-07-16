# InterviewHub - Technical Interview Platform

A comprehensive technical interview management platform built with React JS and Python FastAPI, inspired by platforms like Karat.

![InterviewHub](https://img.shields.io/badge/InterviewHub-v1.0-6366f1)
![React](https://img.shields.io/badge/React-18-61dafb)
![Python](https://img.shields.io/badge/Python-FastAPI-009688)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

## Features

### Dashboard
- Real-time overview of interview activities
- Key metrics: total interviews, upcoming sessions, candidates, average scores
- Recent activity feed
- Question bank summary with difficulty distribution

### Interview Management
- Schedule, track, and manage interviews
- Filter by status (Scheduled, In Progress, Completed, Cancelled)
- Assign interviewers and candidates
- Set duration and meeting links
- Real-time status updates

### Question Bank
- Comprehensive coding question library
- Categorized by difficulty (Easy, Medium, Hard)
- Organized by topic (Arrays, Linked Lists, Trees, System Design, etc.)
- Sample inputs/outputs and time limits
- Tags for easy searchability

### Live Code Editor
- Monaco Editor integration (same editor as VS Code)
- Support for Python and JavaScript
- Real-time code execution
- Dark/Light theme toggle
- Syntax highlighting, auto-completion, bracket matching
- Copy, reset, and fullscreen controls

### Candidate Management
- Track candidate pipeline
- View interview history per candidate
- Search and filter candidates
- Contact information management

### Reports & Analytics
- Interview feedback with detailed scoring
- Technical, Communication, and Problem-Solving score breakdowns
- Overall rating with star visualization
- Recommendation tracking (Hire, Next Round, Reject)
- Score distribution analysis

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Material UI (MUI)** for rich UI components
- **Monaco Editor** for the code editor
- **React Router** for navigation
- **Axios** for API communication
- **Recharts** for data visualization

### Backend
- **Python 3** with **FastAPI**
- **SQLAlchemy** ORM
- **SQLite** database
- **JWT** authentication
- **Pydantic** for data validation
- Code execution engine (Python & JavaScript)

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The app will be available at `http://localhost:3000`

### Demo Credentials
- **Email:** admin@interviewhub.com
- **Password:** admin123

## Project Structure

```
interview-platform/
├── backend/
│   ├── app/
│   │   ├── routers/         # API route handlers
│   │   │   ├── auth.py      # Authentication endpoints
│   │   │   ├── interviews.py # Interview CRUD
│   │   │   ├── questions.py  # Question bank
│   │   │   ├── feedback.py   # Interview feedback
│   │   │   ├── code.py       # Code execution
│   │   │   ├── users.py      # User management
│   │   │   └── dashboard.py  # Dashboard stats
│   │   ├── main.py           # FastAPI app entry
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── database.py       # Database config
│   │   ├── auth.py           # Auth utilities
│   │   └── seed.py           # Sample data
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   │   └── Layout.tsx    # Main app layout
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Interviews.tsx
│   │   │   ├── Questions.tsx
│   │   │   ├── Candidates.tsx
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── Reports.tsx
│   │   │   └── Login.tsx
│   │   ├── services/
│   │   │   └── api.ts        # API service layer
│   │   └── theme/
│   │       └── theme.ts      # MUI theme config
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET/POST | `/api/interviews/` | List/Create interviews |
| PUT/DELETE | `/api/interviews/{id}` | Update/Delete interview |
| GET/POST | `/api/questions/` | List/Create questions |
| GET/POST | `/api/feedback/` | List/Create feedback |
| POST | `/api/code/run` | Execute code |
| GET | `/api/users/` | List users |

## License

MIT License
