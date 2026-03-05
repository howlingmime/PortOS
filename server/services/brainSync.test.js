import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./brainStorage.js', () => ({
  applyRemoteRecord: vi.fn(),
  applyRemoteJsonl: vi.fn()
}));

import { applyRemoteRecord, applyRemoteJsonl } from './brainStorage.js';
import { applyRemoteChanges } from './brainSync.js';

describe('brainSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies create via applyRemoteRecord and counts as inserted', async () => {
    applyRemoteRecord.mockResolvedValue({ applied: true });

    const result = await applyRemoteChanges([
      { op: 'create', type: 'people', id: 'p1', record: { name: 'Alice', updatedAt: '2026-01-01T00:00:00.000Z' } }
    ]);

    expect(applyRemoteRecord).toHaveBeenCalledWith('people', 'p1', { name: 'Alice', updatedAt: '2026-01-01T00:00:00.000Z' }, 'create');
    expect(result.inserted).toBe(1);
  });

  it('applies update via applyRemoteRecord and counts as updated', async () => {
    applyRemoteRecord.mockResolvedValue({ applied: true, reason: undefined });

    const result = await applyRemoteChanges([
      { op: 'update', type: 'ideas', id: 'i1', record: { title: 'Updated', updatedAt: '2026-01-01T00:00:00.000Z' } }
    ]);

    expect(result.updated).toBe(1);
  });

  it('applies delete via applyRemoteRecord and counts correctly', async () => {
    applyRemoteRecord.mockResolvedValue({ applied: true });

    const result = await applyRemoteChanges([
      { op: 'delete', type: 'projects', id: 'proj-1', record: null }
    ]);

    expect(applyRemoteRecord).toHaveBeenCalledWith('projects', 'proj-1', null, 'delete');
    expect(result.deleted).toBe(1);
  });

  it('routes JSONL types through applyRemoteJsonl', async () => {
    applyRemoteJsonl.mockResolvedValue({ applied: true });

    const result = await applyRemoteChanges([
      { op: 'create', type: 'digests', id: 'd1', record: { digestText: 'Today...' } }
    ]);

    expect(applyRemoteJsonl).toHaveBeenCalledWith('digests', { digestText: 'Today...', id: 'd1' });
    expect(result.inserted).toBe(1);
  });

  it('skips JSONL non-create ops', async () => {
    const result = await applyRemoteChanges([
      { op: 'update', type: 'reviews', id: 'r1', record: {} }
    ]);

    expect(applyRemoteJsonl).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('skips unknown entity types', async () => {
    const result = await applyRemoteChanges([
      { op: 'create', type: 'unknown_type', id: 'x1', record: { foo: 'bar' } }
    ]);

    expect(applyRemoteRecord).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('skips create/update when record is missing', async () => {
    const result = await applyRemoteChanges([
      { op: 'create', type: 'people', id: 'p2', record: null }
    ]);

    expect(applyRemoteRecord).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('counts as skipped when applyRemoteRecord returns applied:false', async () => {
    applyRemoteRecord.mockResolvedValue({ applied: false, reason: 'local_newer' });

    const result = await applyRemoteChanges([
      { op: 'update', type: 'admin', id: 'a1', record: { title: 'Old', updatedAt: '2020-01-01T00:00:00.000Z' } }
    ]);

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('handles mixed operations correctly', async () => {
    applyRemoteRecord
      .mockResolvedValueOnce({ applied: true }) // create people
      .mockResolvedValueOnce({ applied: true }) // delete projects
      .mockResolvedValueOnce({ applied: false, reason: 'local_newer' }); // update ideas
    applyRemoteJsonl.mockResolvedValue({ applied: true }); // create digest

    const result = await applyRemoteChanges([
      { op: 'create', type: 'people', id: 'p1', record: { name: 'A' } },
      { op: 'delete', type: 'projects', id: 'pr1', record: null },
      { op: 'update', type: 'ideas', id: 'i1', record: { title: 'B', updatedAt: '2020-01-01T00:00:00.000Z' } },
      { op: 'create', type: 'digests', id: 'd1', record: { text: 'C' } },
      { op: 'create', type: 'bogus', id: 'x1', record: { foo: 1 } }
    ]);

    expect(result.inserted).toBe(2); // people + digest
    expect(result.deleted).toBe(1);
    expect(result.skipped).toBe(2); // local_newer + unknown type
  });

  it('counts duplicate JSONL as skipped', async () => {
    applyRemoteJsonl.mockResolvedValue({ applied: false, reason: 'duplicate' });

    const result = await applyRemoteChanges([
      { op: 'create', type: 'reviews', id: 'r1', record: { reviewText: 'X' } }
    ]);

    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
  });
});
