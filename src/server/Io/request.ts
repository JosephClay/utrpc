import type { Envelope } from '../../Envelope';
import { SocketError } from '../../error';
import { CODE_TIMEOUT } from '../../constants';
import type {
  RawMessage,
  ServerWebSocket,
} from '../../types';

class Req {
  #id: string;
  #resolve: (_data?: unknown) => void;
  #reject: (_error?: Error | SocketError) => void;
  #timeoutId: number;

  constructor(msg, resolve, reject, timeout) {
    this.#id = msg.id;
    this.#resolve = resolve;
    this.#reject = reject;

    // eslint-disable-next-line no-use-before-define
    registrar.set(this.#id, this);

    this.#timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-use-before-define
      const req = registrar.get(msg.id);
      if (!req) return; // already timed out or resolved

      req.reject(
        new SocketError({
          code: CODE_TIMEOUT,
          message: `exceeded ${this.#timeoutId} (msec)`,
        })
      );
    }, timeout);
  }

  #cleanup() {
    clearTimeout(this.#timeoutId);
    // eslint-disable-next-line no-use-before-define
    if (registrar.has(this.#id)) registrar.delete(this.#id);
  }

  resolve = (data?: unknown) => {
    this.#cleanup();
    this.#resolve(data);
  };

  reject = (error?: Error | SocketError) => {
    this.#cleanup();
    this.#reject(error);
  };
};

const registrar = new Map<string, Req>();

export const send = async function(ws: ServerWebSocket, msg: Envelope, payload: RawMessage, timeout = 5000) {
  return new Promise((resolve, reject) => {
    new Req(msg, resolve, reject, timeout);
    ws.send(payload);
  });
};

export const receive = (_ws: ServerWebSocket, msg: Envelope) => {
  const req = registrar.get(msg.id);
  if (!req) return; // already failed or resolved

  req.resolve(msg.data);
  
  // nothing to send back to the client. this communication was initiated by the server
};

export const fail = (ws: ServerWebSocket, msg: Envelope, payload: RawMessage) => {
  const req = registrar.get(msg.id);
  if (!req) return; // already timed out or resolved

  req.reject(msg.error);
  
  ws.send(payload);
};

export const disconnect = (_ws: ServerWebSocket) => {
  // let the socket timeout and clean itself up
  // 
  // it may come back online to be responded to, so this disconnect
  // is a noop, but there may be work to do here later, so we've
  // added it as part of the lifecycle
};