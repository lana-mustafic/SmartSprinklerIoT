/**
 * Smart Irrigation — Dashboard Application Logic
 * Firebase paths:
 *   sensors/moisture      (number)
 *   system/auto_mode      (bool)
 *   system/manual_pump    (bool)
 *   system/pump_status    (bool)
 */

import { database } from "./firebase-config.js";
import { ref, onValue, set } from "firebase/database";
import { initCharts, addMoisturePoint, addPumpPoint } from "./charts.js";

const DB_PATHS = {
  MOISTURE: "sensors/moisture",
  AUTO_MODE: "system/auto_mode",
  MANUAL_PUMP: "system/manual_pump",
  PUMP_STATUS: "system/pump_status",
  SYSTEM: "system",
};

const VALUES = {
  PUMP: { ON: "ON", OFF: "OFF" },
  MODE: { AUTO: "AUTO", MANUAL: "MANUAL" },
};

const MOISTURE_DRY_THRESHOLD = 40;

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------

const elements = {
  connectionStatus: document.getElementById("connectionStatus"),
  moistureValue: document.getElementById("moistureValue"),
  moistureBar: document.getElementById("moistureBar"),
  moistureHint: document.getElementById("moistureHint"),
  envMoisture: document.getElementById("envMoisture"),
  envPump: document.getElementById("envPump"),
  modeStatus: document.getElementById("modeStatus"),
  modeCardHint: document.getElementById("modeCardHint"),
  pumpStatus: document.getElementById("pumpStatus"),
  pumpHint: document.getElementById("pumpHint"),
  pumpCard: document.getElementById("pumpCard"),
  irrigationBadge: document.getElementById("irrigationBadge"),
  irrigationMessage: document.getElementById("irrigationMessage"),
  lastUpdateLabel: document.getElementById("lastUpdateLabel"),
  modeHint: document.getElementById("modeHint"),
  pumpControlHint: document.getElementById("pumpControlHint"),
  pumpActivityState: document.getElementById("pumpActivityState"),
  conditionMoisture: document.getElementById("conditionMoisture"),
  conditionAuto: document.getElementById("conditionAuto"),
  btnAutoMode: document.getElementById("btnAutoMode"),
  btnManualMode: document.getElementById("btnManualMode"),
  btnPumpOn: document.getElementById("btnPumpOn"),
  btnPumpOff: document.getElementById("btnPumpOff"),
};

// ---------------------------------------------------------------------------
// Application State
// ---------------------------------------------------------------------------

const state = {
  moisture: null,
  autoMode: null,
  manualPump: null,
  pump: null,
  connected: false,
  lastUpdate: null,
  lastChartMoisture: null,
  lastChartPump: null,
};

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === 1 || value === "1" || value === "ON") {
    return true;
  }

  if (value === "false" || value === 0 || value === "0" || value === "OFF") {
    return false;
  }

  return null;
}

function pumpLabel(isOn) {
  if (isOn === true) {
    return VALUES.PUMP.ON;
  }

  if (isOn === false) {
    return VALUES.PUMP.OFF;
  }

  return "--";
}

function modeLabel(isAuto) {
  if (isAuto === true) {
    return VALUES.MODE.AUTO;
  }

  if (isAuto === false) {
    return VALUES.MODE.MANUAL;
  }

  return "--";
}

// ---------------------------------------------------------------------------
// UI Helpers
// ---------------------------------------------------------------------------

function setConnectionStatus(status) {
  const el = elements.connectionStatus;
  const label = el.querySelector(".connection-status__label");

  el.classList.remove(
    "connection-status--connected",
    "connection-status--disconnected"
  );

  if (status === "connected") {
    el.classList.add("connection-status--connected");
    label.textContent = "Online";
  } else if (status === "error" || status === "disconnected") {
    el.classList.add("connection-status--disconnected");
    label.textContent = "Offline";
  } else {
    label.textContent = "Connecting…";
  }

  state.connected = status === "connected";
}

function setConditionState(item, met) {
  if (!item) {
    return;
  }

  const mark = item.querySelector(".condition-item__mark");

  if (met === true) {
    item.dataset.met = "true";
    mark.textContent = "✓";
    mark.setAttribute("aria-label", "Condition met");
  } else if (met === false) {
    item.dataset.met = "false";
    mark.textContent = "✕";
    mark.setAttribute("aria-label", "Condition not met");
  } else {
    item.dataset.met = "unknown";
    mark.textContent = "—";
    mark.setAttribute("aria-label", "No data");
  }
}

function getMoistureLevel(percent) {
  if (percent < MOISTURE_DRY_THRESHOLD) {
    return { label: "Dry — irrigation may be needed", color: "var(--color-danger)" };
  }

  if (percent < 70) {
    return { label: "Moderate moisture level", color: "var(--color-warning)" };
  }

  return { label: "Well hydrated", color: "var(--color-success)" };
}

function markUpdated() {
  state.lastUpdate = new Date();
  elements.lastUpdateLabel.textContent =
    "Last update: " +
    state.lastUpdate.toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "short",
    });
}

// ---------------------------------------------------------------------------
// UI Rendering
// ---------------------------------------------------------------------------

function renderMoisture(value) {
  if (value === null || value === undefined || isNaN(value)) {
    elements.moistureValue.textContent = "--";
    elements.moistureBar.style.width = "0%";
    elements.moistureHint.textContent = "Waiting for data…";
    elements.envMoisture.textContent = "-- %";
    state.moisture = null;
    renderAutomationConditions();
    renderIrrigationStatus();
    return;
  }

  const percent = Math.max(0, Math.min(100, Math.round(Number(value))));
  const level = getMoistureLevel(percent);

  elements.moistureValue.textContent = percent;
  elements.moistureBar.style.width = `${percent}%`;
  elements.moistureBar.style.backgroundColor = level.color;
  elements.moistureHint.textContent = level.label;
  elements.envMoisture.textContent = percent + " %";
  state.moisture = percent;

  if (state.lastChartMoisture !== percent) {
    addMoisturePoint(new Date(), percent);
    state.lastChartMoisture = percent;
  }

  renderAutomationConditions();
  renderIrrigationStatus();
}

function renderMode(autoModeValue) {
  const isAuto = toBoolean(autoModeValue);
  const mode = modeLabel(isAuto);

  elements.modeStatus.textContent = mode;
  elements.modeStatus.classList.remove("is-auto", "is-manual");

  if (isAuto === true) {
    elements.modeStatus.classList.add("is-auto");
    elements.modeCardHint.textContent = "ESP32 controls the pump";
    elements.modeHint.textContent =
      "AUTO active — ESP32 controls irrigation. Pump buttons are disabled.";
  } else if (isAuto === false) {
    elements.modeStatus.classList.add("is-manual");
    elements.modeCardHint.textContent = "Dashboard controls the pump";
    elements.modeHint.textContent =
      "MANUAL active — pump is controlled from this dashboard.";
  } else {
    elements.modeCardHint.textContent = "Operating mode";
    elements.modeHint.textContent = "Operating mode";
  }

  state.autoMode = isAuto;
  updateModeButtons();
  updatePumpButtons();
  renderAutomationConditions();
  renderIrrigationStatus();
}

function renderManualPump(value) {
  state.manualPump = toBoolean(value);
  updatePumpButtons();
}

function renderPump(pumpStatusValue) {
  const isOn = toBoolean(pumpStatusValue);
  const pump = pumpLabel(isOn);

  elements.pumpStatus.textContent = pump;
  elements.pumpStatus.classList.remove("is-on", "is-off");
  elements.pumpCard.classList.remove("is-active");
  elements.envPump.textContent = pump;

  if (isOn === true) {
    elements.pumpStatus.classList.add("is-on");
    elements.pumpCard.classList.add("is-active");
    elements.pumpHint.textContent = "Pump is running";
  } else if (isOn === false) {
    elements.pumpStatus.classList.add("is-off");
    elements.pumpHint.textContent = "Water pump";
  } else {
    elements.pumpHint.textContent = "Water pump";
  }

  elements.pumpActivityState.textContent = pump;
  state.pump = isOn;

  if (isOn !== null && state.lastChartPump !== isOn) {
    addPumpPoint(new Date(), pump);
    state.lastChartPump = isOn;
  }

  updatePumpButtons();
  renderIrrigationStatus();
}

function deriveIrrigationStatus() {
  if (state.autoMode === false) {
    return {
      key: "manual",
      badge: "Manual",
      message: "Manual control active",
    };
  }

  if (state.pump === true) {
    return {
      key: "running",
      badge: "Running",
      message: "Pump running",
    };
  }

  if (state.moisture !== null && state.moisture < MOISTURE_DRY_THRESHOLD) {
    return {
      key: "indicate",
      badge: "Alert",
      message: "Conditions indicate irrigation",
    };
  }

  if (state.moisture === null && state.autoMode === null && state.pump === null) {
    return {
      key: "waiting",
      badge: "Waiting",
      message: "Waiting for ESP32 data…",
    };
  }

  return {
    key: "normal",
    badge: "Normal",
    message: "Normal",
  };
}

function renderIrrigationStatus() {
  const status = deriveIrrigationStatus();

  elements.irrigationBadge.textContent = status.badge;
  elements.irrigationBadge.className = "status-card__badge";

  if (status.key === "normal") {
    elements.irrigationBadge.classList.add("is-normal");
  } else if (status.key === "indicate") {
    elements.irrigationBadge.classList.add("is-indicate");
  } else if (status.key === "running") {
    elements.irrigationBadge.classList.add("is-running");
  } else if (status.key === "manual") {
    elements.irrigationBadge.classList.add("is-manual");
  }

  elements.irrigationMessage.textContent = status.message;
}

function renderAutomationConditions() {
  const moistureMet =
    state.moisture === null ? null : state.moisture < MOISTURE_DRY_THRESHOLD;
  const autoMet = state.autoMode === null ? null : state.autoMode === true;

  setConditionState(elements.conditionMoisture, moistureMet);
  setConditionState(elements.conditionAuto, autoMet);
}

function updateModeButtons() {
  elements.btnAutoMode.classList.toggle("is-active", state.autoMode === true);
  elements.btnManualMode.classList.toggle("is-active", state.autoMode === false);
}

function updatePumpButtons() {
  const isManual = state.autoMode === false;

  elements.btnPumpOn.disabled = !isManual;
  elements.btnPumpOff.disabled = !isManual;

  const commandOn = state.manualPump === true;

  elements.btnPumpOn.classList.toggle("is-active", isManual && commandOn);
  elements.btnPumpOff.classList.toggle("is-active", isManual && state.manualPump === false);

  elements.pumpControlHint.textContent = isManual
    ? "Manual mode active — TURN ON / OFF writes system/manual_pump."
    : "Switch to MANUAL mode to control the pump from the dashboard.";
}

// ---------------------------------------------------------------------------
// Firebase Operations
// ---------------------------------------------------------------------------

function handleFirebaseError(error, context) {
  console.error(`Firebase ${context} error:`, error.message);
  setConnectionStatus("error");

  if (context === "read") {
    elements.irrigationMessage.textContent =
      "Unable to load data. Check Firebase connection.";
  }
}

function writeValue(path, value) {
  return set(ref(database, path), value).catch(function (error) {
    handleFirebaseError(error, "write");
    throw error;
  });
}

function subscribeToDatabase() {
  onValue(
    ref(database, DB_PATHS.MOISTURE),
    function (snapshot) {
      setConnectionStatus("connected");
      markUpdated();
      renderMoisture(snapshot.val());
    },
    function (error) {
      handleFirebaseError(error, "read");
    }
  );

  onValue(
    ref(database, DB_PATHS.SYSTEM),
    function (snapshot) {
      setConnectionStatus("connected");
      markUpdated();

      const system = snapshot.val() || {};
      renderMode(system.auto_mode);
      renderManualPump(system.manual_pump);
      renderPump(system.pump_status);
    },
    function (error) {
      handleFirebaseError(error, "read");
    }
  );
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

function handleModeChange(isAuto) {
  writeValue(DB_PATHS.AUTO_MODE, isAuto).catch(function () {
    /* Error already logged */
  });
}

function handlePumpChange(isOn) {
  if (state.autoMode !== false) {
    return;
  }

  writeValue(DB_PATHS.MANUAL_PUMP, isOn).catch(function () {
    /* Error already logged */
  });
}

function bindEvents() {
  elements.btnAutoMode.addEventListener("click", function () {
    handleModeChange(true);
  });

  elements.btnManualMode.addEventListener("click", function () {
    handleModeChange(false);
  });

  elements.btnPumpOn.addEventListener("click", function () {
    handlePumpChange(true);
  });

  elements.btnPumpOff.addEventListener("click", function () {
    handlePumpChange(false);
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function init() {
  initCharts();
  bindEvents();
  setConnectionStatus("connecting");
  renderIrrigationStatus();
  renderAutomationConditions();

  try {
    subscribeToDatabase();
  } catch (error) {
    handleFirebaseError(error, "init");
  }
}

document.addEventListener("DOMContentLoaded", init);
