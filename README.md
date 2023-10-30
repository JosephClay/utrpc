# utrpc

Fullstack uwebsockets typesafety inspired by trpc. Made for Bun. Written in TS.

This is a work-in-progress - contributors welcome! Current code is not transpiled to js and usage via npm may require configuration.

## Features: 

- Full typescript safety for websocket events via trpc-esque interface
- Custom transformers to serialize your JSON data into binary transports
- Input and Output validation can be disabled for performance
- Make requests through an existing websocket connection
- Two-way communication allows server to call client for data
- Define data types via `zod` or pass a ts generic

## Examples

### `server.ts`

```typescript
import { z } from 'zod';
import {
  Io,
  router,
  method,
} from '@immutabl3/utrpc/server';

class Message {
  message: string;

  constructor(message: string) {
    this.message = message;
  }
};

const appRouter = router({
  ping: method()
    .input(z.object({ id: z.number(), message: z.string() }))
    .output(z.string())
    .transfer(({ input }) => {
      return `pong: ${input.id}: ${input.message}`;
    }),
  callClient: method()
    .input(z.object({ id: z.number() }))
    .output<{ id: number; message: string; }>()
    .receiver(),
  subscriptions: method()
    .input<Message>()
    .output<Message>()
    .subscribe(({ input }) => {
      console.log('lobby received message', input);
    }),
});

export type AppRouter = typeof appRouter;

const uws = Io({
  router: appRouter,
});

const server = Bun.serve({
  fetch: uws.fetch,
  websocket: {
    open: uws.open,
    close: uws.close,
    message: uws.message,
  },
});

uws.start(server);

// send a message to all subscribed to 'subscriptions'
uws.router.subscriptions.send({ message: 'Goodbye World' });
// send a message to all subscribed to room '123'
uws.router.subscriptions.sendTo('123', { message: 'Goodbye World' });

// call client id '123' passing the { id: 1 } object to get a result
const result = await uws.router.callClient.pull('123', { id: 1 });
console.log('callClient.pull', result); // { id: 1, message: 'Hello World' }
```

### `client.ts`

```typescript
import { client } from '@immutabl3/utrpc/client';
import type { AppRouter } from './server';

const utrpc = client<AppRouter>({
  ws: {
    url: 'ws://localhost:1337',
  },
});

// send the server a ping, expecting back a message 
const result = await utrpc.ping.request({ id: 1, message: 'Hello World' });
console.log(result); // `pong: 1: Hello World`

// subscribe to callClient so we can send back message when the server calls
utrpc.callClient.onRequest(async function({ id }) {
  console.log('client', 'received request for client name', { id });
  return { id, message: 'Hello World' };
});

// subscribe to all 'subscriptions' notifications
utrpc.subscriptions.subscribe({
  onData: data => console.log('subscriptions', data),
  onError: err => console.error('subscriptions', err),
});

// subscribe to 'subscriptions' notifications for room '123'
utrpc.subscriptions.subscribe({
  to: '123',
  onData: data => console.log('subscriptions:123', data),
  onError: err => console.error('subscriptions:123', err),
});

// send a message to subscriptions
trpc.subscriptions.send({ message: 'Hello World' });

// send a message to subscriptions in room '123'
trpc.subscriptions.sendTo('123', { message: 'Hello World' });

// call utrpc() to get the top-level object to latch into lifecycle events
const uws = utrpc();
uws.lifecycle.on('message', (...args) => {
  // log out every utrpc message that comes through the websocket 
  console.log('message', ...args);
});

uws.lifecycle.on('open', () => {
  // interact with the ws directly
  // (utrpc will ignore these messages)
  uws.ws.send('hello world');
});
```
