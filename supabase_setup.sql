-- =============================================
-- SUPABASE SETUP PARA AUDIOBOOK GENERATOR
-- Execute este SQL no Editor SQL do Supabase
-- =============================================

-- 1. Tabela de Admins (emails autorizados)
CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir o email admin
INSERT INTO admins (email) VALUES ('2closett@gmail.com.br')
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
CREATE POLICY "Audiobooks são públicos para leitura"
ON audiobooks FOR SELECT
TO public
USING (true);

-- Apenas service_role pode inserir/deletar (via backend)
CREATE POLICY "Apenas backend pode inserir audiobooks"
ON audiobooks FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Apenas backend pode deletar audiobooks"
ON audiobooks FOR DELETE
TO service_role
USING (true);

-- Admins só podem ser lidos pelo backend
CREATE POLICY "Apenas backend lê admins"
ON admins FOR SELECT
TO service_role
USING (true);

-- 4. Criar bucket para capas (covers)
-- NOTA: Isso deve ser feito na interface do Supabase em Storage > Create Bucket
-- Nome: "covers" | Público: SIM

-- 5. Criar bucket para áudios
-- NOTA: Isso deve ser feito na interface do Supabase em Storage > Create Bucket
-- Nome: "audios" | Público: SIM

-- =============================================
-- FIM DO SETUP
-- =============================================
