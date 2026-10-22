import { createServerFn } from "@tanstack/react-start";
import {
  fetchInTouchAllProducts,
  fetchInTouchProductBySku,
  mapInTouchProductToStoreProduct,
} from "./intouch-api";
import type { Product } from "@/data/products";
import { seedProducts as fallbackProducts } from "@/data/seed-products";
import { loadCatalogStore, setCatalogChangedCallback, type ProductRecord, type CategoryRecord } from "./catalog-store";

// Automatically clear in-memory storefront product cache whenever admin modifies markup or products
setCatalogChangedCallback(() => {
  invalidateStoreProductsCache();
});

// Helper to convert catalog store record into storefront Product
function mapRecordToProduct(r: ProductRecord): Product {
  return {
    slug: r.slug,
    name: r.name,
    category: r.categoryId,
    price: r.sellingPrice,
    image: r.image && r.image.trim() !== "" ? r.image : "/favicon.png",
    blurb: r.blurb,
    ...(r.badge ? { badge: r.badge } : {}),
    specs: [
      { label: "SKU", value: r.sku },
      { label: "Availability", value: "In Stock" },
      ...(r.specs || []).filter(
        (s: any) =>
          s.label !== "Available Stock" &&
          s.label !== "Stock Enabled" &&
          s.label !== "Base Price" &&
          s.label !== "Base Cost" &&
          s.label !== "Markup" &&
          s.label !== "Category Margin"
      ),
    ],
    rating: 4.8,
    reviews: 14,
    stock: r.stock,
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache for external ERP queries
let cachedProducts: Product[] | null = null;
let lastFetchTime = 0;
let isFetchingPromise: Promise<Product[]> | null = null;

// Version-tracked cache tied directly to catalog store lastUpdated timestamp
let cachedStoreLastUpdated: string | null = null;
let cachedActiveProducts: Product[] | null = null;

export function invalidateStoreProductsCache(): void {
  cachedStoreLastUpdated = null;
  cachedActiveProducts = null;
  cachedProducts = null;
  lastFetchTime = 0;
  isFetchingPromise = null;
}

export async function getLiveStoreProducts(): Promise<Product[]> {
  const store = loadCatalogStore();

  // If catalog store already contains synced POS / admin products (more than the initial fallback seeds),
  // serve them with instantaneous reactivity whenever store.lastUpdated changes!
  if (store.products && store.products.length > 50) {
    if (cachedActiveProducts && cachedStoreLastUpdated === store.lastUpdated) {
      return cachedActiveProducts;
    }

    const activeProducts = store.products
      .filter((p) => (p.stock || 0) > 0)
      .map(mapRecordToProduct);

    if (activeProducts.length > 0) {
      cachedActiveProducts = activeProducts;
      cachedStoreLastUpdated = store.lastUpdated;
      return cachedActiveProducts;
    }
  }

  const now = Date.now();
  if (cachedProducts && cachedProducts.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedProducts;
  }

  if (isFetchingPromise) {
    return isFetchingPromise;
  }

  isFetchingPromise = (async () => {
    try {
      const rawItems = await fetchInTouchAllProducts();
      if (rawItems && rawItems.length > 0) {
        // Build category markup mapping from admin catalog store
        const categoryMarkupMap: Record<string, number> = {};
        for (const cat of store.categories) {
          categoryMarkupMap[cat.id] = cat.markupPercentage;
        }

        // Build comprehensive admin overrides mapping for all products in catalog store
        const productOverridesMap: Record<
          string,
          {
            name?: string;
            categoryId?: string;
            overridePrice?: number | null;
            isOverridden?: boolean;
            image?: string | null;
            stock?: number;
          }
        > = {};

        for (const prod of store.products) {
          const overrideData = {
            name: prod.name,
            categoryId: prod.categoryId,
            overridePrice: prod.overridePrice,
            isOverridden: prod.isPriceOverridden,
            image: prod.image,
            stock: prod.stock,
          };
          if (prod.sku) {
            productOverridesMap[prod.sku] = overrideData;
            productOverridesMap[prod.sku.toLowerCase()] = overrideData;
          }
          if (prod.slug) {
            productOverridesMap[prod.slug] = overrideData;
            productOverridesMap[prod.slug.toLowerCase()] = overrideData;
          }
        }

        // Filter strictly for ACTIVE IN-STOCK products from InTouch ERP API (stock_qty > 0, price > 0)
        const activeInStock = rawItems.filter((item) => {
          const qty = parseFloat(item.stock_qty || "0");
          const price = parseFloat(item.selling_price || "0");
          const hasName = Boolean(item.product_name && item.product_name.trim().length > 0);
          return qty > 0 && price > 0 && hasName;
        });

        if (activeInStock.length > 0) {
          const erpProducts = activeInStock.map((item) =>
            mapInTouchProductToStoreProduct(item, undefined, categoryMarkupMap, productOverridesMap)
          );

          // Merge any custom products added directly through Admin Dashboard that are not from InTouch ERP
          const erpSkus = new Set(activeInStock.map((i) => (i.sub_sku || i.sku)?.toLowerCase()));
          const customAdminProducts = (store.products || [])
            .filter((p) => (p.stock || 0) > 0 && !erpSkus.has(p.sku.toLowerCase()))
            .map(mapRecordToProduct);

          cachedProducts = [...customAdminProducts, ...erpProducts];
          lastFetchTime = Date.now();
          return cachedProducts;
        }
      }
    } catch (err) {
      console.warn("Could not fetch active products from InTouch ERP, using catalog store:", err);
    } finally {
      isFetchingPromise = null;
    }

    // Graceful fallback to catalog store if API offline
    const managed = (store?.products || [])
      .filter((p) => (p.stock || 0) > 0)
      .map(mapRecordToProduct);
    const fallbackActive = fallbackProducts.filter((p) => (p.stock || 0) > 0);
    return managed.length > 0 ? managed : fallbackActive;
  })();

  return isFetchingPromise;
}

export type CatalogQueryParams = {
  category?: string;
  query?: string;
  sort?: "featured" | "price-asc" | "price-desc" | "rating";
  page?: number;
  limit?: number;
};

export type CatalogResponse = {
  items: Product[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
};

/**
 * Server function to fetch paginated/filtered catalog directly from live InTouch ERP
 */
export const fetchProductsCatalogFn = createServerFn({ method: "GET" })
  .validator((params: CatalogQueryParams) => params)
  .handler(async ({ data: params }): Promise<CatalogResponse> => {
    const all = await getLiveStoreProducts();
    let list = all.filter((p) => (p.stock || 0) > 0);

    if (params.category && params.category !== "all") {
      list = list.filter((p) => p.category === params.category);
    }

    if (params.query && params.query.trim()) {
      const q = params.query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.specs.some((s) => s.value.toLowerCase().includes(q)),
      );
    }

    if (params.sort === "price-asc") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (params.sort === "price-desc") {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (params.sort === "rating") {
      list = [...list].sort((a, b) => b.rating - a.rating);
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 36);
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const items = list.slice(start, start + limit);

    return {
      items,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };
  });

/**
 * Server function to fetch all live products
 */
export const fetchAllProductsFn = createServerFn({ method: "GET" }).handler(async () => {
  const all = await getLiveStoreProducts();
  return all.filter((p) => (p.stock || 0) > 0);
});

/**
 * Helper to get all categories from catalog store formatted for storefront
 */
export function getLiveStoreCategories(): CategoryRecord[] {
  try {
    const store = loadCatalogStore();
    if (store && Array.isArray(store.categories) && store.categories.length > 0) {
      return store.categories;
    }
  } catch (err) {
    console.warn("Could not load categories from catalog store:", err);
  }
  return [];
}

/**
 * Server function to fetch all live categories for the storefront
 */
export const fetchAllCategoriesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CategoryRecord[]> => {
    return getLiveStoreCategories();
  }
);

/**
 * Server function to fetch live products for a specific category
 */
export const fetchCategoryProductsFn = createServerFn({ method: "GET" })
  .validator((categorySlug: string) => categorySlug)
  .handler(async ({ data: categorySlug }): Promise<Product[]> => {
    const all = await getLiveStoreProducts();
    return all.filter((p) => p.category === categorySlug && (p.stock || 0) > 0);
  });

/**
 * Server function to fetch single product by slug or SKU
 */
export const fetchProductBySlugOrSkuFn = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<Product | null> => {
    const cleanSlug = slug?.trim();
    if (!cleanSlug) return null;
    const lowerSlug = cleanSlug.toLowerCase();

    // 1. Direct O(1) lookup in catalog store records
    const store = loadCatalogStore();
    if (store && Array.isArray(store.products)) {
      const directMatch = store.products.find(
        (p) =>
          p.slug.toLowerCase() === lowerSlug ||
          p.sku.toLowerCase() === lowerSlug
      );
      if (directMatch) {
        return mapRecordToProduct(directMatch);
      }
    }

    // 2. Lookup in live mapped active products
    const all = await getLiveStoreProducts();

    const bySlug = all.find(
      (p) => p.slug === cleanSlug || p.slug.toLowerCase() === lowerSlug,
    );
    if (bySlug) return bySlug;

    const bySku = all.find((p) =>
      p.specs.some(
        (s) => s.label === "SKU" && (s.value === cleanSlug || s.value.toLowerCase() === lowerSlug),
      ),
    );
    if (bySku) return bySku;

    // 3. Fallback direct query to InTouch ERP (only if stock_qty > 0)
    try {
      const raw = await fetchInTouchProductBySku(cleanSlug);
      if (raw) {
        const qty = parseFloat(raw.stock_qty || "0");
        if (qty > 0) {
          return mapInTouchProductToStoreProduct(raw);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch product SKU ${cleanSlug} directly from ERP:`, err);
    }

    return null;
  });
