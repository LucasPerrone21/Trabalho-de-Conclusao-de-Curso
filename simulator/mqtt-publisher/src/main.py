import asyncio
import json
import logging
import os
import random
import signal
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiomqtt

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("simulator")


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class MetricConfig:
    name: str
    unit: str
    min: float
    max: float
    anomaly_min: float
    anomaly_max: float


@dataclass
class DeviceConfig:
    id: str
    alias: str
    type: str
    metrics: list[MetricConfig]


@dataclass
class SimulatorConfig:
    location_id: str
    mqtt_broker_host: str
    mqtt_broker_port: int
    mqtt_username: str
    mqtt_password: str
    publish_interval_ms: int
    anomaly_rate: float
    devices_config_path: str
    devices: list[DeviceConfig] = field(default_factory=list)


def load_config() -> SimulatorConfig:
    config = SimulatorConfig(
        location_id=_require_env("LOCATION_ID"),
        mqtt_broker_host=os.getenv("MQTT_BROKER_HOST", "localhost"),
        mqtt_broker_port=int(os.getenv("MQTT_BROKER_PORT", "1883")),
        mqtt_username=_require_env("MQTT_USERNAME"),
        mqtt_password=_require_env("MQTT_PASSWORD"),
        publish_interval_ms=int(os.getenv("PUBLISH_INTERVAL_MS", "500")),
        anomaly_rate=float(os.getenv("ANOMALY_INJECTION_RATE", "0.05")),
        devices_config_path=os.getenv("DEVICES_CONFIG", "/app/config/devices.json"),
    )

    devices_path = Path(config.devices_config_path)
    if not devices_path.exists():
        raise FileNotFoundError(f"devices config not found: {devices_path}")

    raw = json.loads(devices_path.read_text())
    config.devices = [
        DeviceConfig(
            id=d["id"],
            alias=d["alias"],
            type=d["type"],
            metrics=[
                MetricConfig(
                    name=m["name"],
                    unit=m["unit"],
                    min=m["min"],
                    max=m["max"],
                    anomaly_min=m["anomaly_min"],
                    anomaly_max=m["anomaly_max"],
                )
                for m in d["metrics"]
            ],
        )
        for d in raw["devices"]
    ]

    return config


def _require_env(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise EnvironmentError(f"required environment variable not set: {key}")
    return value


# ---------------------------------------------------------------------------
# Value generation
# ---------------------------------------------------------------------------

def generate_value(metric: MetricConfig, inject_anomaly: bool) -> float:
    """
    Gera um valor para a métrica.

    Modo normal: valor aleatório dentro do range normal do sensor.
    Modo anomalia: valor fora do range normal, dentro dos limites de anomalia.
    """
    if inject_anomaly:
        if random.random() < 0.5 and metric.anomaly_min < metric.min:
            value = random.uniform(metric.anomaly_min, metric.min - 0.1)
        else:
            value = random.uniform(metric.max + 0.1, metric.anomaly_max)
    else:
        value = random.uniform(metric.min, metric.max)

    return round(value, 2)


# ---------------------------------------------------------------------------
# Payload
# ---------------------------------------------------------------------------

def build_payload(
    device_id: str,
    metric: MetricConfig,
    value: float,
) -> dict[str, Any]:
    return {
        "message_id": str(uuid.uuid4()),
        "value": value,
        "unit": metric.unit,
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Simuladores
# ---------------------------------------------------------------------------

class MetricSimulator:
    """
    Simula uma única métrica de um dispositivo.

    Cada métrica tem seu próprio loop e intervalo independente,
    refletindo o comportamento real de sensores físicos que medem
    de forma autônoma — sem esperar outras métricas do mesmo device.
    """

    def __init__(self, device: DeviceConfig, metric: MetricConfig, config: SimulatorConfig):
        self.device = device
        self.metric = metric
        self.config = config
        self._interval = config.publish_interval_ms / 1000.0

    async def run(self, client: aiomqtt.Client) -> None:
        topic = f"{self.config.location_id}/{self.device.id}/{self.metric.name}"

        while True:
            inject_anomaly = random.random() < self.config.anomaly_rate
            value = generate_value(self.metric, inject_anomaly)
            payload = build_payload(self.device.id, self.metric, value)

            await client.publish(
                topic=topic,
                payload=json.dumps(payload),
                qos=1,
            )

            if inject_anomaly:
                logger.warning(
                    "anomaly injected | device=%s metric=%s value=%s (normal range: %s–%s)",
                    self.device.id,
                    self.metric.name,
                    value,
                    self.metric.min,
                    self.metric.max,
                )
            else:
                logger.debug(
                    "published | topic=%s value=%s %s",
                    topic,
                    value,
                    self.metric.unit,
                )

            await asyncio.sleep(self._interval)


class DeviceSimulator:
    """
    Coordena as métricas de um dispositivo.
    Cada métrica sobe como corrotina independente.
    """

    def __init__(self, device: DeviceConfig, config: SimulatorConfig):
        self.device = device
        self.config = config

    def metric_tasks(self, client: aiomqtt.Client) -> list[asyncio.Task]:
        logger.info(
            "device starting | id=%s alias=%s metrics=%s interval=%dms",
            self.device.id,
            self.device.alias,
            [m.name for m in self.device.metrics],
            self.config.publish_interval_ms,
        )
        return [
            asyncio.create_task(MetricSimulator(self.device, metric, self.config).run(client))
            for metric in self.device.metrics
        ]


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main() -> None:
    config = load_config()

    total_metrics = sum(len(d.metrics) for d in config.devices)
    msgs_per_second = total_metrics / (config.publish_interval_ms / 1000.0)

    logger.info(
        "simulator starting | location=%s devices=%d metrics=%d ~%.0f msg/s broker=%s:%d anomaly_rate=%.0f%%",
        config.location_id,
        len(config.devices),
        total_metrics,
        msgs_per_second,
        config.mqtt_broker_host,
        config.mqtt_broker_port,
        config.anomaly_rate * 100,
    )

    # Graceful shutdown
    stop_event = asyncio.Event()

    def _handle_signal(*_: Any) -> None:
        logger.info("shutdown signal received")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _handle_signal)

    async with aiomqtt.Client(
        hostname=config.mqtt_broker_host,
        port=config.mqtt_broker_port,
        username=config.mqtt_username,
        password=config.mqtt_password,
        identifier=f"simulator-{config.location_id}-{uuid.uuid4().hex[:6]}",
    ) as client:
        logger.info("connected to broker %s:%d", config.mqtt_broker_host, config.mqtt_broker_port)

        # Uma task por métrica — todas correm de forma completamente independente
        tasks = [
            task
            for device in config.devices
            for task in DeviceSimulator(device, config).metric_tasks(client)
        ]

        logger.info("started %d metric coroutines", len(tasks))

        await stop_event.wait()

        logger.info("stopping %d tasks...", len(tasks))
        for task in tasks:
            task.cancel()

        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("simulator stopped")


if __name__ == "__main__":
    asyncio.run(main())