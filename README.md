# Employee Time Tracking Application

A full-stack web application for tracking and reporting employee hourly work across different clients.

## ⚠️ Important Notes

### Data Persistence
**This application uses MySQL for persistent data storage.**
- A running MySQL server is required
- Data persists across server restarts
- Configure connection details via environment variables (see Backend Setup)

### Authentication
- Email-only authentication via `x-user-email` header
- No password required - assumes trusted internal network
- Anyone with a valid email can create an account and log in
- Consider integrating with company SSO for production use

## Features

- ✅ User authentication (email-based)
- ✅ Add, edit, and delete clients
- ✅ Add, edit, and delete hourly work entries for each client
- ✅ View hourly reports for each client
- ✅ Export hourly reports to CSV or PDF

## Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for build tooling
- **Material UI** for components
- **React Query** for server state management
- **React Router** for navigation
- **Axios** for API calls

### Backend
- **Python** with FastAPI
- **MySQL** database (via PyMySQL)
- **Pydantic** for validation
- **fpdf2** for PDF generation
- **uvicorn** as ASGI server

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── app.py              # FastAPI application
│   │   ├── config.py           # Environment configuration
│   │   ├── database.py         # MySQL connection & schema
│   │   ├── dependencies.py     # Auth dependency
│   │   ├── schemas.py          # Pydantic validation models
│   │   └── routes/
│   │       ├── auth.py         # Authentication endpoints
│   │       ├── clients.py      # Client CRUD
│   │       ├── work_entries.py # Work entry CRUD
│   │       └── reports.py      # Reporting & export
│   ├── tests/                  # Pytest test suite
│   ├── requirements.txt
│   └── DEPLOYMENT.md           # Production deployment guide
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── client.ts       # API client
    │   ├── components/
    │   │   └── Layout.tsx      # Main layout
    │   ├── contexts/
    │   │   └── AuthContext.tsx  # Auth state management
    │   ├── pages/
    │   │   ├── LoginPage.tsx     # Login page
    │   │   ├── DashboardPage.tsx # Dashboard
    │   │   ├── ClientsPage.tsx   # Client management
    │   │   ├── WorkEntriesPage.tsx # Work entry management
    │   │   └── ReportsPage.tsx   # Reports & exports
    │   ├── types/
    │   │   └── api.ts          # TypeScript interfaces
    │   └── App.tsx             # Main app component
    └── package.json
```

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+ (for the frontend)
- MySQL server running with a `timesheet` database:
  ```sql
  CREATE DATABASE IF NOT EXISTS timesheet;
  ```

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```bash
PORT=3001
FRONTEND_URL=http://localhost:5173

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=timesheet
```

5. Start the development server:
```bash
uvicorn src.app:app --host 0.0.0.0 --port 3001 --reload
```

Backend will be running at `http://localhost:3001`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env`:
```bash
VITE_API_URL=http://localhost:3001
```

5. Start the development server:
```bash
npm run dev
```

Frontend will be running at `http://localhost:5173`

## Usage

1. Open `http://localhost:5173` in your browser
2. Enter any email address to log in (no password required)
3. Start adding clients and tracking work hours
4. View reports and export data as CSV or PDF

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email
- `GET /api/auth/me` - Get current user info (requires `x-user-email` header)

### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create new client
- `GET /api/clients/{id}` - Get specific client
- `PUT /api/clients/{id}` - Update client
- `DELETE /api/clients/{id}` - Delete client
- `DELETE /api/clients` - Delete all clients

### Work Entries
- `GET /api/work-entries` - Get all work entries (optional `?clientId` filter)
- `POST /api/work-entries` - Create new work entry
- `GET /api/work-entries/{id}` - Get specific work entry
- `PUT /api/work-entries/{id}` - Update work entry
- `DELETE /api/work-entries/{id}` - Delete work entry

### Reports
- `GET /api/reports/client/{clientId}` - Get hourly report for client
- `GET /api/reports/export/csv/{clientId}` - Export report as CSV
- `GET /api/reports/export/pdf/{clientId}` - Export report as PDF

All authenticated endpoints require `x-user-email` header.

## Security Features

- CORS protection
- Input validation with Pydantic schemas
- SQL injection protection with parameterized queries
- MySQL connection pooling

## Development

### Backend Development
```bash
cd backend
uvicorn src.app:app --host 0.0.0.0 --port 3001 --reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Starts Vite dev server with HMR
```

### Running Tests

**Backend:**
```bash
cd backend
python -m pytest tests/ -v
```

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build  # Creates optimized production build in dist/
npm run preview  # Preview production build
```

## Production Deployment

See `backend/DEPLOYMENT.md` for detailed production deployment instructions.

### Quick Production Checklist
- [ ] Configure proper MySQL credentials via environment variables
- [ ] Configure proper `FRONTEND_URL` for CORS
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure proper logging and monitoring
- [ ] Set up automated MySQL backups
- [ ] Consider integrating with company SSO

## Known Limitations

1. **Email-only auth** - No password protection, assumes trusted network
2. **No user roles** - All users have equal access to all data
3. **Single-server architecture** - Not designed for horizontal scaling
4. **No real-time updates** - Changes require page refresh

## Future Enhancements

- User roles and permissions
- Multi-tenancy support
- Real-time updates with WebSockets
- Advanced reporting and analytics
- Email notifications
- Mobile app
- Integration with calendar systems

## License

MIT

## Support

For issues or questions, please contact your system administrator.
