import type { AnyEnvelope } from './Envelope';
import type { RawMessage } from './types';

export type ServerTransformers = {
  serialize(_e: AnyEnvelope): RawMessage | Promise<RawMessage>;
  deserialize(_e: RawMessage): any | Promise<any>;
};

export type ClientTransformers = {
  serialize(_e: AnyEnvelope): RawMessage | Promise<RawMessage>;
  deserialize(_e: Blob): any | Promise<any>;
};

export const server: ServerTransformers = {
  serialize: value => JSON.stringify(value),
  deserialize: value => JSON.parse(value.toString()),
};

export const client: ClientTransformers = {
  serialize: value => JSON.stringify(value),
  deserialize: value => JSON.parse(value.toString()),
};