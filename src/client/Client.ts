import { noop } from '@immutabl3/utils';
import { UwsClient } from './uwsClient';
import { Envelope } from '../Envelope';
import { request } from './request';
import { Receiver } from './Receiver';
import { Subscription } from './Subscription';
import {
  ACTION_EVENT,
  ACTION_REQUEST,
} from '../constants';

export class Client {
  #uws: UwsClient;

  constructor(uws: UwsClient) {
    this.#uws = uws;
  }

  async request(method, data = {}, options = {}) {
    return request(this.#uws, new Envelope({
      id: Envelope.id(),
      action: ACTION_REQUEST,
      method,
      data,
    }), options);
  }

  onRequest(method, fn): ReturnType<typeof Receiver> {
    return Receiver(this.#uws, method, fn);
  }

  subscribe(method, {
    to,
    onData,
    onError = noop,
  }): ReturnType<typeof Subscription> {
    return Subscription(this.#uws, method, {
      to,
      onData,
      onError,
    });
  }

  send(method, data) {
    this.#uws.send(new Envelope({
      id: Envelope.id(),
      action: ACTION_EVENT,
      method,
      data,
    }));
  }
}