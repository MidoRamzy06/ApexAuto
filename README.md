# ApexAuto – Garage Service Reception & Repair Records

ApexAuto is an accessible, usable records-management web application designed for a busy automotive service reception and repair workshop. Built to **WCAG 2.1 Level AA** standards with a focus on keyboard navigation, screen-reader compatibility (NVDA/VoiceOver), dynamic form disclosure, and Nielsen's usability heuristics.

---

## Features & Accessibility Highlights

- **Semantic HTML5 & Landmarks:** Strictly structured `<header>`, `<nav>`, `<main>`, `<footer>`, `<dialog>`, and non-skipping heading hierarchy (`h1` $\rightarrow$ `h2`).
- **Screen Reader Support (ARIA):** Polite (`role="status"`, `aria-live="polite"`) and assertive (`role="alert"`) live announcements for all dynamic operations (search, sort, filter, mark collected, delete).
- **Gov.uk Accessible Error Summary:** Form validation aggregates into an accessible summary with direct jump links to invalid inputs.
- **Dynamic Field Disclosure:** Selecting "Other / Custom repair" dynamically reveals the custom work description input with `aria-expanded` and screen-reader announcements.
- **Visual & Keyboard Accessibility:** 
  - Dual-layer high-contrast focus rings (`:focus-visible`).
  - Strict color contrast ratios exceeding 4.5:1 (text) and 3.0:1 (UI borders).
  - Non-color dependent statuses with explicit text and high contrast borders (`IN PROGRESS`, `AWAITING COLLECTION`, `COMPLETED`).
  - Seamless 200% browser zoom reflow and responsive mobile table card transformation.
- **Persistence & API:** Lightweight Python FastAPI backend backed by SQLite with 45+ seed records.

---

## 1. Running Locally

### Prerequisites
- Python 3.9+
- Pip

### Setup Steps
```powershell
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run automated test suite
pytest test_app.py

# 3. Start local development server
uvicorn main:app --reload --port 8000
```
Open **`http://127.0.0.1:8000`** in your browser.

- Sign in with any username and password (simulated authentication).
- Select **Service advisor** for standard booking and completion tasks.
- Select **Manager** to test elevated permissions (record deletion).

---

## 2. Generating the Written Submission PDF

The formal Accessibility Statement and Evaluation Report is maintained in `ACCESSIBILITY_REPORT.md` and compiled to `ACCESSIBILITY_REPORT.pdf`:

```powershell
python generate_pdf.py
```
This produces the formatted `ACCESSIBILITY_REPORT.pdf` ready for Canvas submission.

---

## 3. Production Deployment Guide (DigitalOcean + Namecheap + HTTPS)

The coursework requires deployment to a live server with a registered domain:

### Step A: Server & Domain Setup
1. **Host (e.g. DigitalOcean Droplet):** Create an Ubuntu 22.04 LTS droplet. Note its public IPv4 address.
2. **Domain (e.g. Namecheap):** Purchase a domain and configure an **A Record** pointing `@` and `www` to your droplet's public IP address.

### Step B: Droplet Configuration
SSH into your droplet:
```bash
ssh root@your_droplet_ip
```

Install server packages:
```bash
apt update && apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx
```

Copy your project files to `/srv/apexauto` and configure virtual environment:
```bash
mkdir -p /srv/apexauto
# (Copy project files via git, rsync, or scp)
cd /srv/apexauto
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step C: Create Systemd Service for FastAPI
Create `/etc/systemd/system/apexauto.service`:
```ini
[Unit]
Description=ApexAuto FastAPI Application
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/srv/apexauto
ExecStart=/srv/apexauto/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
systemctl daemon-reload
systemctl enable apexauto
systemctl start apexauto
```

### Step D: Nginx Reverse Proxy & SSL (HTTPS)
Create `/etc/nginx/sites-available/apexauto`:
```nginx
server {
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site and obtain a free SSL certificate:
```bash
ln -s /etc/nginx/sites-available/apexauto /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Your application is now live at `https://yourdomain.com`.

---

## 4. File Manifest

- `main.py` – FastAPI backend with SQLite persistence, derived status SQL, and Pydantic validation.
- `public/index.html` – Valid, semantic HTML5 structure with ARIA live regions and modal dialogs.
- `public/styles.css` – Accessible stylesheet using design tokens, dual focus indicators, and mobile table reflow.
- `public/app.js` – Vanilla JavaScript client with hash router, error summaries, and dynamic disclosures.
- `data/apexauto.db` – SQLite persistent database containing repair records.
- `ACCESSIBILITY_REPORT.md` – Full VPAT-style statement and usability evaluation text.
- `ACCESSIBILITY_REPORT.pdf` – Compiled PDF deliverable.
- `test_app.py` – 12-point automated test suite covering backend logic and accessibility rules.
