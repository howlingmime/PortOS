import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  mkdir: vi.fn()
}));

// Mock uuid
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`
}));

// Mock cosEvents to prevent side effects
vi.mock('./cosEvents.js', () => ({
  cosEvents: { on: vi.fn(), emit: vi.fn() }
}));

// Mock fileUtils
vi.mock('../lib/fileUtils.js', async () => {
  const fsPromises = await import('fs/promises');
  return {
    ensureDir: vi.fn(),
    PATHS: {
      data: '/mock/data',
      cos: '/mock/data/cos',
      root: '/mock/root'
    },
    readJSONFile: vi.fn(async (filePath, defaultValue) => {
      const content = await fsPromises.readFile(filePath, 'utf-8').catch(() => null);
      if (!content) return defaultValue;
      return JSON.parse(content);
    })
  };
});

import { readFile, writeFile, rename } from 'fs/promises';
import {
  getItems,
  getPendingCounts,
  createItem,
  completeItem,
  dismissItem,
  updateItem,
  deleteItem,
  getBriefing,
  reviewEvents
} from './review.js';

beforeEach(() => {
  vi.clearAllMocks();
  uuidCounter = 0;
  reviewEvents.removeAllListeners();
});

describe('review service', () => {
  describe('getItems', () => {
    it('returns empty array when no items exist', async () => {
      readFile.mockRejectedValue({ code: 'ENOENT' });
      const items = await getItems();
      expect(items).toEqual([]);
    });

    it('returns sorted items by type then date', async () => {
      const mockItems = [
        { id: '1', type: 'todo', title: 'Todo 1', status: 'pending', createdAt: '2025-01-01T00:00:00Z' },
        { id: '2', type: 'alert', title: 'Alert 1', status: 'pending', createdAt: '2025-01-02T00:00:00Z' }
      ];
      readFile.mockResolvedValue(JSON.stringify(mockItems));
      const items = await getItems();
      expect(items[0].type).toBe('alert');
      expect(items[1].type).toBe('todo');
    });

    it('filters by status', async () => {
      const mockItems = [
        { id: '1', type: 'todo', title: 'Done', status: 'completed', createdAt: '2025-01-01T00:00:00Z' },
        { id: '2', type: 'todo', title: 'Pending', status: 'pending', createdAt: '2025-01-02T00:00:00Z' }
      ];
      readFile.mockResolvedValue(JSON.stringify(mockItems));
      const items = await getItems({ status: 'pending' });
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Pending');
    });

    it('filters by type', async () => {
      const mockItems = [
        { id: '1', type: 'todo', title: 'Todo', status: 'pending', createdAt: '2025-01-01T00:00:00Z' },
        { id: '2', type: 'alert', title: 'Alert', status: 'pending', createdAt: '2025-01-02T00:00:00Z' }
      ];
      readFile.mockResolvedValue(JSON.stringify(mockItems));
      const items = await getItems({ type: 'alert' });
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('alert');
    });
  });

  describe('getPendingCounts', () => {
    it('returns zero counts when no items', async () => {
      readFile.mockRejectedValue({ code: 'ENOENT' });
      const counts = await getPendingCounts();
      expect(counts.total).toBe(0);
    });

    it('counts pending items by type', async () => {
      const mockItems = [
        { id: '1', type: 'todo', status: 'pending' },
        { id: '2', type: 'alert', status: 'pending' },
        { id: '3', type: 'todo', status: 'completed' },
        { id: '4', type: 'cos', status: 'pending' }
      ];
      readFile.mockResolvedValue(JSON.stringify(mockItems));
      const counts = await getPendingCounts();
      expect(counts.total).toBe(3);
      expect(counts.todo).toBe(1);
      expect(counts.alert).toBe(1);
      expect(counts.cos).toBe(1);
    });
  });

  describe('createItem', () => {
    it('creates a new todo item', async () => {
      readFile.mockRejectedValue({ code: 'ENOENT' });
      writeFile.mockResolvedValue();
      rename.mockResolvedValue();

      const item = await createItem({ type: 'todo', title: 'Test todo' });
      expect(item.id).toBe('test-uuid-1');
      expect(item.type).toBe('todo');
      expect(item.title).toBe('Test todo');
      expect(item.status).toBe('pending');
      expect(writeFile).toHaveBeenCalled();
      expect(rename).toHaveBeenCalled();
    });

    it('rejects invalid type', async () => {
      await expect(createItem({ type: 'invalid', title: 'Test' }))
        .rejects.toThrow('Invalid item type: invalid');
    });

    it('prevents duplicate alerts within 24 hours', async () => {
      const existing = [{
        id: 'existing',
        type: 'alert',
        title: 'Existing',
        status: 'pending',
        metadata: { referenceId: 'ref-1' },
        createdAt: new Date().toISOString()
      }];
      readFile.mockResolvedValue(JSON.stringify(existing));

      const item = await createItem({
        type: 'alert',
        title: 'Duplicate',
        metadata: { referenceId: 'ref-1' }
      });
      expect(item.id).toBe('existing');
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('emits item:created event', async () => {
      readFile.mockRejectedValue({ code: 'ENOENT' });
      writeFile.mockResolvedValue();
      rename.mockResolvedValue();

      const handler = vi.fn();
      reviewEvents.on('item:created', handler);

      await createItem({ type: 'todo', title: 'Test' });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ title: 'Test' }));
    });
  });

  describe('completeItem', () => {
    it('marks an item as completed', async () => {
      const mockItems = [{ id: 'item-1', type: 'todo', title: 'Test', status: 'pending' }];
      readFile.mockResolvedValue(JSON.stringify(mockItems));
      writeFile.mockResolvedValue();
      rename.mockResolvedValue();

      const item = await completeItem('item-1');
      expect(item.status).toBe('completed');
    });

    it('throws on non-existent item', async () => {
      readFile.mockResolvedValue('[]');
      await expect(completeItem('missing')).rejects.toThrow('Review item not found: missing');
    });
  });

  describe('dismissItem', () => {
    it('marks an item as dismissed', async () => {
      const mockItems = [{ id: 'item-1', type: 'alert', title: 'Test', status: 'pending' }];
      readFile.mockResolvedValue(JSON.stringify(mockItems));
      writeFile.mockResolvedValue();
      rename.mockResolvedValue();

      const item = await dismissItem('item-1');
      expect(item.status).toBe('dismissed');
    });
  });

  describe('updateItem', () => {
    it('updates title and description', async () => {
      const mockItems = [{ id: 'item-1', type: 'todo', title: 'Old', description: '', status: 'pending' }];
      readFile.mockResolvedValue(JSON.stringify(mockItems));
      writeFile.mockResolvedValue();
      rename.mockResolvedValue();

      const item = await updateItem('item-1', { title: 'New', description: 'Desc' });
      expect(item.title).toBe('New');
      expect(item.description).toBe('Desc');
    });
  });

  describe('deleteItem', () => {
    it('removes an item', async () => {
      const mockItems = [{ id: 'item-1', type: 'todo', title: 'Test', status: 'pending' }];
      readFile.mockResolvedValue(JSON.stringify(mockItems));
      writeFile.mockResolvedValue();
      rename.mockResolvedValue();

      const removed = await deleteItem('item-1');
      expect(removed.id).toBe('item-1');

      const written = JSON.parse(writeFile.mock.calls[0][1]);
      expect(written).toHaveLength(0);
    });

    it('throws on non-existent item', async () => {
      readFile.mockResolvedValue('[]');
      await expect(deleteItem('missing')).rejects.toThrow('Review item not found: missing');
    });
  });

  describe('getBriefing', () => {
    it('returns plan content when no briefing exists', async () => {
      // First call for briefing.json returns null, second for PLAN.md
      readFile
        .mockRejectedValueOnce({ code: 'ENOENT' }) // briefing.json
        .mockResolvedValueOnce('# My Plan\nTodo list'); // PLAN.md

      const briefing = await getBriefing();
      expect(briefing.source).toBe('plan');
      expect(briefing.content).toContain('My Plan');
    });

    it('returns none when nothing available', async () => {
      readFile.mockRejectedValue({ code: 'ENOENT' });
      const briefing = await getBriefing();
      expect(briefing.source).toBe('none');
    });
  });
});
