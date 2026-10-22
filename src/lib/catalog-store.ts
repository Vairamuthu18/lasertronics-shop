/**
 * Catalog Store & Category-Based Pricing Engine
 * Persistent catalog data management with category markup rules,
 * individual product overrides, image media library, and LKR currency support.
 */

import { createServerFn } from "@tanstack/react-start";
import * as fs from "node:fs";
import * as path from "node:path";
import { fetchInTouchAllProducts } from "./intouch-api";

export * from "./catalog-types";
import {
  type CategoryRecord,
  type ProductRecord,
  type MediaRecord,
  type OrderRecord,
  type OrderItem,
  type CustomerDetails,
  type OrderStatus,
  type CatalogData,
  type ProductSpec,
  calculateSellingPrice,
  computeProductPricing,
  formatLKR,
  formatINR,
} from "./catalog-types";


// Initial Default Categories with Category-Based Markup Rules
const initialCategories: CategoryRecord[] = [
  {
    id: "mobile-accessories",
    name: "Mobile Accessories",
    tagline: "Charge, carry, connect",
    description: "Fast chargers, braided cables, power banks and audio gear.",
    markupPercentage: 20, // 20% markup
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "electronics",
    name: "Electronics",
    tagline: "Components & modules",
    description: "Passive components, motors, relays and power modules.",
    markupPercentage: 15, // 15% markup
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tv-accessories",
    name: "TV Accessories",
    tagline: "Every screen, connected",
    description: "HDMI, optical and streaming accessories.",
    markupPercentage: 10, // 10% markup
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "iot-and-microcontrollers",
    name: "IoT & Microcontrollers",
    tagline: "Build connected things",
    description: "Dev boards, sensors and starter kits for makers.",
    markupPercentage: 25, // 25% markup
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "repair-kits",
    name: "Repair Kits",
    tagline: "Bench-grade tooling",
    description: "Soldering stations, precision drivers and ESD-safe tools.",
    markupPercentage: 18, // 18% markup
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Initial Rich Catalog Seed with realistic base prices in INR, specs, and stock
const initialProductsSeed: Omit<ProductRecord, "sellingPrice">[] = [
  {
    sku: "LT-1001",
    slug: "65w-gan-fast-charger",
    name: "65W GaN Fast Charger Dual USB-C + USB-A",
    categoryId: "mobile-accessories",
    basePrice: 1200, // Base LKR 1,200 + 20% = LKR 1,440
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/gan-charger.jpg",
    stock: 45,
    blurb: "Compact Gallium Nitride wall charger with dynamic Power Delivery 3.0.",
    badge: "Bestseller",
    specs: [
      { label: "Power Output", value: "65W Max" },
      { label: "Ports", value: "2x USB-C, 1x USB-A" },
      { label: "Technology", value: "GaN III SafeCharge" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-1002",
    slug: "braided-usb-c-to-usb-c-cable-2m",
    name: "Braided USB-C to USB-C Cable (2m, 100W PD)",
    categoryId: "mobile-accessories",
    basePrice: 350, // Base LKR 350 + 20% = LKR 420
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/usbc-cable.jpg",
    stock: 120,
    blurb: "High-durability Kevlar-reinforced braided charging cable supporting up to 100W PD.",
    badge: "Popular",
    specs: [
      { label: "Length", value: "2.0 Meters" },
      { label: "Power Rating", value: "100W (20V/5A)" },
      { label: "Data Transfer", value: "480 Mbps" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-1003",
    slug: "20000mah-magsafe-power-bank",
    name: "20,000mAh Magnetic Wireless Power Bank",
    categoryId: "mobile-accessories",
    basePrice: 2200, // Base LKR 2,200 + 20% = LKR 2,640 (Overridden to LKR 2,499 special deal)
    isPriceOverridden: true,
    overridePrice: 2499, // Special deal override
    image: "/assets/p/magsafe-powerbank.jpg",
    stock: 28,
    blurb: "High-capacity slim magnetic power bank with digital battery indicator.",
    badge: "Special Deal",
    specs: [
      { label: "Capacity", value: "20,000 mAh / 74Wh" },
      { label: "Wireless Output", value: "15W MagSafe" },
      { label: "Wired Output", value: "22.5W QC / 20W PD" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-1004",
    slug: "lightning-to-usb-c-cable-1m",
    name: "MFi Certified Lightning to USB-C Cable (1.2m)",
    categoryId: "mobile-accessories",
    basePrice: 400, // Base LKR 400 + 20% = LKR 480
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/lightning-cable.jpg",
    stock: 85,
    blurb: "Original C94 chip Apple certified fast charging sync cable.",
    specs: [
      { label: "Certification", value: "Apple MFi" },
      { label: "Length", value: "1.2 Meters" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-2001",
    slug: "esp32-wroom-32d-dev-board",
    name: "ESP32-WROOM-32D Dual-Core Wi-Fi + BLE Dev Board",
    categoryId: "iot-and-microcontrollers",
    basePrice: 420, // Base LKR 420 + 25% = LKR 525
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/esp32.jpg",
    stock: 140,
    blurb: "Versatile 38-pin ESP32 development board with onboard antenna and CP2102.",
    badge: "Maker Choice",
    specs: [
      { label: "SoC", value: "ESP32-D0WDQ6 Dual-Core 240MHz" },
      { label: "Wireless", value: "Wi-Fi 802.11 b/g/n + BT 4.2 BR/EDR & BLE" },
      { label: "Flash", value: "4MB SPI Flash" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-2002",
    slug: "arduino-uno-r3-atmega328p",
    name: "Arduino Uno R3 Compatible Board (DIP ATmega328P)",
    categoryId: "iot-and-microcontrollers",
    basePrice: 380, // Base LKR 380 + 25% = LKR 475
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/uno.jpg",
    stock: 95,
    blurb: "Standard Arduino Uno microcontroller development board with 14 digital I/O pins.",
    specs: [
      { label: "Microcontroller", value: "ATmega328P (Removable DIP)" },
      { label: "Operating Voltage", value: "5V DC" },
      { label: "Analog Inputs", value: "6 Channels (10-bit)" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-2003",
    slug: "ultrasonic-distance-sensor-hcsr04",
    name: "HC-SR04 Ultrasonic Distance Sensor Module",
    categoryId: "iot-and-microcontrollers",
    basePrice: 90, // Base LKR 90 + 25% = LKR 112.50
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/ultrasonic.jpg",
    stock: 250,
    blurb: "Non-contact 2cm to 400cm distance measurement sensor module.",
    specs: [
      { label: "Range", value: "2cm – 400cm" },
      { label: "Operating Current", value: "15mA" },
      { label: "Trigger Input", value: "10µs TTL Pulse" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-3001",
    slug: "60w-temperature-controlled-soldering-station",
    name: "60W Digital Temperature Controlled Soldering Station",
    categoryId: "repair-kits",
    basePrice: 2800, // Base LKR 2,800 + 18% = LKR 3,304
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/soldering-station.jpg",
    stock: 22,
    blurb: "Precision ceramic heating element with digital PID temperature stabilization (200°C–480°C).",
    badge: "Pro Grade",
    specs: [
      { label: "Power", value: "60W (ESD Safe)" },
      { label: "Temp Range", value: "200°C – 480°C" },
      { label: "Stability", value: "±2°C" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-3002",
    slug: "128-in-1-precision-screwdriver-kit",
    name: "128-in-1 Precision Magnetic Screwdriver Repair Toolkit",
    categoryId: "repair-kits",
    basePrice: 1100, // Base LKR 1,100 + 18% = LKR 1,298
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/screwdriver-set.jpg",
    stock: 60,
    blurb: "Complete repair kit for smartphones, laptops, electronics, and small home appliances.",
    specs: [
      { label: "Bits Material", value: "CR-V Steel (HRC58-62)" },
      { label: "Includes", value: "Flexible shaft, tweezers, magnetizer, pry tools" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-4001",
    slug: "4k-ultra-hd-hdmi-2-0-cable-3m",
    name: "Ultra HD 4K 60Hz Braided HDMI 2.0 Cable (3m)",
    categoryId: "tv-accessories",
    basePrice: 320, // Base LKR 320 + 10% = LKR 352
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/hdmi-cable.jpg",
    stock: 80,
    blurb: "Gold-plated 18Gbps high speed HDMI cable with HDR and ARC support.",
    specs: [
      { label: "Bandwidth", value: "18 Gbps" },
      { label: "Resolution", value: "4K @ 60Hz / 2K @ 144Hz" },
      { label: "Connectors", value: "24K Gold-Plated Type A" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-4002",
    slug: "universal-smart-tv-remote-control",
    name: "Universal Smart TV Remote with Voice & Netflix Shortcut",
    categoryId: "tv-accessories",
    basePrice: 450, // Base LKR 450 + 10% = LKR 495
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/remote.jpg",
    stock: 65,
    blurb: "Pre-programmed for Samsung, LG, Sony, TCL, Hisense, and Android Smart TVs.",
    specs: [
      { label: "Transmission", value: "Infrared 38kHz + Bluetooth" },
      { label: "Operating Distance", value: "> 10 Meters" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-5001",
    slug: "breadboard-friendly-3-3v-5v-power-module",
    name: "Breadboard Power Supply Module 3.3V / 5V DC (MB102)",
    categoryId: "electronics",
    basePrice: 110, // Base LKR 110 + 15% = LKR 126.50
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/psu-module.jpg",
    stock: 150,
    blurb: "Plugs directly into standard 830/400 tie point breadboards with dual rail selection.",
    specs: [
      { label: "Input Voltage", value: "6.5V – 12V (DC Barrel) or USB" },
      { label: "Output Voltage", value: "3.3V or 5V (Switch selectable)" },
      { label: "Max Current", value: "700 mA" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    sku: "LT-5002",
    slug: "electrolytic-capacitor-kit-500pcs",
    name: "500-Piece Electrolytic Capacitor Assortment Kit (24 Values)",
    categoryId: "electronics",
    basePrice: 650, // Base LKR 650 + 15% = LKR 747.50
    isPriceOverridden: false,
    overridePrice: null,
    image: "/assets/p/capacitor-kit.jpg",
    stock: 40,
    blurb: "Comprehensive assortment of radial aluminum capacitors from 0.1µF to 1000µF (10V-50V).",
    specs: [
      { label: "Range", value: "0.1µF to 1000µF" },
      { label: "Tolerance", value: "±20%" },
      { label: "Quantity", value: "500 Pieces with organizer case" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    // Product deliberately without image to test placeholder requirement
    sku: "LT-5003",
    slug: "1-4w-metal-film-resistor-kit-600pcs",
    name: "1/4W 1% Metal Film Resistors Assortment (600 Pieces)",
    categoryId: "electronics",
    basePrice: 280, // Base LKR 280 + 15% = LKR 322
    isPriceOverridden: false,
    overridePrice: null,
    image: null, // NO IMAGE - Tests placeholder requirement
    stock: 90,
    blurb: "High precision 1% tolerance metal film resistors across 30 common E12 values.",
    specs: [
      { label: "Power Rating", value: "0.25 Watt" },
      { label: "Tolerance", value: "±1%" },
      { label: "Values", value: "10Ω to 1MΩ (20pcs each)" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    // Product with manual price override
    sku: "LT-5004",
    slug: "5v-dual-channel-relay-module-optocoupler",
    name: "5V Dual Channel Relay Module with Optocoupler Isolation",
    categoryId: "electronics",
    basePrice: 150, // Base LKR 150 + 15% = LKR 172.50. Manual override to LKR 185.00
    isPriceOverridden: true,
    overridePrice: 185,
    image: "/assets/p/relay.jpg",
    stock: 110,
    blurb: "High current relay module capable of switching 250V AC / 10A or 30V DC / 10A.",
    badge: "Overridden Price",
    specs: [
      { label: "Control Voltage", value: "5V DC" },
      { label: "Switching Capacity", value: "10A @ 250VAC / 30VDC" },
      { label: "Isolation", value: "Optical Optocoupler" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper to build initial data
function buildInitialData(): CatalogData {
  const catMap = new Map<string, number>();
  for (const c of initialCategories) {
    catMap.set(c.id, c.markupPercentage);
  }

  const products: ProductRecord[] = initialProductsSeed.map((p) => {
    const markup = catMap.get(p.categoryId) ?? 15;
    const computed = computeProductPricing(p, markup);
    return {
      ...p,
      markupPercentage: markup,
      sellingPrice: computed.finalPrice,
    };
  });

  const media: MediaRecord[] = [
    {
      id: "med-1",
      filename: "gan-charger.jpg",
      url: "/assets/p/gan-charger.jpg",
      sizeBytes: 42000,
      mimeType: "image/jpeg",
      categoryId: "mobile-accessories",
      productSku: "LT-1001",
      uploadedAt: new Date().toISOString(),
    },
    {
      id: "med-2",
      filename: "usbc-cable.jpg",
      url: "/assets/p/usbc-cable.jpg",
      sizeBytes: 41460,
      mimeType: "image/jpeg",
      categoryId: "mobile-accessories",
      productSku: "LT-1002",
      uploadedAt: new Date().toISOString(),
    },
    {
      id: "med-3",
      filename: "esp32.jpg",
      url: "/assets/p/esp32.jpg",
      sizeBytes: 46910,
      mimeType: "image/jpeg",
      categoryId: "iot-and-microcontrollers",
      productSku: "LT-2001",
      uploadedAt: new Date().toISOString(),
    },
    {
      id: "med-4",
      filename: "soldering-station.jpg",
      url: "/assets/p/soldering-station.jpg",
      sizeBytes: 40020,
      mimeType: "image/jpeg",
      categoryId: "repair-kits",
      productSku: "LT-3001",
      uploadedAt: new Date().toISOString(),
    },
  ];

  return {
    categories: initialCategories,
    products,
    media,
    orders: [],
    version: 1,
    lastUpdated: new Date().toISOString(),
  };
}

// In-Memory store for fast server execution
let memoryStore: CatalogData | null = null;
let lastDiskMtime: number = 0;

function getDbFilePath(): string {
  if (typeof process !== "undefined" && typeof process.cwd === "function" && path && typeof path.resolve === "function") {
    try {
      const candidates = [
        path.resolve(process.cwd(), "src/data/catalog-db.json"),
        path.resolve(process.cwd(), "data/catalog-db.json"),
        path.resolve(process.cwd(), "catalog-db.json"),
        path.resolve(process.cwd(), "public/data/catalog-db.json"),
        path.resolve(process.cwd(), "public/catalog-db.json"),
        path.resolve(process.cwd(), ".output/server/catalog-db.json"),
        "/var/task/src/data/catalog-db.json",
        "/var/task/public/data/catalog-db.json",
      ];
      for (const c of candidates) {
        if (fs && typeof fs.existsSync === "function" && fs.existsSync(c)) {
          return c;
        }
      }
    } catch {
      return "src/data/catalog-db.json";
    }
  }
  return "src/data/catalog-db.json";
}

/**
 * Load or initialize catalog data from storage
 */
export function loadCatalogStore(): CatalogData {
  if (typeof window !== "undefined") {
    if (memoryStore) return memoryStore;
    memoryStore = buildInitialData();
    return memoryStore;
  }

  const dbPath = getDbFilePath();
  try {
    if (fs && typeof fs.existsSync === "function" && fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      const mtime = stats.mtimeMs;
      // If memoryStore exists and disk file hasn't changed since last read, return in-memory cache
      if (memoryStore && lastDiskMtime > 0 && mtime <= lastDiskMtime) {
        return memoryStore;
      }
      const raw = fs.readFileSync(dbPath, "utf-8");
      const parsed = JSON.parse(raw) as CatalogData;
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.products) && parsed.products.length > 0) {
        parsed.orders = Array.isArray(parsed.orders) ? parsed.orders : [];
        memoryStore = parsed;
        lastDiskMtime = mtime;
        return memoryStore;
      }
    }
  } catch (err) {
    console.warn("Could not read catalog-db.json from disk, fallback to bundled data:", err);
  }

  if (memoryStore) {
    return memoryStore;
  }

  // Initialize and write to disk
  memoryStore = buildInitialData();
  saveCatalogStore(memoryStore);
  return memoryStore;
}

/**
 * Persist catalog data
 */
export function saveCatalogStore(data: CatalogData): void {
  memoryStore = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    return;
  }

  const dbPath = getDbFilePath();
  try {
    if (path && typeof path.dirname === "function" && fs && typeof fs.existsSync === "function") {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(dbPath, JSON.stringify(memoryStore, null, 2), "utf-8");
      try {
        lastDiskMtime = fs.statSync(dbPath).mtimeMs;
      } catch {}
    }
  } catch (err) {
    console.warn("Could not write catalog-db.json to disk (e.g. read-only env):", err);
  }

  if (onCatalogChangedCallback) {
    try {
      onCatalogChangedCallback();
    } catch (e) {
      console.warn("Catalog change callback error:", e);
    }
  }
}

let onCatalogChangedCallback: (() => void) | null = null;
export function setCatalogChangedCallback(cb: () => void): void {
  onCatalogChangedCallback = cb;
}

// ==========================================
// Catalog Query & Modification Methods
// ==========================================

export function getCategories(): CategoryRecord[] {
  return loadCatalogStore().categories;
}

export function getProducts(): ProductRecord[] {
  return loadCatalogStore().products;
}

export function getMedia(): MediaRecord[] {
  return loadCatalogStore().media;
}

export function getCategoryById(id: string): CategoryRecord | undefined {
  return loadCatalogStore().categories.find((c) => c.id === id);
}

export function getProductBySku(sku: string): ProductRecord | undefined {
  return loadCatalogStore().products.find(
    (p) => p.sku === sku || p.slug === sku || p.sku.toLowerCase() === sku.toLowerCase()
  );
}

/**
 * Save or Update a Product
 */
export function saveProduct(input: {
  sku: string;
  name: string;
  categoryId: string;
  basePrice: number;
  isPriceOverridden?: boolean | undefined;
  overridePrice?: number | null | undefined;
  image?: string | null | undefined;
  stock?: number | undefined;
  blurb?: string | undefined;
  badge?: string | undefined;
  specs?: ProductSpec[] | undefined;
}): ProductRecord {
  const store = loadCatalogStore();
  const category = store.categories.find((c) => c.id === input.categoryId);
  const catMarkup = category ? category.markupPercentage : 15;

  const basePrice = Math.max(0, Number(input.basePrice) || 0);
  const isOverridden = Boolean(input.isPriceOverridden && input.overridePrice != null && input.overridePrice > 0);
  const overridePrice = isOverridden ? Math.max(0, Number(input.overridePrice) || 0) : null;

  const pricing = computeProductPricing(
    {
      basePrice,
      isPriceOverridden: isOverridden,
      overridePrice,
    },
    catMarkup
  );

  const cleanName = input.name.trim();
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const existingIndex = store.products.findIndex(
    (p) => p.sku.toLowerCase() === input.sku.trim().toLowerCase()
  );

  const now = new Date().toISOString();

  const record: ProductRecord = {
    sku: input.sku.trim(),
    slug: slug ? `${slug}-${input.sku.trim().toLowerCase()}` : `item-${input.sku.trim().toLowerCase()}`,
    name: cleanName,
    categoryId: input.categoryId,
    basePrice,
    markupPercentage: catMarkup,
    isPriceOverridden: isOverridden,
    overridePrice,
    sellingPrice: pricing.finalPrice,
    image: input.image ? input.image.trim() : null,
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    blurb: input.blurb?.trim() || `${cleanName} genuine component.`,
    badge: input.badge?.trim() || undefined,
    specs: Array.isArray(input.specs) ? input.specs : [],
    createdAt: existingIndex >= 0 && store.products[existingIndex] ? store.products[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    store.products[existingIndex] = record;
  } else {
    store.products.unshift(record);
  }

  saveCatalogStore(store);
  return record;
}

/**
 * Delete a Product
 */
export function deleteProduct(sku: string): boolean {
  const store = loadCatalogStore();
  const initialLength = store.products.length;
  store.products = store.products.filter(
    (p) => p.sku.toLowerCase() !== sku.toLowerCase()
  );
  if (store.products.length !== initialLength) {
    saveCatalogStore(store);
    return true;
  }
  return false;
}

/**
 * Save or Update a Category
 * When category markup percentage changes, all products in that category
 * are automatically recalculated EXCEPT those with active manual price overrides!
 */
export function saveCategory(input: {
  id?: string | undefined;
  name: string;
  tagline?: string | undefined;
  description?: string | undefined;
  markupPercentage: number;
}): CategoryRecord {
  const store = loadCatalogStore();
  const now = new Date().toISOString();

  const id = (input.id || input.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const markupPct = Math.max(0, Number(input.markupPercentage) || 0);

  const existingIndex = store.categories.findIndex((c) => c.id === id);

  const record: CategoryRecord = {
    id,
    name: input.name.trim(),
    tagline: input.tagline?.trim() || "Quality components",
    description: input.description?.trim() || "",
    markupPercentage: markupPct,
    createdAt: existingIndex >= 0 && store.categories[existingIndex] ? store.categories[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    store.categories[existingIndex] = record;
  } else {
    store.categories.push(record);
  }

  // CRITICAL REQUIREMENT: Automatically recalculate product selling prices for this category.
  // DO NOT overwrite products with manual price overrides (isPriceOverridden === true).
  store.products = store.products.map((p) => {
    if (p.categoryId === id) {
      const pricing = computeProductPricing(p, markupPct);
      return {
        ...p,
        markupPercentage: markupPct,
        sellingPrice: pricing.finalPrice, // Maintains overridePrice if overridden!
        updatedAt: now,
      };
    }
    return p;
  });

  saveCatalogStore(store);
  return record;
}

/**
 * Update Category Markup Percentage directly
 */
export function updateCategoryMarkup(categoryId: string, newMarkupPercentage: number): CategoryRecord {
  const store = loadCatalogStore();
  const category = store.categories.find((c) => c.id === categoryId);
  if (!category) {
    throw new Error(`Category "${categoryId}" not found.`);
  }

  const markupPct = Math.max(0, Number(newMarkupPercentage) || 0);
  const now = new Date().toISOString();

  category.markupPercentage = markupPct;
  category.updatedAt = now;

  // Recalculate selling price for all products in this category while preserving individual overrides
  store.products = store.products.map((p) => {
    if (p.categoryId === categoryId) {
      const pricing = computeProductPricing(p, markupPct);
      return {
        ...p,
        markupPercentage: markupPct,
        sellingPrice: pricing.finalPrice,
        updatedAt: now,
      };
    }
    return p;
  });

  saveCatalogStore(store);
  return category;
}

/**
 * Delete a Category
 */
export function deleteCategory(categoryId: string, reassignToCategoryId?: string): boolean {
  const store = loadCatalogStore();
  const exists = store.categories.some((c) => c.id === categoryId);
  if (!exists) return false;

  store.categories = store.categories.filter((c) => c.id !== categoryId);

  // If reassigning products:
  const targetCategory = reassignToCategoryId
    ? store.categories.find((c) => c.id === reassignToCategoryId)
    : store.categories[0];

  const targetMarkup = targetCategory ? targetCategory.markupPercentage : 15;
  const targetId = targetCategory ? targetCategory.id : "uncategorized";

  store.products = store.products.map((p) => {
    if (p.categoryId === categoryId) {
      const updated = {
        ...p,
        categoryId: targetId,
        markupPercentage: targetMarkup,
      };
      const pricing = computeProductPricing(updated, targetMarkup);
      return {
        ...updated,
        sellingPrice: pricing.finalPrice,
        updatedAt: new Date().toISOString(),
      };
    }
    return p;
  });

  saveCatalogStore(store);
  return true;
}

/**
 * Reset an individual product's manual price override back to category markup formula
 */
export function resetProductPriceOverride(sku: string): ProductRecord {
  const store = loadCatalogStore();
  const product = store.products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
  if (!product) {
    throw new Error(`Product with SKU "${sku}" not found.`);
  }

  const category = store.categories.find((c) => c.id === product.categoryId);
  const markup = category ? category.markupPercentage : (product.markupPercentage || 15);

  product.isPriceOverridden = false;
  product.overridePrice = null;
  product.markupPercentage = markup;
  product.sellingPrice = calculateSellingPrice(product.basePrice, markup);
  product.updatedAt = new Date().toISOString();

  saveCatalogStore(store);
  return product;
}

/**
 * Add or Record Media File
 */
export function addMediaRecord(media: Omit<MediaRecord, "id" | "uploadedAt">): MediaRecord {
  const store = loadCatalogStore();
  const id = `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const record: MediaRecord = {
    ...media,
    id,
    uploadedAt: new Date().toISOString(),
  };

  store.media.unshift(record);
  saveCatalogStore(store);
  return record;
}

/**
 * Delete Media Record
 */
export function deleteMediaRecord(id: string): boolean {
  const store = loadCatalogStore();
  const item = store.media.find((m) => m.id === id);
  if (!item) return false;

  // Unlink from products using this image
  store.products = store.products.map((p) => {
    if (p.image === item.url) {
      return { ...p, image: null, updatedAt: new Date().toISOString() };
    }
    return p;
  });

  store.media = store.media.filter((m) => m.id !== id);

  // If local file in public/uploads, try deleting
  if (item.url.startsWith("/uploads/") && typeof window === "undefined") {
    try {
      const cwd = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";
      const filePath = path.resolve(cwd, "public", item.url.replace(/^\//, ""));
      if (fs && typeof fs.existsSync === "function" && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.warn("Could not delete file from disk:", e);
    }
  }

  saveCatalogStore(store);
  return true;
}

/**
 * Bulk Import or Update Products
 */
export function bulkImportProducts(productsToImport: Array<{
  sku: string;
  name: string;
  categoryId: string;
  basePrice: number;
  isPriceOverridden?: boolean | undefined;
  overridePrice?: number | null | undefined;
  image?: string | null | undefined;
  stock?: number | undefined;
  blurb?: string | undefined;
  badge?: string | undefined;
}>): { imported: number; updated: number } {
  let imported = 0;
  let updated = 0;

  for (const item of productsToImport) {
    if (!item.sku || !item.name) continue;
    const existing = getProductBySku(item.sku);
    if (existing) {
      updated++;
    } else {
      imported++;
    }
    saveProduct({
      sku: item.sku,
      name: item.name,
      categoryId: item.categoryId || "electronics",
      basePrice: Number(item.basePrice) || 0,
      isPriceOverridden: Boolean(item.isPriceOverridden),
      overridePrice: item.overridePrice != null ? Number(item.overridePrice) : null,
      image: item.image || null,
      stock: Number(item.stock) || 0,
      blurb: item.blurb,
      badge: item.badge,
    });
  }

  return { imported, updated };
}

/**
 * Create a new customer order in the persistent catalog store
 */
export function createOrder(data: {
  customer: CustomerDetails;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: "cod" | "bank" | "card";
}): OrderRecord {
  const store = loadCatalogStore();
  store.orders = Array.isArray(store.orders) ? store.orders : [];

  const now = new Date().toISOString();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const id = `LT-${Date.now().toString().slice(-6)}-${randomSuffix}`;

  const newOrder: OrderRecord = {
    id,
    customer: data.customer,
    items: data.items,
    subtotal: Math.round(data.subtotal * 100) / 100,
    shipping: Math.round(data.shipping * 100) / 100,
    total: Math.round(data.total * 100) / 100,
    paymentMethod: data.paymentMethod,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  store.orders.unshift(newOrder); // Newest orders first
  saveCatalogStore(store);

  return newOrder;
}

/**
 * Update the status of an existing order
 */
export function updateOrderStatus(orderId: string, status: OrderStatus): OrderRecord {
  const store = loadCatalogStore();
  store.orders = Array.isArray(store.orders) ? store.orders : [];

  const idx = store.orders.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Order ${orderId} not found`);
  }

  const updated: OrderRecord = {
    ...store.orders[idx],
    status,
    updatedAt: new Date().toISOString(),
  };

  store.orders[idx] = updated;
  saveCatalogStore(store);

  return updated;
}

/**
 * Delete an order
 */
export function deleteOrder(orderId: string): boolean {
  const store = loadCatalogStore();
  store.orders = Array.isArray(store.orders) ? store.orders : [];

  const initialLen = store.orders.length;
  store.orders = store.orders.filter((o) => o.id !== orderId);
  if (store.orders.length !== initialLen) {
    saveCatalogStore(store);
    return true;
  }
  return false;
}

/**
 * Assign one or more existing catalog/POS products to a category
 * and recalculate selling prices based on the category's markup percentage.
 */
export function assignProductsToCategory(
  productSkus: string[],
  categoryId: string
): {
  success: boolean;
  updatedCount: number;
  categoryName: string;
  markupPercentage: number;
} {
  const store = loadCatalogStore();
  const category = store.categories.find((c) => c.id === categoryId);
  if (!category) {
    throw new Error(`Category "${categoryId}" not found.`);
  }

  const skuSet = new Set(productSkus.map((s) => s.toLowerCase().trim()));
  let updatedCount = 0;
  const now = new Date().toISOString();

  for (const product of store.products) {
    if (skuSet.has(product.sku.toLowerCase().trim())) {
      product.categoryId = categoryId;
      product.markupPercentage = category.markupPercentage;
      if (!product.isPriceOverridden) {
        const markupAmount =
          Math.round(((product.basePrice * category.markupPercentage) / 100) * 100) / 100;
        product.sellingPrice = Math.round((product.basePrice + markupAmount) * 100) / 100;
      }
      product.updatedAt = now;
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    saveCatalogStore(store);
  }

  return {
    success: true,
    updatedCount,
    categoryName: category.name,
    markupPercentage: category.markupPercentage,
  };
}

/**
 * Add or update products from POS into a specific category.
 * If product exists in store, its category is changed to categoryId and price recalculated.
 * If product does not exist, it is imported directly from POS into this category!
 */
export function addPosProductsToCategory(
  items: {
    sku: string;
    name: string;
    basePrice: number;
    stock: number;
    unit?: string;
    image?: string | null;
  }[],
  categoryId: string
): {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  categoryName: string;
  markupPercentage: number;
} {
  const store = loadCatalogStore();
  const category = store.categories.find((c) => c.id === categoryId);
  if (!category) {
    throw new Error(`Category "${categoryId}" not found.`);
  }

  const existingMap = new Map<string, ProductRecord>();
  for (const p of store.products) {
    existingMap.set(p.sku.toLowerCase().trim(), p);
  }

  let addedCount = 0;
  let updatedCount = 0;
  const now = new Date().toISOString();
  const markupPct = category.markupPercentage;

  for (const item of items) {
    const sku = item.sku.trim();
    if (!sku) continue;

    const existing = existingMap.get(sku.toLowerCase());
    const basePrice = Math.max(0, Number(item.basePrice) || 0);
    const markupAmount = Math.round(((basePrice * markupPct) / 100) * 100) / 100;
    const sellingPrice = Math.round((basePrice + markupAmount) * 100) / 100;

    if (existing) {
      existing.categoryId = categoryId;
      existing.markupPercentage = markupPct;
      if (!existing.isPriceOverridden) {
        existing.sellingPrice = sellingPrice;
      }
      if (item.stock !== undefined) {
        existing.stock = Math.max(0, Math.floor(Number(item.stock) || 0));
      }
      existing.updatedAt = now;
      updatedCount++;
    } else {
      const cleanName = item.name.trim();
      const slugPart = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const skuPart = sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const slug = slugPart ? `${slugPart}-${skuPart}` : `prod-${skuPart}`;

      const newRecord: ProductRecord = {
        sku,
        slug,
        name: cleanName,
        categoryId,
        basePrice,
        markupPercentage: markupPct,
        isPriceOverridden: false,
        overridePrice: null,
        sellingPrice,
        image: item.image || null,
        stock: Math.max(0, Math.floor(Number(item.stock) || 0)),
        blurb: `${cleanName} (${item.unit || "unit"}). InTouch POS catalog item. SKU: ${sku}`,
        specs: [
          { label: "SKU", value: sku },
          { label: "Unit", value: item.unit || "Pc(s)" },
          { label: "Source", value: "InTouch POS" },
        ],
        createdAt: now,
        updatedAt: now,
      };

      store.products.unshift(newRecord);
      existingMap.set(sku.toLowerCase(), newRecord);
      addedCount++;
    }
  }

  saveCatalogStore(store);

  return {
    success: true,
    addedCount,
    updatedCount,
    categoryName: category.name,
    markupPercentage: category.markupPercentage,
  };
}

/**
 * Synchronize live products directly from InTouch POS ERP into the Catalog Store
 */
export async function syncProductsFromPos(inStockOnly = true): Promise<{
  success: boolean;
  totalErpScanned: number;
  inStockCount: number;
  syncedCount: number;
  newAdded: number;
  updated: number;
  categoryBreakdown: Record<string, number>;
}> {
  const rawItems = await fetchInTouchAllProducts();
  if (!rawItems || !Array.isArray(rawItems)) {
    throw new Error("Unable to fetch products from InTouch POS ERP.");
  }

  const store = loadCatalogStore();

  const filteredItems = inStockOnly
    ? rawItems.filter((p) => {
        const qty = parseFloat(p.stock_qty || "0");
        const price = parseFloat(p.selling_price || "0");
        return qty > 0 && price > 0 && p.product_name && p.product_name.trim();
      })
    : rawItems.filter((p) => p.product_name && p.product_name.trim());

  const existingMap = new Map<string, ProductRecord>();
  for (const p of store.products) {
    if (p.sku) existingMap.set(p.sku.toLowerCase(), p);
  }

  const categoryMarkupMap: Record<string, number> = {};
  for (const cat of store.categories) {
    categoryMarkupMap[cat.id] = cat.markupPercentage;
  }

  function detectCategory(name: string): string {
    const lower = name.toLowerCase();
    if (/solder|iron|toolkit|driver|tweezer|desolder|pump|station|flux|paste|cutter|plier|magnif|mat|antistatic|pry/.test(lower)) return "repair-kits";
    if (/esp32|esp8266|arduino|nodemcu|uno|nano|mega|stm32|raspberry|pi|sensor|ultrasonic|dht|pir|relay|servo|step|motor|oled|lcd|module|iot/.test(lower)) return "iot-and-microcontrollers";
    if (/tv|remote|hdmi|av|displayport|vga|optical|splitter|switch|converter|wallmount|bracket/.test(lower)) return "tv-accessories";
    if (/cable|charger|power bank|powerbank|earbuds|headphone|holder|stand|magsafe|battery|usb|type-c|lightning/.test(lower)) return "mobile-accessories";
    return "electronics";
  }

  const categoryPools: Record<string, string[]> = {
    "mobile-accessories": ["/assets/p/usbc-cable.jpg", "/assets/p/powerbank.jpg", "/assets/p/gan-charger.jpg", "/assets/p/magsafe-powerbank.jpg"],
    "electronics": ["/assets/p/psu-module.jpg", "/assets/p/capacitor-kit.jpg", "/assets/p/resistor-kit.jpg", "/assets/p/led-kit.jpg", "/assets/p/relay.jpg"],
    "tv-accessories": ["/assets/p/hdmi-cable.jpg", "/assets/p/remote.jpg", "/assets/p/wallmount.jpg", "/assets/p/tv-keyboard.jpg"],
    "iot-and-microcontrollers": ["/assets/p/esp32.jpg", "/assets/p/nodemcu.jpg", "/assets/p/uno.jpg", "/assets/p/nano.jpg", "/assets/p/ultrasonic.jpg"],
    "repair-kits": ["/assets/p/soldering-station.jpg", "/assets/p/screwdriver-set.jpg", "/assets/p/multimeter.jpg", "/assets/p/desolder-pump.jpg"],
  };

  function selectImage(name: string, cat: string, key: string) {
    const pool = categoryPools[cat] || categoryPools["electronics"];
    let hash = 0;
    const str = key || name;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % pool.length;
    return pool[idx];
  }

  let newAdded = 0;
  let updated = 0;
  const categoryBreakdown: Record<string, number> = {};
  const now = new Date().toISOString();
  const syncedList: ProductRecord[] = [];

  for (const item of filteredItems) {
    const sku = item.sub_sku || item.sku || item.product_id;
    const existing = existingMap.get(sku.toLowerCase());

    const purchasePrice = parseFloat(item.purchase_price || "0");
    const rawSellingPrice = parseFloat(item.selling_price || "0");
    const basePrice = purchasePrice > 0 ? purchasePrice : rawSellingPrice;
    const stock = Math.max(0, Math.floor(parseFloat(item.stock_qty || "0")));

    const categoryId = existing?.categoryId || detectCategory(item.product_name);
    categoryBreakdown[categoryId] = (categoryBreakdown[categoryId] || 0) + 1;

    const markupPct = categoryMarkupMap[categoryId] || 15;

    let isPriceOverridden = existing?.isPriceOverridden || false;
    let overridePrice = existing?.overridePrice ?? null;
    let sellingPrice = 0;

    if (isPriceOverridden && overridePrice != null && overridePrice > 0) {
      sellingPrice = overridePrice;
    } else {
      const markupAmount = Math.round(((basePrice * markupPct) / 100) * 100) / 100;
      sellingPrice = Math.round((basePrice + markupAmount) * 100) / 100;
    }

    const cleanName = item.product_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const skuPart = sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const slug = cleanName ? `${cleanName}-${skuPart}` : `prod-${skuPart}`;

    const image = existing?.image || selectImage(item.product_name, categoryId, sku);

    const record: ProductRecord = {
      sku,
      slug,
      name: item.product_name,
      categoryId,
      basePrice,
      markupPercentage: markupPct,
      isPriceOverridden,
      overridePrice,
      sellingPrice,
      image,
      stock,
      blurb: `${item.product_name} (${item.unit || "unit"}). Genuine InTouch POS inventory. SKU: ${sku}`,
      specs: [
        { label: "SKU", value: sku },
        { label: "Unit", value: item.unit || "Pc(s)" },
        { label: "Availability", value: "In Stock" },
        ...(item.sub_sku && item.sub_sku !== item.sku ? [{ label: "Variation SKU", value: item.sub_sku }] : []),
        ...(item.variation_name ? [{ label: "Variation", value: item.variation_name }] : []),
      ],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (existing) {
      updated++;
    } else {
      newAdded++;
    }

    syncedList.push(record);
  }

  store.products = syncedList;
  saveCatalogStore(store);

  return {
    success: true,
    totalErpScanned: rawItems.length,
    inStockCount: filteredItems.length,
    syncedCount: syncedList.length,
    newAdded,
    updated,
    categoryBreakdown,
  };
}

// ==========================================
// TanStack Start Server Functions (RPC)
// ==========================================

export interface AdminCatalogResponse {
  categories: CategoryRecord[];
  products: ProductRecord[];
  media: MediaRecord[];
  orders: OrderRecord[];
  stats: {
    totalProducts: number;
    totalCategories: number;
    productsWithoutImages: number;
    overriddenPriceCount: number;
    totalStockValue: number;
    averageMarkupPercentage: number;
    totalOrders: number;
    pendingOrdersCount: number;
    totalRevenue: number;
  };
}

export const fetchAdminCatalogFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminCatalogResponse> => {
    const store = loadCatalogStore();
    const categories = store.categories;
    const products = store.products;
    const media = store.media;
    const orders = Array.isArray(store.orders) ? store.orders : [];

    const productsWithoutImages = products.filter((p) => !p.image || p.image.trim() === "").length;
    const overriddenPriceCount = products.filter((p) => p.isPriceOverridden).length;
    const totalStockValue = products.reduce((acc, p) => acc + p.sellingPrice * p.stock, 0);

    const avgMarkup =
      categories.length > 0
        ? Math.round(
            (categories.reduce((acc, c) => acc + c.markupPercentage, 0) / categories.length) * 10
          ) / 10
        : 0;

    const pendingOrdersCount = orders.filter((o) => o.status === "pending").length;
    const totalRevenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);

    return {
      categories,
      products,
      media,
      orders,
      stats: {
        totalProducts: products.length,
        totalCategories: categories.length,
        productsWithoutImages,
        overriddenPriceCount,
        totalStockValue,
        averageMarkupPercentage: avgMarkup,
        totalOrders: orders.length,
        pendingOrdersCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
    };
  }
);

export const saveProductFn = createServerFn({ method: "POST" })
  .validator((data: {
    sku: string;
    name: string;
    categoryId: string;
    basePrice: number;
    isPriceOverridden?: boolean | undefined;
    overridePrice?: number | null | undefined;
    image?: string | null | undefined;
    stock?: number | undefined;
    blurb?: string | undefined;
    badge?: string | undefined;
    specs?: ProductSpec[] | undefined;
  }) => data)
  .handler(async ({ data }) => {
    return saveProduct(data);
  });

export const deleteProductFn = createServerFn({ method: "POST" })
  .validator((sku: string) => sku)
  .handler(async ({ data: sku }) => {
    return deleteProduct(sku);
  });

export const saveCategoryFn = createServerFn({ method: "POST" })
  .validator((data: {
    id?: string | undefined;
    name: string;
    tagline?: string | undefined;
    description?: string | undefined;
    markupPercentage: number;
  }) => data)
  .handler(async ({ data }) => {
    return saveCategory(data);
  });

export const updateCategoryMarkupFn = createServerFn({ method: "POST" })
  .validator((data: { categoryId: string; markupPercentage: number }) => data)
  .handler(async ({ data }) => {
    return updateCategoryMarkup(data.categoryId, data.markupPercentage);
  });

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .validator((data: { categoryId: string; reassignTo?: string }) => data)
  .handler(async ({ data }) => {
    return deleteCategory(data.categoryId, data.reassignTo);
  });

export const resetProductOverrideFn = createServerFn({ method: "POST" })
  .validator((sku: string) => sku)
  .handler(async ({ data: sku }) => {
    return resetProductPriceOverride(sku);
  });

export const deleteMediaFn = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    return deleteMediaRecord(id);
  });

export const bulkImportFn = createServerFn({ method: "POST" })
  .validator((data: Array<{
    sku: string;
    name: string;
    categoryId: string;
    basePrice: number;
    isPriceOverridden?: boolean | undefined;
    overridePrice?: number | null | undefined;
    image?: string | null | undefined;
    stock?: number | undefined;
    blurb?: string | undefined;
    badge?: string | undefined;
  }>) => data)
  .handler(async ({ data }) => {
    return bulkImportProducts(data);
  });

export const uploadImageFn = createServerFn({ method: "POST" })
  .validator((data: {
    filename: string;
    dataUrl: string; // Base64 data URI
    categoryId?: string | undefined;
    productSku?: string | undefined;
  }) => data)
  .handler(async ({ data }) => {
    // 1. Validate data URI
    const match = data.dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error("Invalid base64 image data.");
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");

    // 2. Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      throw new Error("Image file exceeds the 5MB size limit.");
    }

    // 3. Validate supported MIME type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!validTypes.includes(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF, SVG.`);
    }

    // 4. Save file to public/uploads/
    const cwd = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";
    const uploadsDir = path.resolve(cwd, "public/uploads");
    if (fs && typeof fs.existsSync === "function" && !fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = mimeType === "image/png" ? ".png" :
                mimeType === "image/webp" ? ".webp" :
                mimeType === "image/gif" ? ".gif" :
                mimeType === "image/svg+xml" ? ".svg" : ".jpg";

    const cleanBase = data.filename.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/\.[^.]+$/, "");
    const safeFilename = `${cleanBase}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, safeFilename);

    if (fs && typeof fs.writeFileSync === "function") {
      fs.writeFileSync(filePath, buffer);
    }
    const publicUrl = `/uploads/${safeFilename}`;

    // 5. Create media record
    const record = addMediaRecord({
      filename: safeFilename,
      url: publicUrl,
      sizeBytes: buffer.length,
      mimeType,
      categoryId: data.categoryId,
      productSku: data.productSku,
    });

    // 6. If productSku provided, attach to product immediately
    if (data.productSku) {
      const prod = getProductBySku(data.productSku);
      if (prod) {
        saveProduct({
          ...prod,
          image: publicUrl,
        });
      }
    }

    return record;
  });

export const syncProductsFromPosFn = createServerFn({ method: "POST" })
  .validator((inStockOnly?: boolean) => inStockOnly ?? true)
  .handler(async ({ data: inStockOnly }) => {
    return syncProductsFromPos(inStockOnly);
  });

export const createOrderFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      customer: CustomerDetails;
      items: OrderItem[];
      subtotal: number;
      shipping: number;
      total: number;
      paymentMethod: "cod" | "bank" | "card";
    }) => data
  )
  .handler(async ({ data }) => {
    return createOrder(data);
  });

export const updateOrderStatusFn = createServerFn({ method: "POST" })
  .validator((data: { orderId: string; status: OrderStatus }) => data)
  .handler(async ({ data }) => {
    return updateOrderStatus(data.orderId, data.status);
  });

export const deleteOrderFn = createServerFn({ method: "POST" })
  .validator((orderId: string) => orderId)
  .handler(async ({ data: orderId }) => {
    return deleteOrder(orderId);
  });

export const assignProductsToCategoryFn = createServerFn({ method: "POST" })
  .validator((data: { productSkus: string[]; categoryId: string }) => data)
  .handler(async ({ data }) => {
    return assignProductsToCategory(data.productSkus, data.categoryId);
  });

export const addPosProductsToCategoryFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      items: {
        sku: string;
        name: string;
        basePrice: number;
        stock: number;
        unit?: string;
        image?: string | null;
      }[];
      categoryId: string;
    }) => data
  )
  .handler(async ({ data }) => {
    return addPosProductsToCategory(data.items, data.categoryId);
  });

export const fetchLivePosItemsFn = createServerFn({ method: "POST" })
  .validator((inStockOnly?: boolean) => inStockOnly ?? true)
  .handler(async ({ data: inStockOnly }) => {
    try {
      const rawItems = await fetchInTouchAllProducts();
      if (!rawItems || !Array.isArray(rawItems)) {
        return { success: false, items: [], message: "No items returned from InTouch POS" };
      }
      const filtered = (
        inStockOnly
          ? rawItems.filter((p) => parseFloat(p.stock_qty || "0") > 0 && p.product_name)
          : rawItems.filter((p) => Boolean(p.product_name))
      ).map((p) => ({
        sku: p.sub_sku || p.sku || p.product_id,
        name: p.product_name,
        basePrice:
          parseFloat(p.purchase_price || "0") > 0
            ? parseFloat(p.purchase_price || "0")
            : parseFloat(p.selling_price || "0"),
        sellingPrice: parseFloat(p.selling_price || "0"),
        stock: Math.max(0, Math.floor(parseFloat(p.stock_qty || "0"))),
        unit: p.unit || "Pc(s)",
        variation: p.variation_name || "",
      }));

      return { success: true, items: filtered };
    } catch (err: unknown) {
      return {
        success: false,
        items: [],
        message: err instanceof Error ? err.message : "Failed to fetch live POS items",
      };
    }
  });


