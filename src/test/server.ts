import {
  Io,
  router,
  method,
} from '../server';
import { z } from 'zod';
import {
  encode,
  decode,
} from '@msgpack/msgpack';

class Lobby {
  id: string;

  constructor(id: string) {
    this.id = id;
  }
};

const appRouter = router({
  changeCharacter: method()
    .input(z.object({ id: z.string(), message: z.string() }))
    .output(z.string())
    .transfer(({ input }) => {
      console.log(input.id, 'changed character to', input.message);
      return input.id;
    }),
  getClientName: method()
    .input(z.object({ id: z.number() }))
    .output(z.object({ name: z.string() }))
    .receiver(),
  lobby: method()
    .input<Lobby>()
    .output(z.object({ message: z.string() }))
    .subscribe(({ input }) => {
      console.log('lobby received message', input);
    }),
});

export type AppRouter = typeof appRouter;

const uws = Io({
  router: appRouter,
  transformer: {
    serialize(payload) {
      return encode(payload);
    },
    deserialize(payload) {
      return decode(payload as ArrayLike<number>);
    },
  },
  onUpgrade(req, server) {
    return server.upgrade(req, {
      data: {
        id: 'helloworld',
        createdAt: Date.now(),
      },
    });
  },
  onOpen(ws) {
    return ws.data.id;
  },
  onClose(ws) {
    return ws.data.id;
  },
});

const server = globalThis.Bun.serve({
  port: 1337,
  fetch: uws.fetch,
  websocket: {
    open: uws.open,
    close: uws.close,
    message: uws.message,
  },
});

uws.start(server);

const loop = async function() {
  try {
    // send a message to all subscribed to 'lobby'
    uws.router.lobby.send({ message: 'Goodbye World' });
    // send a message to all subscribed to lobby '123
    uws.router.lobby.sendTo('123', { message: 'Goodbye World' });

    const result = await uws.router.getClientName.pull('helloworld', { id: 123 });
    console.log('getClientName.pull', result);

    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (err) {
    console.error('loop', err);
  } finally {
    loop();
  }
};

loop();