'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Folder,
  FolderOpen,
  Tag,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit2,
  Trash2,
  Search,
  ExternalLink,
  Package,
  Layers,
  FolderTree,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import {
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  CategoryNode,
} from '@/features/categories/categoriesApi';

type PanelMode = 'idle' | 'detail' | 'create' | 'edit';

export default function CategoriesPage() {
  // RTK Query hooks
  const { data: treeData, isLoading: isTreeLoading, refetch: refetchTree } = useGetCategoryTreeQuery();
  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();

  const categories = useMemo(() => treeData?.data || [], [treeData]);

  // State management
  const [selectedCategory, setSelectedCategory] = useState<CategoryNode | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});

  // Form states
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    parentId: string;
    sortOrder: number;
    isActive: boolean;
  }>({
    name: '',
    description: '',
    parentId: '',
    sortOrder: 0,
    isActive: true,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Delete modal state
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toggle expand/collapse
  const toggleExpand = (id: string) => {
    setExpandedNodeIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Expand all nodes
  const handleExpandAll = () => {
    const allIds: Record<string, boolean> = {};
    const traverse = (nodes: CategoryNode[]) => {
      nodes.forEach((n) => {
        allIds[n.id] = true;
        if (n.children && n.children.length > 0) traverse(n.children);
      });
    };
    traverse(categories);
    setExpandedNodeIds(allIds);
  };

  // Collapse all nodes
  const handleCollapseAll = () => {
    setExpandedNodeIds({});
  };

  // Filter tree nodes recursively based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();

    const filterNodes = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes
        .map((node) => {
          const matchingChildren = node.children ? filterNodes(node.children) : [];
          const matchesCurrent =
            node.name.toLowerCase().includes(q) ||
            (node.description && node.description.toLowerCase().includes(q)) ||
            node.slug.toLowerCase().includes(q);

          if (matchesCurrent || matchingChildren.length > 0) {
            return {
              ...node,
              children: matchingChildren,
            };
          }
          return null;
        })
        .filter(Boolean) as CategoryNode[];
    };

    return filterNodes(categories);
  }, [categories, searchQuery]);

  // Flatten available parent categories for select dropdown (Levels 1 and 2 only, excluding descendant trees during edit)
  const availableParents = useMemo(() => {
    const parents: { id: string; name: string; level: number; breadcrumb: string }[] = [];

    // Helper to find all descendant IDs of a category to prevent circular reference
    const getDescendantIds = (root: CategoryNode): Set<string> => {
      const ids = new Set<string>([root.id]);
      const traverse = (node: CategoryNode) => {
        if (node.children) {
          node.children.forEach((c) => {
            ids.add(c.id);
            traverse(c);
          });
        }
      };
      traverse(root);
      return ids;
    };

    const excludedIds =
      panelMode === 'edit' && selectedCategory ? getDescendantIds(selectedCategory) : new Set<string>();

    categories.forEach((root) => {
      if (!excludedIds.has(root.id)) {
        parents.push({ id: root.id, name: root.name, level: 1, breadcrumb: root.name });
      }
      if (root.children) {
        root.children.forEach((sub) => {
          if (!excludedIds.has(sub.id)) {
            parents.push({
              id: sub.id,
              name: sub.name,
              level: 2,
              breadcrumb: `${root.name} > ${sub.name}`,
            });
          }
        });
      }
    });

    return parents;
  }, [categories, panelMode, selectedCategory]);

  // Open "Add Category" form
  const handleOpenAdd = (parentPresetId?: string) => {
    setFormData({
      name: '',
      description: '',
      parentId: parentPresetId || '',
      sortOrder: 0,
      isActive: true,
    });
    setFormError(null);
    setFormSuccess(null);
    setPanelMode('create');
  };

  // Open "Edit Category" form
  const handleOpenEdit = (category: CategoryNode) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive,
    });
    setFormError(null);
    setFormSuccess(null);
    setPanelMode('edit');
  };

  // Select node to view details
  const handleSelectNode = (category: CategoryNode) => {
    setSelectedCategory(category);
    setPanelMode('detail');
    setFormError(null);
    setFormSuccess(null);
  };

  // Handle Form Submit (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    try {
      if (panelMode === 'create') {
        const res = await createCategory({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          parentId: formData.parentId || null,
          sortOrder: Number(formData.sortOrder) || 0,
          isActive: formData.isActive,
        }).unwrap();

        setFormSuccess(`Category "${res.data.name}" created successfully.`);
        // Refresh tree and select newly created category
        const updatedTree = await refetchTree();
        if (updatedTree.data?.data) {
          // If created under a parent, ensure parent is expanded
          if (formData.parentId) {
            setExpandedNodeIds((prev) => ({ ...prev, [formData.parentId]: true }));
          }
        }
        setPanelMode('detail');
      } else if (panelMode === 'edit' && selectedCategory) {
        const res = await updateCategory({
          id: selectedCategory.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          parentId: formData.parentId || null,
          sortOrder: Number(formData.sortOrder) || 0,
          isActive: formData.isActive,
        }).unwrap();

        setFormSuccess(`Category "${res.data.name}" updated successfully.`);
        await refetchTree();
        setSelectedCategory((prev) => (prev ? { ...prev, ...res.data } : null));
        setPanelMode('detail');
      }
    } catch (err: any) {
      setFormError(
        err?.data?.message || err?.message || 'Operation failed. Please verify your inputs.'
      );
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setDeleteError(null);

    try {
      await deleteCategory(categoryToDelete.id).unwrap();
      setCategoryToDelete(null);
      if (selectedCategory?.id === categoryToDelete.id) {
        setSelectedCategory(null);
        setPanelMode('idle');
      }
      await refetchTree();
    } catch (err: any) {
      setDeleteError(
        err?.data?.message || err?.message || 'Unable to delete category. It may have products or subcategories.'
      );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#181818] tracking-tight">
            Categories
          </h1>
          <p className="text-xs text-[#706E6B] mt-0.5">
            Manage hierarchical product categories (Level 1 Root, Level 2 Subcategory, Level 3 Child)
          </p>
        </div>

        <button
          onClick={() => handleOpenAdd()}
          className="inline-flex items-center gap-2 h-9 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus size={16} />
          <span>Add Category</span>
        </button>
      </div>

      {/* ─── Two-Panel Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── LEFT PANEL: Category Tree (35% -> 4 cols or 5 cols on lg) */}
        <div className="lg:col-span-5 bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col">
          {/* Tree Header Controls */}
          <div className="p-3.5 border-b border-[#DDDBDA] bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#181818] uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree size={15} className="text-[#0176D3]" />
                Category Hierarchy
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2 py-0.5 rounded text-[#0176D3] hover:bg-blue-50 font-medium transition-colors"
                >
                  Expand all
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2 py-0.5 rounded text-[#706E6B] hover:bg-slate-100 font-medium transition-colors"
                >
                  Collapse all
                </button>
              </div>
            </div>

            {/* Search Input Filter */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#706E6B]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="w-full h-8 pl-8 pr-3 rounded border border-[#DDDBDA] text-xs text-[#181818] placeholder-[#A09E9B] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Tree Nodes List */}
          <div className="p-2 min-h-[420px] max-h-[640px] overflow-y-auto space-y-0.5 divide-y divide-slate-100/50">
            {isTreeLoading ? (
              <div className="p-4 space-y-3 animate-pulse">
                <div className="h-5 bg-slate-100 rounded w-3/4" />
                <div className="h-5 bg-slate-100 rounded w-2/3 ml-4" />
                <div className="h-5 bg-slate-100 rounded w-1/2 ml-8" />
                <div className="h-5 bg-slate-100 rounded w-4/5" />
                <div className="h-5 bg-slate-100 rounded w-3/5 ml-4" />
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <FolderTree size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-[#706E6B] font-medium">No matching categories found</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-[11px] text-[#0176D3] hover:underline"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              filteredCategories.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  level={1}
                  selectedId={selectedCategory?.id}
                  expandedNodeIds={expandedNodeIds}
                  onToggleExpand={toggleExpand}
                  onSelect={handleSelectNode}
                  onEdit={handleOpenEdit}
                  onDelete={(cat) => {
                    setCategoryToDelete(cat);
                    setDeleteError(null);
                  }}
                  searchQuery={searchQuery}
                />
              ))
            )}
          </div>
        </div>

        {/* ─── RIGHT PANEL: Details / Form (65% -> 7 cols on lg) ──────── */}
        <div className="lg:col-span-7 bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden">
          {/* Mode 1: IDLE / Empty State */}
          {panelMode === 'idle' && (
            <div className="p-12 text-center flex flex-col items-center justify-center min-h-[460px]">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <FolderTree size={32} className="text-[#0176D3]" />
              </div>
              <h3 className="text-base font-bold text-[#181818]">
                Select a category to view details
              </h3>
              <p className="text-xs text-[#706E6B] mt-1 max-w-sm">
                Choose a category from the hierarchy on the left, or create a new one using the button below.
              </p>
              <button
                onClick={() => handleOpenAdd()}
                className="mt-5 inline-flex items-center gap-2 h-9 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus size={15} />
                <span>Add Category</span>
              </button>
            </div>
          )}

          {/* Mode 2: DETAIL VIEW */}
          {panelMode === 'detail' && selectedCategory && (
            <div className="p-6 space-y-6">
              {/* Header with Title and Quick Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#DDDBDA]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <LevelBadge level={selectedCategory.level} badge={selectedCategory.levelBadge} />
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        selectedCategory.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {selectedCategory.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[#181818]">
                    {selectedCategory.name}
                  </h2>
                  <p className="text-xs text-[#706E6B] mt-0.5 font-medium">
                    {selectedCategory.breadcrumbPath || selectedCategory.name}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(selectedCategory)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#181818] transition-colors"
                  >
                    <Edit2 size={13} className="text-[#0176D3]" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      setCategoryToDelete(selectedCategory);
                      setDeleteError(null);
                    }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-[#BA0517] transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Success Notification if any */}
              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#706E6B] mb-1.5">
                  Description
                </h4>
                <div className="bg-slate-50 rounded p-3 text-xs text-[#444444] border border-slate-200/60 leading-relaxed">
                  {selectedCategory.description || (
                    <span className="italic text-slate-400">No description provided for this category.</span>
                  )}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200/70 rounded p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#706E6B] font-medium">Products Linked</span>
                    <Package size={15} className="text-[#0176D3]" />
                  </div>
                  <p className="text-lg font-bold text-[#181818] mt-1">
                    {selectedCategory.productCount}
                  </p>
                  <Link
                    href={`/products?category=${selectedCategory.id}`}
                    className="text-[11px] font-semibold text-[#0176D3] hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    View products
                    <ExternalLink size={11} />
                  </Link>
                </div>

                <div className="bg-slate-50 border border-slate-200/70 rounded p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#706E6B] font-medium">Subcategories</span>
                    <Layers size={15} className="text-purple-600" />
                  </div>
                  <p className="text-lg font-bold text-[#181818] mt-1">
                    {selectedCategory.children?.length ?? 0}
                  </p>
                  <span className="text-[11px] text-[#706E6B]">direct children</span>
                </div>

                <div className="bg-slate-50 border border-slate-200/70 rounded p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#706E6B] font-medium">Created On</span>
                    <Info size={15} className="text-slate-500" />
                  </div>
                  <p className="text-sm font-bold text-[#181818] mt-1.5">
                    {formatDate(selectedCategory.createdAt)}
                  </p>
                  <span className="text-[10px] text-[#706E6B] font-mono truncate block mt-0.5">
                    slug: {selectedCategory.slug}
                  </span>
                </div>
              </div>

              {/* Add Subcategory Action if Level < 3 */}
              {selectedCategory.level < 3 && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-[#706E6B]">
                    Want to add a subcategory under <strong className="text-[#181818]">{selectedCategory.name}</strong>?
                  </span>
                  <button
                    onClick={() => handleOpenAdd(selectedCategory.id)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-blue-50 hover:bg-blue-100 text-[#0176D3] text-xs font-semibold transition-colors"
                  >
                    <Plus size={13} />
                    <span>Add Subcategory (Level {selectedCategory.level + 1})</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 3 & 4: CREATE or EDIT FORM */}
          {(panelMode === 'create' || panelMode === 'edit') && (
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#DDDBDA] mb-5">
                <div>
                  <h2 className="text-base font-bold text-[#181818]">
                    {panelMode === 'create' ? 'Create New Category' : `Edit Category: ${selectedCategory?.name}`}
                  </h2>
                  <p className="text-xs text-[#706E6B] mt-0.5">
                    {panelMode === 'create'
                      ? 'Add a root category or assign a parent to form subcategories'
                      : 'Update category metadata and hierarchy placement'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelMode(selectedCategory ? 'detail' : 'idle')}
                  className="p-1 rounded text-[#706E6B] hover:text-[#181818] hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Error Banner */}
              {formError && (
                <div className="mb-4 bg-[#FDF3F2] border border-[#F8D7D2] rounded p-3 text-xs text-[#BA0517] flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-[#BA0517]" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitForm} className="space-y-4">
                {/* Category Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Category Name <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Hex Bolts & Fasteners"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>

                {/* Parent Category Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Parent Category
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors bg-white"
                  >
                    <option value="">None (Creates Level 1 Root Category)</option>
                    {availableParents.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.level === 1 ? `📁 ${parent.name} (Level 1)` : `   └─ 📂 ${parent.name} (Level 2)`}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#706E6B] mt-1">
                    Select a Level 1 parent to create Level 2, or Level 2 to create Level 3 child. Maximum 3 levels allowed.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the products grouped in this category..."
                    className="w-full rounded border border-[#DDDBDA] p-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>

                {/* Display Sort Order & Active Toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                    />
                  </div>

                  <div className="flex items-center pt-6">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#181818]">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded border-[#DDDBDA] text-[#0176D3] focus:ring-[#0176D3] w-4 h-4 cursor-pointer"
                      />
                      <span>Active Category</span>
                    </label>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="pt-4 border-t border-[#DDDBDA] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPanelMode(selectedCategory ? 'detail' : 'idle')}
                    className="h-9 px-4 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || isUpdating}
                    className="h-9 px-5 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    {(isCreating || isUpdating) ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{panelMode === 'create' ? 'Create Category' : 'Save Changes'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ─── Delete Confirmation Modal ───────────────────────────────── */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-md w-full p-5 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-[#BA0517]" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[#181818]">
                  Delete Category
                </h3>
                <p className="text-xs text-[#706E6B] mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-[#181818]">&quot;{categoryToDelete.name}&quot;</strong>?
                  This action cannot be undone.
                </p>

                {deleteError && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      setCategoryToDelete(null);
                      setDeleteError(null);
                    }}
                    className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="h-8 px-4 rounded bg-[#BA0517] hover:bg-rose-800 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Delete</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Level Badge Component ──────────────────────────────────────────

function LevelBadge({
  level,
  badge,
  isWhiteOnBlue = false,
}: {
  level: number;
  badge?: string;
  isWhiteOnBlue?: boolean;
}) {
  if (isWhiteOnBlue) {
    return (
      <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-white/20 text-white border border-white/30">
        {level === 1 ? 'Root' : level === 2 ? 'Sub' : 'Child'}
      </span>
    );
  }

  switch (level) {
    case 1:
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Root
        </span>
      );
    case 2:
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Sub
        </span>
      );
    case 3:
    default:
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          Child
        </span>
      );
  }
}

// ─── Tree Node Item (Recursive Component) ───────────────────────────

interface TreeNodeProps {
  node: CategoryNode;
  level: number;
  selectedId?: string;
  expandedNodeIds: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onSelect: (node: CategoryNode) => void;
  onEdit: (node: CategoryNode) => void;
  onDelete: (node: CategoryNode) => void;
  searchQuery?: string;
}

function TreeNodeItem({
  node,
  level,
  selectedId,
  expandedNodeIds,
  onToggleExpand,
  onSelect,
  onEdit,
  onDelete,
  searchQuery,
}: TreeNodeProps) {
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  // If searching, auto-expand to show matches
  const isExpanded = searchQuery ? true : (expandedNodeIds[node.id] ?? (level === 1));

  // Indentation class according to level requirement (Level 1: 0px, Level 2: 16px, Level 3: 32px)
  const paddingLeft = level === 1 ? 'pl-2' : level === 2 ? 'pl-6' : 'pl-10';

  return (
    <div>
      <div
        className={`group flex items-center justify-between py-1.5 pr-2 rounded transition-colors cursor-pointer select-none ${paddingLeft} ${
          isSelected
            ? 'bg-[#0176D3] text-white shadow-xs'
            : 'text-[#181818] hover:bg-slate-100/80'
        }`}
        onClick={() => onSelect(node)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Chevron expand/collapse for Level 1 & 2 */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.id);
              }}
              className={`p-0.5 rounded transition-transform ${
                isSelected ? 'text-white/80 hover:text-white' : 'text-[#706E6B] hover:text-[#181818]'
              }`}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* Folder or Tag Icon */}
          <span className="shrink-0">
            {level === 1 ? (
              isExpanded ? (
                <FolderOpen size={15} className={isSelected ? 'text-white' : 'text-[#0176D3]'} />
              ) : (
                <Folder size={15} className={isSelected ? 'text-white' : 'text-[#0176D3]'} />
              )
            ) : level === 2 ? (
              <Folder size={14} className={isSelected ? 'text-white' : 'text-purple-600'} />
            ) : (
              <Tag size={13} className={isSelected ? 'text-white' : 'text-slate-500'} />
            )}
          </span>

          {/* Category Name */}
          <span
            className={`text-xs truncate ${
              level === 1 ? 'font-bold' : level === 2 ? 'font-semibold' : 'font-normal'
            }`}
          >
            {node.name}
          </span>

          {/* Level Badge */}
          <span className="shrink-0 ml-1">
            <LevelBadge level={level} isWhiteOnBlue={isSelected} />
          </span>

          {/* Product count */}
          {node.productCount > 0 && (
            <span
              className={`text-[10px] px-1 py-0.1 rounded shrink-0 ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#706E6B]'
              }`}
            >
              {node.productCount}
            </span>
          )}
        </div>

        {/* Action buttons (hover) */}
        <div
          className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 ${
            isSelected ? 'opacity-100' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Edit Category"
            onClick={() => onEdit(node)}
            className={`p-1 rounded transition-colors ${
              isSelected
                ? 'text-white hover:bg-white/20'
                : 'text-slate-500 hover:text-[#0176D3] hover:bg-slate-200/60'
            }`}
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            title="Delete Category"
            onClick={() => onDelete(node)}
            className={`p-1 rounded transition-colors ${
              isSelected
                ? 'text-white hover:bg-white/20'
                : 'text-slate-500 hover:text-[#BA0517] hover:bg-rose-100'
            }`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Render children recursively if expanded */}
      {hasChildren && isExpanded && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedNodeIds={expandedNodeIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}
