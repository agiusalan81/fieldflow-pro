import { FieldsEditor } from "@/components/fields-editor";
import { ContactRolesAdmin } from "@/components/contact-roles-admin";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { lookupCategory, type FieldDef } from "@/components/custom-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/fields")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Fields & lookups — FieldBridge" },
      { name: "description", content: "Build custom fields and curate dropdown options for your company." },
      { property: "og:title", content: "Fields & lookups — FieldBridge" },
      { property: "og:description", content: "Custom field and lookup builder." },
    ],
  }),
  component: FieldsPage,
});

function FieldsPage() {
  return <AppShell title="Fields & lookups"><FieldsEditor /></AppShell>;
}
