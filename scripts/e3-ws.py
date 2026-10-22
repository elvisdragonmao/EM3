#!/usr/bin/env python3
"""Read-only E3 web service helper for agents.

Usage: python3 scripts/e3-ws.py <wsfunction> [key=value ...]
       python3 scripts/e3-ws.py core_course_get_contents courseid=25283
       python3 scripts/e3-ws.py mod_assign_get_assignments 'courseids[0]=25283'

Reads E3_USERNAME / E3_PASSWORD from .env.local, exchanges them for a mobile
token and prints the JSON response. Only functions whose verb is get/search/
list/check/can/data are allowed, so it cannot submit, post or mark anything.
"""
import json, os, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGIN = "https://e3p.nycu.edu.tw"
READ_VERBS = {"get", "search", "list", "check", "can", "data"}
WRITES_DISGUISED_AS_READS = {"mod_quiz_get_attempt_data"}


def env():
    out = {}
    with open(os.path.join(ROOT, ".env.local")) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip("'\"")
    return out


def post(path, params):
    req = urllib.request.Request(ORIGIN + path, data=urllib.parse.urlencode(params).encode())
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fn = sys.argv[1]
    parts = fn.split("_")
    if len(parts) < 3 or parts[2] not in READ_VERBS:
        sys.exit(f"refusing {fn}: only read functions ({', '.join(sorted(READ_VERBS))}) are allowed")
    # Named like a read, but it moves an in-progress attempt's current page.
    if fn in WRITES_DISGUISED_AS_READS:
        sys.exit(f"refusing {fn}: it changes state on E3")
    e = env()
    tok = post("/login/token.php", {"username": e["E3_USERNAME"], "password": e["E3_PASSWORD"], "service": "moodle_mobile_app"})
    if "token" not in tok:
        sys.exit(f"login failed: {tok}")
    params = {"wstoken": tok["token"], "wsfunction": fn, "moodlewsrestformat": "json"}
    for arg in sys.argv[2:]:
        k, v = arg.split("=", 1)
        params[k] = v
    print(json.dumps(post("/webservice/rest/server.php", params), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
