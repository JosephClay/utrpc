export const toEventName = (method: string, to = '') => {
  return `${method}${to ? ':' : ''}${to}`;
};