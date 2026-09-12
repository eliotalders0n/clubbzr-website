export type ProductType = "digital_release" | "bespoke_request" | "physical_original" | "gated_collection";
export type PaymentRail = "POINT" | "ZMW";
export type ListingStatus = "draft" | "pending_review" | "published" | "paused" | "sold_out" | "archived";
export type OrderStatus = "payment_pending" | "paid" | "pending_acceptance" | "accepted" | "in_progress" | "submitted" | "revision_requested" | "preparing" | "ready_for_collection" | "dispatched" | "delivered" | "completed" | "disputed" | "refund_pending" | "refunded" | "payment_failed";

export interface StoreSettings {
  storeEnabled: boolean;
  zmwCheckoutEnabled: boolean;
  sellerPayoutsEnabled: boolean;
  physicalProductsEnabled: boolean;
  gatedCollectionsEnabled: boolean;
  autoApprovalEnabled: boolean;
  autoApprovalHours: number;
  minimumPriceNgwee: number;
  minimumPricePoints: number;
  minimumPayoutNgwee: number;
  deliveryRegions: string[];
  version: number;
}
export interface StoreAsset {
  path: string;
  generation: string;
  name: string;
  contentType: string;
  size: number;
}
export interface BriefQuestion {
  id: string;
  label: string;
  type: "short_text" | "long_text" | "single_choice" | "multiple_choice" | "reference_image";
  required: boolean;
  options: string[];
}
export interface StoreListing {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerPhotoURL: string;
  sellerAvailable?: boolean;
  sellerVerified?: boolean;
  productType: ProductType;
  title: string;
  description: string;
  coverImage: string;
  images: string[];
  tags: string[];
  status: ListingStatus;
  featured: boolean;
  acceptedPaymentMethods: PaymentRail[];
  priceNgwee: number;
  pricePoints: number | null;
  inventory: number | null;
  reserved: number;
  sold: number;
  version: number;
  licence: {kind: "personal" | "commercial"; version: number; text: string};
  files: Array<Pick<StoreAsset, "name" | "size" | "contentType">>;
  downloadLimit: number | null;
  fulfilment: {
    estimatedDays: number;
    revisionRounds: number;
    questions: BriefQuestion[];
    addOns: Array<{id: string; title: string; priceNgwee: number; pricePoints: number}>;
    dimensions: string;
    weightGrams: number | null;
    materials: string;
    framed: boolean;
    condition: string;
    oneOfOne: boolean;
    deliveryOptions: Array<{region: string; priceNgwee: number; pricePoints: number}>;
    pickup: boolean;
  };
  promoteOnPublish: boolean;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}
export interface PriceSnapshot {
  currency: PaymentRail;
  productSubtotal: number;
  discount: number;
  discountedSubtotal: number;
  deliveryCharge: number;
  feeBasisPoints: number;
  platformFee: number;
  buyerTotal: number;
  sellerPayable: number;
  collectionFee: number | null;
  payoutFee: number | null;
}
export interface CheckoutInput {
  listingId: string;
  listingVersion: number;
  paymentRail: PaymentRail;
  addOnIds: string[];
  brief: Record<string, string | string[] | StoreAsset>;
  delivery: null | {recipient: string; phone: string; region: string; address: string; instructions: string};
  termsAccepted: boolean;
  phone?: string;
  operator?: string;
  idempotencyKey: string;
}
export interface StoreOrder {
  id: string;
  storeOrder: true;
  buyerId: string;
  sellerId: string;
  participants: string[];
  listingId: string;
  listingVersion: number;
  kind: ProductType;
  paymentRail: PaymentRail;
  status: OrderStatus;
  price: PriceSnapshot;
  listing: StoreListing;
  brief: CheckoutInput["brief"];
  addOnIds: string[];
  delivery: CheckoutInput["delivery"];
  revisionCount: number;
  providerRefundFeeNgwee?: number | null;
  submission?: {message: string; files: StoreAsset[]; preview: StoreAsset | null; submittedAt: number};
  dispatch?: {method: string; reference: string; proof: StoreAsset | null};
  dispute?: {openedBy: string; category: string; explanation: string; evidence: StoreAsset[]; from: OrderStatus; decision?: string; reason?: string};
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}
