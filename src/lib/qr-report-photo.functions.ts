import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { validateQrPhoto } from './qr-report-photo';

export const submitPhotoReport = createServerFn({method:'POST'})
  .inputValidator((d: unknown) => z.object({ token:z.string().regex(/^[a-f0-9]{64}$/),kind:z.enum(['equipment','store']),photo:z.string().max(2800000),fields:z.record(z.string().max(2000)).refine(f => Object.keys(f).length <= 7) }).parse(d))
  .handler(async ({data}) => {
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    let path: string | undefined;
    let grantId: string | undefined;
    try {
      if (!data.photo.startsWith('data:image/jpeg;base64,')) throw new Error('Choose a JPEG photo.');
      const bytes = Uint8Array.from(atob(data.photo.slice(23)),c => c.charCodeAt(0)); validateQrPhoto(bytes);
      const jpeg = await import('jpeg-js');
      const decoded = jpeg.decode(bytes,{ maxResolutionInMP:3,maxMemoryUsageInMB:32 });
      if (decoded.width>1600 || decoded.height>1600) throw new Error('Choose a smaller photo.');
      // Re-encode pixel data only: discard EXIF/GPS metadata from public uploads.
      const clean = jpeg.encode({data:decoded.data,width:decoded.width,height:decoded.height},80).data;
      validateQrPhoto(clean);
      const reserved = await db.rpc('reserve_qr_photo',{_token:data.token,_kind:data.kind});
      if (reserved.error) throw new Error(reserved.error.message);
      const g = reserved.data as {id?:string;path?:string}; if (!g?.id || !g.path) throw new Error('Photo could not be reserved.');
      path=g.path; grantId=g.id;
      const upload = await db.storage.from('qr-report-photos').upload(path,clean,{contentType:'image/jpeg',upsert:false});
      if (upload.error) throw new Error(upload.error.message);
      const result = await db.rpc('submit_qr_photo_report',{_token:data.token,_kind:data.kind,_grant:g.id,_fields:data.fields});
      if (result.error) throw new Error(result.error.message);
      // Opportunistic bounded cleanup of abandoned uploads; never remove bound evidence.
      const expired = await db.from('qr_report_photos').select('id,object_path').is('report_id',null).lt('expires_at',new Date().toISOString()).limit(50);
      if (expired.data?.length) { const removed = await db.storage.from('qr-report-photos').remove(expired.data.map(p=>p.object_path)); if (!removed.error) await db.from('qr_report_photos').delete().in('id',expired.data.map(p=>p.id)).is('report_id',null); }
      return {ok:true};
    } catch (e) {
      if (path && grantId) { const pending = await db.from('qr_report_photos').select('report_id').eq('id',grantId).maybeSingle(); if (pending.data && !pending.data.report_id) { await db.storage.from('qr-report-photos').remove([path]); await db.from('qr_report_photos').delete().eq('id',grantId).is('report_id',null); } }
      return {error:e instanceof Error ? e.message : 'Report could not be sent. Please try again.'};
    }
  });

export const getReportPhoto = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({reportId:z.string().uuid(),kind:z.enum(['equipment','store'])}).parse(d))
  .handler(async ({data,context}) => {
    const db=context.supabase;
    const active=await db.rpc('member_is_active',{_user:context.userId});
    const manager=await db.rpc('is_company_manager');
    if (!active.data || !manager.data || active.error || manager.error) throw new Error('Manager access required');
    const report = data.kind==='equipment' ? await db.from('equipment_problem_reports').select('id,company_id').eq('id',data.reportId).maybeSingle() : await db.from('store_problem_reports').select('id,company_id').eq('id',data.reportId).maybeSingle();
    if (report.error || !report.data) throw new Error('Report unavailable');
    const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
    const photo=await supabaseAdmin.from('qr_report_photos').select('object_path').eq('company_id',report.data.company_id).eq('report_id',report.data.id).eq('kind',data.kind).maybeSingle();
    if(photo.error)throw new Error(photo.error.message); if(!photo.data)return {url:null};
    const signed=await supabaseAdmin.storage.from('qr-report-photos').createSignedUrl(photo.data.object_path,300);
    if(signed.error)throw new Error(signed.error.message); return {url:signed.data.signedUrl};
  });