"""
Packet Highway - Backend
Sniffs packets on a network interface, classifies them into "vehicle" types
(matching the frontend's WHO'S DRIVING legend), and broadcasts JSON events
to all connected WebSocket clients in real time.

Run with sudo/admin privileges (raw socket access required):
    sudo python3 sniffer.py --iface eth0
    (Windows: run as Administrator, use the Npcap-listed interface name)
"""

import argparse
import asyncio
import json
import threading
import time

from scapy.all import sniff, IP, TCP, UDP, ICMP
from scapy.packet import Packet
import websockets

# ---------------------------------------------------------------------------
# Classification logic: map protocol/port -> "vehicle" for the highway scene
# Vehicle keys must match VEHICLE_CATALOG in frontend/src/Scene.jsx
# ---------------------------------------------------------------------------

TCP_PORT_VEHICLE = {
    443: "city_bus",    # HTTPS
    80:  "box_truck",   # HTTP
    22:  "taxi",        # SSH
    25:  "police_car",  # SMTP
    3389: "police_car", # RDP
}

UDP_PORT_VEHICLE = {
    53:   "motorcycle",  # DNS
    443:  "sports_car",  # QUIC / HTTP3 commonly runs over UDP/443
    67:   "panel_van",   # DHCP
    68:   "panel_van",
}

START_TIME = time.time()
TOTAL_IN = 0
TOTAL_OUT = 0


def classify_packet(pkt: Packet):
    """Turn a scapy packet into a lightweight JSON-serializable event."""
    global TOTAL_IN, TOTAL_OUT

    if not pkt.haslayer(IP):
        return None

    ip_layer = pkt[IP]
    size = len(pkt)
    src = ip_layer.src
    dst = ip_layer.dst

    proto = "OTHER"
    sport = dport = None
    vehicle = "hatchback"
    lane_parity = 0  # 0 = inbound (even lanes), 1 = outbound (odd lanes)

    if pkt.haslayer(TCP):
        proto = "TCP"
        sport, dport = pkt[TCP].sport, pkt[TCP].dport
        vehicle = (TCP_PORT_VEHICLE.get(dport) or TCP_PORT_VEHICLE.get(sport)
                   or ("hatchback" if size < 200 else "sedan"))
        lane_parity = 1 if dport in TCP_PORT_VEHICLE else 0
    elif pkt.haslayer(UDP):
        proto = "UDP"
        sport, dport = pkt[UDP].sport, pkt[UDP].dport
        vehicle = (UDP_PORT_VEHICLE.get(dport) or UDP_PORT_VEHICLE.get(sport)
                   or "motorcycle")
        lane_parity = 1
    elif pkt.haslayer(ICMP):
        proto = "ICMP"
        vehicle = "bicycle"
        lane_parity = 0

    # Large payloads -> box_truck, regardless of port (e.g. file transfers)
    if size > 1000:
        vehicle = "box_truck"

    # lane: even index = inbound carriageway, odd = outbound
    base_lane = {"TCP": 0, "UDP": 1, "ICMP": 2, "OTHER": 3}.get(proto, 3)
    lane = base_lane * 2 + lane_parity

    if lane_parity == 0:
        TOTAL_IN += size
    else:
        TOTAL_OUT += size

    return {
        "type": "packet",
        "vehicle": vehicle,
        "protocol": proto,
        "lane": lane,
        "src": src,
        "dst": dst,
        "sport": sport,
        "dport": dport,
        "size": size,
        "speed": min(max(size / 100, 1), 20),  # clamp 1-20 for animation use
        "ts": time.time(),
        "uptime": time.time() - START_TIME,
        "totalIn": TOTAL_IN,
        "totalOut": TOTAL_OUT,
    }


# ---------------------------------------------------------------------------
# WebSocket broadcast server
# ---------------------------------------------------------------------------

CONNECTED_CLIENTS = set()
EVENT_LOOP = None


async def handler(websocket):
    CONNECTED_CLIENTS.add(websocket)
    print(f"[+] Client connected ({len(CONNECTED_CLIENTS)} total)")
    try:
        async for _ in websocket:
            pass  # we don't expect messages from the frontend
    finally:
        CONNECTED_CLIENTS.discard(websocket)
        print(f"[-] Client disconnected ({len(CONNECTED_CLIENTS)} total)")


async def broadcast(message: str):
    if CONNECTED_CLIENTS:
        await asyncio.gather(
            *(ws.send(message) for ws in list(CONNECTED_CLIENTS)),
            return_exceptions=True,
        )


def packet_callback(pkt: Packet):
    """Runs in scapy's sniff thread - hands off to the asyncio loop."""
    event = classify_packet(pkt)
    if event is None or EVENT_LOOP is None:
        return
    message = json.dumps(event)
    asyncio.run_coroutine_threadsafe(broadcast(message), EVENT_LOOP)


def start_sniffing(iface, bpf_filter):
    sniff(iface=iface, filter=bpf_filter, prn=packet_callback, store=False)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main(iface, bpf_filter, host, port):
    global EVENT_LOOP
    EVENT_LOOP = asyncio.get_running_loop()

    sniff_thread = threading.Thread(
        target=start_sniffing, args=(iface, bpf_filter), daemon=True
    )
    sniff_thread.start()

    print(f"[*] WebSocket server listening on ws://{host}:{port}")
    print(f"[*] Sniffing on iface={iface or 'default'} filter='{bpf_filter}'")
    async with websockets.serve(handler, host, port):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Packet Highway sniffer/server")
    parser.add_argument("--iface", default=None, help="Network interface to sniff")
    parser.add_argument("--filter", default="ip", help="BPF filter (default: 'ip')")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    asyncio.run(main(args.iface, args.filter, args.host, args.port))
