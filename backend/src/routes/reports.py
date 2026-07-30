import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fpdf import FPDF

from src.database import get_connection
from src.dependencies import get_authenticated_user

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _get_client_and_entries(user_email: str, client_id: int):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name FROM clients WHERE id = %s AND user_email = %s",
                (client_id, user_email),
            )
            client = cur.fetchone()
            if not client:
                raise HTTPException(status_code=404, detail="Client not found")

            cur.execute(
                "SELECT id, hours, description, date, created_at, updated_at "
                "FROM work_entries WHERE client_id = %s AND user_email = %s "
                "ORDER BY date DESC",
                (client_id, user_email),
            )
            entries = cur.fetchall()
            return client, entries
    finally:
        conn.close()


@router.get("/client/{client_id}")
def get_client_report(client_id: int, user_email: str = Depends(get_authenticated_user)):
    client, entries = _get_client_and_entries(user_email, client_id)
    total_hours = sum(float(e["hours"]) for e in entries)
    return {
        "client": client,
        "workEntries": entries,
        "totalHours": total_hours,
        "entryCount": len(entries),
    }


@router.get("/export/csv/{client_id}")
def export_csv(client_id: int, user_email: str = Depends(get_authenticated_user)):
    client, entries = _get_client_and_entries(user_email, client_id)

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["Date", "Hours", "Description", "Created At"])
    writer.writeheader()
    for e in entries:
        writer.writerow({
            "Date": str(e["date"]),
            "Hours": str(e["hours"]),
            "Description": e["description"] or "",
            "Created At": str(e["created_at"]),
        })

    safe_name = "".join(c if c.isalnum() else "_" for c in client["name"])
    timestamp = datetime.now(tz=timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    filename = f"{safe_name}_report_{timestamp}.csv"

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/pdf/{client_id}")
def export_pdf(client_id: int, user_email: str = Depends(get_authenticated_user)):
    client, entries = _get_client_and_entries(user_email, client_id)
    total_hours = sum(float(e["hours"]) for e in entries)

    pdf = FPDF()
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 10, f"Time Report for {client['name']}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    pdf.set_font("Helvetica", "", 14)
    pdf.cell(0, 8, f"Total Hours: {total_hours:.2f}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, f"Total Entries: {len(entries)}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, f"Generated: {datetime.now(tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(40, 8, "Date")
    pdf.cell(30, 8, "Hours")
    pdf.cell(0, 8, "Description", new_x="LMARGIN", new_y="NEXT")
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)

    pdf.set_font("Helvetica", "", 11)
    for i, entry in enumerate(entries):
        if pdf.get_y() > 270:
            pdf.add_page()
        y = pdf.get_y()
        pdf.cell(40, 7, str(entry["date"]))
        pdf.cell(30, 7, str(entry["hours"]))
        pdf.cell(0, 7, entry["description"] or "No description", new_x="LMARGIN", new_y="NEXT")
        if (i + 1) % 5 == 0:
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(2)

    safe_name = "".join(c if c.isalnum() else "_" for c in client["name"])
    timestamp = datetime.now(tz=timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    filename = f"{safe_name}_report_{timestamp}.pdf"

    buf = io.BytesIO(pdf.output())
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
