---
name: API codegen and Zod compatibility
description: OpenAPI schema choices that keep Orval output compatible with this workspace's installed validation runtime.
---

When extending the shared OpenAPI contract, prefer numeric schemas without the `integer` format unless the workspace validation dependency has been upgraded to support the generated integer helper.

**Why:** The current Orval/Zod combination can emit `z.int()` for OpenAPI integer fields while the installed Zod runtime only exposes the older number APIs, causing the library typecheck to fail after codegen.

**How to apply:** After every OpenAPI change, run the API codegen command and the library typecheck before using the generated client or server schemas.