import { SkillsWorkspace } from "@/components/skills-workspace";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { MemberSkills } from "@/components/member-skills";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isManager, useProfile, ROLE_LABEL, type Role } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { activeSkillMember, assignedSkills, FIELD_TRADES, groupSkills, matchesTrade } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/skills")({ staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Skills & specialties — FieldBridge" },
    { name: "description", content: "Manage categorized company skills and individual field staff qualifications for dispatch." },
    { property: "og:title", content: "Skills & specialties — FieldBridge" },
    { property: "og:description", content: "Company skill categories and individual team assignments." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: SkillsPage,
});

function SkillsPage() { return <SkillsWorkspace />; }
