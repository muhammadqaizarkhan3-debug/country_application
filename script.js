/* =========================================================
   Global City Dashboard
   Combines:
   1) Open-Meteo API      -> live weather (temp, humidity, wind)
   2) REST Countries API  -> population, flag, languages, capital, currency, map
   Concepts used: async/await, Promise.all, loading spinner,
   try/catch error handling, dynamic HTML building.
   ========================================================= */

// ---------------------------------------------------------------
// IMPORTANT NOTE ON THE COUNTRY API
// ---------------------------------------------------------------
// REST Countries is no longer a free, open endpoint. As of their
// v5 relaunch, EVERY request needs a Bearer API key, and browser
// (fetch-from-a-webpage) calls are blocked by default unless your
// site's origin is explicitly allow-listed on that key.
//
// This app ships with their public DEMO key ("rc_live_demo"), which:
//   - works with no signup and is allowed to be called from a browser
//   - does NOT burn real quota
//   - only returns a fixed, correctly-shaped SAMPLE payload
//     (it will not necessarily reflect the real country you asked for)
//
// To get REAL, live data for every city:
//   1. Sign up for a free key at https://restcountries.com/sign-up
//   2. Go to https://restcountries.com/api-keys and add your page's
//      origin (e.g. http://127.0.0.1:5500 for Live Server, or your
//      real domain once deployed) to that key's allowed origins
//   3. Paste the key into COUNTRY_API_KEY below
// ---------------------------------------------------------------

const WEATHER_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const COUNTRY_BASE_URL = "https://api.restcountries.com/countries/v5";
const COUNTRY_API_KEY = "rc_live_3ae1c3f4ce39494380f395ee3a0d34da"; // <-- replace with your real key

// Starter set of cities shown when the dashboard first loads.
let cities = [
  { name: "Berlin", alpha2: "DE", lat: 52.52, lon: 13.41 },
  { name: "Ottawa", alpha2: "CA", lat: 45.42, lon: -75.7 },
  { name: "Tokyo", alpha2: "JP", lat: 35.68, lon: 139.69 },
  { name: "Paris", alpha2: "FR", lat: 48.85, lon: 2.35 },
];

// Required quick-select cities: one button each, click to fetch & show.
const QUICK_CITIES = [
  { name: "Faisalabad", alpha2: "PK", lat: 31.418, lon: 73.0791 },
  { name: "Lahore", alpha2: "PK", lat: 31.5497, lon: 74.3436 },
  { name: "Karachi", alpha2: "PK", lat: 24.8607, lon: 67.0011 },
  { name: "Islamabad", alpha2: "PK", lat: 33.6844, lon: 73.0479 },
  { name: "Peshawar", alpha2: "PK", lat: 34.0151, lon: 71.5249 },
  { name: "Quetta", alpha2: "PK", lat: 30.1798, lon: 66.975 },
];

// WMO weather codes (used by Open-Meteo's "weathercode") mapped to
// a human-readable condition string.
const WEATHER_CODE_MAP = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function describeWeatherCode(code) {
  return WEATHER_CODE_MAP[code] || "Unknown";
}

const dashboard = document.getElementById("dashboard");
const spinner = document.getElementById("spinner");
const spinnerText = document.getElementById("spinnerText");
const addCityForm = document.getElementById("addCityForm");
const quickCityButtons = document.getElementById("quickCityButtons");

/* ---------- Spinner helpers ---------- */

function showSpinner(text) {
  spinnerText.textContent = text || "Loading city data...";
  spinner.classList.remove("hidden");
}

function hideSpinner() {
  spinner.classList.add("hidden");
}

/* ---------- API #1: Weather (Open-Meteo) ---------- */

async function fetchWeather(lat, lon) {
  const url = `${WEATHER_BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weathercode&hourly=relative_humidity_2m`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API failed (status ${response.status})`);
  }

  const data = await response.json();

  let currentHumidity = null;
  if (data.hourly && data.hourly.time && data.current && data.current.time) {
    const idx = data.hourly.time.indexOf(data.current.time);
    if (idx !== -1) {
      currentHumidity = data.hourly.relative_humidity_2m[idx];
    }
  }

  return {
    temperature: data.current?.temperature_2m,
    windSpeed: data.current?.wind_speed_10m,
    humidity: currentHumidity,
    weatherCode: data.current?.weathercode,
    condition: describeWeatherCode(data.current?.weathercode),
  };
}

/* ---------- API #2: Country info (REST Countries v5) ---------- */

async function fetchCountry(alpha2) {
  const url = `${COUNTRY_BASE_URL}/codes.alpha_2/${alpha2}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${COUNTRY_API_KEY}`,
    },
  });

  if (response.status === 401) {
    throw new Error("Invalid or missing REST Countries API key.");
  }

  if (response.status === 403) {
    throw new Error(
      `Blocked by REST Countries (403). This almost always means your API key isn't allowed to be called from this page's origin ("${window.location.hostname}"). ` +
      `Fix: sign up at restcountries.com, open the API Keys page, and add "${window.location.hostname}" to that key's allowed origins — then paste the real key into COUNTRY_API_KEY in script.js. ` +
      `(The demo key only works from restcountries.com's own docs page, not from your site.)`
    );
  }

  if (!response.ok) {
    // Try to surface the API's own error message if it sent one
    let message = `Country API failed (status ${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.errors?.[0]?.message) {
        message = errBody.errors[0].message;
      }
    } catch (_) {
      /* response wasn't JSON, keep default message */
    }
    throw new Error(message);
  }

  const payload = await response.json();
  const country = payload?.data?.objects?.[0];

  if (!country) {
    throw new Error(`No country data returned for "${alpha2}".`);
  }

  // Capitals now come back as an array of { name, coordinates, attributes }
  const capitalNames = Array.isArray(country.capitals)
    ? country.capitals.map((c) => c.name).filter(Boolean).join(", ")
    : "N/A";

  // Languages: array of language objects; be defensive about the exact shape
  let languages = "N/A";
  if (Array.isArray(country.languages) && country.languages.length) {
    languages = country.languages
      .map((l) => l.name || l.english_name || l.common || Object.values(l)[0])
      .filter(Boolean)
      .join(", ");
  }

  // Currencies: object keyed by currency code
  let currencies = "N/A";
  if (country.currencies && typeof country.currencies === "object") {
    currencies = Object.entries(country.currencies)
      .map(([code, c]) => `${c?.name || code} (${c?.symbol || code})`)
      .join(", ");
  }

  return {
    officialName: country.names?.official ?? country.names?.common,
    commonName: country.names?.common,
    flagUrl: country.flag?.url_png || country.flag?.url_svg,
    flagEmoji: country.flag?.emoji,
    flagAlt: country.flag?.description || `Flag of ${country.names?.common ?? alpha2}`,
    population: country.population,
    region: country.region,
    subregion: country.subregion,
    capital: capitalNames,
    languages,
    currencies,
    mapUrl: country.links?.google_maps,
    isDemoData: Boolean(payload?.data?._demo || payload?._demo),
  };
}

/* ---------- Combine both APIs for one city ---------- */

async function fetchCityData(city) {
  try {
    // Fetch weather + country data IN PARALLEL, not one after another.
    const [weather, country] = await Promise.all([
      fetchWeather(city.lat, city.lon),
      fetchCountry(city.alpha2),
    ]);

    return {
      ok: true,
      city,
      weather,
      country,
    };
  } catch (error) {
    return {
      ok: false,
      city,
      errorMessage: error.message || "Unknown error while fetching data.",
    };
  }
}

/* ---------- Rendering ---------- */

function buildCardHTML(result, index) {
  if (!result.ok) {
    return `
      <article class="city-card error-card">
        <button class="remove-btn" data-index="${index}" title="Remove">✕</button>
        <div class="card-top">
          <div class="card-title">
            <h3>${result.city.name}</h3>
            <span>${result.city.alpha2}</span>
          </div>
        </div>
        <p class="error-message">⚠️ Couldn't load this city: ${result.errorMessage}</p>
        <p class="hint">If this says CORS or 401: add your page's origin to your REST Countries API key's allowed origins, or check the key itself.</p>
      </article>
    `;
  }

  const { city, weather, country } = result;
  const flagMarkup = country.flagUrl
    ? `<img class="flag-img" src="${country.flagUrl}" alt="${country.flagAlt}" />`
    : country.flagEmoji
    ? `<span style="font-size:2rem;">${country.flagEmoji}</span>`
    : "";

  return `
    <article class="city-card">
      <button class="remove-btn" data-index="${index}" title="Remove">✕</button>
      <div class="card-top">
        ${flagMarkup}
        <div class="card-title">
          <h3>${city.name}</h3>
          <span>${country.commonName || city.alpha2}</span>
        </div>
      </div>

      ${country.isDemoData ? `<p class="hint">⚠️ Showing REST Countries DEMO sample data (not necessarily this country) — add a real API key in script.js for live data.</p>` : ""}

      <div class="section-label">Current Weather</div>
      <p class="condition-text">${weather.condition || "N/A"}</p>
      <div class="weather-row">
        <div class="weather-stat">
          <div class="value">${formatValue(weather.temperature, "°C")}</div>
          <div class="label">Temperature</div>
        </div>
        <div class="weather-stat">
          <div class="value">${formatValue(weather.humidity, "%")}</div>
          <div class="label">Humidity</div>
        </div>
        <div class="weather-stat">
          <div class="value">${formatValue(weather.windSpeed, " km/h")}</div>
          <div class="label">Wind Speed</div>
        </div>
      </div>

      <div class="section-label">Country Info</div>
      <ul class="info-list">
        <li><span class="k">Capital</span><span>${country.capital || "N/A"}</span></li>
        <li><span class="k">Region</span><span>${country.region || "N/A"}${country.subregion ? " / " + country.subregion : ""}</span></li>
        <li><span class="k">Population</span><span>${formatNumber(country.population)}</span></li>
        <li><span class="k">Languages</span><span>${country.languages}</span></li>
        <li><span class="k">Currency</span><span>${country.currencies}</span></li>
      </ul>

      ${country.mapUrl ? `<a class="map-link" href="${country.mapUrl}" target="_blank" rel="noopener">📍 View on Google Maps</a>` : ""}
    </article>
  `;
}

function formatValue(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${value}${unit}`;
}

function formatNumber(num) {
  if (num === null || num === undefined) return "N/A";
  return num.toLocaleString();
}

/* ---------- Main load routine ---------- */

let latestResults = [];

async function loadAllCities() {
  showSpinner(`Fetching weather & country data for ${cities.length} cities...`);

  try {
    const results = await Promise.all(cities.map((city) => fetchCityData(city)));
    latestResults = results;
    renderDashboard(results);
  } catch (error) {
    dashboard.innerHTML = `<p class="error-message">Something went wrong loading the dashboard: ${error.message}</p>`;
  } finally {
    hideSpinner();
  }
}

function renderDashboard(results) {
  dashboard.innerHTML = results.map((result, i) => buildCardHTML(result, i)).join("");

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.currentTarget.dataset.index);
      cities.splice(idx, 1);
      latestResults.splice(idx, 1);
      renderDashboard(latestResults);
    });
  });
}

/* ---------- Add-city form ---------- */

addCityForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("cityName").value.trim();
  const lat = parseFloat(document.getElementById("cityLat").value);
  const lon = parseFloat(document.getElementById("cityLon").value);
  const alpha2 = document.getElementById("cityAlpha2").value.trim().toUpperCase();

  if (!name || Number.isNaN(lat) || Number.isNaN(lon) || alpha2.length !== 2) {
    alert("Please fill in a valid city name, latitude, longitude, and 2-letter country code.");
    return;
  }

  const newCity = { name, lat, lon, alpha2 };
  cities.push(newCity);

  showSpinner(`Fetching data for ${name}...`);
  try {
    const result = await fetchCityData(newCity);
    latestResults.push(result);
    renderDashboard(latestResults);
  } finally {
    hideSpinner();
    addCityForm.reset();
  }
});

/* ---------- Quick-select city buttons ---------- */

function renderQuickCityButtons() {
  quickCityButtons.innerHTML = QUICK_CITIES.map(
    (c) => `<button type="button" class="quick-city-btn" data-name="${c.name}">${c.name}</button>`
  ).join("");

  quickCityButtons.querySelectorAll(".quick-city-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const chosen = QUICK_CITIES.find((c) => c.name === btn.dataset.name);
      if (!chosen) return;

      // Mark this button active while its data loads
      quickCityButtons.querySelectorAll(".quick-city-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      showSpinner(`Fetching data for ${chosen.name}...`);
      try {
        const result = await fetchCityData(chosen);

        // Replace an existing card for this city if present, else add it
        const existingIdx = latestResults.findIndex(
          (r) => r.city.name === chosen.name && r.city.alpha2 === chosen.alpha2
        );
        if (existingIdx !== -1) {
          latestResults[existingIdx] = result;
        } else {
          cities.push(chosen);
          latestResults.push(result);
        }
        renderDashboard(latestResults);
      } catch (error) {
        // fetchCityData already catches internally, but guard just in case
        console.error(error);
      } finally {
        hideSpinner();
      }
    });
  });
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  renderQuickCityButtons();
  loadAllCities();
});