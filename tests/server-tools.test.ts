import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { createMcpServer } from '../src/server.js';

const fixedNow = new Date('2026-08-27T08:00:00.000Z');

async function withTestClient(
  run: (client: Client) => Promise<void>,
  mode: 'local' | 'public' = 'local',
): Promise<void> {
  const server = createMcpServer({
    mode,
    environment: {},
    now: () => fixedNow,
    weatherFetcher: async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('warnsum')
            ? {}
            : {
                temperature: { data: [{ place: 'Hong Kong Observatory', value: 29 }], recordTime: '2026-08-27T16:00:00+08:00' },
                humidity: { data: [{ place: 'Hong Kong Observatory', value: 76 }] },
                icon: [51],
                updateTime: '2026-08-27T16:05:00+08:00',
              },
        ),
        { status: 200 },
      ),
    publicSourceFetcher: async () =>
      new Response('<html><body><h1>Library service update</h1><p>Open until 10:45pm.</p></body></html>', { status: 200 }),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'hkust-life-test-client', version: '0.1.0' });

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

describe('HKUST Life MCP tool registration', () => {
  it('advertises the student-life tool catalogue over MCP', async () => {
    await withTestClient(async (client) => {
      const response = await client.listTools();
      const names = response.tools.map((tool) => tool.name);

      expect(names).toEqual(
        expect.arrayContaining([
          'hkust_search_services',
          'hkust_get_weather',
          'hkust_get_daily_brief',
          'hkust_get_campus_updates',
          'hkust_plan_reminders',
          'hkust_account_status',
          'hkust_get_outlook_signals',
        ]),
      );
    });
  });

  it('returns only allow-listed official campus information from MCP tool calls', async () => {
    await withTestClient(async (client) => {
      const serviceSearch = await client.callTool({
        name: 'hkust_search_services',
        arguments: { query: 'where can I study tonight' },
      });
      const update = await client.callTool({
        name: 'hkust_get_campus_updates',
        arguments: { serviceId: 'library-hours' },
      });

      expect(JSON.stringify(serviceSearch.structuredContent)).toContain('library-hours');
      expect(JSON.stringify(update.structuredContent)).toContain('Library service update');
      expect(JSON.stringify(update.structuredContent)).toContain('library.hkust.edu.hk');
    });
  });

  it('exposes the student flows locally but omits private Outlook access from public mode', async () => {
    await withTestClient(async (client) => {
      const tools = await client.listTools();
      const checklist = await client.callTool({
        name: 'hkust_build_newcomer_checklist',
        arguments: { level: 'ug', residency: 'non_local', housing: 'not_arranged', intakeTerm: 'fall' },
      });

      expect(tools.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
        'hkust_build_today',
        'hkust_parse_ics_schedule',
        'hkust_list_skills',
      ]));
      expect(JSON.stringify(checklist.structuredContent)).toContain('arrange-housing');
    });

    await withTestClient(async (client) => {
      expect((await client.listTools()).tools.map((tool) => tool.name)).not.toContain('hkust_get_outlook_signals');
    }, 'public');
  });
});
