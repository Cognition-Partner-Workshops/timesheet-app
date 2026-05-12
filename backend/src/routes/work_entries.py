from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from src.database import get_connection
from src.dependencies import get_authenticated_user
from src.schemas import CreateWorkEntryRequest, UpdateWorkEntryRequest

router = APIRouter(prefix="/api/work-entries", tags=["work-entries"])


def _fetch_entry_with_client(cur, entry_id: int) -> Optional[dict]:
    cur.execute(
        "SELECT we.id, we.client_id, we.hours, we.description, we.date, "
        "we.created_at, we.updated_at, c.name as client_name "
        "FROM work_entries we JOIN clients c ON we.client_id = c.id "
        "WHERE we.id = %s",
        (entry_id,),
    )
    return cur.fetchone()


@router.get("/")
def get_work_entries(
    clientId: Optional[int] = Query(default=None),
    user_email: str = Depends(get_authenticated_user),
):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            query = (
                "SELECT we.id, we.client_id, we.hours, we.description, we.date, "
                "we.created_at, we.updated_at, c.name as client_name "
                "FROM work_entries we JOIN clients c ON we.client_id = c.id "
                "WHERE we.user_email = %s"
            )
            params: list = [user_email]

            if clientId is not None:
                query += " AND we.client_id = %s"
                params.append(clientId)

            query += " ORDER BY we.date DESC, we.created_at DESC"
            cur.execute(query, params)
            return {"workEntries": cur.fetchall()}
    finally:
        conn.close()


@router.get("/{entry_id}")
def get_work_entry(entry_id: int, user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT we.id, we.client_id, we.hours, we.description, we.date, "
                "we.created_at, we.updated_at, c.name as client_name "
                "FROM work_entries we JOIN clients c ON we.client_id = c.id "
                "WHERE we.id = %s AND we.user_email = %s",
                (entry_id, user_email),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Work entry not found")
            return {"workEntry": row}
    finally:
        conn.close()


@router.post("/", status_code=201)
def create_work_entry(body: CreateWorkEntryRequest, user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM clients WHERE id = %s AND user_email = %s",
                (body.clientId, user_email),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=400, detail="Client not found or does not belong to user"
                )

            cur.execute(
                "INSERT INTO work_entries (client_id, user_email, hours, description, date) "
                "VALUES (%s, %s, %s, %s, %s)",
                (body.clientId, user_email, body.hours, body.description, body.date),
            )
            new_id = cur.lastrowid
            row = _fetch_entry_with_client(cur, new_id)
            return {"message": "Work entry created successfully", "workEntry": row}
    finally:
        conn.close()


@router.put("/{entry_id}")
def update_work_entry(
    entry_id: int,
    body: UpdateWorkEntryRequest,
    user_email: str = Depends(get_authenticated_user),
):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM work_entries WHERE id = %s AND user_email = %s",
                (entry_id, user_email),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Work entry not found")

            data = body.model_dump(exclude_unset=True)
            if not data:
                raise HTTPException(status_code=400, detail="No fields to update")

            if "clientId" in data and data["clientId"] is not None:
                cur.execute(
                    "SELECT id FROM clients WHERE id = %s AND user_email = %s",
                    (data["clientId"], user_email),
                )
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=400, detail="Client not found or does not belong to user"
                    )

            cur.execute(
                "SELECT client_id, hours, description, date FROM work_entries "
                "WHERE id = %s AND user_email = %s",
                (entry_id, user_email),
            )
            current = cur.fetchone()

            cur.execute(
                "UPDATE work_entries SET client_id = %s, hours = %s, description = %s, "
                "date = %s, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = %s AND user_email = %s",
                (
                    data.get("clientId", current["client_id"]),
                    data.get("hours", current["hours"]),
                    data["description"] if "description" in data else current["description"],
                    data.get("date", current["date"]),
                    entry_id,
                    user_email,
                ),
            )
            row = _fetch_entry_with_client(cur, entry_id)
            return {"message": "Work entry updated successfully", "workEntry": row}
    finally:
        conn.close()


@router.delete("/{entry_id}")
def delete_work_entry(entry_id: int, user_email: str = Depends(get_authenticated_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM work_entries WHERE id = %s AND user_email = %s",
                (entry_id, user_email),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Work entry not found")

            cur.execute(
                "DELETE FROM work_entries WHERE id = %s AND user_email = %s",
                (entry_id, user_email),
            )
            return {"message": "Work entry deleted successfully"}
    finally:
        conn.close()
