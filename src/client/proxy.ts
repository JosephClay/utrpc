import { noop } from '@immutabl3/utils';

type ProxyCallbackOptions = {
  path: string[];
  args: unknown[];
}

type ProxyCallback = (_opts: ProxyCallbackOptions) => unknown;

export const createInnerProxy = function(callback: ProxyCallback, path: string[]) {
  const proxy: unknown = new Proxy(noop, {
    get(_obj, key) {
      if (typeof key !== 'string' || key === 'then') {
        // special case for if the proxy is accidentally treated
        // like a PromiseLike (like in `Promise.resolve(proxy)`)
        return undefined;
      }
      return createInnerProxy(callback, [...path, key]);
    },
    apply(_1, _2, args) {
      const isApply = path[path.length - 1] === 'apply';
      return callback({
        args: isApply ? (args.length >= 2 ? args[1] : []) : args,
        path: isApply ? path.slice(0, -1) : path,
      });
    },
  });

  return proxy;
};

export const createRecursiveProxy = (callback: ProxyCallback) =>
  createInnerProxy(callback, []);

export const createFlatProxy = <TFaux>(
  fn = noop,
  callback: (_key: string & keyof TFaux) => any,
): TFaux => {
  return new Proxy(fn, {
    get(_obj, key) {
      if (typeof key !== 'string' || key === 'then') {
        // special case for if the proxy is accidentally treated
        // like a PromiseLike (like in `Promise.resolve(proxy)`)
        return undefined;
      }
      return callback(key as any);
    },
  }) as TFaux;
};
