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
      },
      // BATCH 1: Bookings Extensions
      {
        name: 'ggleap_update_booking',
        description: 'Update an existing booking',
        inputSchema: {
          type: 'object',
          properties: {
            bookingUuid: { type: 'string', description: 'Booking UUID' },
            name: { type: 'string', description: 'Booking name' },
            startLocal: { type: 'string', description: 'Start time (ISO-8601)' },
            duration: { type: 'number', description: 'Duration in minutes' },
            machines: { type: 'array', items: { type: 'string' }, description: 'Machine UUIDs' }
          },
          required: ['bookingUuid']
        }
      },
      {
        name: 'ggleap_finish_booking',
        description: 'Mark a booking as finished',
        inputSchema: {
          type: 'object',
          properties: {
            bookingUuid: { type: 'string', description: 'Booking UUID' }
          },
          required: ['bookingUuid']
        }
      },
      {
        name: 'ggleap_delete_booking',
        description: 'Delete (cancel) a booking',
        inputSchema: {
          type: 'object',
          properties: {
            bookingUuid: { type: 'string', description: 'Booking UUID' },
            deleteReason: { type: 'string', description: 'Reason for deletion' }
          },
          required: ['bookingUuid']
        }
      },
      {
        name: 'ggleap_get_available_machines',
        description: 'Get available PCs for booking at a specific time',
        inputSchema: {
          type: 'object',
          properties: {
            startLocal: { type: 'string', description: 'Start time (ISO-8601)' },
            duration: { type: 'number', description: 'Duration in minutes' },
            quantity: { type: 'number', description: 'Number of machines needed' },
            pcGroupUuid: { type: 'string', description: 'PC group UUID filter' }
          },
          required: ['startLocal', 'duration']
        }
      },
      {
        name: 'ggleap_reassign_booked_machine',
        description: 'Reassign a booked machine to another available machine',
        inputSchema: {
          type: 'object',
          properties: {
            machineUuid: { type: 'string', description: 'Machine UUID to reassign' },
            bookingUuids: { type: 'array', items: { type: 'string' }, description: 'Booking UUIDs affected' }
          },
          required: ['machineUuid', 'bookingUuids']
        }
      },
      // BATCH 2: User Management Extensions
      {
        name: 'ggleap_upsert_user',
        description: 'Update or create center user',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'User UUID (null to create new)' },
            username: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phoneNumber: { type: 'string' }
          }
        }
      },
      {
        name: 'ggleap_delete_user',
        description: 'Soft delete user',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'User UUID' }
          },
          required: ['uuid']
        }
      },
      {
        name: 'ggleap_undelete_user',
        description: 'Undelete soft deleted user',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'User UUID' }
          },
          required: ['uuid']
        }
      },
      {
        name: 'ggleap_get_deleted_users',
        description: 'Get all deleted users',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'ggleap_add_user_play_time',
        description: 'Add play time to user account',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID' },
            seconds: { type: 'number', description: 'Seconds to add' }
          },
          required: ['userUuid', 'seconds']
        }
      },
      {
        name: 'ggleap_get_user_summaries',
        description: 'Get paged user summaries',
        inputSchema: {
          type: 'object',
          properties: {
            paginationToken: { type: 'string', description: 'Pagination token' }
          }
        }
      },
      {
        name: 'ggleap_get_all_user_balances',
        description: 'Get coin balances for all users in center',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'ggleap_get_user_smart_card',
        description: 'Get user smart card UID',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID' }
          },
          required: ['userUuid']
        }
      },
      {
        name: 'ggleap_update_user_smart_card',
        description: 'Update user smart card UID',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID' },
            smartCardUid: { type: 'string', description: 'Smart card UID' }
          },
          required: ['userUuid', 'smartCardUid']
        }
      },
      {
        name: 'ggleap_get_user_gamepasses',
        description: 'Get user game passes',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID' }
          },
          required: ['userUuid']
        }
      },
      // BATCH 3: Products & POS
      {
        name: 'ggleap_get_all_products',
        description: 'Get all products in the POS system',
        inputSchema: {
          type: 'object',
          properties: {
            partnerCenterUuid: { type: 'string', description: 'Partner center UUID filter' }
          }
        }
      },
      {
        name: 'ggleap_add_product',
        description: 'Add a new product',
        inputSchema: {
          type: 'object',
          properties: {
            productUuid: { type: 'string', description: 'Product UUID' },
            name: { type: 'string', description: 'Product name' },
            categoryUuid: { type: 'string', description: 'Category UUID' },
            price: { type: 'number', description: 'Product price' },
            availableForQuickSale: { type: 'boolean' },
            availableForClientsOrders: { type: 'boolean' }
          },
          required: ['productUuid', 'name']
        }
      },
      {
        name: 'ggleap_update_product',
        description: 'Update an existing product',
        inputSchema: {
          type: 'object',
          properties: {
            productUuid: { type: 'string', description: 'Product UUID' },
            name: { type: 'string', description: 'Product name' },
            price: { type: 'number', description: 'Product price' },
            availableForQuickSale: { type: 'boolean' },
            availableForClientsOrders: { type: 'boolean' }
          },
          required: ['productUuid']
        }
      },
      {
        name: 'ggleap_delete_product',
        description: 'Delete a product',
        inputSchema: {
          type: 'object',
          properties: {
            productUuid: { type: 'string', description: 'Product UUID' }
          },
          required: ['productUuid']
        }
      },
      {
        name: 'ggleap_reorder_products',
        description: 'Reorder products',
        inputSchema: {
          type: 'object',
          properties: {
            productUuids: { type: 'array', items: { type: 'string' }, description: 'Ordered product UUIDs' }
          },
          required: ['productUuids']
        }
      },
      {
        name: 'ggleap_update_product_stock',
        description: 'Update product or game pass stock count',
        inputSchema: {
          type: 'object',
          properties: {
            productUuid: { type: 'string', description: 'Product or game pass UUID' },
            stockCount: { type: 'number', description: 'New stock count' }
          },
          required: ['productUuid', 'stockCount']
        }
      },
      {
        name: 'ggleap_add_gamepass',
        description: 'Add a new game pass',
        inputSchema: {
          type: 'object',
          properties: {
            offerUuid: { type: 'string', description: 'Game pass UUID' },
            name: { type: 'string', description: 'Game pass name' },
            price: { type: 'number', description: 'Game pass price' },
            seconds: { type: 'number', description: 'Duration in seconds' }
          },
          required: ['offerUuid', 'name']
        }
      },
      {
        name: 'ggleap_update_gamepass',
        description: 'Update an existing game pass',
        inputSchema: {
          type: 'object',
          properties: {
            offerUuid: { type: 'string', description: 'Game pass UUID' },
            name: { type: 'string', description: 'Game pass name' },
            price: { type: 'number', description: 'Game pass price' },
            seconds: { type: 'number', description: 'Duration in seconds' }
          },
          required: ['offerUuid']
        }
      },
      {
        name: 'ggleap_delete_gamepass',
        description: 'Delete a game pass',
        inputSchema: {
          type: 'object',
          properties: {
            offerUuid: { type: 'string', description: 'Game pass UUID' }
          },
          required: ['offerUuid']
        }
      },
      {
        name: 'ggleap_reorder_gamepasses',
        description: 'Reorder game passes',
        inputSchema: {
          type: 'object',
          properties: {
            offerUuids: { type: 'array', items: { type: 'string' }, description: 'Ordered game pass UUIDs' }
          },
          required: ['offerUuids']
        }
      },
      {
        name: 'ggleap_add_gamepass_to_user',
        description: 'Add a game pass to a user',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID' },
            productUuid: { type: 'string', description: 'Game pass product UUID' },
            seconds: { type: 'number', description: 'Duration in seconds' }
          },
          required: ['userUuid', 'productUuid']
        }
      },
      {
        name: 'ggleap_remove_gamepass_from_user',
        description: 'Remove a game pass from a user',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID' },
            offerUuid: { type: 'string', description: 'Game pass UUID to remove' }
          },
          required: ['userUuid', 'offerUuid']
        }
      },
      {
        name: 'ggleap_create_sale',
        description: 'Sell products to a user or guest',
        inputSchema: {
          type: 'object',
          properties: {
            cart: { type: 'object', description: 'Product UUID to quantity map' },
            userUuid: { type: 'string', description: 'User UUID (for registered users)' },
            guestName: { type: 'string', description: 'Guest name (for walk-ins)' }
          },
          required: ['cart']
        }
      },
      // BATCH 4: Supporting Features
      {
        name: 'ggleap_get_all_consoles',
        description: 'Get all consoles',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'ggleap_console_user_action',
        description: 'Login or logout a user from a console',
        inputSchema: {
          type: 'object',
          properties: {
            deviceUuid: { type: 'string', description: 'Console UUID' },
            action: { type: 'string', enum: ['login', 'logout'], description: 'Action to perform' },
            userUuid: { type: 'string', description: 'User UUID (for login)' }
          },
          required: ['deviceUuid', 'action']
        }
      },
      {
        name: 'ggleap_list_coupons',
        description: 'Get coupons',
        inputSchema: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'User UUID for personal coupons' },
            bookingUuid: { type: 'string', description: 'Booking UUID for booking coupons' }
          }
        }
      },
      {
        name: 'ggleap_get_coupon',
        description: 'Get coupon details',
        inputSchema: {
          type: 'object',
          properties: {
            couponUuid: { type: 'string', description: 'Coupon UUID' },
            userUuid: { type: 'string', description: 'User UUID for personal coupons' }
          },
          required: ['couponUuid']
        }
      },
      {
        name: 'ggleap_delete_coupon',
        description: 'Delete a coupon',
        inputSchema: {
          type: 'object',
          properties: {
            couponUuid: { type: 'string', description: 'Coupon UUID' },
            userUuid: { type: 'string', description: 'User UUID for personal coupons' }
          },
          required: ['couponUuid']
        }
      },
      {
        name: 'ggleap_get_enabled_apps',
        description: 'Get all enabled apps/games for the center',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'ggleap_transaction_history',
        description: 'Get transaction history with pagination',
        inputSchema: {
          type: 'object',
          properties: {
            paginationToken: { type: 'string', description: 'Pagination token' },
            limit: { type: 'number', description: 'Max results' }
          }
        }
      },
      {
        name: 'ggleap_search_transactions',
        description: 'Search transactions with filters',
        inputSchema: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date (ISO-8601)' },
            end: { type: 'string', description: 'End date (ISO-8601)' },
            limit: { type: 'number', description: 'Max results' },
            paginationToken: { type: 'string', description: 'Pagination token' }
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
        const response = await auth.request(`/coins/balance?UserUuids[]=${userUuid}`);
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

      // BATCH 1: Bookings Extensions Handlers
      case 'ggleap_update_booking': {
        const response = await auth.request('/bookings/update', {
          method: 'POST',
          body: JSON.stringify(args)
        });
        return { content: [{ type: 'text', text: 'Booking updated successfully' }] };
      }

      case 'ggleap_finish_booking': {
        const { bookingUuid } = args as any;
        await auth.request('/bookings/finish', {
          method: 'POST',
          body: JSON.stringify({ BookingUuid: bookingUuid })
        });
        return { content: [{ type: 'text', text: `Booking ${bookingUuid} finished` }] };
      }

      case 'ggleap_delete_booking': {
        const { bookingUuid, deleteReason } = args as any;
        await auth.request('/bookings/delete', {
          method: 'POST',
          body: JSON.stringify({ BookingUuid: bookingUuid, DeleteReasonText: deleteReason })
        });
        return { content: [{ type: 'text', text: `Booking ${bookingUuid} deleted` }] };
      }

      case 'ggleap_get_available_machines': {
        const response = await auth.request('/bookings/get-available-machines', {
          method: 'POST',
          body: JSON.stringify(args)
        });
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_reassign_booked_machine': {
        const { machineUuid, bookingUuids } = args as any;
        const response = await auth.request('/bookings/reassign-booked-machine', {
          method: 'POST',
          body: JSON.stringify({ MachineUuid: machineUuid, BookingUuids: bookingUuids })
        });
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      // BATCH 2: User Management Handlers
      case 'ggleap_upsert_user': {
        const response = await auth.request('/users/upsert', {
          method: 'POST',
          body: JSON.stringify({ User: args })
        });
        return { content: [{ type: 'text', text: `User upserted: ${JSON.stringify(response, null, 2)}` }] };
      }

      case 'ggleap_delete_user': {
        const { uuid } = args as any;
        await auth.request(`/users/delete?Uuid=${uuid}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `User ${uuid} deleted` }] };
      }

      case 'ggleap_undelete_user': {
        const { uuid } = args as any;
        await auth.request('/users/undelete', {
          method: 'POST',
          body: JSON.stringify({ UserUuid: uuid })
        });
        return { content: [{ type: 'text', text: `User ${uuid} undeleted` }] };
      }

      case 'ggleap_get_deleted_users': {
        const response = await auth.request('/users/get-deleted');
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_add_user_play_time': {
        const { userUuid, seconds } = args as any;
        const correlationId = crypto.randomUUID();
        await auth.request('/users/add-play-time', {
          method: 'POST',
          headers: { 'X-Correlation-Id': correlationId },
          body: JSON.stringify({ UserUuid: userUuid, Seconds: seconds })
        });
        return { content: [{ type: 'text', text: `Added ${seconds} seconds to user ${userUuid}` }] };
      }

      case 'ggleap_get_user_summaries': {
        const { paginationToken } = args as any;
        const params = new URLSearchParams();
        if (paginationToken) params.append('PaginationToken', paginationToken);
        const response = await auth.request(`/users/summaries?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_get_all_user_balances': {
        const response = await auth.request('/coins/all-balances');
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_get_user_smart_card': {
        const { userUuid } = args as any;
        const response = await auth.request(`/users/get-smart-card-uid?UserUuid=${userUuid}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_update_user_smart_card': {
        const { userUuid, smartCardUid } = args as any;
        await auth.request('/users/update-smart-card-uid', {
          method: 'POST',
          body: JSON.stringify({ UserUuid: userUuid, SmartCardUid: smartCardUid })
        });
        return { content: [{ type: 'text', text: `Smart card updated for user ${userUuid}` }] };
      }

      case 'ggleap_get_user_gamepasses': {
        const { userUuid } = args as any;
        const response = await auth.request(`/users/gamepasses/get?UserUuid=${userUuid}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      // BATCH 3: Products & POS Handlers
      case 'ggleap_get_all_products': {
        const { partnerCenterUuid } = args as any;
        const params = new URLSearchParams();
        if (partnerCenterUuid) params.append('PartnerCenterUuid', partnerCenterUuid);
        const response = await auth.request(`/pos/products/get-all?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_add_product': {
        await auth.request('/pos/products/add', {
          method: 'PUT',
          body: JSON.stringify(args)
        });
        return { content: [{ type: 'text', text: 'Product added successfully' }] };
      }

      case 'ggleap_update_product': {
        await auth.request('/pos/products/update', {
          method: 'POST',
          body: JSON.stringify(args)
        });
        return { content: [{ type: 'text', text: 'Product updated successfully' }] };
      }

      case 'ggleap_delete_product': {
        const { productUuid } = args as any;
        await auth.request(`/pos/products/delete?ProductUuid=${productUuid}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Product ${productUuid} deleted` }] };
      }

      case 'ggleap_reorder_products': {
        const { productUuids } = args as any;
        await auth.request('/pos/products/reorder', {
          method: 'POST',
          body: JSON.stringify({ ItemsUuids: productUuids })
        });
        return { content: [{ type: 'text', text: 'Products reordered successfully' }] };
      }

      case 'ggleap_update_product_stock': {
        const { productUuid, stockCount } = args as any;
        await auth.request('/pos/products/update-stock', {
          method: 'POST',
          body: JSON.stringify({ ProductUuid: productUuid, StockCount: stockCount })
        });
        return { content: [{ type: 'text', text: `Stock updated for product ${productUuid}` }] };
      }

      case 'ggleap_add_gamepass': {
        await auth.request('/pos/gamepasses/add', {
          method: 'PUT',
          body: JSON.stringify(args)
        });
        return { content: [{ type: 'text', text: 'Game pass added successfully' }] };
      }

      case 'ggleap_update_gamepass': {
        await auth.request('/pos/gamepasses/update', {
          method: 'POST',
          body: JSON.stringify(args)
        });
        return { content: [{ type: 'text', text: 'Game pass updated successfully' }] };
      }

      case 'ggleap_delete_gamepass': {
        const { offerUuid } = args as any;
        await auth.request(`/pos/gamepasses/delete?OfferUuid=${offerUuid}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Game pass ${offerUuid} deleted` }] };
      }

      case 'ggleap_reorder_gamepasses': {
        const { offerUuids } = args as any;
        await auth.request('/pos/gamepasses/reorder', {
          method: 'POST',
          body: JSON.stringify({ ItemsUuids: offerUuids })
        });
        return { content: [{ type: 'text', text: 'Game passes reordered successfully' }] };
      }

      case 'ggleap_add_gamepass_to_user': {
        const { userUuid, productUuid, seconds } = args as any;
        const correlationId = crypto.randomUUID();
        await auth.request('/users/gamepasses/add', {
          method: 'POST',
          headers: { 'X-Correlation-Id': correlationId },
          body: JSON.stringify({ UserUuid: userUuid, ProductUuid: productUuid, Seconds: seconds })
        });
        return { content: [{ type: 'text', text: `Game pass added to user ${userUuid}` }] };
      }

      case 'ggleap_remove_gamepass_from_user': {
        const { userUuid, offerUuid } = args as any;
        const correlationId = crypto.randomUUID();
        await auth.request('/users/gamepasses/remove', {
          method: 'POST',
          headers: { 'X-Correlation-Id': correlationId },
          body: JSON.stringify({ UserUuid: userUuid, OfferUuid: offerUuid })
        });
        return { content: [{ type: 'text', text: `Game pass removed from user ${userUuid}` }] };
      }

      case 'ggleap_create_sale': {
        const { cart, userUuid, guestName } = args as any;
        const correlationId = crypto.randomUUID();
        const response = await auth.request('/pos/sales/create', {
          method: 'POST',
          headers: { 'X-Correlation-Id': correlationId },
          body: JSON.stringify({ Cart: cart, UserUuid: userUuid, GuestName: guestName })
        });
        return { content: [{ type: 'text', text: `Sale created: ${JSON.stringify(response, null, 2)}` }] };
      }

      // BATCH 4: Supporting Features Handlers
      case 'ggleap_get_all_consoles': {
        const response = await auth.request('/consoles/get-all');
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_console_user_action': {
        const { deviceUuid, action, userUuid } = args as any;
        await auth.request('/consoles/user-action', {
          method: 'POST',
          body: JSON.stringify({ 
            DeviceUuid: deviceUuid, 
            Action: action === 'login' ? 'Login' : 'Logout',
            UserUuid: userUuid 
          })
        });
        return { content: [{ type: 'text', text: `User ${action} on console ${deviceUuid}` }] };
      }

      case 'ggleap_list_coupons': {
        const { userUuid, bookingUuid } = args as any;
        const params = new URLSearchParams();
        if (userUuid) params.append('UserUuid', userUuid);
        if (bookingUuid) params.append('BookingUuid', bookingUuid);
        const response = await auth.request(`/coupons/list?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_get_coupon': {
        const { couponUuid, userUuid } = args as any;
        const params = new URLSearchParams();
        params.append('CouponUuid', couponUuid);
        if (userUuid) params.append('UserUuid', userUuid);
        const response = await auth.request(`/coupons/get?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_delete_coupon': {
        const { couponUuid, userUuid } = args as any;
        const params = new URLSearchParams();
        params.append('CouponUuid', couponUuid);
        if (userUuid) params.append('UserUuid', userUuid);
        await auth.request(`/coupons/delete?${params}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Coupon ${couponUuid} deleted` }] };
      }

      case 'ggleap_get_enabled_apps': {
        const response = await auth.request('/apps/get-enabled-apps-summary');
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_transaction_history': {
        const { paginationToken, limit } = args as any;
        const params = new URLSearchParams();
        if (paginationToken) params.append('PaginationToken', paginationToken);
        if (limit) params.append('Limit', limit.toString());
        const response = await auth.request(`/transactions/history?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      case 'ggleap_search_transactions': {
        const { start, end, limit, paginationToken } = args as any;
        const params = new URLSearchParams();
        if (start) params.append('Start', start);
        if (end) params.append('End', end);
        if (limit) params.append('Limit', limit.toString());
        if (paginationToken) params.append('PaginationToken', paginationToken);
        const response = await auth.request(`/transactions/search?${params}`);
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