import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage for jsdom if needed
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock Geolocation for browser environment
const geolocationMock = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(() => 101),
  clearWatch: vi.fn(),
};

Object.defineProperty(navigator, 'geolocation', {
  value: geolocationMock,
  writable: true,
  configurable: true,
});


