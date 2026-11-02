import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { syncAuthTokenFromUrl } from "@/lib/api";

// The production build prerenders only the home route into #root. Reusing that
// markup on deep links (for example /admin) makes React hydrate the wrong page
// and triggers minified React error #418. Hydrate only the route that was
// prerendered; deep links must start with a clean client render.
const rootEl = document.getElementById("root")!;

async function bootstrap() {
  await syncAuthTokenFromUrl();

  if (window.location.pathname === "/" && rootEl.hasChildNodes()) {
    hydrateRoot(rootEl, <App />);
    return;
  }

  rootEl.replaceChildren();
  createRoot(rootEl).render(<App />);
}

void bootstrap();
