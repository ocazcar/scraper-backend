-- Table pour mettre en cache les résultats de scraping
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.scraper_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    competitor TEXT NOT NULL, -- 'midas' ou 'norauto'
    service TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    year INTEGER,
    price DECIMAL(10, 2) NOT NULL,
    price_with_installation DECIMAL(10, 2) NOT NULL,
    url TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_scraper_cache_key ON public.scraper_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_scraper_cache_expires ON public.scraper_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_scraper_cache_competitor ON public.scraper_cache(competitor, service);

-- Fonction pour nettoyer automatiquement les entrées expirées
CREATE OR REPLACE FUNCTION cleanup_expired_scraper_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.scraper_cache
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) - permettre l'accès à tous les utilisateurs authentifiés
ALTER TABLE public.scraper_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read scraper cache"
    ON public.scraper_cache
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role to manage scraper cache"
    ON public.scraper_cache
    FOR ALL
    TO service_role
    USING (true);

-- Commentaires
COMMENT ON TABLE public.scraper_cache IS 'Cache des prix scrapés depuis les concurrents (Midas, Norauto)';
COMMENT ON COLUMN public.scraper_cache.cache_key IS 'Clé unique de cache: competitor_brand_model_year_service';
COMMENT ON COLUMN public.scraper_cache.expires_at IS 'Date d expiration du cache (généralement 1 heure après scraped_at)';

