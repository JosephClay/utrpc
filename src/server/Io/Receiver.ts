import type { ServerTransformers } from '../../transformers';
import type { ServerWebSocket } from '../../types';
import { Envelope } from '../../Envelope';
import { send as sendRequest } from './request';
import { ACTION_RECEIVER } from '../../constants';

export class Receiver<I, O> {
  #name: string;
  #timeout: number;
  #transformer: ServerTransformers;
  #getSocket: (_id: string) => ServerWebSocket | undefined;

  constructor(
    name: string,
    transformer: ServerTransformers,
    getSocket: (_id: string) => ServerWebSocket | undefined,
    timeout: number,
  ) {
    this.#name = name;
    this.#timeout = timeout;
    this.#transformer = transformer;
    this.#getSocket = getSocket;
  }

  async pull(id: string, data: I, timeout = this.#timeout): Promise<O> {
    const ws = this.#getSocket(id);
    if (!ws) return undefined as O;
    
    const envelope = new Envelope({
      id: Envelope.id(),
      method: this.#name,
      action: ACTION_RECEIVER,
      data,
    });

    const payload = await this.#transformer.serialize(envelope);
    const result = await sendRequest(ws, envelope, payload, timeout) as O;
    return result;
  }
}