import { useRouterState } from '@tanstack/react-router';
import { usePlanFeatures } from '@/lib/plan-features';
import { useProfile } from '@/lib/profile';
import { AppShell } from '@/components/app-shell';
import { ModulePreview, MODULE_ROUTE } from '@/components/module-preview';
import type { ReactNode } from 'react';
export function ModuleAccessBoundary({children}:{children:ReactNode}) {
  const path=useRouterState({select:s=>s.location.pathname});
  const feature=MODULE_ROUTE[path]; const {data:p}=useProfile(); const on=usePlanFeatures(!!p&&!!feature);
  if(p&&feature&&!on(feature))return <AppShell title="Module access"><ModulePreview feature={feature}/></AppShell>;
  return children;
}