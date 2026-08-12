/**
 * Smart Irrigation — Dashboard Application Logic
 */

import { database } from "./firebase-config.js";
import { ref, onValue, update } from "firebase/database";
import {
  initCharts,
  addTemperaturePoint,
  addHumidityPoint,
  addLightPoint,
  addPumpPoint,
} from "./charts.js";

const DB_ROOT = "smartSprinkler";

const VALUES = {
  PUMP: { ON: "ON", OFF: "OFF" },
  MODE: { AUTO: "AUTO", MANUAL: "MANUAL" },
  LIGHT: { BRIGHT: "BRIGHT", DARK: "DARK" },
};

/** Planned AUTO thresholds (ESP32 will enforce when connected). */
const THRESHOLDS = {
  temperatureAbove: 28,
  humidityBelow: 40,
  lightEquals: "DARK",
};

const LIGHT_ICONS = {
  BRIGHT:
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>',
  DARK:
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>',
  UNKNOWN:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></svg>',
};

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------

const elements = {
  connectionStatus: document.getElementById("connectionStatus"),
  temperatureValue: document.getElementById("temperatureValue"),
  humidityValue: document.getElementById("humidityValue"),
  lightStatus: document.getElementById("lightStatus"),
  lightIcon: document.getElementById("lightIcon"),
  lightCard: document.querySelector(".metric-card--light"),
  pumpStatus: document.getElementById("pumpStatus"),
  pumpHint: document.getElementById("pumpHint"),
  pumpCard: document.getElementById("pumpCard"),
  envTemperature: document.getElementById("envTemperature"),
  envHumidity: document.getElementById("envHumidity"),
  envLight: document.getElementById("envLight"),
  irrigationBadge: document.getElementById("irrigationBadge"),
  irrigationMessage: document.getElementById("irrigationMessage"),
  lastUpdateLabel: document.getElementById("lastUpdateLabel"),
  modeHint: document.getElementById("modeHint"),
  pumpControlHint: document.getElementById("pumpControlHint"),
  pumpActivityState: document.getElementById("pumpActivityState"),
  conditionTemp: document.getElementById("conditionTemp"),
  conditionHumidity: document.getElementById("conditionHumidity"),
  conditionLight: document.getElementById("conditionLight"),
  btnAutoMode: document.getElementById("btnAutoMode"),
  btnManualMode: document.getElementById("btnManualMode"),
  btnPumpOn: document.getElementById("btnPumpOn"),
  btnPumpOff: document.getElementById("btnPumpOff"),
};

// ---------------------------------------------------------------------------
// Application State
// ---------------------------------------------------------------------------

const state = {
  temperature: null,
  humidity: null,
  lightStatus: null,
  pump: null,
  mode: null,
  irrigationStatus: null,
  lastUpdate: null,
  connected: false,
  lastChartTemperature: null,
  lastChartHumidity: null,
  lastChartLight: null,
  lastChartPump: null,
};

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
  } else if (status === "error") {
    el.classList.add("connection-status--disconnected");
    label.textContent = "Offline";
  } else if (status === "disconnected") {
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

function formatLastUpdate(value) {
  if (value === null || value === undefined || value === "") {
    return "Last update: —";
  }

  const date = typeof value === "number" ? new Date(value) : new Date(String(value));

  if (isNaN(date.getTime())) {
    return "Last update: " + String(value);
  }

  return (
    "Last update: " +
    date.toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "short",
    })
  );
}

// ---------------------------------------------------------------------------
// UI Rendering
// ---------------------------------------------------------------------------

function renderTemperature(value) {
  if (value === null || value === undefined || isNaN(value)) {
    elements.temperatureValue.textContent = "--";
    elements.envTemperature.textContent = "-- °C";
    state.temperature = null;
    return;
  }

  const temp = Math.round(Number(value) * 10) / 10;
  elements.temperatureValue.textContent = temp;
  elements.envTemperature.textContent = temp + " °C";
  state.temperature = temp;
}

function renderHumidity(value) {
  if (value === null || value === undefined || isNaN(value)) {
    elements.humidityValue.textContent = "--";
    elements.envHumidity.textContent = "-- %";
    state.humidity = null;
    return;
  }

  const humidity = Math.max(0, Math.min(100, Math.round(Number(value))));
  elements.humidityValue.textContent = humidity;
  elements.envHumidity.textContent = humidity + " %";
  state.humidity = humidity;
}

function renderLight(value) {
  const light = typeof value === "string" ? value.toUpperCase() : null;
  const isKnown =
    light === VALUES.LIGHT.BRIGHT || light === VALUES.LIGHT.DARK;

  elements.lightCard.classList.remove("is-bright", "is-dark");

  if (!isKnown) {
    elements.lightStatus.textContent = "NO DATA";
    elements.envLight.textContent = "NO DATA";
    elements.lightIcon.innerHTML = LIGHT_ICONS.UNKNOWN;
    state.lightStatus = null;
    return;
  }

  elements.lightStatus.textContent = light;
  elements.envLight.textContent = light;
  elements.lightIcon.innerHTML = LIGHT_ICONS[light];
  elements.lightCard.classList.add(light === VALUES.LIGHT.BRIGHT ? "is-bright" : "is-dark");
  state.lightStatus = light;
}

function renderPump(value) {
  const pump = value || "--";

  elements.pumpStatus.textContent = pump;
  elements.pumpStatus.classList.remove("is-on", "is-off");
  elements.pumpCard.classList.remove("is-active");

  if (pump === VALUES.PUMP.ON) {
    elements.pumpStatus.classList.add("is-on");
    elements.pumpCard.classList.add("is-active");
    elements.pumpHint.textContent = "Pump is running";
  } else if (pump === VALUES.PUMP.OFF) {
    elements.pumpStatus.classList.add("is-off");
    elements.pumpHint.textContent = "Water pump";
  } else {
    elements.pumpHint.textContent = "Water pump";
  }

  elements.pumpActivityState.textContent = pump;
  state.pump = pump;
  updatePumpButtons();
}

function renderMode(value) {
  const mode = value || "--";

  if (mode === VALUES.MODE.AUTO) {
    elements.modeHint.textContent =
      "AUTO active — ESP32 controls irrigation from environmental conditions.";
  } else if (mode === VALUES.MODE.MANUAL) {
    elements.modeHint.textContent =
      "MANUAL active — pump controlled from this dashboard.";
  } else {
    elements.modeHint.textContent = "Operating mode";
  }

  state.mode = mode;
  updateModeButtons();
  updatePumpButtons();
}

function deriveIrrigationStatus() {
  if (state.mode === VALUES.MODE.MANUAL) {
    return {
      key: "manual",
      badge: "Manual",
      message: "Manual control active",
    };
  }

  if (state.pump === VALUES.PUMP.ON) {
    return {
      key: "running",
      badge: "Running",
      message: "Pump running",
    };
  }

  const firebaseStatus =
    typeof state.irrigationStatus === "string"
      ? state.irrigationStatus.toUpperCase()
      : null;

  if (firebaseStatus === "IRRIGATE" || firebaseStatus === "CONDITIONS_MET") {
    return {
      key: "indicate",
      badge: "Alert",
      message: "Conditions indicate irrigation",
    };
  }

  if (firebaseStatus === "NORMAL") {
    return {
      key: "normal",
      badge: "Normal",
      message: "Normal",
    };
  }

  // Local preview of planned thresholds (not ESP32 authority yet)
  const tempMet =
    state.temperature !== null && state.temperature > THRESHOLDS.temperatureAbove;
  const humidityMet =
    state.humidity !== null && state.humidity < THRESHOLDS.humidityBelow;
  const lightMet = state.lightStatus === THRESHOLDS.lightEquals;

  if (
    state.temperature !== null &&
    state.humidity !== null &&
    state.lightStatus !== null &&
    tempMet &&
    humidityMet &&
    lightMet
  ) {
    return {
      key: "indicate",
      badge: "Alert",
      message: "Conditions indicate irrigation",
    };
  }

  if (
    state.temperature === null &&
    state.humidity === null &&
    state.lightStatus === null
  ) {
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
  elements.lastUpdateLabel.textContent = formatLastUpdate(state.lastUpdate);
}

function renderAutomationConditions() {
  const tempMet =
    state.temperature === null
      ? null
      : state.temperature > THRESHOLDS.temperatureAbove;
  const humidityMet =
    state.humidity === null
      ? null
      : state.humidity < THRESHOLDS.humidityBelow;
  const lightMet =
    state.lightStatus === null
      ? null
      : state.lightStatus === THRESHOLDS.lightEquals;

  setConditionState(elements.conditionTemp, tempMet);
  setConditionState(elements.conditionHumidity, humidityMet);
  setConditionState(elements.conditionLight, lightMet);
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

  state.irrigationStatus = data.irrigationStatus ?? null;
  state.lastUpdate = data.lastUpdate ?? null;

  recordChartData(data);
  renderTemperature(data.temperature);
  renderHumidity(data.humidity);
  renderLight(data.lightStatus);
  renderPump(data.pumpStatus);
  renderMode(data.mode);
  renderAutomationConditions();
  renderIrrigationStatus();
}

function recordChartData(data) {
  const now = new Date();

  if (data.temperature !== null && data.temperature !== undefined && !isNaN(data.temperature)) {
    const temperature = Math.round(Number(data.temperature) * 10) / 10;

    if (state.lastChartTemperature !== temperature) {
      addTemperaturePoint(now, temperature);
      state.lastChartTemperature = temperature;
    }
  }

  if (data.humidity !== null && data.humidity !== undefined && !isNaN(data.humidity)) {
    const humidity = Math.max(0, Math.min(100, Math.round(Number(data.humidity))));

    if (state.lastChartHumidity !== humidity) {
      addHumidityPoint(now, humidity);
      state.lastChartHumidity = humidity;
    }
  }

  if (
    data.lightStatus === VALUES.LIGHT.BRIGHT ||
    data.lightStatus === VALUES.LIGHT.DARK
  ) {
    if (state.lastChartLight !== data.lightStatus) {
      addLightPoint(now, data.lightStatus);
      state.lastChartLight = data.lightStatus;
    }
  }

  if (data.pumpStatus === VALUES.PUMP.ON || data.pumpStatus === VALUES.PUMP.OFF) {
    if (state.lastChartPump !== data.pumpStatus) {
      addPumpPoint(now, data.pumpStatus);
      state.lastChartPump = data.pumpStatus;
    }
  }
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
