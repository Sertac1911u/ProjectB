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

Mobil uygulama (widget dahil), Google/Apple ile giriş, ortak bütçe, bildirimler, koyu tema,
CSV/Excel içe ve dışa aktarma, fiş fotoğrafı, harcama anomalileri, ay sonu değerlendirmesi.
Şimdilik yapılmayacaklar: kural motoru, yapay zekâ koçu, yalnızca yerel veri saklama.

### Yayına çıkmadan önce

- Kendi e-posta servisimizi (SMTP, örn. Resend) bağlamak: Supabase'in yerleşik servisi yalnızca
  proje ekibine ve saatte birkaç e-posta gönderiyor.
- Doğrulama ve şifre sıfırlama e-postalarını Türkçe/İngilizce şablonlarla göndermek.

## Aşamalar

- [x] **0. Altyapı:** monorepo, Next.js, Tailwind, çoklu dil, Drizzle, CI.
- [x] **1. Supabase ve giriş:** kayıt, giriş, şifre sıfırlama, profil (dil, ana para birimi).
- [x] **2. Hesaplar, işlemler, kategoriler:** etiketler, arama ve filtre dahil.
- [x] **3. Kredi kartı:** ekstre ve taksitler.
- [x] **4. Döviz kurları ve çevrim.**
- [x] **5. Tekrarlayan işlemler.**
- [x] **6. Bütçeler ve birikim hedefleri.**
- [x] **7. Panel ve raporlar.**

### İkinci sürüm: nakit akışına dayalı planlama

Uygulamanın farkı geleceğe bakması: "bugünden maaşa kadar" ne olacağını gösterir.
Basit ve detaylı görünüm vardır; basit görünüm sadece temel bölümleri gösterir.

- [x] **8. Nakit akışı motoru:** maaşa kadar günlük güvenli harcama, en düşük bakiye,
      ödeme takvimi ve nakit açığı uyarısı, "harcamadan önce dene", basit/detaylı görünüm.
- [ ] **9. Sanal zarflar ve "Bunu alırsam?":** seyrek ödemeler için ayrılan para güvenli
      harcamadan düşer; bir alışverişin hedeflere etkisi.
- [ ] **10. Dayanıklılık göstergesi ve hedef tahmini:** gelir kesilirse kaç ay idare edilir;
      hedeflere ulaşma tarihi ve senaryolar.
- [ ] **11. Borç stratejisi ve gerçek net servet:** kredi hesapları, borç kapatma sıraları,
      altın ve döviz varlıkları.

## Teknik kararlar

- **Tutarlar** her zaman para biriminin en küçük biriminde tam sayı olarak saklanır
  (12,50 TL → `1250`). Ondalık sayı kullanılmaz. Bkz. `packages/core/src/money.ts`.
- **Veri erişimi:** Her tabloda Supabase Row Level Security açık; kullanıcı yalnızca
  kendi satırlarını görür. Tablolar ileride ortak bütçeye geçişe uygun tasarlanır.
- **Veritabanı şeması** `packages/db/src/schema` altında Drizzle ile tanımlı; migration'lar
  `pnpm db:generate` ile üretilip `pnpm db:migrate` ile uygulanır. Web sunucusu sorguları
  `asUser()` ile kullanıcının yetkisiyle çalıştırır, böylece RLS kuralları web ve mobilde aynıdır.
- **Döviz kurları** TCMB'nin günlük bülteninden (döviz alış) alınır ve ortak `exchange_rates`
  tablosunda saklanır. Kurlar bugüne ait değilse yenisi sayfa yanıtından sonra arka planda
  çekilir; TCMB'ye ulaşılamazsa son bilinen kur kullanılır.
- **Ortak kod** `packages/` altında: web ve mobil aynı tipleri, doğrulamayı ve
  hesaplama mantığını kullanır.
- **Bütçe limitleri** ay bazında saklanır: bir limit kendi ayından, aynı kategorinin sonraki
  kaydına kadar geçerlidir; değişiklik o aydan itibaren uygulanır, geçmiş aylar korunur.
  Harcamalar `expense_entries` görünümünden gelir, yani taksitler ödendikleri aya sayılır.
- **Raporlar** seçilen dönemi tam aylar olarak alır; tek aylık dönemler günlük, daha uzunlar aylık
  gösterilir. Net varlık geçmişi hesapların açılış bakiyesi ve işlemlerinden hesaplanır, dövizler
  güncel kurla çevrilir. Grafikler harici kütüphane olmadan SVG ile çizilir.
- **Nakit akışı tahmini** (`packages/core/src/cashflow.ts`) harcanabilir hesapların bakiyesinden
  başlar; tekrarlayan işlemleri ve kart ekstrelerini (son ödeme gününde tamamı ödenir varsayımıyla)
  günlere yerleştirir. Maaş günü, harcanabilir hesaba gelen en büyük düzenli gelirdir. Maaştan
  önceki en düşük bakiye güvenli harcama tutarıdır.
