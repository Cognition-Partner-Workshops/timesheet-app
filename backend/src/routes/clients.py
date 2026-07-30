from fastapi import APIRouter, Depends, HTTPException

from src.database import get_connection
from src.dependencies import get_authenticated_user
from src.schemas import CreateClientRequest, UpdateClientRequest

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("/")
def get_clients(user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, description, department, email, created_at, updated_at "
                "FROM clients WHERE user_email = %s ORDER BY name",
                (user_email,),
            )
            return {"clients": cur.fetchall()}
    finally:
        conn.close()


@router.get("/{client_id}")
def get_client(client_id: int, user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, description, department, email, created_at, updated_at "
                "FROM clients WHERE id = %s AND user_email = %s",
                (client_id, user_email),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Client not found")
            return {"client": row}
    finally:
        conn.close()


@router.post("/", status_code=201)
def create_client(body: CreateClientRequest, user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO clients (name, description, department, email, user_email) "
                "VALUES (%s, %s, %s, %s, %s)",
                (body.name, body.description, body.department, body.email, user_email),
            )
            new_id = cur.lastrowid
            cur.execute(
                "SELECT id, name, description, department, email, created_at, updated_at "
                "FROM clients WHERE id = %s",
                (new_id,),
            )
            return {"message": "Client created successfully", "client": cur.fetchone()}
    finally:
        conn.close()


@router.put("/{client_id}")
def update_client(
    client_id: int,
    body: UpdateClientRequest,
    user_email: str = Depends(get_authenticated_user),
):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM clients WHERE id = %s AND user_email = %s",
                (client_id, user_email),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Client not found")

            data = body.model_dump(exclude_unset=True)
            if not data:
                raise HTTPException(status_code=400, detail="No fields to update")

            cur.execute(
                "SELECT id, name, description, department, email FROM clients "
                "WHERE id = %s AND user_email = %s",
                (client_id, user_email),
            )
            current = cur.fetchone()

            cur.execute(
                "UPDATE clients SET name = %s, description = %s, department = %s, "
                "email = %s, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = %s AND user_email = %s",
                (
                    data.get("name", current["name"]),
                    data["description"] if "description" in data else current["description"],
                    data["department"] if "department" in data else current["department"],
                    data["email"] if "email" in data else current["email"],
                    client_id,
                    user_email,
                ),
            )
            cur.execute(
                "SELECT id, name, description, department, email, created_at, updated_at "
                "FROM clients WHERE id = %s",
                (client_id,),
            )
            return {"message": "Client updated successfully", "client": cur.fetchone()}
    finally:
        conn.close()


@router.delete("/")
def delete_all_clients(user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM clients WHERE user_email = %s", (user_email,))
            return {"message": "All clients deleted successfully", "deletedCount": cur.rowcount}
    finally:
        conn.close()


@router.delete("/{client_id}")
def delete_client(client_id: int, user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM clients WHERE id = %s AND user_email = %s",
                (client_id, user_email),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Client not found")

            cur.execute(
                "DELETE FROM clients WHERE id = %s AND user_email = %s",
                (client_id, user_email),
            )
            return {"message": "Client deleted successfully"}
    finally:
        conn.close()
