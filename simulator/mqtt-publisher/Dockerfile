FROM python:3.12-slim

WORKDIR /app

# Dependências primeiro (cache de camadas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código
COPY src/ ./src/

# Config padrão (sobrescrita via volume em runtime)
COPY config/ ./config/

CMD ["python", "src/main.py"]
