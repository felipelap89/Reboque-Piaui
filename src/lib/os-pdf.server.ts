import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOGO_PNG_BASE64 } from "@/lib/logo-data";

function brl(n: number) {
  return Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Gera um PDF de Ordem de Serviço em UMA ÚNICA PÁGINA (A4) com logo, marca d'água
 * e espaçamentos uniformes. Faz upload para o bucket `os-docs` e retorna a URL pública.
 */
export async function generateOsPdf(servicoId: string): Promise<string> {
  const { data: svc, error } = await supabaseAdmin
    .from("servicos")
    .select("*")
    .eq("id", servicoId)
    .single();
  if (error || !svc) throw new Error(`Serviço não encontrado: ${error?.message}`);

  const [{ data: motorista }, { data: veiculoEmpresa }, { data: conta }] = await Promise.all([
    svc.motorista_id
      ? supabaseAdmin.from("motoristas").select("nome, telefone").eq("id", svc.motorista_id).single()
      : Promise.resolve({ data: null as any }),
    svc.veiculo_id
      ? supabaseAdmin.from("veiculos").select("modelo, placa, marca, cor").eq("id", svc.veiculo_id).single()
      : Promise.resolve({ data: null as any }),
    svc.conta_id
      ? supabaseAdmin.from("contas").select("nome, banco, pix_key, qr_path").eq("id", svc.conta_id).single()
      : Promise.resolve({ data: null as any }),
  ]);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PRIMARY = rgb(0.05, 0.32, 0.6);
  const DARK = rgb(0.1, 0.1, 0.12);
  const MUTED = rgb(0.45, 0.48, 0.55);
  const SOFT = rgb(0.94, 0.96, 0.99);
  const LINE = rgb(0.86, 0.88, 0.92);
  const WHITE = rgb(1, 1, 1);

  // ===== Watermark (centro, rotacionado) =====
  try {
    const logoImg = await pdf.embedPng(b64ToBytes(LOGO_PNG_BASE64));
    const wmSize = 360;
    page.drawImage(logoImg, {
      x: (width - wmSize) / 2,
      y: (height - wmSize) / 2,
      width: wmSize,
      height: wmSize,
      opacity: 0.06,
      rotate: degrees(-20),
    });
  } catch {}

  // ===== Header =====
  const headerH = 86;
  page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: PRIMARY });

  // logo no header
  try {
    const logoImg = await pdf.embedPng(b64ToBytes(LOGO_PNG_BASE64));
    const lh = 60;
    page.drawImage(logoImg, { x: 28, y: height - headerH + (headerH - lh) / 2, width: lh, height: lh });
  } catch {}

  page.drawText("REBOQUE PIAUÍ", {
    x: 100, y: height - 36, size: 18, font: bold, color: WHITE,
  });
  page.drawText("Ordem de Serviço", {
    x: 100, y: height - 56, size: 10, font, color: rgb(0.85, 0.9, 1),
  });

  const numero = svc.numero ?? "—";
  const numW = bold.widthOfTextAtSize(numero, 16);
  page.drawText(numero, { x: width - 28 - numW, y: height - 36, size: 16, font: bold, color: WHITE });
  const dataStr = fmtDate(svc.data ?? svc.created_at ?? new Date().toISOString());
  const dW = font.widthOfTextAtSize(dataStr, 9);
  page.drawText(dataStr, { x: width - 28 - dW, y: height - 56, size: 9, font, color: rgb(0.85, 0.9, 1) });

  // ===== Layout: 2 colunas com cards uniformes =====
  const M = 28;             // margem
  const GAP = 10;           // espaço uniforme entre cards
  const colW = (width - M * 2 - GAP) / 2;
  const topY = height - headerH - 16;

  // Helper: desenha um card com título e linhas (label/value).
  // Retorna a altura usada.
  type Row = [string, string];
  const drawCard = (
    x: number,
    y: number,
    w: number,
    title: string,
    rows: Row[],
    cols: 1 | 2 = 1,
  ): number => {
    const padX = 10;
    const padTop = 22;
    const lineH = 26;
    const totalRows = cols === 2 ? Math.ceil(rows.length / 2) : rows.length;
    const h = padTop + totalRows * lineH + 8;

    // bg
    page.drawRectangle({ x, y: y - h, width: w, height: h, color: SOFT, borderColor: LINE, borderWidth: 0.5 });
    // accent bar
    page.drawRectangle({ x, y: y - h, width: 3, height: h, color: PRIMARY });
    // title
    page.drawText(title, { x: x + padX, y: y - 14, size: 9, font: bold, color: PRIMARY });
    // separator
    page.drawLine({
      start: { x: x + padX, y: y - 18 },
      end: { x: x + w - padX, y: y - 18 },
      thickness: 0.4,
      color: LINE,
    });

    let i = 0;
    for (const [label, value] of rows) {
      const colIdx = cols === 2 ? i % 2 : 0;
      const rowIdx = cols === 2 ? Math.floor(i / 2) : i;
      const cellW = cols === 2 ? (w - padX * 2 - 8) / 2 : w - padX * 2;
      const cx = x + padX + colIdx * (cellW + 8);
      const cy = y - padTop - rowIdx * lineH;
      page.drawText(label, { x: cx, y: cy - 2, size: 7.5, font, color: MUTED });
      const v = value || "—";
      // truncate to fit
      const maxW = cellW;
      let txt = v;
      const sz = 10.5;
      while (bold.widthOfTextAtSize(txt, sz) > maxW && txt.length > 3) {
        txt = txt.slice(0, -2);
      }
      if (txt !== v) txt = txt.slice(0, -1) + "…";
      page.drawText(txt, { x: cx, y: cy - 14, size: sz, font: bold, color: DARK });
      i++;
    }
    return h;
  };

  // Conteúdo dos cards
  let leftY = topY;
  let rightY = topY;

  // Cliente (esq)
  leftY -= drawCard(M, leftY, colW, "CLIENTE", [
    ["Nome", svc.cliente ?? "—"],
    ["Telefone", svc.telefone ?? "—"],
  ], 2) + GAP;

  // Veículo do cliente (dir)
  rightY -= drawCard(M + colW + GAP, rightY, colW, "VEÍCULO DO CLIENTE", [
    ["Modelo", svc.veiculo_modelo ?? "—"],
    ["Placa", svc.placa ?? "—"],
    ["Ano", svc.veiculo_ano ?? "—"],
  ], 2) + GAP;

  // Trajeto (esq) — full width row, mas mantemos coluna
  leftY -= drawCard(M, leftY, colW, "TRAJETO", [
    ["Origem", svc.origem ?? "—"],
    ["Destino", svc.destino ?? "—"],
    ["Distância", svc.km ? `${Number(svc.km).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : "—"],
  ], 1) + GAP;

  // Serviço & Pagamento (dir)
  rightY -= drawCard(M + colW + GAP, rightY, colW, "SERVIÇO & PAGAMENTO", [
    ["Tipo", svc.tipo ?? "—"],
    ["Forma", svc.pagamento ?? "—"],
    ["Valor", brl(Number(svc.valor ?? 0))],
  ], 1) + GAP;

  // Sincroniza colunas
  let curY = Math.min(leftY, rightY);

  // Motorista + Guincho (lado a lado)
  const motoristaH = drawCard(M, curY, colW, "MOTORISTA", [
    ["Nome", motorista?.nome ?? "—"],
    ["Telefone", motorista?.telefone ?? "—"],
  ], 1);

  if (veiculoEmpresa) {
    drawCard(M + colW + GAP, curY, colW, "GUINCHO / CAMINHÃO", [
      ["Modelo", veiculoEmpresa.modelo ?? "—"],
      ["Placa", veiculoEmpresa.placa ?? "—"],
      ["Marca", veiculoEmpresa.marca ?? "—"],
      ["Cor", veiculoEmpresa.cor ?? "—"],
    ], 2);
  }
  curY -= motoristaH + GAP;

  // Pagamento PIX (esq) + QR (dir)
  if (conta?.pix_key) {
    const pixH = drawCard(M, curY, colW, "PAGAMENTO PIX", [
      ["Conta", conta.nome ?? "—"],
      ["Banco", conta.banco ?? "—"],
      ["Chave Pix", conta.pix_key],
    ], 1);

    // QR card
    try {
      let qrBytes: Uint8Array | null = null;
      if (conta.qr_path) {
        const { data: blob } = await supabaseAdmin.storage.from("contas-qr").download(conta.qr_path);
        if (blob) qrBytes = new Uint8Array(await blob.arrayBuffer());
      }
      let qrImage;
      if (qrBytes) {
        try { qrImage = await pdf.embedPng(qrBytes); }
        catch { qrImage = await pdf.embedJpg(qrBytes); }
      } else {
        const dataUrl = await QRCode.toDataURL(conta.pix_key, { margin: 1, width: 300 });
        qrImage = await pdf.embedPng(b64ToBytes(dataUrl.split(",")[1]));
      }
      const qrX = M + colW + GAP;
      // box do QR alinhado ao card pix
      page.drawRectangle({ x: qrX, y: curY - pixH, width: colW, height: pixH, color: SOFT, borderColor: LINE, borderWidth: 0.5 });
      page.drawRectangle({ x: qrX, y: curY - pixH, width: 3, height: pixH, color: PRIMARY });
      page.drawText("QR CODE PIX", { x: qrX + 10, y: curY - 14, size: 9, font: bold, color: PRIMARY });
      const qrSize = Math.min(pixH - 30, colW - 20);
      const qrPx = qrX + (colW - qrSize) / 2;
      const qrPy = curY - pixH + (pixH - qrSize) / 2 - 4;
      page.drawImage(qrImage, { x: qrPx, y: qrPy, width: qrSize, height: qrSize });
    } catch (e) {
      console.error("[os-pdf] QR error", e);
    }
    curY -= pixH + GAP;
  }

  // Observações (largura cheia)
  if (svc.obs) {
    const fullW = width - M * 2;
    const padX = 10, padTop = 22, lineH = 12;
    const lines = wrap(svc.obs, font, 9.5, fullW - padX * 2);
    const visible = lines.slice(0, 4);
    const h = padTop + visible.length * lineH + 8;
    page.drawRectangle({ x: M, y: curY - h, width: fullW, height: h, color: SOFT, borderColor: LINE, borderWidth: 0.5 });
    page.drawRectangle({ x: M, y: curY - h, width: 3, height: h, color: PRIMARY });
    page.drawText("OBSERVAÇÕES", { x: M + padX, y: curY - 14, size: 9, font: bold, color: PRIMARY });
    page.drawLine({ start: { x: M + padX, y: curY - 18 }, end: { x: M + fullW - padX, y: curY - 18 }, thickness: 0.4, color: LINE });
    let yy = curY - padTop;
    for (const ln of visible) {
      page.drawText(ln, { x: M + padX, y: yy - 2, size: 9.5, font, color: DARK });
      yy -= lineH;
    }
    curY -= h + GAP;
  }

  // ===== Footer =====
  page.drawLine({ start: { x: M, y: 42 }, end: { x: width - M, y: 42 }, thickness: 0.5, color: LINE });
  const ft = "Reboque Piauí · Ordem de Serviço gerada automaticamente";
  page.drawText(ft, { x: M, y: 28, size: 8, font, color: MUTED });
  const pg = "Página 1 de 1";
  page.drawText(pg, { x: width - M - font.widthOfTextAtSize(pg, 8), y: 28, size: 8, font, color: MUTED });

  const bytes = await pdf.save();

  // Upload
  const path = `${new Date().getFullYear()}/${svc.numero ?? svc.id}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("os-docs")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(`Upload OS: ${upErr.message}`);

  const { data: pub } = supabaseAdmin.storage.from("os-docs").getPublicUrl(path);
  return pub.publicUrl;
}

function wrap(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (line) out.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}
