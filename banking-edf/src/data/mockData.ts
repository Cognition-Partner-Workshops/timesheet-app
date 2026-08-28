export interface DataSource {
  id: string;
  name: string;
  type: 'Oracle DB' | 'SQL Server' | 'PostgreSQL' | 'S3 Bucket' | 'Azure Blob' | 'Kafka' | 'REST API' | 'Flat File';
  status: 'connected' | 'disconnected' | 'error';
  host: string;
  database?: string;
  lastSync: string;
  recordCount: number;
  schema?: string;
}

export interface TransferJob {
  id: string;
  name: string;
  source: string;
  destination: string;
  status: 'completed' | 'running' | 'failed' | 'scheduled' | 'paused';
  progress: number;
  recordsTransferred: number;
  totalRecords: number;
  startTime: string;
  endTime?: string;
  duration?: string;
  errorCount: number;
  validationStatus: 'passed' | 'failed' | 'pending' | 'in_progress';
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'Schema' | 'Data Quality' | 'Business' | 'Referential Integrity' | 'Compliance';
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  lastRun: string;
  passRate: number;
  failedRecords: number;
  expression?: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: 'transfer' | 'validation' | 'verification' | 'rollback' | 'config_change';
  user: string;
  source: string;
  destination?: string;
  status: 'success' | 'failure' | 'warning';
  details: string;
  recordsAffected: number;
  checksum?: string;
}

export const dataSources: DataSource[] = [
  { id: 'ds-001', name: 'Core Banking Oracle', type: 'Oracle DB', status: 'connected', host: 'orcl-prod-01.bank.internal', database: 'COREBANK', lastSync: '2024-01-15T10:30:00Z', recordCount: 2450000, schema: 'BANKING' },
  { id: 'ds-002', name: 'Customer SQL Server', type: 'SQL Server', status: 'connected', host: 'sql-cust-01.bank.internal', database: 'CustomerDB', lastSync: '2024-01-15T09:45:00Z', recordCount: 890000, schema: 'dbo' },
  { id: 'ds-003', name: 'Data Warehouse', type: 'PostgreSQL', status: 'connected', host: 'pg-dw-01.bank.internal', database: 'enterprise_dw', lastSync: '2024-01-15T08:00:00Z', recordCount: 15200000, schema: 'public' },
  { id: 'ds-004', name: 'Transaction Archive', type: 'S3 Bucket', status: 'connected', host: 's3://bank-txn-archive', lastSync: '2024-01-14T23:00:00Z', recordCount: 45000000 },
  { id: 'ds-005', name: 'Risk Analytics', type: 'PostgreSQL', status: 'error', host: 'pg-risk-01.bank.internal', database: 'risk_analytics', lastSync: '2024-01-13T15:00:00Z', recordCount: 3200000, schema: 'risk' },
  { id: 'ds-006', name: 'Regulatory Reporting', type: 'Azure Blob', status: 'connected', host: 'azure://bank-regulatory', lastSync: '2024-01-15T06:00:00Z', recordCount: 1800000 },
  { id: 'ds-007', name: 'Real-time Events', type: 'Kafka', status: 'connected', host: 'kafka-prod.bank.internal:9092', lastSync: '2024-01-15T10:35:00Z', recordCount: 0 },
  { id: 'ds-008', name: 'Legacy Mainframe Export', type: 'Flat File', status: 'disconnected', host: '/mnt/mainframe/exports', lastSync: '2024-01-10T00:00:00Z', recordCount: 12500000 },
];

export const transferJobs: TransferJob[] = [
  { id: 'tj-001', name: 'Daily Customer Sync', source: 'Core Banking Oracle', destination: 'Data Warehouse', status: 'completed', progress: 100, recordsTransferred: 45230, totalRecords: 45230, startTime: '2024-01-15T02:00:00Z', endTime: '2024-01-15T02:45:00Z', duration: '45m', errorCount: 0, validationStatus: 'passed' },
  { id: 'tj-002', name: 'Transaction ETL Pipeline', source: 'Core Banking Oracle', destination: 'Transaction Archive', status: 'running', progress: 67, recordsTransferred: 335000, totalRecords: 500000, startTime: '2024-01-15T10:00:00Z', errorCount: 12, validationStatus: 'in_progress' },
  { id: 'tj-003', name: 'Risk Data Aggregation', source: 'Data Warehouse', destination: 'Risk Analytics', status: 'failed', progress: 34, recordsTransferred: 170000, totalRecords: 500000, startTime: '2024-01-15T08:00:00Z', endTime: '2024-01-15T08:22:00Z', duration: '22m', errorCount: 1547, validationStatus: 'failed' },
  { id: 'tj-004', name: 'Regulatory Report Gen', source: 'Data Warehouse', destination: 'Regulatory Reporting', status: 'scheduled', progress: 0, recordsTransferred: 0, totalRecords: 250000, startTime: '2024-01-16T01:00:00Z', errorCount: 0, validationStatus: 'pending' },
  { id: 'tj-005', name: 'Customer 360 Merge', source: 'Customer SQL Server', destination: 'Data Warehouse', status: 'completed', progress: 100, recordsTransferred: 890000, totalRecords: 890000, startTime: '2024-01-15T03:00:00Z', endTime: '2024-01-15T04:30:00Z', duration: '1h 30m', errorCount: 23, validationStatus: 'passed' },
  { id: 'tj-006', name: 'Mainframe Migration Batch', source: 'Legacy Mainframe Export', destination: 'Core Banking Oracle', status: 'paused', progress: 45, recordsTransferred: 5625000, totalRecords: 12500000, startTime: '2024-01-14T22:00:00Z', errorCount: 892, validationStatus: 'in_progress' },
  { id: 'tj-007', name: 'Real-time Event Capture', source: 'Real-time Events', destination: 'Data Warehouse', status: 'running', progress: 100, recordsTransferred: 1250000, totalRecords: 1250000, startTime: '2024-01-15T00:00:00Z', errorCount: 3, validationStatus: 'passed' },
  { id: 'tj-008', name: 'Account Reconciliation', source: 'Core Banking Oracle', destination: 'Customer SQL Server', status: 'completed', progress: 100, recordsTransferred: 125000, totalRecords: 125000, startTime: '2024-01-15T05:00:00Z', endTime: '2024-01-15T05:15:00Z', duration: '15m', errorCount: 0, validationStatus: 'passed' },
];

export const validationRules: ValidationRule[] = [
  { id: 'vr-001', name: 'Account Number Format', description: 'Validates that account numbers follow the standard 16-digit format with check digit', category: 'Schema', severity: 'critical', enabled: true, lastRun: '2024-01-15T10:00:00Z', passRate: 99.97, failedRecords: 15, expression: '^[0-9]{16}$' },
  { id: 'vr-002', name: 'Transaction Amount Range', description: 'Ensures transaction amounts are within acceptable bounds ($0.01 - $10,000,000)', category: 'Data Quality', severity: 'critical', enabled: true, lastRun: '2024-01-15T10:00:00Z', passRate: 99.99, failedRecords: 3, expression: 'amount > 0.01 AND amount <= 10000000' },
  { id: 'vr-003', name: 'Customer KYC Completeness', description: 'Checks all required KYC fields are populated for each customer record', category: 'Compliance', severity: 'critical', enabled: true, lastRun: '2024-01-15T10:00:00Z', passRate: 98.5, failedRecords: 1340, expression: 'kyc_status IS NOT NULL AND kyc_date IS NOT NULL' },
  { id: 'vr-004', name: 'Foreign Key - Account to Customer', description: 'Validates referential integrity between accounts and customer master', category: 'Referential Integrity', severity: 'critical', enabled: true, lastRun: '2024-01-15T09:30:00Z', passRate: 100, failedRecords: 0 },
  { id: 'vr-005', name: 'Date Format Consistency', description: 'Ensures all date fields follow ISO 8601 format across datasets', category: 'Schema', severity: 'warning', enabled: true, lastRun: '2024-01-15T10:00:00Z', passRate: 99.8, failedRecords: 89 },
  { id: 'vr-006', name: 'Duplicate Transaction Check', description: 'Identifies potential duplicate transactions based on amount, date, and account', category: 'Data Quality', severity: 'warning', enabled: true, lastRun: '2024-01-15T10:00:00Z', passRate: 99.95, failedRecords: 24 },
  { id: 'vr-007', name: 'Balance Reconciliation', description: 'Verifies that calculated running balance matches stored balance for each account', category: 'Business', severity: 'critical', enabled: true, lastRun: '2024-01-15T08:00:00Z', passRate: 99.98, failedRecords: 8 },
  { id: 'vr-008', name: 'PII Data Masking Check', description: 'Ensures sensitive PII fields are properly masked in non-production datasets', category: 'Compliance', severity: 'critical', enabled: true, lastRun: '2024-01-15T07:00:00Z', passRate: 100, failedRecords: 0 },
  { id: 'vr-009', name: 'Currency Code Validation', description: 'Validates currency codes against ISO 4217 standard', category: 'Schema', severity: 'warning', enabled: true, lastRun: '2024-01-15T10:00:00Z', passRate: 99.99, failedRecords: 2 },
  { id: 'vr-010', name: 'AML Threshold Alert', description: 'Flags transactions exceeding anti-money laundering thresholds for review', category: 'Compliance', severity: 'critical', enabled: true, lastRun: '2024-01-15T10:00:00Z', passRate: 99.7, failedRecords: 156 },
];

export const auditRecords: AuditRecord[] = [
  { id: 'ar-001', timestamp: '2024-01-15T10:35:00Z', action: 'transfer', user: 'system_scheduler', source: 'Core Banking Oracle', destination: 'Transaction Archive', status: 'success', details: 'Transaction ETL Pipeline - batch processing in progress', recordsAffected: 335000, checksum: 'sha256:a1b2c3d4...' },
  { id: 'ar-002', timestamp: '2024-01-15T10:00:00Z', action: 'validation', user: 'system_scheduler', source: 'Data Warehouse', status: 'success', details: 'Scheduled validation run - 10 rules executed, all passed', recordsAffected: 15200000 },
  { id: 'ar-003', timestamp: '2024-01-15T08:22:00Z', action: 'transfer', user: 'system_scheduler', source: 'Data Warehouse', destination: 'Risk Analytics', status: 'failure', details: 'Risk Data Aggregation failed - connection timeout to risk_analytics DB', recordsAffected: 170000, checksum: 'sha256:e5f6g7h8...' },
  { id: 'ar-004', timestamp: '2024-01-15T05:15:00Z', action: 'verification', user: 'system_scheduler', source: 'Core Banking Oracle', destination: 'Customer SQL Server', status: 'success', details: 'Account Reconciliation verification - checksums matched across source and destination', recordsAffected: 125000, checksum: 'sha256:i9j0k1l2...' },
  { id: 'ar-005', timestamp: '2024-01-15T04:30:00Z', action: 'transfer', user: 'system_scheduler', source: 'Customer SQL Server', destination: 'Data Warehouse', status: 'warning', details: 'Customer 360 Merge completed with 23 records requiring manual review', recordsAffected: 890000, checksum: 'sha256:m3n4o5p6...' },
  { id: 'ar-006', timestamp: '2024-01-15T02:45:00Z', action: 'transfer', user: 'system_scheduler', source: 'Core Banking Oracle', destination: 'Data Warehouse', status: 'success', details: 'Daily Customer Sync completed successfully - zero errors', recordsAffected: 45230, checksum: 'sha256:q7r8s9t0...' },
  { id: 'ar-007', timestamp: '2024-01-14T23:00:00Z', action: 'verification', user: 'data_admin', source: 'Transaction Archive', status: 'success', details: 'Monthly archive verification - all checksums validated', recordsAffected: 45000000, checksum: 'sha256:u1v2w3x4...' },
  { id: 'ar-008', timestamp: '2024-01-14T22:00:00Z', action: 'config_change', user: 'data_admin', source: 'Legacy Mainframe Export', status: 'success', details: 'Updated batch size for mainframe migration from 100k to 250k records', recordsAffected: 0 },
  { id: 'ar-009', timestamp: '2024-01-14T18:00:00Z', action: 'rollback', user: 'data_admin', source: 'Risk Analytics', destination: 'Data Warehouse', status: 'success', details: 'Rolled back failed risk data load - restored to checkpoint 2024-01-14T12:00Z', recordsAffected: 500000 },
  { id: 'ar-010', timestamp: '2024-01-14T15:30:00Z', action: 'validation', user: 'compliance_team', source: 'Core Banking Oracle', status: 'warning', details: 'AML threshold validation flagged 156 transactions for review', recordsAffected: 156 },
];

export const dashboardStats = {
  totalSources: dataSources.length,
  activePipelines: transferJobs.filter((j) => j.status === 'running').length,
  totalRecordsMoved: transferJobs.reduce((sum, j) => sum + j.recordsTransferred, 0),
  overallValidationRate: 99.6,
  failedJobs: transferJobs.filter((j) => j.status === 'failed').length,
  scheduledJobs: transferJobs.filter((j) => j.status === 'scheduled').length,
  connectedSources: dataSources.filter((s) => s.status === 'connected').length,
  errorSources: dataSources.filter((s) => s.status === 'error').length,
};

export const transferTrend = [
  { date: 'Jan 9', records: 12500000, errors: 234 },
  { date: 'Jan 10', records: 14200000, errors: 189 },
  { date: 'Jan 11', records: 13800000, errors: 456 },
  { date: 'Jan 12', records: 15100000, errors: 123 },
  { date: 'Jan 13', records: 11200000, errors: 892 },
  { date: 'Jan 14', records: 16300000, errors: 167 },
  { date: 'Jan 15', records: 8450000, errors: 78 },
];

export const sourceTypeDistribution = [
  { name: 'Oracle DB', value: 1, color: '#1565C0' },
  { name: 'SQL Server', value: 1, color: '#42A5F5' },
  { name: 'PostgreSQL', value: 2, color: '#00897B' },
  { name: 'S3 Bucket', value: 1, color: '#ED6C02' },
  { name: 'Azure Blob', value: 1, color: '#9C27B0' },
  { name: 'Kafka', value: 1, color: '#2E7D32' },
  { name: 'Flat File', value: 1, color: '#D32F2F' },
];
