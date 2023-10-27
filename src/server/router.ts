import type { AnyMethod } from './Method';

export type MethodRouterRecord = {
  [key: string]: AnyMethod;
}

export type Router = {
  methods: MethodRouterRecord,
};

export const router = function<T extends MethodRouterRecord>(methodsDefinition: T) {
  return {
    methods: methodsDefinition,
  };
};