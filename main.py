
"""
ApexAuto API - Service Reception & Vehicle Repair Records.
Built with FastAPI + SQLite for server-side persistence.
Accessible & Usable Records Management Coursework.
"""
import sqlite3
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, Header, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, model_validator

BASE = Path(__file__).parent
DB_PATH = BASE / "data" / "apexauto.db"

app = FastAPI(title="ApexAuto Service Reception API")

# Whitelist of sortable columns: prevent SQL injection
SORT_COLUMNS = {
    "customer": "customer_name",
    "reg_number": "reg_number",
    "due_date": "due_date",
    "status": "status",
    "service_type": "service_type"
}

# Status is derived from dates and completion timestamps to prevent data desynchronization
STATUS_SQL = """CASE WHEN completed_at IS NOT NULL THEN 'Completed'
                     WHEN due_date < :today THEN 'Awaiting collection'
                     ELSE 'In progress' END"""


def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    """Create the repair orders table and seed 45 realistic records on first run."""
    DB_PATH.parent.mkdir(exist_ok=True)
    with db() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            service_type TEXT NOT NULL,
            service_other TEXT,
            reg_number TEXT NOT NULL,
            intake_checklist TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            booked_in TEXT NOT NULL,
            due_date TEXT NOT NULL,
            completed_at TEXT
        )""")

        if con.execute("SELECT COUNT(*) FROM orders").fetchone()[0]:
            return

        customers = [
            ("Marcus Vance", "07700900123"),
            ("Sarah Jenkins", "07700900234"),
            ("Amir Khan", "07700900345"),
            ("Emma Watson", "07700900456"),
            ("Liam O'Connor", "07700900567"),
            ("Priya Patel", "07700900678"),
            ("Daniel Craig", "07700900789"),
            ("Rachel Adams", "07700900890"),
            ("Carlos Gomez", "07700900901"),
            ("Fiona Campbell", "07700900012")
        ]

        services = [
            ("Full Annual Service", "ANN"),
            ("MOT Inspection", "MOT"),
            ("Brake & Tyre Service", "BRK"),
            ("Engine Diagnostics", "ENG")
        ]

        today = date.today()

        for i in range(45):
            cust_name, cust_phone = customers[i % 10]
            svc_name, prefix = services[i % 4]
            booked = today - timedelta(days=(i * 2) % 18)
            duration_days = [1, 3, 7][i % 3]
            due = booked + timedelta(days=duration_days)

            reg_num = f"{prefix[:2]}{20 + (i % 5)} " f"{chr(65 + (i % 26))}{chr(65 + ((i * 3) % 26))}{chr(65 + ((i * 7) % 26))}"

            checklist = []
            if i % 2 == 0:
                checklist.append("Key tag attached")
            if i % 3 == 0:
                checklist.append("Locking wheel nut present")
            if i % 4 == 0:
                checklist.append("Valet wash requested")

            # Determine completed state: roughly 1/3 completed, 1/3 awaiting collection (overdue pickup), 1/3 in progress
            completed_date = None
            if i % 3 == 0:
                completed_date = booked.isoformat()

            con.execute("""INSERT INTO orders (
                customer_name, phone_number, service_type, reg_number,
                intake_checklist, notes, booked_in, due_date, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
                cust_name, cust_phone, svc_name, reg_num,
                ",".join(checklist), "Customer noted occasional squeak from front left.",
                booked.isoformat(), due.isoformat(), completed_date
            ))


init_db()


class OrderIn(BaseModel):
    """Server-side schema validation mirroring client rules."""
    customer_name: str = Field(min_length=2, max_length=80)
    phone_number: str
    service_type: Literal[
        "Full Annual Service",
        "MOT Inspection",
        "Brake & Tyre Service",
        "Engine Diagnostics",
        "Other"
    ]
    service_other: Optional[str] = None
    reg_number: str
    turnaround_days: Literal[1, 3, 7]
    intake_checklist: List[Literal[
        "Key tag attached",
        "Locking wheel nut present",
        "Valet wash requested",
        "Courtesy car issued"
    ]] = []
    notes: str = Field(default="", max_length=300)

    @field_validator("phone_number")
    @classmethod
    def check_phone(cls, v):
        digits = "".join(filter(str.isdigit, v))
        if len(digits) < 10 or len(digits) > 13:
            raise ValueError("Enter a valid telephone number (at least 10 digits).")
        return v.strip()

    @field_validator("reg_number")
    @classmethod
    def check_reg(cls, v):
        cleaned = v.strip().upper()
        if len(cleaned) < 4 or len(cleaned) > 10:
            raise ValueError("Enter a valid vehicle registration plate (e.g. AB12 CDE).")
        return cleaned

    @model_validator(mode="after")
    def check_other_description(self):
        if self.service_type == "Other" and not (self.service_other or "").strip():
            raise ValueError("Provide a description of the custom work required.")
        return self


@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    """Standardized error format for accessibility error summary binding."""
    errors = [
        {
            "field": str(e["loc"][-1]) if len(e["loc"]) > 1 else "form",
            "message": e["msg"].replace("Value error, ", "")
        }
        for e in exc.errors()
    ]
    return JSONResponse({"errors": errors}, status_code=422)


def fail(status_code: int, field: str, message: str):
    return JSONResponse({"errors": [{"field": field, "message": message}]}, status_code=status_code)


def row_out(row):
    d = dict(row)
    d["intake_checklist"] = [item for item in (d["intake_checklist"] or "").split(",") if item]
    d["service"] = d["service_other"] if d["service_type"] == "Other" else d["service_type"]
    return d


@app.get("/api/orders")
def list_orders(
    q: str = "",
    status: str = "",
    sort: str = "due_date",
    order: str = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50)
):
    col = SORT_COLUMNS.get(sort, "due_date")
    direction = "DESC" if order == "desc" else "ASC"

    where = ["1=1"]
    params: Dict[str, Any] = {"today": date.today().isoformat()}

    if q.strip():
        where.append("(customer_name LIKE :q OR phone_number LIKE :q OR reg_number LIKE :q)")
        params["q"] = f"%{q.strip()}%"

    if status in ("In progress", "Awaiting collection", "Completed"):
        where.append("status = :status")
        params["status"] = status

    base_query = f"SELECT *, {STATUS_SQL} AS status FROM orders"

    with db() as con:
        total = con.execute(f"SELECT COUNT(*) FROM ({base_query}) WHERE {' AND '.join(where)}", params).fetchone()[0]
        params.update(limit=page_size, offset=(page - 1) * page_size)
        rows = con.execute(
            f"SELECT * FROM ({base_query}) WHERE {' AND '.join(where)} ORDER BY {col} {direction}, id LIMIT :limit OFFSET :offset",
            params
        ).fetchall()

    return {"items": [row_out(r) for r in rows], "total": total}


@app.post("/api/orders", status_code=201)
def create_order(order: OrderIn):
    today = date.today()
    reg = order.reg_number.strip().upper()

    with db() as con:
        # Error prevention (Nielsen Heuristic #5): cannot check in the same car twice if job is already active
        active_conflict = con.execute(
            "SELECT 1 FROM orders WHERE reg_number=? AND completed_at IS NULL",
            (reg,)
        ).fetchone()

        if active_conflict:
            return fail(409, "reg_number", f"Vehicle {reg} is already currently booked in. Mark existing job complete first.")

        cur = con.execute("""INSERT INTO orders (
            customer_name, phone_number, service_type, service_other, reg_number,
            intake_checklist, notes, booked_in, due_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
            order.customer_name.strip(),
            order.phone_number.strip(),
            order.service_type,
            (order.service_other or "").strip() or None,
            reg,
            ",".join(order.intake_checklist),
            order.notes.strip(),
            today.isoformat(),
            (today + timedelta(days=order.turnaround_days)).isoformat()
        ))

        row = con.execute(
            f"SELECT *, {STATUS_SQL} AS status FROM orders WHERE id=:id",
            {"id": cur.lastrowid, "today": today.isoformat()}
        ).fetchone()

    return row_out(row)


@app.patch("/api/orders/{order_id}/complete")
def complete_order(order_id: int):
    with db() as con:
        cur = con.execute(
            "UPDATE orders SET completed_at=? WHERE id=? AND completed_at IS NULL",
            (date.today().isoformat(), order_id)
        )
    return {"ok": True} if cur.rowcount else fail(404, "form", "Repair order not found or already completed.")


@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, x_role: str = Header(default="")):
    # Role-based check: Only managers can permanently delete repair orders
    if x_role != "Manager":
        return fail(403, "form", "Only workshop managers have permission to delete service orders.")
    with db() as con:
        cur = con.execute("DELETE FROM orders WHERE id=?", (order_id,))
    return {"ok": True} if cur.rowcount else fail(404, "form", "Repair order not found.")


@app.get("/api/stats")
def stats():
    with db() as con:
        rows = con.execute(
            f"SELECT status, COUNT(*) as cnt FROM (SELECT {STATUS_SQL} AS status FROM orders) GROUP BY status",
            {"today": date.today().isoformat()}
        ).fetchall()
    counts = {r["status"]: r["cnt"] for r in rows}
    return {
        "in_progress": counts.get("In progress", 0),
        "awaiting_collection": counts.get("Awaiting collection", 0),
        "completed": counts.get("Completed", 0)
    }


# Static front end mount
app.mount("/", StaticFiles(directory=BASE / "public", html=True), name="static")
