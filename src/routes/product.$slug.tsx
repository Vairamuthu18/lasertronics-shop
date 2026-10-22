import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Minus, Plus, ShoppingCart, Star, Truck, ShieldCheck, Undo2, Package } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { formatLKR, getCategory, getProduct, registerLiveProducts, relatedProducts } from "@/data/products";
import { fetchProductBySlugOrSkuFn } from "@/lib/server-products";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    let product = null;
    try {
      const live = await fetchProductBySlugOrSkuFn({ data: params.slug });
      if (live) {
        registerLiveProducts([live]);
        product = live;
      }
    } catch (err) {
      console.error("Failed to load product by slug/SKU from ERP:", err);
    }

    if (!product) {
      product = getProduct(params.slug);
    }

    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    const title = p ? `${p.name} | Lasertronics` : "Product | Lasertronics";
    const desc = p?.blurb ?? "Shop genuine electronics at Lasertronics Sri Lanka.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ProductPage,
});

import { Check, MapPin, Clock, Info } from "lucide-react";

function ProductPage() {
  const { product } = Route.useLoaderData();
  const category = getCategory(product.category);
  const related = relatedProducts(product);
  const { add } = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);

  const discountPercent =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;

  const handleAddToCart = () => {
    add(product.slug, qty);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2000);
  };

  return (
    <SiteLayout>
      {/* Breadcrumb Bar */}
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="container-page py-3.5">
          <nav className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="size-3 text-slate-400" aria-hidden />
            <Link to="/shop" className="hover:text-primary transition-colors">
              Catalog
            </Link>
            {category && (
              <>
                <ChevronRight className="size-3 text-slate-400" aria-hidden />
                <Link
                  to="/category/$slug"
                  params={{ slug: category.slug }}
                  className="hover:text-primary transition-colors"
                >
                  {category.name}
                </Link>
              </>
            )}
            <ChevronRight className="size-3 text-slate-400" aria-hidden />
            <span className="truncate max-w-xs sm:max-w-md font-semibold text-foreground">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      <div className="container-page py-6 sm:py-8 lg:py-12">
        {/* Desktop 2-Column Layout (7 cols left, 5 cols right on lg+) */}
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Image Showcase & Technical Specifications    */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 space-y-8">
            {/* Main Product Showcase Card */}
            <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
              <div className="relative aspect-square overflow-hidden rounded-xl sm:rounded-2xl bg-slate-50 flex items-center justify-center">
                {imgError || !product.image ? (
                  <div className="flex size-full flex-col items-center justify-center bg-slate-50 text-slate-400 p-6 select-none">
                    <Package className="size-20 sm:size-24 text-slate-300 mb-2" />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
                      Lasertronics PVT LTD
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">Genuine Hardware</span>
                  </div>
                ) : (
                  <img
                    src={product.image}
                    alt={product.name}
                    width={800}
                    height={800}
                    onError={() => setImgError(true)}
                    className="size-full object-contain p-4 transition-transform duration-500 hover:scale-105"
                  />
                )}

                {/* Badge tags overlay */}
                <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
                  {product.badge && (
                    <span className="rounded-lg bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-xs">
                      {product.badge}
                    </span>
                  )}
                  {discountPercent && (
                    <span className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-extrabold uppercase text-white shadow-xs">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Technical Specifications Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
              <div className="border-b border-slate-100 bg-slate-50/70 px-5 sm:px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm sm:text-base font-bold text-foreground">
                    Technical Specifications
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Verified hardware parameters and electrical characteristics.
                  </p>
                </div>
                <span className="text-[11px] font-bold uppercase text-primary tracking-wider bg-blue-50 px-2.5 py-1 rounded-md">
                  InTouch Verified
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <dl className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {product.specs.map((s: { label: string; value: string }, idx: number) => (
                    <div
                      key={s.label}
                      className={`grid grid-cols-1 sm:grid-cols-3 gap-2 py-3 ${
                        idx % 2 === 0 ? "bg-slate-50/40 rounded-lg px-3" : "px-3"
                      }`}
                    >
                      <dt className="font-semibold text-slate-500 sm:col-span-1">{s.label}</dt>
                      <dd className="font-bold text-foreground sm:col-span-2">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {/* Overview / Blurb Details */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
              <h3 className="font-display text-sm sm:text-base font-bold text-foreground mb-2">
                Product Description & Applications
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                {product.blurb}
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="size-4 text-primary shrink-0" />
                <span>
                  For custom engineering requirements or bulk enterprise requests, contact our technical team in Colombo.
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Sticky Buy Box & Purchasing Assurance       */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-6">
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm">
              {/* Category, SKU, and Rating */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
                  {category?.name || "Hardware"}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  SKU: {product.slug.toUpperCase().slice(0, 10)}
                </span>
              </div>

              {/* Title */}
              <h1 className="mt-2.5 font-display text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground leading-snug">
                {product.name}
              </h1>

              {/* Ratings */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-xs font-bold text-amber-900">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  <span>{product.rating.toFixed(1)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ({product.reviews} customer reviews)
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Check className="size-3 text-emerald-600" /> Verified Purchase
                </span>
              </div>

              {/* Pricing Section */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-display text-3xl sm:text-4xl font-black text-foreground">
                    {formatLKR(product.price)}
                  </span>
                  {product.oldPrice && (
                    <span className="text-base text-muted-foreground line-through">
                      {formatLKR(product.oldPrice)}
                    </span>
                  )}
                  {discountPercent && (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      Save {discountPercent}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Inclusive of all taxes • InTouch ERP live stock
                </p>
              </div>

              {/* Stock Status Indicator */}
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/60 p-2.5 text-xs font-bold text-emerald-800">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>In Stock — Available for Immediate Island-Wide Dispatch</span>
              </div>

              {/* Quantity Stepper & Subtotal */}
              <div className="mt-5 flex items-center justify-between gap-3 bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Quantity:</span>
                  <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="grid size-8 place-items-center text-slate-600 hover:bg-slate-100 active:scale-90 transition-transform cursor-pointer"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="w-8 text-center text-xs font-extrabold text-foreground">{qty}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQty((q) => q + 1)}
                      className="grid size-8 place-items-center text-slate-600 hover:bg-slate-100 active:scale-90 transition-transform cursor-pointer"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Subtotal
                  </span>
                  <strong className="text-sm font-extrabold text-primary">
                    {formatLKR(product.price * qty)}
                  </strong>
                </div>
              </div>

              {/* Primary Call-to-Actions */}
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full flex items-center justify-center gap-2 min-h-12 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-md hover:bg-primary/90 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <ShoppingCart className="size-4.5" aria-hidden />
                  <span>{addedNotice ? "Added to Cart!" : "Add to Cart"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    add(product.slug, qty);
                    navigate({ to: "/checkout" });
                  }}
                  className="w-full min-h-12 rounded-xl border border-slate-900 bg-slate-900 px-6 text-sm font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer text-center"
                >
                  Buy Now with 1-Click Checkout
                </button>
              </div>

              {/* Delivery & Trust Assurance Badges */}
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <Truck className="size-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <strong className="font-bold text-foreground">Island-Wide Courier Delivery</strong>
                    <p className="text-[11px] text-muted-foreground">
                      Dispatched within 24h via prompt courier across all Sri Lankan districts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <strong className="font-bold text-foreground">Genuine Warranty & Support</strong>
                    <p className="text-[11px] text-muted-foreground">
                      Official Lasertronics warranty backing with technical repair support in Colombo.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Undo2 className="size-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <strong className="font-bold text-foreground">7-Day Defective Replacement</strong>
                    <p className="text-[11px] text-muted-foreground">
                      Hassle-free exchange policy for any verified component manufacturing defects.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products Rail */}
      {related.length > 0 && (
        <section className="container-page pb-14 sm:pb-20">
          <div className="border-t border-slate-200 pt-10 sm:pt-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                  Frequently Paired Hardware
                </span>
                <h2 className="mt-1 font-display text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                  You May Also Like
                </h2>
              </div>
              <Link
                to="/shop"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                View Full Catalog <ChevronRight className="size-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {related.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </SiteLayout>
  );
}
