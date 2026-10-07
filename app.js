/**
 * Tool Maintenance Web Application - Main Application Logic
 * Integrates with data.js, supports LocalStorage and REST API sync
 */

// Application State
let appState = {
  tools: [],
  workOrders: [],
  maintenanceHistory: [],
  currentTab: 'dashboard',
  viewMode: localStorage.getItem('tool_maint_view_mode') || 'table',
  activeToolId: null,
  zoomScale: 1.0,
  googleSheetsUrl: localStorage.getItem('tool_maint_gs_url') || '',
  sortColumn: null,
  sortDirection: 'asc',
  columnFilters: {},
  visibleColumns: {
    year: true,
    image: true,
    partNumber: true,
    partName: true,
    customer: true,
    matchedToolShotId: true,
    pressTonnage: true,
    colAD_ToolShot: true,
    currentTotalShot: true,
    warrantyToolShots: true,
    strokesCurrent: true,
    strokeWearPercent: true,
    healthStatus: true
  }
};

// Charts references
let strokeChartInstance = null;
let donutChartInstance = null;

// ==========================================================================
// Initialization
// ==========================================================================

function initApp() {
  initData();
  setupNavigation();
  setViewMode(appState.viewMode);
  initFitMode();
  renderCurrentTab();
  updateSidebarBadges();
  updateGoogleSheetsBadge();
  setupGlobalClickHandlers();
  syncSlideBar();
  checkAutoOeeSync();

  // If Google Sheets URL is set, fetch latest data in background
  if (appState.googleSheetsUrl) {
    testAndFetchGoogleSheets(true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initData() {
  const DATA_VERSION = 'v7_filter_views_column_sorting';
  const savedVersion = localStorage.getItem('tool_maint_data_version');
  const savedTools = localStorage.getItem('tool_maint_tools');
  const savedWO = localStorage.getItem('tool_maint_workorders');
  const savedHist = localStorage.getItem('tool_maint_history');
  const savedCols = localStorage.getItem('tool_maint_visible_columns');

  if (savedCols) {
    try {
      appState.visibleColumns = Object.assign(appState.visibleColumns, JSON.parse(savedCols));
    } catch (e) {}
  }

  let isLoaded = false;
  if (savedVersion === DATA_VERSION && savedTools && savedWO && savedHist) {
    try {
      const parsedTools = JSON.parse(savedTools);
      // Ensure we have the full 253 multi-year dataset, not an old 18-part cache
      if (Array.isArray(parsedTools) && parsedTools.length >= 200) {
        appState.tools = parsedTools;
        appState.workOrders = JSON.parse(savedWO) || [];
        appState.maintenanceHistory = JSON.parse(savedHist) || [];
        isLoaded = true;
      }
    } catch (e) {
      console.warn('Failed to parse localStorage, resetting to initial data', e);
    }
  }

  if (!isLoaded) {
    loadInitialData();
    localStorage.setItem('tool_maint_data_version', DATA_VERSION);
  }
}

function loadInitialData() {
  const initial = typeof INITIAL_DATA !== 'undefined' ? INITIAL_DATA : (typeof window !== 'undefined' ? window.INITIAL_DATA : null);
  if (initial && initial.tools) {
    appState.tools = Array.isArray(initial.tools) ? JSON.parse(JSON.stringify(initial.tools)) : [];
    appState.workOrders = Array.isArray(initial.workOrders) ? JSON.parse(JSON.stringify(initial.workOrders)) : [];
    appState.maintenanceHistory = Array.isArray(initial.maintenanceHistory) ? JSON.parse(JSON.stringify(initial.maintenanceHistory)) : [];
    saveState();
  }
}

function saveState() {
  localStorage.setItem('tool_maint_tools', JSON.stringify(appState.tools));
  localStorage.setItem('tool_maint_workorders', JSON.stringify(appState.workOrders));
  localStorage.setItem('tool_maint_history', JSON.stringify(appState.maintenanceHistory));
  updateSidebarBadges();

  // Auto-sync to Google Sheets in background if configured
  if (appState.googleSheetsUrl) {
    pushToGoogleSheets(true);
  }

  // Try background sync with PowerShell API server if available
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tools: appState.tools,
      workOrders: appState.workOrders,
      maintenanceHistory: appState.maintenanceHistory
    })
  }).catch(() => {
    // Offline or static file mode - silent ignore
  });
}

function updateSidebarBadges() {
  const toolsCount = document.getElementById('sidebar-tools-count');
  if (toolsCount) toolsCount.textContent = appState.tools.length;

  const woBadge = document.getElementById('sidebar-wo-badge');
  const activeWOs = appState.workOrders.filter(w => w.status !== 'Completed').length;
  if (woBadge) woBadge.textContent = activeWOs;
}

// ==========================================================================
// Navigation & Tab Switching
// ==========================================================================

function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  appState.currentTab = tabId;

  // Update active state in sidebar
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  // Hide all tab views
  document.querySelectorAll('.tab-view').forEach(view => {
    view.style.display = 'none';
  });

  // Show target tab
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) targetView.style.display = 'block';

  // Update Header text
  const titles = {
    dashboard: { title: 'Dashboard & Operations Overview', subtitle: 'Real-time status of tooling assets, PM compliance, and LAIR sample pipeline' },
    registry: { title: 'Tools & Dies Registry', subtitle: 'Comprehensive database of stamping dies, molds, specifications and life cycles' },
    workorders: { title: 'Maintenance Work Orders (PM/CM)', subtitle: 'Manage scheduled preventive maintenance and urgent corrective work' },
    pipeline: { title: 'GP-CoS / LAIR Trial & Pipeline', subtitle: 'Global procurement change of source prototype trials and plant submission tracker' },
    gallery: { title: 'Component Visual Inspection Gallery', subtitle: 'CAD models, component captures and visual quality standards' },
    history: { title: 'Maintenance Audit Logs & History', subtitle: 'Chronological toolroom records, repairs, regrinds, and technician actions' }
  };

  const meta = titles[tabId] || titles.dashboard;
  document.getElementById('current-page-title').textContent = meta.title;
  document.getElementById('current-page-subtitle').textContent = meta.subtitle;

  renderCurrentTab();
}

function renderCurrentTab() {
  switch (appState.currentTab) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'registry':
      renderRegistry();
      break;
    case 'workorders':
      renderWorkOrders();
      break;
    case 'pipeline':
      renderPipeline();
      break;
    case 'gallery':
      renderGallery();
      break;
    case 'history':
      renderHistory();
      break;
  }
}

// ==========================================================================
// Tab 1: Dashboard Rendering & Charts
// ==========================================================================

function renderDashboard() {
  // Update KPIs
  const total = appState.tools.length;
  const critical = appState.tools.filter(t => t.criticality === 'CRITICAL').length;
  const activeWOs = appState.workOrders.filter(w => w.status !== 'Completed').length;
  
  const samplesSent = appState.tools
    .filter(t => t.pipelineStatus === 'Sent to JR-TH')
    .reduce((sum, t) => sum + (Number(t.samplesQty) || 0), 0);

  document.getElementById('kpi-total-tools').textContent = total;
  const subtext = document.getElementById('kpi-total-subtext');
  if (subtext) {
    const t24 = appState.tools.filter(t => String(t.year) === '2024').length;
    const t25 = appState.tools.filter(t => String(t.year) === '2025').length;
    const t26 = appState.tools.filter(t => String(t.year) === '2026').length;
    subtext.innerHTML = `<span>${t24} (2024) • ${t25} (2025) • ${t26} (2026)</span>`;
  }
  document.getElementById('kpi-critical-tools').textContent = critical;
  document.getElementById('kpi-active-wo').textContent = activeWOs;
  document.getElementById('kpi-samples-sent').textContent = `${samplesSent} pcs`;

  // Render Urgent Tools Table
  const urgentTbody = document.getElementById('urgent-tools-tbody');
  urgentTbody.innerHTML = '';

  const urgentTools = appState.tools.filter(t => {
    const strokePct = (t.strokesCurrent / t.strokesMax) * 100;
    return t.healthStatus === 'Critical Attention' || t.healthStatus === 'Maintenance Due' || strokePct >= 80;
  });

  urgentTools.forEach(t => {
    const strokePct = Math.min(100, Math.round((t.strokesCurrent / t.strokesMax) * 100));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="part-code">${t.partNumber}</strong></td>
      <td>${t.description}</td>
      <td><code>${t.toolId}</code></td>
      <td>${getCriticalityBadge(t.criticality)}</td>
      <td>
        <div class="stroke-meter" style="width: 140px;">
          <div class="stroke-meta">
            <span>${t.strokesCurrent.toLocaleString()} / ${t.strokesMax.toLocaleString()}</span>
            <span><strong>${strokePct}%</strong></span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${getStrokeColor(strokePct)}" style="width: ${strokePct}%"></div>
          </div>
        </div>
      </td>
      <td>${getHealthStatusPill(t.healthStatus)}</td>
      <td>${t.assignedTech}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="openToolDetailModal('${t.id}')">Inspect</button>
      </td>
    `;
    urgentTbody.appendChild(tr);
  });

  // Render Charts
  initCharts();
}

function initCharts() {
  if (typeof Chart === 'undefined') return;

  // Chart 1: Top Stroke Utilization Bar Chart
  const topStrokesTools = [...appState.tools]
    .sort((a, b) => (b.strokesCurrent / b.strokesMax) - (a.strokesCurrent / a.strokesMax))
    .slice(0, 7);

  const labels = topStrokesTools.map(t => t.partNumber);
  const currentStrokes = topStrokesTools.map(t => t.strokesCurrent);
  const maxStrokes = topStrokesTools.map(t => t.strokesMax);

  const ctxBar = document.getElementById('strokeChart');
  if (ctxBar) {
    if (strokeChartInstance) strokeChartInstance.destroy();
    strokeChartInstance = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Current Strokes',
            data: currentStrokes,
            backgroundColor: '#2563eb',
            borderRadius: 4
          },
          {
            label: 'Service Life Limit',
            data: maxStrokes,
            backgroundColor: '#e2e8f0',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              afterLabel: function(context) {
                const tool = topStrokesTools[context.dataIndex];
                return `Desc: ${tool.description} (${tool.criticality})`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: val => val.toLocaleString()
            }
          }
        }
      }
    });
  }

  // Chart 2: Criticality Donut Chart
  const critCount = { CRITICAL: 0, MAJOR: 0, MINOR: 0 };
  appState.tools.forEach(t => {
    const c = (t.criticality || '').toUpperCase();
    if (c === 'CRITICAL') critCount.CRITICAL++;
    else if (c === 'MAJOR') critCount.MAJOR++;
    else critCount.MINOR++;
  });

  const legCrit = document.getElementById('donut-legend-crit');
  const legMajor = document.getElementById('donut-legend-major');
  const legMinor = document.getElementById('donut-legend-minor');
  if (legCrit) legCrit.textContent = `● Critical (${critCount.CRITICAL})`;
  if (legMajor) legMajor.textContent = `● Major (${critCount.MAJOR})`;
  if (legMinor) legMinor.textContent = `● Standard / Minor (${critCount.MINOR})`;

  const ctxDonut = document.getElementById('criticalityDonut');
  if (ctxDonut) {
    if (donutChartInstance) donutChartInstance.destroy();
    donutChartInstance = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'Major', 'Standard / Minor'],
        datasets: [{
          data: [critCount.CRITICAL, critCount.MAJOR, critCount.MINOR],
          backgroundColor: ['#ef4444', '#f59e0b', '#0ea5e9'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

// ==========================================================================
// Tab 2: Tools & Dies Registry Rendering
// ==========================================================================

function renderRegistry() {
  filterTools();
}

function filterTools() {
  const searchInput = document.getElementById('registry-search');
  const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const yearFilter = document.getElementById('filter-year')?.value || 'ALL';
  const pressFilter = document.getElementById('filter-press')?.value || 'ALL';
  const colAdFilter = document.getElementById('filter-col-ad')?.value || 'ALL';
  const custFilter = document.getElementById('filter-customer')?.value || 'ALL';
  const statusFilter = document.getElementById('filter-status')?.value || 'ALL';
  const critFilter = document.getElementById('filter-criticality')?.value || 'ALL';

  const filtered = appState.tools.filter(t => {
    // Search Term
    if (searchTerm) {
      const pNum = (t.partNumber || '').toLowerCase();
      const desc = (t.description || t.partName || '').toLowerCase();
      const tId = (t.toolId || '').toLowerCase();
      const cust = (t.customer || '').toLowerCase();
      const die = (t.matchedToolShotId || '').toLowerCase();
      const press = (t.pressTonnage || '').toLowerCase();
      const mech = (t.mechNo || '').toLowerCase();
      const mat = (t.material || '').toLowerCase();

      const matched = pNum.includes(searchTerm) ||
                      desc.includes(searchTerm) ||
                      tId.includes(searchTerm) ||
                      cust.includes(searchTerm) ||
                      die.includes(searchTerm) ||
                      press.includes(searchTerm) ||
                      mech.includes(searchTerm) ||
                      mat.includes(searchTerm);
      if (!matched) return false;
    }

    // Year Filter
    if (yearFilter !== 'ALL' && String(t.year) !== String(yearFilter)) {
      return false;
    }

    // Press / Mech Filter
    if (pressFilter !== 'ALL') {
      const pTonnage = (t.pressTonnage || '').toUpperCase();
      const mech = (t.mechNo || '').toUpperCase();
      if (pressFilter === '80T') {
        const is80 = pTonnage.includes('80') || mech.includes('1#') || mech.includes('2#');
        if (!is80) return false;
      } else if (pressFilter === '110T') {
        const is110 = pTonnage.includes('110') || ['3#', '4#', '5#', '9#', '13#'].some(m => mech.includes(m));
        if (!is110) return false;
      } else if (pressFilter === '150T') {
        const is150 = pTonnage.includes('150') || mech.includes('6#');
        if (!is150) return false;
      } else if (pressFilter === '200T') {
        const is200 = pTonnage.includes('200') || mech.includes('11#') || mech.includes('12#');
        if (!is200) return false;
      } else if (pressFilter === '260T+') {
        const isHeavy = pTonnage.includes('260') || pTonnage.includes('300') || pTonnage.includes('500');
        if (!isHeavy) return false;
      }
    }

    // Col AD Shots Filter
    if (colAdFilter !== 'ALL') {
      const hasShots = Boolean(t.colAD_ToolShot && Number(t.colAD_ToolShot) > 0);
      if (colAdFilter === 'HAS_COL_AD' && !hasShots) return false;
      if (colAdFilter === 'NO_COL_AD' && hasShots) return false;
    }

    // Customer Filter
    if (custFilter !== 'ALL') {
      const c = (t.customer || '').toUpperCase();
      if (custFilter === 'STL' && !c.includes('STL')) return false;
      else if (custFilter === 'SumiRiko' && !c.includes('SUMIRIKO')) return false;
      else if (custFilter === 'SEMB' && !c.includes('SEMB')) return false;
      else if (custFilter === 'JOYSON' && !c.includes('JOYSON')) return false;
      else if (custFilter === 'TESLA' && !c.includes('TESLA')) return false;
      else if (custFilter === 'TSKT' && !c.includes('TSKT')) return false;
      else if (!c.includes(custFilter.toUpperCase())) return false;
    }

    // Health Status Filter
    if (statusFilter !== 'ALL' && t.healthStatus !== statusFilter) {
      return false;
    }

    // Criticality Filter
    if (critFilter !== 'ALL' && (t.criticality || '').toUpperCase() !== critFilter.toUpperCase()) {
      return false;
    }

    // Column Filters from popovers
    if (appState.columnFilters) {
      for (const key in appState.columnFilters) {
        const val = appState.columnFilters[key];
        if (!val || val === 'ALL') continue;
        if (key === 'partNumber' && !t.partNumber.toLowerCase().includes(val.toLowerCase())) return false;
        if (key === 'partName' && !(t.description || t.partName || '').toLowerCase().includes(val.toLowerCase())) return false;
        if (key === 'matchedToolShotId') {
          if (val === 'LINKED') {
            if (!t.matchedToolShotId) return false;
          } else if (!(t.matchedToolShotId || t.toolId || '').toLowerCase().includes(val.toLowerCase())) {
            return false;
          }
        }
        if (key === 'strokeWearPercent') {
          const wear = (Number(t.strokesCurrent) / (Number(t.strokesMax) || 1)) * 100;
          if (val === 'OVER_LIMIT' && wear < 100) return false;
          if (val === 'HIGH_WEAR' && (wear < 80 || wear >= 100)) return false;
          if (val === 'NORMAL' && wear >= 80) return false;
        }
        if (key === 'strokesRange') {
          const strokes = Number(t.strokesCurrent) || 0;
          if (val === 'OVER_10M' && strokes < 10000000) return false;
          if (val === 'OVER_1M' && strokes < 1000000) return false;
          if (val === 'UNDER_1M' && strokes >= 1000000) return false;
        }
      }
    }

    return true;
  });

  // Sorting
  if (appState.sortColumn) {
    filtered.sort((a, b) => {
      let valA, valB;
      switch (appState.sortColumn) {
        case 'year':
          valA = Number(a.year) || 0;
          valB = Number(b.year) || 0;
          break;
        case 'partNumber':
          valA = (a.partNumber || '').toLowerCase();
          valB = (b.partNumber || '').toLowerCase();
          break;
        case 'partName':
          valA = (a.description || a.partName || '').toLowerCase();
          valB = (b.description || b.partName || '').toLowerCase();
          break;
        case 'customer':
          valA = (a.customer || '').toLowerCase();
          valB = (b.customer || '').toLowerCase();
          break;
        case 'matchedToolShotId':
          valA = (a.matchedToolShotId || a.toolId || '').toLowerCase();
          valB = (b.matchedToolShotId || b.toolId || '').toLowerCase();
          break;
        case 'pressTonnage':
          valA = parseInt(String(a.pressTonnage || '').replace(/\D/g, '')) || 0;
          valB = parseInt(String(b.pressTonnage || '').replace(/\D/g, '')) || 0;
          break;
        case 'colAD_ToolShot':
          valA = Number(a.colAD_ToolShot) || 0;
          valB = Number(b.colAD_ToolShot) || 0;
          break;
        case 'currentTotalShot':
          valA = Number(a.currentTotalShot != null ? a.currentTotalShot : a.strokesCurrent) || 0;
          valB = Number(b.currentTotalShot != null ? b.currentTotalShot : b.strokesCurrent) || 0;
          break;
        case 'warrantyToolShots':
          valA = Number(a.warrantyToolShots || a.strokesMax) || 0;
          valB = Number(b.warrantyToolShots || b.strokesMax) || 0;
          break;
        case 'strokesCurrent':
          valA = Number(a.strokesCurrent) || 0;
          valB = Number(b.strokesCurrent) || 0;
          break;
        case 'strokeWearPercent':
          valA = (Number(a.strokesCurrent) / (Number(a.strokesMax) || 1)) * 100;
          valB = (Number(b.strokesCurrent) / (Number(b.strokesMax) || 1)) * 100;
          break;
        case 'healthStatus':
          valA = (a.healthStatus || '').toLowerCase();
          valB = (b.healthStatus || '').toLowerCase();
          break;
        default:
          valA = '';
          valB = '';
      }

      if (valA < valB) return appState.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return appState.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  updateSortAndFilterIndicators();
  updateActiveFilterChips(filtered.length);
  renderToolsGrid(filtered);
  renderToolsTable(filtered);
  applyColumnVisibility();
  syncSlideBar();
}

function sortTable(colKey) {
  if (appState.sortColumn === colKey) {
    appState.sortDirection = appState.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    appState.sortColumn = colKey;
    const isNum = ['colAD_ToolShot', 'currentTotalShot', 'warrantyToolShots', 'strokesCurrent', 'strokeWearPercent', 'year'].includes(colKey);
    appState.sortDirection = isNum ? 'desc' : 'asc';
  }
  filterTools();
}

function updateSortAndFilterIndicators() {
  const sortCols = ['year', 'partNumber', 'partName', 'customer', 'matchedToolShotId', 'pressTonnage', 'colAD_ToolShot', 'currentTotalShot', 'warrantyToolShots', 'strokesCurrent', 'strokeWearPercent', 'healthStatus'];
  
  sortCols.forEach(col => {
    const icon = document.getElementById(`sort-icon-${col}`);
    const th = document.querySelector(`th[data-col="${col}"]`);
    const filterBtn = document.getElementById(`btn-col-filter-${col}`);

    if (icon) {
      if (appState.sortColumn === col) {
        icon.textContent = appState.sortDirection === 'asc' ? '▲' : '▼';
        if (th) th.classList.add('th-sorted');
      } else {
        icon.textContent = '↕';
        if (th) th.classList.remove('th-sorted');
      }
    }

    let isFiltered = false;
    const yearVal = document.getElementById('filter-year')?.value;
    const pressVal = document.getElementById('filter-press')?.value;
    const colAdVal = document.getElementById('filter-col-ad')?.value;
    const custVal = document.getElementById('filter-customer')?.value;
    const statusVal = document.getElementById('filter-status')?.value;

    if (col === 'year' && yearVal && yearVal !== 'ALL') isFiltered = true;
    if (col === 'pressTonnage' && pressVal && pressVal !== 'ALL') isFiltered = true;
    if (col === 'colAD_ToolShot' && colAdVal && colAdVal !== 'ALL') isFiltered = true;
    if (col === 'customer' && custVal && custVal !== 'ALL') isFiltered = true;
    if (col === 'healthStatus' && statusVal && statusVal !== 'ALL') isFiltered = true;
    if (appState.columnFilters && appState.columnFilters[col] && appState.columnFilters[col] !== 'ALL') isFiltered = true;

    if (filterBtn) {
      filterBtn.classList.toggle('active', isFiltered);
    }
    if (th) {
      th.classList.toggle('th-filtered', isFiltered);
    }
  });
}

function updateActiveFilterChips(filteredCount) {
  const badgeText = document.getElementById('filter-count-text');
  const chipsContainer = document.getElementById('active-filter-chips');
  if (!badgeText || !chipsContainer) return;

  const total = appState.tools.length;
  if (filteredCount === total) {
    badgeText.textContent = `Showing all ${total} Tools`;
  } else {
    badgeText.textContent = `Showing ${filteredCount} of ${total} Tools`;
  }

  const chips = [];

  const presetVal = document.getElementById('filter-view-preset')?.value;
  if (presetVal && presetVal !== 'ALL') {
    const presetLabel = document.getElementById('filter-view-preset')?.selectedOptions[0]?.textContent || presetVal;
    chips.push(`<span class="filter-chip">View: ${presetLabel} <span class="filter-chip-remove" onclick="removeFilter('preset')">✕</span></span>`);
  }

  const yearVal = document.getElementById('filter-year')?.value;
  if (yearVal && yearVal !== 'ALL') {
    chips.push(`<span class="filter-chip">Year: ${yearVal} <span class="filter-chip-remove" onclick="removeFilter('year')">✕</span></span>`);
  }

  const pressVal = document.getElementById('filter-press')?.value;
  if (pressVal && pressVal !== 'ALL') {
    chips.push(`<span class="filter-chip">Press: ${pressVal} <span class="filter-chip-remove" onclick="removeFilter('press')">✕</span></span>`);
  }

  const colAdVal = document.getElementById('filter-col-ad')?.value;
  if (colAdVal && colAdVal !== 'ALL') {
    const label = colAdVal === 'HAS_COL_AD' ? 'Has Col AD Shots' : 'No Col AD Data';
    chips.push(`<span class="filter-chip">Col AD: ${label} <span class="filter-chip-remove" onclick="removeFilter('colAd')">✕</span></span>`);
  }

  const custVal = document.getElementById('filter-customer')?.value;
  if (custVal && custVal !== 'ALL') {
    chips.push(`<span class="filter-chip">Customer: ${custVal} <span class="filter-chip-remove" onclick="removeFilter('customer')">✕</span></span>`);
  }

  const statusVal = document.getElementById('filter-status')?.value;
  if (statusVal && statusVal !== 'ALL') {
    chips.push(`<span class="filter-chip">Status: ${statusVal} <span class="filter-chip-remove" onclick="removeFilter('status')">✕</span></span>`);
  }

  const critVal = document.getElementById('filter-criticality')?.value;
  if (critVal && critVal !== 'ALL') {
    chips.push(`<span class="filter-chip">Criticality: ${critVal} <span class="filter-chip-remove" onclick="removeFilter('criticality')">✕</span></span>`);
  }

  const searchVal = document.getElementById('registry-search')?.value;
  if (searchVal && searchVal.trim()) {
    chips.push(`<span class="filter-chip">Search: "${searchVal.trim()}" <span class="filter-chip-remove" onclick="removeFilter('search')">✕</span></span>`);
  }

  if (appState.columnFilters) {
    for (const k in appState.columnFilters) {
      const v = appState.columnFilters[k];
      if (v && v !== 'ALL') {
        chips.push(`<span class="filter-chip">${k}: ${v} <span class="filter-chip-remove" onclick="clearColumnFilter('${k}')">✕</span></span>`);
      }
    }
  }

  if (appState.sortColumn) {
    const colLabels = {
      year: 'Year', partNumber: 'Part No', partName: 'Part Name', customer: 'Customer',
      matchedToolShotId: 'Linked Die', pressTonnage: 'Press', colAD_ToolShot: 'Col AD Shots',
      currentTotalShot: 'Col AI Total', warrantyToolShots: 'Col AH Warranty',
      strokesCurrent: 'Strokes', strokeWearPercent: 'Life %', healthStatus: 'Status'
    };
    const cName = colLabels[appState.sortColumn] || appState.sortColumn;
    const arrow = appState.sortDirection === 'asc' ? '▲' : '▼';
    chips.push(`<span class="filter-chip" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">Sort: ${cName} ${arrow} <span class="filter-chip-remove" onclick="removeFilter('sort')">✕</span></span>`);
  }

  chipsContainer.innerHTML = chips.join('');
}

function removeFilter(type) {
  if (type === 'preset') {
    const el = document.getElementById('filter-view-preset');
    if (el) el.value = 'ALL';
  } else if (type === 'year') {
    const el = document.getElementById('filter-year');
    if (el) el.value = 'ALL';
  } else if (type === 'press') {
    const el = document.getElementById('filter-press');
    if (el) el.value = 'ALL';
  } else if (type === 'colAd') {
    const el = document.getElementById('filter-col-ad');
    if (el) el.value = 'ALL';
  } else if (type === 'customer') {
    const el = document.getElementById('filter-customer');
    if (el) el.value = 'ALL';
  } else if (type === 'status') {
    const el = document.getElementById('filter-status');
    if (el) el.value = 'ALL';
  } else if (type === 'criticality') {
    const el = document.getElementById('filter-criticality');
    if (el) el.value = 'ALL';
  } else if (type === 'search') {
    const el = document.getElementById('registry-search');
    if (el) el.value = '';
  } else if (type === 'sort') {
    appState.sortColumn = null;
    appState.sortDirection = 'asc';
  }
  filterTools();
}

function applyViewPreset(preset) {
  const searchInput = document.getElementById('registry-search');
  const yearSelect = document.getElementById('filter-year');
  const pressSelect = document.getElementById('filter-press');
  const colAdSelect = document.getElementById('filter-col-ad');
  const custSelect = document.getElementById('filter-customer');
  const statusSelect = document.getElementById('filter-status');
  const critSelect = document.getElementById('filter-criticality');

  if (searchInput) searchInput.value = '';
  if (yearSelect) yearSelect.value = 'ALL';
  if (pressSelect) pressSelect.value = 'ALL';
  if (colAdSelect) colAdSelect.value = 'ALL';
  if (custSelect) custSelect.value = 'ALL';
  if (statusSelect) statusSelect.value = 'ALL';
  if (critSelect) critSelect.value = 'ALL';
  appState.columnFilters = {};

  switch (preset) {
    case 'JINRONG_LINKED':
      appState.columnFilters.matchedToolShotId = 'LINKED';
      appState.sortColumn = 'currentTotalShot';
      appState.sortDirection = 'desc';
      break;
    case '150T':
      if (pressSelect) pressSelect.value = '150T';
      appState.sortColumn = 'colAD_ToolShot';
      appState.sortDirection = 'desc';
      break;
    case '110T':
      if (pressSelect) pressSelect.value = '110T';
      appState.sortColumn = 'colAD_ToolShot';
      appState.sortDirection = 'desc';
      break;
    case '80T':
      if (pressSelect) pressSelect.value = '80T';
      appState.sortColumn = 'strokesCurrent';
      appState.sortDirection = 'desc';
      break;
    case 'HEAVY':
      if (pressSelect) pressSelect.value = '260T+';
      break;
    case 'HAS_COL_AD':
      if (colAdSelect) colAdSelect.value = 'HAS_COL_AD';
      appState.sortColumn = 'colAD_ToolShot';
      appState.sortDirection = 'desc';
      break;
    case 'HIGH_WEAR':
      appState.sortColumn = 'strokeWearPercent';
      appState.sortDirection = 'desc';
      appState.columnFilters.strokeWearPercent = 'HIGH_WEAR';
      break;
    case 'OVER_LIMIT':
      if (statusSelect) statusSelect.value = 'Critical Attention';
      appState.sortColumn = 'strokeWearPercent';
      appState.sortDirection = 'desc';
      break;
    case 'STL':
      if (custSelect) custSelect.value = 'STL';
      break;
    case 'AUTO':
      if (custSelect) custSelect.value = 'SumiRiko';
      break;
    case 'CRITICAL':
      if (critSelect) critSelect.value = 'CRITICAL';
      break;
    case 'YEAR_2024':
      if (yearSelect) yearSelect.value = '2024';
      break;
    case 'YEAR_2025':
      if (yearSelect) yearSelect.value = '2025';
      break;
    case 'YEAR_2026':
      if (yearSelect) yearSelect.value = '2026';
      break;
    default:
      appState.sortColumn = null;
      appState.sortDirection = 'asc';
      break;
  }
  filterTools();
}

function resetAllFilters() {
  const searchInput = document.getElementById('registry-search');
  const presetSelect = document.getElementById('filter-view-preset');
  const yearSelect = document.getElementById('filter-year');
  const pressSelect = document.getElementById('filter-press');
  const colAdSelect = document.getElementById('filter-col-ad');
  const custSelect = document.getElementById('filter-customer');
  const statusSelect = document.getElementById('filter-status');
  const critSelect = document.getElementById('filter-criticality');

  if (searchInput) searchInput.value = '';
  if (presetSelect) presetSelect.value = 'ALL';
  if (yearSelect) yearSelect.value = 'ALL';
  if (pressSelect) pressSelect.value = 'ALL';
  if (colAdSelect) colAdSelect.value = 'ALL';
  if (custSelect) custSelect.value = 'ALL';
  if (statusSelect) statusSelect.value = 'ALL';
  if (critSelect) critSelect.value = 'ALL';

  appState.sortColumn = null;
  appState.sortDirection = 'asc';
  appState.columnFilters = {};

  filterTools();
}

function openColFilter(event, colKey) {
  event.stopPropagation();
  const popover = document.getElementById('col-filter-popover');
  if (!popover) return;

  if (popover.dataset.col === colKey && popover.style.display === 'block') {
    closeColFilter();
    return;
  }

  popover.dataset.col = colKey;
  renderColFilterPopoverContent(colKey);

  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  popover.style.display = 'block';

  let left = rect.left + scrollLeft - 180;
  if (left < 10) left = 10;
  if (left + 260 > window.innerWidth) left = window.innerWidth - 270;
  let top = rect.bottom + scrollTop + 6;

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function closeColFilter() {
  const popover = document.getElementById('col-filter-popover');
  if (popover) {
    popover.style.display = 'none';
    popover.dataset.col = '';
  }
}

function renderColFilterPopoverContent(colKey) {
  const popover = document.getElementById('col-filter-popover');
  if (!popover) return;

  const colLabels = {
    year: 'YEAR',
    partNumber: 'PART NUMBER',
    partName: 'PART NAME',
    customer: 'CUSTOMER',
    matchedToolShotId: 'LINKED DIE ID',
    pressTonnage: 'PRESS / MECH',
    colAD_ToolShot: 'COL AD SHOTS',
    currentTotalShot: 'CURRENT TOTAL (COL AI)',
    warrantyToolShots: 'WARRANTY SHOTS (COL AH)',
    strokesCurrent: 'TOTAL STROKES',
    strokeWearPercent: 'LIFE %',
    healthStatus: 'HEALTH STATUS'
  };

  const title = colLabels[colKey] || colKey;
  const isNum = ['colAD_ToolShot', 'currentTotalShot', 'warrantyToolShots', 'strokesCurrent', 'strokeWearPercent', 'year'].includes(colKey);

  const sortAscText = isNum ? '▲ Sort Smallest to Largest' : '▲ Sort A → Z';
  const sortDescText = isNum ? '▼ Sort Largest to Smallest' : '▼ Sort Z → A';

  let optionsHtml = '';

  if (colKey === 'year') {
    const curYear = document.getElementById('filter-year')?.value || 'ALL';
    optionsHtml = `
      <div class="col-filter-section-title">Filter by Year</div>
      <div class="col-filter-options">
        <div class="col-filter-option ${curYear === 'ALL' ? 'active' : ''}" onclick="setDropdownFilter('filter-year', 'ALL')"><span>All Years (253)</span></div>
        <div class="col-filter-option ${curYear === '2024' ? 'active' : ''}" onclick="setDropdownFilter('filter-year', '2024')"><span>2024 (105 Tools)</span></div>
        <div class="col-filter-option ${curYear === '2025' ? 'active' : ''}" onclick="setDropdownFilter('filter-year', '2025')"><span>2025 (126 Tools)</span></div>
        <div class="col-filter-option ${curYear === '2026' ? 'active' : ''}" onclick="setDropdownFilter('filter-year', '2026')"><span>2026 (22 Tools)</span></div>
      </div>
    `;
  } else if (colKey === 'pressTonnage') {
    const curPress = document.getElementById('filter-press')?.value || 'ALL';
    optionsHtml = `
      <div class="col-filter-section-title">Filter by Machine</div>
      <div class="col-filter-options">
        <div class="col-filter-option ${curPress === 'ALL' ? 'active' : ''}" onclick="setDropdownFilter('filter-press', 'ALL')"><span>All Presses</span></div>
        <div class="col-filter-option ${curPress === '150T' ? 'active' : ''}" onclick="setDropdownFilter('filter-press', '150T')"><span>150T (6# STD-150T)</span></div>
        <div class="col-filter-option ${curPress === '110T' ? 'active' : ''}" onclick="setDropdownFilter('filter-press', '110T')"><span>110T (3#, 4#, 5#, 9#, 13#)</span></div>
        <div class="col-filter-option ${curPress === '80T' ? 'active' : ''}" onclick="setDropdownFilter('filter-press', '80T')"><span>80T (1# OCP & 2# MHS)</span></div>
        <div class="col-filter-option ${curPress === '200T' ? 'active' : ''}" onclick="setDropdownFilter('filter-press', '200T')"><span>200T (11# & 12#)</span></div>
        <div class="col-filter-option ${curPress === '260T+' ? 'active' : ''}" onclick="setDropdownFilter('filter-press', '260T+')"><span>260T - 500T Heavy Presses</span></div>
      </div>
    `;
  } else if (colKey === 'colAD_ToolShot') {
    const curColAd = document.getElementById('filter-col-ad')?.value || 'ALL';
    optionsHtml = `
      <div class="col-filter-section-title">Filter by Col AD Good Qty</div>
      <div class="col-filter-options">
        <div class="col-filter-option ${curColAd === 'ALL' ? 'active' : ''}" onclick="setDropdownFilter('filter-col-ad', 'ALL')"><span>All Records</span></div>
        <div class="col-filter-option ${curColAd === 'HAS_COL_AD' ? 'active' : ''}" onclick="setDropdownFilter('filter-col-ad', 'HAS_COL_AD')"><span>Has Col AD Shots (>0)</span></div>
        <div class="col-filter-option ${curColAd === 'NO_COL_AD' ? 'active' : ''}" onclick="setDropdownFilter('filter-col-ad', 'NO_COL_AD')"><span>No Col AD Record</span></div>
      </div>
    `;
  } else if (colKey === 'customer') {
    const curCust = document.getElementById('filter-customer')?.value || 'ALL';
    optionsHtml = `
      <div class="col-filter-section-title">Filter by Customer</div>
      <div class="col-filter-options">
        <div class="col-filter-option ${curCust === 'ALL' ? 'active' : ''}" onclick="setDropdownFilter('filter-customer', 'ALL')"><span>All Customers</span></div>
        <div class="col-filter-option ${curCust === 'STL' ? 'active' : ''}" onclick="setDropdownFilter('filter-customer', 'STL')"><span>STL (Schneider Electric)</span></div>
        <div class="col-filter-option ${curCust === 'SumiRiko' ? 'active' : ''}" onclick="setDropdownFilter('filter-customer', 'SumiRiko')"><span>SumiRiko (Automotive)</span></div>
        <div class="col-filter-option ${curCust === 'SEMB' ? 'active' : ''}" onclick="setDropdownFilter('filter-customer', 'SEMB')"><span>SEMB (Batam Coils)</span></div>
        <div class="col-filter-option ${curCust === 'JOYSON' ? 'active' : ''}" onclick="setDropdownFilter('filter-customer', 'JOYSON')"><span>JOYSON Safety</span></div>
        <div class="col-filter-option ${curCust === 'TESLA' ? 'active' : ''}" onclick="setDropdownFilter('filter-customer', 'TESLA')"><span>TESLA Motors</span></div>
        <div class="col-filter-option ${curCust === 'TSKT' ? 'active' : ''}" onclick="setDropdownFilter('filter-customer', 'TSKT')"><span>TSKT</span></div>
      </div>
    `;
  } else if (colKey === 'healthStatus') {
    const curStatus = document.getElementById('filter-status')?.value || 'ALL';
    optionsHtml = `
      <div class="col-filter-section-title">Filter by Status</div>
      <div class="col-filter-options">
        <div class="col-filter-option ${curStatus === 'ALL' ? 'active' : ''}" onclick="setDropdownFilter('filter-status', 'ALL')"><span>All Statuses</span></div>
        <div class="col-filter-option ${curStatus === 'Operational' ? 'active' : ''}" onclick="setDropdownFilter('filter-status', 'Operational')"><span>Operational</span></div>
        <div class="col-filter-option ${curStatus === 'Maintenance Due' ? 'active' : ''}" onclick="setDropdownFilter('filter-status', 'Maintenance Due')"><span>Maintenance Due</span></div>
        <div class="col-filter-option ${curStatus === 'Critical Attention' ? 'active' : ''}" onclick="setDropdownFilter('filter-status', 'Critical Attention')"><span>Critical Attention</span></div>
      </div>
    `;
  } else if (colKey === 'strokeWearPercent') {
    const curWear = appState.columnFilters?.strokeWearPercent || 'ALL';
    optionsHtml = `
      <div class="col-filter-section-title">Filter by Life %</div>
      <div class="col-filter-options">
        <div class="col-filter-option ${curWear === 'ALL' ? 'active' : ''}" onclick="setColumnFilter('strokeWearPercent', 'ALL')"><span>All Life Levels</span></div>
        <div class="col-filter-option ${curWear === 'OVER_LIMIT' ? 'active' : ''}" onclick="setColumnFilter('strokeWearPercent', 'OVER_LIMIT')"><span>Over Life Limit (>= 100%)</span></div>
        <div class="col-filter-option ${curWear === 'HIGH_WEAR' ? 'active' : ''}" onclick="setColumnFilter('strokeWearPercent', 'HIGH_WEAR')"><span>High Wear (> 80%)</span></div>
        <div class="col-filter-option ${curWear === 'NORMAL' ? 'active' : ''}" onclick="setColumnFilter('strokeWearPercent', 'NORMAL')"><span>Normal (< 80%)</span></div>
      </div>
    `;
  } else if (colKey === 'strokesCurrent') {
    const curRange = appState.columnFilters?.strokesRange || 'ALL';
    optionsHtml = `
      <div class="col-filter-section-title">Filter by Strokes</div>
      <div class="col-filter-options">
        <div class="col-filter-option ${curRange === 'ALL' ? 'active' : ''}" onclick="setColumnFilter('strokesRange', 'ALL')"><span>All Stroke Counts</span></div>
        <div class="col-filter-option ${curRange === 'OVER_10M' ? 'active' : ''}" onclick="setColumnFilter('strokesRange', 'OVER_10M')"><span>> 10,000,000 Strokes</span></div>
        <div class="col-filter-option ${curRange === 'OVER_1M' ? 'active' : ''}" onclick="setColumnFilter('strokesRange', 'OVER_1M')"><span>> 1,000,000 Strokes</span></div>
        <div class="col-filter-option ${curRange === 'UNDER_1M' ? 'active' : ''}" onclick="setColumnFilter('strokesRange', 'UNDER_1M')"><span>< 1,000,000 Strokes</span></div>
      </div>
    `;
  } else {
    const curVal = appState.columnFilters?.[colKey] || '';
    optionsHtml = `
      <div class="col-filter-section-title">Search in ${title}</div>
      <div style="padding: 4px 0 8px;">
        <input type="text" id="col-filter-search-input" value="${curVal}" placeholder="Type to filter..." style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;" oninput="setColumnFilter('${colKey}', this.value)">
      </div>
    `;
  }

  popover.innerHTML = `
    <div class="col-filter-header">
      <span>Filter: ${title}</span>
      <span style="cursor: pointer; font-size: 14px; font-weight: 700;" onclick="closeColFilter()">✕</span>
    </div>

    <button class="col-filter-sort-btn" onclick="executeColSort('${colKey}', 'asc')">
      ${sortAscText}
    </button>
    <button class="col-filter-sort-btn" onclick="executeColSort('${colKey}', 'desc')">
      ${sortDescText}
    </button>

    <div class="col-filter-divider"></div>

    ${optionsHtml}

    <div class="col-filter-actions">
      <button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 8px;" onclick="clearColumnFilter('${colKey}')">Clear</button>
      <button class="btn btn-primary btn-sm" style="font-size: 11px; padding: 3px 8px;" onclick="closeColFilter()">Done</button>
    </div>
  `;
}

function executeColSort(colKey, direction) {
  appState.sortColumn = colKey;
  appState.sortDirection = direction;
  closeColFilter();
  filterTools();
}

function setDropdownFilter(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.value = value;
  closeColFilter();
  filterTools();
}

function setColumnFilter(colKey, value) {
  if (!appState.columnFilters) appState.columnFilters = {};
  if (!value || value === 'ALL') {
    delete appState.columnFilters[colKey];
  } else {
    appState.columnFilters[colKey] = value;
  }
  filterTools();
}

function clearColumnFilter(colKey) {
  if (appState.columnFilters) {
    delete appState.columnFilters[colKey];
  }
  if (colKey === 'year') {
    const el = document.getElementById('filter-year');
    if (el) el.value = 'ALL';
  } else if (colKey === 'pressTonnage') {
    const el = document.getElementById('filter-press');
    if (el) el.value = 'ALL';
  } else if (colKey === 'colAD_ToolShot') {
    const el = document.getElementById('filter-col-ad');
    if (el) el.value = 'ALL';
  } else if (colKey === 'customer') {
    const el = document.getElementById('filter-customer');
    if (el) el.value = 'ALL';
  } else if (colKey === 'healthStatus') {
    const el = document.getElementById('filter-status');
    if (el) el.value = 'ALL';
  }
  closeColFilter();
  filterTools();
}

function toggleColumnMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('columns-dropdown-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function toggleColumnVisibility(colKey, isVisible) {
  appState.visibleColumns[colKey] = isVisible;
  localStorage.setItem('tool_maint_visible_columns', JSON.stringify(appState.visibleColumns));
  applyColumnVisibility();
}

function applyColumnVisibility() {
  const table = document.getElementById('registry-table');
  if (!table) return;

  Object.keys(appState.visibleColumns).forEach(colKey => {
    const isVisible = appState.visibleColumns[colKey];
    const elements = table.querySelectorAll(`[data-col="${colKey}"]`);
    elements.forEach(el => {
      el.style.display = isVisible ? '' : 'none';
    });
  });
}

function initFitMode() {
  const savedFit = localStorage.getItem('tool_maint_fit_mode') === 'true';
  const container = document.getElementById('registry-table-container');
  const fitBtn = document.getElementById('btn-toggle-fit');
  if (savedFit && container) {
    container.classList.add('fit-columns-mode');
    if (fitBtn) {
      fitBtn.classList.add('active');
      fitBtn.innerHTML = '↔ Standard View';
    }
  }
}

function toggleFitAllColumns() {
  const container = document.getElementById('registry-table-container');
  const fitBtn = document.getElementById('btn-toggle-fit');
  if (!container) return;

  const isFit = container.classList.toggle('fit-columns-mode');
  if (fitBtn) {
    fitBtn.classList.toggle('active', isFit);
    fitBtn.innerHTML = isFit ? '↔ Standard View' : '🔍 Fit All Columns';
  }
  localStorage.setItem('tool_maint_fit_mode', isFit ? 'true' : 'false');
  syncSlideBar();
}

function onSlideBarInput(val) {
  const tableContainer = document.getElementById('registry-table-container');
  if (!tableContainer) return;
  const maxScroll = tableContainer.scrollWidth - tableContainer.clientWidth;
  if (maxScroll > 0) {
    tableContainer.scrollLeft = (Number(val) / 1000) * maxScroll;
  }
}

function slideTableStep(offset) {
  const tableContainer = document.getElementById('registry-table-container');
  if (!tableContainer) return;
  tableContainer.scrollBy({ left: offset, behavior: 'smooth' });
}

function syncSlideBar() {
  const tableContainer = document.getElementById('registry-table-container');
  const slider = document.getElementById('table-horizontal-slider');
  if (!tableContainer || !slider) return;
  const maxScroll = tableContainer.scrollWidth - tableContainer.clientWidth;
  if (maxScroll > 5) {
    slider.disabled = false;
    slider.value = Math.min(1000, Math.round((tableContainer.scrollLeft / maxScroll) * 1000));
  } else {
    slider.value = 0;
    slider.disabled = true;
  }
}

function setupGlobalClickHandlers() {
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('col-filter-popover');
    if (popover && popover.style.display === 'block') {
      if (!popover.contains(e.target) && !e.target.closest('.th-filter-btn')) {
        closeColFilter();
      }
    }
    const colMenu = document.getElementById('columns-dropdown-menu');
    if (colMenu && colMenu.style.display === 'block') {
      if (!colMenu.contains(e.target) && !e.target.closest('#col-toggle-btn')) {
        colMenu.style.display = 'none';
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeColFilter();
      const colMenu = document.getElementById('columns-dropdown-menu');
      if (colMenu) colMenu.style.display = 'none';
    }
  });

  const tableContainer = document.getElementById('registry-table-container');
  if (tableContainer) {
    tableContainer.addEventListener('scroll', syncSlideBar, { passive: true });
  }

  window.addEventListener('resize', syncSlideBar, { passive: true });
}

function renderToolsGrid(tools) {
  const container = document.getElementById('registry-grid-container');
  if (!container) return;
  container.innerHTML = '';

  if (tools.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No tooling parts match your current filter criteria.</div>`;
    return;
  }

  tools.forEach(tool => {
    const strokePct = Math.min(100, Math.round((tool.strokesCurrent / tool.strokesMax) * 100));
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.innerHTML = `
      <div class="tool-card-image-wrap">
        <img src="${tool.image || 'images/image1.png'}" class="tool-card-img" alt="${tool.partNumber}">
        <div class="tool-card-badges">
          ${getCriticalityBadge(tool.criticality)}
          ${getHealthStatusPill(tool.healthStatus)}
        </div>
        <button class="zoom-overlay-btn" onclick="openLightbox('${tool.image}', '${tool.partNumber}', '${tool.description}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          Zoom CAD
        </button>
      </div>

      <div class="tool-card-content">
        <div class="tool-card-header">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span class="part-code">${tool.partNumber}</span>
              <div style="display: flex; gap: 4px; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; color: #065f46; background: #d1fae5; padding: 2px 6px; border-radius: 4px;">${tool.year || '2024'}</span>
                <span style="font-size: 11px; font-weight: 700; color: #1e40af; background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${tool.customer || 'JRTL'}</span>
              </div>
            </div>
            <div class="part-title">${tool.description}</div>
          </div>
        </div>

        <div class="stroke-meter">
          <div class="stroke-meta">
            <span>Strokes: ${tool.strokesCurrent.toLocaleString()} / ${tool.strokesMax.toLocaleString()}</span>
            <span><strong>${strokePct}%</strong></span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${getStrokeColor(strokePct)}" style="width: ${strokePct}%"></div>
          </div>
        </div>

        <div class="tool-card-meta">
          <div class="meta-item">
            <span class="meta-label">Current Total (Col AI)</span>
            <span class="meta-value" style="color: #059669; font-weight: 700;">${tool.currentTotalShot != null ? Number(tool.currentTotalShot).toLocaleString() : '—'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Warranty (Col AH)</span>
            <span class="meta-value" style="color: #d97706; font-weight: 700;">${tool.warrantyToolShots != null ? Number(tool.warrantyToolShots).toLocaleString() : (tool.strokesMax || 0).toLocaleString()}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Col AD Shots (OEE)</span>
            <span class="meta-value" style="color: #2563eb; font-weight: 700;">${tool.colAD_ToolShot ? Number(tool.colAD_ToolShot).toLocaleString() : '—'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Linked Die ID</span>
            <span class="meta-value"><code>${tool.matchedToolShotId || tool.toolId}</code></span>
          </div>
        </div>

        <div class="tool-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="openToolDetailModal('${tool.id}')">Details & Specs</button>
          <button class="btn btn-primary btn-sm" onclick="openNewWorkOrderForTool('${tool.id}')">+ Work Order</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderToolsTable(tools) {
  const tbody = document.getElementById('registry-table-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  tools.forEach(tool => {
    const strokePct = Math.min(100, Math.round((tool.strokesCurrent / tool.strokesMax) * 100));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-col="year"><span class="badge" style="background:#d1fae5;color:#047857;font-weight:700;font-size:11px;padding:3px 8px;border-radius:4px;">${tool.year || '2024'}</span></td>
      <td data-col="image">
        <img src="${tool.image || 'images/image1.png'}" class="table-thumb" alt="${tool.partNumber}" onclick="openLightbox('${tool.image}', '${tool.partNumber}', '${tool.description}')" style="cursor: pointer;">
      </td>
      <td data-col="partNumber"><strong class="part-code">${tool.partNumber}</strong></td>
      <td data-col="partName">${tool.description || tool.partName || ''}</td>
      <td data-col="customer"><span style="font-size: 11px; font-weight: 700; color: #1e40af; background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${tool.customer || 'JRTL'}</span></td>
      <td data-col="matchedToolShotId"><code>${tool.matchedToolShotId || tool.toolId}</code></td>
      <td data-col="pressTonnage">${tool.pressTonnage || 'N/A'} ${tool.mechNo ? '(' + tool.mechNo + ')' : ''}</td>
      <td data-col="colAD_ToolShot"><strong style="color: #2563eb;">${tool.colAD_ToolShot ? Number(tool.colAD_ToolShot).toLocaleString() : '—'}</strong></td>
      <td data-col="currentTotalShot"><strong style="color: #059669;">${tool.currentTotalShot != null ? Number(tool.currentTotalShot).toLocaleString() : '—'}</strong></td>
      <td data-col="warrantyToolShots"><strong style="color: #d97706;">${tool.warrantyToolShots != null ? Number(tool.warrantyToolShots).toLocaleString() : (tool.strokesMax || 0).toLocaleString()}</strong></td>
      <td data-col="strokesCurrent">${tool.strokesCurrent.toLocaleString()} / ${tool.strokesMax.toLocaleString()}</td>
      <td data-col="strokeWearPercent">
        <div class="stroke-meter" style="width: 100px;">
          <div class="stroke-meta">
            <span>${strokePct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${getStrokeColor(strokePct)}" style="width: ${strokePct}%"></div>
          </div>
        </div>
      </td>
      <td data-col="healthStatus">${getHealthStatusPill(tool.healthStatus)}</td>
      <td data-col="actions">
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="openToolDetailModal('${tool.id}')">View</button>
          <button class="btn btn-primary btn-sm" onclick="openNewWorkOrderForTool('${tool.id}')">WO</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function setViewMode(mode) {
  appState.viewMode = mode;
  localStorage.setItem('tool_maint_view_mode', mode);
  const gridBtn = document.getElementById('view-mode-grid');
  const tableBtn = document.getElementById('view-mode-table');
  const gridContainer = document.getElementById('registry-grid-container');
  const tableContainer = document.getElementById('registry-table-container');

  if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
  if (tableBtn) tableBtn.classList.toggle('active', mode === 'table');

  if (gridContainer) gridContainer.style.display = mode === 'grid' ? 'grid' : 'none';
  if (tableContainer) tableContainer.style.display = mode === 'table' ? 'block' : 'none';
}

// ==========================================================================
// Tab 3: Maintenance Work Orders (PM/CM)
// ==========================================================================

function renderWorkOrders() {
  const container = document.getElementById('work-orders-container');
  if (!container) return;
  container.innerHTML = '';

  if (appState.workOrders.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No maintenance work orders active. Click "+ Create Work Order" above to schedule maintenance.</div>`;
    return;
  }

  appState.workOrders.forEach((wo, woIdx) => {
    const card = document.createElement('div');
    card.className = 'wo-card';
    
    // Checklist progress
    const totalChecks = wo.checklist ? wo.checklist.length : 0;
    const completedChecks = wo.checklist ? wo.checklist.filter(c => c.done).length : 0;

    let checklistHtml = '';
    if (wo.checklist && wo.checklist.length > 0) {
      checklistHtml = `
        <div class="checklist-container">
          <div class="checklist-title">
            <span>Maintenance Checklist</span>
            <span>${completedChecks} of ${totalChecks} completed</span>
          </div>
          <div class="checklist-items">
            ${wo.checklist.map((item, itemIdx) => `
              <label class="checklist-item ${item.done ? 'done' : ''}">
                <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklistItem(${woIdx}, ${itemIdx})">
                <span>${item.task}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="wo-card-header">
        <span class="wo-number">${wo.id}</span>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="priority-tag ${wo.priority.toLowerCase()}">${wo.priority}</span>
          ${getWoStatusPill(wo.status)}
        </div>
      </div>

      <div class="wo-card-body">
        <div class="wo-title">${wo.orderType} - ${wo.partDescription}</div>
        <div style="font-size: 12px; color: var(--text-muted); display: flex; gap: 16px;">
          <span>Tool: <code>${wo.toolId}</code></span>
          <span>Part: <strong>${wo.partNumber}</strong></span>
          <span>Due: <strong>${wo.dueDate}</strong></span>
        </div>

        <div class="wo-desc">${wo.problemDescription}</div>
        <div class="wo-desc" style="background: #f1f5f9; padding: 8px 12px; border-radius: var(--radius-sm);">
          <strong>Action Plan:</strong> ${wo.actionPlan}
        </div>

        ${checklistHtml}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; font-size: 12px; color: var(--text-muted);">
          <span>Assigned: <strong>${wo.assignedTech}</strong></span>
          <div style="display: flex; gap: 6px;">
            ${wo.status !== 'Completed' ? `
              <button class="btn btn-success btn-sm" onclick="completeWorkOrder(${woIdx})">✓ Mark Completed</button>
            ` : `
              <span style="color: #059669; font-weight: 700;">Completed & Archived</span>
            `}
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleChecklistItem(woIdx, itemIdx) {
  const wo = appState.workOrders[woIdx];
  if (wo && wo.checklist && wo.checklist[itemIdx]) {
    wo.checklist[itemIdx].done = !wo.checklist[itemIdx].done;
    if (wo.status === 'Scheduled' && wo.checklist.some(c => c.done)) {
      wo.status = 'In Progress';
    }
    saveState();
    renderWorkOrders();
  }
}

function completeWorkOrder(woIdx) {
  const wo = appState.workOrders[woIdx];
  if (!wo) return;

  wo.status = 'Completed';
  if (wo.checklist) {
    wo.checklist.forEach(c => c.done = true);
  }

  // Find tool and update status to operational
  const tool = appState.tools.find(t => t.toolId === wo.toolId || t.partNumber === wo.partNumber);
  if (tool) {
    tool.healthStatus = 'Operational';
    tool.lastPmDate = new Date().toISOString().split('T')[0];
  }

  // Create audit history entry
  appState.maintenanceHistory.unshift({
    id: `HIST-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    toolId: wo.toolId,
    partNumber: wo.partNumber,
    partDescription: wo.partDescription,
    type: wo.orderType,
    tech: wo.assignedTech,
    strokes: wo.strokesAtMaintenance || (tool ? tool.strokesCurrent : 0),
    downtimeHours: 3.5,
    actions: wo.actionPlan,
    outcome: 'Work order successfully completed. Verification inspection signed off.'
  });

  saveState();
  renderWorkOrders();
}

function getWoStatusPill(status) {
  if (status === 'Completed') return '<span class="status-pill operational">Completed</span>';
  if (status === 'In Progress') return '<span class="status-pill trial-in-progress">In Progress</span>';
  return '<span class="status-pill maintenance-due">Scheduled</span>';
}

// ==========================================================================
// Tab 4: GP-CoS / LAIR Pipeline Rendering
// ==========================================================================

function renderPipeline() {
  const tbody = document.getElementById('pipeline-table-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  appState.tools.forEach(tool => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <img src="${tool.image || 'images/image1.png'}" class="table-thumb" alt="${tool.partNumber}" onclick="openLightbox('${tool.image}', '${tool.partNumber}', '${tool.description}')" style="cursor: pointer;">
      </td>
      <td><strong class="part-code">${tool.partNumber}</strong></td>
      <td>${tool.description}</td>
      <td>${getCriticalityBadge(tool.criticality)}</td>
      <td><strong>${tool.samplesQty || 10}</strong> pcs</td>
      <td>
        <div style="font-weight: 600; color: #1e40af;">${tool.pipelineStatus}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${tool.statusDate || 'Sep 2026'}</div>
      </td>
      <td>
        <div style="font-size: 12px;">${tool.remarks || 'Standard production'}</div>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openUpdatePipelineModal('${tool.id}')">Update Status</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openUpdatePipelineModal(toolId) {
  const tool = appState.tools.find(t => t.id === toolId);
  if (!tool) return;

  const newStatus = prompt(`Update GP-CoS Pipeline Status for ${tool.partNumber} (${tool.description}):\n\nOptions:\n1. Sent to JR-TH\n2. Samples Preparation in progress\n3. Finished Trial and Sample Submission\n4. Samples Received\n\nEnter new status text:`, tool.pipelineStatus);
  if (newStatus && newStatus.trim() !== '') {
    tool.pipelineStatus = newStatus.trim();
    saveState();
    renderPipeline();
  }
}

// ==========================================================================
// Tab 5: Visual Part Inspector Gallery
// ==========================================================================

function renderGallery() {
  const container = document.getElementById('gallery-container');
  if (!container) return;
  container.innerHTML = '';

  appState.tools.forEach(tool => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.onclick = () => openLightbox(tool.image, tool.partNumber, tool.description);
    item.innerHTML = `
      <div class="gallery-img-box">
        <img src="${tool.image || 'images/image1.png'}" alt="${tool.partNumber}">
        <div style="position: absolute; top: 10px; right: 10px;">
          ${getCriticalityBadge(tool.criticality)}
        </div>
      </div>
      <div class="gallery-info">
        <div class="gallery-part">${tool.partNumber}</div>
        <div class="gallery-desc">${tool.description}</div>
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>${tool.category}</span>
          <span><code>${tool.toolId}</code></span>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Lightbox
function openLightbox(imgSrc, partNumber, description) {
  const modal = document.getElementById('modal-lightbox');
  const img = document.getElementById('lightbox-image');
  const title = document.getElementById('lightbox-title');
  const desc = document.getElementById('lightbox-desc');

  img.src = imgSrc || 'images/image1.png';
  title.textContent = `CAD Inspection: ${partNumber}`;
  desc.textContent = description;

  appState.zoomScale = 1.0;
  img.style.transform = `scale(1.0)`;

  modal.classList.add('show');
}

function zoomImage(factor) {
  appState.zoomScale = Math.max(0.5, Math.min(3.5, appState.zoomScale * factor));
  const img = document.getElementById('lightbox-image');
  if (img) img.style.transform = `scale(${appState.zoomScale})`;
}

function resetZoom() {
  appState.zoomScale = 1.0;
  const img = document.getElementById('lightbox-image');
  if (img) img.style.transform = `scale(1.0)`;
}

// ==========================================================================
// Tab 6: Maintenance History & Logs
// ==========================================================================

function renderHistory() {
  const tbody = document.getElementById('history-table-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  appState.maintenanceHistory.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${log.id}</code></td>
      <td><strong>${log.date}</strong></td>
      <td><span class="part-code">${log.partNumber}</span></td>
      <td><code>${log.toolId}</code></td>
      <td><span class="badge-criticality minor">${log.type}</span></td>
      <td>${log.tech}</td>
      <td>${log.strokes ? log.strokes.toLocaleString() : 'N/A'}</td>
      <td><strong>${log.downtimeHours} h</strong></td>
      <td style="max-width: 250px;">${log.actions}</td>
      <td><span style="color: #059669; font-weight: 600;">${log.outcome}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// Modals Handling: Tool Details
// ==========================================================================

function openToolDetailModal(toolId) {
  const tool = appState.tools.find(t => t.id === toolId);
  if (!tool) return;

  appState.activeToolId = toolId;
  const modal = document.getElementById('modal-tool-detail');
  document.getElementById('modal-tool-title').textContent = `${tool.partNumber} - ${tool.description}`;
  document.getElementById('modal-tool-subtitle').textContent = `Tool ID: ${tool.toolId} • ${tool.category}`;

  const strokePct = Math.min(100, Math.round((tool.strokesCurrent / tool.strokesMax) * 100));

  const body = document.getElementById('modal-tool-body');
  body.innerHTML = `
    <div style="display: grid; grid-template-columns: 240px 1fr; gap: 24px; margin-bottom: 24px;">
      <div style="background: #f8fafc; border-radius: var(--radius-lg); border: 1px solid var(--border); padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <img src="${tool.image || 'images/image1.png'}" style="max-width: 100%; max-height: 180px; object-fit: contain; cursor: pointer;" onclick="openLightbox('${tool.image}', '${tool.partNumber}', '${tool.description}')">
        <div style="margin-top: 12px; display: flex; gap: 8px;">
          ${getCriticalityBadge(tool.criticality)}
          ${getHealthStatusPill(tool.healthStatus)}
        </div>
        <div style="margin-top: 8px; font-size: 11px; font-weight: 700; color: #1e40af; background: #dbeafe; padding: 3px 8px; border-radius: 4px;">
          Customer: ${tool.customer || 'JRTL'}
        </div>
      </div>

      <div>
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px;">
            <span>Life Cycle Stroke Accumulation</span>
            <span>${tool.strokesCurrent.toLocaleString()} / ${tool.strokesMax.toLocaleString()} (${strokePct}%)</span>
          </div>
          <div class="progress-track" style="height: 12px;">
            <div class="progress-fill ${getStrokeColor(strokePct)}" style="width: ${strokePct}%"></div>
          </div>
        </div>

        <!-- Linked Tool Shot Template Box -->
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 14px;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1d4ed8; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>Tool Shot Template Linkage (Jinrong CH-TH)</span>
            <span class="badge" style="background: ${tool.matchedToolShotId ? '#dcfce7' : '#f1f5f9'}; color: ${tool.matchedToolShotId ? '#15803d' : '#64748b'}; font-weight: 700; padding: 3px 8px; border-radius: 4px;">${tool.matchedToolShotId ? '✓ Linked' : 'Standard Baseline'}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px;">
            <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="color: var(--text-muted); display: block; font-size: 11px;">Current Total (Col AI):</span>
              <strong style="color: #059669; font-size: 14px;">${tool.currentTotalShot != null ? Number(tool.currentTotalShot).toLocaleString() : '—'}</strong>
            </div>
            <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="color: var(--text-muted); display: block; font-size: 11px;">Warranty Shots (Col AH):</span>
              <strong style="color: #d97706; font-size: 14px;">${tool.warrantyToolShots != null ? Number(tool.warrantyToolShots).toLocaleString() : (tool.strokesMax || 0).toLocaleString()}</strong>
            </div>
            <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="color: var(--text-muted); display: block; font-size: 11px;">Col AD Shots (OEE):</span>
              <strong style="color: #2563eb; font-size: 14px;">${tool.colAD_ToolShot ? Number(tool.colAD_ToolShot).toLocaleString() : '—'}</strong>
            </div>
            <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="color: var(--text-muted); display: block; font-size: 11px;">Baseline Shot (Col F):</span>
              <strong style="color: #475569; font-size: 14px;">${tool.actualToolShot != null ? Number(tool.actualToolShot).toLocaleString() : '—'}</strong>
            </div>
          </div>
          ${tool.matchedToolShotId ? `
            <div style="font-size: 11px; color: #1e40af; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #bfdbfe; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
              <div>Matched Die: <strong>${tool.matchedToolShotId}</strong> • ${tool.matchedToolShotName || tool.matchedToolName || ''}</div>
              <div style="color: #64748b;">${tool.matchReason || tool.matchTrace || ''}</div>
            </div>
          ` : ''}
        </div>

        <!-- Technical Specification Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 12px;">
          <div><span style="color: var(--text-muted);">Manufacture No:</span> <strong>${tool.toolId}</strong></div>
          <div><span style="color: var(--text-muted);">Press Machine:</span> <strong>${tool.pressTonnage || 'N/A'} (Mech ${tool.mechNo || '-'})</strong></div>
          <div><span style="color: var(--text-muted);">Model / Tool Type:</span> <strong>${tool.toolType}</strong></div>
          <div><span style="color: var(--text-muted);">Speed / Stroke Rate:</span> <strong>${tool.speed || '80 SPM'}</strong></div>
          <div><span style="color: var(--text-muted);">Material & Thick:</span> <strong>${tool.material || '-'} (${tool.thickness || '-'})</strong></div>
          <div><span style="color: var(--text-muted);">Cavity Count:</span> <strong>${tool.cavities || '1'}</strong></div>
          <div><span style="color: var(--text-muted);">Tool Size (L*W*H):</span> <strong>${tool.toolingSize || 'N/A'}</strong></div>
          <div><span style="color: var(--text-muted);">Blanking Gap:</span> <strong>${tool.blankingGap || 'N/A'}</strong></div>
          <div><span style="color: var(--text-muted);">PPEP NO:</span> <strong>${tool.ppepNo || 'N/A'}</strong></div>
          <div><span style="color: var(--text-muted);">Designer:</span> <strong>${tool.designer || 'Yang'}</strong></div>
          <div><span style="color: var(--text-muted);">Plating Supplier:</span> <strong>${tool.platingSupplier || 'N/A'}</strong></div>
          <div><span style="color: var(--text-muted);">Product Position:</span> <strong>${tool.productPosition || 'THAI'}</strong></div>
        </div>
      </div>
    </div>

    <div style="background: #f1f5f9; padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 16px;">
      <strong style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Pipeline Status & Production Details:</strong>
      <div style="font-size: 13px; color: var(--text-main); margin-top: 4px;">
        <strong>${tool.pipelineStatus}</strong> — ${tool.remarks || 'Tooling active in production line. Quality validated.'}
      </div>
    </div>

    ${tool.notes ? `
      <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px 14px; border-radius: var(--radius-md); font-size: 12px; color: #92400e; margin-bottom: 16px;">
        <strong>Engineering Quality Note:</strong> ${tool.notes}
      </div>
    ` : ''}

    <div style="border-top: 1px solid var(--border); padding-top: 16px;">
      <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">Maintenance History for this Tool</h4>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Technician</th>
              <th>Downtime</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${getToolHistoryRows(tool.toolId, tool.partNumber)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('modal-tool-edit-btn').onclick = () => {
    closeModal('modal-tool-detail');
    openEditToolModal(toolId);
  };

  document.getElementById('modal-tool-wo-btn').onclick = () => {
    closeModal('modal-tool-detail');
    openNewWorkOrderForTool(toolId);
  };

  modal.classList.add('show');
}

function getToolHistoryRows(toolId, partNumber) {
  const logs = appState.maintenanceHistory.filter(h => h.toolId === toolId || h.partNumber === partNumber);
  if (logs.length === 0) {
    return '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No recorded maintenance events for this tool yet.</td></tr>';
  }
  return logs.map(l => `
    <tr>
      <td>${l.date}</td>
      <td>${l.type}</td>
      <td>${l.tech}</td>
      <td>${l.downtimeHours}h</td>
      <td>${l.actions}</td>
    </tr>
  `).join('');
}

// ==========================================================================
// Work Order Creation
// ==========================================================================

function openNewWorkOrderModal() {
  populateWoToolSelect();
  document.getElementById('wo-due').value = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  document.getElementById('modal-new-wo').classList.add('show');
}

function openNewWorkOrderForTool(toolId) {
  populateWoToolSelect();
  document.getElementById('wo-tool-select').value = toolId;
  handleWoToolSelect(toolId);
  document.getElementById('wo-due').value = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  document.getElementById('modal-new-wo').classList.add('show');
}

function populateWoToolSelect() {
  const select = document.getElementById('wo-tool-select');
  select.innerHTML = '<option value="">-- Select Tool Asset --</option>';
  appState.tools.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.partNumber} - ${t.description} (${t.toolId})</option>`;
  });
}

function handleWoToolSelect(toolId) {
  const tool = appState.tools.find(t => t.id === toolId);
  if (!tool) return;
  document.getElementById('wo-desc').value = `Scheduled preventive inspection and stroke threshold check for ${tool.partNumber}. Current strokes: ${tool.strokesCurrent.toLocaleString()}.`;
  document.getElementById('wo-action').value = `Perform multi-point toolroom inspection, clean guide pins, verify cutting clearance, lubricate with ISO VG 68 grease.`;
}

function handleSaveWorkOrder(e) {
  e.preventDefault();
  const toolId = document.getElementById('wo-tool-select').value;
  const tool = appState.tools.find(t => t.id === toolId);

  const newWo = {
    id: `WO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    toolId: tool ? tool.toolId : 'TOOL-GEN',
    partNumber: tool ? tool.partNumber : 'CUSTOM',
    partDescription: tool ? tool.description : 'Custom Asset',
    orderType: document.getElementById('wo-type').value,
    priority: document.getElementById('wo-priority').value,
    status: 'Scheduled',
    createdDate: new Date().toISOString().split('T')[0],
    dueDate: document.getElementById('wo-due').value,
    assignedTech: document.getElementById('wo-tech').value,
    strokesAtMaintenance: tool ? tool.strokesCurrent : 0,
    problemDescription: document.getElementById('wo-desc').value,
    actionPlan: document.getElementById('wo-action').value,
    checklist: [
      { task: "Visual crack & chip check on punches and die inserts", done: false },
      { task: "Ultrasonic clean & demagnetize die station components", done: false },
      { task: "Inspect guide pillars & ball bushings for radial play", done: false },
      { task: "Measure cutting clearance and edge wear", done: false },
      { task: "Lubricate guide pillars with synthetic grease", done: false },
      { task: "Run 10 dry test strokes and verify smooth actuation", done: false }
    ]
  };

  appState.workOrders.unshift(newWo);
  if (tool && tool.healthStatus === 'Operational') {
    tool.healthStatus = 'Maintenance Due';
  }

  saveState();
  closeModal('modal-new-wo');
  switchTab('workorders');
}

// ==========================================================================
// Add / Edit Tool Modal Handling
// ==========================================================================

function openAddToolModal() {
  document.getElementById('form-tool').reset();
  document.getElementById('edit-tool-id').value = '';
  document.getElementById('modal-edit-tool-title').textContent = 'Add New Tooling Asset';
  document.getElementById('modal-edit-tool').classList.add('show');
}

function openEditToolModal(toolId) {
  const tool = appState.tools.find(t => t.id === toolId);
  if (!tool) return;

  document.getElementById('edit-tool-id').value = tool.id;
  document.getElementById('edit-part-num').value = tool.partNumber;
  document.getElementById('edit-desc').value = tool.description;
  document.getElementById('edit-criticality').value = tool.criticality;
  document.getElementById('edit-tool-id-input').value = tool.toolId;
  document.getElementById('edit-category').value = tool.category || '';
  document.getElementById('edit-type').value = tool.toolType || '';
  document.getElementById('edit-tonnage').value = tool.pressTonnage || '';
  document.getElementById('edit-material').value = tool.material || '';
  document.getElementById('edit-strokes-curr').value = tool.strokesCurrent;
  document.getElementById('edit-strokes-max').value = tool.strokesMax;
  document.getElementById('edit-health-status').value = tool.healthStatus;
  document.getElementById('edit-pipeline-status').value = tool.pipelineStatus;
  document.getElementById('edit-samples-qty').value = tool.samplesQty || 10;
  document.getElementById('edit-location').value = tool.location || '';
  document.getElementById('edit-image-select').value = tool.image || 'images/image1.png';
  document.getElementById('edit-assigned-tech').value = tool.assignedTech || 'R. Sudhakar';
  document.getElementById('edit-notes').value = tool.notes || '';

  document.getElementById('modal-edit-tool-title').textContent = `Edit Tool: ${tool.partNumber}`;
  document.getElementById('modal-edit-tool').classList.add('show');
}

function handleSaveTool(e) {
  e.preventDefault();
  const existingId = document.getElementById('edit-tool-id').value;

  const toolData = {
    partNumber: document.getElementById('edit-part-num').value.trim(),
    description: document.getElementById('edit-desc').value.trim(),
    criticality: document.getElementById('edit-criticality').value,
    toolId: document.getElementById('edit-tool-id-input').value.trim(),
    category: document.getElementById('edit-category').value.trim(),
    toolType: document.getElementById('edit-type').value.trim(),
    pressTonnage: document.getElementById('edit-tonnage').value.trim(),
    material: document.getElementById('edit-material').value.trim(),
    strokesCurrent: Number(document.getElementById('edit-strokes-curr').value) || 0,
    strokesMax: Number(document.getElementById('edit-strokes-max').value) || 200000,
    healthStatus: document.getElementById('edit-health-status').value,
    pipelineStatus: document.getElementById('edit-pipeline-status').value,
    samplesQty: Number(document.getElementById('edit-samples-qty').value) || 10,
    location: document.getElementById('edit-location').value.trim(),
    image: document.getElementById('edit-image-select').value,
    assignedTech: document.getElementById('edit-assigned-tech').value.trim(),
    notes: document.getElementById('edit-notes').value.trim()
  };

  if (existingId) {
    const idx = appState.tools.findIndex(t => t.id === existingId);
    if (idx !== -1) {
      appState.tools[idx] = { ...appState.tools[idx], ...toolData };
    }
  } else {
    const newTool = {
      id: `TL-${String(appState.tools.length + 1).padStart(3, '0')}`,
      statusDate: new Date().toISOString().split('T')[0],
      remarks: 'Newly registered tool',
      pmIntervalStrokes: 50000,
      nextPmDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      ...toolData
    };
    appState.tools.push(newTool);
  }

  saveState();
  closeModal('modal-edit-tool');
  renderCurrentTab();
}

// ==========================================================================
// Log Maintenance Modal
// ==========================================================================

function openLogMaintenanceModal() {
  const select = document.getElementById('log-tool-select');
  select.innerHTML = '';
  appState.tools.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.partNumber} - ${t.description} (${t.toolId})</option>`;
  });
  document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-log-maint').classList.add('show');
}

function handleSaveMaintenanceLog(e) {
  e.preventDefault();
  const toolId = document.getElementById('log-tool-select').value;
  const tool = appState.tools.find(t => t.id === toolId);

  const newLog = {
    id: `HIST-${Date.now().toString().slice(-6)}`,
    date: document.getElementById('log-date').value,
    toolId: tool ? tool.toolId : 'GEN-TOOL',
    partNumber: tool ? tool.partNumber : 'CUSTOM',
    partDescription: tool ? tool.description : '',
    type: document.getElementById('log-type').value,
    tech: document.getElementById('log-tech').value,
    strokes: tool ? tool.strokesCurrent : 0,
    downtimeHours: Number(document.getElementById('log-downtime').value) || 2.0,
    actions: document.getElementById('log-actions').value,
    outcome: document.getElementById('log-outcome').value
  };

  appState.maintenanceHistory.unshift(newLog);
  if (tool) {
    tool.lastPmDate = newLog.date;
    tool.healthStatus = 'Operational';
  }

  saveState();
  closeModal('modal-log-maint');
  switchTab('history');
}

// ==========================================================================
// Export & Print
// ==========================================================================

function exportData(format) {
  if (format === 'csv') {
    let csv = 'ID,Year,Part Number,Description,Customer,Criticality,Tool ID,Linked Die ID,Col AD Shots,Press Tonnage,Mech No,Material,Thickness,Current Strokes,Max Strokes,Health Status,Pipeline Status,Samples Qty,Location,Technician\n';
    appState.tools.forEach(t => {
      csv += `"${t.id}","${t.year || ''}","${t.partNumber}","${(t.description || '').replace(/"/g, '""')}","${t.customer || ''}","${t.criticality}","${t.toolId}","${t.matchedToolShotId || ''}",${t.colAD_ToolShot || 0},"${t.pressTonnage || ''}","${t.mechNo || ''}","${t.material || ''}","${t.thickness || ''}",${t.strokesCurrent},${t.strokesMax},"${t.healthStatus}","${t.pipelineStatus}",${t.samplesQty || 0},"${t.location || ''}","${t.assignedTech || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Tool_Maintenance_Registry_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  } else if (format === 'json') {
    const jsonStr = JSON.stringify(appState, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Tool_Maintenance_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  }
}

function printReport() {
  const printArea = document.getElementById('printable-report');
  printArea.innerHTML = `
    <div style="padding: 30px; font-family: sans-serif; color: #000;">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px;">
        <div>
          <h1 style="font-size: 22px; margin: 0;">TOOL MAINTENANCE & LIFE CYCLE REPORT</h1>
          <p style="margin: 4px 0 0; font-size: 13px;">Schneider Electric GP-CoS • LAIR Tooling Audit</p>
        </div>
        <div style="text-align: right; font-size: 12px;">
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
          <div><strong>Plant:</strong> JR-TH Precision Stamping</div>
        </div>
      </div>

      <h3 style="font-size: 15px; margin-bottom: 10px;">Critical Tooling Assets Status</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;" border="1">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 6px;">Part Number</th>
            <th style="padding: 6px;">Description</th>
            <th style="padding: 6px;">Tool ID</th>
            <th style="padding: 6px;">Criticality</th>
            <th style="padding: 6px;">Strokes</th>
            <th style="padding: 6px;">Status</th>
            <th style="padding: 6px;">Pipeline / Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${appState.tools.map(t => `
            <tr>
              <td style="padding: 5px;"><strong>${t.partNumber}</strong></td>
              <td style="padding: 5px;">${t.description}</td>
              <td style="padding: 5px;">${t.toolId}</td>
              <td style="padding: 5px;"><strong>${t.criticality}</strong></td>
              <td style="padding: 5px;">${t.strokesCurrent.toLocaleString()} / ${t.strokesMax.toLocaleString()}</td>
              <td style="padding: 5px;">${t.healthStatus}</td>
              <td style="padding: 5px;">${t.pipelineStatus}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3 style="font-size: 15px; margin-bottom: 10px;">Active Work Orders</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;" border="1">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 6px;">WO #</th>
            <th style="padding: 6px;">Part</th>
            <th style="padding: 6px;">Type</th>
            <th style="padding: 6px;">Priority</th>
            <th style="padding: 6px;">Due Date</th>
            <th style="padding: 6px;">Technician</th>
            <th style="padding: 6px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${appState.workOrders.map(w => `
            <tr>
              <td style="padding: 5px;"><strong>${w.id}</strong></td>
              <td style="padding: 5px;">${w.partNumber} (${w.partDescription})</td>
              <td style="padding: 5px;">${w.orderType}</td>
              <td style="padding: 5px;"><strong>${w.priority}</strong></td>
              <td style="padding: 5px;">${w.dueDate}</td>
              <td style="padding: 5px;">${w.assignedTech}</td>
              <td style="padding: 5px;">${w.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  window.print();
}

async function pushToGitHubUI() {
  const btn = document.getElementById('btn-push-gh');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Pushing...</span>';
  }

  try {
    const res = await fetch('/api/git-push', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (btn) {
        btn.innerHTML = '<span>✓ Pushed!</span>';
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-success');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('btn-success');
          btn.classList.add('btn-outline-primary');
          btn.disabled = false;
        }, 3000);
      }
    } else {
      throw new Error('Server returned ' + res.status);
    }
  } catch (err) {
    console.warn('Direct API push not available:', err);
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
    alert('Auto-Push to GitHub triggered! Ensure the server (start_app.bat) is running with your GitHub credentials.');
  }
}

// ==========================================================================
// Helper Utility Functions
// ==========================================================================

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('show');
}

function getCriticalityBadge(crit) {
  const c = (crit || 'MINOR').toUpperCase();
  if (c === 'CRITICAL') return '<span class="badge-criticality critical">CRITICAL</span>';
  if (c === 'MAJOR') return '<span class="badge-criticality major">MAJOR</span>';
  return '<span class="badge-criticality minor">MINOR</span>';
}

function getHealthStatusPill(status) {
  const map = {
    'Operational': 'operational',
    'Maintenance Due': 'maintenance-due',
    'Critical Attention': 'critical-attention',
    'Inspection Due': 'inspection-due',
    'Trial In Progress': 'trial-in-progress',
    'Pipeline Pending': 'pipeline-pending'
  };
  const cls = map[status] || 'operational';
  return `<span class="status-pill ${cls}">${status}</span>`;
}

function getStrokeColor(pct) {
  if (pct >= 90) return 'fill-red';
  if (pct >= 70) return 'fill-amber';
  return 'fill-green';
}

// ==========================================================================
// Google Sheets Cloud Database Integration
// ==========================================================================

// ==========================================================================
// Daily OEE Production Sync (Column AD Good Quantity)
// ==========================================================================

const OEE_SHEET_ID = '1-3RKcRJC_ENe-xCWMIYYHqYYaKj0cyCG8n-MwMWQMXM';

const OEE_PRESS_SHEETS = [
  { name: '1# OCP-80T', gid: '587870018' },
  { name: '2# MHS-80T', gid: '2065750272' },
  { name: '3# OCP-110T', gid: '1363407651' },
  { name: '4# SN1-110T', gid: '280483646' },
  { name: '5# OCP-110T', gid: '1314347229' },
  { name: '6# STD-150T', gid: '43426348' },
  { name: '7# GTX-300T', gid: '236922057' },
  { name: '8# GTX-500T', gid: '323827484' },
  { name: '9# OCP-110T', gid: '1496168527' },
  { name: '10# OCP-260 T', gid: '804228985' },
  { name: '11# 200T', gid: '797360584' },
  { name: '12# 200T', gid: '190763615' },
  { name: '13# 110T', gid: '659449304' }
];

async function syncLiveOeeStrokes(silent = false) {
  const btn = document.getElementById('btn-sync-oee');
  const btnText = document.getElementById('sync-oee-text');
  const indicator = document.getElementById('sync-oee-indicator');

  if (btnText) btnText.textContent = '⏳ Syncing 13 Presses...';
  if (indicator) indicator.style.backgroundColor = '#f59e0b';

  const allPartsGoodQty = {};
  let successfulSheets = 0;

  try {
    const promises = OEE_PRESS_SHEETS.map(async (ps) => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${OEE_SHEET_ID}/gviz/tq?tqx=out:json&gid=${ps.gid}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const text = await res.text();
        const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
        if (!m) return;
        const data = JSON.parse(m[1]);
        if (!data.table || !data.table.rows) return;

        let colPartNo = 10;
        let colPartName = 9;
        let colGoodQty = 29;

        data.table.cols.forEach((c, idx) => {
          const lbl = (c.label || c.id || '').toLowerCase();
          if (lbl.includes('part no') || lbl.includes('part_no')) colPartNo = idx;
          if (lbl.includes('product name') || lbl.includes('产品名称')) colPartName = idx;
          if (lbl.includes('good quantity') || lbl.includes('合格数')) colGoodQty = idx;
        });

        data.table.rows.forEach(r => {
          const c = r.c || [];
          const partNo = c[colPartNo] ? String(c[colPartNo].v !== null ? c[colPartNo].v : c[colPartNo].f || '').trim() : '';
          const partName = c[colPartName] ? String(c[colPartName].v !== null ? c[colPartName].v : c[colPartName].f || '').trim() : '';
          const goodQty = c[colGoodQty] ? Number(c[colGoodQty].v) || 0 : 0;

          if (partNo && goodQty > 0) {
            const cleanPartNo = partNo.replace(/[\r\n]+/g, ' ').trim();
            if (!allPartsGoodQty[cleanPartNo]) {
              allPartsGoodQty[cleanPartNo] = {
                partNo: cleanPartNo,
                partName: partName.replace(/[\r\n]+/g, ' ').trim(),
                totalGoodQuantity: 0,
                runs: 0,
                presses: []
              };
            }
            allPartsGoodQty[cleanPartNo].totalGoodQuantity += goodQty;
            allPartsGoodQty[cleanPartNo].runs++;
            if (!allPartsGoodQty[cleanPartNo].presses.includes(ps.name)) {
              allPartsGoodQty[cleanPartNo].presses.push(ps.name);
            }
          }
        });
        successfulSheets++;
      } catch (err) {
        console.warn(`Failed to sync ${ps.name}:`, err);
      }
    });

    await Promise.all(promises);

    if (successfulSheets > 0) {
      const oeeMapExact = new Map();
      const oeeMapNorm = new Map();

      Object.values(allPartsGoodQty).forEach(item => {
        oeeMapExact.set(item.partNo.toLowerCase(), item);
        const norm = item.partNo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (norm) {
          if (!oeeMapNorm.has(norm) || oeeMapNorm.get(norm).totalGoodQuantity < item.totalGoodQuantity) {
            oeeMapNorm.set(norm, item);
          }
        }
      });

      let updatedCount = 0;

      appState.tools.forEach(tool => {
        const rawPn = tool.partNumber || '';
        const cleanPn = rawPn.toLowerCase().trim();
        const normPn = rawPn.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        let match = oeeMapExact.get(cleanPn);

        if (!match) {
          const tokens = rawPn.split(/[\/&, \s]+/);
          for (const tok of tokens) {
            const tokClean = tok.toLowerCase().trim();
            const tokNorm = tok.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (tokClean && oeeMapExact.has(tokClean)) {
              match = oeeMapExact.get(tokClean);
              break;
            }
            if (tokNorm && oeeMapNorm.has(tokNorm)) {
              match = oeeMapNorm.get(tokNorm);
              break;
            }
          }
        }

        if (!match && normPn) {
          match = oeeMapNorm.get(normPn);
        }

        if (!match) {
          for (const [k, v] of oeeMapNorm.entries()) {
            if (k.length >= 6 && (normPn.includes(k) || k.includes(normPn))) {
              match = v;
              break;
            }
          }
        }

        if (match && match.totalGoodQuantity > 0) {
          tool.strokesCurrent = match.totalGoodQuantity;
          tool.colAD_ToolShot = match.totalGoodQuantity;
          tool.oeeRuns = match.runs;
          tool.oeePresses = match.presses.join(', ');
          tool.matchedOeePart = match.partNo;

          const wearPct = Math.round((tool.strokesCurrent / tool.strokesMax) * 100);
          tool.strokeWearPercent = wearPct;

          if (wearPct >= 90) {
            tool.healthStatus = 'Critical Attention';
          } else if (wearPct >= 75) {
            tool.healthStatus = 'Maintenance Due';
          } else {
            tool.healthStatus = 'Operational';
          }

          updatedCount++;
        }
      });

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem('tool_maint_last_oee_sync_date', now.toDateString());
      localStorage.setItem('tool_maint_last_oee_sync_time', timeStr);
      saveState();
      renderCurrentTab();

      if (btnText) btnText.textContent = `✓ Synced (${timeStr})`;
      if (indicator) indicator.style.backgroundColor = '#10b981';

      if (!silent) {
        const totalSum = Object.values(allPartsGoodQty).reduce((s, p) => s + p.totalGoodQuantity, 0);
        alert(`✅ Daily OEE Synchronization Complete!\n\n• Successfully queried all ${successfulSheets} of 13 press machines\n• Updated ${updatedCount} tooling parts with live Column AD Good Quantity\n• Total cumulative good quantity calculated: ${totalSum.toLocaleString()} strokes`);
      }
    }
  } catch (err) {
    console.error('Error during live OEE sync:', err);
    if (btnText) btnText.textContent = '🔄 Sync OEE Daily';
    if (indicator) indicator.style.backgroundColor = '#ef4444';
    if (!silent) alert('Could not complete live OEE sync. Check internet connection or Google Sheets permissions.');
  }
}

function checkAutoOeeSync() {
  const lastSyncDate = localStorage.getItem('tool_maint_last_oee_sync_date');
  const today = new Date().toDateString();
  const lastTime = localStorage.getItem('tool_maint_last_oee_sync_time');

  const btnText = document.getElementById('sync-oee-text');
  if (lastTime && btnText) {
    btnText.textContent = `✓ Synced (${lastTime})`;
  }

  // Auto-sync in background if not synced today
  if (lastSyncDate !== today) {
    setTimeout(() => {
      syncLiveOeeStrokes(true);
    }, 1500);
  }
}

const DEFAULT_GS_URL = "https://docs.google.com/spreadsheets/d/1GJT6p_Yfn7Lda-kYgH7-lFofOO0GOn1ZfwWjTlGXm2c/edit";

function openGoogleSheetsModal() {
  const urlInput = document.getElementById('gs-web-app-url');
  if (urlInput) {
    urlInput.value = appState.googleSheetsUrl || DEFAULT_GS_URL;
  }
  updateGoogleSheetsModalStatus();
  document.getElementById('modal-google-sheets').classList.add('show');
}

function updateGoogleSheetsBadge() {
  const indicator = document.getElementById('gs-status-indicator');
  const text = document.getElementById('gs-btn-text');
  if (!indicator || !text) return;

  if (appState.googleSheetsUrl) {
    indicator.style.backgroundColor = '#10b981';
    text.textContent = 'Google Sheet: Linked';
  } else {
    indicator.style.backgroundColor = '#94a3b8';
    text.textContent = 'Google Sheets DB';
  }
}

function updateGoogleSheetsModalStatus() {
  const badge = document.getElementById('gs-modal-status-badge');
  if (!badge) return;

  if (appState.googleSheetsUrl) {
    badge.className = 'status-pill operational';
    badge.textContent = 'Linked to Google Sheet';
  } else {
    badge.className = 'status-pill pipeline-pending';
    badge.textContent = 'Local Storage Mode';
  }
}

function saveGoogleSheetsConfig() {
  const url = (document.getElementById('gs-web-app-url')?.value || '').trim();
  if (!url) {
    disconnectGoogleSheets();
    return;
  }

  appState.googleSheetsUrl = url;
  localStorage.setItem('tool_maint_gs_url', url);
  updateGoogleSheetsBadge();
  closeModal('modal-google-sheets');

  testAndFetchGoogleSheets(false);
}

function disconnectGoogleSheets() {
  appState.googleSheetsUrl = '';
  localStorage.removeItem('tool_maint_gs_url');
  const urlInput = document.getElementById('gs-web-app-url');
  if (urlInput) urlInput.value = '';
  updateGoogleSheetsBadge();
  updateGoogleSheetsModalStatus();
}

async function testAndFetchGoogleSheets(silent = false) {
  const rawUrl = appState.googleSheetsUrl || (document.getElementById('gs-web-app-url')?.value || '').trim() || DEFAULT_GS_URL;
  if (!rawUrl) {
    if (!silent) alert('Please enter your Google Sheet URL or Apps Script Web App URL.');
    return;
  }

  try {
    // Mode A: Google Apps Script Web App (script.google.com)
    if (rawUrl.includes('script.google.com')) {
      const res = await fetch(rawUrl);
      const result = await res.json();

      if (result.status === 'success' && result.data) {
        if (result.data.tools && result.data.tools.length > 0) appState.tools = result.data.tools;
        if (result.data.workOrders && result.data.workOrders.length > 0) appState.workOrders = result.data.workOrders;
        if (result.data.maintenanceHistory && result.data.maintenanceHistory.length > 0) appState.maintenanceHistory = result.data.maintenanceHistory;

        saveState();
        renderCurrentTab();
        updateSidebarBadges();
        updateGoogleSheetsBadge();

        if (!silent) {
          alert(`Successfully synced with Google Sheet!\n• Tools: ${appState.tools.length}\n• Work Orders: ${appState.workOrders.length}\n• History: ${appState.maintenanceHistory.length}`);
        }
        return;
      } else {
        throw new Error(result.message || 'Invalid response from Apps Script');
      }
    }

    // Mode B: Direct Google Sheet URL (docs.google.com/spreadsheets/d/...)
    const idMatch = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch) {
      const sheetId = idMatch[1];
      const gidMatch = rawUrl.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';

      const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
      const res = await fetch(gvizUrl);
      if (!res.ok) {
        throw new Error(`Google Sheet returned HTTP ${res.status}. Ensure the sheet sharing is set to "Anyone with the link can view".`);
      }

      const text = await res.text();
      const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (!jsonMatch) {
        throw new Error('Could not parse Google Sheet data. Please check permissions.');
      }

      const gvizData = JSON.parse(jsonMatch[1]);
      if (gvizData.status === 'error') {
        throw new Error(gvizData.errors?.[0]?.detailed_message || 'Permission denied on Google Sheet');
      }

      // Convert rows to objects
      const cols = gvizData.table.cols.map(c => (c.label || c.id || '').trim());
      const rawRows = gvizData.table.rows;

      if (rawRows && rawRows.length > 0) {
        // Parse rows into tool objects
        const parsedTools = [];
        rawRows.forEach((r, idx) => {
          const cells = r.c || [];
          const getVal = (colIdx) => (cells[colIdx] ? (cells[colIdx].v !== null ? cells[colIdx].v : cells[colIdx].f) : '');

          const partNum = String(getVal(0) || '').trim();
          const desc = String(getVal(1) || '').trim();
          if (partNum && partNum.toLowerCase() !== 'part number') {
            parsedTools.push({
              id: `TL-${String(idx + 1).padStart(3, '0')}`,
              partNumber: partNum,
              description: desc,
              criticality: String(getVal(2) || 'MINOR').toUpperCase(),
              samplesQty: Number(getVal(3)) || 10,
              pipelineStatus: String(getVal(4) || 'Sent to JR-TH'),
              remarks: String(getVal(6) || ''),
              toolId: `DIE-${partNum.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`,
              strokesCurrent: 50000,
              strokesMax: 250000,
              healthStatus: 'Operational',
              image: `images/image${(idx % 14) + 1}.png`
            });
          }
        });

        if (parsedTools.length > 0) {
          appState.tools = parsedTools;
          saveState();
          renderCurrentTab();
          updateSidebarBadges();
          updateGoogleSheetsBadge();

          if (!silent) {
            alert(`Successfully loaded ${parsedTools.length} parts directly from your Google Sheet!`);
          }
          return;
        }
      }
    }

    throw new Error('Unrecognized Google Sheet format. Please use a valid Google Sheet or Apps Script Web App URL.');
  } catch (err) {
    console.warn('Google Sheets fetch failed:', err);
    if (!silent) {
      alert(`Google Sheet Connection Notice:\n\n${err.message}\n\n👉 To allow the web app to read and write directly:\n1. Open your Google Sheet\n2. Click "Share" (top-right) and set "General access: Anyone with the link (Viewer)"\n3. Or deploy the Google Apps Script via Extensions > Apps Script for two-way sync!`);
    }
  }
}

async function pushToGoogleSheets(silent = false) {
  const url = appState.googleSheetsUrl || (document.getElementById('gs-web-app-url')?.value || '').trim();
  if (!url || !url.includes('script.google.com')) {
    if (!silent) {
      alert('To push and save data to Google Sheets, you need a Google Apps Script Web App URL deployed on your spreadsheet.\n\nSee the quick instructions in the Google Sheets DB modal!');
    }
    return;
  }

  try {
    const payload = {
      action: 'sync_all',
      data: {
        tools: appState.tools,
        workOrders: appState.workOrders,
        maintenanceHistory: appState.maintenanceHistory
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status === 'success') {
      if (!silent) alert('Successfully synchronized all data to your Google Sheet!');
    } else {
      throw new Error(result.message || 'Failed to update Google Sheet');
    }
  } catch (err) {
    console.error('Google Sheets push failed:', err);
    if (!silent) alert('Error pushing to Google Sheet: ' + err.message);
  }
}

function copyAppsScriptCode() {
  fetch('google_apps_script.js')
    .then(r => r.text())
    .then(text => {
      navigator.clipboard.writeText(text);
      alert('Google Apps Script code copied to your clipboard!\n\nIn your Google Sheet, go to Extensions > Apps Script, paste and Deploy as Web app.');
    })
    .catch(() => {
      alert('Please open google_apps_script.js in your project folder to copy the script code.');
    });
}

