import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Item, ItemCategory } from '../items/entities/item.entity';
import { User } from '../users/entities/user.entity';
import PDFDocument from 'pdfkit';
import * as https from 'https';
import * as http from 'http';

const BRAND_COLOR = '#1a56db';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6b7280';
const DIVIDER = '#e5e7eb';
const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async generateInsurancePdf(
    userId: string,
    categoryIds?: string[],
  ): Promise<Buffer> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const query = this.itemsRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId })
      .orderBy('item.category', 'ASC')
      .addOrderBy('item.name', 'ASC');

    if (categoryIds && categoryIds.length > 0) {
      query.andWhere('item.category IN (:...cats)', { cats: categoryIds });
    }

    const items = await query.getMany();

    const totalPurchase = items.reduce(
      (s, i) => s + (Number(i.purchasePrice) || 0),
      0,
    );
    const totalCurrent = items.reduce(
      (s, i) =>
        s + (Number(i.depreciatedValue) || Number(i.purchasePrice) || 0),
      0,
    );

    return this.buildPdf(user, items, totalPurchase, totalCurrent);
  }

  private buildPdf(
    user: User | null,
    items: Item[],
    totalPurchase: number,
    totalCurrent: number,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
        bufferPages: true,
        info: {
          Title: 'Insurance Report',
          Author: user
            ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
            : 'Unknown',
          Subject: 'Asset Insurance Report',
          Creator: 'DX Solutions Asset Platform',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawCoverPage(doc, user, items.length, totalPurchase, totalCurrent);

      for (const item of items) {
        doc.addPage();
        this.drawHeaderFooter(doc, user);
        this.drawAssetPage(doc, item);
      }

      doc.addPage();
      this.drawHeaderFooter(doc, user);
      this.drawSummaryTable(doc, items, totalPurchase, totalCurrent);

      // Stamp page numbers now that all pages are buffered
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor(TEXT_MUTED)
          .text(
            `Page ${i + 1} of ${totalPages}`,
            PAGE_MARGIN,
            doc.page.height - 30,
            { align: 'right', width: PAGE_WIDTH - PAGE_MARGIN * 2 },
          );
      }

      doc.end();
    });
  }

  private drawHeaderFooter(doc: PDFKit.PDFDocument, user: User | null): void {
    const y = PAGE_MARGIN - 15;
    doc
      .fontSize(7)
      .fillColor(BRAND_COLOR)
      .font('Helvetica-Bold')
      .text('DX SOLUTIONS ASSET PLATFORM', PAGE_MARGIN, y, {
        width: (PAGE_WIDTH - PAGE_MARGIN * 2) / 2,
      })
      .fillColor(TEXT_MUTED)
      .font('Helvetica')
      .text(
        `Insurance Report  ·  ${user?.email ?? ''}`,
        PAGE_MARGIN + (PAGE_WIDTH - PAGE_MARGIN * 2) / 2,
        y,
        { align: 'right', width: (PAGE_WIDTH - PAGE_MARGIN * 2) / 2 },
      );

    doc
      .moveTo(PAGE_MARGIN, y + 12)
      .lineTo(PAGE_WIDTH - PAGE_MARGIN, y + 12)
      .strokeColor(DIVIDER)
      .lineWidth(0.5)
      .stroke();
  }

  private drawCoverPage(
    doc: PDFKit.PDFDocument,
    user: User | null,
    assetCount: number,
    totalPurchase: number,
    totalCurrent: number,
  ): void {
    const contentY = 140;
    const fullName =
      user
        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
        : 'Unknown Owner';

    // Top brand stripe
    doc
      .rect(0, 0, PAGE_WIDTH, 80)
      .fill(BRAND_COLOR);

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('DX SOLUTIONS', PAGE_MARGIN, 22)
      .font('Helvetica')
      .fontSize(10)
      .text('Asset Platform', PAGE_MARGIN, 48);

    doc
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .fontSize(30)
      .text('Insurance Asset Report', PAGE_MARGIN, contentY);

    doc
      .moveTo(PAGE_MARGIN, contentY + 44)
      .lineTo(PAGE_WIDTH - PAGE_MARGIN, contentY + 44)
      .strokeColor(BRAND_COLOR)
      .lineWidth(2)
      .stroke();

    const infoY = contentY + 60;
    const col2X = PAGE_MARGIN + 260;

    doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED);
    doc.text('Prepared for', PAGE_MARGIN, infoY);
    doc.text('Report date', col2X, infoY);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXT_DARK);
    doc.text(fullName, PAGE_MARGIN, infoY + 16);
    doc.text(formatDate(new Date()), col2X, infoY + 16);

    if (user?.email) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(TEXT_MUTED)
        .text(user.email, PAGE_MARGIN, infoY + 33);
    }

    // Summary boxes
    const boxY = infoY + 80;
    const boxes = [
      { label: 'Total Assets', value: String(assetCount) },
      { label: 'Purchase Value', value: formatCurrency(totalPurchase) },
      { label: 'Current Est. Value', value: formatCurrency(totalCurrent) },
    ];
    const boxW = (PAGE_WIDTH - PAGE_MARGIN * 2 - 20) / 3;

    boxes.forEach((box, idx) => {
      const bx = PAGE_MARGIN + idx * (boxW + 10);
      doc.roundedRect(bx, boxY, boxW, 70, 4).fill('#f3f4f6');
      doc
        .fillColor(TEXT_MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text(box.label, bx + 12, boxY + 12, { width: boxW - 24 });
      doc
        .fillColor(TEXT_DARK)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(box.value, bx + 12, boxY + 30, { width: boxW - 24 });
    });

    doc
      .fillColor(TEXT_MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(
        'This report is generated for insurance purposes. Values are estimates and may not reflect current market prices.',
        PAGE_MARGIN,
        doc.page.height - 70,
        { width: PAGE_WIDTH - PAGE_MARGIN * 2, align: 'center' },
      );
  }

  private drawAssetPage(doc: PDFKit.PDFDocument, item: Item): void {
    let y = PAGE_MARGIN + 20;

    // Category chip
    doc
      .roundedRect(PAGE_MARGIN, y, 120, 18, 9)
      .fill('#dbeafe');
    doc
      .fillColor(BRAND_COLOR)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(item.category.toUpperCase().replace(/_/g, ' '), PAGE_MARGIN + 8, y + 5, {
        width: 104,
      });

    y += 28;

    // Asset name
    doc
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(item.name, PAGE_MARGIN, y, { width: PAGE_WIDTH - PAGE_MARGIN * 2 - 160 });

    y = doc.y + 4;

    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_WIDTH - PAGE_MARGIN, y)
      .strokeColor(DIVIDER)
      .lineWidth(0.5)
      .stroke();

    y += 14;

    // Two-column detail layout
    const fields: Array<[string, string | undefined | null]> = [
      ['Brand / Model', [item.brand, item.model].filter(Boolean).join(' / ') || null],
      ['Serial Number', item.serial],
      ['Category', item.category.replace(/_/g, ' ')],
      ['Condition', item.condition?.replace(/_/g, ' ')],
      ['Location', item.location],
      ['Purchase Date', item.purchaseDate ? formatDate(new Date(item.purchaseDate)) : null],
      ['Warranty Expiry', item.warrantyExpiry ? formatDate(new Date(item.warrantyExpiry)) : null],
    ];

    const col1 = PAGE_MARGIN;
    const col2 = PAGE_MARGIN + 248;
    let col1Y = y;
    let col2Y = y;

    fields.forEach((f, idx) => {
      if (!f[1]) return;
      const isCol2 = idx % 2 === 1;
      const cx = isCol2 ? col2 : col1;
      const cy = isCol2 ? col2Y : col1Y;
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8).text(f[0], cx, cy);
      doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(10).text(String(f[1]), cx, cy + 11);
      if (isCol2) col2Y += 36;
      else col1Y += 36;
    });

    y = Math.max(col1Y, col2Y) + 8;

    // Value row
    doc
      .roundedRect(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN * 2, 54, 4)
      .fill('#f9fafb');

    const halfW = (PAGE_WIDTH - PAGE_MARGIN * 2) / 2 - 20;
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8).text('Purchase Price', PAGE_MARGIN + 16, y + 8);
    doc
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(item.purchasePrice ? formatCurrency(Number(item.purchasePrice)) : 'N/A', PAGE_MARGIN + 16, y + 22, { width: halfW });

    const valX = PAGE_MARGIN + 16 + halfW + 20;
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8).text('Current Est. Value', valX, y + 8);
    doc
      .fillColor(BRAND_COLOR)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(
        item.depreciatedValue
          ? formatCurrency(Number(item.depreciatedValue))
          : item.purchasePrice
          ? formatCurrency(Number(item.purchasePrice))
          : 'N/A',
        valX,
        y + 22,
        { width: halfW },
      );

    y += 70;

    if (item.notes) {
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8).text('Notes', PAGE_MARGIN, y);
      y += 11;
      doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(9).text(item.notes, PAGE_MARGIN, y, {
        width: PAGE_WIDTH - PAGE_MARGIN * 2,
      });
      y = doc.y + 14;
    }

    // Photo thumbnails (at most 3, 140px wide each)
    if (item.photos && item.photos.length > 0) {
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8).text('Photos', PAGE_MARGIN, y);
      y += 14;
      const thumbW = 140;
      const thumbH = 100;
      const gap = 10;
      item.photos.slice(0, 3).forEach((url, idx) => {
        const tx = PAGE_MARGIN + idx * (thumbW + gap);
        // Draw a placeholder box — actual image embedding requires async fetch
        // and would block the sync PDF build; show URL as caption instead
        doc
          .roundedRect(tx, y, thumbW, thumbH, 3)
          .strokeColor(DIVIDER)
          .lineWidth(0.5)
          .stroke();
        doc
          .fillColor(TEXT_MUTED)
          .font('Helvetica')
          .fontSize(7)
          .text(`Photo ${idx + 1}`, tx + 4, y + thumbH - 14, { width: thumbW - 8 });
      });
    }
  }

  private drawSummaryTable(
    doc: PDFKit.PDFDocument,
    items: Item[],
    totalPurchase: number,
    totalCurrent: number,
  ): void {
    let y = PAGE_MARGIN + 20;

    doc
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('Summary', PAGE_MARGIN, y);

    y += 28;

    const COL = {
      name: { x: PAGE_MARGIN, w: 160 },
      cat: { x: PAGE_MARGIN + 168, w: 90 },
      serial: { x: PAGE_MARGIN + 266, w: 80 },
      purchase: { x: PAGE_MARGIN + 354, w: 72 },
      current: { x: PAGE_MARGIN + 434, w: 72 },
    };
    const rowH = 22;

    // Header
    doc
      .rect(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN * 2, rowH)
      .fill(BRAND_COLOR);

    const headers: Array<[keyof typeof COL, string]> = [
      ['name', 'Item Name'],
      ['cat', 'Category'],
      ['serial', 'Serial'],
      ['purchase', 'Purchase'],
      ['current', 'Est. Value'],
    ];

    headers.forEach(([key, label]) => {
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(label, COL[key].x + 4, y + 7, { width: COL[key].w - 8 });
    });

    y += rowH;

    items.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
      doc.rect(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN * 2, rowH).fill(bg);

      const rowData: Array<[keyof typeof COL, string]> = [
        ['name', truncate(item.name, 24)],
        ['cat', item.category.replace(/_/g, ' ')],
        ['serial', item.serial ?? '—'],
        ['purchase', item.purchasePrice ? formatCurrency(Number(item.purchasePrice)) : '—'],
        ['current', item.depreciatedValue
          ? formatCurrency(Number(item.depreciatedValue))
          : item.purchasePrice
          ? formatCurrency(Number(item.purchasePrice))
          : '—'],
      ];

      rowData.forEach(([key, val]) => {
        doc
          .fillColor(TEXT_DARK)
          .font('Helvetica')
          .fontSize(8)
          .text(val, COL[key].x + 4, y + 7, { width: COL[key].w - 8 });
      });

      y += rowH;

      // Add new page if running out of space
      if (y > doc.page.height - PAGE_MARGIN - 80) {
        doc.addPage();
        this.drawHeaderFooter(doc, null);
        y = PAGE_MARGIN + 20;
      }
    });

    // Totals row
    doc
      .rect(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN * 2, rowH)
      .fill('#dbeafe');

    doc.fillColor(BRAND_COLOR).font('Helvetica-Bold').fontSize(8);
    doc.text('TOTAL', COL.name.x + 4, y + 7, { width: COL.name.w - 8 });
    doc.text(formatCurrency(totalPurchase), COL.purchase.x + 4, y + 7, { width: COL.purchase.w - 8 });
    doc.text(formatCurrency(totalCurrent), COL.current.x + 4, y + 7, { width: COL.current.w - 8 });
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
