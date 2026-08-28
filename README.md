# Employee Time Tracking Application

A full-stack web application for tracking and reporting employee hourly work across different clients.

## Features

- User authentication (email-only legacy + password-based with JWT tokens)
- Role-based access control (admin / user)
- Add, edit, and delete clients
- Add, edit, and delete hourly work entries for each client
- View hourly reports for each client
- Export hourly reports to CSV or PDF
- Persistent file-based SQLite database
- Structured logging with Winston
- Interactive API documentation via Swagger UI
- Request ID tracking for observability
- Health and readiness probe endpoints

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **Material UI** for components
- **React Query** for server state management
- **React Router** for navigation
- **Vitest + Testing Library** for unit tests

### Backend
- **Node.js** with Express
- **SQLite** (file-based, persistent)
- **JWT** for authentication (+ legacy email-header support)
- **bcryptjs** for password hashing
- **Joi** for validation
- **Winston** for structured logging
- **Swagger/OpenAPI** for API documentation
- **PDFKit** for PDF generation
- **csv-writer** for CSV export
- **Jest + Supertest** for testing (161 tests, 90%+ coverage)

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env   # Edit with your config
npm run dev             # Starts on port 3001
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev             # Starts on port 5173
```

### Usage

1. Open `http://localhost:5173`
2. Enter any email address to log in (legacy mode), or register with email + password
3. Start adding clients and tracking work hours
4. View reports and export data as CSV or PDF
5. API docs available at `http://localhost:3001/api-docs`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register with email + password (returns JWT) |
| `POST` | `/api/auth/login` | Login with password or email-only (returns JWT) |
| `GET` | `/api/auth/me` | Get current user info |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/clients` | List all clients |
| `POST` | `/api/clients` | Create a client |
| `GET` | `/api/clients/:id` | Get a client |
| `PUT` | `/api/clients/:id` | Update a client |
| `DELETE` | `/api/clients/:id` | Delete a client |

### Work Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/work-entries` | List entries (optional `?clientId` filter) |
| `POST` | `/api/work-entries` | Create an entry |
| `GET` | `/api/work-entries/:id` | Get an entry |
| `PUT` | `/api/work-entries/:id` | Update an entry |
| `DELETE` | `/api/work-entries/:id` | Delete an entry |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reports/client/:id` | Hourly report for client |
| `GET` | `/api/reports/export/csv/:id` | Export as CSV |
| `GET` | `/api/reports/export/pdf/:id` | Export as PDF |

### Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (DB status, uptime, version) |
| `GET` | `/ready` | Readiness probe |
| `GET` | `/api-docs` | Swagger UI |
| `GET` | `/api-docs.json` | OpenAPI spec (JSON) |

Authenticated endpoints accept either `Authorization: Bearer <token>` or the legacy `x-user-email` header.

## Security

- Password hashing with bcryptjs (10 rounds)
- JWT-based authentication with 24-hour expiry
- Role-based access control (admin / user roles)
- Rate limiting: 100 req/15min general, 15 req/15min for auth
- CORS protection
- Helmet security headers
- Input validation with Joi schemas
- SQL injection protection with parameterized queries

### Admin Setup

Set `ADMIN_EMAIL` to seed an admin user on first startup:
```bash
ADMIN_EMAIL=admin@example.com npm start
```
**Important:** The seeded admin has no password initially and is accessible via legacy email-only login. Immediately call `POST /api/auth/set-password` to secure the account after first login. Once a password is set, the legacy email-only login path is blocked for that account.

## Data Persistence

The database defaults to **file-based SQLite** at `backend/data/timesheet.db`. Data persists across server restarts.

To switch to in-memory mode (for testing), set:
```bash
DATABASE_PATH=:memory:
```

## Development

### Running Tests

**Backend:**
```bash
cd backend
npm test                    # Run all 161 tests
npm run test:coverage       # With coverage report
```

**Frontend:**
```bash
cd frontend
npm test                    # Run vitest suite
npm run test:watch          # Watch mode
```

### Building for Production

```bash
cd frontend && npm run build   # Creates optimized build in dist/
cd backend && npm start        # Production mode
```

## License

MIT
