
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
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      // Fallback simples para ambientes não seguros (HTTP IP local)
      deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    localStorage.setItem('chordRush_deviceId', deviceId);
  }
  return deviceId;
};
