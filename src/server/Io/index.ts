import { noop } from '@immutabl3/utils';
import { nanoid } from 'nanoid';
import type { Router } from '../router';
import { SocketError } from '../../error';
import { AnyEnvelope, Envelope } from '../../Envelope';
import { Sender } from './Sender';
import { Receiver } from './Receiver';
import { Subscriber } from './Subscriber';
import { toEventName } from '../../utils';
import { ServerTransformers, server as json } from '../../transformers';
import {
  fail as failRequest,
  receive as receiveRequest,
  disconnect as disconnectRequest,
} from './request';
import type {
  Server,
  RawMessage,
  ServerWebSocket,
} from '../../types';
import {
  UTRPC,

  CODE_NOT_FOUND,
  CODE_PARSE_ERROR,
  CODE_BAD_REQUEST,
  CODE_INTERNAL_SERVER_ERROR,
  
  ACTION_EVENT,
  ACTION_SUBSCRIPTION_STOP,
  ACTION_SUBSCRIPTION_START,
} from '../../constants';

export type IoParams<TRouter extends Router> = {
  router: TRouter;
  timeout?: number,
  transformer?: ServerTransformers;
  validate?: boolean;
  onUpgrade?: (_req: Request, _server: Server) => boolean | Response | Promise<boolean | Response>,
  onUpgradeFailed?: (_req: Request, _server: Server) => void,
  onOpen?: (_ws: ServerWebSocket) => string,
  onClose?: (_ws: ServerWebSocket) => string,
  onMessage?: (_ws: ServerWebSocket, _msg: Envelope) => void,
  onError?: (_error: Error | SocketError) => void,
};

const defaultOnUpgrade = function(req: Request, server: Server): boolean {
  return server.upgrade(req);
};

// NOTE: tested and this works. the id carries through the 
// entire process
const defaultGetId = function(ws: ServerWebSocket): string {
  // @ts-ignore
  const id = ws.id ?? nanoid();
  // @ts-ignore
  ws.id = id;
  return id;
};

const safeParse = function(fn, data: unknown): boolean {
  return !!(fn?.safeParse?.(data)?.success ?? fn?.());
};

export const Io = function<TRouter extends Router>({
  router,
  validate = true,
  transformer = json,
  timeout = 5000,
  onUpgrade = defaultOnUpgrade,
  onUpgradeFailed = noop,
  onOpen = defaultGetId,
  onClose = defaultGetId,
  onMessage = noop,
  onError = noop,
}: IoParams<TRouter>) {
  let server;

  const getServer = () => server;

  const sockets = new Map<string, ServerWebSocket>();

  const getSocket = (id: string) => sockets.get(id);

  const send = async function(ws: ServerWebSocket, envelope: Envelope) {
    if (envelope.error) onError(envelope.error);
    ws.send(await transformer.serialize(envelope));
  };

  const handleRequest = async function(ws: ServerWebSocket, msg: Envelope) {
    // nothing to operate against
    if (!msg) return;

    const { id, type, method: methodName, action, data } = msg;

    // not a utrpc message, ignore
    if (type !== UTRPC) return;

    if (id === '') {
      return send(ws, new Envelope({
        error: new SocketError({
          code: CODE_BAD_REQUEST,
          message: '"id" is required',
        }),
      }));
    }

    const method = router.methods[methodName];
    if (!method) return send(ws, new Envelope({
      error: new SocketError({
        code: CODE_NOT_FOUND,
        message: `method not found: "${methodName}"`,
      })
    }));

    if (action === ACTION_EVENT) {
      await method.resolve({ ws, input: data });
      return;
    }

    if (action === ACTION_SUBSCRIPTION_STOP) {
      const inSuccess = validate ? safeParse(method.in, data) : true;
      if (!inSuccess) return send(ws, new Envelope({
        error: new SocketError({
          code: CODE_PARSE_ERROR,
          message: 'input did not match expected shape',
        })
      }));

      const event = toEventName(methodName, data as string);
      if (ws.isSubscribed(event)) ws.unsubscribe(event);
      return;
    }

    if (action === ACTION_SUBSCRIPTION_START) {
      const inSuccess = validate ? safeParse(method.in, data) : true;
      if (!inSuccess) return send(ws, new Envelope({
        error: new SocketError({
          code: CODE_PARSE_ERROR,
          message: 'input did not match expected shape',
        })
      }));

      const event = toEventName(methodName, data as string);
      if (!ws.isSubscribed(event)) ws.subscribe(event);
      return;
    }

    // handle retrieving the data
    if (method.type === 'transfer') {
      const inSuccess = validate ? safeParse(method.in, data) : true;
      if (!inSuccess) return send(ws, new Envelope({
        id,
        error: new SocketError({
          code: CODE_PARSE_ERROR,
          message: 'input did not match expected shape',
        })
      }));
      
      const result = await method.resolve({ ws, input: data });
      const outSuccess = validate ? safeParse(method.out, result) : true;
      if (!outSuccess) return send(ws, new Envelope({
        id,
        error: new SocketError({
          code: CODE_PARSE_ERROR,
          message: 'output did not match expected shape',
        })
      }));

      return send(ws, new Envelope({
        id,
        data: result,
      }));
    }
    
    // handle resolving the server's request
    if (method.type === 'receiver') {
      const outSuccess = validate ? safeParse(method.out, data) : true;
      if (!outSuccess) return failRequest(ws, msg,
        await transformer.serialize(new Envelope({
          id,
          method: methodName,
          error: new SocketError({ 
            code: CODE_PARSE_ERROR,
            message: 'output did not match expected shape',
          })
        }))
      );

      return receiveRequest(ws, msg);
    }

    return send(ws, new Envelope({
      error: new SocketError({
        code: CODE_INTERNAL_SERVER_ERROR,
        message: `unknown`,
      }),
    }));
  };

  return {
    start(s: Server) {
      server = s;
    },
    async fetch(req: Request, server: Server): Promise<Response | undefined> {
      const result = await onUpgrade(req, server);
      if (result === true) return; // success
      if (result) return result; // as a response
      
      onUpgradeFailed?.(req, server);
      return undefined;
    },
    open(ws: ServerWebSocket) {
      const id = onOpen(ws);
      if (sockets.has(id)) return;
      sockets.set(id, ws);
    },
    close(ws: ServerWebSocket) {
      disconnectRequest(ws);

      const id = onClose(ws);
      if (!sockets.has(id)) return;
      sockets.delete(id);
    },
    async message(ws: ServerWebSocket, rawMsg: RawMessage) {
      try {
        const deserialized: AnyEnvelope = transformer.deserialize(rawMsg);
        const messages: Envelope[] = Array.isArray(deserialized) ? deserialized : [deserialized];

        for (const msg of messages) {
          onMessage(ws, msg);
          handleRequest(ws, msg);
        }
      } catch {}
    },
    router: Object.fromEntries(
      Object.entries(router.methods)
        .map(([key, method]) => {
          if (method.type === 'transfer') return [key, new Sender<typeof method['out']>(key, transformer, getServer)];
          if (method.type === 'receiver') return [key, new Receiver<typeof method['in'], typeof method['out']>(key, transformer, getSocket, timeout)];
          if (method.type === 'subscribe') return [key, new Subscriber<typeof method['out']>(key, transformer, getServer)];
          return [key, undefined];
        })
    ) as {
      [key in keyof TRouter['methods']]: 
        TRouter['methods'][key]['type'] extends 'transfer'
          ? Sender<TRouter['methods'][key]['out']>
          : TRouter['methods'][key]['type'] extends 'receiver'
          ? Receiver<TRouter['methods'][key]['in'], TRouter['methods'][key]['out']>
          : TRouter['methods'][key]['type'] extends 'subscribe'
          ? Subscriber<TRouter['methods'][key]['out']>
          : never
    },
  };
};