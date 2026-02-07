# Home routes

Home area for friends, DMs, and server chat.

- `page.tsx` : friends list and quick actions
- `add/` : add friend view
- `dm/[id]/` : direct message thread
- `[id]/` : server view (channels + members + chat)

The UI relies on WebSocket events via `components/home/home-ws-provider`.
