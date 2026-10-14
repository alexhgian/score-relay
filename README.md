# Score relay

A tiny WebSocket relay. Mat-side scorers post score updates and viewers in the same room receive them.

- **Scorers** connect with `?room=<room>&key=<RELAY_KEY>`.
- **Viewers** connect with `?room=<room>` and can only listen.
- **Late joiners** get each mat's latest update straight away, if it's under 20 s old.

Run locally:
```bash
npm install
RELAY_KEY=change-me node server.js
```

Deploy: [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/alexhgian/score-relay). `render.yaml` creates a free web service and asks for `RELAY_KEY`.
