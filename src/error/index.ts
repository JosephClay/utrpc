import { CODE_TIMEOUT } from '../constants';
import { serializeError, deserializeError } from './serialize-error';

const serializeErrorWithoutStack = err => {
  delete err.stack;
  return serializeError(err);
};

// convert (nested) Error object to Plain object to send via socket.io
const convertErrorToObject = err => {
  if (err instanceof Error) return serializeErrorWithoutStack(err);
  if (err instanceof Array) return err.map(serializeErrorWithoutStack);
  
  const obj = {};
  for (const k in err) {
    if (err.hasOwnProperty(k)) {
      obj[k] = serializeErrorWithoutStack(err[k]);
    }
  }
  return obj;
};

// convert nested object to Error
const convertObjectToError = function(obj) {
  if (obj instanceof Error) return obj;
  if (obj instanceof Array) return obj.map(deserializeError);
  if (obj === undefined || typeof obj !== 'object') return obj;
  const e = deserializeError(obj);
  if (e !== obj) return e;
  
  const err = {};
  for (const k in obj) {
    err[k] = deserializeError(obj[k]);
  }
  return err;
};

export class TimeoutError extends Error {
  static from(obj) {
    return convertObjectToError(obj);
  }

  code?: string;

  constructor({
    message = '',
    error,
  }: {
    message?: string;
    code?: string;
    error?: Error | unknown;
  }) {
    super(message);

    this.code = CODE_TIMEOUT;
    this.name = 'TimeoutError';
    
    Object.assign(this, (error as Error) ? convertErrorToObject(error) : {});
  }
}

export class SocketError extends Error {
  static from(obj) {
    return convertObjectToError(obj);
  }

  code?: string;

  constructor({
    message = '',
    code = '',
    error,
  }: {
    message?: string;
    code?: string;
    error?: Error | unknown;
  }) {
    super(message);

    this.code = code;
    this.name = 'SocketError';
    
    Object.assign(this, (error as Error) ? convertErrorToObject(error) : {});
  }
}
