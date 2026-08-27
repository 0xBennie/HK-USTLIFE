import type { PlannableEvent, PlannableEventKind } from '../domain/types.js';

export class CalendarParseError extends Error {
  constructor(message = 'Calendar contains an invalid event date.') {
    super(message);
    this.name = 'CalendarParseError';
  }
}

type EventProperties = Record<string, string>;

function unfold(content: string): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseProperties(lines: string[]): EventProperties {
  const properties: EventProperties = {};

  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).split(';', 1)[0].toUpperCase();
    properties[key] = line.slice(separator + 1);
  }

  return properties;
}

function validateParts(year: number, month: number, day: number, hour: number, minute: number, second: number): void {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
    || date.getUTCSeconds() !== second
  ) {
    throw new CalendarParseError();
  }
}

function normalizeDateTime(value: string, timezone: string): string {
  if (timezone !== 'Asia/Hong_Kong') {
    throw new CalendarParseError('Only Asia/Hong_Kong local ICS imports are supported.');
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!match) throw new CalendarParseError();

  const [, yearText, monthText, dayText, hourText = '00', minuteText = '00', secondText = '00', utc] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText]
    .map((part) => Number(part));
  validateParts(year, month, day, hour, minute, second);

  if (utc) {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  }

  return `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}+08:00`;
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

function eventKind(properties: EventProperties): PlannableEventKind {
  const marker = properties['X-HKUST-KIND']?.toUpperCase() ?? '';
  return marker.includes('DEADLINE') || marker.includes('DUE') ? 'deadline' : 'class';
}

export function parseIcsCalendar(content: string, timezone: string): PlannableEvent[] {
  const lines = unfold(content);
  const events: PlannableEvent[] = [];
  let eventLines: string[] | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      eventLines = [];
      continue;
    }
    if (line === 'END:VEVENT' && eventLines) {
      const properties = parseProperties(eventLines);
      if (properties.DTSTART) {
        events.push({
          id: unescapeText(properties.UID ?? `local-event-${events.length + 1}`),
          title: unescapeText(properties.SUMMARY ?? 'Untitled calendar event'),
          kind: eventKind(properties),
          startsAt: normalizeDateTime(properties.DTSTART, timezone),
          source: 'student_calendar',
        });
      }
      eventLines = null;
      continue;
    }
    if (eventLines) eventLines.push(line);
  }

  return events.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}
