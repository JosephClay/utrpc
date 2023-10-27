import type { SocketError } from '../error';
import type { ClientTransformers } from '../transformers';
import type { Router, MethodRouterRecord } from '../server/router';
import type {
  AnyMethod,
  MethodTypes,
  AnyTransferMethod,
  AnyReceiverMethod,
  AnySubscriptionMethod,
} from '../server/Method';
import type {
  UnsetMarker,
  IntersectionError,
  Unsubscribable,
} from '../types';

import { Client } from './Client';
import { Subscription } from './Subscription';
import { createFlatProxy, createRecursiveProxy } from './proxy';
import {
  uwsClient,
  UwsClient,
  WebSocketClientOptions,
} from './uwsClient';

export type MethodIn<TParams extends AnyMethod> =
  TParams['in'] extends UnsetMarker
    ? undefined | void
    : undefined extends TParams['in']
    ? TParams['in'] | void
    : TParams['in'];

export type MethodOut<TParams extends AnyMethod> =
  TParams['out'] extends UnsetMarker
    ? undefined | void
    : undefined extends TParams['out']
    ? TParams['out'] | void
    : TParams['out'];

export type Requester<TMethod extends AnyMethod> = (
  _input: MethodIn<TMethod>
) => Promise<MethodOut<TMethod>>;

export type Subscription<TMethod extends AnyMethod> = {
  to?: string;
  onData: (_data: MethodOut<TMethod>) => void;
  onError?: (_error: Error | SocketError) => void;
};

type DecoratedMethod<TMethod extends AnyMethod> =
  TMethod extends AnyTransferMethod
    ? { request: Requester<TMethod> }
    : TMethod extends AnyReceiverMethod
    ? { onRequest: (_fn: Requester<TMethod>) => Unsubscribable }
    : TMethod extends AnySubscriptionMethod
    ? {
        subscribe: (_arg: Subscription<TMethod>) => Unsubscribable;
        send: (_arg: MethodIn<TMethod>) => void;
      }
    : never;

type DecoratedMethodRecord<TProcedures extends MethodRouterRecord> = {
  [TKey in keyof TProcedures]: TProcedures[TKey] extends AnyMethod
    ? DecoratedMethod<TProcedures[TKey]>
    : never;
};

export type inferRouterProxyClient<TRouter extends Router> =
  DecoratedMethodRecord<TRouter['methods']>;

export type UntypedClientProperties = '';

export type ClientFnAccess = () => UwsClient;

export type ClientProxyAccess<TRouter extends Router> = ClientFnAccess & (
  inferRouterProxyClient<TRouter> extends infer $ProcedureRecord
    ? UntypedClientProperties & keyof $ProcedureRecord extends never
      ? inferRouterProxyClient<TRouter>
      : IntersectionError<UntypedClientProperties & keyof $ProcedureRecord>
    : never
);

const clientCallTypeMap: Record<keyof DecoratedMethod<any>, MethodTypes> = {
  request: 'transfer',
  respond: 'receiver',
  subscribe: 'subscribe',
};

export const clientCallTypeToProcedureType = (clientCallType: string): MethodTypes => {
  return clientCallTypeMap[clientCallType as keyof typeof clientCallTypeMap];
};

export type ClientParams = {
  transformer?: ClientTransformers;
  ws: WebSocketClientOptions;
};

export const client = function<TRouter extends Router>(options: ClientParams): ClientProxyAccess<TRouter> {
  const uws = uwsClient(options);
  const client = new Client(uws);
  return createFlatProxy<ClientProxyAccess<TRouter>>(() => uws, key => {
    return createRecursiveProxy(({ path, args }) => {
      const procedureType = path.at(0) as MethodTypes;
      return (client as any)[procedureType](key, ...args);
    });
  });
};