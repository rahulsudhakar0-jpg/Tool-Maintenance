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

### 8. 🔗 Multi-Source Data Linking (105 Tools & Real Tool Shots)
* **Primary Parts Registry**: Linked from Google Sheet `1GJT6p_Yfn7Lda-kYgH7-lFofOO0GOn1ZfwWjTlGXm2c` (JRTL Tooling List) containing all 105 production tools across STL (Schneider Electric), SumiRiko (Automotive), SEMB (Coils), JOYSON (Safety Systems), and TESLA.
* **Real Tool Shots in Column AD**: Linked from `Tool Shot Tempalte-Jinrong CH-TH(9).xlsx` (and online Google Sheets), tracking actual die stroke counters from **Column AD** (`46266`), **Column AI** (`Current total Tool Shot`), **Column AH** (`Warranty Tool Shots`), and **Column F** (`ActualToolShot`).
* **Technical Specifications**: Press Tonnage (80T - 500T), Mech No (#1 - #8), Speed (SPM), Cavities, Tooling Size (L*W*H), Material Model (SPCC, SPFC, SPHC, C1100, T2Y2), Thickness, Blanking Clearance, PPEP No, Designer, and Plating Supplier.
* **Over-Warranty & Wear Alarms**: Automatically calculates usage ratio and flags tooling reaching $\ge 90\%$ (Critical Attention) or $\ge 70\%$ (Maintenance Due) with 22 automated corrective work orders.

### 9. 📊 Google Sheets as Live Cloud Database
* **Cloud Persistence**: Use any Google Sheet as a live, collaborative, multi-user database for tools, work orders, and maintenance logs.
* **Bi-Directional Synchronization**: Push local data to Google Sheets or pull live changes directly into the web application.
* **Automated Web App API**: Powered by a lightweight Google Apps Script (`google_apps_script.js`) with zero third-party dependencies.

---

## 📂 Project Structure

```text
├── index.html              # Main Single-Page Application interface
├── styles.css              # Industrial design system and responsive styles
├── app.js                  # Application controller, state management & reactive logic
├── data.js                 # Complete linked dataset (105 tools, 22 work orders, specs)
├── excel_data.json         # Linked JSON manifest with metadata and tooling records
├── google_apps_script.js   # Two-way sync backend for Google Sheets
├── build_full_dataset.ps1  # Automated data linker between Google Sheet and Tool Shot template
├── server.ps1              # Lightweight zero-dependency PowerShell HTTP server & API
├── start_app.bat           # Windows 1-click launcher batch script
├── images/                 # Component CAD & tooling photos
├── GP-CoS -LAIR preparation.xlsx # Original plant tooling spreadsheet
├── new_sheet.csv           # JRTL 105 Tooling List source data
└── README.md               # Documentation
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

## 🛠️ Sample Linked Tooling Assets (from 105 JRTL Tools)

| SL | Part Number | Part Name | Customer | Linked Die ID | Press Tonnage | Col AD Shots | Total Strokes | Warranty Life | Health Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **1** | `51207084` | Fixed Contact | **STL** | `S1B38101#2` | 80T (1#) | — | 28,995,167 | 15,000,000 | 🔴 Critical Attention |
| **2** | `51207070AB` | Bimetal Support Greco | **STL** | `51207070#5` | 110T (4#) | — | 12,336,580 | 15,000,000 | 🟡 Maintenance Due |
| **3** | `48187088&7089` | MECH SIDE L/R | **STL** | `48187088&89#4` | 150T (6#) | — | 9,409,415 | 15,000,000 | 🟢 Operational |
| **4** | `48187061AA` | PRIMARY LATCH | **STL** | `48187061#4` | 110T (3#) | — | 4,378,954 | 15,000,000 | 🟢 Operational |
| **5** | `48187096AA` | MIDDLE TERMINAL | **STL** | `48187096#3` | 80T (1#) | — | 17,957,990 | 5,000,000 | 🔴 Critical Attention |
| **6** | `48187055AA` | LOAD TERM-HI-LOW | **STL** | `48187055/255#3` | 80T (1#) | — | 17,320,885 | 5,000,000 | 🔴 Critical Attention |
| **7** | `48187070AA` | Magnet. Loop | **STL** | `48187070#3` | 80T (1#) | — | 10,219,720 | 10,000,000 | 🔴 Critical Attention |
| **11** | `TM-755A-1` | UPPER PLATE | **SumiRiko** | `DIE-JRTL-011` | 300T (7#) | — | 1,750,000 | 5,000,000 | 🟢 Operational |
| **20** | `51207117AD1` | ARC PLATE | **STL** | `51207117#5` | 110T | — | 16,394,097 | 70,000,000 | 🟢 Operational |
| **31** | `48187063AA` | Armature High Amp | **STL** | `48187063#4` | 110T (3#) | — | 3,884,008 | 5,000,000 | 🟡 Maintenance Due |
| **33** | `48187058` | CRADLE | **STL** | `48187058#4` | 110T (3#) | — | 9,920,668 | 5,000,000 | 🔴 Critical Attention |
| **105** | `0135-0800005` | 3DU RESOLVER COVER | **TESLA** | `DIE-JRTL-105` | 160T | — | 3,500,000 | 10,000,000 | 🟢 Operational |

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
