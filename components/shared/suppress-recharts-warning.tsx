'use client';

// Suppress known Recharts 2.x defaultProps warning in React 18 development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Support for defaultProps will be removed')) {
      return;
    }
    originalError(...args);
  };
}

export function SuppressRechartsWarning() {
  return null;
}

