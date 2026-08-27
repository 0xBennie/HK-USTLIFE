import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type Fetcher, getHongKongWeather } from './adapters/hko-weather.js';
import { type GraphFetcher, getOutlookSignals } from './adapters/graph-outlook.js';
import { parseIcsCalendar } from './adapters/ics-calendar.js';
import { type PublicSourceFetcher, getPublicCampusUpdate } from './adapters/public-source.js';
import { listSkills } from './data/skills-catalog.js';
import { findCampusService } from './data/source-registry.js';
import { getAccountStatus, type TokenEnvironment } from './domain/account-status.js';
import { planCourseSchedule, type CourseOffering, type CoursePlanningPreferences } from './domain/course-planner.js';
import { buildDailyBrief } from './domain/daily-brief.js';
import { buildNewcomerChecklist, type NewcomerProfile } from './domain/newcomer-checklist.js';
import { sourceProvenance } from './domain/provenance.js';
import { defaultReminderRules, planReminders } from './domain/reminder-plan.js';
import { searchCampusServices } from './domain/source-search.js';
import { buildToday } from './domain/today.js';

const plannableEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['class', 'deadline', 'event']),
  startsAt: z.string().datetime({ offset: true }),
  source: z.enum(['manual', 'student_calendar', 'canvas', 'outlook']),
});

const sourceSearchInputSchema = { query: z.string().min(2).max(200) };
const dailyBriefInputSchema = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  events: z.array(plannableEventSchema).max(100).default([]),
};
const campusUpdateInputSchema = { serviceId: z.string().min(1) };
const reminderInputSchema = { events: z.array(plannableEventSchema).min(1).max(100) };
const newcomerInputSchema = {
  level: z.enum(['ug', 'rpg']),
  residency: z.enum(['local', 'non_local', 'exchange']),
  housing: z.enum(['on_campus', 'off_campus', 'not_arranged']),
  intakeTerm: z.enum(['fall', 'spring']),
};
const icsInputSchema = { content: z.string().min(1).max(1_000_000), timezone: z.literal('Asia/Hong_Kong').default('Asia/Hong_Kong') };
const todayInputSchema = { events: z.array(plannableEventSchema).max(100).default([]), serviceIds: z.array(z.string().min(1)).max(20).default([]) };
const weekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const courseMeetingSchema = z.object({
  day: weekdaySchema,
  startsAt: z.string().regex(/^\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/),
  venue: z.string().max(120).optional(),
});
const courseSectionSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  meetings: z.array(courseMeetingSchema).max(12),
});
const courseChoiceSchema = z.object({
  id: z.string().min(1).max(80),
  sectionIds: z.array(z.string().min(1).max(80)).min(1).max(12),
  quotaAvailable: z.number().int().min(0).optional(),
  note: z.string().max(500).optional(),
});
const coursePlannerInputSchema = {
  courses: z.array(z.object({
    courseCode: z.string().min(2).max(40),
    title: z.string().min(1).max(240),
    credits: z.number().positive().max(30),
    required: z.boolean().default(true),
    sourceId: z.enum(['aro-class-schedule', 'aro-course-catalog']),
    sections: z.array(courseSectionSchema).min(1).max(80),
    choices: z.array(courseChoiceSchema).min(1).max(80),
    matchingRules: z.array(z.object({
      triggerSectionId: z.string().min(1).max(80),
      requiresSectionIds: z.array(z.string().min(1).max(80)).min(1).max(12),
      description: z.string().min(1).max(300),
    })).max(40).optional(),
  })).min(1).max(15),
  preferences: z.object({
    preferredFreeDays: z.array(weekdaySchema).max(7).optional(),
    earliestStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    latestEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    avoidTimes: z.array(courseMeetingSchema).max(30).optional(),
    targetCredits: z.number().positive().max(100).optional(),
    maxPlans: z.number().int().min(1).max(20).optional(),
  }).optional(),
};

type CoursePlannerToolInput = {
  courses: Array<Omit<CourseOffering, 'source'> & { sourceId: 'aro-class-schedule' | 'aro-course-catalog' }>;
  preferences?: CoursePlanningPreferences;
};

export type McpMode = 'local' | 'public';

export interface ServerDependencies {
  mode?: McpMode;
  environment?: TokenEnvironment;
  now?: () => Date;
  weatherFetcher?: Fetcher;
  publicSourceFetcher?: PublicSourceFetcher;
  graphFetcher?: GraphFetcher;
}

function asToolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function asToolError(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

function hongKongDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function createMcpServer(dependencies: ServerDependencies = {}): McpServer {
  const server = new McpServer({ name: 'hkust-life-mcp', version: '0.1.0' });
  const mode = dependencies.mode ?? 'local';
  const environment: TokenEnvironment = dependencies.environment ?? {
    HKUST_GRAPH_ACCESS_TOKEN: process.env.HKUST_GRAPH_ACCESS_TOKEN,
    HKUST_MCP_API_KEY: process.env.HKUST_MCP_API_KEY,
  };
  const now = dependencies.now ?? (() => new Date());

  server.registerTool(
    'hkust_search_services',
    {
      title: 'Find an official HKUST service',
      description: 'Search the allow-listed Clear Water Bay campus source registry. Returns the responsible office and official link.',
      inputSchema: sourceSearchInputSchema as any,
    },
    ({ query }: { query: string }) => asToolResult({ query, services: searchCampusServices(query) }),
  );

  server.registerTool(
    'hkust_list_skills',
    {
      title: 'List HKUST student Skills',
      description: 'List the installable Clear Water Bay student Skills and the public MCP tools each one uses.',
    },
    () => asToolResult({ skills: listSkills() }),
  );

  server.registerTool(
    'hkust_build_newcomer_checklist',
    {
      title: 'Build a HKUST newcomer checklist',
      description: 'Create a source-linked Clear Water Bay first-week checklist from study, residency and housing context.',
      inputSchema: newcomerInputSchema as any,
    },
    (profile: NewcomerProfile) => asToolResult({ checklist: buildNewcomerChecklist(profile) }),
  );

  server.registerTool(
    'hkust_build_today',
    {
      title: 'Build a student Today brief',
      description: 'Combine live weather, a supplied schedule and declared campus services into a source-attributed daily plan.',
      inputSchema: todayInputSchema as any,
    },
    async ({ events, serviceIds }: { events: Array<{ id: string; title: string; kind: 'class' | 'deadline' | 'event'; startsAt: string; source: 'manual' | 'student_calendar' | 'canvas' | 'outlook' }>; serviceIds: string[] }) => {
      const requestNow = now();
      return asToolResult({
        today: buildToday({
          now: requestNow,
          weather: await getHongKongWeather(dependencies.weatherFetcher, requestNow),
          events,
          serviceFacts: serviceIds.map(findCampusService),
        }),
      });
    },
  );

  server.registerTool(
    'hkust_plan_course_schedule',
    {
      title: 'Plan a HKUST course schedule',
      description: 'Rank conflict-free course-section combinations from official ARO material and student preferences. Planning only: it cannot reserve a place or change SIS enrolment.',
      inputSchema: coursePlannerInputSchema as any,
    },
    ({ courses, preferences }: CoursePlannerToolInput) => {
      const observedAt = now().toISOString();
      return asToolResult({
        coursePlan: planCourseSchedule({
          courses: courses.map(({ sourceId, ...course }) => ({
            ...course,
            source: sourceProvenance(findCampusService(sourceId), observedAt, 'static-link'),
          })),
          preferences,
        }),
      });
    },
  );

  if (mode === 'local') {
    server.registerTool(
      'hkust_parse_ics_schedule',
      {
        title: 'Parse a local ICS schedule',
        description: 'Normalize caller-provided local ICS calendar text without uploading or persisting it.',
        inputSchema: icsInputSchema as any,
      },
      ({ content, timezone }: { content: string; timezone: 'Asia/Hong_Kong' }) =>
        asToolResult({ events: parseIcsCalendar(content, timezone) }),
    );
  }

  server.registerTool(
    'hkust_get_weather',
    {
      title: 'Get Hong Kong weather for campus life',
      description: 'Retrieve live Hong Kong Observatory weather and active warnings with source URLs and fetched time.',
    },
    async () => asToolResult({ weather: await getHongKongWeather(dependencies.weatherFetcher, now()) }),
  );

  server.registerTool(
    'hkust_get_daily_brief',
    {
      title: 'Create a HKUST daily brief',
      description: 'Combine live HKO weather with a caller-supplied, read-only schedule. This tool does not read SIS or alter a calendar.',
      inputSchema: dailyBriefInputSchema as any,
    },
    async ({ date, events }: { date?: string; events: Array<{ id: string; title: string; kind: 'class' | 'deadline' | 'event'; startsAt: string; source: 'manual' | 'student_calendar' | 'canvas' | 'outlook' }> }) => {
      const weather = await getHongKongWeather(dependencies.weatherFetcher, now());
      return asToolResult(
        { brief: buildDailyBrief({
          date: date ?? hongKongDate(now()),
          generatedAt: now().toISOString(),
          weather,
          events,
        }) },
      );
    },
  );

  server.registerTool(
    'hkust_get_campus_updates',
    {
      title: 'Read an official campus source update',
      description: 'Fetch and summarize text from one allow-listed official Clear Water Bay campus source. It cannot fetch arbitrary URLs.',
      inputSchema: campusUpdateInputSchema as any,
    },
    async ({ serviceId }: { serviceId: string }) => {
      try {
        return asToolResult({ update: await getPublicCampusUpdate(serviceId, dependencies.publicSourceFetcher, now()) });
      } catch (error) {
        return asToolError(error instanceof Error ? error.message : 'Unable to read the official campus source.');
      }
    },
  );

  server.registerTool(
    'hkust_plan_reminders',
    {
      title: 'Plan student reminders',
      description: 'Propose deduplicated Hong Kong-timezone reminders for classes and deadlines. It does not send notifications.',
      inputSchema: reminderInputSchema as any,
    },
    ({ events }: { events: Array<{ id: string; title: string; kind: 'class' | 'deadline' | 'event'; startsAt: string; source: 'manual' | 'student_calendar' | 'canvas' | 'outlook' }> }) => asToolResult({ timezone: 'Asia/Hong_Kong', reminders: planReminders(events, defaultReminderRules, 'Asia/Hong_Kong') }),
  );

  server.registerTool(
    'hkust_account_status',
    {
      title: 'Check personal connector readiness',
      description: 'Report read-only Outlook, Canvas and SIS connector state without exposing or accepting credentials.',
    },
    () => asToolResult({ connectors: getAccountStatus(environment) }),
  );

  if (mode === 'local') {
    server.registerTool(
      'hkust_get_outlook_signals',
      {
        title: 'Get minimal Outlook signals',
        description: 'After delegated consent, retrieve basic e-mail headers and basic calendar fields. It never reads mail body or attachments.',
      },
      async () => {
        const accessToken = environment.HKUST_GRAPH_ACCESS_TOKEN;
        if (!accessToken) {
          return asToolError('Outlook is not connected. Use hkust_account_status for the delegated-consent requirement; never provide a password or MFA code to this server.');
        }

        try {
          return asToolResult({ signals: await getOutlookSignals(accessToken, dependencies.graphFetcher, now()) });
        } catch (error) {
          return asToolError(error instanceof Error ? error.message : 'Unable to retrieve read-only Outlook signals.');
        }
      },
    );
  }

  return server;
}
