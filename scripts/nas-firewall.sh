#!/bin/sh
# AnaHon NAS host firewall — reapplied at every boot by a TrueNAS POSTINIT
# init/shutdown script, because TrueNAS SCALE does NOT persist manual iptables
# changes across reboots: they are applied live and lost on the next reboot.
#
# Intent: the NAS answers only loopback, established replies, the tailnet
# (tailscale0 — the app.anahon.online door reaches the FMS this way), the office
# LAN (192.168.1.0/24), ICMP, and its own Docker container bridges. Everything
# else — the public internet — is DROPPED. There is no internet-facing IPv6 on
# this box (the only global v6 is the Tailscale ULA, and there is no v6 default
# route), so IPv4 is the whole boundary.
#
# Idempotent and fail-safe: the policy is set to ACCEPT and INPUT flushed FIRST,
# so a partial run leaves the box reachable rather than locked out; the DROP is
# the last line added. Safe to run by hand any time to re-assert the rules.
#
# CAVEAT: the br-* names below are the current Docker bridge ids. If the Docker
# networks are ever recreated (rare — only on a compose network change), refresh
# them from `iptables -S INPUT` and re-save this file.
set -e
IPT=/usr/sbin/iptables
$IPT -P INPUT ACCEPT
$IPT -F INPUT
$IPT -A INPUT -i lo -j ACCEPT
$IPT -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
$IPT -A INPUT -i tailscale0 -j ACCEPT
$IPT -A INPUT -s 192.168.1.0/24 -j ACCEPT
$IPT -A INPUT -p icmp -j ACCEPT
$IPT -A INPUT -i br-5577510cdae4 -j ACCEPT
$IPT -A INPUT -i br-7e618eb9ac4d -j ACCEPT
$IPT -A INPUT -i br-fe24ae866b6a -j ACCEPT
$IPT -A INPUT -i docker0 -j ACCEPT
$IPT -A INPUT -j DROP
