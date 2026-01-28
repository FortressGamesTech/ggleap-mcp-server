#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GGLeapAuth } from './auth.js';

let auth: GGLeapAuth | null = null;

const server = new Server(
  { name: 'ggleap-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ggleap_configure',
        description: 'Configure GGLeap API authentication',
        inputSchema: {
          type: 'object',
          properties: {
            authToken: { type: 'string', description: 'Auth token from admin panel' },
            environment: { type: 'string', enum: ['production', 'beta'], default: 'production' }
          },
          required: ['authToken']
        }
      },
      {
        name: 'ggleap_list_machines',
        description: 'Get all gaming PCs with their current status',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'ggleap_get_user',
        description: 'Get user details by UUID, username, or email',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' }
          }
        }
      },
      {
        name: 'ggleap_create_user',
        description: 'Create a new user account',
        inputSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Unique username' },
            email: { type: 'string', description: 'Email address' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phoneNumber: { type: 'string' }
          },
          required: ['username', 'email']
        }
      },
      {
        name: 'ggleap_add_user_balance',
        description: 'Add balance/credits to a user account',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID' },
            amount: { type: 'number', description: 'Amount to add' }
          },
          required: ['userUuid', 'amount']
        }
      },
      {
        name: 'ggleap_get_user_balance',
        description: 'Get user coin/credit balance',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID' }
          },
          required: ['userUuid']
        }
      },
      {
        name: 'ggleap_list_bookings',
        description: 'List bookings with optional date filters',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
            days: { type: 'number', description: 'Number of days to include' },
            includePast: { type: 'boolean', description: 'Include past bookings' }
          }
        }
      },
      {
        name: 'ggleap_create_booking',
        description: 'Create a new booking for gaming sessions',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Booking name' },
            startLocal: { type: 'string', description: 'Start time (ISO-8601)' },
            duration: { type: 'number', description: 'Duration in minutes' },
            machines: { type: 'array', items: { type: 'string' }, description: 'Machine UUIDs' },
            userUuid: { type: 'string' },
            guestName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' }
          },
          required: ['name', 'startLocal', 'duration', 'machines']
        }
      },
      {
        name: 'ggleap_search_activity_logs',
        description: 'Search activity logs with filters',
        inputSchema: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date (ISO-8601)' },
            end: { type: 'string', description: 'End date (ISO-8601)' },
            limit: { type: 'number', description: 'Max results (default 100)' }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'ggleap_configure') {
      const { authToken, environment = 'production' } = args as any;
      const baseUrl = environment === 'beta' ? 'https://api.ggleap.com/beta' : 'https://api.ggleap.com/production';
      auth = new GGLeapAuth(authToken, baseUrl);
      await auth.refreshJWT();
      return { content: [{ type: 'text', text: 'GGLeap configured successfully' }] };
    }

    if (!auth) {
      return { content: [{ type: 'text', text: 'Error: Please call ggleap_configure first' }], isError: true };
    }

    switch (name) {
      case 'ggleap_list_machines': {
        const response = await auth.request('/machines/get-all');
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_get_user': {
        const { uuid, username, email } = args as any;
        const params = new URLSearchParams();
        if (uuid) params.append('Uuid', uuid);
        if (username) params.append('Username', username);
        if (email) params.append('Email', email);
        if (!params.toString()) throw new Error('Must provide uuid, username, or email');
        const response = await auth.request(`/users/user-details?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_create_user': {
        const correlationId = crypto.randomUUID();
        const response = await auth.request('/users/create', {
          method: 'POST',
          headers: { 'X-Correlation-Id': correlationId },
          body: JSON.stringify({ User: args })
        });
        return { content: [{ type: 'text', text: `User created: ${JSON.stringify(response, null, 2)}` }] };
      }

      case 'ggleap_add_user_balance': {
        const { userUuid, amount } = args as any;
        const correlationId = crypto.randomUUID();
        await auth.request('/users/add-balance', {
          method: 'POST',
          headers: { 'X-Correlation-Id': correlationId },
          body: JSON.stringify({ UserUuid: userUuid, Amount: amount })
        });
        return { content: [{ type: 'text', text: `Added $${amount} to user ${userUuid}` }] };
      }

      case 'ggleap_get_user_balance': {
        const { userUuid } = args as any;
        const response = await auth.request(`/coins/balance?UserUuid=${userUuid}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_list_bookings': {
        const { date, days, includePast } = args as any;
        const params = new URLSearchParams();
        if (date) params.append('Date', date);
        if (days) params.append('Days', days.toString());
        if (includePast) params.append('IncludePast', 'true');
        const response = await auth.request(`/bookings/get-bookings?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_create_booking': {
        const response = await auth.request('/bookings/create', {
          method: 'POST',
          body: JSON.stringify(args)
        });
        return { content: [{ type: 'text', text: `Booking created: ${JSON.stringify(response, null, 2)}` }] };
      }

      case 'ggleap_search_activity_logs': {
        const { start, end, limit = 100 } = args as any;
        const params = new URLSearchParams();
        if (start) params.append('Start', start);
        if (end) params.append('End', end);
        params.append('Limit', limit.toString());
        const response = await auth.request(`/activity-logs/search?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GGLeap MCP Server running');
}

main().catch(console.error);