/**
 * Smart Sprinkler IoT — Real-time chart management
 */

import Chart from "chart.js/auto";

const MAX_POINTS = 20;

const moisturePoints = [];
const pumpPoints = [];

let moistureChart = null;
let pumpChart = null;

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function trimPoints(points) {
  while (points.length > MAX_POINTS) {
    points.shift();
  }
}

function getThemeColors() {
  const root = getComputedStyle(document.documentElement);

  return {
    textMuted: root.getPropertyValue("--color-text-muted").trim() || "#8b9cb3",
    border: root.getPropertyValue("--color-border").trim() || "#2d3f56",
    primary: root.getPropertyValue("--color-primary").trim() || "#3b9eff",
    success: root.getPropertyValue("--color-success").trim() || "#34d399",
    danger: root.getPropertyValue("--color-danger").trim() || "#f87171",
    surface: root.getPropertyValue("--color-surface-raised").trim() || "#243044",
  };
}

function buildChartOptions(colors, yConfig) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: {
      intersect: false,
      mode: "index",
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        titleColor: colors.textMuted,
        bodyColor: "#e8edf4",
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: colors.border, drawBorder: false },
        ticks: {
          color: colors.textMuted,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
        },
      },
      y: yConfig,
    },
  };
}

function initMoistureChart(canvas) {
  const colors = getThemeColors();

  moistureChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Soil Moisture (%)",
          data: [],
          borderColor: colors.primary,
          backgroundColor: "rgba(59, 158, 255, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: colors.primary,
          borderWidth: 2,
        },
      ],
    },
    options: buildChartOptions(colors, {
      min: 0,
      max: 100,
      grid: { color: colors.border, drawBorder: false },
      ticks: {
        color: colors.textMuted,
        callback: function (value) {
          return value + "%";
        },
      },
    }),
  });
}

function initPumpChart(canvas) {
  const colors = getThemeColors();

  pumpChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Pump Activity",
          data: [],
          borderColor: colors.success,
          backgroundColor: "rgba(52, 211, 153, 0.15)",
          fill: true,
          stepped: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          segment: {
            borderColor: function (context) {
              const value = context.p1.parsed.y;
              return value === 1 ? colors.success : colors.danger;
            },
            backgroundColor: function (context) {
              const value = context.p1.parsed.y;
              return value === 1
                ? "rgba(52, 211, 153, 0.15)"
                : "rgba(248, 113, 113, 0.1)";
            },
          },
        },
      ],
    },
    options: buildChartOptions(colors, {
      min: 0,
      max: 1,
      grid: { color: colors.border, drawBorder: false },
      ticks: {
        color: colors.textMuted,
        stepSize: 1,
        callback: function (value) {
          if (value === 1) return "ON";
          if (value === 0) return "OFF";
          return "";
        },
      },
    }),
  });
}

function syncMoistureChart() {
  if (!moistureChart) {
    return;
  }

  moistureChart.data.labels = moisturePoints.map(function (point) {
    return formatTime(point.time);
  });
  moistureChart.data.datasets[0].data = moisturePoints.map(function (point) {
    return point.soilMoisture;
  });
  moistureChart.update("none");
}

function syncPumpChart() {
  if (!pumpChart) {
    return;
  }

  const colors = getThemeColors();

  pumpChart.data.labels = pumpPoints.map(function (point) {
    return formatTime(point.time);
  });
  pumpChart.data.datasets[0].data = pumpPoints.map(function (point) {
    return point.pumpStatus === "ON" ? 1 : 0;
  });
  pumpChart.data.datasets[0].pointBackgroundColor = pumpPoints.map(function (point) {
    return point.pumpStatus === "ON" ? colors.success : colors.danger;
  });
  pumpChart.update("none");
}

function updateLastPumpActivity(status, time) {
  const statusEl = document.getElementById("lastPumpStatus");
  const timeEl = document.getElementById("lastPumpTime");

  if (!statusEl || !timeEl) {
    return;
  }

  statusEl.textContent = status;
  statusEl.classList.remove("is-on", "is-off");

  if (status === "ON") {
    statusEl.classList.add("is-on");
  } else if (status === "OFF") {
    statusEl.classList.add("is-off");
  }

  timeEl.textContent = "Changed at " + formatTime(time);
}

export function initCharts() {
  const moistureCanvas = document.getElementById("moistureChart");
  const pumpCanvas = document.getElementById("pumpChart");

  if (moistureCanvas) {
    initMoistureChart(moistureCanvas);
  }

  if (pumpCanvas) {
    initPumpChart(pumpCanvas);
  }
}

export function addMoisturePoint(time, soilMoisture) {
  moisturePoints.push({ time: time, soilMoisture: soilMoisture });
  trimPoints(moisturePoints);
  syncMoistureChart();
}

export function addPumpPoint(time, pumpStatus) {
  pumpPoints.push({ time: time, pumpStatus: pumpStatus });
  trimPoints(pumpPoints);
  syncPumpChart();
  updateLastPumpActivity(pumpStatus, time);
}

export function getMoistureHistory() {
  return moisturePoints.slice();
}

export function getPumpHistory() {
  return pumpPoints.slice();
}
