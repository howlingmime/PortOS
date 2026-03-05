-- PortOS Memory System Schema
-- PostgreSQL + pgvector

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core memories table
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  category VARCHAR(100) DEFAULT 'other',
  tags TEXT[] DEFAULT '{}',
  embedding vector(768),
  embedding_model VARCHAR(100),
  confidence FLOAT DEFAULT 0.8,
  importance FLOAT DEFAULT 0.5,
  access_count INT DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  source_task_id VARCHAR(100),
  source_agent_id VARCHAR(100),
  source_app_id VARCHAR(100),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Federation sync sequence (auto-incrementing on insert/update)
  sync_sequence BIGSERIAL
);

-- Schema upgrades: add columns that may not exist on older installs
ALTER TABLE memories ADD COLUMN IF NOT EXISTS sync_sequence BIGSERIAL;

-- Origin instance tracking for federation
ALTER TABLE memories ADD COLUMN IF NOT EXISTS origin_instance_id VARCHAR(36);
CREATE INDEX IF NOT EXISTS idx_memories_origin_instance ON memories (origin_instance_id);

-- HNSW index for fast vector similarity search (O(log n) instead of O(n))
CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search index (replaces BM25)
CREATE INDEX IF NOT EXISTS idx_memories_fts
  ON memories USING gin (
    to_tsvector('english', coalesce(content, '') || ' ' || coalesce(summary, ''))
  );

-- Filtered queries
CREATE INDEX IF NOT EXISTS idx_memories_status ON memories (status);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories (type);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories (category);
CREATE INDEX IF NOT EXISTS idx_memories_source_app ON memories (source_app_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories (created_at);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories (importance);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING gin (tags);

-- Sync sequence index for federation
CREATE INDEX IF NOT EXISTS idx_memories_sync_sequence ON memories (sync_sequence);

-- Memory relationships (bidirectional links)
CREATE TABLE IF NOT EXISTS memory_links (
  source_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  target_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_id, target_id)
);

-- Auto-update updated_at and sync_sequence on content/metadata changes.
-- Skips bump for access-stat-only updates (access_count, last_accessed)
-- to avoid sync noise from read operations.
-- Respects explicitly provided updated_at (e.g., from sync service).
CREATE OR REPLACE FUNCTION update_memory_timestamp()
RETURNS TRIGGER AS $$
DECLARE
  content_changed BOOLEAN;
BEGIN
  content_changed := (
    NEW.type IS DISTINCT FROM OLD.type OR
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.summary IS DISTINCT FROM OLD.summary OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.tags IS DISTINCT FROM OLD.tags OR
    NEW.embedding IS DISTINCT FROM OLD.embedding OR
    NEW.embedding_model IS DISTINCT FROM OLD.embedding_model OR
    NEW.confidence IS DISTINCT FROM OLD.confidence OR
    NEW.importance IS DISTINCT FROM OLD.importance OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
    NEW.source_task_id IS DISTINCT FROM OLD.source_task_id OR
    NEW.source_agent_id IS DISTINCT FROM OLD.source_agent_id OR
    NEW.source_app_id IS DISTINCT FROM OLD.source_app_id OR
    NEW.updated_at IS DISTINCT FROM OLD.updated_at
  );

  -- Access-stat-only update: skip sync_sequence and updated_at bump
  IF NOT content_changed THEN
    RETURN NEW;
  END IF;

  IF NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at THEN
    NEW.updated_at := NOW();
  END IF;
  NEW.sync_sequence := nextval(pg_get_serial_sequence('memories', 'sync_sequence'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memory_updated_at ON memories;
CREATE TRIGGER trg_memory_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_timestamp();
