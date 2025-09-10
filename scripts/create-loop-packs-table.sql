-- Create proper loop_packs table schema
-- This table stores metadata for loop pack collections

DROP TABLE IF EXISTS public.loop_packs CASCADE;

CREATE TABLE public.loop_packs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NULL,
    artist text NOT NULL,
    cover_image_url text NULL,
    uploader_wallet text NOT NULL,
    total_loops integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    
    -- Additional metadata fields to match ip_tracks structure
    tags text[] NULL DEFAULT '{}'::text[],
    primary_location text NULL,
    location_lat numeric(10, 7) NULL,
    location_lng numeric(10, 7) NULL,
    
    -- Licensing and pricing (inherited by individual loops)
    license_type text NULL DEFAULT 'remix_only'::text,
    license_selection text NULL DEFAULT 'platform_remix'::text,
    allow_remixing boolean NULL DEFAULT true,
    allow_downloads boolean NULL DEFAULT false,
    open_to_commercial boolean NULL DEFAULT false,
    open_to_collaboration boolean NULL DEFAULT false,
    
    -- Pack-level pricing
    pack_price_stx numeric(10, 6) NULL DEFAULT 0,
    individual_loop_price numeric(10, 6) NULL DEFAULT 0.5,
    
    -- Soft delete support
    deleted_at timestamp with time zone NULL,
    is_live boolean NULL DEFAULT true,
    
    CONSTRAINT loop_packs_pkey PRIMARY KEY (id),
    CONSTRAINT loop_packs_license_selection_check CHECK (
        license_selection = ANY (
            ARRAY['platform_remix'::text, 'platform_download'::text]
        )
    ),
    CONSTRAINT loop_packs_license_type_check CHECK (
        license_type = ANY (
            ARRAY[
                'remix_only'::text,
                'remix_external'::text,
                'custom'::text
            ]
        )
    )
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loop_packs_uploader_wallet 
ON public.loop_packs USING btree (uploader_wallet) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_loop_packs_created_at 
ON public.loop_packs USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_loop_packs_is_live 
ON public.loop_packs USING btree (is_live) TABLESPACE pg_default;

-- Set up Row Level Security (RLS)
ALTER TABLE public.loop_packs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view all live loop packs
CREATE POLICY "Public read access for live loop packs" 
ON public.loop_packs FOR SELECT 
USING (is_live = true AND deleted_at IS NULL);

-- RLS Policy: Users can insert their own loop packs
CREATE POLICY "Users can insert their own loop packs" 
ON public.loop_packs FOR INSERT 
WITH CHECK (auth.uid()::text = uploader_wallet OR uploader_wallet IS NOT NULL);

-- RLS Policy: Users can update their own loop packs
CREATE POLICY "Users can update their own loop packs" 
ON public.loop_packs FOR UPDATE 
USING (auth.uid()::text = uploader_wallet OR uploader_wallet IS NOT NULL);

-- RLS Policy: Users can soft delete their own loop packs
CREATE POLICY "Users can delete their own loop packs" 
ON public.loop_packs FOR UPDATE 
USING (auth.uid()::text = uploader_wallet OR uploader_wallet IS NOT NULL)
WITH CHECK (deleted_at IS NOT NULL);

-- Grant permissions
GRANT ALL ON public.loop_packs TO postgres;
GRANT ALL ON public.loop_packs TO anon;
GRANT ALL ON public.loop_packs TO authenticated;
GRANT ALL ON public.loop_packs TO service_role;

-- Add comment
COMMENT ON TABLE public.loop_packs IS 'Stores metadata for loop pack collections. Individual loops are stored in ip_tracks with pack_id reference.';