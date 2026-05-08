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

    Modo normal: caminhada aleatória dentro do range normal do sensor.
    Modo anomalia: valor fora do range normal, dentro dos limites de anomalia.
    """
    if inject_anomaly:
        # Escolhe aleatoriamente se a anomalia é abaixo do mínimo ou acima do máximo
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
# Publisher
# ---------------------------------------------------------------------------

class DeviceSimulator:
    """Simula um único dispositivo publicando todas as suas métricas."""

    def __init__(self, device: DeviceConfig, config: SimulatorConfig):
        self.device = device
        self.config = config
        self._interval = config.publish_interval_ms / 1000.0

    async def run(self, client: aiomqtt.Client) -> None:
        logger.info(
            "device started | id=%s alias=%s metrics=%s",
            self.device.id,
            self.device.alias,
            [m.name for m in self.device.metrics],
        )

        while True:
            for metric in self.device.metrics:
                inject_anomaly = random.random() < self.config.anomaly_rate
                value = generate_value(metric, inject_anomaly)
                payload = build_payload(self.device.id, metric, value)
                topic = f"{self.config.location_id}/{self.device.id}/{metric.name}"

                await client.publish(
                    topic=topic,
                    payload=json.dumps(payload),
                    qos=1,
                )

                if inject_anomaly:
                    logger.warning(
                        "anomaly injected | device=%s metric=%s value=%s (normal range: %s–%s)",
                        self.device.id,
                        metric.name,
                        value,
                        metric.min,
                        metric.max,
                    )
                else:
                    logger.debug(
                        "published | topic=%s value=%s %s",
                        topic,
                        value,
                        metric.unit,
                    )

            await asyncio.sleep(self._interval)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main() -> None:
    config = load_config()

    logger.info(
        "simulator starting | location=%s devices=%d broker=%s:%d interval=%dms anomaly_rate=%.0f%%",
        config.location_id,
        len(config.devices),
        config.mqtt_broker_host,
        config.mqtt_broker_port,
        config.publish_interval_ms,
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

        # Sobe uma corrotina por device — todos publicam de forma independente
        tasks = [
            asyncio.create_task(DeviceSimulator(device, config).run(client))
            for device in config.devices
        ]

        # Aguarda sinal de shutdown
        await stop_event.wait()

        logger.info("stopping %d device tasks...", len(tasks))
        for task in tasks:
            task.cancel()

        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("simulator stopped")


if __name__ == "__main__":
    asyncio.run(main())
