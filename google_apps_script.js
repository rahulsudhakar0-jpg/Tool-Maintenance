/**
 * Tool Maintenance Web Application - Google Sheets Backend API
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.new) and create a new spreadsheet.
 * 2. Name it "Tool Maintenance & Lifecycle Database".
 * 3. Go to Extensions > Apps Script.
 * 4. Replace any existing code with this entire script.
 * 5. Click "Deploy" > "New deployment".
 * 6. Select Type: "Web app".
 *    - Description: "Tool Maintenance API"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 7. Click "Deploy", authorize permissions, and copy the Web App URL.
 * 8. Paste that URL into the "Google Sheets DB" settings modal in your Web App!
 */

// Handle GET requests (Fetch database)
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheetsIfNeeded(ss);

    const tools = readSheetAsJson(ss.getSheetByName("Tools_Registry"));
    const workOrders = readSheetAsJson(ss.getSheetByName("Work_Orders"));
    const history = readSheetAsJson(ss.getSheetByName("Maintenance_History"));

    // Parse nested fields like checklist
    workOrders.forEach(wo => {
      if (typeof wo.checklist === 'string') {
        try { wo.checklist = JSON.parse(wo.checklist); } catch(err) { wo.checklist = []; }
      }
    });

    const response = {
      status: "success",
      timestamp: new Date().toISOString(),
      data: {
        tools: tools,
        workOrders: workOrders,
        maintenanceHistory: history
      }
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle POST requests (Sync or update database)
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheetsIfNeeded(ss);

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || "sync_all";

    if (action === "sync_all" && payload.data) {
      if (payload.data.tools) {
        writeJsonToSheet(ss.getSheetByName("Tools_Registry"), payload.data.tools);
      }
      if (payload.data.workOrders) {
        // Stringify nested checklist
        const wos = payload.data.workOrders.map(wo => ({
          ...wo,
          checklist: JSON.stringify(wo.checklist || [])
        }));
        writeJsonToSheet(ss.getSheetByName("Work_Orders"), wos);
      }
      if (payload.data.maintenanceHistory) {
        writeJsonToSheet(ss.getSheetByName("Maintenance_History"), payload.data.maintenanceHistory);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Database updated successfully in Google Sheets",
      updatedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Initialize template headers if sheets are empty
function initSheetsIfNeeded(ss) {
  const toolHeaders = [
    "id", "slNo", "partNumber", "description", "customer", "criticality", "category",
    "toolId", "toolType", "pressTonnage", "mechNo", "speed", "material", "thickness", "cavities",
    "toolingSize", "blankingGap", "designer", "platingSupplier", "productPosition",
    "strokesCurrent", "strokesMax", "colAD_ToolShot", "actualToolShot", "warrantyToolShots", "currentTotalShot",
    "matchedToolShotId", "healthStatus", "location", "assignedTech", "pipelineStatus", "notes"
  ];

  const woHeaders = [
    "id", "toolId", "partNumber", "partDescription", "orderType",
    "priority", "status", "createdDate", "dueDate", "assignedTech",
    "strokesAtMaintenance", "problemDescription", "actionPlan", "checklist", "notes"
  ];

  const histHeaders = [
    "id", "date", "toolId", "partNumber", "partDescription",
    "type", "tech", "strokes", "downtimeHours", "actions", "outcome"
  ];

  getOrCreateSheet(ss, "Tools_Registry", toolHeaders);
  getOrCreateSheet(ss, "Work_Orders", woHeaders);
  getOrCreateSheet(ss, "Maintenance_History", histHeaders);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#1e293b")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readSheetAsJson(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

function writeJsonToSheet(sheet, items) {
  if (!sheet || !items || items.length === 0) return;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Clear existing rows (keep headers)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  const rows = items.map(item => {
    return headers.map(h => item[h] !== undefined ? item[h] : "");
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}
