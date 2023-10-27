import { ClientTransformers, client as json } from '../../transformers';
import { Envelope } from '../../Envelope';
import { retryDelay } from './retryDelay';
import { EventEmitter } from './EventEmitter';
import { toEventName } from '../../utils';
import { UTRPC } from '../../constants';

export const CLOSED = 'closed';
export const CONNECTING = 'connecting';
export const OPEN = 'open';

export type State = 
  typeof CLOSED | 
  typeof CONNECTING | 
  typeof OPEN;

export type WebSocketClientOptions = {
  url: string;
  WebSocket?: typeof WebSocket;
  retryDelayMs?: typeof retryDelay;
  config?: string[];
}

type WebSocketClientProps = {
  transformer?: ClientTransformers;
  ws: WebSocketClientOptions;
}

export type UwsClient = {
  send: (_envelope: Envelope) => void;
  close: () => void;
  lifecycle: EventEmitter<any>;
  messages: EventEmitter<Envelope>;
  ws: WebSocket;
}

export const uwsClient = function({
  transformer = json,
  ws: {
    url,
    WebSocket: WebSocketImpl = WebSocket,
    retryDelayMs: retryDelayFn = retryDelay,
    config: wsConfig,
  },
}: WebSocketClientProps): UwsClient { 
  if (!WebSocketImpl) throw new Error('No WebSocket implementation found');
  
  const messages = new EventEmitter<Envelope>();
  const lifecycle = new EventEmitter();
  const outgoing: Envelope[] = [];

  let state: State = CONNECTING;
  let connectAttempt = 0;
  let isDispatching: boolean = false;
  let connectTimer: number | null = null;
  let activeConnection: WebSocket;
  
  // NOTE: dont call outside of dispatch()
  // unlike a setTimeout, this will run is approx ~4ms
  // instead of a 16+ ms wait time. this is a huge
  // perf improvement for the main use-case: dispatching
  // messages to the server, but it uses promises, so 
  // memory usage will be higher. we mitigate that by
  // dispatching in batches
  const performDispatch = async function() {
    try {
      const payload = await transformer.serialize(
        outgoing.length === 1 ? outgoing[0] : outgoing
      );
      activeConnection.send(payload);
    } finally {
      outgoing.length = 0;
      isDispatching = false;
    }
  };

  const dispatch = async function() {
    if (!outgoing.length) return;
    if (state !== OPEN || isDispatching) return;

    isDispatching = true;
    await performDispatch();
  };

  const reconnect = () => {
    state = CONNECTING;
    // eslint-disable-next-line no-use-before-define
    activeConnection = createWS();
  };  

  const reconnectInMs = (ms: number) => {
    if (connectTimer) return;
    state = CONNECTING;
    // TODO: this file thinks it's running in node, but runs on the client side, how to fix?
    // @ts-ignore
    connectTimer = setTimeout(reconnect, ms);
  };

  const tryReconnect = () => {
    if (connectTimer !== null || state === CLOSED) return;
      
    const timeout = retryDelayFn(connectAttempt++);
    reconnectInMs(timeout);
  };
    
  const createWS = () => {
    const ws = new WebSocketImpl(url, wsConfig);
    clearTimeout(connectTimer as any);
    connectTimer = null;

    ws.addEventListener(OPEN, () => {
      connectAttempt = 0;
      state = OPEN;
      
      lifecycle.emit(OPEN, ws);
      dispatch();
    });

    ws.addEventListener('error', err => {
      lifecycle.emit('error', err);
      if (ws === activeConnection) tryReconnect();
    });

    ws.addEventListener('message', async function({ data }) {
      try {
        // TODO: this file thinks it's running in node, but runs on the client side, how to fix?
        // @ts-ignore
        const msg = await transformer.deserialize(data as Blob) as Envelope;

        // check the envolope
        if (!msg) return;
        if (msg.type !== UTRPC) return;
        
        // handle an errored envelope
        if (!msg.id || msg.error) {
          lifecycle.emit('error', msg);
          return;
        }

        lifecycle.emit('message', msg);
        
        messages.emit(msg.id, msg);
        
        const event = toEventName(msg.method, msg.action);
        messages.emit(event, msg);
      } catch {}
    });

    ws.addEventListener('close', e => {
      if (state === OPEN) lifecycle.emit('close', e);
      // connection might have been replaced already
      if (activeConnection === ws) tryReconnect();
    });

    return ws;
  };

  activeConnection = createWS();

  return {
    messages,
    lifecycle,

    get ws() {
      return activeConnection;
    },

    send(envelope: Envelope) {
      outgoing.push(envelope);
      dispatch();
    },
  
    close() {
      state = CLOSED;
      lifecycle.emit('close', null);
      clearTimeout(connectTimer as any);
      connectTimer = null;
    },
  };
};