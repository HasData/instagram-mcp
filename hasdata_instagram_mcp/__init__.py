"""Thin launcher for HasData's hosted Instagram MCP server.

Connects an MCP client to the remote streamable-HTTP endpoint through mcp-proxy.
The server runs on HasData's infrastructure; this package only proxies stdio to it.
"""
import os
import sys
import subprocess

URL = "https://mcp.hasdata.com/api/mcp?apis=instagram"


def main() -> None:
    key = os.environ.get("HASDATA_API_KEY")
    if not key:
        sys.stderr.write(
            "HASDATA_API_KEY is not set. Create a free key at https://app.hasdata.com "
            "and set HASDATA_API_KEY.\n"
        )
        raise SystemExit(1)
    args = [
        sys.executable, "-m", "mcp_proxy", URL,
        "--transport=streamablehttp",
        "--headers", "x-api-key", key,
    ]
    rc = subprocess.call(args)
    # subprocess returns -N when mcp_proxy is killed by signal N; map to 128+N.
    raise SystemExit(rc if rc >= 0 else 128 - rc)
