# IEEE 118-Bus AC Power-Flow Visual Simulation

A browser-based, local visualization for the supplied IEEE 118-bus AC power-flow snapshot. It uses only static HTML, CSS, and JavaScript, with Python's built-in web server for local serving. There are no packages to install, no build step, and no external services or network connection required.

## Run from Git Bash on Windows

Open Git Bash and paste these commands:

```bash
cd /c/Users/user/Documents/Codex/2026-10-02/referenced-chatgpt-conversation-this-is-an/outputs/ieee118-visual-simulation
python -m http.server 8000 --bind 127.0.0.1
```

If your Python command is named `python3`, use `python3 -m http.server 8000 --bind 127.0.0.1` instead. Open **http://localhost:8000** in a browser. Stop the local server with **Ctrl+C** in Git Bash.

If Python is not installed, this static dashboard can also open directly in your browser:

```bash
explorer.exe "$(cygpath -w "$PWD/index.html")"
```

## What's included

- Interactive SVG schematic containing exactly **118 buses** and **186 branches** (**177 lines** and **9 transformer-styled branches**).
- Bus coloring by voltage, generator and load markers, branch direction arrows, and animated flow dashes.
- Bus selection by clicking the network or voltage profile, keyboard selection, and bus-number search.
- Flow start, pause, and reset controls; a voltage threshold slider; and visibility switches for lines, transformers, generators, and loads.
- Case summary: **54 generators**, **91 loads**, **4,374 MW generation**, **4,242 MW demand**, **132.48 MW real-power losses**, and minimum voltage **0.943 pu at Bus 76**.
- LinkedIn share metadata and a **1200 × 627** preview image (`og-preview.png`).
- A voltage profile, balance display, bus inspector, and a runtime guard for the requested network counts.

## Publish with GitHub Pages

Repository: https://github.com/beloved12-AI/ieee118-visual-simulation  
Expected Pages URL: https://beloved12-ai.github.io/ieee118-visual-simulation/

The repository root should contain `index.html`, `styles.css`, `simulation.js`, `og-preview.png`, and `.github/workflows/deploy-pages.yml`.

1. Set the repository's Pages build source to **GitHub Actions** under **Settings → Pages**.
2. From Git Bash, publish this project folder to that repository:

   ```bash
   cd /c/Users/user/Documents/Codex/2026-10-02/referenced-chatgpt-conversation-this-is-an/outputs/ieee118-visual-simulation
   git init
   git add .
   git commit -m "Publish IEEE 118-bus simulation"
   git branch -M main
   git remote add origin https://github.com/beloved12-AI/ieee118-visual-simulation.git
   git push -u origin main
   ```

3. After the **Deploy static site to GitHub Pages** workflow succeeds, paste https://beloved12-ai.github.io/ieee118-visual-simulation/ into a LinkedIn post. The preview card uses the page's Open Graph tags and `og-preview.png`.

The Actions workflow follows GitHub's static Pages pattern: checkout, configure Pages, upload the static files, and deploy the artifact. The project has no build step.

## Data and scope

The aggregate values above and the reported minimum-voltage bus come from the supplied project brief. The full case bus and branch records were not supplied with it. As a result, the schematic coordinates and branch connections, flow directions and magnitudes, voltage values away from the reported minimum, and per-bus generation and demand are **illustrative**. The displayed branches reproduce the requested counts; they do not claim to reproduce the exact IEEE case topology or branch-by-branch Newton–Raphson solution. No power-flow calculation is run by this front end.

Per-bus illustrative generation and demand allocations sum to the stated aggregate totals for display purposes. The generation and demand headline totals are rounded to whole MW, so their displayed difference is 132 MW while the reported real-power losses are 132.48 MW.

## Files

- `index.html` — dashboard and controls
- `styles.css` — layout, styling, and responsive behavior
- `simulation.js` — deterministic schematic data, SVG rendering, and interactions
- `og-preview.png` — LinkedIn share-card image
- `.github/workflows/deploy-pages.yml` — GitHub Pages deployment workflow
