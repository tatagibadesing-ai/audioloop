# AudioLoop — Contexto do Projeto

## Estrutura

- `frontend/` — app React + Vite (o frontend ativo)
- `backend/` — API Flask (Python) rodando no Vultr
- Raiz (`/`) — projeto Next.js legado, não usado em produção

## Deploy do Backend (Vultr)

O backend roda em um servidor VPS Vultr acessado via SSH:

```bash
ssh root@api.audioloop.com.br
```

A senha fica com o usuário (não salva aqui). Após conectar, para atualizar o `app.py`:

```bash
# No servidor:
cd /caminho/do/backend   # descobrir com: find / -name "app.py" 2>/dev/null | grep -v venv
cp app.py app.py.bak     # backup antes de editar
# editar ou substituir o app.py
systemctl restart audioloop   # ou o nome do serviço — verificar com: systemctl list-units --type=service | grep audio
```

Para descobrir o serviço ativo:
```bash
systemctl list-units --type=service --state=running
ps aux | grep python
```

## Deploy do Frontend

O frontend é estático — gerado com Vite e hospedado separadamente (Vercel ou similar).
O GitHub recebe apenas o build estático.

```bash
cd frontend
npm run build:web       # gera dist/
npx cap sync android    # sincroniza com Android
```

## APK Android

Projeto configurado com Capacitor v8.

```bash
cd frontend
npm run build:web && npx cap sync android

# Compilar APK debug (requer JDK 21 e Android SDK):
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" \
ANDROID_HOME="/c/Users/victo/AppData/Local/Android/Sdk" \
PATH="/c/Program Files/Android/Android Studio/jbr/bin:$PATH" \
./gradlew assembleDebug
```

APK gerado em: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

## Backend — CORS

O Nginx do Vultr trata CORS para origens web.
O Flask tem handler manual para `capacitor://localhost` (app Android).
Não ativar `flask_cors` global para não duplicar headers com o Nginx.
