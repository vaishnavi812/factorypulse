// Single composition point. Swap `services` for an HTTP-backed implementation to go live.
export { services } from './local';
export { subscribe, resetPrototypeData, SIM_ERROR_KEY } from './local';
export type { Services } from './contracts';
