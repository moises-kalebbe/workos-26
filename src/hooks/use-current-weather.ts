"use client";

import { useEffect, useState } from "react";

const LIMEIRA_WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-22.5647&longitude=-47.4017&current=temperature_2m,weather_code,is_day&timezone=America%2FSao_Paulo&forecast_days=1";
const WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

type OpenMeteoCurrent = {
  temperature_2m: number;
  weather_code: number;
  is_day: number;
};

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent;
};

type WeatherState = {
  temperature: number | null;
  summary: string;
  loading: boolean;
  error: boolean;
};

const WEATHER_CODE_LABELS: Record<number, { day: string; night: string }> = {
  0: { day: "Ensolarado", night: "Céu limpo" },
  1: { day: "Quase limpo", night: "Poucas nuvens" },
  2: { day: "Parcialmente nublado", night: "Parcialmente nublado" },
  3: { day: "Nublado", night: "Nublado" },
  45: { day: "Neblina", night: "Neblina" },
  48: { day: "Neblina intensa", night: "Neblina intensa" },
  51: { day: "Garoa leve", night: "Garoa leve" },
  53: { day: "Garoa", night: "Garoa" },
  55: { day: "Garoa forte", night: "Garoa forte" },
  56: { day: "Garoa gelada", night: "Garoa gelada" },
  57: { day: "Garoa gelada forte", night: "Garoa gelada forte" },
  61: { day: "Chuva fraca", night: "Chuva fraca" },
  63: { day: "Chuva", night: "Chuva" },
  65: { day: "Chuva forte", night: "Chuva forte" },
  66: { day: "Chuva gelada", night: "Chuva gelada" },
  67: { day: "Chuva gelada forte", night: "Chuva gelada forte" },
  71: { day: "Neve fraca", night: "Neve fraca" },
  73: { day: "Neve", night: "Neve" },
  75: { day: "Neve forte", night: "Neve forte" },
  77: { day: "Grãos de neve", night: "Grãos de neve" },
  80: { day: "Pancadas leves", night: "Pancadas leves" },
  81: { day: "Pancadas de chuva", night: "Pancadas de chuva" },
  82: { day: "Pancadas fortes", night: "Pancadas fortes" },
  85: { day: "Nevasca fraca", night: "Nevasca fraca" },
  86: { day: "Nevasca forte", night: "Nevasca forte" },
  95: { day: "Trovoadas", night: "Trovoadas" },
  96: { day: "Trovoadas com granizo", night: "Trovoadas com granizo" },
  99: { day: "Tempestade com granizo", night: "Tempestade com granizo" },
};

function resolveWeatherLabel(code: number, isDay: boolean) {
  const labels = WEATHER_CODE_LABELS[code];
  if (!labels) {
    return "Clima estável";
  }

  return isDay ? labels.day : labels.night;
}

export function useCurrentWeather() {
  const [state, setState] = useState<WeatherState>({
    temperature: null,
    summary: "Carregando clima",
    loading: true,
    error: false,
  });

  useEffect(() => {
    let mounted = true;

    async function loadWeather(signal?: AbortSignal) {
      try {
        const response = await fetch(LIMEIRA_WEATHER_URL, {
          method: "GET",
          signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Weather request failed: ${response.status}`);
        }

        const data = (await response.json()) as OpenMeteoResponse;
        const current = data.current;

        if (!current || typeof current.temperature_2m !== "number" || typeof current.weather_code !== "number") {
          throw new Error("Weather payload missing current data");
        }

        if (!mounted) {
          return;
        }

        setState({
          temperature: Math.round(current.temperature_2m),
          summary: resolveWeatherLabel(current.weather_code, current.is_day === 1),
          loading: false,
          error: false,
        });
      } catch {
        if (!mounted || signal?.aborted) {
          return;
        }

        setState({
          temperature: null,
          summary: "Clima indisponível",
          loading: false,
          error: true,
        });
      }
    }

    const controller = new AbortController();
    void loadWeather(controller.signal);

    const intervalId = window.setInterval(() => {
      const refreshController = new AbortController();
      void loadWeather(refreshController.signal);
    }, WEATHER_REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  return state;
}
