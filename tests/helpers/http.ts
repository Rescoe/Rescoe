import type { NextApiRequest, NextApiResponse } from "next";

/** Requête/réponse minimales pour appeler directement un handler d'API Next (sans serveur). */
export interface MockOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | string[]>;
  remoteAddress?: string;
}

export function mockReq(opts: MockOptions = {}): NextApiRequest {
  const headers: Record<string, string> = { host: "localhost:3000", "content-type": "application/json" };
  for (const [k, v] of Object.entries(opts.headers ?? {})) headers[k.toLowerCase()] = v;
  return {
    method: opts.method ?? "POST",
    headers,
    body: opts.body,
    query: opts.query ?? {},
    socket: { remoteAddress: opts.remoteAddress ?? "203.0.113.7" },
  } as unknown as NextApiRequest;
}

export interface MockRes {
  res: NextApiResponse;
  readonly status: number;
  readonly body: any;
  readonly headers: Record<string, string>;
  readonly text: string;
}

export function mockRes(): MockRes {
  const state = { status: 200, body: undefined as any, headers: {} as Record<string, string>, text: "" };
  const res: any = {
    setHeader(k: string, v: string) {
      state.headers[k.toLowerCase()] = String(v);
      return res;
    },
    status(code: number) {
      state.status = code;
      return res;
    },
    json(b: unknown) {
      state.body = b;
      return res;
    },
    send(b: unknown) {
      state.text = String(b);
      return res;
    },
    end() {
      return res;
    },
  };
  return {
    res: res as NextApiResponse,
    get status() { return state.status; },
    get body() { return state.body; },
    get headers() { return state.headers; },
    get text() { return state.text; },
  };
}

/** Appelle un handler et retourne la réponse capturée. */
export async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  opts: MockOptions = {}
) {
  const r = mockRes();
  await handler(mockReq(opts), r.res);
  return r;
}
