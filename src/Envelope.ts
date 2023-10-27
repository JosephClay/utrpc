import { nanoid } from 'nanoid';
import { SocketError } from './error';
import { UTRPC } from './constants';

export type EnvelopeParams = {
  id?: string;
  method?: string;
  action?: string;
  error?: SocketError;
  data?: unknown;
};

export class Envelope {
  id: string;
  method: string;
  action?: string;
  error?: SocketError;
  data?: unknown;
  type: string;

  static id() {
    return nanoid(7);
  }
  
  constructor({
    id = '',
    method = '',
    action,
    error,
    data,
  }: EnvelopeParams) {
    this.id = id;
    this.method = method;
    this.action = action;
    this.error = error;
    this.data = data;

    // identifies this as a utrpc envelope
    this.type = UTRPC;
  }
}

export type AnyEnvelope = Envelope | Envelope[];