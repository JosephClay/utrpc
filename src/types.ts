export type IntersectionError<TKey extends string> =
  `The property '${TKey}' in your router collides with a built-in method, rename this router or procedure on your backend.`;

export type MaybePromise<T> = Promise<T> | T;

export const unsetMarker = Symbol('unsetMarker');

export type UnsetMarker = typeof unsetMarker;

export type FallbackValue<TValue, TFallback> = UnsetMarker extends TValue
  ? TFallback
  : TValue;
  
export type Unsubscribable = {
  unsubscribe(): void;
}

// TODO: figure out how to get these types directly out of bun or bun-types to have parity
// https://bun.sh/docs/api/websockets
export interface ServerWebSocket {
  readonly data: any;
  readonly readyState: number;
  readonly remoteAddress: string;
  send(_message: string | ArrayBuffer | Uint8Array, _compress?: boolean): number;
  close(_code?: number, _reason?: string): void;
  subscribe(_topic: string): void;
  unsubscribe(_topic: string): void;
  publish(_topic: string, _message: string | ArrayBuffer | Uint8Array): void;
  isSubscribed(_topic: string): boolean;
  cork(_cb: (_ws: ServerWebSocket) => void): void;
}

type Compressor =
  | `"disable"`
  | `"shared"`
  | `"dedicated"`
  | `"3KB"`
  | `"4KB"`
  | `"8KB"`
  | `"16KB"`
  | `"32KB"`
  | `"64KB"`
  | `"128KB"`
  | `"256KB"`;

export type RawMessage = string | ArrayBuffer | Uint8Array;

export interface ServerWebSocketOptions {
  message: (
    _ws: ServerWebSocket,
    _message: RawMessage,
  ) => void;
  open?: (_ws: ServerWebSocket) => void;
  close?: (_ws: ServerWebSocket) => void;
  error?: (_ws: ServerWebSocket, _error: Error) => void;
  drain?: (_ws: ServerWebSocket) => void;
  perMessageDeflate?:
    | boolean
    | {
        compress?: boolean | Compressor;
        decompress?: boolean | Compressor;
      };
}

export interface Server {
  pendingWebsockets: number;
  publish(
    _topic: string,
    _data: string | ArrayBufferView | ArrayBuffer,
    _compress?: boolean,
  ): number;
  upgrade(
    _req: Request,
    _options?: {
      headers?: any;
      data?: any;
    },
  ): boolean;
}