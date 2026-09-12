import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
	Activity,
	Bell,
	CarFront,
	ChevronRight,
	CloudRain,
	CloudSun,
	Droplets,
	Home as HomeIcon,
	Map,
	MapPin,
	Menu,
	Navigation,
	Pencil,
	Plus,
	Route,
	RefreshCw,
	Settings2,
	Sun,
	Trash2,
	Umbrella,
	UserRound,
	Wind,
	X,
} from "lucide-react";
import "./App.css";

const WEATHER_LOCATIONS = {
	Bengaluru: { latitude: 12.9716, longitude: 77.5946 },
	Home: { latitude: 12.9784, longitude: 77.6408 },
	Office: { latitude: 12.9352, longitude: 77.6245 },
};

const ACTIVITY_OPTIONS = [
	"Running",
	"Gardening",
	"Commuting",
	"Shopping",
	"Outdoor event",
	"Exercise",
	"Cycling",
	"Sports",
	"School pickup",
	"Surfing",
	"Walking",
	"Photography",
	"Picnic",
	"Yoga",
	"Travel",
];

const ACTIVITY_CATEGORIES = {
	All: ACTIVITY_OPTIONS,
	Move: ["Running", "Exercise", "Cycling", "Sports", "Walking", "Yoga"],
	Outdoors: [
		"Gardening",
		"Outdoor event",
		"Surfing",
		"Photography",
		"Picnic",
	],
	Everyday: ["Commuting", "Shopping", "School pickup", "Travel"],
};

function weatherIconForCode(code) {
	if (code === 0 || code === 1) return Sun;
	if (code === 2) return CloudSun;
	return CloudRain;
}

function weatherLabelForCode(code) {
	if (code === 0) return "Clear sky";
	if (code === 1) return "Mainly clear";
	if (code === 2) return "Partly cloudy";
	if (code === 3) return "Overcast";
	if (code >= 51 && code <= 67) return "Rain showers";
	if (code >= 80 && code <= 82) return "Rain showers";
	if (code >= 95) return "Thunderstorm";
	return "Cloudy";
}

function getInitials(name) {
	return (
		name
			.trim()
			.split(/\s+/)
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase() || "AK"
	);
}

function formatHour(time) {
	const [hour, minute] = time.split("T")[1].split(":");
	const hourNumber = Number(hour);
	const suffix = hourNumber >= 12 ? "PM" : "AM";
	const displayHour = hourNumber % 12 || 12;
	return `${displayHour}:${minute} ${suffix}`;
}

function formatWindow(time) {
	const [hour, minute] = time.split("T")[1].split(":");
	const start = Number(hour);
	const end = (start + 1) % 24;
	const formatPart = (value) =>
		`${value % 12 || 12}:${minute} ${value >= 12 ? "PM" : "AM"}`;
	return `${formatPart(start)} – ${formatPart(end)}`;
}

function getBestActivityWindow(activity, hourlyForecast) {
	if (!hourlyForecast.length) return null;
	const idealTemperature = {
		Running: [14, 27],
		Gardening: [18, 30],
		Commuting: [15, 33],
		Shopping: [18, 32],
		"Outdoor event": [18, 29],
		Exercise: [14, 28],
		Cycling: [14, 27],
		Sports: [16, 29],
		"School pickup": [18, 30],
		Surfing: [20, 28],
	}[activity] || [16, 29];
	const activeHours = {
		Running: [5, 22],
		Gardening: [6, 19],
		Commuting: [6, 21],
		Shopping: [9, 20],
		"Outdoor event": [8, 22],
		Exercise: [5, 22],
		Cycling: [5, 20],
		Sports: [6, 22],
		"School pickup": [7, 17],
		Surfing: [6, 18],
	}[activity] || [6, 22];
	const scored = hourlyForecast.map((hour) => {
		const midpoint = (idealTemperature[0] + idealTemperature[1]) / 2;
		let score = 100 - Math.abs(hour.temperature - midpoint) * 5;
		if (
			hour.temperature < idealTemperature[0] ||
			hour.temperature > idealTemperature[1]
		)
			score -= 18;
		score -= hour.precipitationProbability * 0.8;
		if (activity === "School pickup") {
			score -= hour.precipitationProbability * 0.6;
			if (hour.precipitationProbability >= 45) score -= 18;
			if (hour.wind > 20) score -= (hour.wind - 20) * 1.5;
		}
		if (activity === "Surfing") {
			score -= hour.precipitationProbability * 1.1;
			if (hour.wind > 18) score -= (hour.wind - 18) * 2.5;
			if (hour.wind >= 7 && hour.wind <= 18) score += 12;
			if (hour.code >= 51 && hour.code <= 67) score -= 30;
		}
		if (hour.code >= 51) score -= 20;
		if (hour.code >= 80 || hour.code >= 95) score -= 25;
		if (hour.wind > 22) score -= (hour.wind - 22) * 2;
		const hourOfDay = Number(hour.time.split("T")[1].split(":")[0]);
		if (hourOfDay < activeHours[0] || hourOfDay > activeHours[1])
			score -= 45;
		return { hour, score };
	});
	return scored.sort((left, right) => right.score - left.score)[0].hour;
}

function getActivitySuitability(activity, weather) {
	const hour = weather?.hourly?.[0];
	if (!hour) return null;
	const idealTemperature = {
		Running: [14, 27],
		Gardening: [18, 30],
		Commuting: [15, 33],
		Shopping: [18, 32],
		"Outdoor event": [18, 29],
		Exercise: [14, 28],
		Cycling: [14, 27],
		Sports: [16, 29],
		"School pickup": [18, 30],
		Surfing: [20, 28],
	}[activity] || [16, 29];
	const [minimumTemperature, maximumTemperature] = idealTemperature;
	const temperatureScore =
		hour.temperature >= minimumTemperature &&
		hour.temperature <= maximumTemperature
			? 40
			: Math.max(
					0,
					40 -
						Math.min(
							Math.abs(hour.temperature - minimumTemperature),
							Math.abs(hour.temperature - maximumTemperature),
						) *
							4,
				);
	const rainScore = Math.max(0, 30 - hour.precipitationProbability * 0.3);
	const windScore = Math.max(0, 20 - Math.max(0, hour.wind - 12));
	const conditionScore =
		hour.code >= 95 ? 0 : hour.code >= 51 ? 4 : hour.code >= 3 ? 7 : 10;
	const score = Math.round(
		Math.min(100, temperatureScore + rainScore + windScore + conditionScore),
	);
	const explanation =
		score >= 75
			? "Good temperature, low rain chance."
			: score >= 50
				? "Manageable conditions; check rain and wind."
				: "Weather may make this activity uncomfortable.";
	return { score, explanation };
}

function getFarmGardenAdvisories(weather) {
	const forecast = (weather?.hourly || []).filter(
		(hour) =>
			Number.isFinite(hour.temperature) ||
			Number.isFinite(hour.precipitationProbability) ||
			Number.isFinite(hour.wind),
	);
	if (!forecast.length) {
		return [
			{
				type: "neutral",
				message: "🌱 Forecast unavailable — check again shortly.",
			},
		];
	}

	const maxTemperature = Math.max(
		...forecast
			.map((hour) => Number(hour.temperature))
			.filter(Number.isFinite),
	);
	const maxRainProbability = Math.max(
		...forecast
			.map((hour) => Number(hour.precipitationProbability))
			.filter(Number.isFinite),
		0,
	);
	const maxWind = Math.max(
		...forecast.map((hour) => Number(hour.wind)).filter(Number.isFinite),
		0,
	);
	const rainHours = forecast.filter(
		(hour) =>
			Number(hour.precipitationProbability) >= 45 ||
			(Number(hour.code) >= 51 && Number(hour.code) <= 99),
	);
	const heavyRainExpected =
		maxRainProbability >= 70 ||
		forecast.some((hour) => Number(hour.code) >= 80);
	const advisories = [];

	if (heavyRainExpected) {
		advisories.push({
			type: "rain",
			message:
				"🌧️ Heavy rain expected — check drainage and avoid overwatering.",
			detail: `${maxRainProbability}% peak rain chance`,
		});
	} else if (rainHours.length > 0) {
		advisories.push({
			type: "rain",
			message: "🌧️ Rain expected — avoid unnecessary watering.",
			detail: `${maxRainProbability}% peak rain chance`,
		});
	} else if (maxRainProbability < 25) {
		advisories.push({
			type: "dry",
			message:
				"💧 Dry conditions expected — consider watering your plants.",
			detail: "Low rain chance in the forecast",
		});
	}

	if (maxWind >= 30) {
		advisories.push({
			type: "wind",
			message:
				"💨 Strong winds expected — avoid spraying and secure delicate plants.",
			detail: `${Math.round(maxWind)} km/h peak wind`,
		});
	}
	if (maxTemperature >= 35) {
		advisories.push({
			type: "heat",
			message:
				"☀️ High temperatures expected — provide extra water and protect sensitive plants.",
			detail: `${Math.round(maxTemperature)}°C peak temperature`,
		});
	}
	if (!advisories.length) {
		advisories.push({
			type: "neutral",
			message: "🌱 Conditions look suitable for normal garden care.",
			detail: "No major weather risks detected",
		});
	}
	return advisories;
}

function FarmGardenAdvisory({ weather }) {
	const advisories = getFarmGardenAdvisories(weather);
	return (
		<section className="farm-advisory" aria-labelledby="farm-advisory-title">
			<div className="farm-advisory-header">
				<div className="farm-advisory-title">
					<span className="farm-advisory-icon" aria-hidden="true">
						🌱
					</span>
					<div>
						<span className="section-kicker">FARM &amp; GARDEN</span>
						<h2 id="farm-advisory-title">Advisory</h2>
					</div>
				</div>
				<span className="farm-advisory-range">NEXT 24 HOURS</span>
			</div>
			<div className="farm-advisory-list">
				{advisories.map((advisory, index) => (
					<div
						className={`farm-advisory-item ${advisory.type}`}
						key={`${advisory.type}-${index}`}
					>
						<strong>{advisory.message}</strong>
						{advisory.detail && <span>{advisory.detail}</span>}
					</div>
				))}
			</div>
		</section>
	);
}

function formatDate(time) {
	return new Intl.DateTimeFormat("en-IN", {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date(time));
}

function formatForecastDay(time) {
	return new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
		new Date(`${time}T12:00:00`),
	);
}

function weatherCodeFromWttr(code) {
	const numericCode = Number(code);
	if (numericCode === 113) return 0;
	if (numericCode === 116) return 2;
	if (numericCode === 119 || numericCode === 122) return 3;
	if (numericCode >= 176 && numericCode <= 293) return 61;
	if (numericCode >= 386) return 95;
	return 3;
}

function weatherFromWttr(data) {
	const current = data.current_condition?.[0];
	const days = data.weather || [];
	if (!current || !days.length) throw new Error("Fallback weather response was incomplete");
	const now = new Date();
	const currentTime = now.toISOString().slice(0, 13) + ":00";
	const hourly = days.flatMap((day) =>
		(day.hourly || []).map((hour) => ({
			time: `${day.date}T${String(Number(hour.time) / 100).padStart(2, "0")}:00`,
			temperature: Number(hour.tempC),
			precipitationProbability: Number(hour.chanceofrain) || 0,
			code: weatherCodeFromWttr(hour.weatherCode),
			wind: Number(hour.windspeedKmph) || 0,
		})),
	);
	const currentHourIndex = Math.max(
		0,
		hourly.findIndex((hour) => hour.time >= currentTime),
	);
	return {
		current: {
			time: currentTime,
			temperature_2m: Number(current.temp_C),
			relative_humidity_2m: Number(current.humidity),
			apparent_temperature: Number(current.FeelsLikeC),
			precipitation_probability: Number(current.precipMM) > 0 ? 100 : 0,
			weather_code: weatherCodeFromWttr(current.weatherCode),
			wind_speed_10m: Number(current.windspeedKmph),
		},
		date: formatDate(currentTime),
		hourly: hourly.slice(currentHourIndex, currentHourIndex + 24),
		daily: days.map((day) => ({
			date: day.date,
			code: weatherCodeFromWttr(day.hourly?.[4]?.weatherCode),
			max: Number(day.maxtempC),
			min: Number(day.mintempC),
			rain: Math.max(
				...(day.hourly || []).map((hour) => Number(hour.chanceofrain) || 0),
			),
		})),
	};
}

async function searchOpenRouteLocations(query, signal, count = 5) {
	const apiKey = import.meta.env.VITE_OPENROUTE_API_KEY;
	if (!apiKey) throw new Error("OpenRouteService key is missing");
	const searchText =
		/akshardham/i.test(query) && !/temple/i.test(query)
			? `${query} Temple`
			: query;
	const response = await fetch(
		`https://api.openrouteservice.org/geocode/search?api_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(searchText)}&boundary.country=IND&size=${count}`,
		{ signal },
	);
	if (!response.ok) throw new Error("OpenRouteService geocoding failed");
	const data = await response.json();
	return (data.features || []).map((feature) => {
		const [longitude, latitude] = feature.geometry.coordinates;
		const properties = feature.properties || {};
		return {
			id: feature.id,
			name: properties.name || properties.label,
			latitude,
			longitude,
			admin1: properties.region || properties.locality || "",
			country: properties.country || "India",
			label: properties.label || properties.name,
		};
	});
}

function OpenRouteMap({ route }) {
	const mapElement = useRef(null);
	const [routeState, setRouteState] = useState("loading");
	const apiKey = import.meta.env.VITE_OPENROUTE_API_KEY;
	const routeOrigin = route?.origin || "Indiranagar";
	const routeDestination = route?.destination || "Koramangala";
	const routeOriginCoordinates = route?.originCoordinates;
	const routeDestinationCoordinates = route?.destinationCoordinates;

	useEffect(() => {
		if (!mapElement.current) return undefined;
		let isActive = true;
		const controller = new AbortController();
		const map = L.map(mapElement.current, { zoomControl: false }).setView(
			[12.9568, 77.6326],
			13,
		);
		L.control.zoom({ position: "bottomright" }).addTo(map);
		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: "&copy; OpenStreetMap contributors",
		}).addTo(map);
		if (!apiKey) {
			queueMicrotask(() => {
				if (isActive) setRouteState("missing-key");
			});
			return () => {
				isActive = false;
				controller.abort();
				map.remove();
			};
		}

		const resolvePoint = async (query, coordinates) => {
			if (coordinates) return coordinates;
			return (
				await searchOpenRouteLocations(query, controller.signal, 1)
			)[0];
		};
		Promise.all([
			resolvePoint(routeOrigin, routeOriginCoordinates),
			resolvePoint(routeDestination, routeDestinationCoordinates),
		])
			.then(([originPoint, destinationPoint]) => {
				if (!originPoint || !destinationPoint)
					throw new Error("Location not found");
				const origin = L.circleMarker(
					[originPoint.latitude, originPoint.longitude],
					{
						radius: 8,
						color: "#24463a",
						fillColor: "#f5ccae",
						fillOpacity: 1,
						weight: 3,
					},
				).addTo(map);
				const destination = L.circleMarker(
					[destinationPoint.latitude, destinationPoint.longitude],
					{
						radius: 8,
						color: "#e16e54",
						fillColor: "#fff",
						fillOpacity: 1,
						weight: 3,
					},
				).addTo(map);
				origin.bindTooltip(routeOrigin);
				destination.bindTooltip(routeDestination);
				return fetch(
					"https://api.openrouteservice.org/v2/directions/driving-car/geojson",
					{
						method: "POST",
						signal: controller.signal,
						headers: {
							Authorization: apiKey,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							coordinates: [
								[originPoint.longitude, originPoint.latitude],
								[
									destinationPoint.longitude,
									destinationPoint.latitude,
								],
							],
						}),
					},
				);
			})
			.then((response) => {
				if (!response.ok) throw new Error("Route request failed");
				return response.json();
			})
			.then((route) => {
				if (!isActive) return;
				const routeLayer = L.geoJSON(route, {
					style: { color: "#d4644e", weight: 5, opacity: 0.9 },
				}).addTo(map);
				map.fitBounds(routeLayer.getBounds(), { padding: [24, 24] });
				setRouteState("ready");
			})
			.catch((error) => {
				if (isActive && error.name !== "AbortError") {
					setRouteState(
						error.message === "Location not found"
							? "location-error"
							: "error",
					);
				}
			});

		return () => {
			isActive = false;
			controller.abort();
			map.remove();
		};
	}, [
		apiKey,
		routeOrigin,
		routeDestination,
		routeOriginCoordinates,
		routeDestinationCoordinates,
		routeOriginCoordinates?.latitude,
		routeOriginCoordinates?.longitude,
		routeDestinationCoordinates?.latitude,
		routeDestinationCoordinates?.longitude,
	]);

	return (
		<div className="route-map-shell">
			<div className="route-map-canvas" ref={mapElement} />
			{routeState !== "ready" && (
				<div className="map-status">
					{routeState === "loading" && "Loading route…"}
					{routeState === "missing-key" &&
						"Add VITE_OPENROUTE_API_KEY to show the route."}
					{routeState === "error" &&
						"OpenRouteService could not load this route. Check the API key, quota, and allowed domains."}
					{routeState === "location-error" &&
						"Could not find one of the route locations. Try a more specific place name."}
				</div>
			)}
		</div>
	);
}

function TrafficUpdates({ route }) {
	const [state, setState] = useState("loading");
	const [traffic, setTraffic] = useState(null);
	const [lastUpdated, setLastUpdated] = useState(null);
	const [retryToken, setRetryToken] = useState(0);
	const apiKey = import.meta.env.VITE_TOMTOM_API_KEY;

	useEffect(() => {
		const controller = new AbortController();
		let refreshTimer;
		const loadTraffic = async () => {
			if (!apiKey) {
				setState("missing-key");
				return;
			}
			queueMicrotask(() => setState("loading"));
			try {
				const resolvePoint = async (query, coordinates) => {
					if (coordinates) return coordinates;
					return (
						await searchOpenRouteLocations(
							query,
							controller.signal,
							1,
						)
					)[0];
				};
				const [origin, destination] = await Promise.all([
					resolvePoint(route.origin, route.originCoordinates),
					resolvePoint(
						route.destination,
						route.destinationCoordinates,
					),
				]);
				if (!origin || !destination)
					throw new Error("Traffic locations not found");
				const midpoint = {
					latitude: (origin.latitude + destination.latitude) / 2,
					longitude: (origin.longitude + destination.longitude) / 2,
				};
				const response = await fetch(
					`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${midpoint.latitude},${midpoint.longitude}&unit=KMPH&openLr=false&key=${encodeURIComponent(apiKey)}`,
					{ signal: controller.signal },
				);
				if (!response.ok) throw new Error("Traffic request failed");
				const data = await response.json();
				const flow = data.flowSegmentData;
				if (
					typeof flow?.currentSpeed !== "number" ||
					typeof flow?.freeFlowSpeed !== "number"
				)
					throw new Error("Traffic response was incomplete");
				const delayPercent = Math.max(
					0,
					Math.round(
						(1 - flow.currentSpeed / flow.freeFlowSpeed) * 100,
					),
				);
				const status =
					delayPercent >= 35
						? "Heavy"
						: delayPercent >= 15
							? "Slowing"
							: "Moving well";
				setTraffic({
					status,
					delayPercent,
					currentSpeed: Math.round(flow.currentSpeed),
					freeFlowSpeed: Math.round(flow.freeFlowSpeed),
				});
				setLastUpdated(new Date());
				setState("ready");
				refreshTimer = setTimeout(loadTraffic, 5 * 60 * 1000);
			} catch (error) {
				if (error.name !== "AbortError") setState("error");
			}
		};
		loadTraffic();
		return () => {
			controller.abort();
			clearTimeout(refreshTimer);
		};
	}, [
		apiKey,
		retryToken,
		route?.origin,
		route?.destination,
		route?.originCoordinates,
		route?.destinationCoordinates,
		route?.originCoordinates?.latitude,
		route?.originCoordinates?.longitude,
		route?.destinationCoordinates?.latitude,
		route?.destinationCoordinates?.longitude,
	]);

	const statusClass =
		traffic?.status === "Heavy"
			? "traffic-heavy"
			: traffic?.status === "Slowing"
				? "traffic-slowing"
				: "traffic-clear";

	return (
		<section className={`traffic-updates ${statusClass}`}>
			<div className="traffic-icon">
				<CarFront size={19} />
			</div>
			<div className="traffic-copy">
				<span className="section-kicker">LIVE TRAFFIC · {route.name}</span>
				{state === "ready" && traffic && (
					<>
						<strong>{traffic.status}</strong>
						<p>
							{traffic.currentSpeed} km/h · {traffic.delayPercent}%
							slower than usual
						</p>
					</>
				)}
				{state === "loading" && <p>Checking traffic conditions…</p>}
				{state === "missing-key" && (
					<p>
						Add VITE_TOMTOM_API_KEY to show live traffic updates.
					</p>
				)}
				{state === "error" && (
					<p>Traffic is temporarily unavailable. Try again.</p>
				)}
				{lastUpdated && state === "ready" && (
					<small>
						Updated{" "}
						{lastUpdated.toLocaleTimeString([], {
							hour: "numeric",
							minute: "2-digit",
						})}
					</small>
				)}
			</div>
			{(state === "error" || state === "ready") && (
				<button
					className="traffic-refresh"
					type="button"
					onClick={() => setRetryToken((token) => token + 1)}
					aria-label="Refresh traffic updates"
				>
					<RefreshCw size={16} />
				</button>
			)}
		</section>
	);
}

function App() {
	const [activeTab, setActiveTab] = useState("home");
	const [profileName, setProfileName] = useState(
		() => localStorage.getItem("mausam-profile-name") || "Code In Club",
	);
	const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
	const [activity, setActivity] = useState(
		() => localStorage.getItem("mausam-activity") || "Running",
	);
	const [selectedActivities, setSelectedActivities] = useState(() => {
		const stored = localStorage.getItem("mausam-selected-activities");
		return stored ? JSON.parse(stored) : ACTIVITY_OPTIONS;
	});
	const [location, setLocation] = useState("Bengaluru");
	const [locationCoordinates, setLocationCoordinates] = useState(
		WEATHER_LOCATIONS.Bengaluru,
	);
	const [isActivityPickerOpen, setIsActivityPickerOpen] = useState(false);
	const [isHourlyExpanded, setIsHourlyExpanded] = useState(false);
	const [isForecastExpanded, setIsForecastExpanded] = useState(false);
	const [weather, setWeather] = useState(null);
	const [weatherState, setWeatherState] = useState("loading");
	const [weatherSource, setWeatherSource] = useState("Open-Meteo");
	useEffect(
		() => localStorage.setItem("mausam-activity", activity),
		[activity],
	);
	useEffect(
		() => localStorage.setItem("mausam-profile-name", profileName),
		[profileName],
	);
	useEffect(() => {
		localStorage.setItem(
			"mausam-selected-activities",
			JSON.stringify(selectedActivities),
		);
		if (!selectedActivities.includes(activity)) {
			queueMicrotask(() => setActivity(selectedActivities[0]));
		}
	}, [selectedActivities, activity]);
	useEffect(() => {
		const coordinates = locationCoordinates;
		const controller = new AbortController();
		queueMicrotask(() => {
			setWeatherState("loading");
			setWeatherSource("Open-Meteo");
		});
		fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=7`,
			{ signal: controller.signal },
		)
			.then((response) => {
				if (!response.ok) throw new Error("Weather request failed");
				return response.json();
			})
			.then((data) => {
				const currentHourIndex = Math.max(
					0,
					data.hourly.time.findIndex(
						(time) => time >= data.current.time,
					),
				);
				setWeather({
					current: {
						...data.current,
						precipitation_probability:
							data.hourly.precipitation_probability[
								currentHourIndex
							],
					},
					date: formatDate(data.current.time),
					hourly: data.hourly.time
						.slice(currentHourIndex, currentHourIndex + 24)
						.map((time, index) => ({
							time,
							temperature:
								data.hourly.temperature_2m[
									currentHourIndex + index
								],
							precipitationProbability:
								data.hourly.precipitation_probability[
									currentHourIndex + index
								],
							code: data.hourly.weather_code[
								currentHourIndex + index
							],
							wind: data.hourly.wind_speed_10m[
								currentHourIndex + index
							],
						})),
					daily: data.daily.time.map((time, index) => ({
						date: time,
						code: data.daily.weather_code[index],
						max: data.daily.temperature_2m_max[index],
						min: data.daily.temperature_2m_min[index],
						rain: data.daily.precipitation_probability_max[index],
					})),
				});
				setWeatherState("ready");
			})
			.catch(async (error) => {
				if (error.name === "AbortError") return;
				try {
					const fallbackResponse = await fetch(
						`https://wttr.in/${coordinates.latitude},${coordinates.longitude}?format=j1`,
						{ signal: controller.signal },
					);
					if (!fallbackResponse.ok)
						throw new Error("Fallback weather request failed");
					const fallbackWeather = weatherFromWttr(
						await fallbackResponse.json(),
					);
					setWeather(fallbackWeather);
					setWeatherSource("wttr.in fallback");
					setWeatherState("ready");
				} catch (fallbackError) {
					if (fallbackError.name !== "AbortError")
						setWeatherState("error");
				}
			});
		return () => controller.abort();
	}, [locationCoordinates]);

	const activityData = {
		Running: {
			eyebrow: "RUNNING CONDITIONS",
			title: "A good window for your morning run.",
			detail: "Comfortable temperatures and light wind. Your usual route is clear.",
			metric: "Good",
			metricLabel: "conditions",
			best: "6:00 – 7:30 AM",
			accent: "coral",
		},
		Gardening: {
			eyebrow: "GARDENING CONDITIONS",
			title: "A gentle day for the garden.",
			detail: "Mild temperatures and moderate humidity. Rain is unlikely until evening.",
			metric: "Good",
			metricLabel: "conditions",
			best: "7:00 – 10:00 AM",
			accent: "leaf",
		},
		Commuting: {
			eyebrow: "YOUR COMMUTE",
			title: "Clear sailing to the office.",
			detail: "No significant weather issues detected along your regular route.",
			metric: "Normal",
			metricLabel: "route status",
			best: "Leave by 8:20 AM",
			accent: "blue",
		},
		Shopping: {
			eyebrow: "SHOPPING CONDITIONS",
			title: "A comfortable time to head out.",
			detail: "Mild weather with no major rain interruption expected.",
			metric: "Good",
			metricLabel: "conditions",
			best: "10:00 AM – 1:00 PM",
			accent: "coral",
		},
		"Outdoor event": {
			eyebrow: "OUTDOOR EVENT",
			title: "Your event window looks promising.",
			detail: "Keep an eye on changing cloud cover and the evening rain chance.",
			metric: "Watch",
			metricLabel: "conditions",
			best: "4:00 – 7:00 PM",
			accent: "leaf",
		},
		Exercise: {
			eyebrow: "EXERCISE CONDITIONS",
			title: "Good conditions for getting moving.",
			detail: "Light wind and manageable temperatures for outdoor exercise.",
			metric: "Good",
			metricLabel: "conditions",
			best: "6:00 – 8:00 AM",
			accent: "blue",
		},
		Cycling: {
			eyebrow: "CYCLING CONDITIONS",
			title: "A steady ride is on the cards.",
			detail: "Check wind direction before setting out on a longer ride.",
			metric: "Good",
			metricLabel: "conditions",
			best: "6:30 – 8:30 AM",
			accent: "leaf",
		},
		Sports: {
			eyebrow: "SPORTS CONDITIONS",
			title: "Solid conditions for playing outside.",
			detail: "Comfortable temperatures, with rain risk to monitor later today.",
			metric: "Good",
			metricLabel: "conditions",
			best: "5:00 – 7:00 PM",
			accent: "coral",
		},
		"School pickup": {
			eyebrow: "PICKUP CONDITIONS",
			title: "A safe, low-stress window for the school run.",
			detail: "Clearer roads and lower rain chance make pickup easier, with fewer visibility issues around the school area.",
			metric: "Good",
			metricLabel: "visibility",
			best: "3:00 – 4:30 PM",
			accent: "blue",
		},
		Surfing: {
			eyebrow: "SURF CONDITIONS",
			title: "The swell window looks promising for a session.",
			detail: "Light to moderate wind and a dry spell make this a better time for clean, rideable waves.",
			metric: "Clean",
			metricLabel: "waves",
			best: "7:30 – 9:00 AM",
			accent: "leaf",
		},
		Walking: {
			eyebrow: "WALKING CONDITIONS",
			title: "A pleasant time to get outside.",
			detail: "Comfortable air and manageable wind for an easy walk.",
			metric: "Good",
			metricLabel: "conditions",
			best: "7:00 – 9:00 AM",
			accent: "leaf",
		},
		Photography: {
			eyebrow: "PHOTOGRAPHY CONDITIONS",
			title: "Soft light and a clear outlook.",
			detail: "A comfortable window for exploring and capturing the day outdoors.",
			metric: "Good",
			metricLabel: "conditions",
			best: "5:00 – 7:00 PM",
			accent: "coral",
		},
		Picnic: {
			eyebrow: "PICNIC CONDITIONS",
			title: "A relaxed window for a picnic.",
			detail: "Mild weather with a low chance of interruption from rain.",
			metric: "Good",
			metricLabel: "conditions",
			best: "11:00 AM – 1:00 PM",
			accent: "leaf",
		},
		Yoga: {
			eyebrow: "YOGA CONDITIONS",
			title: "A calm start to your practice.",
			detail: "Comfortable temperatures and light wind make it easier to focus.",
			metric: "Good",
			metricLabel: "conditions",
			best: "6:00 – 8:00 AM",
			accent: "blue",
		},
		Travel: {
			eyebrow: "TRAVEL CONDITIONS",
			title: "A smoother window to set off.",
			detail: "No major weather interruptions are expected for your plans.",
			metric: "Normal",
			metricLabel: "conditions",
			best: "9:00 – 11:00 AM",
			accent: "blue",
		},
	};
	const current = activityData[activity];
	const navigate = (tab) => setActiveTab(tab);
	const toggleActivity = (option) => {
		setSelectedActivities((selected) => {
			if (selected.includes(option)) {
				if (selected.length === 1) return selected;
				const next = selected.filter((item) => item !== option);
				if (activity === option) setActivity(next[0]);
				return next;
			}
			setActivity(option);
			return [...selected, option];
		});
	};
	const selectLocation = ({ name, latitude, longitude }) => {
		setLocation(name);
		setLocationCoordinates({ latitude, longitude });
		setActiveTab("home");
	};
	const renderContent = () => {
		const liveCurrent = weather?.current;
		const CurrentWeatherIcon = weatherIconForCode(
			liveCurrent?.weather_code ?? 2,
		);
		const hourlyForecast = weather?.hourly || [];
		const dailyForecast = weather?.daily || [];
		const bestActivityWindow = getBestActivityWindow(
			activity,
			hourlyForecast,
		);
		const activitySuitability = getActivitySuitability(activity, weather);
		if (activeTab === "routes")
			return (
				<RoutesView
					onBack={() => navigate("home")}
					profileName={profileName}
					onProfile={() => setIsProfileEditorOpen(true)}
				/>
			);
		if (activeTab === "locations")
			return (
				<LocationsView
					location={location}
					onSelectLocation={selectLocation}
					onBack={() => navigate("home")}
					profileName={profileName}
					onProfile={() => setIsProfileEditorOpen(true)}
				/>
			);
		if (activeTab === "personalize")
			return (
				<PersonalizeView
					activity={activity}
					setActivity={setActivity}
					selectedActivities={selectedActivities}
					toggleActivity={toggleActivity}
					activityCategories={ACTIVITY_CATEGORIES}
					onBack={() => navigate("home")}
					profileName={profileName}
					onProfile={() => setIsProfileEditorOpen(true)}
				/>
			);
		return (
			<>
				<header className="topbar">
					<div className="brand-mark">
						<span />
						mausam
					</div>
					<div className="top-actions">
						<button
							className="icon-button"
							aria-label="Notifications"
						>
							<Bell size={19} />
						</button>
						<button
							className="avatar"
							aria-label="Profile"
							onClick={() => setIsProfileEditorOpen(true)}
						>
							{getInitials(profileName)}
						</button>
					</div>
				</header>
				<section className="location-row">
					<div>
						<span className="section-kicker">CURRENTLY IN</span>
						<button
							className="location-selector"
							onClick={() => navigate("locations")}
						>
							<MapPin size={15} /> {location}{" "}
							<ChevronRight size={15} />
						</button>
					</div>
					<span className="updated">
						{weatherState === "ready"
							? `Live · ${weatherSource}`
							: weatherState === "loading"
								? "Loading live weather"
								: "Live data unavailable"}
					</span>
				</section>
				<section className={`hero-card ${weatherState}`}>
					<div className="hero-copy">
						<span className="section-kicker light">
							{weather?.date || "LIVE WEATHER"}
						</span>
						<div className="temperature">
							{liveCurrent
								? Math.round(liveCurrent.temperature_2m)
								: "--"}
							<span>°</span>
						</div>
						<div className="weather-label">
							{liveCurrent
								? weatherLabelForCode(liveCurrent.weather_code)
								: "Fetching conditions"}{" "}
							{liveCurrent && (
								<>
									<span>·</span> Feels like{" "}
									{Math.round(
										liveCurrent.apparent_temperature,
									)}
									°
								</>
							)}
						</div>
					</div>
					<CurrentWeatherIcon
						className="hero-sun"
						size={94}
						strokeWidth={1.2}
					/>
					<div className="hero-footer">
						<span>
							<Wind size={16} />{" "}
							{liveCurrent
								? Math.round(liveCurrent.wind_speed_10m)
								: "--"}{" "}
							km/h
						</span>
						<span>
							<Droplets size={16} />{" "}
							{liveCurrent
								? liveCurrent.relative_humidity_2m
								: "--"}
							%
						</span>
						<span>
							<Umbrella size={16} />{" "}
							{liveCurrent
								? liveCurrent.precipitation_probability
								: "--"}
							% rain
						</span>
					</div>
				</section>
				<section className="insight-header">
					<div>
						<span className="section-kicker">
							MADE FOR YOUR DAY
						</span>
						<h1>
							{activity === "Commuting"
								? "Your commute, made clearer."
								: `Your ${activity.toLowerCase()} forecast.`}
						</h1>
					</div>
					<button
						className="text-button"
						onClick={() => setIsActivityPickerOpen((open) => !open)}
					>
						Edit <ChevronRight size={15} />
					</button>
				</section>
				{isActivityPickerOpen && (
					<div
						className="activity-picker"
						aria-label="Choose forecast focus"
					>
						<span className="section-kicker">
							SHOW FORECAST FOR
						</span>
						<div className="activity-picker-options">
							{selectedActivities
								.filter((option) => activityData[option])
								.map((option) => (
									<button
										key={option}
										className={
											activity === option ? "chosen" : ""
										}
										onClick={() => {
											setActivity(option);
											setIsActivityPickerOpen(false);
										}}
									>
										{option}
									</button>
								))}
						</div>
					</div>
				)}
				<div className={`insight-card ${current.accent}`}>
					<div className="insight-topline">
						<span>{current.eyebrow}</span>
						<Activity size={18} />
					</div>
					<div className="suitability-score" aria-live="polite">
						<strong>
							{activity} —{" "}
							{activitySuitability
								? `${activitySuitability.score}% Suitable`
								: "Weather unavailable"}
						</strong>
						<span>
							{activitySuitability?.explanation ||
								"Waiting for the latest weather data."}
						</span>
					</div>
					<div className="insight-status">
						{current.metric}
						<small>{current.metricLabel}</small>
					</div>
					<p>{current.title}</p>
					<span className="insight-detail">{current.detail}</span>
					{activity !== "School pickup" && (
						<button
							className="best-time"
							type="button"
							aria-label="View detailed forecast for the best window"
							onClick={() => {
								setIsHourlyExpanded(true);
								setIsForecastExpanded(false);
								requestAnimationFrame(() =>
									document
										.querySelector(".forecast-section")
										?.scrollIntoView({
											behavior: "smooth",
											block: "start",
										}),
								);
							}}
						>
							<span>BEST WINDOW</span>
							<strong>
								{bestActivityWindow
									? formatWindow(bestActivityWindow.time)
									: current.best}
							</strong>
							<ChevronRight size={17} />
						</button>
					)}
				</div>
				{activity === "Gardening" && (
					<FarmGardenAdvisory weather={weather} />
				)}
				<section className="forecast-section">
					<div className="section-heading">
						<h2>Today at a glance</h2>
						<button
							className="text-button"
							onClick={() => {
								const expanded = !isForecastExpanded;
								setIsForecastExpanded(expanded);
								setIsHourlyExpanded(expanded);
							}}
						>
							{isForecastExpanded
								? "Hide forecast"
								: "Full forecast"}{" "}
							<ChevronRight size={15} />
						</button>
					</div>
					<div className="hourly-row">
						{hourlyForecast
							.slice(0, isHourlyExpanded ? 24 : 5)
							.map(
								(
									{
										time,
										temperature,
										precipitationProbability,
										code,
									},
									index,
								) => {
									const Icon = weatherIconForCode(code);
									return (
										<div
											className={`hour ${index === 0 ? "selected" : ""}`}
											key={time}
										>
											<span>
												{index === 0
													? "Now"
													: formatHour(time)}
											</span>
											<Icon size={20} />
											<strong>
												{Math.round(temperature)}°
											</strong>
											<small>
												{precipitationProbability}%
											</small>
										</div>
									);
								},
							)}
						{weatherState === "loading" && (
							<span className="forecast-status">
								Loading forecast…
							</span>
						)}
						{weatherState === "error" && (
							<span className="forecast-status">
								Weather is temporarily unavailable.
							</span>
						)}
					</div>
					{isForecastExpanded && weatherState === "ready" && (
						<div className="full-forecast">
							<div className="full-forecast-heading">
								<span className="section-kicker">
									NEXT 3 DAYS
								</span>
								<span className="forecast-source">
									Open-Meteo
								</span>
							</div>
							{dailyForecast.map((day, index) => {
								const Icon = weatherIconForCode(day.code);
								return (
									<div className="daily-row" key={day.date}>
										<strong>
											{index === 0
												? "Today"
												: formatForecastDay(day.date)}
										</strong>
										<Icon size={19} />
										<span>
											{Math.round(day.min)}° /{" "}
											{Math.round(day.max)}°
										</span>
										<small>{day.rain}% rain</small>
									</div>
								);
							})}
						</div>
					)}
				</section>
			</>
		);
	};

	return (
		<main className="app-shell">
			<div className="app-content">{renderContent()}</div>
			{isProfileEditorOpen && (
				<ProfileEditor
					name={profileName}
					onSave={(name) => {
						setProfileName(name);
						setIsProfileEditorOpen(false);
					}}
					onClose={() => setIsProfileEditorOpen(false)}
				/>
			)}
			<nav className="bottom-nav" aria-label="Main navigation">
				{[
					["home", HomeIcon, "Home"],
					["routes", Route, "Routes"],
					["locations", Map, "Locations"],
					["personalize", Settings2, "Personalize"],
				].map(([id, Icon, label]) => (
					<button
						key={id}
						className={activeTab === id ? "active" : ""}
						onClick={() => navigate(id)}
					>
						<Icon size={19} />
						<span>{label}</span>
					</button>
				))}
			</nav>
		</main>
	);
}

function ProfileEditor({ name, onSave, onClose }) {
	const [draftName, setDraftName] = useState(name);

	const save = (event) => {
		event.preventDefault();
		const nextName = draftName.trim();
		if (nextName) onSave(nextName);
	};

	return (
		<div className="profile-overlay" role="presentation" onMouseDown={onClose}>
			<section
				className="profile-sheet"
				role="dialog"
				aria-modal="true"
				aria-labelledby="profile-editor-title"
				onMouseDown={(event) => event.stopPropagation()}
			>
				<button className="profile-close" type="button" onClick={onClose} aria-label="Close profile editor">
					<X size={18} />
				</button>
				<div className="profile-avatar-preview">{getInitials(draftName)}</div>
				<span className="section-kicker">YOUR PROFILE</span>
				<h2 id="profile-editor-title">Make Mausam yours</h2>
				<p>Set the name shown across your weather experience.</p>
				<form className="profile-form" onSubmit={save}>
					<label htmlFor="profile-name">Your name</label>
					<input
						id="profile-name"
						value={draftName}
						onChange={(event) => setDraftName(event.target.value)}
						maxLength={40}
						autoFocus
					/>
					<button className="primary-button profile-save" type="submit">
						Save profile
					</button>
				</form>
			</section>
		</div>
	);
}

function PageHeader({ eyebrow, title, onBack, onProfile }) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	return (
		<header className="page-header">
			<button className="icon-button" aria-label="Back" onClick={onBack}>
				<ChevronRight className="back-icon" size={20} />
			</button>
			<div>
				<span className="section-kicker">{eyebrow}</span>
				<h1>{title}</h1>
			</div>
			<button
				className="icon-button"
				aria-label="Menu"
				aria-expanded={isMenuOpen}
				onClick={() => setIsMenuOpen((open) => !open)}
			>
				<Menu size={20} />
			</button>
			{isMenuOpen && (
				<div className="page-menu">
					<button
						className="page-menu-item"
						type="button"
						onClick={() => {
							setIsMenuOpen(false);
							onProfile();
						}}
					>
						<UserRound size={17} /> Profile
					</button>
				</div>
			)}
		</header>
	);
}

function evaluateRouteActivityConditions(activity, forecasts) {
	const advisories = [];
	const hours = forecasts.flatMap((forecast) =>
		(forecast?.hourly?.time || []).map((time, index) => ({
			time,
			temperature: Number(forecast.hourly.temperature_2m?.[index]),
			rain: Number(forecast.hourly.precipitation_probability?.[index]),
			wind: Number(forecast.hourly.wind_speed_10m?.[index]),
			uv: Number(forecast.hourly.uv_index?.[index]),
			code: Number(forecast.hourly.weather_code?.[index]),
		})),
	);
	const validHours = hours.filter((hour) => hour.time);
	if (!validHours.length) {
		return [
			{
				type: "neutral",
				message: `Route conditions are unavailable for ${activity.toLowerCase()}.`,
				detail: "Try again when the route forecast is available.",
			},
		];
	}
	const maxRain = Math.max(...validHours.map((hour) => hour.rain || 0));
	const maxTemperature = Math.max(
		...validHours
			.map((hour) => hour.temperature)
			.filter(Number.isFinite),
	);
	const maxWind = Math.max(
		...validHours.map((hour) => hour.wind).filter(Number.isFinite),
		0,
	);
	const maxUv = Math.max(
		...validHours.map((hour) => hour.uv).filter(Number.isFinite),
		0,
	);
	const rainExpected =
		maxRain >= 50 ||
		validHours.some((hour) => hour.code >= 51 && hour.code <= 99);
	const prefix = activity === "Cycling" ? "Cycling" : "Running";

	if (activity !== "Commuting" && rainExpected) {
		advisories.push({
			type: "rain",
			message: `Rain is expected along your route. Consider postponing ${activity.toLowerCase()} or carrying rain protection.`,
			detail: `${maxRain}% peak rain probability`,
		});
	}
	if (activity !== "Commuting" && maxTemperature >= 32) {
		advisories.push({
			type: "heat",
			message: `It's hot today. Carry water and consider ${activity.toLowerCase()} during cooler hours.`,
			detail: `${Math.round(maxTemperature)}°C peak temperature`,
		});
	}
	if (activity !== "Commuting" && maxUv >= 6) {
		advisories.push({
			type: "uv",
			message: "UV exposure is high. Use sunscreen and avoid prolonged exposure.",
			detail: `UV index up to ${Math.round(maxUv)}`,
		});
	}
	if (activity !== "Commuting" && maxWind >= 30) {
		advisories.push({
			type: "wind",
			message: `${prefix} conditions are windy. Take care on exposed sections of the route.`,
			detail: `${Math.round(maxWind)} km/h peak wind`,
		});
	}
	if (activity === "Commuting") {
		advisories.push({
			type: rainExpected ? "rain" : "neutral",
			message: rainExpected
				? "Rain is possible along your route. Carry rain protection."
				: "Practical travel conditions look manageable along your route.",
			detail: rainExpected
				? `${maxRain}% peak rain probability`
				: "No major route weather risks detected",
		});
	}
	if (!advisories.length) {
		advisories.push({
			type: "good",
			message: `Good conditions for ${activity.toLowerCase()}.`,
			detail:
				"Air quality data is unavailable for this route; weather conditions look favorable.",
		});
	}
	return advisories;
}

function RouteWeatherAlert({ route }) {
	const [alert, setAlert] = useState(null);
	const [activityAdvice, setActivityAdvice] = useState(null);
	const [state, setState] = useState("loading");

	useEffect(() => {
		if (!route) {
			queueMicrotask(() => setState("empty"));
			return undefined;
		}
		const controller = new AbortController();
		const resolvePoint = async (query, coordinates) => {
			if (coordinates) return coordinates;
			return (
				await searchOpenRouteLocations(query, controller.signal, 1)
			)[0];
		};
		queueMicrotask(() => setState("loading"));
		Promise.all([
			resolvePoint(route.origin, route.originCoordinates),
			resolvePoint(route.destination, route.destinationCoordinates),
		])
			.then(async ([origin, destination]) => {
				if (!origin || !destination)
					throw new Error("Route locations not found");
				const points = [origin, destination];
				const forecasts = await Promise.all(
					points.map((point) =>
						fetch(
							`https://api.open-meteo.com/v1/forecast?latitude=${point.latitude}&longitude=${point.longitude}&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,uv_index&timezone=auto&forecast_days=1`,
							{ signal: controller.signal },
						).then((response) => {
							if (!response.ok)
								throw new Error("Route forecast failed");
							return response.json();
						}),
					),
				);
				const risks = forecasts.flatMap((forecast, index) =>
					forecast.hourly.time.map((time, hourIndex) => ({
						time,
						probability:
							forecast.hourly.precipitation_probability[
								hourIndex
							],
						code: forecast.hourly.weather_code[hourIndex],
						place: index === 0 ? route.origin : route.destination,
					})),
				);
				const highestRisk = risks.sort(
					(left, right) => right.probability - left.probability,
				)[0];
				setAlert(highestRisk?.probability >= 40 ? highestRisk : null);
				setActivityAdvice(
					evaluateRouteActivityConditions(
						route.activity || "Commuting",
						forecasts,
					),
				);
				setState("ready");
			})
			.catch((error) => {
				if (error.name !== "AbortError") setState("error");
			});
		return () => controller.abort();
	}, [
		route,
		route?.originCoordinates,
		route?.destinationCoordinates,
	]);

	if (state !== "ready") return null;
	return (
		<>
			{alert && (
				<section className="route-alert route-specific-alert">
					<div className="alert-icon">
						<CloudRain size={19} />
					</div>
					<div>
						<span className="section-kicker">
							ROUTE WATCH · {route.name}
						</span>
						<strong>Rain is possible near {alert.place}</strong>
						<p>
							{formatHour(alert.time)} · {alert.probability}% chance ·
							Open-Meteo forecast
						</p>
					</div>
				</section>
			)}
			{activityAdvice && (
				<section
					className={`route-activity-advice ${activityAdvice.type}`}
				>
					<div className="route-activity-advice-heading">
						<span className="section-kicker">
							{route.activity || "Commuting"} · ROUTE CONDITIONS
						</span>
						<span className="route-activity-status">LIVE</span>
					</div>
					<div className="route-activity-advice-list">
						{activityAdvice.map((advisory, index) => (
							<div
								className={`route-activity-advice-item ${advisory.type}`}
								key={`${advisory.type}-${index}`}
							>
								<strong>{advisory.message}</strong>
								{advisory.detail && <span>{advisory.detail}</span>}
							</div>
						))}
					</div>
				</section>
			)}
		</>
	);
}

function RoutesView({ onBack, onProfile }) {
	const [isAddingRoute, setIsAddingRoute] = useState(false);
	const [editingIndex, setEditingIndex] = useState(null);
	const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
	const [routeForm, setRouteForm] = useState({
		name: "",
		origin: "",
		destination: "",
		schedule: "",
		activity: "Commuting",
		originCoordinates: null,
		destinationCoordinates: null,
	});
	const [savedRoutes, setSavedRoutes] = useState(() => {
		const storedRoutes = localStorage.getItem("mausam-routes");
		return storedRoutes
			? JSON.parse(storedRoutes)
			: [
					{
						name: "Home → Office",
						origin: "Indiranagar",
						destination: "Koramangala",
						schedule: "Weekdays · 8:20 AM",
						detail: "Indiranagar → Koramangala · Weekdays · 8:20 AM",
						status: "Clear",
						accent: "coral-bg",
						activity: "Commuting",
					},
					{
						name: "Morning run",
						origin: "Home",
						destination: "Lalbagh",
						schedule: "Morning",
						detail: "Home → Lalbagh · Morning",
						status: "Good",
						accent: "blue-bg",
						activity: "Commuting",
					},
				];
	});
	const updateRouteField = (field, value) =>
		setRouteForm((form) => ({ ...form, [field]: value }));
	const updateRouteLocation = (field, value) =>
		setRouteForm((form) => ({
			...form,
			[field]: value,
			[`${field}Coordinates`]: null,
		}));
	const selectRouteLocation = (field, result) =>
		setRouteForm((form) => ({
			...form,
			[field]: result.label || result.name,
			[`${field}Coordinates`]: {
				latitude: result.latitude,
				longitude: result.longitude,
			},
		}));
	const saveRoute = (event) => {
		event.preventDefault();
		if (
			!routeForm.name.trim() ||
			!routeForm.origin.trim() ||
			!routeForm.destination.trim()
		)
			return;
		const updatedRoute = {
			name: routeForm.name.trim(),
			origin: routeForm.origin.trim(),
			destination: routeForm.destination.trim(),
			originCoordinates: routeForm.originCoordinates,
			destinationCoordinates: routeForm.destinationCoordinates,
			schedule: routeForm.schedule.trim(),
			activity: routeForm.activity,
			detail: `${routeForm.origin.trim()} → ${routeForm.destination.trim()}${routeForm.schedule.trim() ? ` · ${routeForm.schedule.trim()}` : ""}`,
			status:
				editingIndex === null
					? "New"
					: savedRoutes[editingIndex].status,
			accent:
				editingIndex === null
					? "coral-bg"
					: savedRoutes[editingIndex].accent,
		};
		const nextRoutes =
			editingIndex === null
				? [...savedRoutes, updatedRoute]
				: savedRoutes.map((route, index) =>
						index === editingIndex ? updatedRoute : route,
					);
		setSelectedRouteIndex(
			editingIndex === null ? savedRoutes.length : editingIndex,
		);
		setSavedRoutes(nextRoutes);
		localStorage.setItem("mausam-routes", JSON.stringify(nextRoutes));
		setRouteForm({
			name: "",
			origin: "",
			destination: "",
			schedule: "",
			activity: "Commuting",
			originCoordinates: null,
			destinationCoordinates: null,
		});
		setEditingIndex(null);
		setIsAddingRoute(false);
	};
	const editRoute = (route, index) => {
		const routeText = route.detail.includes(" → ")
			? route.detail
			: route.name.includes(" → ")
				? route.name
				: "";
		const [routePlaces, ...scheduleParts] = routeText.split(" · ");
		const [parsedOrigin, parsedDestination] = routePlaces.split(" → ");
		setRouteForm({
			name: route.name,
			origin: route.origin || parsedOrigin || "",
			destination: route.destination || parsedDestination || "",
			originCoordinates: route.originCoordinates || null,
			destinationCoordinates: route.destinationCoordinates || null,
			schedule:
				route.schedule ||
				(route.detail.includes(" → ")
					? scheduleParts.join(" · ")
					: route.detail),
			activity: route.activity || "Commuting",
		});
		setEditingIndex(index);
		setIsAddingRoute(true);
	};
	const deleteRoute = (index) => {
		const nextRoutes = savedRoutes.filter(
			(_, routeIndex) => routeIndex !== index,
		);
		setSavedRoutes(nextRoutes);
		localStorage.setItem("mausam-routes", JSON.stringify(nextRoutes));
		setSelectedRouteIndex(
			Math.max(0, Math.min(selectedRouteIndex, nextRoutes.length - 1)),
		);
	};
	const selectedRoute = savedRoutes[selectedRouteIndex] || savedRoutes[0];
	return (
		<>
			<PageHeader
				eyebrow="WEATHER-AWARE"
				title="Your routes"
				onBack={onBack}
				onProfile={onProfile}
			/>
			<OpenRouteMap route={selectedRoute} />
			{selectedRoute && <TrafficUpdates route={selectedRoute} />}
			<RouteWeatherAlert route={selectedRoute} />
			<section className="page-section">
				<div className="section-heading">
					<div>
						<span className="section-kicker">SAVED ROUTES</span>
						<h2>Keep an eye on the way</h2>
					</div>
					<button
						className="round-button"
						aria-label="Add route"
						onClick={() => setIsAddingRoute((visible) => !visible)}
					>
						<Plus size={18} />
					</button>
				</div>
				{isAddingRoute && (
					<form className="route-form" onSubmit={saveRoute}>
						<div className="route-form-heading">
							<strong>
								{editingIndex === null
									? "Add a regular route"
									: "Edit route"}
							</strong>
							<button
								type="button"
								className="close-button"
								onClick={() => setIsAddingRoute(false)}
								aria-label="Close add route"
							>
								<X size={17} />
							</button>
						</div>
						<label className="route-input-group">
							<span className="route-field-label">Route name</span>
							<input
								value={routeForm.name}
								onChange={(event) =>
									updateRouteField("name", event.target.value)
								}
								placeholder="e.g. Home to office"
								aria-label="Route name"
								required
							/>
						</label>
						<div className="route-form-row">
							<RouteLocationField
								label="Route origin"
								value={routeForm.origin}
								onChange={(value) =>
									updateRouteLocation("origin", value)
								}
								onSelect={(result) =>
									selectRouteLocation("origin", result)
								}
								placeholder="From"
							/>
							<RouteLocationField
								label="Route destination"
								value={routeForm.destination}
								onChange={(value) =>
									updateRouteLocation("destination", value)
								}
								onSelect={(result) =>
									selectRouteLocation("destination", result)
								}
								placeholder="To"
							/>
						</div>
						<label className="route-input-group">
							<span className="route-field-label">
								Activity
							</span>
							<select
								value={routeForm.activity}
								onChange={(event) =>
									updateRouteField(
										"activity",
										event.target.value,
									)
								}
								aria-label="Route activity"
							>
								<option value="Commuting">Commuting</option>
								<option value="Running">Running</option>
								<option value="Cycling">Cycling</option>
							</select>
						</label>
						<label className="route-input-group">
							<span className="route-field-label">
								Schedule <em>Optional</em>
							</span>
							<input
								value={routeForm.schedule}
								onChange={(event) =>
									updateRouteField("schedule", event.target.value)
								}
								placeholder="e.g. Weekdays · 8:20 AM"
								aria-label="Route schedule"
							/>
						</label>
						<button className="save-route-button" type="submit">
							{editingIndex === null
								? "Save route"
								: "Update route"}
						</button>
					</form>
				)}
				{savedRoutes.map((savedRoute, index) => (
					<div
						className={`list-card route-card ${selectedRouteIndex === index ? "selected-route" : ""}`}
						key={`${savedRoute.name}-${index}`}
						onClick={() => setSelectedRouteIndex(index)}
					>
						<div className={`list-icon ${savedRoute.accent}`}>
							<Route size={18} />
						</div>
						<div>
							<strong>{savedRoute.name}</strong>
							<span>{savedRoute.detail}</span>
						</div>
						<span className="route-activity-pill">
							{savedRoute.activity || "Commuting"}
						</span>
						<span className="status-pill good">
							{savedRoute.status}
						</span>
						<button
							className="edit-route-button"
							type="button"
							onClick={() => editRoute(savedRoute, index)}
							aria-label={`Edit ${savedRoute.name}`}
						>
							<Pencil size={15} />
						</button>
						<button
							className="edit-route-button"
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								deleteRoute(index);
							}}
							aria-label={`Delete ${savedRoute.name}`}
						>
							<Trash2 size={15} />
						</button>
						<ChevronRight size={17} />
					</div>
				))}
			</section>
			<div className="empty-route">
				<Map size={22} />
				<span>Weather along a route is checked every 30 minutes.</span>
			</div>
		</>
	);
}

function RouteLocationField({ label, value, onChange, onSelect, placeholder }) {
	const [results, setResults] = useState([]);
	const [searchState, setSearchState] = useState("idle");
	const [hasSelection, setHasSelection] = useState(false);
	useEffect(() => {
		const query = value.trim();
		if (hasSelection) return undefined;
		if (query.length < 2) {
			queueMicrotask(() => {
				setResults([]);
				setSearchState("idle");
			});
			return undefined;
		}
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			setSearchState("loading");
			searchOpenRouteLocations(query, controller.signal, 4)
				.then((locations) => {
					setResults(locations);
					setSearchState(locations.length ? "ready" : "empty");
				})
				.catch((error) => {
					if (error.name !== "AbortError") setSearchState("error");
				});
		}, 300);
		return () => {
			clearTimeout(timeout);
			controller.abort();
		};
	}, [value, hasSelection]);
	return (
		<div className="route-location-field">
			<span className="route-field-label">{label}</span>
			<input
				value={value}
				onChange={(event) => {
					setHasSelection(false);
					onChange(event.target.value);
				}}
				placeholder={placeholder}
				aria-label={label}
				required
			/>
			{value.trim().length >= 2 &&
				(searchState === "loading" ||
					searchState === "empty" ||
					results.length > 0) && (
					<div className="route-location-results">
						{searchState === "loading" && <span>Searching…</span>}
						{searchState === "empty" && (
							<span>No locations found.</span>
						)}
						{results.map((result) => (
							<button
								type="button"
								key={`${result.id}-${result.latitude}`}
								onClick={() => {
									onSelect(result);
									setHasSelection(true);
									setResults([]);
								}}
							>
								<MapPin size={13} />
								<span>
									<strong>{result.name}</strong>
									<small>
										{[result.admin1, result.country]
											.filter(Boolean)
											.join(", ")}
									</small>
								</span>
							</button>
						))}
					</div>
				)}
		</div>
	);
}

function LocationsView({ location, onSelectLocation, onBack, onProfile }) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState([]);
	const [searchState, setSearchState] = useState("idle");
	const [isEditingLocation, setIsEditingLocation] = useState(false);
	const [editingIndex, setEditingIndex] = useState(null);
	const [locationForm, setLocationForm] = useState({
		name: "",
		place: "",
		coordinates: null,
	});
	const [savedLocations, setSavedLocations] = useState(() => {
		const stored = localStorage.getItem("mausam-locations");
		return stored
			? JSON.parse(stored)
			: [
					{
						name: "Bengaluru",
						detail: "Current location",
						coordinates: WEATHER_LOCATIONS.Bengaluru,
					},
					{
						name: "Home",
						detail: "Indiranagar, Bengaluru",
						coordinates: WEATHER_LOCATIONS.Home,
					},
					{
						name: "Office",
						detail: "Koramangala, Bengaluru",
						coordinates: WEATHER_LOCATIONS.Office,
					},
				];
	});
	const saveLocation = (event) => {
		event.preventDefault();
		if (
			!locationForm.name.trim() ||
			!locationForm.place.trim() ||
			!locationForm.coordinates
		)
			return;
		const nextLocation = {
			name: locationForm.name.trim(),
			detail: locationForm.place.trim(),
			coordinates: locationForm.coordinates,
		};
		const nextLocations =
			editingIndex === null
				? [...savedLocations, nextLocation]
				: savedLocations.map((saved, index) =>
						index === editingIndex ? nextLocation : saved,
					);
		setSavedLocations(nextLocations);
		localStorage.setItem("mausam-locations", JSON.stringify(nextLocations));
		setLocationForm({ name: "", place: "", coordinates: null });
		setEditingIndex(null);
		setIsEditingLocation(false);
	};
	const editLocation = (saved, index) => {
		setLocationForm({
			name: saved.name,
			place: saved.detail,
			coordinates: saved.coordinates,
		});
		setEditingIndex(index);
		setIsEditingLocation(true);
	};
	const deleteLocation = (index) => {
		const nextLocations = savedLocations.filter(
			(_, locationIndex) => locationIndex !== index,
		);
		setSavedLocations(nextLocations);
		localStorage.setItem("mausam-locations", JSON.stringify(nextLocations));
	};
	useEffect(() => {
		const trimmedQuery = query.trim();
		if (trimmedQuery.length < 2) {
			queueMicrotask(() => {
				setResults([]);
				setSearchState("idle");
			});
			return undefined;
		}
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			setSearchState("loading");
			searchOpenRouteLocations(trimmedQuery, controller.signal, 5)
				.then((locations) => {
					setResults(locations);
					setSearchState(locations.length ? "ready" : "empty");
				})
				.catch((error) => {
					if (error.name !== "AbortError") setSearchState("error");
				});
		}, 350);
		return () => {
			clearTimeout(timeout);
			controller.abort();
		};
	}, [query]);
	return (
		<>
			<PageHeader
				eyebrow="PLACES"
				title="Your locations"
				onBack={onBack}
				onProfile={onProfile}
			/>
			<section className="page-section locations-page">
				<div className="search-box">
					<MapPin size={18} />
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search for a city"
						aria-label="Search for a city"
					/>
				</div>
				{query.trim().length >= 2 && (
					<div className="location-results">
						{searchState === "loading" && (
							<span>Searching locations…</span>
						)}
						{searchState === "empty" && (
							<span>No locations found.</span>
						)}
						{searchState === "error" && (
							<span>
								Location search is unavailable. Try again.
							</span>
						)}
						{results.map((result) => (
							<button
								className="location-result"
								key={`${result.id}-${result.latitude}-${result.longitude}`}
								onClick={() =>
									onSelectLocation({
										name: result.name,
										latitude: result.latitude,
										longitude: result.longitude,
									})
								}
							>
								<MapPin size={16} />
								<span>
									<strong>{result.name}</strong>
									<small>
										{[result.admin1, result.country]
											.filter(Boolean)
											.join(", ")}
									</small>
								</span>
								<ChevronRight size={16} />
							</button>
						))}
					</div>
				)}
				<button className="detect-location">
					<Navigation size={17} /> Use my current location
				</button>
				<div className="section-heading">
					<h2>Saved places</h2>
					<button
						className="round-button"
						aria-label="Add location"
						onClick={() => setIsEditingLocation((open) => !open)}
					>
						<Plus size={18} />
					</button>
				</div>
				{isEditingLocation && (
					<form
						className="location-form route-form"
						onSubmit={saveLocation}
					>
						<div className="route-form-heading">
							<strong>
								{editingIndex === null
									? "Add a saved place"
									: "Edit saved place"}
							</strong>
							<button
								type="button"
								className="close-button"
								onClick={() => setIsEditingLocation(false)}
								aria-label="Close location form"
							>
								<X size={17} />
							</button>
						</div>
						<input
							value={locationForm.name}
							onChange={(event) =>
								setLocationForm((form) => ({
									...form,
									name: event.target.value,
								}))
							}
							placeholder="Place name (Home, Office…)"
							aria-label="Place name"
							required
						/>
						<RouteLocationField
							label="Location"
							value={locationForm.place}
							onChange={(value) =>
								setLocationForm((form) => ({
									...form,
									place: value,
									coordinates: null,
								}))
							}
							onSelect={(result) =>
								setLocationForm((form) => ({
									...form,
									place: result.label || result.name,
									coordinates: {
										latitude: result.latitude,
										longitude: result.longitude,
									},
								}))
							}
							placeholder="Search for a location"
						/>
						<button className="save-route-button" type="submit">
							{editingIndex === null
								? "Save location"
								: "Update location"}
						</button>
					</form>
				)}
				{savedLocations.map((saved, index) => (
					<div
						className={`location-card ${location === saved.name ? "selected" : ""}`}
						key={`${saved.name}-${index}`}
						onClick={() =>
							onSelectLocation({
								name: saved.name,
								...saved.coordinates,
							})
						}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								onSelectLocation({
									name: saved.name,
									...saved.coordinates,
								});
							}
						}}
						role="button"
						tabIndex={0}
					>
						<div className="place-icon">
							<MapPin size={18} />
						</div>
						<div>
							<strong>{saved.name}</strong>
							<span>{saved.detail}</span>
						</div>
						<button
							className="edit-route-button"
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								onSelectLocation({
									name: saved.name,
									...saved.coordinates,
								});
							}}
							aria-label={`Use ${saved.name}`}
						>
							<ChevronRight size={16} />
						</button>
						<button
							className="edit-route-button"
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								editLocation(saved, index);
							}}
							aria-label={`Edit ${saved.name}`}
						>
							<Pencil size={15} />
						</button>
						<button
							className="edit-route-button"
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								deleteLocation(index);
							}}
							aria-label={`Delete ${saved.name}`}
						>
							<Trash2 size={15} />
						</button>
						{location === saved.name && (
							<span className="selected-dot" />
						)}
					</div>
				))}
			</section>
		</>
	);
}
function PersonalizeView({
	selectedActivities,
	toggleActivity,
	activityCategories,
	onBack,
	profileName,
	onProfile,
}) {
	const [activeCategory, setActiveCategory] = useState("All");
	const visibleActivities = activityCategories[activeCategory];
	return (
		<>
			<PageHeader
				eyebrow="YOUR PREFERENCES"
				title="Make it yours"
				onBack={onBack}
				onProfile={onProfile}
			/>
			<section className="page-section personalize-page">
				<div className="profile-intro">
					<div className="large-avatar">{getInitials(profileName)}</div>
					<div>
						<h2>Good morning, {profileName}</h2>
						<p>Tell us what matters most to you.</p>
					</div>
				</div>
				<span className="section-kicker">MY ACTIVITIES</span>
				<div
					className="activity-categories"
					aria-label="Activity categories"
				>
					{Object.keys(activityCategories).map((category) => (
						<button
							key={category}
							type="button"
							className={
								activeCategory === category ? "active" : ""
							}
							onClick={() => setActiveCategory(category)}
						>
							{category}
						</button>
					))}
				</div>
				<div className="activity-grid">
					{visibleActivities.map((item) => (
						<button
							className={
								selectedActivities.includes(item)
									? "chosen"
									: ""
							}
							onClick={() => toggleActivity(item)}
							key={item}
						>
							<span>
								{item === "Running"
									? "✦"
									: item === "Gardening"
										? "✿"
										: item === "Cycling"
											? "◌"
											: item === "Sports"
												? "◆"
												: item === "School pickup"
													? "⇢"
													: item === "Surfing"
														? "≈"
														: "↗"}
							</span>
							{item}
							{selectedActivities.includes(item) && (
								<span className="check">✓</span>
							)}
						</button>
					))}
				</div>
				<span className="section-kicker">NOTIFICATIONS</span>
				<div className="setting-row">
					<div>
						<strong>Daily weather briefing</strong>
						<span>A short view of the day ahead</span>
					</div>
					<div className="toggle on">
						<span />
					</div>
				</div>
				<div className="setting-row">
					<div>
						<strong>Route alerts</strong>
						<span>Only when conditions change</span>
					</div>
					<div className="toggle on">
						<span />
					</div>
				</div>
				<span className="section-kicker">PRIVACY</span>
				<div className="privacy-note">
					<MapPin size={18} />
					<p>
						Your preferences and saved places stay on this device.
						Location is only used to show relevant weather.
					</p>
					<ChevronRight size={17} />
				</div>
			</section>
		</>
	);
}

export default App;
