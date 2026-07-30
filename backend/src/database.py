import pymysql
from pymysql.cursors import DictCursor

from src.config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER

_pool_args = dict(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME,
    cursorclass=DictCursor,
    autocommit=True,
)


def get_connection() -> pymysql.Connection:
    return pymysql.connect(**_pool_args)


def initialize_database() -> None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    email VARCHAR(255) PRIMARY KEY,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS clients (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    department VARCHAR(255),
                    email VARCHAR(255),
                    user_email VARCHAR(255) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS work_entries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id INT NOT NULL,
                    user_email VARCHAR(255) NOT NULL,
                    hours DECIMAL(5,2) NOT NULL,
                    description TEXT,
                    date DATE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
                    FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_clients_user_email ON clients (user_email)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_work_entries_client_id ON work_entries (client_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_work_entries_user_email ON work_entries (user_email)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries (date)")
        print("Database tables created successfully")
    finally:
        conn.close()
