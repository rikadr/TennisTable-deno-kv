// Jest setup file - runs before all tests

// Set up environment variables for tests
process.env.REACT_APP_CLIENT = "optio";
process.env.REACT_APP_API_BASE_URL = "http://localhost:8000";
process.env.REACT_APP_IMAGE_KIT_PUBLIC_KEY = "test_key";

// You can also set up global mocks here
// For example, if you need to mock window.matchMedia:
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

// Mock localStorage if needed
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;
