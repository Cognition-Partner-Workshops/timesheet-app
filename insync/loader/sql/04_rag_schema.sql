CREATE TABLE IF NOT EXISTS rag_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_key TEXT UNIQUE NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    employee_id UUID REFERENCES employees(employee_id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    role_id UUID REFERENCES project_roles(role_id) ON DELETE SET NULL,
    content_masked TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    content_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_source
    ON rag_documents(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_rag_documents_employee
    ON rag_documents(employee_id);

CREATE INDEX IF NOT EXISTS idx_rag_documents_project
    ON rag_documents(project_id);

CREATE INDEX IF NOT EXISTS idx_rag_documents_role
    ON rag_documents(role_id);

CREATE INDEX IF NOT EXISTS idx_rag_documents_metadata
    ON rag_documents USING GIN(metadata);
