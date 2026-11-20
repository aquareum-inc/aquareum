import { NextResponse } from "next/server";

import { OPERATIONS } from "@/lib/public-api/operations";

/** An index of the API, readable without a key, so an agent can discover what it can do. */
export function GET() {
  return NextResponse.json({
    auth: "Authorization: Bearer <API key>",
    mcp: "/api/mcp",
    operations: OPERATIONS.map(({ name, description, method, path, input, operator, public: open }) => ({
      name,
      description,
      method,
      path: `/api/v1${path}`,
      input,
      ...(operator ? { role: "operator" } : {}),
      ...(open ? { auth: "none" } : {}),
    })),
  });
}
