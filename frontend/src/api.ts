let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let generation = 0;
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function clearToken() {
  generation++;
  accessToken = null;
}
async function send(path: string, options: RequestInit = {}) {
  try {
    return await fetch(path, { ...options, credentials: "include" });
  } catch {
    throw new ApiError(
      0,
      "Unable to reach the server. Check your connection and try again.",
    );
  }
}
async function read(response: Response) {
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "The server returned an unexpected response. Please try again.",
    );
  }
}
async function renew(): Promise<boolean> {
  const observed = generation;
  const response = await send("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "X-Requested-With": "arrowstack-task-web" },
  });
  if (response.status === 401) {
    accessToken = null;
    return false;
  }
  const body = await read(response);
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error?.message ?? "Unable to renew your session. Please try again.",
    );
  if (observed !== generation) return false; // Ignore a response arriving after logout.
  accessToken = body.data.accessToken;
  return true;
}
function coordinatedRenew() {
  // Cookies are shared across tabs; Web Locks prevent them consuming one token concurrently.
  return navigator.locks
    ? navigator.locks.request("arrowstack-tasks-refresh", renew)
    : renew();
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const hadToken = accessToken !== null;
  const headers = new Headers(options.headers);
  headers.set("X-Requested-With", "arrowstack-task-web");
  if (options.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await send("/api/v1" + path, { ...options, headers });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    refreshInFlight ??= coordinatedRenew().finally(() => {
      refreshInFlight = null;
    });
    if (await refreshInFlight) return api<T>(path, options, false);
  }
  const body = await read(response);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/") && hadToken) {
      clearToken();
      window.dispatchEvent(new Event("arrowstack:session-expired"));
    }
    throw new ApiError(
      response.status,
      body?.error?.message ?? "Request failed",
    );
  }
  if (body?.data?.accessToken) accessToken = body.data.accessToken;
  return body?.data as T;
}
