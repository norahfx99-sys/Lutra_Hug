#!/usr/bin/env bash
# Joins an emulator and a real phone for the DEV-ONLY TCP sync transport (see devTcpTransport.ts).
# Usage: scripts/dev-sync-link.sh <inviter-serial> <joiner-serial>
#   The INVITER is the phone that already has the family (taps "Mời điện thoại thứ hai").
#   The JOINER is the phone that has no family yet (onboarding -> "Tham gia bằng đồng bộ gần").
set -euo pipefail
ADB="${ADB:-adb}"
inviter="${1:?inviter serial}"; joiner="${2:?joiner serial}"
$ADB -s "$inviter" forward tcp:7766 tcp:7766   # host:7766 -> inviter's listener
$ADB -s "$joiner" reverse tcp:7767 tcp:7766    # joiner:7767 -> host:7766
# Metro for the debug builds
for s in "$inviter" "$joiner"; do $ADB -s "$s" reverse tcp:8081 tcp:8081; done
echo "linked: $joiner --(127.0.0.1:7767)--> host:7766 --> $inviter:7766"
