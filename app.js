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
  viewMode: 'grid',
  activeToolId: null,
  zoomScale: 1.0
};

// Charts references
let strokeChartInstance = null;
let donutChartInstance = null;

// ==========================================================================
// Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initData();
  setupNavigation();
  renderCurrentTab();
  updateSidebarBadges();
});

function initData() {
  const savedTools = localStorage.getItem('tool_maint_tools');
  const savedWO = localStorage.getItem('tool_maint_workorders');
  const savedHist = localStorage.getItem('tool_maint_history');

  if (savedTools && savedWO && savedHist) {
    try {
      appState.tools = JSON.parse(savedTools);
      appState.workOrders = JSON.parse(savedWO);
      appState.maintenanceHistory = JSON.parse(savedHist);
    } catch (e) {
      console.warn('Failed to parse localStorage, resetting to initial data', e);
      loadInitialData();
    }
  } else {
    loadInitialData();
  }
}

function loadInitialData() {
  if (typeof INITIAL_DATA !== 'undefined') {
    appState.tools = JSON.parse(JSON.stringify(INITIAL_DATA.tools));
    appState.workOrders = JSON.parse(JSON.stringify(INITIAL_DATA.workOrders));
    appState.maintenanceHistory = JSON.parse(JSON.stringify(INITIAL_DATA.maintenanceHistory));
    saveState();
  }
}

function saveState() {
  localStorage.setItem('tool_maint_tools', JSON.stringify(appState.tools));
  localStorage.setItem('tool_maint_workorders', JSON.stringify(appState.workOrders));
  localStorage.setItem('tool_maint_history', JSON.stringify(appState.maintenanceHistory));
  updateSidebarBadges();

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
    if (critCount[t.criticality] !== undefined) {
      critCount[t.criticality]++;
    }
  });

  const ctxDonut = document.getElementById('criticalityDonut');
  if (ctxDonut) {
    if (donutChartInstance) donutChartInstance.destroy();
    donutChartInstance = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'Major', 'Minor'],
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
  const searchTerm = (document.getElementById('registry-search')?.value || '').toLowerCase();
  const critFilter = document.getElementById('filter-criticality')?.value || 'ALL';
  const statusFilter = document.getElementById('filter-status')?.value || 'ALL';

  const filtered = appState.tools.filter(t => {
    const matchesSearch = 
      t.partNumber.toLowerCase().includes(searchTerm) ||
      t.description.toLowerCase().includes(searchTerm) ||
      t.toolId.toLowerCase().includes(searchTerm) ||
      (t.material && t.material.toLowerCase().includes(searchTerm));

    const matchesCrit = critFilter === 'ALL' || t.criticality === critFilter;
    const matchesStatus = statusFilter === 'ALL' || t.healthStatus === statusFilter;

    return matchesSearch && matchesCrit && matchesStatus;
  });

  renderToolsGrid(filtered);
  renderToolsTable(filtered);
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
            <div class="part-code">${tool.partNumber}</div>
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
            <span class="meta-label">Tool ID</span>
            <span class="meta-value">${tool.toolId}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Press Machine</span>
            <span class="meta-value">${tool.pressTonnage || 'N/A'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Next PM Due</span>
            <span class="meta-value">${tool.nextPmDate || 'Scheduled'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Location</span>
            <span class="meta-value">${tool.location || 'Toolroom'}</span>
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
      <td>
        <img src="${tool.image || 'images/image1.png'}" class="table-thumb" alt="${tool.partNumber}" onclick="openLightbox('${tool.image}', '${tool.partNumber}', '${tool.description}')" style="cursor: pointer;">
      </td>
      <td><strong class="part-code">${tool.partNumber}</strong></td>
      <td>${tool.description}</td>
      <td><code>${tool.toolId}</code></td>
      <td>${getCriticalityBadge(tool.criticality)}</td>
      <td>
        <div class="stroke-meter" style="width: 130px;">
          <div class="stroke-meta">
            <span>${strokePct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${getStrokeColor(strokePct)}" style="width: ${strokePct}%"></div>
          </div>
        </div>
      </td>
      <td>${getHealthStatusPill(tool.healthStatus)}</td>
      <td>${tool.nextPmDate || 'Scheduled'}</td>
      <td>${tool.location || 'Line Bay'}</td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="openToolDetailModal('${tool.id}')">Inspect</button>
          <button class="btn btn-primary btn-sm" onclick="openNewWorkOrderForTool('${tool.id}')">WO</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function setViewMode(mode) {
  appState.viewMode = mode;
  document.getElementById('view-mode-grid').classList.toggle('active', mode === 'grid');
  document.getElementById('view-mode-table').classList.toggle('active', mode === 'table');

  document.getElementById('registry-grid-container').style.display = mode === 'grid' ? 'grid' : 'none';
  document.getElementById('registry-table-container').style.display = mode === 'table' ? 'block' : 'none';
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

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; font-size: 13px;">
          <div><span style="color: var(--text-muted);">Tool Type:</span> <strong>${tool.toolType}</strong></div>
          <div><span style="color: var(--text-muted);">Tonnage:</span> <strong>${tool.pressTonnage || 'N/A'}</strong></div>
          <div><span style="color: var(--text-muted);">Cavities:</span> <strong>${tool.cavities || 1}</strong></div>
          <div><span style="color: var(--text-muted);">Material:</span> <strong>${tool.material || 'Standard Alloy'}</strong></div>
          <div><span style="color: var(--text-muted);">Location:</span> <strong>${tool.location || 'Toolroom'}</strong></div>
          <div><span style="color: var(--text-muted);">Technician:</span> <strong>${tool.assignedTech || 'Unassigned'}</strong></div>
          <div><span style="color: var(--text-muted);">Next PM Due:</span> <strong>${tool.nextPmDate || 'Scheduled'}</strong></div>
          <div><span style="color: var(--text-muted);">PM Interval:</span> <strong>${(tool.pmIntervalStrokes || 50000).toLocaleString()} strokes</strong></div>
        </div>
      </div>
    </div>

    <div style="background: #f1f5f9; padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px;">
      <strong style="font-size: 12px; text-transform: uppercase; color: var(--text-muted);">LAIR Pipeline Status & Remarks:</strong>
      <div style="font-size: 14px; color: var(--text-main); margin-top: 4px;">
        <strong>${tool.pipelineStatus}</strong> — ${tool.remarks || 'Samples approved'}
      </div>
    </div>

    ${tool.notes ? `
      <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 12px 16px; border-radius: var(--radius-md); font-size: 13px; color: #92400e; margin-bottom: 20px;">
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
    let csv = 'ID,Part Number,Description,Criticality,Tool ID,Tool Type,Press Tonnage,Material,Current Strokes,Max Strokes,Health Status,Pipeline Status,Samples Qty,Location,Technician\n';
    appState.tools.forEach(t => {
      csv += `"${t.id}","${t.partNumber}","${t.description}","${t.criticality}","${t.toolId}","${t.toolType || ''}","${t.pressTonnage || ''}","${t.material || ''}",${t.strokesCurrent},${t.strokesMax},"${t.healthStatus}","${t.pipelineStatus}",${t.samplesQty || 0},"${t.location || ''}","${t.assignedTech || ''}"\n`;
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
