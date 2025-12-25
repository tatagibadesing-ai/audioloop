FROM python:3.11-slim

WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala dependências Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código do backend
COPY backend/ .

# Cria diretório para arquivos temporários
RUN mkdir -p temp_audio

# Variável de ambiente para produção
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Comando para iniciar com gunicorn (mais robusto que flask dev server)
CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 300 app:app
