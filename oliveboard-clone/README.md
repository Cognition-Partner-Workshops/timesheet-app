# TestSeriesPro - Online Test Preparation Platform

A full-stack MERN (MongoDB, Express.js, React, Node.js) web application for online test preparation, similar to Oliveboard. Users can register, browse test series, take timed MCQ tests, and review detailed results. Admins can create test series and bulk-upload questions via Excel/CSV/JSON.

## Features

### User Features
- **Registration & Login** — JWT-based authentication
- **Dashboard** — Browse test series by category (Banking, SSC, Railways, etc.)
- **Timed Mock Tests** — Real exam-like interface with timer, question navigation, mark-for-review
- **Auto-Scoring** — Instant results with section-wise analysis
- **Detailed Solutions** — View correct answers and explanations after submission
- **Test History** — Track all past attempts and scores

### Admin Features
- **Admin Dashboard** — Overview of test series, tests, and user stats
- **Manage Test Series** — CRUD operations with publish/draft toggle
- **Manage Tests** — Create tests with duration, total marks, negative marking
- **Bulk Question Upload** — Upload 100+ questions at once via:
  - **Excel (.xlsx)** — Download template, fill questions, upload
  - **CSV (.csv)** — Comma-separated format
  - **JSON (.json)** — Structured array format
- **Question Management** — Add, edit, delete individual questions via web form
- **Preview & Validate** — Preview uploaded questions with error reporting before saving

## Tech Stack

| Layer       | Technology                                                  |
|-------------|-------------------------------------------------------------|
| Frontend    | React 18, Vite, Tailwind CSS, Redux Toolkit, React Router  |
| Backend     | Node.js, Express.js, Mongoose, JWT, bcryptjs                |
| Database    | MongoDB                                                     |
| File Upload | Multer, xlsx                                                |

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (local or MongoDB Atlas)

### Installation

1. **Clone the repository**
```bash
git clone <repo-url>
cd oliveboard-clone
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install frontend dependencies**
```bash
cd frontend && npm install && cd ..
```

4. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

5. **Run in development mode**
```bash
npm run dev
```

This starts:
- Backend API on `http://localhost:5000`
- Frontend dev server on `http://localhost:3000` (proxies API requests to backend)

### Creating an Admin User

Register a normal user, then update their role in MongoDB:
```js
// In MongoDB shell or compass:
db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })
```

## Bulk Question Upload Format

### Excel/CSV Template

| QuestionNumber | Section | QuestionText | OptionA | OptionB | OptionC | OptionD | CorrectAnswer | Explanation | Marks |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Quantitative Aptitude | What is 25% of 400? | 100 | 150 | 75 | 200 | A | 25/100 * 400 = 100 | 1 |

### JSON Format
```json
[
  {
    "questionNumber": 1,
    "section": "Quantitative Aptitude",
    "questionText": "What is 25% of 400?",
    "options": [
      { "optionId": "A", "text": "100" },
      { "optionId": "B", "text": "150" },
      { "optionId": "C", "text": "75" },
      { "optionId": "D", "text": "200" }
    ],
    "correctAnswer": "A",
    "explanation": "25/100 * 400 = 100",
    "marks": 1
  }
]
```

## Project Structure

```
oliveboard-clone/
├── backend/
│   ├── config/db.js           # MongoDB connection
│   ├── controllers/           # Route handlers
│   ├── middleware/             # Auth & error handling
│   ├── models/                # Mongoose schemas (User, TestSeries, Test, Question, Attempt)
│   ├── routes/                # Express routes
│   ├── utils/                 # Question parser, JWT generator
│   ├── templates/             # Excel template
│   └── server.js              # Entry point
├── frontend/
│   ├── src/
│   │   ├── api/               # Axios instance
│   │   ├── components/        # Navbar, ProtectedRoute, Spinner
│   │   ├── pages/
│   │   │   ├── admin/         # Admin pages (Dashboard, Manage, BulkUpload)
│   │   │   └── user/          # User pages (Dashboard, TakeTest, Results)
│   │   ├── redux/             # Redux store & auth slice
│   │   └── App.jsx            # Root with routes
│   └── index.html
├── .env.example
├── package.json
└── README.md
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user

### Test Series (Public)
- `GET /api/test-series` — List published series
- `GET /api/test-series/:id` — Get series with tests

### Tests (User)
- `GET /api/tests/:id` — Get test for taking
- `POST /api/tests/:testId/start` — Start attempt
- `POST /api/tests/:testId/submit` — Submit answers
- `GET /api/tests/attempts` — My attempts
- `GET /api/tests/attempts/:id` — Attempt detail

### Admin
- `GET /api/admin/stats` — Dashboard stats
- `CRUD /api/admin/test-series` — Manage series
- `CRUD /api/admin/tests` — Manage tests
- `POST /api/admin/tests/:testId/questions` — Add question
- `POST /api/admin/tests/:testId/questions/bulk-upload` — Bulk upload
- `GET /api/admin/tests/:testId/questions/template` — Download template
