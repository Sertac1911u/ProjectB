# Yol haritası

Kişisel finans ve bütçe analiz aracı. Önce web, sonra mobil (React Native + Expo).
Web ve mobil aynı Supabase veritabanını kullanır.

## İlk sürüm kapsamı

**Hesaplar:** Nakit, banka, kredi kartı ve birikim/yatırım. Her hesabın kendi para birimi var.

- Kredi kartı: limit, ekstre kesim günü, son ödeme günü, taksitli alışveriş
  (taksitler aylara bölünür ve ilgili ekstreye düşer).
- Hesaplar arası transfer (kart borcu ödemesi, nakit çekme) gelir/gider sayılmaz.

**İşlemler:**

- Gelir, gider ve transfer.
- Hazır ve düzenlenebilir kategoriler, alt kategori desteği (Ulaşım > Yakıt).
- Etiketler, arama ve filtre (tarih, hesap, kategori, etiket, tutar aralığı).
- Tekrarlayan işlemler (maaş, kira, abonelik) zamanı gelince otomatik eklenir.

**Döviz:** Kullanıcının ana para birimi (varsayılan TL). Kurlar her gün TCMB'den
çekilir, raporlar ana para birimine çevrilir.

**Bütçe ve hedefler:** Kategori bazlı aylık limit, ilerleme ve aşım uyarısı
(uygulama içi). Birikim hedefleri: hedef tutar, isteğe bağlı bitiş tarihi.

**Panel ve raporlar:** Kategori dağılımı, aylık gelir-gider trendi, zaman içinde net varlık.

**Diğer:** E-posta + şifre ile giriş, Türkçe/İngilizce arayüz, açık tema.

### Sonraya kalanlar

Mobil uygulama, Google/Apple ile giriş, ortak bütçe, bildirimler, koyu tema,
CSV dışa aktarma, fiş fotoğrafı, gelecek nakit akışı tahmini.

## Aşamalar

- [x] **0. Altyapı:** monorepo, Next.js, Tailwind, çoklu dil, Drizzle, CI.
- [x] **1. Supabase ve giriş:** kayıt, giriş, şifre sıfırlama, profil (dil, ana para birimi).
- [ ] **2. Hesaplar, işlemler, kategoriler:** etiketler, arama ve filtre dahil.
- [ ] **3. Kredi kartı:** ekstre ve taksitler.
- [ ] **4. Döviz kurları ve çevrim.**
- [ ] **5. Tekrarlayan işlemler.**
- [ ] **6. Bütçeler ve birikim hedefleri.**
- [ ] **7. Panel ve raporlar.**

## Teknik kararlar

- **Tutarlar** her zaman para biriminin en küçük biriminde tam sayı olarak saklanır
  (12,50 TL → `1250`). Ondalık sayı kullanılmaz. Bkz. `packages/core/src/money.ts`.
- **Veri erişimi:** Her tabloda Supabase Row Level Security açık; kullanıcı yalnızca
  kendi satırlarını görür. Tablolar ileride ortak bütçeye geçişe uygun tasarlanır.
- **Veritabanı şeması** `packages/db/src/schema` altında Drizzle ile tanımlı; migration'lar
  `pnpm db:generate` ile üretilip `pnpm db:migrate` ile uygulanır. Web sunucusu sorguları
  `asUser()` ile kullanıcının yetkisiyle çalıştırır, böylece RLS kuralları web ve mobilde aynıdır.
- **Ortak kod** `packages/` altında: web ve mobil aynı tipleri, doğrulamayı ve
  hesaplama mantığını kullanır.
