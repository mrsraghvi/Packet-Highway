# Packet Highway 🛣️

A real-time 3D network traffic visualizer. Packets sniffed from your network
interface are classified into "vehicles" (cars, buses, trucks, motorcycles...)
based on protocol/port, streamed over WebSockets, and animated driving down a
4-lane highway in the browser (one lane per protocol: TCP / UDP / ICMP / Other).
Click any vehicle to inspect the underlying packet's IP/port/size.

## Architecture

```
[Network Interface]
        |
        v
  Scapy sniffer  -->  classify into "vehicle" events  -->  WebSocket broadcast
   (sniffer.py)              (Python)                        (port 8765)
                                                                   |
                                                                   v
                                                React Three Fiber frontend
                                                  (animated highway scene)
```

## Quick Start

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

**Option A — Mock mode (no special permissions, great for UI dev/demo):**
```bash
python3 mock_server.py
```

**Option B — Real packet capture (requires root/admin + libpcap/Npcap):**
```bash
sudo python3 sniffer.py --iface eth0       # Linux/macOS, list interfaces with `ip a` / `ifconfig`
python3 sniffer.py --iface "Wi-Fi"         # Windows, run terminal as Administrator (needs Npcap)
```
Useful flags:
- `--filter "tcp or udp"` — restrict capture with a BPF filter
- `--port 8765` — change the WebSocket port

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173). You should see
vehicles spawning and driving across the highway as packets are
sniffed/generated.

## Vehicle Classification

| Port/Protocol | Vehicle      | Lane  |
|----------------|-------------|-------|
| 443 (HTTPS)    | City Bus    | TCP   |
| 80 (HTTP)      | Car         | TCP   |
| 22 (SSH)       | Bike        | TCP   |
| 25/3389        | Van         | TCP   |
| 53 (DNS)       | Motorcycle  | UDP   |
| ICMP           | Bicycle     | ICMP  |
| size > 1000B   | Truck       | any   |

Tweak `PORT_VEHICLE_MAP` in `backend/sniffer.py` (or `mock_server.py`) to add
your own mappings.

## Roadmap / Ideas for Extending

- [ ] Geo-lookup src/dst IPs and show a mini world map alongside the highway
- [ ] Color-code vehicles by "threat score" using a simple rule engine (e.g. flag known malicious ports)
- [ ] Add a replay mode that loads a `.pcap` file and streams it at adjustable speed
- [ ] Persist stats to a time-series DB (InfluxDB) and add historical charts
- [ ] Swap boxes for actual low-poly vehicle GLTF models
- [ ] Add sound effects / honks for high-traffic bursts
