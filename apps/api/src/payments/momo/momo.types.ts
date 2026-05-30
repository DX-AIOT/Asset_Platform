export interface MoMoCreatePaymentRequest {
  partnerCode: string;
  requestId: string;
  amount: number;
  orderId: string;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  requestType: 'captureWallet';
  extraData: string;
  lang: 'vi' | 'en';
  signature: string;
}

export interface MoMoCreatePaymentResponse {
  partnerCode: string;
  requestId: string;
  orderId: string;
  resultCode: number;
  message: string;
  responseTime: number;
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

export interface MoMoQueryStatusRequest {
  partnerCode: string;
  requestId: string;
  orderId: string;
  lang: 'vi' | 'en';
  signature: string;
}

export interface MoMoQueryStatusResponse {
  partnerCode: string;
  requestId: string;
  orderId: string;
  transId: number;
  resultCode: number;
  message: string;
  amount: number;
  responseTime: number;
}

export interface MoMoRefundRequest {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  transId: number;
  lang: 'vi' | 'en';
  description: string;
  signature: string;
}

export interface MoMoRefundResponse {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  transId: number;
  resultCode: number;
  message: string;
  responseTime: number;
}

export interface MoMoIpnPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
}
