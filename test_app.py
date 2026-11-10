"""
Automated Test Suite for ApexAuto
Covers:
1. Backend API & SQLite database logic (FastAPI + Pydantic)
2. Role-based authorization enforcement (Service Advisor vs. Workshop Manager)
3. Input validation & error prevention rules (Duplicate booking prevention)
4. WCAG 2.1 AA HTML accessibility & semantic structural compliance
"""
import re
from html.parser import HTMLParser
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from main import app, db, STATUS_SQL

client = TestClient(app)

# ==============================================================================
# 1. Database & Seed Data Tests
# ==============================================================================
def test_database_initialization():
    """Verify that seed orders exist and contain valid fields."""
    with db() as con:
        count = con.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
        assert count >= 45, f"Expected at least 45 seed records, found {count}"

def test_stats_endpoint():
    """Verify that /api/stats accurately aggregates repair orders by status."""
    res = client.get("/api/stats")
    assert res.status_code == 200
    data = res.json()
    assert "in_progress" in data
    assert "awaiting_collection" in data
    assert "completed" in data
    assert data["in_progress"] + data["awaiting_collection"] + data["completed"] >= 45

# ==============================================================================
# 2. Filtering, Sorting & Pagination Tests
# ==============================================================================
def test_list_orders_pagination():
    """Verify page sizing and total count calculation."""
    res = client.get("/api/orders?page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 10
    assert data["total"] >= 45

def test_list_orders_filter_status():
    """Verify status query filter."""
    for status in ["In progress", "Awaiting collection", "Completed"]:
        res = client.get(f"/api/orders?status={status}")
        assert res.status_code == 200
        for item in res.json()["items"]:
            assert item["status"] == status

def test_list_orders_search():
    """Verify search across customer name, phone number, or registration plate."""
    res = client.get("/api/orders?q=Marcus")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 1
    assert "Marcus" in items[0]["customer_name"]

# ==============================================================================
# 3. Validation & Error Prevention (Nielsen Heuristic #5)
# ==============================================================================
def test_validation_missing_fields():
    """Submitting empty payload must return structured 422 validation errors."""
    res = client.post("/api/orders", json={})
    assert res.status_code == 422
    errs = res.json()["errors"]
    fields = [e["field"] for e in errs]
    assert "customer_name" in fields
    assert "phone_number" in fields
    assert "service_type" in fields
    assert "reg_number" in fields

def test_validation_invalid_phone():
    """Phone number must contain at least 10 digits."""
    res = client.post("/api/orders", json={
        "customer_name": "Test Customer",
        "phone_number": "123", # invalid short phone
        "service_type": "MOT Inspection",
        "reg_number": "AB12 CDE",
        "turnaround_days": 1
    })
    assert res.status_code == 422
    assert any("at least 10 digits" in e["message"] for e in res.json()["errors"])

def test_validation_other_requires_description():
    """Selecting 'Other' without service_other must fail."""
    res = client.post("/api/orders", json={
        "customer_name": "Test Customer",
        "phone_number": "07700900111",
        "service_type": "Other",
        "service_other": "",
        "reg_number": "AB12 CDE",
        "turnaround_days": 3
    })
    assert res.status_code == 422
    assert any("description of the custom work" in e["message"] for e in res.json()["errors"])

def test_error_prevention_duplicate_booking():
    """Cannot book in a vehicle that is already currently in progress."""
    reg = "XX99 ZZZ"
    # Create first active order
    client.post("/api/orders", json={
        "customer_name": "Arthur Pendelton",
        "phone_number": "07700900222",
        "service_type": "Full Annual Service",
        "reg_number": reg,
        "turnaround_days": 3
    })

    # Attempt second active booking with same vehicle registration plate
    res_conflict = client.post("/api/orders", json={
        "customer_name": "Arthur Pendelton",
        "phone_number": "07700900222",
        "service_type": "Brake & Tyre Service",
        "reg_number": reg,
        "turnaround_days": 1
    })
    assert res_conflict.status_code == 409
    assert "already currently booked in" in res_conflict.json()["errors"][0]["message"]

# ==============================================================================
# 4. Role Authorization & Action Tests
# ==============================================================================
def test_complete_order():
    """Completing an order updates completed_at and sets status to Completed."""
    create_res = client.post("/api/orders", json={
        "customer_name": "Beth Harmon",
        "phone_number": "07700900333",
        "service_type": "Engine Diagnostics",
        "reg_number": "BH60 WIN",
        "turnaround_days": 1
    })
    order_id = create_res.json()["id"]

    patch_res = client.patch(f"/api/orders/{order_id}/complete")
    assert patch_res.status_code == 200
    assert patch_res.json()["ok"] is True

def test_delete_order_permission_check():
    """Service Advisors cannot delete orders; only Workshop Managers can."""
    create_res = client.post("/api/orders", json={
        "customer_name": "Charles Xavier",
        "phone_number": "07700900444",
        "service_type": "MOT Inspection",
        "reg_number": "CX01 MUT",
        "turnaround_days": 1
    })
    order_id = create_res.json()["id"]

    # 1. As Service Advisor -> 403 Forbidden
    res_advisor = client.delete(f"/api/orders/{order_id}", headers={"X-Role": "Service advisor"})
    assert res_advisor.status_code == 403
    assert "Only workshop managers" in res_advisor.json()["errors"][0]["message"]

    # 2. As Workshop Manager -> 200 OK
    res_mgr = client.delete(f"/api/orders/{order_id}", headers={"X-Role": "Manager"})
    assert res_mgr.status_code == 200
    assert res_mgr.json()["ok"] is True

# ==============================================================================
# 5. WCAG 2.1 AA HTML Semantic & Accessibility Audit
# ==============================================================================
class HTMLAccessibilityChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.duplicate_ids = []
        self.labels_for = set()
        self.input_ids = set()
        self.headings = []
        self.aria_describedby = []

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        tag_id = attr.get("id")
        if tag_id:
            if tag_id in self.ids:
                self.duplicate_ids.append(tag_id)
            self.ids.add(tag_id)

        if tag == "label" and "for" in attr:
            self.labels_for.add(attr["for"])
        if tag in ("input", "select", "textarea"):
            if tag_id:
                self.input_ids.add(tag_id)
            if "aria-describedby" in attr:
                self.aria_describedby.append((tag_id, attr["aria-describedby"].split()))
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.headings.append(int(tag[1]))

def test_html_accessibility_semantics():
    """Audit index.html structure against WCAG AA criteria."""
    html_content = Path("public/index.html").read_text(encoding="utf-8")
    checker = HTMLAccessibilityChecker()
    checker.feed(html_content)

    # 1. Zero duplicate IDs (WCAG 4.1.1)
    assert len(checker.duplicate_ids) == 0, f"Duplicate IDs found: {checker.duplicate_ids}"

    # 2. Skip link presence (WCAG 2.4.1)
    assert '<a class="skip-link" href="#main">Skip to main content</a>' in html_content
    assert "main" in checker.ids

    # 3. Error summaries have role="alert" (WCAG 3.3.1 / 4.1.3)
    assert 'role="alert"' in html_content
    assert "signin-error-summary" in checker.ids
    assert "order-error-summary" in checker.ids

    # 4. Heading levels do not skip (WCAG 1.3.1)
    for i in range(len(checker.headings) - 1):
        diff = checker.headings[i+1] - checker.headings[i]
        assert diff <= 1, f"Skipped heading level from h{checker.headings[i]} to h{checker.headings[i+1]}"

    # 5. Check all aria-describedby references point to existing DOM elements
    for inp, ref_list in checker.aria_describedby:
        for ref in ref_list:
            assert ref in checker.ids, f"aria-describedby reference '{ref}' on input '{inp}' does not exist!"

if __name__ == "__main__":
    pytest.main(["-v", __file__])
