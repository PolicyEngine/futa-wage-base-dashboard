import '@testing-library/jest-dom/vitest';

// Recharts' ResponsiveContainer measures its parent; jsdom has no layout, so
// give every element a non-zero box so the chart renders in tests.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 400 });
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 400 });

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const g = globalThis as unknown as { ResizeObserver?: unknown };
g.ResizeObserver = g.ResizeObserver ?? ResizeObserverStub;

if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
}
