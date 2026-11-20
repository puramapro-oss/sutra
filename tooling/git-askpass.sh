#!/bin/sh
# Used only by Git on the CI runner. Never invoke directly or enable shell tracing.
case "$1" in
  "Username for 'https://github.com': "|"Password for 'https://x-access-token@github.com': ") ;;
  *) exit 1 ;;
esac
case "$1" in
  Username*) printf '%s\n' 'x-access-token' ;;
  Password*) printf '%s\n' "$SMARANA_READ_TOKEN" ;;
  *) exit 1 ;;
esac
