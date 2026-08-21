// Single catch-all API entry — all endpoints live in lib/api/handlers.ts so
// the entire app runs inside ONE serverless function (one shared /tmp DB).
import { handleApi } from '@/lib/api/handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = handleApi;
export const POST = handleApi;
export const PUT = handleApi;
export const PATCH = handleApi;
export const DELETE = handleApi;
export const HEAD = handleApi;
export const OPTIONS = handleApi;
