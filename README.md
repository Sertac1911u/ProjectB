# ProjectB

Kişisel finans ve bütçe analiz aracı. Yol haritası: [docs/ROADMAP.md](docs/ROADMAP.md).

## Yapı

```
apps/web        Next.js web uygulaması
packages/core   Web ve mobilin ortak kullandığı mantık (para birimi, tutar hesapları)
packages/db     Drizzle veritabanı şeması ve bağlantısı (Supabase PostgreSQL)
```

## Teknolojiler

TypeScript, Next.js, Tailwind CSS, next-intl (TR/EN), Supabase, Drizzle ORM,
Zod, Vitest, pnpm + Turborepo.

## Bilgisayarında çalıştırma

Gerekenler: [Node.js 22+](https://nodejs.org) ve pnpm (`npm install -g pnpm`).

### 1. Supabase projesi (bir kez)

1. <https://supabase.com> adresinde ücretsiz hesap aç ve **New project** ile bir proje oluştur.
   Veritabanı şifresini bir yere not et.
2. **Authentication > URL Configuration** sayfasında:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** `http://localhost:3000/**` ekle.
3. Proje sayfasının üstündeki **Connect** düğmesinden şu bilgileri al:
   - Proje adresi (`https://xxxx.supabase.co`) ve **publishable key** (`sb_publishable_...`).
   - **Session pooler** bağlantı adresi (`postgresql://postgres.xxxx:[YOUR-PASSWORD]@...`).
     `[YOUR-PASSWORD]` yerine not ettiğin veritabanı şifresini yaz.

### 2. Projeyi çalıştırma

```bash
git clone https://github.com/Sertac1911u/ProjectB.git
cd ProjectB
pnpm install
```

`apps/web/.env.example` dosyasını kopyalayıp adını `apps/web/.env.local` yap ve
Supabase'den aldığın bilgileri doldur. Bu dosya gizlidir, GitHub'a gönderilmez.

```bash
pnpm db:migrate   # veritabanı tablolarını oluşturur (şema değiştikçe tekrar çalıştır)
pnpm dev
```

Sonra tarayıcıda <http://localhost:3000> adresini aç.

`pnpm dev` her sayfayı ilk açılışta derler ve kodu optimize etmeden çalıştırır; ilk
tıklamalar birkaç saniye sürebilir. Uygulamanın gerçek hızını görmek için `pnpm start`
kullan (her kod değişikliğinden sonra yeniden derler). Proje klasörünün OneDrive gibi
eşitlenen bir klasörde olmaması da geliştirme modunu belirgin şekilde hızlandırır.

## Komutlar

| Komut            | Ne yapar                              |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Geliştirme sunucusunu başlatır        |
| `pnpm build`     | Üretim için derler                    |
| `pnpm lint`      | Kod kurallarını kontrol eder (ESLint) |
| `pnpm typecheck` | Tip kontrolü yapar                    |
| `pnpm test`      | Testleri çalıştırır                   |
| `pnpm format`    | Kodu biçimlendirir (Prettier)         |

## Çeviriler

Arayüz metinleri `apps/web/messages/tr.json` ve `en.json` dosyalarında.
İki dosyada da aynı anahtarlar olmalı; bir test bunu kontrol ediyor.

## Veritabanı testleri

`packages/db` altındaki RLS testleri gerçek bir Supabase veritabanı ister ve
`TEST_DATABASE_URL` tanımlı değilse atlanır. Docker ile yerel Supabase'de çalıştırmak için:

```bash
pnpm exec supabase start
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm --filter @projectb/db exec drizzle-kit migrate
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test
```
