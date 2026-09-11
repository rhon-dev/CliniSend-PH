import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App routing shell', () => {
  it('renders the public login placeholder at the root redirect', () => {
    window.history.pushState({}, '', '/login');
    render(<App />);
    expect(screen.getByRole('heading', { name: /staff login/i })).toBeInTheDocument();
  });

  it('redirects a protected route to login when no session role is present', () => {
    window.history.pushState({}, '', '/admin');
    render(<App />);
    // No session role in the scaffold, so the guard sends us to login.
    expect(screen.getByRole('heading', { name: /staff login/i })).toBeInTheDocument();
  });
});
