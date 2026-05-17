import { useState, useRef, KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react';
import { ChevronRight, Plus, Pencil, Trash2, Check, X, Tag } from 'lucide-react';
import { toast } from 'sonner';

import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
  type CategoryDto,
} from '@/api/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Dynamic lucide icon renderer ─────────────────────────────────────────────

function CategoryIcon({ name, color }: { name?: string; color?: string }) {
  if (name) {
    const key =
      name.charAt(0).toUpperCase() +
      name.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[key];
    if (Icon) {
      return <Icon className="size-4 shrink-0" style={color ? { color } : undefined} />;
    }
  }
  return <Tag className="size-4 shrink-0 text-muted-foreground" />;
}

// ─── Optimistic update helpers ─────────────────────────────────────────────────

type OptCtx = { previous: CategoryDto[] | undefined };

function useOptimisticCategories(groupId: string) {
  const queryClient = useQueryClient();
  const key = ['categories', groupId];

  function snapshot() {
    return queryClient.getQueryData<CategoryDto[]>(key);
  }

  async function cancel() {
    await queryClient.cancelQueries({ queryKey: key });
  }

  function rollback(ctx: OptCtx | undefined) {
    if (ctx?.previous !== undefined) {
      queryClient.setQueryData(key, ctx.previous);
    }
  }

  function settle() {
    queryClient.invalidateQueries({ queryKey: key });
  }

  function set(updater: (old: CategoryDto[]) => CategoryDto[]) {
    queryClient.setQueryData<CategoryDto[]>(key, (old = []) => updater(old));
  }

  return { snapshot, cancel, rollback, settle, set };
}

// ─── Inline text field ─────────────────────────────────────────────────────────

function InlineEdit({
  value,
  onCommit,
  onCancel,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else onCancel();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input
        ref={ref}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={placeholder}
        className="h-7 text-sm py-0"
      />
      <Button size="icon-sm" variant="ghost" type="button" onMouseDown={(e) => { e.preventDefault(); commit(); }}>
        <Check className="size-3.5 text-green-600" />
      </Button>
      <Button size="icon-sm" variant="ghost" type="button" onMouseDown={(e) => { e.preventDefault(); onCancel(); }}>
        <X className="size-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ─── Add inline form ───────────────────────────────────────────────────────────

function AddInline({
  placeholder,
  onAdd,
  onCancel,
  className,
}: {
  placeholder: string;
  onAdd: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [name, setName] = useState('');

  function submit() {
    const t = name.trim();
    if (t) { onAdd(t); setName(''); }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => { if (!name.trim()) onCancel(); }}
        placeholder={placeholder}
        className="h-7 text-sm py-0"
      />
      <Button
        size="icon-sm"
        variant="ghost"
        type="button"
        onMouseDown={(e) => { e.preventDefault(); submit(); }}
        disabled={!name.trim()}
      >
        <Check className="size-3.5 text-green-600" />
      </Button>
      <Button size="icon-sm" variant="ghost" type="button" onMouseDown={(e) => { e.preventDefault(); onCancel(); }}>
        <X className="size-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ─── Main tab ──────────────────────────────────────────────────────────────────

interface Props {
  groupId: string;
  canEdit: boolean;
}

export function CategoriesTab({ groupId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const opt = useOptimisticCategories(groupId);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: () => getCategories(groupId),
  });

  // ── UI state ────────────────────────────────────────────────────────────────
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingSubKey, setEditingSubKey] = useState<string | null>(null); // `${catId}:${subId}`
  const [addSubForCatId, setAddSubForCatId] = useState<string | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [deletingSubKey, setDeletingSubKey] = useState<string | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', color: '#6366f1', icon: '' });

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Category mutations ─────────────────────────────────────────────────────

  const createCatMutation = useMutation({
    mutationFn: (payload: { name: string; color: string; icon: string }) =>
      createCategory(groupId, payload),
    onMutate: async (payload) => {
      await opt.cancel();
      const previous = opt.snapshot();
      const tempId = `temp-${Date.now()}`;
      opt.set((old) => [
        ...old,
        { id: tempId, name: payload.name, color: payload.color, icon: payload.icon, subcategories: [] },
      ]);
      return { previous };
    },
    onError: (_err, _v, ctx) => { opt.rollback(ctx); toast.error('Failed to create category'); },
    onSettled: () => opt.settle(),
    onSuccess: () => { setAddCatOpen(false); setNewCat({ name: '', color: '#6366f1', icon: '' }); },
  });

  const renameCatMutation = useMutation({
    mutationFn: ({ catId, name }: { catId: string; name: string }) =>
      updateCategory(groupId, catId, { name }),
    onMutate: async ({ catId, name }) => {
      await opt.cancel();
      const previous = opt.snapshot();
      opt.set((old) => old.map((c) => c.id === catId ? { ...c, name } : c));
      return { previous };
    },
    onError: (_err, _v, ctx) => { opt.rollback(ctx); toast.error('Failed to rename category'); },
    onSettled: () => opt.settle(),
  });

  const updateCatStyleMutation = useMutation({
    mutationFn: ({ catId, color, icon }: { catId: string; color?: string; icon?: string }) =>
      updateCategory(groupId, catId, { color, icon }),
    onMutate: async ({ catId, color, icon }) => {
      await opt.cancel();
      const previous = opt.snapshot();
      opt.set((old) => old.map((c) => c.id === catId ? {
        ...c,
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
      } : c));
      return { previous };
    },
    onError: (_err, _v, ctx) => { opt.rollback(ctx); },
    onSettled: () => opt.settle(),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (catId: string) => deleteCategory(groupId, catId),
    onMutate: async (catId) => {
      await opt.cancel();
      const previous = opt.snapshot();
      opt.set((old) => old.filter((c) => c.id !== catId));
      setDeletingCatId(null);
      return { previous };
    },
    onError: (_err, _v, ctx) => { opt.rollback(ctx); toast.error('Failed to delete category'); },
    onSettled: () => opt.settle(),
  });

  // ── Subcategory mutations ──────────────────────────────────────────────────

  const addSubMutation = useMutation({
    mutationFn: ({ catId, name }: { catId: string; name: string }) =>
      addSubcategory(groupId, catId, { name }),
    onMutate: async ({ catId, name }) => {
      await opt.cancel();
      const previous = opt.snapshot();
      const tempId = `temp-sub-${Date.now()}`;
      opt.set((old) => old.map((c) => c.id === catId
        ? { ...c, subcategories: [...c.subcategories, { id: tempId, name }] }
        : c));
      setAddSubForCatId(null);
      return { previous };
    },
    onError: (_err, _v, ctx) => { opt.rollback(ctx); toast.error('Failed to add subcategory'); },
    onSettled: () => opt.settle(),
  });

  const renameSubMutation = useMutation({
    mutationFn: ({ catId, subId, name }: { catId: string; subId: string; name: string }) =>
      updateSubcategory(groupId, catId, subId, { name }),
    onMutate: async ({ catId, subId, name }) => {
      await opt.cancel();
      const previous = opt.snapshot();
      opt.set((old) => old.map((c) => c.id === catId
        ? { ...c, subcategories: c.subcategories.map((s) => s.id === subId ? { ...s, name } : s) }
        : c));
      return { previous };
    },
    onError: (_err, _v, ctx) => { opt.rollback(ctx); toast.error('Failed to rename subcategory'); },
    onSettled: () => opt.settle(),
  });

  const deleteSubMutation = useMutation({
    mutationFn: ({ catId, subId }: { catId: string; subId: string }) =>
      deleteSubcategory(groupId, catId, subId),
    onMutate: async ({ catId, subId }) => {
      await opt.cancel();
      const previous = opt.snapshot();
      opt.set((old) => old.map((c) => c.id === catId
        ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) }
        : c));
      setDeletingSubKey(null);
      return { previous };
    },
    onError: (_err, _v, ctx) => { opt.rollback(ctx); toast.error('Failed to delete subcategory'); },
    onSettled: () => opt.settle(),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const isOpen = openIds.has(cat.id);
        const isEditingName = editingCatId === cat.id;
        const isDeleting = deletingCatId === cat.id;

        return (
          <div key={cat.id} className="rounded-xl border border-border overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors">
              {/* Expand toggle */}
              <button
                type="button"
                onClick={() => toggleOpen(cat.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <ChevronRight
                  className={cn(
                    'size-4 text-muted-foreground shrink-0 transition-transform',
                    isOpen && 'rotate-90',
                  )}
                />
                <CategoryIcon name={cat.icon} color={cat.color} />
                {!isEditingName ? (
                  <span className="text-sm font-medium text-foreground truncate">{cat.name}</span>
                ) : null}
              </button>

              {/* Inline name edit */}
              {isEditingName && canEdit && (
                <div className="flex-1">
                  <InlineEdit
                    value={cat.name}
                    onCommit={(name) => {
                      renameCatMutation.mutate({ catId: cat.id, name });
                      setEditingCatId(null);
                    }}
                    onCancel={() => setEditingCatId(null)}
                  />
                </div>
              )}

              {/* Color picker */}
              {canEdit && !isEditingName && (
                <label className="cursor-pointer" title="Change color">
                  <span
                    className="size-5 rounded-full border border-border block"
                    style={{ background: cat.color ?? '#6366f1' }}
                  />
                  <input
                    type="color"
                    value={cat.color ?? '#6366f1'}
                    className="sr-only"
                    onChange={(e) =>
                      updateCatStyleMutation.mutate({ catId: cat.id, color: e.target.value })
                    }
                  />
                </label>
              )}

              {/* Icon field */}
              {canEdit && !isEditingName && isOpen && (
                <input
                  type="text"
                  defaultValue={cat.icon ?? ''}
                  placeholder="icon"
                  title="Lucide icon name (e.g. 'home')"
                  onBlur={(e) => {
                    const icon = e.target.value.trim();
                    if (icon !== (cat.icon ?? '')) {
                      updateCatStyleMutation.mutate({ catId: cat.id, icon });
                    }
                  }}
                  className="w-20 h-6 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring"
                />
              )}

              {/* Actions */}
              {canEdit && !isEditingName && !isDeleting && (
                <div className="flex items-center gap-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Rename"
                    onClick={() => { setEditingCatId(cat.id); setOpenIds((p) => new Set([...p, cat.id])); }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Delete category"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingCatId(cat.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}

              {/* Delete confirm inline */}
              {isDeleting && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-destructive font-medium">Delete?</span>
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => deleteCatMutation.mutate(cat.id)}
                  >
                    Yes
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setDeletingCatId(null)}
                  >
                    No
                  </Button>
                </div>
              )}
            </div>

            {/* Subcategory list */}
            {isOpen && (
              <div className="divide-y divide-border border-t border-border">
                {cat.subcategories.map((sub) => {
                  const subKey = `${cat.id}:${sub.id}`;
                  const isEditingSub = editingSubKey === subKey;
                  const isDeletingSub = deletingSubKey === subKey;

                  return (
                    <div key={sub.id} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/20">
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />

                      {isEditingSub ? (
                        <div className="flex-1">
                          <InlineEdit
                            value={sub.name}
                            onCommit={(name) => {
                              renameSubMutation.mutate({ catId: cat.id, subId: sub.id, name });
                              setEditingSubKey(null);
                            }}
                            onCancel={() => setEditingSubKey(null)}
                          />
                        </div>
                      ) : (
                        <span className="flex-1 text-sm text-foreground">{sub.name}</span>
                      )}

                      {canEdit && !isEditingSub && !isDeletingSub && (
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setEditingSubKey(subKey)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingSubKey(subKey)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )}

                      {isDeletingSub && (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-destructive font-medium">Delete?</span>
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => deleteSubMutation.mutate({ catId: cat.id, subId: sub.id })}
                          >
                            Yes
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => setDeletingSubKey(null)}>
                            No
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add subcategory row */}
                {canEdit && (
                  <div className="px-4 py-2">
                    {addSubForCatId === cat.id ? (
                      <AddInline
                        placeholder="Subcategory name…"
                        onAdd={(name) => addSubMutation.mutate({ catId: cat.id, name })}
                        onCancel={() => setAddSubForCatId(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddSubForCatId(cat.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="size-3" />
                        Add subcategory
                      </button>
                    )}
                  </div>
                )}

                {cat.subcategories.length === 0 && addSubForCatId !== cat.id && (
                  <div className="px-4 py-2 text-xs text-muted-foreground italic">
                    No subcategories
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add new category */}
      {canEdit && (
        <div className="rounded-xl border border-dashed border-border">
          {addCatOpen ? (
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newCat.color}
                  onChange={(e) => setNewCat((p) => ({ ...p, color: e.target.value }))}
                  className="h-7 w-7 cursor-pointer rounded border border-input bg-transparent p-0.5"
                  title="Category color"
                />
                <Input
                  autoFocus
                  value={newCat.name}
                  onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Category name"
                  className="h-7 text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCat.name.trim()) {
                      createCatMutation.mutate(newCat);
                    }
                    if (e.key === 'Escape') setAddCatOpen(false);
                  }}
                />
                <Input
                  value={newCat.icon}
                  onChange={(e) => setNewCat((p) => ({ ...p, icon: e.target.value }))}
                  placeholder="icon name"
                  className="h-7 text-sm w-24"
                  title="Lucide icon name (e.g. 'home')"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setAddCatOpen(false); setNewCat({ name: '', color: '#6366f1', icon: '' }); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!newCat.name.trim() || createCatMutation.isPending}
                  onClick={() => createCatMutation.mutate(newCat)}
                >
                  {createCatMutation.isPending ? 'Adding…' : 'Add category'}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddCatOpen(true)}
              className="flex w-full items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-4" />
              Add category
            </button>
          )}
        </div>
      )}

      {categories.length === 0 && !addCatOpen && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No categories yet.
        </p>
      )}
    </div>
  );
}
