"""
Backend API para geração de Audiobooks usando edge-tts e Google Cloud TTS
Gera arquivos MP3 com vozes neurais da Microsoft e Google
Integração com Supabase para autenticação e banco de dados
"""

import os
import uuid
import asyncio
import time
import io
import jwt
import base64
import threading
from functools import wraps
from flask import Flask, request, jsonify, send_file, after_this_request
# from flask_cors import CORS
import edge_tts

# Google Cloud TTS
try:
    from google.cloud import texttospeech
    GOOGLE_TTS_ENABLED = True
    print("✅ Google Cloud TTS disponível!")
except ImportError:
    GOOGLE_TTS_ENABLED = False
    print("⚠️ Google Cloud TTS não instalado.")

import sqlite3
from datetime import datetime

# Configuração de Armazenamento Local
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
COVERS_DIR = os.path.join(UPLOADS_DIR, 'covers')
AUDIO_UPLOADS_DIR = os.path.join(UPLOADS_DIR, 'audiobooks')
DB_PATH = os.path.join(BASE_DIR, 'audiobooks.db')

# Cria diretórios se não existirem
os.makedirs(COVERS_DIR, exist_ok=True)
os.makedirs(AUDIO_UPLOADS_DIR, exist_ok=True)

def init_db():
    """Inicializa o banco de dados SQLite local"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audiobooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            cover_url TEXT,
            category_id INTEGER,
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audiobook_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audiobook_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            audio_url TEXT NOT NULL,
            duration_seconds REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
        )
    ''')
    
    # Migração: Se houver áudios na tabela principal, vamos movê-los para tracks
    cursor.execute("PRAGMA table_info(audiobooks)")
    cols = [c[1] for c in cursor.fetchall()]
    if 'audio_url' in cols:
        print("🔄 Migrando áudios existentes para audiobook_tracks...")
        cursor.execute("SELECT id, audio_url, duration_seconds FROM audiobooks WHERE audio_url IS NOT NULL")
        existing = cursor.fetchall()
        for row in existing:
            cursor.execute('''
                INSERT INTO audiobook_tracks (audiobook_id, label, audio_url, duration_seconds)
                VALUES (?, ?, ?, ?)
            ''', (row[0], 'Versão Original', row[1], row[2]))
        
        # Opcional: remover colunas antigas (Sqlite não suporta DROP COLUMN em versões velhas, 
        # mas podemos apenas ignorar ou criar nova tabela)
        # Por segurança no ambiente de produção do usuário, vamos apenas manter mas ignorar.
        print(f"✅ Migrados {len(existing)} áudios!")
        
    conn.commit()
    conn.close()
    print("✅ Banco de dados SQLite inicializado!")

init_db()

# Mantemos as variáveis SUPABASE apenas para não quebrar referências se houverem, 
# mas marcamos como False para desativar a lógica antiga.
SUPABASE_ENABLED = False
# O JWT Secret será mantido fixo para o login de admin continuar funcionando sem o Supabase
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', 'xt9aS00eMoQzMeJrL5z8xi1P6FecByFu1eGmjV/K6/gcOanQ4vPNc5wDM+7w0TG7/dzpuuFZWMK4I265CEp/iw==')

# Imports para leitura de documentos
try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

try:
    import docx
    DOCX_SUPPORT = True
except ImportError:
    DOCX_SUPPORT = False


app = Flask(__name__)
# CORS desativado no Flask pois o Nginx já gerencia os headers (evita erro '*, *')
# CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# CORS já é tratado pela extensão flask_cors na linha 86
# Removido o after_request manual para evitar duplicação de headers (erro de "multiple values '*, *'")
# @app.after_request
# def after_request(response):
#     return response


# Diretório para arquivos temporários
TEMP_DIR = os.path.join(os.path.dirname(__file__), 'temp_audio')
os.makedirs(TEMP_DIR, exist_ok=True)

# ==================== SISTEMA DE JOBS EM BACKGROUND ====================
# Armazena o status dos jobs de geração de áudio
# Formato: { job_id: { 'status': 'pending'|'processing'|'done'|'error', 'progress': 0-100, 'file_path': str, 'error': str } }
JOBS = {}


# ==================== VOZES DISPONÍVEIS ====================

# Vozes Edge-TTS (Microsoft) - Gratuito e Ilimitado
EDGE_VOICES = {
    'pt-BR-AntonioNeural': {'label': 'Antonio BR', 'provider': 'edge'},
    'pt-BR-FranciscaNeural': {'label': 'Francisca BR', 'provider': 'edge'},
    'pt-BR-ThalitaMultilingualNeural': {'label': 'Thalita BR', 'provider': 'edge'},
    'pt-PT-DuarteNeural': {'label': 'Duarte PT', 'provider': 'edge'},
    'pt-PT-RaquelNeural': {'label': 'Raquel PT', 'provider': 'edge'},
    'en-US-GuyNeural': {'label': 'Guy EN', 'provider': 'edge'},
    'en-US-JennyNeural': {'label': 'Jenny EN', 'provider': 'edge'},
}

# Vozes Google Cloud TTS - 1M chars/mês grátis
# Nota: Google só tem 1 voz masculina pt-BR (Wavenet-B e Neural2-B são a mesma voz com processamento diferente)
GOOGLE_VOICES = {
    'pt-BR-Neural2-B': {'label': 'Bruno BR', 'provider': 'google', 'ssml_gender': 'MALE'},
    'pt-BR-Neural2-A': {'label': 'Julia BR', 'provider': 'google', 'ssml_gender': 'FEMALE'},
    'pt-BR-Wavenet-C': {'label': 'Fernanda BR', 'provider': 'google', 'ssml_gender': 'FEMALE'},
}

# Combina todas as vozes
AVAILABLE_VOICES = {**EDGE_VOICES}
GOOGLE_API_KEY = os.environ.get('GOOGLE_TTS_API_KEY', '')
if GOOGLE_API_KEY:
    AVAILABLE_VOICES.update(GOOGLE_VOICES)
    print("✅ Vozes Google Cloud TTS habilitadas!")

# Textos de preview para cada idioma
PREVIEW_TEXTS = {
    'pt-BR': 'Olá! Ouça como soa a minha voz no AudioLoop.',
    'pt-PT': 'Olá! Ouça como soa a minha voz no AudioLoop.',
    'en-US': 'Hello! This is a sample of my voice.',
}


# ==================== FUNÇÕES DE GERAÇÃO DE ÁUDIO ====================

async def generate_audio_edge(text: str, voice: str, output_path: str):
    """Gera áudio usando Edge-TTS (Microsoft)"""
    try:
        # Simplificado para evitar erros de 'Invalid pitch'. 
        # O edge-tts já gera áudio otimizado por padrão.
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
    except Exception as e:
        print(f"❌ Erro no edge-tts: {str(e)}")
        raise e


def split_text_for_google(text, limit=4500):
    """Divide o texto em chunks respeitando o limite de bytes do Google"""
    chunks = []
    current_chunk = ""
    
    # Normaliza quebras de linha
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Divide primeiro por parágrafos para preservar estrutura
    paragraphs = text.split('\n')
    
    for para in paragraphs:
        if not para.strip():
            continue
            
        # Se adicionar o parágrafo estourar o limite
        if len((current_chunk + "\n" + para).encode('utf-8')) > limit:
            # Se tem algo no buffer, salva
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = ""
            
            # Se o parágrafo sozinho é maior que o limite, divide por frases
            if len(para.encode('utf-8')) > limit:
                import re
                # Split por pontuação final (. ? !)
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sent in sentences:
                    if len((current_chunk + " " + sent).encode('utf-8')) > limit:
                        if current_chunk:
                            chunks.append(current_chunk)
                            current_chunk = ""
                        # Se a frase sozinha é gigante (muito raro), corta na força bruta
                        if len(sent.encode('utf-8')) > limit:
                             # Corta a cada limit caracteres (aproximado)
                             while sent:
                                 part = sent[:limit]
                                 # Tenta não cortar palavra no meio
                                 last_space_idx = part.rfind(' ')
                                 if last_space_idx > limit - 100:
                                     part = sent[:last_space_idx]
                                     sent = sent[last_space_idx:].strip()
                                 else:
                                     # Se não achar espaço, corta bruto
                                     sent = sent[len(part):].strip()
                                 chunks.append(part)
                        else:
                            current_chunk = sent
                    else:
                        current_chunk += (" " if current_chunk else "") + sent
            else:
                current_chunk = para
        else:
            current_chunk += ("\n" if current_chunk else "") + para
            
    if current_chunk:
        chunks.append(current_chunk)
        
    return chunks


def generate_audio_google(text: str, voice_name: str, output_path: str, job_id: str = None):
    """Gera áudio usando Google Cloud TTS via REST API com suporte a textos longos"""
    import requests
    import base64
    
    # Função auxiliar para atualizar progresso
    def update_progress(p):
        if job_id and job_id in JOBS:
            JOBS[job_id]['progress'] = p

    GOOGLE_API_KEY = os.environ.get('GOOGLE_TTS_API_KEY', '')
    
    if not GOOGLE_API_KEY:
        raise Exception("GOOGLE_TTS_API_KEY não configurada")
    
    try:
        # Configuração da voz
        language_code = voice_name.split('-')[0] + '-' + voice_name.split('-')[1]  # ex: pt-BR
        
        # URL API REST
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={GOOGLE_API_KEY}"
        
        # Divide o texto em pedaços seguros
        chunks = split_text_for_google(text)
        combined_audio = b""
        
        print(f"🔄 Processando {len(chunks)} partes com Google TTS...", flush=True)
        
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue

            # Atualiza progresso real (ex: de 5% a 95%)
            real_progress = 5 + int((i / len(chunks)) * 90)
            update_progress(real_progress)
            
            # Payload para a API
            payload = {
                "input": {"text": chunk},
                "voice": {
                    "languageCode": language_code,
                    "name": voice_name
                },
                "audioConfig": {
                    "audioEncoding": "MP3",
                    "sampleRateHertz": 24000,
                    "speakingRate": 1.0,
                    "pitch": 0.0
                }
            }
            
            # Chamada à API
            response = requests.post(url, json=payload)
            
            if response.status_code != 200:
                error_msg = response.json().get('error', {}).get('message', 'Erro desconhecido')
                print(f"❌ Erro no chunk {i+1}: {error_msg}")
                raise Exception(f"Google TTS API error (Chunk {i+1}): {error_msg}")
            
            # Decodifica e concatena
            chunk_content = base64.b64decode(response.json()['audioContent'])
            combined_audio += chunk_content
            
            # Log de progresso
            print(f"✅ Chunk {i+1}/{len(chunks)} recebido ({len(chunk_content)} bytes)", flush=True)
            
        # Salva o arquivo final
        with open(output_path, "wb") as out:
            out.write(combined_audio)
            
        update_progress(100)
        print(f"✅ Áudio Google gerado e combinado: {voice_name} ({len(chunks)} partes)")
        
    except Exception as e:
        print(f"❌ Erro no Google TTS: {str(e)}")
        raise e


def generate_audio(text: str, voice: str, output_path: str, job_id: str = None):
    """Função principal que escolhe o provedor correto"""
    voice_config = AVAILABLE_VOICES.get(voice, {})
    provider = voice_config.get('provider', 'edge') if isinstance(voice_config, dict) else 'edge'
    
    if provider == 'google' and os.environ.get('GOOGLE_TTS_API_KEY'):
        generate_audio_google(text, voice, output_path, job_id)
    else:
        run_async(generate_audio_edge(text, voice, output_path))


def run_async(coro):
    """Helper para executar função assíncrona"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@app.route('/api/voices', methods=['GET'])
def get_voices():
    """Retorna a lista de vozes disponíveis"""
    voices = []
    for key, config in AVAILABLE_VOICES.items():
        label = config.get('label', key) if isinstance(config, dict) else config
        provider = config.get('provider', 'edge') if isinstance(config, dict) else 'edge'
        voices.append({
            'value': key, 
            'label': label,
            'provider': provider
        })
    return jsonify({'voices': voices})


@app.route('/api/estimate', methods=['POST'])
def estimate_time():
    """
    Estima o tempo de processamento baseado no tamanho do texto
    Retorna estimativa em segundos
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        text = data.get('text', '').strip()
        char_count = len(text)
        
        # Estimativa baseada em testes: ~200 caracteres por segundo de processamento
        # Mais overhead inicial de ~3 segundos
        estimated_seconds = max(5, (char_count / 200) + 3)
        
        # Para textos muito longos, pode ser mais lento
        if char_count > 50000:
            estimated_seconds *= 1.2
        if char_count > 100000:
            estimated_seconds *= 1.3
            
        return jsonify({
            'char_count': char_count,
            'estimated_seconds': round(estimated_seconds),
            'estimated_audio_duration_minutes': round((char_count / 5) / 150)  # ~5 chars/word, 150 words/min
        })
        
    except Exception as e:
        print(f"❌ Erro em estimate: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/preview', methods=['POST'])
def generate_preview():
    """
    Gera um preview de áudio curto para o usuário ouvir a voz
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        voice = data.get('voice', 'pt-BR-AntonioNeural')
        
        if voice not in AVAILABLE_VOICES:
            return jsonify({'error': f'Voz {voice} não suportada'}), 400
        
        # Determina o idioma da voz
        lang = voice.split('-')[0] + '-' + voice.split('-')[1]
        preview_text = PREVIEW_TEXTS.get(lang, PREVIEW_TEXTS['pt-BR'])
        
        # Gera um nome único para o arquivo
        file_id = str(uuid.uuid4())
        output_filename = f'preview_{file_id}.mp3'
        output_path = os.path.join(TEMP_DIR, output_filename)
        
        # Gera o áudio
        generate_audio(preview_text, voice, output_path)
        
        if not os.path.exists(output_path):
            return jsonify({'error': 'Falha ao gerar o preview'}), 500
        
        # Configura a limpeza do arquivo após o envio
        @after_this_request
        def cleanup(response):
            try:
                import threading
                def remove_file():
                    try:
                        if os.path.exists(output_path):
                            os.remove(output_path)
                    except Exception:
                        pass
                timer = threading.Timer(10.0, remove_file)
                timer.daemon = True
                timer.start()
            except Exception:
                pass
            return response
        
        return send_file(
            output_path,
            mimetype='audio/mpeg',
            as_attachment=False
        )
        
    except Exception as e:
        print(f'❌ Erro ao gerar preview: {e}')
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500


@app.route('/api/generate', methods=['POST'])
def generate_audiobook():
    """
    Endpoint principal para gerar o audiobook
    Recebe: { text: string, voice: string }
    Retorna: arquivo OGG/MP3 para download
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        text = data.get('text', '').strip()
        voice = data.get('voice', 'pt-BR-AntonioNeural')
        
        if not text:
            return jsonify({'error': 'Texto não pode estar vazio'}), 400
            
        print(f"📥 Recebido texto para geração: {len(text)} caracteres")
        
        if voice not in AVAILABLE_VOICES:
            return jsonify({'error': f'Voz {voice} não suportada'}), 400
        
        # Mudamos para MP3 para maior compatibilidade na concatenação
        ext = 'mp3'
        output_filename = f'audiobook_{file_id}.{ext}'
        output_path = os.path.join(TEMP_DIR, output_filename)
        
        # Registra tempo de início
        start_time = time.time()
        
        # Executa a geração de áudio
        generate_audio(text, voice, output_path)
        
        processing_time = time.time() - start_time
        print(f'✅ Audiobook gerado em {processing_time:.2f}s - {len(text)} caracteres - Voz: {voice}')
        
        # Verifica se o arquivo foi criado
        if not os.path.exists(output_path):
            return jsonify({'error': 'Falha ao gerar o arquivo de áudio'}), 500
        
        # Configura a limpeza do arquivo após o envio
        @after_this_request
        def cleanup(response):
            try:
                import threading
                def remove_file():
                    try:
                        if os.path.exists(output_path):
                            os.remove(output_path)
                            print(f'Arquivo temporário removido: {output_filename}')
                    except Exception as e:
                        print(f'Erro ao remover arquivo: {e}')
                
                # Remove após 30 segundos para garantir que downloads grandes completem
                timer = threading.Timer(30.0, remove_file)
                timer.daemon = True
                timer.start()
            except Exception as e:
                print(f'Erro na limpeza: {e}')
            return response
        
        # Retorna o arquivo para download
        # Ambos os provedores agora usam ogg para economia de espaço
        mimetype = 'audio/mpeg'
        download_name = 'audiobook.mp3'
        
        return send_file(
            output_path,
            mimetype=mimetype,
            as_attachment=True,
            download_name=download_name
        )
        
    except Exception as e:
        print(f'❌ Erro ao gerar audiobook: {e}')
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500


# ==================== SISTEMA DE JOBS EM BACKGROUND ====================

def process_audio_job(job_id: str, text: str, voice: str):
    """Processa o áudio em background e atualiza o status do job"""
    try:
        JOBS[job_id]['status'] = 'processing'
        JOBS[job_id]['progress'] = 5
        
        # Determina extensão
        ext = 'mp3'
        output_filename = f'job_{job_id}.{ext}'
        output_path = os.path.join(TEMP_DIR, output_filename)
        
        print(f"🚀 Job {job_id}: Iniciando geração de áudio ({len(text)} caracteres)")
        
        # Gera o áudio
        generate_audio(text, voice, output_path, job_id)
        
        # Verifica se foi criado
        if os.path.exists(output_path):
            JOBS[job_id]['status'] = 'done'
            JOBS[job_id]['progress'] = 100
            JOBS[job_id]['file_path'] = output_path
            print(f"✅ Job {job_id}: Áudio gerado com sucesso!")
        else:
            JOBS[job_id]['status'] = 'error'
            JOBS[job_id]['error'] = 'Falha ao gerar arquivo de áudio'
            
    except Exception as e:
        print(f"❌ Job {job_id}: Erro - {str(e)}")
        JOBS[job_id]['status'] = 'error'
        JOBS[job_id]['error'] = str(e)


@app.route('/api/generate/start', methods=['POST'])
def start_generation_job():
    """
    Inicia um job de geração de áudio em background.
    Retorna imediatamente com o ID do job.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        text = data.get('text', '').strip()
        voice = data.get('voice', 'pt-BR-AntonioNeural')
        
        if not text:
            return jsonify({'error': 'Texto não pode estar vazio'}), 400
        
        if voice not in AVAILABLE_VOICES:
            return jsonify({'error': f'Voz {voice} não suportada'}), 400
        
        # Cria o job
        job_id = str(uuid.uuid4())
        JOBS[job_id] = {
            'status': 'pending',
            'progress': 0,
            'file_path': None,
            'error': None,
            'created_at': time.time()
        }
        
        print(f"📝 Job {job_id}: Criado para {len(text)} caracteres")
        
        # Inicia o processamento em background
        thread = threading.Thread(target=process_audio_job, args=(job_id, text, voice))
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'job_id': job_id,
            'status': 'pending',
            'message': 'Geração iniciada em background'
        })
        
    except Exception as e:
        print(f'❌ Erro ao iniciar job: {e}')
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500


@app.route('/api/generate/status/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """
    Retorna o status atual de um job de geração.
    """
    if job_id not in JOBS:
        return jsonify({'error': 'Job não encontrado'}), 404
    
    job = JOBS[job_id]
    return jsonify({
        'job_id': job_id,
        'status': job['status'],
        'progress': job['progress'],
        'error': job['error']
    })


@app.route('/api/generate/download/<job_id>', methods=['GET'])
def download_job_result(job_id):
    """
    Baixa o áudio gerado por um job concluído.
    """
    if job_id not in JOBS:
        return jsonify({'error': 'Job não encontrado'}), 404
    
    job = JOBS[job_id]
    
    if job['status'] != 'done':
        return jsonify({'error': 'Áudio ainda não está pronto', 'status': job['status']}), 400
    
    if not job['file_path'] or not os.path.exists(job['file_path']):
        return jsonify({'error': 'Arquivo não encontrado'}), 404
    
    # Limpa o job da memória após 1 hora
    def cleanup_job():
        try:
            if job_id in JOBS:
                file_path = JOBS[job_id].get('file_path')
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
                del JOBS[job_id]
                print(f"🧹 Job {job_id} limpo da memória")
        except Exception as e:
            print(f"Erro ao limpar job: {e}")
    
    timer = threading.Timer(3600.0, cleanup_job)  # 1 hora
    timer.daemon = True
    timer.start()
    
    return send_file(
        job['file_path'],
        mimetype='audio/mpeg',
        as_attachment=True,
        download_name='audiobook.mp3'
    )


@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint de verificação de saúde do servidor"""
    return jsonify({'status': 'ok', 'message': 'Servidor funcionando', 'jobs_ativos': len(JOBS)})


@app.route('/api/extract', methods=['POST'])
def extract_text():
    """
    Extrai texto de arquivos PDF, DOCX ou TXT com limpeza avançada
    """
    try:
        print("Recebida requisição em /api/extract", flush=True)
        if 'file' not in request.files:
            return jsonify({'error': 'Nenhum arquivo enviado'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Nome de arquivo vazio'}), 400
        
        filename = file.filename.lower()
        print(f"Processando arquivo: {filename}", flush=True)
        
        text = ''
        
        # --- TXT ---
        if filename.endswith('.txt'):
            try:
                text = file.read().decode('utf-8', errors='ignore')
            except Exception as e:
                return jsonify({'error': f'Erro ao ler TXT: {str(e)}'}), 400

        # --- PDF ---
        elif filename.endswith('.pdf'):
            if not PDF_SUPPORT:
                return jsonify({'error': 'Suporte a PDF (PyPDF2) não instalado'}), 400
            try:
                pdf_reader = PyPDF2.PdfReader(file)
                raw_pages = []
                for page in pdf_reader.pages:
                    content = page.extract_text()
                    if content:
                        raw_pages.append(content)
                text = "\n".join(raw_pages)
            except Exception as e:
                return jsonify({'error': f'Erro ao ler PDF: {str(e)}'}), 400

        # --- DOCX ---
        elif filename.endswith('.docx'):
            if not DOCX_SUPPORT:
                return jsonify({'error': 'Suporte a DOCX (python-docx) não instalado'}), 400
            try:
                doc = docx.Document(file)
                paragraphs = []
                for para in doc.paragraphs:
                    clean_p = para.text.strip()
                    if clean_p: # Ignora parágrafos vazios
                        paragraphs.append(clean_p)
                text = "\n".join(paragraphs)
            except Exception as e:
                return jsonify({'error': f'Erro ao ler DOCX: {str(e)}'}), 400
        
        else:
            return jsonify({'error': 'Formato não suportado. Use .txt, .pdf ou .docx'}), 400

        if not text:
            return jsonify({'error': 'Não foi possível extrair texto (arquivo vazio?)'}), 400

        # --- LIMPEZA E RECONSTRUÇÃO INTELIGENTE ---
        import re
        
        # 1. Normalização básica de caracteres
        text = text.replace('\r', '')
        
        # 2. Divide em linhas para processamento
        lines = text.split('\n')
        cleaned_lines = []
        buffer = ""
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Limpa espaços duplicados dentro da linha (resolve o problema "2 espaços a cada palavra")
            line = re.sub(r'\s+', ' ', line)
            
            if not buffer:
                buffer = line
                continue
            
            # Lógica de Junção:
            # Se o buffer termina em pontuação final (. ? !), assume que é fim de parágrafo.
            # Caso contrário, assume que a frase continua na próxima linha (para corrigir quebras do PDF).
            if buffer.endswith(('.', '!', '?', ':', ';')):
                cleaned_lines.append(buffer)
                buffer = line
            elif buffer.endswith('-'):
                # Trata hifenização: "exem- plo" -> "exemplo"
                buffer = buffer[:-1] + line
            else:
                # Junta com espaço
                buffer += " " + line
                
        if buffer:
            cleaned_lines.append(buffer)
            
        # Reconstrói o texto com espaçamento simples (resolve o "pula uma linha")
        final_text = "\n".join(cleaned_lines)

        return jsonify({
            'text': final_text,
            'char_count': len(final_text),
            'word_count': len(final_text.split())
        })

    except Exception as e:
        print(f"Erro fatal em extract_text: {e}", flush=True)
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500


# =============================================
# ROTAS DE AUTENTICAÇÃO E ADMIN
# =============================================

def verify_token(token):
    """Verifica e decodifica o JWT do Supabase"""
    if not SUPABASE_JWT_SECRET:
        return None
    try:
        # Remove "Bearer " se presente
        if token.startswith('Bearer '):
            token = token[7:]
        
        # Decodifica o JWT usando o secret do Supabase
        decoded = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=['HS256'],
            audience='authenticated'
        )
        return decoded
    except jwt.ExpiredSignatureError:
        print("Token expirado")
        return None
    except jwt.InvalidTokenError as e:
        print(f"Token inválido: {e}")
        return None


def is_admin(email):
    """Verifica se o email pertence a um administrador (case-insensitive)"""
    if not email:
        return False
    ADMIN_EMAILS = ['2closett@gmail.com']
    return email.lower() in [e.lower() for e in ADMIN_EMAILS]


def require_auth(f):
    """Decorator para rotas que precisam de autenticação"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '')
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        user_data = verify_token(token)
        if not user_data:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        request.user = user_data
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator para rotas que precisam de privilégios de admin"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '')
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        user_data = verify_token(token)
        if not user_data:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        email = user_data.get('email', '')
        if not is_admin(email):
            return jsonify({'error': 'Acesso negado. Você não é admin.'}), 403
        
        request.user = user_data
        request.is_admin = True
        return f(*args, **kwargs)
    return decorated


@app.route('/api/auth/verify', methods=['POST'])
def verify_user():
    """
    Verifica o token do usuário e retorna se é admin
    Recebe: Authorization header com JWT
    Retorna: { authenticated: bool, is_admin: bool, email: string }
    """
    token = request.headers.get('Authorization', '')
    if not token:
        return jsonify({
            'authenticated': False,
            'is_admin': False
        })
    
    # Remove 'Bearer ' se existir
    if token.startswith('Bearer '):
        token = token[7:]
        
    user_data = verify_token(token)
    if not user_data:
        return jsonify({
            'authenticated': False,
            'is_admin': False
        })
    
    email = user_data.get('email', '')
    admin_status = is_admin(email)
    
    return jsonify({
        'authenticated': True,
        'is_admin': admin_status,
        'email': email
    })


# =============================================
# CATEGORIAS
# =============================================

@app.route('/api/categories', methods=['GET'])
def list_categories():
    """Lista todas as categorias"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM categories ORDER BY name ASC')
        rows = cursor.fetchall()
        categories = [dict(row) for row in rows]
        conn.close()
        return jsonify({'categories': categories})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/categories', methods=['POST'])
@require_admin
def create_category():
    """Cria uma nova categoria"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Nome da categoria é obrigatório'}), 400
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('INSERT INTO categories (name) VALUES (?)', (name,))
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return jsonify({'success': True, 'id': last_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Esta categoria já existe'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
@require_admin
def delete_category(category_id):
    """Remove uma categoria e desvincula os audiobooks dela"""
    try:
        conn = sqlite3.connect(DB_PATH)
        # Desvincula os audiobooks primeiro
        conn.execute('UPDATE audiobooks SET category_id = NULL WHERE category_id = ?', (category_id,))
        # Deleta a categoria
        conn.execute('DELETE FROM categories WHERE id = ?', (category_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audiobooks', methods=['GET'])
def list_audiobooks():
    """Lista todos os projetos de audiobooks com suas faixas"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # 1. Busca os Projetos
        cursor.execute('''
            SELECT a.*, c.name as category_name 
            FROM audiobooks a 
            LEFT JOIN categories c ON a.category_id = c.id
            ORDER BY a.display_order ASC, a.created_at DESC
        ''')
        rows = cursor.fetchall()
        projects = [dict(row) for row in rows]
        
        # 2. Busca as Faixas para cada projeto
        for p in projects:
            cursor.execute('''
                SELECT * FROM audiobook_tracks 
                WHERE audiobook_id = ? 
                ORDER BY created_at ASC
            ''', (p['id'],))
            tracks = cursor.fetchall()
            p['tracks'] = [dict(t) for t in tracks]
            
        conn.close()
        return jsonify({'audiobooks': projects})
    except Exception as e:
        print(f"Erro ao listar: {e}")
        return jsonify({'error': 'Erro ao carregar'}), 500

@app.route('/api/audiobooks/reorder', methods=['POST'])
@require_admin
def reorder_audiobooks():
    """Atualiza a ordem de exibição dos audiobooks"""
    try:
        data = request.get_json()
        ordered_ids = data.get('ids', [])
        
        if not ordered_ids:
            return jsonify({'error': 'Lista de IDs não fornecida'}), 400
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Atualiza a ordem de cada item
        for index, book_id in enumerate(ordered_ids):
            cursor.execute('UPDATE audiobooks SET display_order = ? WHERE id = ?', (index, book_id))
            
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audiobooks', methods=['POST'])
@require_admin
def create_audiobook():
    """Publica um novo audiobook ou uma nova track num projeto existente"""
    try:
        data = request.get_json()
        project_id = data.get('project_id')
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        audio_url = data.get('audio_url', '').strip()
        cover_url = data.get('cover_url', '')
        duration_seconds = data.get('duration_seconds', 0)
        category_id = data.get('category_id')
        track_label = data.get('track_label', 'Versão Original').strip()
        
        if not audio_url:
            return jsonify({'error': 'Áudio obrigatório'}), 400
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if project_id:
            # Adicionar track a projeto existente
            cursor.execute('''
                INSERT INTO audiobook_tracks (audiobook_id, label, audio_url, duration_seconds)
                VALUES (?, ?, ?, ?)
            ''', (project_id, track_label, audio_url, duration_seconds))
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'project_id': project_id}), 201
        else:
            # Criar novo projeto + primeira track
            if not title:
                return jsonify({'error': 'Título obrigatório para novos projetos'}), 400
                
            try:
                cursor.execute('''
                    INSERT INTO audiobooks (title, description, cover_url, category_id)
                    VALUES (?, ?, ?, ?)
                ''', (title, description, cover_url, category_id))
            except sqlite3.IntegrityError as e:
                # Fallback para bancos antigos onde audio_url/duration_seconds ainda são NOT NULL
                if "audio_url" in str(e):
                    cursor.execute('''
                        INSERT INTO audiobooks (title, description, cover_url, category_id, audio_url, duration_seconds)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (title, description, cover_url, category_id, "", 0))
                else:
                    raise e
            new_project_id = cursor.lastrowid
            
            cursor.execute('''
                INSERT INTO audiobook_tracks (audiobook_id, label, audio_url, duration_seconds)
                VALUES (?, ?, ?, ?)
            ''', (new_project_id, track_label, audio_url, duration_seconds))
            
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'id': new_project_id}), 201
            
    except Exception as e:
        print(f"Erro ao publicar: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/audiobooks/<int:audiobook_id>', methods=['DELETE'])
@require_admin
def delete_audiobook(audiobook_id):
    """Remove do SQLite"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Deleta as tracks primeiro
        cursor.execute('DELETE FROM audiobook_tracks WHERE audiobook_id = ?', (audiobook_id,))
        # Deleta o projeto
        cursor.execute('DELETE FROM audiobooks WHERE id = ?', (audiobook_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audiobooks/track/<int:track_id>', methods=['DELETE'])
@require_admin
def delete_audiobook_track(track_id):
    """Remove uma track específica"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute('DELETE FROM audiobook_tracks WHERE id = ?', (track_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audiobooks/<int:audiobook_id>', methods=['PUT'])
@require_admin
def update_audiobook(audiobook_id):
    """Atualiza um audiobook no SQLite"""
    try:
        data = request.get_json()
        fields = []
        values = []
        for key in ['title', 'description', 'cover_url', 'category_id']:
            if key in data:
                fields.append(f"{key} = ?")
                values.append(data[key])
        
        if not fields:
            return jsonify({'error': 'Nenhum campo para atualizar'}), 400
            
        values.append(audiobook_id)
        sql = f"UPDATE audiobooks SET {', '.join(fields)} WHERE id = ?"
        
        conn = sqlite3.connect(DB_PATH)
        conn.execute(sql, values)
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload/cover', methods=['POST'])
@require_admin
def upload_cover():
    """Upload de capa para disco local"""
    if 'file' not in request.files:
        return jsonify({'error': 'Sem arquivo'}), 400
    file = request.files['file']
    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(COVERS_DIR, filename)
    file.save(file_path)
    
    # URL aponta para o nosso próprio domínio
    public_url = f"/api/uploads/covers/{filename}"
    return jsonify({'success': True, 'url': public_url})

@app.route('/api/upload/audio', methods=['POST'])
@require_admin
def upload_audio_file():
    """Upload de áudio para disco local"""
    if 'file' not in request.files:
        return jsonify({'error': 'Sem arquivo'}), 400
    file = request.files['file']
    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(AUDIO_UPLOADS_DIR, filename)
    file.save(file_path)
    
    public_url = f"/api/uploads/audiobooks/{filename}"
    return jsonify({'success': True, 'url': public_url})

@app.route('/api/uploads/<folder>/<filename>')
def serve_uploads(folder, filename):
    """Serve arquivos da pasta uploads"""
    folder_path = os.path.join(UPLOADS_DIR, folder)
    # Se passar ?download=true, força o download no navegador
    download = request.args.get('download', '').lower() == 'true'
    return send_from_directory(folder_path, filename, as_attachment=download, download_name=filename)

from flask import send_from_directory


@app.route('/', methods=['GET'])
def root():
    """Rota raiz para verificação básica"""
    return jsonify({
        'app': 'Audiobook Generator API',
        'status': 'running',
        'supabase_enabled': SUPABASE_ENABLED,
        'endpoints': [
            '/api/health', 
            '/api/voices', 
            '/api/generate', 
            '/api/extract',
            '/api/auth/verify',
            '/api/audiobooks'
        ],
        'supported_formats': ['PDF', 'DOCX', 'TXT']
    })



if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    print(f'🎧 Servidor de Audiobook iniciando na porta {port}...')
    app.run(host='0.0.0.0', port=port, debug=debug)
