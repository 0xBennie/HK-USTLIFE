export interface HubAction {
  label: string;
  description: string;
  href: string;
  tag: string;
}

export interface ConnectorStatus {
  name: string;
  status: string;
  detail: string;
}

export function renderHomeModel(): { primaryAction: HubAction; actions: HubAction[] } {
  return {
    primaryAction: {
      label: 'I just arrived',
      description: 'Answer four small questions. Get only the first-week tasks that apply to you.',
      href: '/start',
      tag: 'Start here',
    },
    actions: [
      {
        label: 'Plan today',
        description: 'Turn a confirmed timetable, weather and deadlines into a calm next-action list.',
        href: '/skills/hkust-today',
        tag: 'Daily life',
      },
      {
        label: 'Plan my timetable',
        description: 'Read a screenshot in your agent, then compare official course sections around your constraints.',
        href: '/plan',
        tag: 'Courses',
      },
      {
        label: 'Is it open?',
        description: 'Find the official owner for campus services, routes, weather and disruptions.',
        href: '/skills/hkust-campus-status',
        tag: 'Campus now',
      },
      {
        label: 'Find an opportunity',
        description: 'Locate source-linked events, careers, exchange and scholarships without noisy search results.',
        href: '/skills/hkust-opportunities',
        tag: 'Beyond class',
      },
      {
        label: 'Browse every Skill',
        description: 'Install a focused workflow in Codex or another compatible agent.',
        href: '/skills',
        tag: 'For agents',
      },
    ],
  };
}

export function renderConnectModel(): { privateDataNotice: string; connectors: ConnectorStatus[] } {
  return {
    privateDataNotice: 'We never ask for your password, MFA code, cookie, QR login or SIS credential.',
    connectors: [
      {
        name: 'Timetable screenshot',
        status: 'ready locally',
        detail: 'Your current agent reads the image; it is not uploaded to the Hub.',
      },
      {
        name: 'Outlook',
        status: 'pending HKUST consent',
        detail: 'A future connection needs per-user OAuth and approved HKUST tenant permission.',
      },
      {
        name: 'Canvas',
        status: 'institutional approval required',
        detail: 'No production Canvas connection is available until the system owner approves an API contract.',
      },
      {
        name: 'SIS',
        status: 'institutional approval required',
        detail: 'Planning is available; no tool can read, add, drop or submit enrolment.',
      },
    ],
  };
}

export function renderPlanModel(): { screenshotNotice: string; enrollmentNotice: string } {
  return {
    screenshotNotice: 'A timetable screenshot is read by your current agent and is not uploaded to the Hub or public MCP.',
    enrollmentNotice: 'The planner never reserves a quota or registers a class. Recheck official ARO data, then submit in SIS yourself.',
  };
}
