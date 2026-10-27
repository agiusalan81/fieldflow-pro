ALTER TABLE public.jobs ALTER COLUMN scheduled_date DROP NOT NULL;
COMMENT ON COLUMN public.jobs.scheduled_date IS 'Scheduled visit date; NULL means Unscheduled / TBD awaiting office scheduling.';