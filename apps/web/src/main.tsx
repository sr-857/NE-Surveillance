import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { applyThemeClass, useThemeStore } from './store/themeStore';
import { bootstrapSession } from './lib/apiClient';
import './styles/globals.css';

applyThemeClass(useThemeStore.getState().theme);
useThemeStore.subscribe((state) => applyThemeClass(state.theme));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Silently attempt to restore a session from the httpOnly refresh cookie
// before the app renders, so an already-logged-in user doesn't flash a
// logged-out state on reload.
void bootstrapSession().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
