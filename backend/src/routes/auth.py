from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from src.database import get_connection
from src.dependencies import get_authenticated_user
from src.schemas import LoginRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT email, created_at FROM users WHERE email = %s", (body.email,))
            row = cur.fetchone()

            if row:
                return {
                    "message": "Login successful",
                    "user": {"email": row["email"], "createdAt": str(row["created_at"])},
                }

            cur.execute("INSERT INTO users (email) VALUES (%s)", (body.email,))
            return {
                "message": "User created and logged in successfully",
                "user": {"email": body.email, "createdAt": datetime.now(tz=timezone.utc).isoformat()},
            }
    finally:
        conn.close()


@router.get("/me")
def get_me(user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT email, created_at FROM users WHERE email = %s", (user_email,))
            row = cur.fetchone()
            if not row:
                return {"error": "User not found"}, 404
            return {
                "user": {"email": row["email"], "createdAt": str(row["created_at"])},
            }
    finally:
        conn.close()
