import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set for file storage');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export async function uploadFile(
  bucket: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const supabase = getClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
  return urlData.publicUrl;
}

export async function deleteFile(bucket: string, fileUrl: string): Promise<void> {
  const supabase = getClient();

  // Extract the path from the full URL
  const urlObj = new URL(fileUrl);
  const pathPrefix = `/storage/v1/object/public/${bucket}/`;
  const filePath = urlObj.pathname.startsWith(pathPrefix)
    ? urlObj.pathname.slice(pathPrefix.length)
    : urlObj.pathname.split('/').pop() || '';

  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}
