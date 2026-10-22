/**
 * Privacy policy + Terms of use (Arabic / English).
 * TEMPLATE: generic text suitable as a starting point for Google Play. It MUST be reviewed by the owner / a lawyer
 * (company name, contact email, governing law) before relying on it.
 */
import type { Locale } from "./constants";
export type LegalDoc = { title: string; updated: string; intro: string; sections: { h: string; p: string[] }[] };
const UPDATED = { ar: "آخر تحديث: 22 أكتوبر 2026", en: "Last updated: 22 October 2026" };

const privacy: Record<Locale, LegalDoc> = {
  ar: {
    title: "سياسة الخصوصية", updated: UPDATED.ar,
    intro: "توضح هذه السياسة البيانات التي يجمعها موقع وتطبيق «نزلاوي» وكيف نستخدمها ونحميها، وحقوقك تجاهها. باستخدامك للخدمة فأنت توافق على هذه السياسة.",
    sections: [
      { h: "البيانات التي نجمعها", p: [
        "بيانات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف (اختياري)، واللغة المفضلة. كلمات المرور تُحفظ مشفّرة (hash) ولا يمكن لأحد قراءتها.",
        "بيانات المتاجر والمنتجات التي يضيفها مقدمو الخدمة: الاسم، الوصف، الأسعار، الصور، الفيديو، رقم واتساب، ومواعيد العمل.",
        "الموقع الجغرافي: فقط عندما تختار تحديد موقع على الخريطة (للمتجر أو المنتج أو عنوانك). نستخدم إذن الموقع في جهازك لتوسيط الخريطة ولا نتتبع موقعك في الخلفية.",
        "الكاميرا والصور: فقط عندما تختار رفع صورة أو فيديو.",
        "بيانات تقنية: سجلات الخادم الأساسية (مثل عنوان IP ونوع المتصفح) لأغراض الأمان ومنع إساءة الاستخدام.",
      ] },
      { h: "كيف نستخدم البيانات", p: ["لتشغيل الحساب والمتاجر وعرضها للزوار، وإرسال رسائل التحقق واستعادة كلمة المرور، ومراجعة المحتوى، وحماية الخدمة من الإساءة. لا نبيع بياناتك ولا نستخدمها للإعلانات الموجهة."] },
      { h: "ما يظهر للعامة", p: ["بيانات المتجر والمنتجات المنشورة (الاسم، الصور، الأسعار، رقم الهاتف/واتساب، الموقع على الخريطة) تظهر لكل زوار الموقع. بريدك الإلكتروني وكلمة المرور لا يظهران أبداً."] },
      { h: "مشاركة البيانات مع أطراف أخرى", p: ["نستخدم مزودي خدمة لتشغيل المنصة فقط: الاستضافة وقاعدة البيانات وتخزين الملفات (Vercel وما يرتبط بها)، وخرائط OpenStreetMap لعرض الخريطة، وخدمة البريد لإرسال الرسائل. عند الضغط على «اطلب على واتساب» تنتقل إلى واتساب وتخضع لسياسة خصوصيته."] },
      { h: "الاحتفاظ والحذف", p: ["نحتفظ ببياناتك طالما حسابك قائم. يمكنك حذف حسابك من صفحة الإعدادات، وعندها تُحذف بياناتك وملفاتك. قد يحذف المشرف المحتوى المخالف نهائياً."] },
      { h: "الأمان", p: ["نستخدم اتصالاً مشفراً (HTTPS)، وتشفير كلمات المرور، وصلاحيات محددة لكل دور، وحدوداً لعدد المحاولات. لا يوجد نظام آمن بنسبة 100٪ لكننا نبذل جهداً معقولاً لحماية بياناتك."] },
      { h: "الأطفال", p: ["الخدمة غير موجهة للأطفال دون 13 عاماً، ولا نجمع بياناتهم عن قصد."] },
      { h: "حقوقك", p: ["يمكنك الاطلاع على بياناتك وتعديلها من الإعدادات، وطلب حذفها، أو التواصل معنا عبر صفحة «تواصل معنا»."] },
      { h: "التغييرات", p: ["قد نحدّث هذه السياسة، وسننشر النسخة الجديدة هنا مع تاريخ التحديث."] },
    ],
  },
  en: {
    title: "Privacy policy", updated: UPDATED.en,
    intro: "This policy explains what data the Nazlawi website and app collect, how we use and protect it, and your rights. By using the service you agree to this policy.",
    sections: [
      { h: "Data we collect", p: [
        "Account data: name, email, phone number (optional) and preferred language. Passwords are stored hashed and can't be read by anyone.",
        "Store and product data added by providers: names, descriptions, prices, photos, video, WhatsApp number and opening hours.",
        "Location: only when you choose to set a location on the map (store, product or your address). Device location is used to center the map; we do not track you in the background.",
        "Camera and photos: only when you choose to upload a photo or video.",
        "Technical data: basic server logs (such as IP address and browser type) for security and abuse prevention.",
      ] },
      { h: "How we use data", p: ["To run accounts and stores and show them to visitors, send verification and password-reset emails, moderate content and protect the service from abuse. We don't sell your data or use it for targeted advertising."] },
      { h: "What is public", p: ["Published store and product details (name, photos, prices, phone/WhatsApp, map location) are visible to all visitors. Your email and password are never shown."] },
      { h: "Third parties", p: ["We only use service providers needed to run the platform: hosting, database and file storage (Vercel and related services), OpenStreetMap for map tiles, and an email provider. Tapping \"Order on WhatsApp\" opens WhatsApp, which has its own privacy policy."] },
      { h: "Retention and deletion", p: ["We keep your data while your account exists. You can delete your account from Settings, which deletes your data and files. Admins may permanently delete content that breaks the rules."] },
      { h: "Security", p: ["We use HTTPS, password hashing, role-based access and rate limiting. No system is 100% secure, but we take reasonable measures to protect your data."] },
      { h: "Children", p: ["The service is not directed to children under 13 and we don't knowingly collect their data."] },
      { h: "Your rights", p: ["You can view and edit your data in Settings, ask for it to be deleted, or contact us through the Contact page."] },
      { h: "Changes", p: ["We may update this policy; the new version will be posted here with its date."] },
    ],
  },
};

const terms: Record<Locale, LegalDoc> = {
  ar: {
    title: "شروط الاستخدام", updated: UPDATED.ar,
    intro: "باستخدامك موقع أو تطبيق «نزلاوي» فأنت توافق على الشروط التالية.",
    sections: [
      { h: "الخدمة", p: ["نزلاوي منصة تعرض متاجر ومقدمي خدمات في القرية وتتيح التواصل معهم. نحن وسيط عرض فقط ولسنا طرفاً في أي عملية بيع أو خدمة بين المستخدمين."] },
      { h: "الحسابات", p: ["أنت مسؤول عن صحة بياناتك وعن الحفاظ على سرية كلمة المرور وعن أي نشاط يتم من حسابك."] },
      { h: "مسؤولية مقدم الخدمة", p: ["مقدم الخدمة مسؤول عن صحة الأسعار والصور والأوصاف وتوفر المنتجات، وعن الالتزام بالقوانين المعمول بها. يُمنع نشر محتوى مخالف أو مضلل أو منتهك لحقوق الغير."] },
      { h: "المحتوى", p: ["تمنحنا ترخيصاً لعرض المحتوى الذي ترفعه على المنصة. يحق للإدارة مراجعة أي محتوى أو إخفاؤه أو حذفه نهائياً، وإيقاف الحسابات المخالفة."] },
      { h: "الترويج", p: ["طلبات الترويج تخضع لموافقة الإدارة، ويمكن رفضها أو إنهاؤها عند المخالفة."] },
      { h: "إخلاء المسؤولية", p: ["تُقدم الخدمة «كما هي». لا نضمن دقة المعلومات التي يضيفها المستخدمون ولا نتحمل مسؤولية أي تعامل يتم بينهم."] },
      { h: "التعديلات", p: ["قد نعدّل هذه الشروط، واستمرارك في الاستخدام بعد التعديل يعني موافقتك عليها."] },
      { h: "التواصل", p: ["لأي استفسار تواصل معنا عبر صفحة «تواصل معنا»."] },
    ],
  },
  en: {
    title: "Terms of use", updated: UPDATED.en,
    intro: "By using the Nazlawi website or app you agree to these terms.",
    sections: [
      { h: "The service", p: ["Nazlawi lists village stores and service providers and lets you contact them. We are a listing platform only and are not a party to any sale or service between users."] },
      { h: "Accounts", p: ["You are responsible for the accuracy of your details, keeping your password secret, and all activity on your account."] },
      { h: "Provider responsibilities", p: ["Providers are responsible for accurate prices, photos, descriptions and availability, and for complying with applicable law. Illegal, misleading or infringing content is not allowed."] },
      { h: "Content", p: ["You grant us a licence to display the content you upload on the platform. Admins may review, hide or permanently delete any content and suspend accounts that break these terms."] },
      { h: "Promotions", p: ["Promotion requests require admin approval and may be rejected or ended if they break the rules."] },
      { h: "Disclaimer", p: ["The service is provided \"as is\". We don't guarantee the accuracy of user-provided information and aren't liable for dealings between users."] },
      { h: "Changes", p: ["We may change these terms; continuing to use the service after a change means you accept it."] },
      { h: "Contact", p: ["For any questions, reach us through the Contact page."] },
    ],
  },
};
export const privacyDoc = (l: Locale) => privacy[l];
export const termsDoc = (l: Locale) => terms[l];
