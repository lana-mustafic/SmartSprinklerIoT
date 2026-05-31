/**
 * Smart Sprinkler IoT — Dashboard Application Logic
 */

(function () {
  "use strict";

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
    } else if (status === "disconnected") {
      el.classList.add("connection-status--disconnected");
      label.textContent = "Disconnected";
    } else {
      label.textContent = "Connecting…";
    }

    state.connected = status === "connected";
  }

  function getMoistureLevel(percent) {
    if (percent < 30) return { label: "Dry — irrigation may be needed", color: "var(--color-moisture-dry)" };
    if (percent < 60) return { label: "Moderate moisture level", color: "var(--color-moisture-mid)" };
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

    if (pump === SYSTEM_VALUES.PUMP.ON) {
      elements.pumpStatus.classList.add("is-on");
      elements.pumpHint.textContent = "Pump is running";
    } else if (pump === SYSTEM_VALUES.PUMP.OFF) {
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

    if (mode === SYSTEM_VALUES.MODE.AUTO) {
      elements.modeStatus.classList.add("is-auto");
      elements.modeHint.textContent = "ESP32 controls the pump automatically";
    } else if (mode === SYSTEM_VALUES.MODE.MANUAL) {
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
      state.mode === SYSTEM_VALUES.MODE.AUTO
    );
    elements.btnManualMode.classList.toggle(
      "is-active",
      state.mode === SYSTEM_VALUES.MODE.MANUAL
    );
  }

  function updatePumpButtons() {
    const isManual = state.mode === SYSTEM_VALUES.MODE.MANUAL;

    elements.btnPumpOn.disabled = !isManual;
    elements.btnPumpOff.disabled = !isManual;

    elements.btnPumpOn.classList.toggle(
      "is-active",
      isManual && state.pump === SYSTEM_VALUES.PUMP.ON
    );
    elements.btnPumpOff.classList.toggle(
      "is-active",
      isManual && state.pump === SYSTEM_VALUES.PUMP.OFF
    );

    elements.pumpControlHint.textContent = isManual
      ? "Manual mode active — use the buttons below to control the pump."
      : "Switch to MANUAL mode to control the pump from the dashboard.";
  }

  // ---------------------------------------------------------------------------
  // Firebase Operations
  // ---------------------------------------------------------------------------

  function writeToDatabase(path, value) {
    const db = getDatabase();
    if (!db) {
      console.error("Database not initialized.");
      return;
    }

    db.ref(path)
      .set(value)
      .catch(function (error) {
        console.error(`Failed to write ${path}:`, error.message);
      });
  }

  function subscribeToDatabase() {
    const db = getDatabase();
    if (!db) {
      setConnectionStatus("disconnected");
      return;
    }

    const connectedRef = db.ref(".info/connected");

    connectedRef.on("value", function (snapshot) {
      setConnectionStatus(snapshot.val() === true ? "connected" : "disconnected");
    });

    db.ref(DB_PATHS.MOISTURE).on("value", function (snapshot) {
      renderMoisture(snapshot.val());
    });

    db.ref(DB_PATHS.PUMP).on("value", function (snapshot) {
      renderPump(snapshot.val());
    });

    db.ref(DB_PATHS.MODE).on("value", function (snapshot) {
      renderMode(snapshot.val());
    });
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  function handleModeChange(mode) {
    writeToDatabase(DB_PATHS.MODE, mode);
  }

  function handlePumpChange(pumpState) {
    if (state.mode !== SYSTEM_VALUES.MODE.MANUAL) {
      return;
    }
    writeToDatabase(DB_PATHS.PUMP, pumpState);
  }

  function bindEvents() {
    elements.btnAutoMode.addEventListener("click", function () {
      handleModeChange(SYSTEM_VALUES.MODE.AUTO);
    });

    elements.btnManualMode.addEventListener("click", function () {
      handleModeChange(SYSTEM_VALUES.MODE.MANUAL);
    });

    elements.btnPumpOn.addEventListener("click", function () {
      handlePumpChange(SYSTEM_VALUES.PUMP.ON);
    });

    elements.btnPumpOff.addEventListener("click", function () {
      handlePumpChange(SYSTEM_VALUES.PUMP.OFF);
    });
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  function init() {
    bindEvents();
    setConnectionStatus("connecting");

    const db = initFirebase();
    if (db) {
      subscribeToDatabase();
    } else {
      setConnectionStatus("disconnected");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
