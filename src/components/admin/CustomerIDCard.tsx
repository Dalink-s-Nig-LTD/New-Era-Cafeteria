import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeCanvas } from "qrcode.react";
import {
  Printer,
  Download,
  Mail,
  Share2,
  Send,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

// Card color palette — light gold theme
const FRONT_BG = "#D4A843"; // warm light gold (front background)
const PANEL_BG = "#B8911A"; // deeper gold (back-left panel)
const DARK = "#2C1800"; // deep brown (main text)
const LABEL = "#7A5010"; // muted gold-brown (label text)
const CARD_BG = "#FFFDF2"; // near-white (back card bg)
const LIGHT_TEXT = "#FFF8E0"; // cream (text on gold panels)

interface CustomerIDCardProps {
  student: {
    customerId: string;
    firstName: string;
    lastName: string;
    department: string;
    classLevel: string;
    barcodeData: string;
    photo?: string;
    expiryDate?: number;
  };
}

export function CustomerIDCard({ student }: CustomerIDCardProps) {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [emailAddresses, setEmailAddresses] = useState<string[]>([""]);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const sendCustomerIdEmail = useAction(
    api.sendCustomerIdEmail.sendCustomerIdEmail,
  );

  const initials =
    (student.firstName?.[0] ?? "") + (student.lastName?.[0] ?? "");

  const getQrDataUrl = (): string => {
    const canvas = qrContainerRef.current?.querySelector(
      "canvas",
    ) as HTMLCanvasElement | null;
    return canvas?.toDataURL("image/png") ?? "";
  };

  const handlePrint = () => {
    // Grab QR data-url BEFORE writing the iframe so it's available synchronously
    const qrDataUrl = getQrDataUrl();

    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm;border:none;";
    document.body.appendChild(iframe);

    if (!iframe.contentWindow) {
      document.body.removeChild(iframe);
      return;
    }

    const printHtml = `<!DOCTYPE html>
<html>
<head>
<title>ID Card</title>
<style>
  @page { size: 85.6mm 53.98mm; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:85.6mm; font-family:Georgia,serif; background:#fff; }
  .page { width:85.6mm; height:53.98mm; page-break-after:always; overflow:hidden; display:block; }
  .front { background:${FRONT_BG}; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; }
  .front-watermark { position:absolute; top:50%; left:50%; transform:translate(-50%,-60%); font-size:11mm; font-weight:bold; color:rgba(44,24,0,0.06); font-family:Georgia,serif; line-height:1; white-space:nowrap; }
  .mono { font-size:15mm; font-weight:bold; color:${DARK}; letter-spacing:2mm; font-family:Georgia,serif; line-height:1; }
  .divider { width:42mm; height:0.4mm; background:${DARK}; margin:2.5mm 0; opacity:0.35; }
  .front-name { font-size:5.5mm; font-weight:bold; color:${DARK}; letter-spacing:1.2mm; text-transform:uppercase; font-family:Georgia,serif; text-align:center; }
  .front-sub { font-size:2.4mm; color:rgba(44,24,0,0.55); letter-spacing:0.8mm; text-transform:uppercase; margin-top:1.2mm; }
  .back { background:${CARD_BG}; display:flex; flex-direction:row; overflow:hidden; }
  .back-left { width:30mm; background:${PANEL_BG}; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2.5mm; padding:3.5mm; }
  .qr-wrap { background:#fff; padding:1.8mm; border-radius:1.2mm; }
  .qr-wrap img { width:22mm; height:22mm; display:block; }
  .back-label { font-size:2.2mm; color:${LIGHT_TEXT}; letter-spacing:0.5mm; text-transform:uppercase; opacity:0.85; }
  .back-right { flex:1; padding:4.5mm 3.5mm 4.5mm 4.5mm; display:flex; flex-direction:column; justify-content:space-between; position:relative; }
  .back-watermark { position:absolute; top:50%; left:50%; transform:translate(-50%,-60%); font-size:9mm; font-weight:bold; color:rgba(180,145,26,0.09); font-family:Georgia,serif; line-height:1; white-space:nowrap; }
  .back-name { font-size:5mm; font-weight:bold; color:${DARK}; letter-spacing:0.4mm; font-family:Georgia,serif; line-height:1.2; }
  .back-sub { font-size:2.3mm; color:${LABEL}; letter-spacing:0.5mm; text-transform:uppercase; margin-top:0.6mm; }
  .info-row { font-size:2.8mm; color:${DARK}; line-height:1.9; }
  .info-label { color:${LABEL}; font-size:2.3mm; }
  .back-footer { font-size:2.2mm; color:${LABEL}; letter-spacing:0.5mm; }
</style>
</head>
<body>
<div class="page front">
  <div class="front-watermark">NEW ERA</div>
  <div class="mono">${initials.toUpperCase()}</div>
  <div class="divider"></div>
  <div class="front-name">${student.firstName} ${student.lastName}</div>
  <div class="front-sub">New Era Cafeteria &nbsp;•&nbsp; Member</div>
</div>
<div class="page back">
  <div class="back-left">
    ${qrDataUrl ? `<div class="qr-wrap"><img src="${qrDataUrl}" /></div>` : ""}
    <div class="back-label">Scan ID</div>
  </div>
  <div class="back-right">
    <div class="back-watermark">NEW ERA</div>
    <div>
      <div class="back-name">${student.firstName} ${student.lastName}</div>
      <div class="back-sub">New Era Cafeteria VIP</div>
    </div>
    <div class="info-row">
      <div><span class="info-label">ID &nbsp;&nbsp;&nbsp;</span>${student.customerId}</div>
      <div><span class="info-label">Dept &nbsp;</span>${student.department}</div>
      <div><span class="info-label">Level </span>${student.classLevel}</div>
    </div>
    <div class="back-footer">NEW ERA CAFETERIA</div>
  </div>
</div>
</body>
</html>`;

    // Use blob + srcdoc to avoid stream issues
    const blob = new Blob([printHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error("Print failed:", e);
      }

      // Cleanup after print dialog closes (use timeout since onafterprint isn't available on iframes)
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        URL.revokeObjectURL(url);
      }, 5000);
    };
  };

  const handleDownloadPDF = async () => {
    if (!frontRef.current || !backRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const cardW = 85.6;
      const cardH = 53.98;
      const doc = new jsPDF({
        unit: "mm",
        format: [cardW, cardH],
        orientation: "landscape",
      });

      const frontCanvas = await html2canvas(frontRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
      });
      doc.addImage(
        frontCanvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        cardW,
        cardH,
      );

      doc.addPage([cardW, cardH], "landscape");
      const backCanvas = await html2canvas(backRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
      });
      doc.addImage(
        backCanvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        cardW,
        cardH,
      );

      doc.save(`ID_${student.firstName}_${student.lastName}.pdf`);
      toast.success("ID Card PDF downloaded");
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const generatePdfBase64 = async (): Promise<string> => {
    if (!frontRef.current || !backRef.current)
      throw new Error("Card not rendered");
    const html2canvas = (await import("html2canvas")).default;
    const cardW = 85.6;
    const cardH = 53.98;
    const doc = new jsPDF({
      unit: "mm",
      format: [cardW, cardH],
      orientation: "landscape",
    });

    const frontCanvas = await html2canvas(frontRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    doc.addImage(
      frontCanvas.toDataURL("image/jpeg", 0.85),
      "JPEG",
      0,
      0,
      cardW,
      cardH,
    );
    doc.addPage([cardW, cardH], "landscape");
    const backCanvas = await html2canvas(backRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    doc.addImage(
      backCanvas.toDataURL("image/jpeg", 0.85),
      "JPEG",
      0,
      0,
      cardW,
      cardH,
    );

    const pdfBase64 = doc.output("datauristring").split(",")[1];
    return pdfBase64;
  };

  const handleSendEmail = async () => {
    const validEmails = emailAddresses.filter((e) => e.trim());
    if (validEmails.length === 0) return;
    setSendingEmail(true);
    try {
      const pdfBase64 = await generatePdfBase64();
      await Promise.all(
        validEmails.map((email) =>
          sendCustomerIdEmail({
            to: email.trim(),
            firstName: student.firstName,
            lastName: student.lastName,
            customerId: student.customerId,
            pdfBase64,
          }),
        ),
      );
      toast.success(`ID Card PDF sent to ${validEmails.join(", ")}`);
      setShowEmailInput(false);
      setEmailAddresses([""]);
    } catch (error) {
      console.error("Email send error:", error);
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden QR canvas for data URL extraction */}
      <div
        ref={qrContainerRef}
        style={{ position: "absolute", left: -9999, top: -9999 }}
      >
        <QRCodeCanvas value={student.barcodeData} size={200} />
      </div>

      {/* FRONT */}
      <div
        ref={frontRef}
        style={{
          width: "100%",
          maxWidth: 420,
          aspectRatio: "85.6 / 53.98",
          borderRadius: 12,
          background: FRONT_BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          boxShadow: "0 4px 24px rgba(180,145,26,0.3)",
        }}
      >
        {/* Watermark */}
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            fontSize: 52,
            fontWeight: "bold",
            color: "rgba(44,24,0,0.06)",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          NEW ERA
        </span>
        {/* Monogram */}
        <span
          style={{
            fontSize: 64,
            fontWeight: "bold",
            color: DARK,
            letterSpacing: "0.1em",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
          }}
        >
          {initials.toUpperCase()}
        </span>
        {/* Divider */}
        <div
          style={{
            width: "44%",
            height: 1.5,
            background: DARK,
            opacity: 0.28,
            margin: "12px 0 10px",
          }}
        />
        {/* Name */}
        <span
          style={{
            fontSize: 20,
            fontWeight: "bold",
            color: DARK,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "Georgia, serif",
            textAlign: "center",
            padding: "0 8%",
          }}
        >
          {student.firstName} {student.lastName}
        </span>
        {/* Subtitle */}
        <span
          style={{
            fontSize: 10,
            color: "rgba(44,24,0,0.5)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginTop: 8,
          }}
        >
          New Era Cafeteria &nbsp;•&nbsp; VIP
        </span>
      </div>

      {/* BACK */}
      <div
        ref={backRef}
        style={{
          width: "100%",
          maxWidth: 420,
          aspectRatio: "85.6 / 53.98",
          borderRadius: 12,
          background: CARD_BG,
          display: "flex",
          flexDirection: "row",
          margin: "0 auto",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          boxShadow: "0 4px 24px rgba(180,145,26,0.3)",
        }}
      >
        {/* Left gold panel */}
        <div
          style={{
            width: "32%",
            background: PANEL_BG,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: 14,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 6,
              borderRadius: 6,
              lineHeight: 0,
            }}
          >
            <QRCodeCanvas value={student.barcodeData} size={80} />
          </div>
          <span
            style={{
              fontSize: 9,
              color: LIGHT_TEXT,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            Scan ID
          </span>
        </div>

        {/* Right info panel */}
        <div
          style={{
            flex: 1,
            padding: "14px 12px 14px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Watermark */}
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -60%)",
              fontSize: 44,
              fontWeight: "bold",
              color: "rgba(180,145,26,0.08)",
              fontFamily: "Georgia, serif",
              lineHeight: 1,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            NEW ERA
          </span>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: DARK,
                letterSpacing: "0.03em",
                fontFamily: "Georgia, serif",
                lineHeight: 1.25,
              }}
            >
              {student.firstName} {student.lastName}
            </div>
            <div
              style={{
                fontSize: 9,
                color: LABEL,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              New Era Cafeteria VIP
            </div>
          </div>
          <div style={{ fontSize: 13, color: DARK, lineHeight: 1.75 }}>
            <div>
              <span style={{ color: LABEL, fontSize: 11 }}>
                ID &nbsp;&nbsp;&nbsp;
              </span>
              {student.customerId}
            </div>
            <div>
              <span style={{ color: LABEL, fontSize: 11 }}>Dept &nbsp;</span>
              {student.department}
            </div>
            <div>
              <span style={{ color: LABEL, fontSize: 11 }}>Level &nbsp;</span>
              {student.classLevel}
            </div>
          </div>
          <div style={{ fontSize: 10, color: LABEL, letterSpacing: "0.07em" }}>
            NEW ERA CAFETERIA
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Print
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Share2 className="w-4 h-4" /> Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover">
            <DropdownMenuItem onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowEmailInput(!showEmailInput)}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email to Customer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showEmailInput && (
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30 max-w-[340px] mx-auto">
          {emailAddresses.map((email, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                type="email"
                placeholder={`student@example.com`}
                value={email}
                onChange={(e) => {
                  const updated = [...emailAddresses];
                  updated[idx] = e.target.value;
                  setEmailAddresses(updated);
                }}
                className="flex-1"
              />
              {emailAddresses.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() =>
                    setEmailAddresses(
                      emailAddresses.filter((_, i) => i !== idx),
                    )
                  }
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            {emailAddresses.length < 2 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => setEmailAddresses([...emailAddresses, ""])}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add recipient
              </Button>
            )}
            <Button
              size="sm"
              className="ml-auto"
              onClick={handleSendEmail}
              disabled={!emailAddresses.some((e) => e.trim()) || sendingEmail}
            >
              {sendingEmail ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
