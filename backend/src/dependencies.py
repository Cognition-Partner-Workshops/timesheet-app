from fastapi import Header, HTTPException

from src.database import get_connection
from src.schemas import _is_valid_email


def get_authenticated_user(x_user_email: str = Header(default=None)) -> str:
    if not x_user_email:
        raise HTTPException(status_code=401, detail="User email required in x-user-email header")

    if not _is_valid_email(x_user_email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT email FROM users WHERE email = %s", (x_user_email,))
            row = cur.fetchone()
            if not row:
                cur.execute("INSERT INTO users (email) VALUES (%s)", (x_user_email,))
    finally:
        conn.close()

    return x_user_email
