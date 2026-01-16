
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Key not found in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Gera ou recupera um ID de dispositivo persistente
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('chordRush_deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('chordRush_deviceId', deviceId);
  }
  return deviceId;
};
