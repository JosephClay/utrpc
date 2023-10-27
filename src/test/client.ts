import {
  client,
} from '@immutabl3/utrpc/client';
import type {
  AppRouter,
} from '@immutabl3/utrpc/test/server';
import {
  encode,
  decode,
} from '@msgpack/msgpack';

const trpc = client<AppRouter>({
  transformer: {
    serialize(payload) {
      const uint8arr = encode(payload);
      return uint8arr;
    },
    async deserialize(blob) {
      const buf = await blob.arrayBuffer();
      const json = decode(buf);
      return json;
    },
  },
  ws: {
    url: 'ws://localhost:1337',
  },
});

// perform a changeCharacter request
(async function() {
  try {
    const result = await trpc.changeCharacter.request({ id: 'foo', message: 'Hello World' });
    console.log('client', 'made request to change character', { result });
  } catch (err) {
    console.error('result', err);
  }
}());

// subscribe to getClientName so we can send back a client name
// if the server asks for it
trpc.getClientName.onRequest(async function({ id }) {
  console.log('client', 'received request for client name', { id });
  return { name: 'joe' };
});

// subscribe to all lobby notifications
const sub1 = trpc.lobby.subscribe({
  onData: data => console.log('lobby', data),
  onError: err => console.error('lobby', err),
});

if (!sub1.unsubscribe) console.log('sub1 unsubscribable');

// subscribe to lobby 123 notifications
const sub2 = trpc.lobby.subscribe({
  to: '123',
  onData: data => console.log('lobby:123', data),
  onError: err => console.error('lobby:123', err),
});

if (!sub2.unsubscribe) console.log('sub2 unsubscribable');

// send a message to lobbies
trpc.lobby.send({ message: 'Hello World' } as any);

const uws = trpc();
uws.lifecycle.on('message', (...args) => {
  console.log('message', ...args);
});

uws.lifecycle.on('open', () => {
  uws.ws.send('hello world');
});