/**
 * M-Pesa Service — Safaricom Daraja API integration
 *
 * Handles STK Push (Lipa Na M-Pesa Online) for payments.
 */

import axios from 'axios';
import { config } from '../config';

const BASE_URL =
  config.mpesaEnvironment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// Token cache
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Get OAuth access token from Safaricom. Cached for 59 minutes.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const auth = Buffer.from(
    `${config.mpesaConsumerKey}:${config.mpesaConsumerSecret}`
  ).toString('base64');

  const response = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  cachedToken = response.data.access_token;
  // Cache for 59 minutes (tokens last 60 min)
  tokenExpiresAt = Date.now() + 59 * 60 * 1000;

  return cachedToken!;
}

/**
 * Generate the timestamp in the format YYYYMMDDHHmmss
 */
function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

/**
 * Generate the password for STK push: base64(shortcode + passkey + timestamp)
 */
function generatePassword(timestamp: string): string {
  return Buffer.from(
    `${config.mpesaShortcode}${config.mpesaPasskey}${timestamp}`
  ).toString('base64');
}

export interface STKPushParams {
  phone: string;
  amount: number;
  accountRef: string;
  description: string;
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

/**
 * Initiate an STK Push (Lipa Na M-Pesa Online)
 */
export async function initiateSTKPush(
  params: STKPushParams
): Promise<STKPushResponse> {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = generatePassword(timestamp);

  // Normalize phone: ensure 254XXXXXXXXX format
  let phone = params.phone.replace(/\s+/g, '');
  if (phone.startsWith('0')) {
    phone = '254' + phone.slice(1);
  } else if (phone.startsWith('+')) {
    phone = phone.slice(1);
  }

  const response = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: config.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(params.amount),
      PartyA: phone,
      PartyB: config.mpesaShortcode,
      PhoneNumber: phone,
      CallBackURL: config.mpesaCallbackUrl,
      AccountReference: params.accountRef,
      TransactionDesc: params.description,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Query the status of an STK Push transaction
 */
export async function querySTKStatus(checkoutRequestId: string): Promise<any> {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = generatePassword(timestamp);

  const response = await axios.post(
    `${BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: config.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}
