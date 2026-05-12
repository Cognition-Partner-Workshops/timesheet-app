import os

from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "3001"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "timesheet")
