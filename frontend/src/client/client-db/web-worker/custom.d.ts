// Rikard:
// Everything below is taken from https://github.com/alexburner/mvp-ts/blob/master/src/custom.d.ts
// And learned about it form this video: https://www.youtube.com/watch?v=ou5DNc4HXLQ&list=WL&index=1&t=1149s&ab_channel=SeattleTypeScript

// Other author:
/**
 * XXX: stolen from node_modules/typescript/lib/lib.webworker.d.ts
 * because currently tsconfig lib cannot load both DOM and WebWorker
 * (lots of "Duplicate Identifier" errors)
 *
 * Repo issue: https://github.com/Microsoft/TypeScript/issues/20595
 */

interface WorkerGlobalScopeEventMap {
  error: ErrorEvent;
}

interface WorkerGlobalScope extends EventTarget, WorkerUtils, WindowConsole {
  readonly caches: CacheStorage;
  readonly isSecureContext: boolean;
  readonly location: WorkerLocation;
  readonly performance: Performance;
  readonly self: WorkerGlobalScope;
  onerror(this: WorkerGlobalScope, ev: ErrorEvent): unknown;
  msWriteProfilerMark(profilerMarkName: string): void;
  addEventListener<K extends keyof WorkerGlobalScopeEventMap>(
    type: K,
    listener: (this: WorkerGlobalScope, ev: WorkerGlobalScopeEventMap[K]) => unknown,
    useCapture?: boolean,
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;
}

declare var WorkerGlobalScope: {
  prototype: WorkerGlobalScope;
  new (): WorkerGlobalScope;
};

interface DedicatedWorkerGlobalScopeEventMap extends WorkerGlobalScopeEventMap {
  message: MessageEvent;
}

interface DedicatedWorkerGlobalScope extends WorkerGlobalScope {
  onmessage(this: DedicatedWorkerGlobalScope, ev: MessageEvent): unknown;
  close(): void;
  postMessage<T>(message: T, transfer?: unknown[]): void;
  addEventListener<K extends keyof DedicatedWorkerGlobalScopeEventMap>(
    type: K,
    listener: (this: DedicatedWorkerGlobalScope, ev: DedicatedWorkerGlobalScopeEventMap[K]) => unknown,
    useCapture?: boolean,
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;
}

declare var DedicatedWorkerGlobalScope: {
  prototype: DedicatedWorkerGlobalScope;
  new (): DedicatedWorkerGlobalScope;
};

interface WorkerLocation {
  readonly hash: string;
  readonly host: string;
  readonly hostname: string;
  readonly href: string;
  readonly origin: string;
  readonly pathname: string;
  readonly port: string;
  readonly protocol: string;
  readonly search: string;
  toString(): string;
}

declare var WorkerLocation: {
  prototype: WorkerLocation;
  new (): WorkerLocation;
};

interface WorkerNavigator extends Object, NavigatorID, NavigatorOnLine, NavigatorBeacon, NavigatorConcurrentHardware {
  readonly hardwareConcurrency: number;
}

declare var WorkerNavigator: {
  prototype: WorkerNavigator;
  new (): WorkerNavigator;
};

interface WorkerUtils extends Object, WindowBase64 {
  readonly indexedDB: IDBFactory;
  readonly msIndexedDB: IDBFactory;
  readonly navigator: WorkerNavigator;
  clearImmediate(handle: number): void;
  clearInterval(handle: number): void;
  clearTimeout(handle: number): void;
  importScripts(...urls: string[]): void;
  setImmediate(handler: (...args: unknown[]) => void): number;
  setImmediate(handler: unknown, ...args: unknown[]): number;
  setInterval(handler: (...args: unknown[]) => void, timeout: number): number;
  setInterval(handler: unknown, timeout?: unknown, ...args: unknown[]): number;
  setTimeout(handler: (...args: unknown[]) => void, timeout: number): number;
  setTimeout(handler: unknown, timeout?: unknown, ...args: unknown[]): number;
}
