const chartCurrencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const SERIES_CONFIG = {
  combined: {
    key: "combinedRevenue",
    label: "Totaal",
    className: "combined",
  },
  ecwid: {
    key: "ecwidRevenue",
    label: "Ecwid",
    className: "ecwid",
  },
  moneybird: {
    key: "moneybirdRevenue",
    label: "Moneybird",
    className: "moneybird",
  },
};

function buildLinePoints(values, width, height, padding) {
  const maxValue = Math.max(...values, 0);
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const stepX = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  return values.map((value, index) => {
    const x = padding.left + index * stepX;
    const y =
      padding.top +
      usableHeight -
      (maxValue === 0 ? usableHeight / 2 : (value / maxValue) * usableHeight);
    return { x, y, value };
  });
}

function pointsToString(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function getVisibleLabelIndexes(seriesLength, mode) {
  if (mode === "compact") {
    return new Set(
      Array.from({ length: seriesLength }, (_, index) => index).filter(
        (_, index) => index % Math.max(1, Math.ceil(seriesLength / 6)) === 0 || index === seriesLength - 1
      )
    );
  }

  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(seriesLength / maxLabels));
  return new Set(
    Array.from({ length: seriesLength }, (_, index) => index).filter(
      (index) => index % step === 0 || index === seriesLength - 1
    )
  );
}

function createChartMarkup({ series, activeSeriesName, mode, width, height, padding, activePointIndex }) {
  const values = Object.fromEntries(
    Object.entries(SERIES_CONFIG).map(([name, config]) => [
      name,
      series.map((item) => Number(item[config.key] || 0)),
    ])
  );

  const activeConfig = SERIES_CONFIG[activeSeriesName];
  const activePoints = buildLinePoints(values[activeSeriesName], width, height, padding);
  const areaPoints = `${pointsToString(activePoints)} ${width - padding.right},${height - padding.bottom} ${padding.left},${height - padding.bottom}`;
  const visibleLabelIndexes = getVisibleLabelIndexes(series.length, mode);

  const monthLabels = series
    .map((item, index) => {
      if (!visibleLabelIndexes.has(index)) {
        return "";
      }

      const point = activePoints[index];
      const label = mode === "compact" ? item.label.slice(0, 3) : item.label.replace(" ", "\n");
      return `
        <div class="chart-axis-label" style="left:${((point.x / width) * 100).toFixed(2)}%">
          ${label}
        </div>
      `;
    })
    .join("");

  const pointButtons = series
    .map((item, index) => {
      const point = activePoints[index];
      const isActive = activePointIndex === index;
      return `
        <button
          type="button"
          class="chart-point-button${isActive ? " chart-point-button-active" : ""}"
          data-chart-point-index="${index}"
          aria-pressed="${isActive ? "true" : "false"}"
          aria-label="${item.label}: ${chartCurrencyFormatter.format(item[activeConfig.key] || 0)}"
          style="left:${((point.x / width) * 100).toFixed(2)}%; top:${((point.y / height) * 100).toFixed(2)}%"
        >
          <span class="chart-point-dot chart-point-dot-${activeConfig.className}"></span>
        </button>
      `;
    })
    .join("");

  const activeTooltip =
    activePointIndex === null
      ? ""
      : (() => {
          const item = series[activePointIndex];
          const point = activePoints[activePointIndex];
          const tooltipClass = point.y < height * 0.24 ? " chart-tooltip-card-below" : "";
          return `
            <div
              class="chart-tooltip-card chart-tooltip-card-active${tooltipClass}"
              style="left:${((point.x / width) * 100).toFixed(2)}%; top:${((point.y / height) * 100).toFixed(2)}%"
            >
              <strong>${item.label}</strong>
              <span>${SERIES_CONFIG.combined.label}: ${chartCurrencyFormatter.format(item.combinedRevenue || 0)}</span>
              <span>${SERIES_CONFIG.ecwid.label}: ${chartCurrencyFormatter.format(item.ecwidRevenue || 0)}</span>
              <span>${SERIES_CONFIG.moneybird.label}: ${chartCurrencyFormatter.format(item.moneybirdRevenue || 0)}</span>
            </div>
          `;
        })();

  const legend =
    mode === "compact"
      ? ""
      : `
        <div class="chart-legend">
          ${Object.entries(SERIES_CONFIG)
            .map(
              ([name, config]) => `
                <button type="button" class="chart-filter-button${name === activeSeriesName ? " chart-filter-button-active" : ""}" data-series-filter="${name}">
                  <i class="chart-dot chart-dot-${config.className}"></i>${config.label}
                </button>
              `
            )
            .join("")}
        </div>
      `;

  return `
    ${legend}
    <div class="chart-frame chart-frame-${mode}">
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Omzet per maand">
        <defs>
          <linearGradient id="chartGradient-${activeSeriesName}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(17,17,17,0.18)"></stop>
            <stop offset="100%" stop-color="rgba(17,17,17,0.02)"></stop>
          </linearGradient>
        </defs>
        <polyline class="chart-area-line" style="fill:url(#chartGradient-${activeSeriesName})" points="${areaPoints}" />
        <polyline class="chart-line chart-line-${activeConfig.className}" points="${pointsToString(activePoints)}" />
      </svg>
      <div class="chart-points">${pointButtons}</div>
      <div class="chart-axis">${monthLabels}</div>
      <div class="chart-tooltips">${activeTooltip}</div>
    </div>
  `;
}

function createDataListMarkup(series, activeSeriesName) {
  const config = SERIES_CONFIG[activeSeriesName];

  return `
    <div class="chart-data-list-head">
      <span>Maand</span>
      <span>${config.label}</span>
    </div>
    <div class="chart-data-list-body">
      ${series
        .map(
          (item) => `
            <div class="chart-data-row">
              <span>${item.label}</span>
              <strong>${chartCurrencyFormatter.format(item[config.key] || 0)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderRevenueChart(container) {
  const rawSeries = container.dataset.chartSeries;
  if (!rawSeries) {
    return;
  }

  const series = JSON.parse(rawSeries);
  if (!Array.isArray(series) || !series.length) {
    container.innerHTML = '<div class="empty-state">Nog geen omzetdata beschikbaar.</div>';
    return;
  }

  const mode = container.dataset.chartMode || "full";
  const height = Number(container.dataset.chartHeight || 320);
  const width = 960;
  const padding =
    mode === "compact"
      ? { top: 18, right: 12, bottom: 32, left: 12 }
      : { top: 26, right: 18, bottom: 62, left: 18 };

  const state = {
    activeSeriesName: "combined",
    activePointIndex: null,
  };

  function draw() {
    container.innerHTML = `
      ${createChartMarkup({
        series,
        activeSeriesName: state.activeSeriesName,
        mode,
        width,
        height,
        padding,
        activePointIndex: state.activePointIndex,
      })}
      ${
        mode === "full"
          ? `<div class="chart-data-list">${createDataListMarkup(series, state.activeSeriesName)}</div>`
          : ""
      }
    `;

    container.querySelectorAll("[data-series-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeSeriesName = button.dataset.seriesFilter || "combined";
        state.activePointIndex = null;
        draw();
      });
    });

    container.querySelectorAll("[data-chart-point-index]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const pointIndex = Number(button.dataset.chartPointIndex);
        state.activePointIndex = state.activePointIndex === pointIndex ? null : pointIndex;
        draw();
      });
    });
  }

  draw();
}

window.renderRevenueChart = renderRevenueChart;

document.querySelectorAll(".revenue-chart").forEach((container) => {
  renderRevenueChart(container);
});
