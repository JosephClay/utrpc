import { Envelope } from '../Envelope';
import { SocketError } from '../error';
import type { UwsClient } from './uwsClient';
import { toEventName } from '../utils';
import {
  ACTION_SUBSCRIPTION_START,
  ACTION_SUBSCRIPTION_STOP,
} from '../constants';

export const Subscription = function(ws: UwsClient, method: string, {
  to = '',
  onData,
  onError,
}) {
  const event = toEventName(method, to);

  const handleRes = (msg: Envelope) => {
    if (msg.error) return onError(SocketError.from(msg.error));
    
    onData(msg.data);
  };

  const subscribe = () => {
    ws.send(new Envelope({
      id: Envelope.id(),
      action: ACTION_SUBSCRIPTION_START,
      method,
      data: to,
    }));
  };

  ws.lifecycle.on('open', subscribe);
  ws.messages.on(event, handleRes);
  subscribe();

  return {
    unsubscribe() {
      ws.lifecycle.off('open', subscribe);
      ws.messages.off(event, handleRes);

      ws.send(new Envelope({
        id: Envelope.id(),
        action: ACTION_SUBSCRIPTION_STOP,
        method,
        data: to,
      }));
    },
  };
};