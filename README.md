# Tool Maintenance & Life Cycle Management System (GP-CoS • LAIR)

[![Platform](https://img.shields.io/badge/Platform-Web%20SPA%20%7C%20Windows-blue.svg)](https://github.com/rahulsudhakar0-jpg/Tool-Maintenance)
[![Domain](https://img.shields.io/badge/Domain-Industrial%20Tooling%20%26%20Dies-emerald.svg)](https://github.com/rahulsudhakar0-jpg/Tool-Maintenance)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](https://github.com/rahulsudhakar0-jpg/Tool-Maintenance)

A web application designed for industrial tooling management, stamping die maintenance, mold lifecycle tracking, and **GP-CoS (Global Procurement Change of Source) / LAIR (Line Assembly Industrial Readiness)** sample trials.

Extracted and calibrated directly from the plant engineering specifications and trial datasets (`GP-CoS -LAIR preparation.xlsx`).

---

## 📸 Key Capabilities & Features

### 1. 📊 Operations & Telemetry Dashboard
* **Real-Time KPIs**: Total Tool Assets (18 parts), Critical Tools count (7 high-precision mechanisms), PM Compliance Rate (94.2%), and Total Samples dispatched to JR-TH plant (130 pcs).
* **Life Cycle Stroke Gauges**: Interactive visual comparison of accumulated strokes vs maximum certified tool service life limits.
* **Criticality Matrix**: Dynamic distribution breakdown between `CRITICAL`, `MAJOR`, and `MINOR` tooling.
* **Immediate Attention Alert Table**: Flags tooling operating at $\ge 80\%$ stroke life or marked for urgent regrinding and alignment.

### 2. 🛠️ Tools & Dies Registry
* **Dual View Modes**: Switch between rich visual **Card Grid** and dense industrial **Data Table**.
* **Instant Filtering & Search**: Filter by criticality level, operational health status (`Operational`, `Maintenance Due`, `Critical Attention`, `Trial In Progress`, `Pipeline Pending`), and live text search across Part Numbers, Tool IDs, and raw materials.
* **Tool Detail & Specs Modal**: Detailed tooling telemetry including press machine tonnage (e.g. 110T, 160T, 200T), die cavity counts, raw material specs (Copper C1100, Spring Steel SK5, SUS304, AISI 4140), and specific maintenance logs.
* **Full CRUD Operations**: Register new tools and edit existing tool parameters anytime.

### 3. 📋 Preventive & Corrective Maintenance Work Orders (PM/CM)
* **Interactive Maintenance Checklists**: Multi-point inspection checklists (crack inspection, ultrasonic cleaning, guide pillar play, cutting clearance, lubrication).
* **Priority & Status Tracking**: Track urgent corrective repairs (`URGENT`, `HIGH`, `MEDIUM`) with technician assignments and target due dates.
* **One-Click Completion**: Marking a work order as completed automatically logs the downtime in the audit trail, resets maintenance status, and updates stroke counters.

### 4. 🔄 GP-CoS / LAIR Sample Trial Pipeline
* **Stage Tracking**: Monitors sample batches sent to the **JR-TH plant** through physical receipt, prototype assembly, functional safety testing, and sample submission.
* **Sample Count Ledger**: Dispatched vs required quantities per part number.

### 5. 🔬 High-Resolution Component Visual Inspection Gallery
* **Actual CAD & Component Photographs**: Embedded high-resolution images for tooling components (shaft clamps, door lock levers, UVR latches, slide plates, arc stacks, terminals).
* **Interactive Lightbox**: Pan, Zoom In, Zoom Out, and examine fine blanking and forming profiles directly in the browser.

### 6. 📜 Maintenance Logs & Audit Trail
* **Chronological History**: Complete historical record of all die regrinds, punch sharpening, spring replacements, clearance checks, and downtime hours.
* **Audit Logging**: Add manual maintenance events with technician sign-off.

### 7. 📥 Exporting & Printing
* **Data Export**: One-click download of the entire database in **CSV** or **JSON** format.
* **Printable Maintenance Job Sheets**: Formatted for standard A4 printing (`Ctrl+P` or via the top navigation bar) for toolroom technicians and quality audits.

---

## 📂 Project Structure

```text
├── index.html          # Main Single-Page Application interface
├── styles.css          # Industrial design system and responsive styles
├── app.js              # Application controller, state management & reactive logic
├── data.js             # Initial dataset extracted from GP-CoS -LAIR preparation.xlsx
├── server.ps1          # Lightweight zero-dependency PowerShell HTTP server & API
├── start_app.bat       # Windows 1-click launcher batch script
├── excel_data.json     # Extracted Excel JSON manifest & image anchor coordinates
├── images/             # Extracted high-resolution component CAD & tooling photos
│   ├── image1.png      # Lock, Shaft (48187082AA)
│   ├── image2.png      # Lever, Door Lock (48187077AA)
│   ├── image3.png      # Striker-Plate (48187083AA)
│   ├── image4.png      # Plate, Cam (48187099AA)
│   ├── image5.png      # Clamp, Shaft (48187081AA)
│   ├── ...             # Remaining tooling images 6-14
├── GP-CoS -LAIR preparation.xlsx # Original plant tooling spreadsheet
└── README.md           # Documentation
```

---

## 🚀 Quick Start Guide

### Option 1: 1-Click Launch (Recommended on Windows)
Simply double-click:
```cmd
start_app.bat
```
This automatically starts the local HTTP server (`server.ps1`) and launches your browser at `http://localhost:8080/`.

### Option 2: Run via PowerShell
Open PowerShell in the project directory and run:
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

### Option 3: Direct Browser Launch (Zero-Server / Offline)
Double-click `index.html` or open it directly in Google Chrome / Edge / Firefox. The application runs locally with `localStorage` persistence.

---

## 🛠️ Tooling & Part Specifications Included

| Part Number | Description | Criticality | Tool ID | Press / Machine | Pipeline Status |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **S1A28862** | Terminal plug-in low rating | **MAJOR** | `DIE-TRM-8862-A` | 110T Komatsu | Sent to JR-TH |
| **S1A28863** | Terminal plug-in high rating | **MAJOR** | `DIE-TRM-8863-B` | 160T Aida | Sent to JR-TH |
| **GHJ16013AA** | Spreader1 4P | **MINOR** | `MLD-SPR-6013-1` | 80T Chin Fong | Sent to JR-TH |
| **GHJ16016AA** | Spreader4 4P | **MINOR** | `MLD-SPR-6016-4` | 80T Chin Fong | Sent to JR-TH |
| **GHJ16014AA** | Spreader2 4P | **MINOR** | `MLD-SPR-6014-2` | 80T Chin Fong | Sent to JR-TH |
| **GHJ16015AA** | Spreader3 4P | **MINOR** | `MLD-SPR-6015-3` | 80T Chin Fong | Sent to JR-TH |
| **48187114AA** | PLATE, SLIDE | **MINOR** | `DIE-PLT-7114` | 160T Aida | Finished Trial |
| **48187099AA** | PLATE, CAM | **MINOR** | `DIE-CAM-7099` | 160T Aida | Sent to JR-TH |
| **48187081AA** | CLAMP, SHAFT | **CRITICAL** | `DIE-CLP-7081-CRIT` | 200T Komatsu | Sent to JR-TH |
| **48187077AA** | LEVER, DOOR LOCK | **CRITICAL** | `DIE-LVR-7077-CRIT` | 110T Komatsu | Sent to JR-TH |
| **48187083AA** | STRIKER-PLATE | **MINOR** | `DIE-STK-7083` | 160T Aida | Sent to JR-TH |
| **48187082AA** | LOCK, SHAFT | **CRITICAL** | `DIE-LCK-7082-CRIT` | 200T Komatsu | Sent to JR-TH |
| **48187087AA** | LEVER, SHAFT RELEASE | **CRITICAL** | `DIE-REL-7087-CRIT` | 160T Aida | Finished Trial |
| **48187076AA** | LATCH, UVR | **CRITICAL** | `DIE-UVR-7076-CRIT` | 110T Komatsu | Prep in progress |
| **S1B22575** | TERMINAL (with Silver Tip) | **MAJOR** | `DIE-TRM-2575-ST` | 110T Komatsu | Prep in progress |
| **S1B22372** | TERMINAL (W/O Silver Tip) | **MAJOR** | `DIE-TRM-2372-WO` | 110T Komatsu | Prep in progress |
| **S1A23987** | ARC STACK LOW | **CRITICAL** | `DIE-ARC-3987-CRIT` | 160T Aida | Prep in progress |
| **48187145AA** | STAPLE | **CRITICAL** | `DIE-STP-7145-CRIT` | 60T Bihler | Prep in progress |

---

## 📤 Pushing to GitHub

To push this project to your repository at [rahulsudhakar0-jpg/Tool-Maintenance](https://github.com/rahulsudhakar0-jpg/Tool-Maintenance):

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial release of Tool Maintenance web application for GP-CoS LAIR"

# Set main branch and remote
git branch -M main
git remote add origin https://github.com/rahulsudhakar0-jpg/Tool-Maintenance.git

# Push to GitHub
git push -u origin main
```

---
*Developed for Industrial Maintenance and Toolroom Excellence.*
