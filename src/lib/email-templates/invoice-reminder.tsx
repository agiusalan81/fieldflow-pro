import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Props = { companyName?: string; invoiceNumber?: string; stage?: string; total?: string; dueDate?: string; payUrl?: string; readOnly?: boolean };

function InvoiceReminder({ companyName = "your company", invoiceNumber = "FB-1001", stage = "Invoice issued", total = "€0.00", dueDate = "", payUrl = "https://fieldbridgeapp.com/subscription", readOnly = false }: Props) {
  return (
    <Html><Head /><Preview>{`${stage}: FieldBridge invoice ${invoiceNumber}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ padding: "24px", maxWidth: "560px" }}>
          <Heading style={{ color: "#14213d", fontSize: "20px" }}>{stage}</Heading>
          <Text>Hello {companyName},</Text>
          <Text>FieldBridge invoice <strong>{invoiceNumber}</strong> for <strong>{total}</strong> is {dueDate ? `due on ${dueDate}` : "now available"}.</Text>
          {readOnly && <Text>Because this invoice is more than 14 days overdue, your workspace is read-only. Your records and exports stay available, and editing returns as soon as the invoice is paid.</Text>}
          <Button href={payUrl} style={{ backgroundColor: "#f5a524", color: "#14213d", padding: "12px 20px", borderRadius: "6px", fontWeight: "bold" }}>View and pay invoice</Button>
          <Text style={{ color: "#666666", fontSize: "12px" }}>You can also pay by bank transfer quoting the invoice number. If you have already paid, please ignore this message.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: InvoiceReminder,
  subject: (d) => `${d["stage"] ?? "Invoice"} — FieldBridge invoice ${d["invoiceNumber"] ?? ""}`,
  displayName: "FieldBridge invoice reminder",
  previewData: { companyName: "Minakel", invoiceNumber: "FB-1001", stage: "Due in 3 days", total: "€177.00", dueDate: "2026-11-15" },
};
