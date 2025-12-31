-- =============================================
-- SUPABASE SETUP PARA AUDIOLOOP
-- Execute este SQL no Editor SQL do Supabase
-- =============================================

-- 1. Tabela de Admins (emails autorizados)
CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir o email admin
INSERT INTO admins (email) VALUES ('2closett@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Tabela de Audiobooks Publicados
CREATE TABLE IF NOT EXISTS audiobooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    audio_url TEXT NOT NULL,
    author_email TEXT NOT NULL,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Políticas de Segurança (RLS - Row Level Security)
ALTER TABLE audiobooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode LER audiobooks (são públicos)
DROP POLICY IF EXISTS "Audiobooks são públicos para leitura" ON audiobooks;
CREATE POLICY "Audiobooks são públicos para leitura"
ON audiobooks FOR SELECT
USING (true);

-- Qualquer um autenticado pode inserir (backend valida admin)
DROP POLICY IF EXISTS "Usuários podem inserir audiobooks" ON audiobooks;
CREATE POLICY "Usuários podem inserir audiobooks"
ON audiobooks FOR INSERT
WITH CHECK (true);

-- Qualquer um autenticado pode deletar (backend valida admin)
DROP POLICY IF EXISTS "Usuários podem deletar audiobooks" ON audiobooks;
CREATE POLICY "Usuários podem deletar audiobooks"
ON audiobooks FOR DELETE
USING (true);

-- Admins podem ser lidos por qualquer um (para verificação)
DROP POLICY IF EXISTS "Admins podem ser lidos" ON admins;
CREATE POLICY "Admins podem ser lidos"
ON admins FOR SELECT
USING (true);

-- =============================================
-- 4. CRIAR BUCKETS NO STORAGE
-- Vá em Storage > Create Bucket:
-- - Nome: "audios" | Público: SIM
-- - Nome: "covers" | Público: SIM
-- =============================================
