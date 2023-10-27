import type { UwsClient } from './uwsClient';
import { Envelope } from '../Envelope';
import {
  SocketError,
  TimeoutError,
} from '../error';

export const request = async function(ws: UwsClient, payload: Envelope, {
  timeout = 5000,
} = {}) {
  return new Promise((resolve, reject) => {
    let timeoutId: number | null = null;

    const handleRes = (msg: Envelope) => {
      if (msg.id !== payload.id) return;

      ws.messages.off(payload.id, handleRes);

      clearTimeout(timeoutId as any);
      if (msg.error) return reject(SocketError.from(msg.error));
      resolve(msg.data);
    };

    timeoutId = setTimeout(() => {
      reject(new TimeoutError({
        message: `exceeded ${timeout}ms`,
      }));
    }, timeout);
    
    ws.messages.on(payload.id, handleRes);
    ws.send(payload);
  });
};