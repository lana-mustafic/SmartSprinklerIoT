/**
 * Smart Sprinkler IoT — Dashboard Application Logic
 */

import { database } from "./firebase-config.js";
import { ref, onValue, update } from "firebase/database";

const DB_ROOT = "smartSprinkler";

const VALUES = {
  PUMP: { ON: "ON", OFF: "OFF" },
  MODE: { AUTO: "AUTO", MANUAL: "MANUAL" },
};

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------

const elements = {
  connectionStatus: document.getElementById("connectionStatus"),
  moistureValue: document.getElementById("moistureValue"),
  moistureBar: document.getElementById("moistureBar"),
  moistureHint: document.getElementById("moistureHint"),
  pumpStatus: document.getElementById("pumpStatus"),
  pumpHint: document.getElementById("pumpHint"),
  modeStatus: document.getElementById("modeStatus"),
  modeHint: document.getElementById("modeHint"),
  pumpControlHint: document.getElementById("pumpControlHint"),
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
  pump: null,
  mode: null,
  connected: false,
};

// ---------------------------------------------------------------------------
// UI Rendering
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
    label.textContent = "Connected";
  } else if (status === "error") {
    el.classList.add("connection-status--disconnected");
    label.textContent = "Connection error";
  } else if (status === "disconnected") {
    el.classList.add("connection-status--disconnected");
    label.textContent = "Disconnected";
  } else {
    label.textContent = "Connecting…";
  }

  state.connected = status === "connected";
}

function getMoistureLevel(percent) {
  if (percent < 30) {
    return { label: "Dry — irrigation may be needed", color: "var(--color-moisture-dry)" };
  }
  if (percent < 60) {
    return { label: "Moderate moisture level", color: "var(--color-moisture-mid)" };
  }
  return { label: "Well hydrated", color: "var(--color-moisture-wet)" };
}

function renderMoisture(value) {
  if (value === null || value === undefined || isNaN(value)) {
    elements.moistureValue.textContent = "--";
    elements.moistureBar.style.width = "0%";
    elements.moistureHint.textContent = "Waiting for data…";
    return;
  }

  const percent = Math.max(0, Math.min(100, Math.round(Number(value))));
  const level = getMoistureLevel(percent);

  elements.moistureValue.textContent = percent;
  elements.moistureBar.style.width = `${percent}%`;
  elements.moistureBar.style.backgroundColor = level.color;
  elements.moistureHint.textContent = level.label;
  state.moisture = percent;
}

function renderPump(value) {
  const pump = value || "--";
  elements.pumpStatus.textContent = pump;
  elements.pumpStatus.classList.remove("is-on", "is-off");

  if (pump === VALUES.PUMP.ON) {
    elements.pumpStatus.classList.add("is-on");
    elements.pumpHint.textContent = "Pump is running";
  } else if (pump === VALUES.PUMP.OFF) {
    elements.pumpStatus.classList.add("is-off");
    elements.pumpHint.textContent = "Pump is idle";
  } else {
    elements.pumpHint.textContent = "Water pump state";
  }

  state.pump = pump;
  updatePumpButtons();
}

function renderMode(value) {
  const mode = value || "--";
  elements.modeStatus.textContent = mode;
  elements.modeStatus.classList.remove("is-auto", "is-manual");

  if (mode === VALUES.MODE.AUTO) {
    elements.modeStatus.classList.add("is-auto");
    elements.modeHint.textContent = "ESP32 controls the pump automatically";
  } else if (mode === VALUES.MODE.MANUAL) {
    elements.modeStatus.classList.add("is-manual");
    elements.modeHint.textContent = "Pump controlled from dashboard";
  } else {
    elements.modeHint.textContent = "Operating mode";
  }

  state.mode = mode;
  updateModeButtons();
  updatePumpButtons();
}

function updateModeButtons() {
  elements.btnAutoMode.classList.toggle(
    "is-active",
    state.mode === VALUES.MODE.AUTO
  );
  elements.btnManualMode.classList.toggle(
    "is-active",
    state.mode === VALUES.MODE.MANUAL
  );
}

function updatePumpButtons() {
  const isManual = state.mode === VALUES.MODE.MANUAL;

  elements.btnPumpOn.disabled = !isManual;
  elements.btnPumpOff.disabled = !isManual;

  elements.btnPumpOn.classList.toggle(
    "is-active",
    isManual && state.pump === VALUES.PUMP.ON
  );
  elements.btnPumpOff.classList.toggle(
    "is-active",
    isManual && state.pump === VALUES.PUMP.OFF
  );

  elements.pumpControlHint.textContent = isManual
    ? "Manual mode active — use the buttons below to control the pump."
    : "Switch to MANUAL mode to control the pump from the dashboard.";
}

function renderDashboard(data) {
  if (!data) {
    return;
  }

  renderMoisture(data.soilMoisture);
  renderPump(data.pumpStatus);
  renderMode(data.mode);
}

// ---------------------------------------------------------------------------
// Firebase Operations
// ---------------------------------------------------------------------------

function handleFirebaseError(error, context) {
  console.error(`Firebase ${context} error:`, error.message);
  setConnectionStatus("error");

  if (context === "read") {
    elements.moistureHint.textContent = "Unable to load data. Check Firebase connection.";
  }
}

function updateDatabase(updates) {
  const sprinklerRef = ref(database, DB_ROOT);

  return update(sprinklerRef, updates).catch(function (error) {
    handleFirebaseError(error, "write");
    throw error;
  });
}

function subscribeToDatabase() {
  const sprinklerRef = ref(database, DB_ROOT);

  onValue(
    sprinklerRef,
    function (snapshot) {
      setConnectionStatus("connected");
      renderDashboard(snapshot.val());
    },
    function (error) {
      handleFirebaseError(error, "read");
    }
  );
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

function handleModeChange(mode) {
  updateDatabase({ mode: mode }).catch(function () {
    /* Error already logged in updateDatabase */
  });
}

function handlePumpChange(pumpState) {
  if (state.mode !== VALUES.MODE.MANUAL) {
    return;
  }

  updateDatabase({
    manualCommand: pumpState,
    pumpStatus: pumpState,
  }).catch(function () {
    /* Error already logged in updateDatabase */
  });
}

function bindEvents() {
  elements.btnAutoMode.addEventListener("click", function () {
    handleModeChange(VALUES.MODE.AUTO);
  });

  elements.btnManualMode.addEventListener("click", function () {
    handleModeChange(VALUES.MODE.MANUAL);
  });

  elements.btnPumpOn.addEventListener("click", function () {
    handlePumpChange(VALUES.PUMP.ON);
  });

  elements.btnPumpOff.addEventListener("click", function () {
    handlePumpChange(VALUES.PUMP.OFF);
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function init() {
  bindEvents();
  setConnectionStatus("connecting");

  try {
    subscribeToDatabase();
  } catch (error) {
    handleFirebaseError(error, "init");
  }
}

document.addEventListener("DOMContentLoaded", init);
