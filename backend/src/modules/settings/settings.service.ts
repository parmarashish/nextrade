import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import { RequestContext } from '../../common/types.js';
import {
  companyInfoSchema,
  inventorySettingsSchema,
  invoiceSettingsSchema,
  notificationSettingsSchema,
  SettingKey,
} from './settings.dto.js';

export const DEFAULT_SETTINGS: Record<SettingKey, { value: any; description: string }> = {
  COMPANY_INFO: {
    description: 'Corporate business profile and tax details',
    value: {
      name: 'NexTrade B2B Commerce Pvt Ltd',
      address: '401 Trade Avenue, Kurla West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400070',
      phone: '+91 98200 12345',
      email: 'contact@nextrade.com',
      website: 'https://www.nextrade.com',
      gstNumber: '00AAAAA0000A0Z0',
      logo: 'https://placehold.co/200x60?text=NexTrade',
    },
  },
  INVOICE_SETTINGS: {
    description: 'Invoice defaults and settlement bank details',
    value: {
      defaultCreditDays: 30,
      dueDateBuffer: 0,
      bankName: 'Demo Bank',
      accountNumber: '00000000000000',
      ifscCode: 'DEMO0000001',
      accountHolderName: 'NexTrade Commerce Pvt Ltd',
      upiId: 'demo@nextradetest',
    },
  },
  INVENTORY_SETTINGS: {
    description: 'Inventory thresholds and stock safety policies',
    value: {
      defaultReorderPoint: 10,
      defaultLowStockThreshold: 5,
      allowNegativeStock: false,
    },
  },
  NOTIFICATION_SETTINGS: {
    description: 'System alert triggers and email preferences',
    value: {
      lowStockEmailEnabled: true,
      orderConfirmationEnabled: true,
      paymentReminderEnabled: true,
    },
  },
};

export class SettingsService {
  // ─── Get All Settings as Grouped Object (Admin) ──────────────────

  async getAll() {
    const settingsList = await prisma.systemSetting.findMany();
    const map = new Map(settingsList.map((s) => [s.key, s.value]));

    const result: Record<string, any> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
      result[key] = map.get(key) ?? DEFAULT_SETTINGS[key].value;
    }

    return result;
  }

  // ─── Get Specific Setting (Admin) ────────────────────────────────

  async getByKey(key: SettingKey) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    if (setting) {
      return {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        updatedAt: setting.updatedAt,
      };
    }

    const defaultSetting = DEFAULT_SETTINGS[key];
    if (!defaultSetting) {
      throw AppError.notFound(`Setting '${key}' not found`);
    }

    return {
      key,
      value: defaultSetting.value,
      description: defaultSetting.description,
      updatedAt: null,
    };
  }

  // ─── Update Specific Setting (Admin) ─────────────────────────────

  async updateSetting(
    key: SettingKey,
    body: any,
    adminId: string,
    ctx?: RequestContext
  ) {
    let parseResult: { success: true; data: any } | { success: false; error: any };

    switch (key) {
      case 'COMPANY_INFO':
        parseResult = companyInfoSchema.safeParse(body);
        break;
      case 'INVOICE_SETTINGS':
        parseResult = invoiceSettingsSchema.safeParse(body);
        break;
      case 'INVENTORY_SETTINGS':
        parseResult = inventorySettingsSchema.safeParse(body);
        break;
      case 'NOTIFICATION_SETTINGS':
        parseResult = notificationSettingsSchema.safeParse(body);
        break;
      default:
        throw AppError.badRequest(`Unknown setting key: ${key}`);
    }

    if (!parseResult.success) {
      const details = parseResult.error.errors.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw AppError.badRequest(`Validation failed for setting '${key}'`, details);
    }

    const validatedValue = parseResult.data;

    const description = DEFAULT_SETTINGS[key]?.description || key;

    const updated = await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: validatedValue,
        description,
      },
      update: {
        value: validatedValue,
        description,
      },
    });

    // Audit Log
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE_SETTINGS',
        entityType: 'SETTING',
        entityId: updated.id,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        details: {
          key,
          updatedFields: Object.keys(validatedValue),
        },
      },
    });

    return updated;
  }

  // ─── Seed Defaults for All Keys (Admin) ──────────────────────────

  async initializeDefaults() {
    const keys = Object.keys(DEFAULT_SETTINGS) as SettingKey[];
    let seededCount = 0;

    for (const key of keys) {
      const existing = await prisma.systemSetting.findUnique({ where: { key } });
      if (!existing) {
        await prisma.systemSetting.create({
          data: {
            key,
            value: DEFAULT_SETTINGS[key].value,
            description: DEFAULT_SETTINGS[key].description,
          },
        });
        seededCount++;
      }
    }

    return {
      message: `Settings initialized successfully. ${seededCount} newly created, ${keys.length - seededCount} already existed.`,
      seededCount,
      totalKeys: keys.length,
    };
  }

  // ─── Public Settings (Dealer / Storefront) ────────────────────────

  async getPublicSettings() {
    const [companySetting, invoiceSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'COMPANY_INFO' } }),
      prisma.systemSetting.findUnique({ where: { key: 'INVOICE_SETTINGS' } }),
    ]);

    const company = (companySetting?.value as any) ?? DEFAULT_SETTINGS.COMPANY_INFO.value;
    const invoice = (invoiceSetting?.value as any) ?? DEFAULT_SETTINGS.INVOICE_SETTINGS.value;

    return {
      company: {
        name: company.name,
        address: company.address,
        city: company.city,
        state: company.state,
        pincode: company.pincode,
        phone: company.phone,
        email: company.email,
        website: company.website,
        gstNumber: company.gstNumber,
        logo: company.logo,
      },
      bankDetails: {
        bankName: invoice.bankName,
        accountNumber: invoice.accountNumber,
        ifscCode: invoice.ifscCode,
        accountHolderName: invoice.accountHolderName,
        upiId: invoice.upiId,
      },
    };
  }
}

export const settingsService = new SettingsService();
