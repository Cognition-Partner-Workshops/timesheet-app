/**
 * @fileoverview Application Entry Point
 * 
 * This is the main entry point for the React application. It handles the initialization
 * of the React root and mounts the application to the DOM.
 * 
 * Key responsibilities:
 * - Locates the root DOM element where the React app will be mounted
 * - Creates a React root using the modern createRoot API (React 18+)
 * - Wraps the application in StrictMode for development best practices
 * - Renders the main App component into the DOM
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * Initialize and mount the React application.
 * 
 * This code performs the following steps:
 * 
 * 1. **DOM Element Selection**: 
 *    Locates the HTML element with id="root" in index.html where the React app will mount.
 *    The non-null assertion operator (!) is used because we guarantee this element exists
 *    in our HTML template.
 * 
 * 2. **React Root Creation**:
 *    Uses createRoot() from React 18's concurrent rendering API. This enables:
 *    - Automatic batching of state updates for better performance
 *    - Concurrent rendering features like Suspense and transitions
 *    - Improved error handling and recovery
 * 
 * 3. **StrictMode Wrapper**:
 *    Wraps the application in React.StrictMode, which:
 *    - Identifies components with unsafe lifecycles
 *    - Warns about legacy string ref API usage
 *    - Detects unexpected side effects by double-invoking certain functions
 *    - Warns about deprecated findDOMNode usage
 *    - Ensures reusable state (React 18+)
 *    Note: StrictMode checks run in development only and don't impact production builds
 * 
 * 4. **App Rendering**:
 *    Renders the root App component, which contains all application routes,
 *    state management, and UI components.
 * 
 * @see {@link https://react.dev/reference/react-dom/client/createRoot} - React createRoot API
 * @see {@link https://react.dev/reference/react/StrictMode} - React StrictMode documentation
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
