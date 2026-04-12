const weatherCard = document.querySelector("#weatherCard");

function renderWeatherIcon(iconName) {
  const icons = {
    Sun: "○",
    CloudSun: "◔",
    Cloud: "◑",
    CloudFog: "◒",
    CloudDrizzle: "◓",
    CloudRain: "●",
    CloudSnow: "◍",
    Snowflake: "✳",
    CloudLightning: "※",
  };
  return icons[iconName] || "◌";
}

async function loadDashboardWeather() {
  if (!weatherCard) {
    return;
  }

  const params = new URLSearchParams({
    lat: weatherCard.dataset.weatherLat || "",
    lon: weatherCard.dataset.weatherLon || "",
    name: weatherCard.dataset.weatherName || "",
  });

  const temperatureNode = document.querySelector("#weatherTemperature");
  const conditionNode = document.querySelector("#weatherCondition");
  const locationNode = document.querySelector("#weatherLocation");
  const metaNode = document.querySelector("#weatherMeta");
  const warningNode = document.querySelector("#weatherWarning");
  const iconNode = document.querySelector("#weatherIcon .weather-icon-glyph");

  try {
    const response = await fetch(`/api/dashboard-weather?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.details || payload.error || "Onbekende fout");
    }

    if (temperatureNode) {
      temperatureNode.textContent = `${payload.temperature}°C`;
    }
    if (conditionNode) {
      conditionNode.textContent = payload.condition || "Onbekend";
    }
    if (locationNode) {
      locationNode.textContent = payload.location || "Onbekende locatie";
    }
    if (metaNode) {
      metaNode.textContent = `Wind: ${payload.windspeed} km/u`;
    }
    if (warningNode) {
      warningNode.hidden = !payload.isWarning;
    }
    if (iconNode) {
      iconNode.textContent = renderWeatherIcon(payload.icon);
    }
  } catch (error) {
    if (conditionNode) {
      conditionNode.textContent = "Kon weergegevens niet ophalen.";
    }
    if (metaNode) {
      metaNode.textContent = "Controleer de verbinding en probeer het later opnieuw.";
    }
  }
}

loadDashboardWeather();
