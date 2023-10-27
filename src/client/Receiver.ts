import { UwsClient } from './uwsClient';
import type { Unsubscribable } from '../types';
import { Envelope } from '../Envelope';
import { SocketError } from '../error';
import { toEventName } from '../utils';
import {
  ACTION_RESPONDER,
  ACTION_RECEIVER,

  CODE_INTERNAL_ERROR,
} from '../constants';

export const Receiver = function(ws: UwsClient, method, fn): Unsubscribable {
  const handler = async msg => {
    let payload;
    let error;
    try {
      payload = await fn(msg.data);
    } catch (err) {
      error = err;
    }

    if (error) {
      return ws.send(new Envelope({
        id: msg.id,
        action: ACTION_RESPONDER,
        method,
        error: new SocketError({
          code: CODE_INTERNAL_ERROR,
          message: error.message,
          error,
        }),
      }));
    }

    ws.send(new Envelope({
      id: msg.id,
      action: ACTION_RESPONDER,
      method,
      data: payload,
    }));
  };

  const event = toEventName(method, ACTION_RECEIVER);
  ws.messages.on(event, handler);

  return {
    unsubscribe: () => {
      ws.messages.off(event, handler);
    },
  };
};