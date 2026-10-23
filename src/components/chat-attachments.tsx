import { useQuery } from "@tanstack/react-query";
import { Download, FileText, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CHAT_BUCKET, contactVcard, parseChatFiles, parseContactCard, type ChatFile } from "@/lib/chat-attachments";
import { useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";

function FileAttachment({ file }: { file: ChatFile }) {
  const { data: profile } = useProfile();
  const q = useQuery({ queryKey: ["chat-file", profile?.id, file.path], staleTime: 240000, queryFn: async () => { const r = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(file.path, 300); if (r.error) throw r.error; return r.data.signedUrl; } });
  const photo = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const download = async () => {
    try { const r = await supabase.storage.from(CHAT_BUCKET).download(file.path); if (r.error) throw r.error; const url = URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch { toast.error("File unavailable. Try again."); }
  };
  return <div className="min-w-0 space-y-1 border-t border-current/20 py-2">
    {photo && q.data && <a href={q.data} target="_blank" rel="noreferrer"><img src={q.data} alt={file.name} className="max-h-64 w-full rounded object-contain" /></a>}
    <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-all text-xs">{file.name}<span className="block opacity-70">{Math.ceil(file.size / 1024)} KB</span></span><Button size="icon" variant="ghost" className="shrink-0 text-current" title="Download file" aria-label={`Download ${file.name}`} onClick={() => void download()}><Download className="h-4 w-4" /></Button></div>
    {q.isError && <Button variant="link" className="h-auto p-0 text-current" onClick={() => q.refetch()}>Retry file</Button>}
  </div>;
}

export function ChatAttachments({ files, contact }: { files: unknown; contact: unknown }) {
  const card = parseContactCard(contact);
  return <>{parseChatFiles(files).map(file => <FileAttachment key={file.path} file={file} />)}{card && <div className="mt-2 space-y-1 border-t border-current/20 py-2">
    <p className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4" />{card.name}</p>
    {card.company && <p className="break-words text-xs">{card.company}</p>}{card.phone && <a className="block break-all text-xs underline" href={`tel:${card.phone.replace(/[^+\d]/g, "")}`}>{card.phone}</a>}{card.email && <a className="block break-all text-xs underline" href={`mailto:${encodeURIComponent(card.email)}`}>{card.email}</a>}
    <Button size="sm" variant="ghost" className="text-current" onClick={() => { const url = URL.createObjectURL(new Blob([contactVcard(card)], { type: "text/vcard" })); const a = document.createElement("a"); a.href = url; a.download = "contact.vcf"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}><Download className="mr-2 h-4 w-4" />Save contact</Button>
  </div>}</>;
}