import {
  AdminData,
  Order,
  Product,
  Category,
  BannerSlide,
  OfferCategory,
  PromoCode,
  FooterConfig,
  SplashScreenConfig,
  PaymentConfig,
  Governorate,
  ColorVariant,
} from "../types";
import {
  DEFAULT_PAYMENT_CONFIG,
  DEFAULT_FOOTER_CONFIG,
  DEFAULT_SPLASH_CONFIG,
  EGYPTIAN_GOVERNORATES,
  SOTRA_PRODUCT_PLACEHOLDER,
  SOTRA_CATEGORY_PLACEHOLDER,
  SOTRA_OFFER_PLACEHOLDER,
  SOTRA_BANNER_PLACEHOLDER,
  sanitizeImageUrl,
  normalizeProduct,
} from "./storage";

export interface BackupPayload {
  version: string;
  appName: string;
  exportedAt: string;
  timestamp: number;
  data: {
    products?: Product[];
    categories?: Category[];
    offerCategories?: OfferCategory[];
    banners?: BannerSlide[];
    coupons?: PromoCode[];
    governorates?: Governorate[];
    paymentConfig?: PaymentConfig;
    footerConfig?: FooterConfig;
    splashScreenConfig?: SplashScreenConfig;
    orders?: Order[];
  };
  stats: {
    productsCount: number;
    categoriesCount: number;
    offerCategoriesCount: number;
    bannersCount: number;
    couponsCount: number;
    hasGovernorates: boolean;
    hasPaymentConfig: boolean;
    hasFooterConfig: boolean;
    hasSplashScreenConfig: boolean;
    ordersCount: number;
  };
}

export interface LocalSnapshot {
  id: string;
  name: string;
  createdAt: string;
  timestamp: number;
  stats: {
    productsCount: number;
    categoriesCount: number;
    bannersCount: number;
    ordersCount: number;
  };
  payload: BackupPayload;
}

const SNAPSHOTS_STORAGE_KEY = "sotra_snapshots_v1";

/**
 * Trigger download of any text / JSON / CSV content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string = "application/json") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate full backup JSON object
 */
export function generateFullBackupPayload(adminData: AdminData, orders: Order[] = []): BackupPayload {
  const now = new Date();
  return {
    version: "2.0.0",
    appName: "SOTRA FASHION",
    exportedAt: now.toISOString(),
    timestamp: now.getTime(),
    data: {
      products: adminData.products || [],
      categories: adminData.categories || [],
      offerCategories: adminData.offerCategories || [],
      banners: adminData.banners || [],
      coupons: adminData.coupons || [],
      governorates: adminData.governorates || EGYPTIAN_GOVERNORATES,
      paymentConfig: adminData.paymentConfig || DEFAULT_PAYMENT_CONFIG,
      footerConfig: adminData.footerConfig || DEFAULT_FOOTER_CONFIG,
      splashScreenConfig: adminData.splashScreenConfig || DEFAULT_SPLASH_CONFIG,
      orders: orders || [],
    },
    stats: {
      productsCount: adminData.products?.length || 0,
      categoriesCount: adminData.categories?.length || 0,
      offerCategoriesCount: adminData.offerCategories?.length || 0,
      bannersCount: adminData.banners?.length || 0,
      couponsCount: adminData.coupons?.length || 0,
      hasGovernorates: Boolean(adminData.governorates && adminData.governorates.length > 0),
      hasPaymentConfig: Boolean(adminData.paymentConfig),
      hasFooterConfig: Boolean(adminData.footerConfig),
      hasSplashScreenConfig: Boolean(adminData.splashScreenConfig),
      ordersCount: orders?.length || 0,
    },
  };
}

/**
 * Download Full Store Backup JSON
 */
export function exportFullBackupJSON(adminData: AdminData, orders: Order[] = []) {
  const payload = generateFullBackupPayload(adminData, orders);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `sotra_fashion_full_backup_${dateStr}_${Date.now().toString().slice(-4)}.json`;
  downloadFile(JSON.stringify(payload, null, 2), filename, "application/json");
}

/**
 * Export Products to CSV (Compatible with Microsoft Excel / Google Sheets)
 */
export function exportProductsToCSV(products: Product[], categories: Category[] = []) {
  const catMap = new Map<string, string>();
  categories.forEach((c) => catMap.set(c.id, c.nameAr || c.name));

  const headers = [
    "ID (المعرف)",
    "Title_AR (اسم المنتج بالعربية)",
    "Title_EN (اسم المنتج بالإنجليزية)",
    "Category (القسم)",
    "OfferCategory (قسم العرض)",
    "Price (السعر الحالي)",
    "WholesalePrice (سعر الجملة)",
    "OriginalPrice (السعر الأصلي قبل الخصم)",
    "DiscountPercent (نسبة الخصم %)",
    "Fabric_AR (الخامة)",
    "InStock (متوفر بالمخزون)",
    "Colors (الألوان المتاحة)",
    "Sizes (المقاسات)",
    "Description_AR (الوصف)",
  ];

  const escapeCSV = (str: any): string => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = products.map((p) => {
    const catName = catMap.get(p.category) || p.category || "";
    const colorNames = (p.colors || []).map((c) => c.nameAr || c.name).join(" | ");
    const sizes = (p.sizes || []).join(" | ");
    return [
      escapeCSV(p.id),
      escapeCSV(p.titleAr || p.title),
      escapeCSV(p.title || p.titleAr),
      escapeCSV(catName),
      escapeCSV(p.offerCategory || ""),
      escapeCSV(p.price),
      escapeCSV(p.wholesalePrice || ""),
      escapeCSV(p.originalPrice || ""),
      escapeCSV(p.discountPercent || ""),
      escapeCSV(p.fabricAr || p.fabric || ""),
      escapeCSV(p.inStock ? "نعم" : "لا"),
      escapeCSV(colorNames),
      escapeCSV(sizes),
      escapeCSV(p.descriptionAr || p.description || ""),
    ].join(",");
  });

  // Prepend UTF-8 BOM so Excel opens Arabic text correctly
  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const dateStr = new Date().toISOString().split("T")[0];
  downloadFile(csvContent, `sotra_products_${dateStr}.csv`, "text/csv");
}

/**
 * Export Orders to CSV
 */
export function exportOrdersToCSV(orders: Order[]) {
  const headers = [
    "رقم الطلب (Order ID)",
    "تاريخ الإنشاء (Created At)",
    "اسم العميل (Customer Name)",
    "رقم الهاتف (Phone)",
    "المحافظة (Governorate)",
    "العنوان بالتفصيل (Address)",
    "طريقة الدفع (Payment Method)",
    "حالة الطلب (Status)",
    "عدد المنتجات (Items Count)",
    "تفاصيل المنتجات (Products Summary)",
    "إجمالي الطلب (Total EGP)",
    "تكلفة الشحن (Shipping EGP)",
    "كود الخصم (Coupon)",
  ];

  const escapeCSV = (str: any): string => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = orders.map((o) => {
    const itemsSummary = (o.items || [])
      .map((it) => `${it.titleAr || it.title} (${it.selectedColor?.nameAr || ""}-${it.selectedSize}) x${it.quantity}`)
      .join(" | ");

    return [
      escapeCSV(o.orderId),
      escapeCSV(o.createdAt),
      escapeCSV(o.customer?.fullName || ""),
      escapeCSV(o.customer?.phoneNumber || ""),
      escapeCSV(o.governorateNameAr || o.customer?.governorateId || ""),
      escapeCSV(o.customer?.detailedAddress || ""),
      escapeCSV(o.customer?.paymentMethod === "vodafone_cash" ? "فودافون كاش" : "الدفع عند الاستلام"),
      escapeCSV(o.trackingStatus),
      escapeCSV(o.items?.length || 0),
      escapeCSV(itemsSummary),
      escapeCSV(o.total),
      escapeCSV(o.shippingCost),
      escapeCSV(o.appliedCouponCode || ""),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const dateStr = new Date().toISOString().split("T")[0];
  downloadFile(csvContent, `sotra_orders_${dateStr}.csv`, "text/csv");
}

/**
 * Export Selective Entities
 */
export function exportSelectiveEntities(type: string, data: any) {
  const dateStr = new Date().toISOString().split("T")[0];
  const payload = {
    type,
    appName: "SOTRA FASHION",
    exportedAt: new Date().toISOString(),
    data,
  };
  downloadFile(JSON.stringify(payload, null, 2), `sotra_${type}_${dateStr}.json`, "application/json");
}

/**
 * Robust Product Normalizer for JSON Import
 */
export function normalizeImportedProduct(raw: any, index: number = 0): Product {
  if (!raw || typeof raw !== "object") {
    return normalizeProduct({ id: `prod-${Date.now()}-${index}`, title: "منتج جديد", price: 0 });
  }

  const id = String(raw.id || raw.productId || raw._id || `sotra-prod-${Date.now()}-${index}`);
  const title = String(raw.title || raw.name || raw.titleAr || "منتج سترة");
  const titleAr = String(raw.titleAr || raw.arabicTitle || raw.nameAr || raw.name || title);
  const price = Number(raw.price || raw.unitPrice || raw.cost || 0);
  const wholesalePrice = raw.wholesalePrice !== undefined && raw.wholesalePrice !== null ? Number(raw.wholesalePrice) : undefined;
  const originalPrice = raw.originalPrice ? Number(raw.originalPrice) : undefined;

  let colors: ColorVariant[] = [];
  if (Array.isArray(raw.colors) && raw.colors.length > 0) {
    colors = raw.colors.map((c: any, cIdx: number) => ({
      name: String(c.name || c.colorName || `Color ${cIdx + 1}`),
      nameAr: String(c.nameAr || c.colorNameAr || c.name || `لون ${cIdx + 1}`),
      hex: String(c.hex || c.colorCode || "#111111"),
      image: sanitizeImageUrl(c.image || raw.image || raw.imageUrl || raw.thumbnail, SOTRA_PRODUCT_PLACEHOLDER),
      backImage: c.backImage ? sanitizeImageUrl(c.backImage, SOTRA_PRODUCT_PLACEHOLDER) : undefined,
    }));
  } else if (raw.image || raw.imageUrl || raw.thumbnail) {
    colors = [
      {
        name: "Default",
        nameAr: "اللون الأساسي",
        hex: "#111111",
        image: sanitizeImageUrl(raw.image || raw.imageUrl || raw.thumbnail, SOTRA_PRODUCT_PLACEHOLDER),
      },
    ];
  } else {
    colors = [
      {
        name: "Black",
        nameAr: "أسود",
        hex: "#111111",
        image: SOTRA_PRODUCT_PLACEHOLDER,
      },
    ];
  }

  const sizes = Array.isArray(raw.sizes) && raw.sizes.length > 0 ? raw.sizes.map(String) : ["S", "M", "L", "XL", "2XL"];

  return normalizeProduct({
    ...raw,
    id,
    title,
    titleAr,
    price,
    wholesalePrice,
    originalPrice,
    colors,
    sizes,
    category: String(raw.category || raw.categoryId || "all"),
    offerCategory: raw.offerCategory ? String(raw.offerCategory) : undefined,
    fabric: raw.fabric || "Premium Cotton",
    fabricAr: raw.fabricAr || "قطن مصري 100%",
    fit: raw.fit || "oversized",
    description: raw.description || "",
    descriptionAr: raw.descriptionAr || raw.description || "",
    inStock: raw.inStock !== false,
    isNew: Boolean(raw.isNew),
    isBestseller: Boolean(raw.isBestseller),
    inventory: raw.inventory && typeof raw.inventory === "object" ? raw.inventory : {},
  });
}

/**
 * Parse and Validate Uploaded Backup JSON File
 */
export async function parseBackupFile(file: File): Promise<{
  success: boolean;
  error?: string;
  payload?: BackupPayload;
  rawJson?: any;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let text = (e.target?.result as string || "").trim();
        // Remove UTF-8 BOM if present
        text = text.replace(/^\uFEFF/, "");

        if (!text) {
          return resolve({ success: false, error: "الملف فارغ لا يحتوي على أي بيانات." });
        }

        const parsed = JSON.parse(text);

        let rawProductsList: any[] | undefined;
        let rawCategoriesList: any[] | undefined;
        let rawOfferCategoriesList: any[] | undefined;
        let rawBannersList: any[] | undefined;
        let rawCouponsList: any[] | undefined;
        let rawGovernoratesList: any[] | undefined;
        let paymentConfigObj: PaymentConfig | undefined;
        let footerConfigObj: FooterConfig | undefined;
        let splashScreenConfigObj: SplashScreenConfig | undefined;
        let rawOrdersList: any[] | undefined;

        if (Array.isArray(parsed)) {
          // It's a direct array of items
          if (parsed.length > 0) {
            const first = parsed[0];
            if (first && typeof first === "object") {
              if (first.price !== undefined || first.colors !== undefined || first.sizes !== undefined || first.fabricAr !== undefined || first.wholesalePrice !== undefined) {
                rawProductsList = parsed;
              } else if (first.icon !== undefined || (first.nameAr && !first.price)) {
                rawCategoriesList = parsed;
              } else if (first.customer !== undefined || first.orderId !== undefined) {
                rawOrdersList = parsed;
              } else if (first.code !== undefined && (first.discount !== undefined || first.percent !== undefined)) {
                rawCouponsList = parsed;
              } else if (first.image && (first.subtitle || first.cta)) {
                rawBannersList = parsed;
              } else {
                // Default fallback: treat as products
                rawProductsList = parsed;
              }
            }
          } else {
            rawProductsList = [];
          }
        } else if (parsed && typeof parsed === "object") {
          // Check if single product
          if (parsed.title || parsed.titleAr || parsed.price !== undefined) {
            if (!parsed.products && !parsed.categories && !parsed.data) {
              rawProductsList = [parsed];
            }
          }

          // Check wrapped .data or root
          const source = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) ? parsed.data : parsed;

          if (Array.isArray(source.products)) rawProductsList = source.products;
          else if (Array.isArray(source.items)) rawProductsList = source.items;
          else if (Array.isArray(source.catalog)) rawProductsList = source.catalog;
          else if (Array.isArray(source.productList)) rawProductsList = source.productList;

          if (Array.isArray(source.categories)) rawCategoriesList = source.categories;
          if (Array.isArray(source.offerCategories)) rawOfferCategoriesList = source.offerCategories;
          if (Array.isArray(source.banners) || Array.isArray(source.slides)) rawBannersList = source.banners || source.slides;
          if (Array.isArray(source.coupons) || Array.isArray(source.promoCodes)) rawCouponsList = source.coupons || source.promoCodes;
          if (Array.isArray(source.governorates) || Array.isArray(source.shippingRates)) rawGovernoratesList = source.governorates || source.shippingRates;
          if (Array.isArray(source.orders)) rawOrdersList = source.orders;

          if (source.paymentConfig && typeof source.paymentConfig === "object") {
            paymentConfigObj = { ...DEFAULT_PAYMENT_CONFIG, ...source.paymentConfig };
          } else if (source.payment && typeof source.payment === "object") {
            paymentConfigObj = { ...DEFAULT_PAYMENT_CONFIG, ...source.payment };
          }

          if (source.footerConfig && typeof source.footerConfig === "object") {
            footerConfigObj = { ...DEFAULT_FOOTER_CONFIG, ...source.footerConfig };
          }
          if (source.splashScreenConfig && typeof source.splashScreenConfig === "object") {
            splashScreenConfigObj = { ...DEFAULT_SPLASH_CONFIG, ...source.splashScreenConfig };
          }
        }

        // Normalize products
        const products: Product[] | undefined = rawProductsList
          ? rawProductsList.map((p, idx) => normalizeImportedProduct(p, idx))
          : undefined;

        const categories: Category[] | undefined = rawCategoriesList
          ? rawCategoriesList.map((c, idx) => ({
              id: String(c.id || `cat-${idx + 1}`),
              name: String(c.name || c.nameAr || `Category ${idx + 1}`),
              nameAr: String(c.nameAr || c.name || `قسم ${idx + 1}`),
              icon: String(c.icon || "Shirt"),
              image: sanitizeImageUrl(c.image, SOTRA_CATEGORY_PLACEHOLDER),
            }))
          : undefined;

        const offerCategories: OfferCategory[] | undefined = rawOfferCategoriesList
          ? rawOfferCategoriesList.map((oc, idx) => ({
              id: String(oc.id || `offer-${idx + 1}`),
              name: String(oc.name || oc.nameAr || `Offer ${idx + 1}`),
              nameAr: String(oc.nameAr || oc.name || `عرض ${idx + 1}`),
              image: sanitizeImageUrl(oc.image, SOTRA_OFFER_PLACEHOLDER),
              badge: oc.badge || "SALE",
              badgeAr: oc.badgeAr || "خصم",
            }))
          : undefined;

        const banners: BannerSlide[] | undefined = rawBannersList
          ? rawBannersList.map((b, idx) => ({
              id: b.id || idx + 1,
              tag: b.tag || "SOTRA",
              tagAr: b.tagAr || "سترة",
              title: b.title || "تشكيلة جديدة",
              titleAr: b.titleAr || b.title || "تشكيلة جديدة",
              subtitle: b.subtitle || "",
              subtitleAr: b.subtitleAr || b.subtitle || "",
              cta: b.cta || "تسوق الآن",
              ctaAr: b.ctaAr || b.cta || "تسوق الآن",
              image: sanitizeImageUrl(b.image, SOTRA_BANNER_PLACEHOLDER),
              theme: b.theme || "dark",
              linkType: b.linkType || "category",
              linkTarget: b.linkTarget || "all",
            }))
          : undefined;

        const coupons: PromoCode[] | undefined = rawCouponsList;
        const governorates: Governorate[] | undefined = rawGovernoratesList;
        const orders: Order[] | undefined = rawOrdersList;

        const hasRecognizableData =
          (products && products.length > 0) ||
          (categories && categories.length > 0) ||
          (offerCategories && offerCategories.length > 0) ||
          (banners && banners.length > 0) ||
          (coupons && coupons.length > 0) ||
          (governorates && governorates.length > 0) ||
          paymentConfigObj !== undefined ||
          footerConfigObj !== undefined ||
          splashScreenConfigObj !== undefined ||
          (orders && orders.length > 0);

        if (!hasRecognizableData) {
          return resolve({
            success: false,
            error: "الملف المرفوع لا يحتوي على بنية بيانات معروفة لمتجر سترة (منتجات، أقسام، إعدادات، أو طلبات).",
          });
        }

        const normalizedPayload: BackupPayload = {
          version: parsed.version || "2.0.0",
          appName: parsed.appName || "SOTRA FASHION",
          exportedAt: parsed.exportedAt || new Date().toISOString(),
          timestamp: parsed.timestamp || Date.now(),
          data: {
            products: products || [],
            categories: categories || [],
            offerCategories: offerCategories || [],
            banners: banners || [],
            coupons: coupons || [],
            governorates: governorates,
            paymentConfig: paymentConfigObj,
            footerConfig: footerConfigObj,
            splashScreenConfig: splashScreenConfigObj,
            orders: orders || [],
          },
          stats: {
            productsCount: products?.length || 0,
            categoriesCount: categories?.length || 0,
            offerCategoriesCount: offerCategories?.length || 0,
            bannersCount: banners?.length || 0,
            couponsCount: coupons?.length || 0,
            hasGovernorates: Boolean(governorates && governorates.length > 0),
            hasPaymentConfig: Boolean(paymentConfigObj),
            hasFooterConfig: Boolean(footerConfigObj),
            hasSplashScreenConfig: Boolean(splashScreenConfigObj),
            ordersCount: orders?.length || 0,
          },
        };

        return resolve({
          success: true,
          payload: normalizedPayload,
          rawJson: parsed,
        });
      } catch (err: any) {
        return resolve({
          success: false,
          error: `خطأ في قراءة ملف JSON: ${err?.message || "صيغة غير صالحة"}`,
        });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, error: "تعذر قراءة الملف من الجهاز." });
    };
    reader.readAsText(file);
  });
}

/**
 * Local Snapshots Management (Stored in Browser LocalStorage)
 */
export function getLocalSnapshots(): LocalSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Could not read local snapshots", e);
  }
  return [];
}

export function saveLocalSnapshot(name: string, adminData: AdminData, orders: Order[] = []): LocalSnapshot {
  const snapshots = getLocalSnapshots();
  const payload = generateFullBackupPayload(adminData, orders);
  const newSnapshot: LocalSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name || `نسخة احتياطية ${new Date().toLocaleDateString("ar-EG")}`,
    createdAt: new Date().toISOString(),
    timestamp: Date.now(),
    stats: {
      productsCount: payload.stats.productsCount,
      categoriesCount: payload.stats.categoriesCount,
      bannersCount: payload.stats.bannersCount,
      ordersCount: payload.stats.ordersCount,
    },
    payload,
  };

  const updated = [newSnapshot, ...snapshots].slice(0, 10);
  localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(updated));
  return newSnapshot;
}

export function deleteLocalSnapshot(snapshotId: string): LocalSnapshot[] {
  const snapshots = getLocalSnapshots().filter((s) => s.id !== snapshotId);
  localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
  return snapshots;
}

export function clearAllLocalSnapshots(): void {
  localStorage.removeItem(SNAPSHOTS_STORAGE_KEY);
}

