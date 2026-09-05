const OPEN_HOUR = 8;
const SHORT_DAYS = [4, 5]; // Thursday, Friday
const SHORT_CLOSE_HOUR = 11;
const NORMAL_CLOSE_HOUR = 15;

function closeHourFor(day) {
  return SHORT_DAYS.includes(day) ? SHORT_CLOSE_HOUR : NORMAL_CLOSE_HOUR;
}

export function isOpenNow(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60;
  return hour >= OPEN_HOUR && hour < closeHourFor(date.getDay());
}

function nextOpenDate(date = new Date()) {
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + i);
    candidate.setHours(OPEN_HOUR, 0, 0, 0);
    if (candidate > date) return candidate;
  }
  return null;
}

export function formatNextOpen(date = new Date()) {
  const next = nextOpenDate(date);
  if (!next) return "";

  const dayLabel =
    next.toDateString() === date.toDateString()
      ? "today"
      : next.toLocaleDateString("en-US", { weekday: "long" });
  const timeLabel = next.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `Opens ${dayLabel} at ${timeLabel}`;
}
