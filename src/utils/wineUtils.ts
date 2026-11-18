import { Bottle, Cellar, CellarReading, TastingStatus, WineColor } from '../types/wine';

export const WINE_COLOR_LABELS: Record<WineColor, string> = {
  rouge: 'Rouge',
  blanc: 'Blanc',
  rose: 'Rosé',
  champagne: 'Champagne / Effervescent',
  autre: 'Autre',
};

export const WINE_COLOR_BADGES: Record<WineColor, { bg: string; text: string; dot: string; border: string }> = {
  rouge: {
    bg: 'bg-rose-950/80',
    text: 'text-rose-200',
    dot: 'bg-rose-500',
    border: 'border-rose-800/60',
  },
  blanc: {
    bg: 'bg-amber-950/60',
    text: 'text-amber-200',
    dot: 'bg-amber-300',
    border: 'border-amber-700/50',
  },
  rose: {
    bg: 'bg-pink-950/60',
    text: 'text-pink-200',
    dot: 'bg-pink-400',
    border: 'border-pink-800/50',
  },
  champagne: {
    bg: 'bg-yellow-950/60',
    text: 'text-yellow-200',
    dot: 'bg-yellow-400',
    border: 'border-yellow-700/50',
  },
  autre: {
    bg: 'bg-stone-800/80',
    text: 'text-stone-200',
    dot: 'bg-stone-400',
    border: 'border-stone-700',
  },
};

export function getEffectiveDrinkTo(bottle: Bottle): number | undefined {
  if (bottle.drinkTo !== undefined && bottle.drinkTo > 0) {
    return bottle.drinkTo;
  }
  if (bottle.vintage && bottle.maxKeepYears && bottle.maxKeepYears > 0) {
    return bottle.vintage + bottle.maxKeepYears;
  }
  return undefined;
}

export interface TastingStatusInfo {
  status: TastingStatus;
  label: string;
  detail: string;
  badgeClass: string;
}

export function computeTastingStatus(
  bottle: Bottle,
  currentYear: number = new Date().getFullYear(),
): TastingStatusInfo {
  const drinkFrom = bottle.drinkFrom && bottle.drinkFrom > 0 ? bottle.drinkFrom : undefined;
  const effectiveDrinkTo = getEffectiveDrinkTo(bottle);

  if (!drinkFrom && !effectiveDrinkTo) {
    return {
      status: 'inconnu',
      label: 'Non défini',
      detail: 'Fenêtre de dégustation à renseigner',
      badgeClass: 'bg-stone-800/80 text-stone-300 border-stone-700',
    };
  }

  if (effectiveDrinkTo !== undefined && currentYear > effectiveDrinkTo) {
    return {
      status: 'urgent',
      label: 'Urgent / Fin de garde',
      detail: `Apogée dépassée (fin ${effectiveDrinkTo})`,
      badgeClass: 'bg-red-950/90 text-red-200 border-red-700/70',
    };
  }

  if (effectiveDrinkTo !== undefined && currentYear >= effectiveDrinkTo - 1) {
    return {
      status: 'urgent',
      label: 'Urgent / Fin de garde',
      detail: `À boire avant fin ${effectiveDrinkTo}`,
      badgeClass: 'bg-orange-950/80 text-orange-200 border-orange-700/70',
    };
  }

  if (drinkFrom !== undefined && currentYear < drinkFrom) {
    return {
      status: 'a_garder',
      label: 'À garder',
      detail: `Apogée à partir de ${drinkFrom}`,
      badgeClass: 'bg-sky-950/80 text-sky-200 border-sky-800/70',
    };
  }

  return {
    status: 'apogee',
    label: 'À boire / Apogée',
    detail: effectiveDrinkTo
      ? `Fenêtre idéale jusqu'en ${effectiveDrinkTo}`
      : `À son apogée depuis ${drinkFrom}`,
    badgeClass: 'bg-emerald-950/80 text-emerald-200 border-emerald-700/70',
  };
}

export interface ReadingAlert {
  tempStatus: 'ok' | 'low' | 'high';
  humidityStatus: 'ok' | 'low' | 'high';
  hasAlert: boolean;
  messages: string[];
}

export function evaluateReading(reading: CellarReading, cellar: Cellar): ReadingAlert {
  const messages: string[] = [];
  let tempStatus: 'ok' | 'low' | 'high' = 'ok';
  let humidityStatus: 'ok' | 'low' | 'high' = 'ok';

  if (reading.temperature < cellar.idealTempMin) {
    tempStatus = 'low';
    messages.push(`Température trop basse (${reading.temperature}°C < ${cellar.idealTempMin}°C)`);
  } else if (reading.temperature > cellar.idealTempMax) {
    tempStatus = 'high';
    messages.push(`Température trop élevée (${reading.temperature}°C > ${cellar.idealTempMax}°C)`);
  }

  if (reading.humidity < cellar.idealHumidityMin) {
    humidityStatus = 'low';
    messages.push(`Hygrométrie trop basse (${reading.humidity}% < ${cellar.idealHumidityMin}%)`);
  } else if (reading.humidity > cellar.idealHumidityMax) {
    humidityStatus = 'high';
    messages.push(`Hygrométrie trop élevée (${reading.humidity}% > ${cellar.idealHumidityMax}%)`);
  }

  return {
    tempStatus,
    humidityStatus,
    hasAlert: tempStatus !== 'ok' || humidityStatus !== 'ok',
    messages,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
