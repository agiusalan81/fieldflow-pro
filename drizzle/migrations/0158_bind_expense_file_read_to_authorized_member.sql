ALTER POLICY expense_file_read ON storage.objects TO authenticated USING (
  bucket_id = 'job-receipts'
  AND public.member_is_active((SELECT auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.expense_receipts e
    WHERE e.file_path = storage.objects.name
      AND e.company_id = public.current_company_id()
      AND public.company_module_access(e.company_id, 'receipts')
      AND (
        e.uploaded_by = (SELECT auth.uid())
        OR public.my_role() IN ('admin'::public.app_role, 'superuser'::public.app_role)
      )
  )
);
COMMENT ON POLICY expense_file_read ON storage.objects IS 'Receipt-file reads explicitly mirror expense_read: active uploader or office administrator in the current company with receipts access. Related receipt-row RLS still applies.';