"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun } from "lucide-react";

interface WeatherData {
  temperature: number;
  weathercode: number;
}

interface ClockPanelProps {
  weatherEnabled?: boolean;
  weatherLat?: number | null;
  weatherLon?: number | null;
}

function getWeatherIcon(code: number) {
  if (code === 0 || code === 1) return Sun;
  if (code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return CloudSnow;
  return Cloud;
}

export function ClockPanel({
  weatherEnabled,
  weatherLat,
  weatherLon,
}: ClockPanelProps) {
  const t = useTranslations("hub");
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch weather every 15 minutes
  useEffect(() => {
    if (!weatherEnabled || !weatherLat || !weatherLon) return;

    async function fetchWeather() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${weatherLat}&longitude=${weatherLon}&current_weather=true`
        );
        const data = await res.json();
        if (data.current_weather) {
          setWeather({
            temperature: Math.round(data.current_weather.temperature),
            weathercode: data.current_weather.weathercode,
          });
        }
      } catch {
        // Silently fail — weather is optional
      }
    }

    fetchWeather();
    const timer = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [weatherEnabled, weatherLat, weatherLon]);

  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const secondsString = now.toLocaleTimeString([], { second: "2-digit" }).slice(-2);
  const dateString = now.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const WeatherIcon = weather ? getWeatherIcon(weather.weathercode) : null;

  return (
    <div className="flex items-center justify-between p-6 col-span-full">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-bold tracking-tight tabular-nums">
            {timeString}
          </span>
          <span className="text-2xl font-light text-muted-foreground tabular-nums">
            {secondsString}
          </span>
        </div>
        <p className="text-xl text-muted-foreground mt-1">{dateString}</p>
      </div>

      {weather && WeatherIcon && (
        <div className="flex items-center gap-3">
          <WeatherIcon className="h-10 w-10 text-muted-foreground" />
          <span className="text-4xl font-semibold">{weather.temperature}°C</span>
        </div>
      )}
    </div>
  );
}
