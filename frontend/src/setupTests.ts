// Jest setup file - runs before all tests
import "@testing-library/jest-dom";

// Tests are written against the guest client config, so REACT_APP_CLIENT stays unset.
process.env.REACT_APP_API_BASE_URL = "http://localhost:8000";
process.env.REACT_APP_IMAGE_KIT_PUBLIC_KEY = "test_key";

// jsdom does not implement ResizeObserver, which Recharts' ResponsiveContainer needs
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom does not implement window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
