import type { ServerTransformers } from '../../transformers';
import { Envelope } from '../../Envelope';
import type { Server } from '../../types';

export class Sender<O> {
  #name: string;
  #transformer: ServerTransformers;
  #getServer: () => Server | undefined;

  constructor(
    name: string,
    transformer: ServerTransformers,
    getServer: () => Server | undefined,
  ) {
    this.#name = name;
    this.#transformer = transformer;
    this.#getServer = getServer;
  }

  async send(data: O) {
    const server = this.#getServer();
    if (!server) return;
    
    server.publish(this.#name,
      await this.#transformer.serialize(new Envelope({
        id: Envelope.id(),
        method: this.#name,
        data,
      }))
    );
  }
  
  async sendTo(key: string, data: O) {
    const server = this.#getServer();
    if (!server) return;
    
    server.publish(key,
      await this.#transformer.serialize(new Envelope({
        id: Envelope.id(),
        method: this.#name,
        action: key,
        data,
      }))
    );
  }
}
