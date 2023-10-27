import { z } from 'zod';
import { identity, constant } from '@immutabl3/utils';
import {
  ServerWebSocket,
  FallbackValue,
  MaybePromise,
} from '../types';

export type MethodTypes = 'transfer' | 'receiver' | 'subscribe';

type ResolveOptions<T> = { ws: ServerWebSocket, input: T }

type InputType = z.ZodTypeAny | any;
type InferDefinedType<T> = T extends z.ZodTypeAny ? z.infer<T> : T;
type Resolver<T, Resolve> = (_opts: ResolveOptions<T>) => MaybePromise<FallbackValue<Resolve, T>>

export class Method<Type extends MethodTypes, I, O, R> {
  type: Type;
  in: I;
  out: O;
  resolve: R;

  constructor() {
    this.type = 'unknown' as Type;
    this.in = constant(true) as I;
    this.out = constant(true) as O;
    this.resolve = identity as R;
  }

  input<Input extends InputType>(schema?: Input): Method<
    Type,
    InferDefinedType<Input>,
    O,
    R
  > {
    this.in = schema ?? constant(true);
    return this as Method<
      Type,
      InferDefinedType<Input>,
      O,
      R
    >;
  }

  output<Input extends InputType>(schema?: Input): Method<
    Type,
    I,
    InferDefinedType<Input>,
    R
  > {
    this.out = schema ?? constant(true);
    return this as Method<
      Type,
      I,
      InferDefinedType<Input>,
      R
    >;
  }

  transfer<Resolve>(
    resolver: Resolver<I, Resolve>,
  ): Method<'transfer', I, O, ReturnType<typeof resolver>> {
    this.type = 'transfer' as Type;
    this.resolve = resolver as any;
    return this as Method<'transfer', I, O, ReturnType<typeof resolver>>;
  };
  
  receiver<Resolve>(
    resolver?: Resolver<I, Resolve>,
  ): Method<'receiver', I, O, typeof resolver extends undefined ? I : ReturnType<Resolver<I, Resolve>>> {
    this.type = 'receiver' as Type;
    this.resolve = (resolver ?? identity) as any;
    return this as Method<'receiver', I, O, typeof resolver extends undefined ? I : ReturnType<Resolver<I, Resolve>>>;
  };

  subscribe<Resolve>(
    resolver?: Resolver<I, Resolve>,
  ): Method<'subscribe', I, O, typeof resolver extends undefined ? I : ReturnType<Resolver<I, Resolve>>> {
    this.type = 'subscribe' as Type;
    this.resolve = (resolver ?? identity) as any;
    return this as Method<'subscribe', I, O, typeof resolver extends undefined ? I : ReturnType<Resolver<I, Resolve>>>;
  };
}

export type AnyMethod = Method<any, any, any, any>;
export type AnyTransferMethod = Method<'transfer', any, any, any>;
export type AnyReceiverMethod = Method<'receiver', any, any, any>;
export type AnySubscriptionMethod = Method<'subscribe', any, any, any>;

export const method = function(): AnyMethod {
  return new Method();
};