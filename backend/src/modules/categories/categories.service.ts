import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import { generateSlug } from '../../utils/slug.js';
import {
  CategoryQueryParams,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './categories.dto.js';
import { RequestContext } from '../../common/types.js';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  level: number;
  levelBadge: 'Root' | 'Subcategory' | 'Child';
  breadcrumbPath: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  children: CategoryNode[];
  createdAt: Date;
  updatedAt: Date;
}

const getLevelBadge = (level: number): 'Root' | 'Subcategory' | 'Child' => {
  switch (level) {
    case 1:
      return 'Root';
    case 2:
      return 'Subcategory';
    case 3:
    default:
      return 'Child';
  }
};

export class CategoriesService {
  // ─── Generate Unique Slug ────────────────────────────────────

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const baseSlug = generateSlug(name) || 'category';
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await prisma.category.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || existing.id === excludeId) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // ─── Build Breadcrumb for Category ───────────────────────────

  private async buildBreadcrumb(categoryId: string): Promise<{ path: string; trail: { id: string; name: string; slug: string }[] }> {
    const trail: { id: string; name: string; slug: string }[] = [];
    let currentId: string | null = categoryId;
    let depth = 0;

    while (currentId && depth < 5) {
      const cat: { id: string; name: string; slug: string; parentId: string | null } | null =
        await prisma.category.findUnique({
          where: { id: currentId },
          select: { id: true, name: true, slug: true, parentId: true },
        });

      if (!cat) break;
      trail.unshift({ id: cat.id, name: cat.name, slug: cat.slug });
      currentId = cat.parentId;
      depth++;
    }

    const path = trail.map((t) => t.name).join(' > ');
    return { path, trail };
  }

  // ─── Validate Max Depth & Circular Reference ─────────────────

  private async resolveLevelAndValidate(
    parentId?: string | null,
    currentCategoryId?: string
  ): Promise<number> {
    if (!parentId) {
      return 1; // Root Level
    }

    if (currentCategoryId && parentId === currentCategoryId) {
      throw AppError.badRequest('A category cannot be its own parent');
    }

    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, level: true, parentId: true },
    });

    if (!parent) {
      throw AppError.notFound('Parent category does not exist');
    }

    if (parent.level >= 3) {
      throw AppError.badRequest(
        'Maximum category nesting depth is 3 levels. Cannot add a child under a Level 3 category.'
      );
    }

    // Check for circular inheritance if editing an existing category
    if (currentCategoryId) {
      let ancestorId = parent.parentId;
      let depth = 0;
      while (ancestorId && depth < 5) {
        if (ancestorId === currentCategoryId) {
          throw AppError.badRequest('Circular reference detected: cannot choose a descendant as parent');
        }
        const ancestor = await prisma.category.findUnique({
          where: { id: ancestorId },
          select: { parentId: true },
        });
        ancestorId = ancestor?.parentId || null;
        depth++;
      }
    }

    return parent.level + 1;
  }

  // ─── Create Category (Admin Only) ────────────────────────────

  async create(input: CreateCategoryInput, userId: string, ctx: RequestContext) {
    const level = await this.resolveLevelAndValidate(input.parentId);
    const slug = await this.generateUniqueSlug(input.name);

    const category = await prisma.category.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        image: input.image || null,
        parentId: input.parentId || null,
        level,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
      },
    });

    const { path } = await this.buildBreadcrumb(category.id);

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entityType: 'CATEGORY',
        entityId: category.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { name: category.name, level: category.level, parentId: category.parentId },
      },
    });

    return {
      ...category,
      levelBadge: getLevelBadge(category.level),
      breadcrumbPath: path,
    };
  }

  // ─── Update Category (Admin Only) ────────────────────────────

  async update(id: string, input: UpdateCategoryInput, userId: string, ctx: RequestContext) {
    const existing = await prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Category not found');
    }

    let level = existing.level;
    if (input.parentId !== undefined && input.parentId !== existing.parentId) {
      level = await this.resolveLevelAndValidate(input.parentId, id);
    }

    let slug = existing.slug;
    if (input.name && input.name.trim() !== existing.name) {
      slug = await this.generateUniqueSlug(input.name, id);
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        slug,
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.image !== undefined ? { image: input.image || null } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId || null } : {}),
        level,
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
      },
    });

    // If level changed, recursively update children levels
    if (level !== existing.level) {
      await this.cascadeUpdateChildrenLevels(id, level);
    }

    const { path } = await this.buildBreadcrumb(updated.id);

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entityType: 'CATEGORY',
        entityId: updated.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { changes: input },
      },
    });

    return {
      ...updated,
      levelBadge: getLevelBadge(updated.level),
      breadcrumbPath: path,
    };
  }

  private async cascadeUpdateChildrenLevels(parentId: string, parentLevel: number) {
    const children = await prisma.category.findMany({
      where: { parentId },
      select: { id: true },
    });

    for (const child of children) {
      const childLevel = parentLevel + 1;
      await prisma.category.update({
        where: { id: child.id },
        data: { level: childLevel },
      });
      await this.cascadeUpdateChildrenLevels(child.id, childLevel);
    }
  }

  // ─── Delete Category (Admin Only) ────────────────────────────

  async delete(id: string, userId: string, ctx: RequestContext) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw AppError.notFound('Category not found');
    }

    if (category._count.children > 0) {
      throw AppError.badRequest(
        `Cannot delete category "${category.name}" because it has ${category._count.children} subcategories. Delete or move subcategories first.`
      );
    }

    if (category._count.products > 0) {
      throw AppError.badRequest(
        `Cannot delete category "${category.name}" because it contains ${category._count.products} products. Reassign or delete products first.`
      );
    }

    // Clean up any dealer category discounts for this category
    await prisma.dealerCategoryDiscount.deleteMany({
      where: { categoryId: id },
    });

    await prisma.category.delete({
      where: { id },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType: 'CATEGORY',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { name: category.name, slug: category.slug },
      },
    });

    return { message: `Category "${category.name}" deleted successfully` };
  }

  // ─── Get Single Category By ID ───────────────────────────────

  async getById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, slug: true, level: true } },
        _count: { select: { products: true, children: true } },
      },
    });

    if (!category) {
      throw AppError.notFound('Category not found');
    }

    const { path, trail } = await this.buildBreadcrumb(id);

    return {
      ...category,
      levelBadge: getLevelBadge(category.level),
      breadcrumbPath: path,
      breadcrumbTrail: trail,
      productCount: category._count.products,
      childCount: category._count.children,
    };
  }

  // ─── Get Flat Paginated Categories ───────────────────────────

  async getFlat(query: CategoryQueryParams) {
    const { page = 1, limit = 50, search, level, parentId, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (level) where.level = level;
    if (parentId) where.parentId = parentId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: true, children: true } },
        },
      }),
      prisma.category.count({ where }),
    ]);

    // Build breadcrumbs for the batch
    const items = await Promise.all(
      categories.map(async (cat) => {
        const { path } = await this.buildBreadcrumb(cat.id);
        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          image: cat.image,
          parentId: cat.parentId,
          parent: cat.parent,
          level: cat.level,
          levelBadge: getLevelBadge(cat.level),
          breadcrumbPath: path,
          sortOrder: cat.sortOrder,
          isActive: cat.isActive,
          productCount: cat._count.products,
          childCount: cat._count.children,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
        };
      })
    );

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Full Nested Tree (3 Levels) ─────────────────────────

  async getTree(): Promise<CategoryNode[]> {
    const allCategories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true } },
      },
    });

    const categoryMap = new Map<string, CategoryNode>();

    allCategories.forEach((cat) => {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        image: cat.image,
        parentId: cat.parentId,
        level: cat.level,
        levelBadge: getLevelBadge(cat.level),
        breadcrumbPath: cat.name,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        productCount: cat._count.products,
        children: [],
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      });
    });

    const tree: CategoryNode[] = [];

    // Assemble parent-child tree and compute breadcrumb paths
    categoryMap.forEach((node) => {
      if (node.parentId && categoryMap.has(node.parentId)) {
        const parent = categoryMap.get(node.parentId)!;
        node.breadcrumbPath = `${parent.breadcrumbPath} > ${node.name}`;
        parent.children.push(node);
      } else {
        tree.push(node);
      }
    });

    return tree;
  }
}

export const categoriesService = new CategoriesService();
