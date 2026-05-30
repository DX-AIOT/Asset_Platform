export interface InitiateEscrowHoldParams {
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  extraData?: string;
}

export interface InitiateEscrowHoldResult {
  paymentUrl: string;
  orderId: string;
  requestId: string;
}

export interface ReleaseEscrowParams {
  orderId: string;
  requestId: string;
  amount: number;
  description?: string;
}

export interface ReleaseEscrowResult {
  orderId: string;
  requestId: string;
  transId: string;
  resultCode: number;
  message: string;
}

export interface RefundBuyerParams {
  orderId: string;
  requestId: string;
  amount: number;
  transId: string;
  description?: string;
}

export interface RefundBuyerResult {
  orderId: string;
  requestId: string;
  resultCode: number;
  message: string;
}

export interface IpnPayload {
  orderId: string;
  requestId: string;
  amount: number;
  transId: number;
  resultCode: number;
  message: string;
  orderInfo: string;
  orderType: string;
  payType: string;
  responseTime: number;
  extraData: string;
  partnerCode: string;
  signature: string;
}

export interface IPaymentGateway {
  initiateEscrowHold(params: InitiateEscrowHoldParams): Promise<InitiateEscrowHoldResult>;
  releaseEscrow(params: ReleaseEscrowParams): Promise<ReleaseEscrowResult>;
  refundBuyer(params: RefundBuyerParams): Promise<RefundBuyerResult>;
  verifyIpnSignature(payload: IpnPayload): boolean;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
