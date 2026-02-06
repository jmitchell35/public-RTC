export type Server = { id: string; name: string; icon: string; notif?: number };

export const servers: Server[] = [
  { id: "t", name: "Team T", notif: 0, icon: "T" },
  { id: "flame", name: "Flame", notif: 0, icon: "🔥" },
  { id: "shield", name: "Shield", notif: 1, icon: "🛡️" },
  { id: "planet", name: "Cosmos", notif: 0, icon: "🌐" },
  { id: "rocket", name: "Launch", notif: 3, icon: "🚀" },
  { id: "cube", name: "Blocks", notif: 0, icon: "🧊" },
];
