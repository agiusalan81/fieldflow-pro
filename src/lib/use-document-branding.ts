import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveDocumentAssets } from './branding-assets';
import { parseTemplate, type PdfTemplate } from './documents';
/** Resolve only frozen branding; never replace issued documents with current settings. */
export function useDocumentBranding(key: string | undefined, template: PdfTemplate | undefined) {
  return useQuery({ queryKey: ['frozen-document-branding', key, template], enabled: !!key && !!template, queryFn: () => resolveDocumentAssets(supabase, parseTemplate(template)) });
}