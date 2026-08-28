# Banking EDF — Enterprise Data Framework

A modern React + Material UI application for managing enterprise banking data pipelines. The EDF (Enterprise Data Framework) provides a comprehensive solution for copying data between sources, with built-in validation, transfer management, and verification capabilities.

## Features

### Dashboard
- Real-time KPI monitoring (connected sources, active pipelines, validation rate, records moved)
- Interactive charts: data transfer volume trend, error trend, source type distribution
- System health monitoring (CPU, memory, storage I/O, network)
- Recent pipeline activity feed with live progress indicators

### Data Sources
- Manage enterprise data connections (Oracle DB, SQL Server, PostgreSQL, S3, Azure Blob, Kafka, Flat Files)
- Add, edit, delete data sources with a modern card-based UI
- Test connection functionality
- Search and filter capabilities
- Status indicators (connected, disconnected, error)

### Data Transfer
- Create transfer jobs with a guided step-by-step wizard
- Source → Destination pipeline configuration
- Live progress tracking with real-time updates
- Pause, resume, retry, and stop job controls
- Expandable job details with metrics and error summaries
- Batch size and parallelism configuration

### Data Validation
- Rules engine with categories: Schema, Data Quality, Business, Referential Integrity, Compliance
- Severity levels: Critical, Warning, Info
- Enable/disable individual rules
- Run all rules or individual rule execution
- Pass rate tracking with visual indicators
- List and card views for validation results

### Verification & Audit
- Complete audit trail with timestamps, actions, and user tracking
- Checksum verification (SHA-256) for data integrity
- Filter by action type and status
- Export report functionality
- Dedicated checksum verification tab with source/destination match status

### Settings
- Dark/Light theme toggle
- Notification preferences
- Performance tuning (batch size, parallelism, timeouts, retries)
- Security & Compliance settings (SSL/TLS, PII masking, audit logging)
- Scheduling configuration
- Backup & Recovery options

## Tech Stack

- **React 18** with TypeScript
- **Material UI v9** (MUI) for component library
- **Recharts** for data visualization
- **React Router v7** for navigation
- **Vite** for build tooling
- **Notistack** for notifications

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/       # Reusable UI components (Layout, StatCard)
├── context/          # React contexts (ThemeContext)
├── data/             # Mock data and type definitions
├── pages/            # Page components
│   ├── Dashboard.tsx
│   ├── DataSources.tsx
│   ├── DataTransfer.tsx
│   ├── DataValidation.tsx
│   ├── Verification.tsx
│   └── Settings.tsx
└── theme/            # MUI theme configuration (light/dark)
```
