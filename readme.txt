ux-guru — quick local developer notes

This repo has three main parts you run locally:

- GUI: a Vite React app for live preview and controls
- tracking-script: the script that gets injected into pages (build -> dist/tracker.js)
- ws-event-server: a simple WebSocket server used for communication

Quick start (macOS / zsh)

1) GUI (dev UI)

  cd gui
  npm install
  npm run dev

  - Open the app at: http://localhost:5173

2) Build and serve the tracking script

  cd tracking-script
  npm install
  npm run build --silent

  # Serve the built files from dist (for local testing)
  cd dist
  python3 -m http.server 4500 --bind 127.0.0.1

  # Inject the tracker into any page (bookmarklet)
  javascript:(function(){
    var s=document.createElement('script');
    s.src='http://127.0.0.1:4500/tracker.js';
    document.head.appendChild(s);
  })();

3) WebSocket server

  cd ws-event-server
  npm install
  npm run dev

  - The server logs its port on startup. Keep it running while using the GUI + tracker.

Testing and demo

- Open `demo.html` (served with VS Code Live Server or any static server) to test the tracker injection.
- Or open the GUI at http://localhost:5173 and use the bookmarklet to load the local `tracker.js` into any web page.

Troubleshooting

- If ports are in use, change the python server port (4500) or the dev server ports.
- If the GUI doesn't load, run `npm install` in `gui` and check the terminal for Vite errors.
- If the tracker is not loading, ensure the `python3 -m http.server` is serving `dist/tracker.js` and the bookmarklet URL matches.

Notes

- These are minimal local dev instructions. The project contains TypeScript + Vite configs under `gui` and `tracking-script`.
- Use `npm run build` in `tracking-script` to generate production artifacts in `tracking-script/dist`.

Happy hacking.
