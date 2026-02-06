export function getBackendHttpUrl() {
  const env =
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:3001";
  return env.replace(/\/$/, "");
}

export function getBackendWsUrl() {
  const http = getBackendHttpUrl();
  return http.startsWith("https")
    ? http.replace(/^https/, "wss")
    : http.replace(/^http/, "ws");
}
