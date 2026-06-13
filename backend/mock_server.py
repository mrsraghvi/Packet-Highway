"""
Mock Packet Highway server - generates fake packet events at random
intervals so you can develop/demo the frontend without sudo/root
or real network capture permissions.

Run:
    python3 mock_server.py
"""

import asyncio
import json
import random
import time

import websockets

# vehicle -> protocol, matches frontend VEHICLE_CATALOG
VEHICLE_PROTO = {
    "city_bus":   "HTTPS",
    "sports_car": "QUIC",
    "box_truck":  "HTTP",
    "motorcycle": "DNS",
    "taxi":       "SSH",
    "sedan":      "TLS",
    "panel_van":  "ICMP",
    "police_car": "SMTP",
    "bicycle":    "ARP",
    "hatchback":  "OTHER",
}
VEHICLES = list(VEHICLE_PROTO.keys())

CONNECTED_CLIENTS = set()
START_TIME = time.time()
TOTAL_IN = 0
TOTAL_OUT = 0


def random_ip():
    return ".".join(str(random.randint(1, 254)) for _ in range(4))


def random_event():
    global TOTAL_IN, TOTAL_OUT
    vehicle = random.choice(VEHICLES)
    proto = VEHICLE_PROTO[vehicle]
    size = random.randint(40, 1500)
    lane = random.randint(0, 7)  # even = inbound, odd = outbound
    if lane % 2 == 0:
        TOTAL_IN += size
    else:
        TOTAL_OUT += size
    return {
        "type": "packet",
        "vehicle": vehicle,
        "protocol": proto,
        "lane": lane,
        "src": random_ip(),
        "dst": random_ip(),
        "sport": random.randint(1024, 65535),
        "dport": random.choice([80, 443, 53, 22, 25, 3389, 8080]),
        "size": size,
        "speed": min(max(size / 100, 1), 20),
        "ts": time.time(),
        "uptime": time.time() - START_TIME,
        "totalIn": TOTAL_IN,
        "totalOut": TOTAL_OUT,
    }


async def handler(websocket):
    CONNECTED_CLIENTS.add(websocket)
    print(f"[+] Client connected ({len(CONNECTED_CLIENTS)} total)")
    try:
        async for _ in websocket:
            pass
    finally:
        CONNECTED_CLIENTS.discard(websocket)
        print(f"[-] Client disconnected ({len(CONNECTED_CLIENTS)} total)")


async def broadcaster():
    while True:
        await asyncio.sleep(random.uniform(0.04, 0.18))
        if CONNECTED_CLIENTS:
            message = json.dumps(random_event())
            await asyncio.gather(
                *(ws.send(message) for ws in list(CONNECTED_CLIENTS)),
                return_exceptions=True,
            )


async def main():
    print("[*] Mock WebSocket server on ws://localhost:8765")
    asyncio.create_task(broadcaster())
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
