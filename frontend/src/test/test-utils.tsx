import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthContext, type AuthContextType } from '../contexts/AuthContextValue';

const theme = createTheme();

interface WrapperOptions {
  authValue?: AuthContextType;
  initialEntries?: string[];
}

const defaultAuthValue: AuthContextType = {
  user: { email: 'test@example.com', createdAt: '2024-01-01' },
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
  isAuthenticated: true,
};

function createWrapper(options: WrapperOptions = {}) {
  const { authValue = defaultAuthValue, initialEntries = ['/'] } = options;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <AuthContext.Provider value={authValue}>
            <MemoryRouter initialEntries={initialEntries}>
              {children}
            </MemoryRouter>
          </AuthContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options: WrapperOptions & Omit<RenderOptions, 'wrapper'> = {}
) {
  const { authValue, initialEntries, ...renderOptions } = options;
  return render(ui, {
    wrapper: createWrapper({ authValue, initialEntries }),
    ...renderOptions,
  });
}

export { defaultAuthValue };
