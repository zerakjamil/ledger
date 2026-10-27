/**
 * Bun is the test runner only. The app bundle never imports it, and pulling
 * @types/bun in would collide with React Native's globals, so the surface the
 * tests actually use is declared here.
 */
declare module 'bun:test' {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: (value: unknown) => {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toBeNull: () => void;
    toBeDefined: () => void;
    toBeGreaterThan: (n: number) => void;
    toBeGreaterThanOrEqual: (n: number) => void;
    toBeLessThan: (n: number) => void;
    toBeLessThanOrEqual: (n: number) => void;
    toContain: (value: unknown) => void;
    toMatch: (pattern: RegExp) => void;
    toHaveLength: (n: number) => void;
    not: {
      toBeNull: () => void;
      toBe: (expected: unknown) => void;
      toContain: (value: unknown) => void;
      toMatch: (pattern: RegExp) => void;
    };
  };
}
