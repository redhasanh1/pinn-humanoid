# robotai

An open-source AI home-helper robot, built by students in Toronto over 16 weeks.
Phase 1 is two 3D-printed robotic hands. Phase 2 is a two-arm mobile robot that learns its skills in physics simulation first, and we'll be using Cerebras's fast inference for its planning.

**Live site:** https://site-production-8e40.up.railway.app (Railway, redeploys on every push to `main`)

## Update the site
| What | Edit | Then |
|---|---|---|
| Parts / prices | `data/bom.json` | `python tools/build_bom.py` to rebuild `robotai_BOM.xlsx` |
| Roadmap progress | `data/roadmap.json` (`"done": true`) | nothing |
| Research | `research/*.md` | new files: add to `DOCS` in `site/app.js` |

Run locally: `npm start`, then open http://localhost:3000
