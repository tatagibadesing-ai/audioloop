import urllib.request
import urllib.parse
import json

# Simples requisição POST multipart (difícil com urllib puro, então vou testar apenas health check primeiro)
# Na verdade, vou verificar os logs do backend, pois tentei o upload antes.

print("Testando upload simplificado só pra ver se bate no backend...")
