#!/usr/bin/env python3
import json
import re
import sys

payload = json.load(sys.stdin)
tool_input = payload.get("tool_input", {})
command = tool_input.get("command", "")

blocked = [
    r"(^|\s)rm\s+-rf\b",
    r"(^|\s)git\s+reset\s+--hard\b",
    r"(^|\s)kubectl\s+(apply|delete)\b",
    r"(^|\s)(psql|mysql)\b.*\b(DELETE|DROP|TRUNCATE|UPDATE)\b",
]

if any(re.search(pattern, command, re.IGNORECASE) for pattern in blocked):
    print("Blocked by project safety policy", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
