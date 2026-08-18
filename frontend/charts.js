/**
 * Smart Irrigation — Real-time chart management
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

function syncLineChart(chart, points, valueKey) {
  if (!chart) {
    return;
  }

  chart.data.labels = points.map(function (point) {
    return formatTime(point.time);
  });
  chart.data.datasets[0].data = points.map(function (point) {
    return point[valueKey];
  });
  chart.update("none");
}

function syncSteppedChart(chart, points, toBinary, pointColorFn) {
  if (!chart) {
    return;
  }

  chart.data.labels = points.map(function (point) {
    return formatTime(point.time);
  });
  chart.data.datasets[0].data = points.map(toBinary);

  if (pointColorFn) {
    chart.data.datasets[0].pointBackgroundColor = points.map(pointColorFn);
  }

  chart.update("none");
}

function renderPumpActivityList() {
  const list = document.getElementById("pumpActivityList");
  const empty = document.getElementById("pumpActivityEmpty");

  if (!list) {
    return;
  }

  list.querySelectorAll(".activity-item").forEach(function (item) {
    item.remove();
  });

  if (pumpPoints.length === 0) {
    if (empty) {
      empty.hidden = false;
    }
    return;
  }

  if (empty) {
    empty.hidden = true;
  }

  const recent = pumpPoints.slice().reverse();

  recent.forEach(function (point) {
    const li = document.createElement("li");
    li.className = "activity-item";

    const time = document.createElement("span");
    time.className = "activity-item__time";
    time.textContent = formatTime(point.time);

    const status = document.createElement("span");
    status.className =
      "activity-item__status " +
      (point.pumpStatus === "ON" ? "is-on" : "is-off");
    status.textContent = point.pumpStatus;

    li.appendChild(time);
    li.appendChild(status);
    list.appendChild(li);
  });
}

export function initCharts() {
  const colors = getThemeColors();
  const moistureCanvas = document.getElementById("moistureChart");
  const pumpCanvas = document.getElementById("pumpChart");

  if (moistureCanvas) {
    moistureChart = new Chart(moistureCanvas, {
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

  if (pumpCanvas) {
    pumpChart = new Chart(pumpCanvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Pump Activity",
            data: [],
            borderColor: colors.success,
            backgroundColor: "rgba(52, 211, 153, 0.12)",
            fill: true,
            stepped: true,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
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
}

export function addMoisturePoint(time, moisture) {
  moisturePoints.push({ time: time, moisture: moisture });
  trimPoints(moisturePoints);
  syncLineChart(moistureChart, moisturePoints, "moisture");
}

export function addPumpPoint(time, pumpStatus) {
  const colors = getThemeColors();

  pumpPoints.push({ time: time, pumpStatus: pumpStatus });
  trimPoints(pumpPoints);

  syncSteppedChart(
    pumpChart,
    pumpPoints,
    function (point) {
      return point.pumpStatus === "ON" ? 1 : 0;
    },
    function (point) {
      return point.pumpStatus === "ON" ? colors.success : colors.danger;
    }
  );

  renderPumpActivityList();
}
