// src/lib/supabase/invoke.ts
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './client';

export async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null) as { error?: unknown } | null;
      throw new Error(typeof detail?.error === 'string' ? detail.error : error.message);
    }
    throw error;
  }
  return data as T;
}