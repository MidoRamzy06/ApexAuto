# ApexAuto — Accessible Service Reception & Repair Records

[![WCAG 2.1 Level AA](https://img.shields.io/badge/WCAG%202.1-Level%20AA%20Compliant-14532d?style=for-the-badge)](https://www.w3.org/WAI/WCAG21/quickref/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-0284c7?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-0f172a?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20ES6+-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tests](https://img.shields.io/badge/Tests-12%20Passed-16a34a?style=for-the-badge)](test_app.py)

An administrative records-management web application designed for automotive garage service reception desks. Engineered from the ground up to achieve strict **WCAG 2.1 Level AA** accessibility conformance, high operational usability based on **Nielsen’s 10 Usability Heuristics**, and persistent server-side record management.

---

## 🌟 Key Highlights

- **Accessibility-First Design:** Strict HTML5 landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`), robust keyboard navigation, dynamic ARIA state management (`aria-expanded`, `aria-sort`, `aria-live`), and a zero-trap native `<dialog>` modal.
- **Gov.uk Accessible Error Summaries:** Form submission errors are aggregated at the top of the viewport with clickable jump-links that smoothly scroll and focus the invalid input.
- **Dynamic Disclosure:** Custom mechanical fault input reveals smoothly with auditory screen-reader notification (`aria-controls`, `aria-expanded`).
- **High-Legibility Typography:** Uses Braille Institute’s *Atkinson Hyperlegible* typeface to ensure high legibility for low-vision users.
- **Dual-Layer Focus Visible:** Custom 3px focus indicator paired with an offset halo ensuring contrast exceeding 7:1 across dark and light surfaces.
- **Responsive Card Reflow:** Data tables automatically reflow into stacked, self-contained cards on viewports under 768px (or at 200% browser zoom) using CSS pseudo-elements.
- **Enterprise SQLite Persistence:** Real backend database with derived status tracking (`In progress`, `Awaiting collection`, `Completed`), role-based access control, and duplicate booking prevention.

---

## 📑 Live Demo & Conformance Report

- **Live Application:** [Deploy URL placeholder — e.g. https://apexauto-reception.onrender.com]
- **Formal VPAT Statement & Evaluation Report:** See [`ACCESSIBILITY_REPORT.md`](ACCESSIBILITY_REPORT.md) or the pre-compiled [`ACCESSIBILITY_REPORT.pdf`](ACCESSIBILITY_REPORT.pdf).

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5 Semantic Elements | Zero-dependency accessible landmarks and Gov.uk pattern structures |
| **Styling** | Resilient CSS3 Design Tokens | Atkinson Hyperlegible, dual-layer focus rings, card reflow, 44px touch targets |
| **Client Logic** | Vanilla ES6+ (Strict Mode) | Hash router, focus restoration, live announcements, debounced search |
| **Backend API** | Python 3 + FastAPI | REST endpoints, Pydantic data validation, role gating |
| **Database** | SQLite3 | Relational persistence with 45 seed records and derived state logic |
| **Automated Testing** | pytest + HTMLParser | Automated validation, CRUD, role checks, and DOM accessibility audits |

---

## ♿ WCAG 2.1 Level AA Compliance Summary

| WCAG Criterion | Status | Implementation in ApexAuto |
| :--- | :---: | :--- |
| **1.1.1 Non-Text Content** | **Pass** | All non-text glyphs carry `aria-hidden="true"`; buttons use `.sr-only` descriptive helper spans. |
| **1.3.1 Info & Relationships** | **Pass** | Semantic landmarks, strict heading hierarchy (`h1` $\rightarrow$ `h2`), explicit `<label for="...">`, and scoped table headers (`<th scope="col">`, `<th scope="row">`). |
| **1.4.1 Use of Color** | **Pass** | Status badges pair color with prominent text labels; form errors include textual `"Error: "` prefixes. |
| **1.4.3 Contrast (Minimum)** | **Pass** | Deep slate primary text achieves **16.5:1** (AAA standard). Muted labels achieve **7.3:1**. |
| **1.4.4 Resize Text** | **Pass** | Relative sizing (`rem`) throughout; scales up to 200% zoom without clipping or horizontal scrolling. |
| **1.4.10 Reflow** | **Pass** | Multi-column layouts collapse to single column at 320px; tables reflow into accessible cards. |
| **2.1.1 Keyboard** | **Pass** | 100% operable via keyboard (<kbd>Tab</kbd>, <kbd>Shift+Tab</kbd>, <kbd>Space</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>). |
| **2.1.2 No Keyboard Trap** | **Pass** | Native `<dialog>` modal traps focus while open and returns focus to the initiating button upon dismissal. |
| **2.4.1 Bypass Blocks** | **Pass** | Skip link (`Skip to main content`) is the first interactive element on page load. |
| **2.4.2 Page Titled** | **Pass** | Dynamic `<title>` updates on client-side route transitions (e.g. `Workshop Dashboard – ApexAuto`). |
| **2.4.3 Focus Order** | **Pass** | Route changes shift focus to the view’s primary `<h1>`; modal close restores focus to the trigger. |
| **2.4.7 Focus Visible** | **Pass** | Dual-layer high-contrast ring (`outline: 3px solid #0044cc; box-shadow: 0 0 0 2px #ffffff`). |
| **3.3.1 & 3.3.3 Error Recovery** | **Pass** | Actionable inline feedback and an aggregated Gov.uk-style Error Summary with jump-to-field links. |
| **4.1.3 Status Messages** | **Pass** | Pre-rendered live regions (`role="status"`, `role="alert"`) notify assistive technology without shifting focus. |

---

## 🚀 Local Setup & Installation

### Prerequisites
- Python 3.10 or newer
- Git

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/ApexAuto.git
cd ApexAuto
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the development server
```bash
uvicorn main:app --reload --port 8000
```
Open your browser at [http://127.0.0.1:8000](http://127.0.0.1:8000).

---

## 🧪 Automated Testing Suite

The project includes an end-to-end automated test suite covering database seeding, schema validation, role-based authorization, error prevention (duplicate booking rejection), and an HTML semantic structure audit:

```bash
pytest test_app.py -v
```

All 12 tests run and pass in under 1 second.

---

## 🔒 Role-Based Authorization Model

The application features a simulated authentication model designed to demonstrate access control:
- **Service Advisor:** Can book in customer vehicles, view all service records, filter/search triage lists, and mark jobs as completed.
- **Workshop Manager:** Holds elevated permissions to permanently delete completed records with a confirmation dialog.

---

## 📄 License
Academic coursework submission. Released under the MIT License.
