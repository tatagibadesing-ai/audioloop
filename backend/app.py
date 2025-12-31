"""
Backend API para geração de Audiobooks usando edge-tts
Gera arquivos MP3 com vozes neurais da Microsoft
Integração com Supabase para autenticação e banco de dados
"""

import os
import uuid
import asyncio
import time
import io
import jwt
from functools import wraps
from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
import edge_tts

# Supabase Client
try:
    from supabase import create_client, Client
    SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
    SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
    SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
    SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')
    
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        SUPABASE_ENABLED = True
        print("✅ Supabase conectado com sucesso!")
    else:
        supabase = None
        SUPABASE_ENABLED = False
        print("⚠️ Supabase não configurado. Funcionalidades de admin desabilitadas.")
except ImportError:
    supabase = None
    SUPABASE_ENABLED = False
    print("⚠️ Biblioteca Supabase não instalada.")

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
CORS(app)  # Permite requisições do frontend

# Diretório para arquivos temporários
TEMP_DIR = os.path.join(os.path.dirname(__file__), 'temp_audio')
os.makedirs(TEMP_DIR, exist_ok=True)


# Mapeamento de vozes disponíveis (IDs REAIS da API Microsoft Edge-TTS)
# Fonte: https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list
AVAILABLE_VOICES = {
    # Português Brasil (pt-BR) - APENAS ESTAS 3 EXISTEM
    'pt-BR-AntonioNeural': 'Antônio (Masculino)',
    'pt-BR-FranciscaNeural': 'Francisca (Feminino)',
    'pt-BR-ThalitaMultilingualNeural': 'Thalita (Feminino)',
    # Português Portugal (pt-PT)
    'pt-PT-DuarteNeural': 'Duarte (PT-PT Masculino)',
    'pt-PT-RaquelNeural': 'Raquel (PT-PT Feminino)',
    # Inglês Estados Unidos (en-US)
    'en-US-GuyNeural': 'Guy (EN-US)',
    'en-US-JennyNeural': 'Jenny (EN-US)',
}

# Textos de preview para cada idioma
PREVIEW_TEXTS = {
    'pt-BR': 'Olá! Ouça como soa a minha voz no AudioLoop.',
    'en-US': 'Hello! This is a sample of my voice.',
}


async def generate_audio(text: str, voice: str, output_path: str):
    """
    Gera o arquivo de áudio usando edge-tts de forma assíncrona
    """
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
    except Exception as e:
        print(f"❌ Erro no edge-tts: {str(e)}")
        raise e


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
    voices = [
        {'value': key, 'label': label}
        for key, label in AVAILABLE_VOICES.items()
    ]
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
        run_async(generate_audio(preview_text, voice, output_path))
        
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
    Retorna: arquivo MP3 para download
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
        
        # Gera um nome único para o arquivo
        file_id = str(uuid.uuid4())
        output_filename = f'audiobook_{file_id}.mp3'
        output_path = os.path.join(TEMP_DIR, output_filename)
        
        # Registra tempo de início
        start_time = time.time()
        
        # Executa a geração de áudio
        run_async(generate_audio(text, voice, output_path))
        
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
        return send_file(
            output_path,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name='audiobook.mp3'
        )
        
    except Exception as e:
        print(f'❌ Erro ao gerar audiobook: {e}')
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint de verificação de saúde do servidor"""
    return jsonify({'status': 'ok', 'message': 'Servidor funcionando'})


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
    """Verifica no banco de dados se o email é de um admin"""
    if not SUPABASE_ENABLED or not supabase:
        return False
    
    try:
        result = supabase.table('admins').select('email').eq('email', email).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"Erro ao verificar admin: {e}")
        return False


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
    if not SUPABASE_ENABLED:
        return jsonify({
            'authenticated': False,
            'is_admin': False,
            'error': 'Supabase não configurado'
        }), 503
    
    token = request.headers.get('Authorization', '')
    if not token:
        return jsonify({
            'authenticated': False,
            'is_admin': False
        })
    
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


@app.route('/api/audiobooks', methods=['GET'])
def list_audiobooks():
    """
    Lista todos os audiobooks publicados (público)
    """
    if not SUPABASE_ENABLED:
        return jsonify({'audiobooks': [], 'error': 'Banco de dados não configurado'}), 503
    
    try:
        result = supabase.table('audiobooks').select('*').order('created_at', desc=True).execute()
        return jsonify({'audiobooks': result.data})
    except Exception as e:
        print(f"Erro ao listar audiobooks: {e}")
        return jsonify({'error': 'Erro ao carregar audiobooks'}), 500


@app.route('/api/audiobooks', methods=['POST'])
@require_admin
def create_audiobook():
    """
    Publica um novo audiobook (apenas admin)
    Recebe: { title, description, audio_url, cover_url?, duration_seconds? }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        audio_url = data.get('audio_url', '').strip()
        cover_url = data.get('cover_url', '')
        duration_seconds = data.get('duration_seconds', 0)
        
        if not title or not audio_url:
            return jsonify({'error': 'Título e URL do áudio são obrigatórios'}), 400
        
        # Insere no banco
        new_audiobook = {
            'title': title,
            'description': description,
            'audio_url': audio_url,
            'cover_url': cover_url,
            'duration_seconds': duration_seconds,
            'author_email': request.user.get('email', 'admin')
        }
        
        result = supabase.table('audiobooks').insert(new_audiobook).execute()
        
        return jsonify({
            'success': True,
            'audiobook': result.data[0] if result.data else new_audiobook
        }), 201
    
    except Exception as e:
        print(f"Erro ao criar audiobook: {e}")
        return jsonify({'error': f'Erro ao publicar: {str(e)}'}), 500


@app.route('/api/audiobooks/<audiobook_id>', methods=['DELETE'])
@require_admin
def delete_audiobook(audiobook_id):
    """
    Remove um audiobook (apenas admin)
    """
    try:
        result = supabase.table('audiobooks').delete().eq('id', audiobook_id).execute()
        return jsonify({'success': True, 'deleted_id': audiobook_id})
    except Exception as e:
        print(f"Erro ao deletar audiobook: {e}")
        return jsonify({'error': f'Erro ao deletar: {str(e)}'}), 500


@app.route('/api/audiobooks/<audiobook_id>', methods=['PUT'])
@require_admin
def update_audiobook(audiobook_id):
    """
    Atualiza um audiobook existente (apenas admin)
    Recebe: { title, description, audio_url?, cover_url?, duration_seconds? }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        # Filtra apenas os campos permitidos e que foram enviados
        updates = {}
        allowed_fields = ['title', 'description', 'audio_url', 'cover_url', 'duration_seconds']
        for field in allowed_fields:
            if field in data:
                updates[field] = data[field]
        
        if not updates:
            return jsonify({'error': 'Nenhum campo para atualizar'}), 400
        
        updates['updated_at'] = 'now()' # Ou deixa o Supabase lidar com isso
        
        result = supabase.table('audiobooks').update(updates).eq('id', audiobook_id).execute()
        
        return jsonify({
            'success': True,
            'audiobook': result.data[0] if result.data else {}
        })
    except Exception as e:
        print(f"Erro ao atualizar audiobook: {e}")
        return jsonify({'error': f'Erro ao atualizar: {str(e)}'}), 500


@app.route('/api/upload/cover', methods=['POST'])
@require_admin
def upload_cover():
    """
    Faz upload de uma capa para o Supabase Storage (apenas admin)
    """
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nome de arquivo vazio'}), 400
    
    try:
        # Gera nome único
        ext = file.filename.rsplit('.', 1)[-1].lower()
        filename = f"{uuid.uuid4()}.{ext}"
        
        # Upload para Supabase Storage
        file_bytes = file.read()
        result = supabase.storage.from_('covers').upload(filename, file_bytes)
        
        # Gera URL pública
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/covers/{filename}"
        
        return jsonify({
            'success': True,
            'url': public_url,
            'filename': filename
        })
    
    except Exception as e:
        print(f"Erro ao fazer upload: {e}")
        return jsonify({'error': f'Erro no upload: {str(e)}'}), 500


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
