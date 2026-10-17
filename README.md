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

```bash
git clone https://github.com/Sertac1911u/ProjectB.git
cd ProjectB
pnpm install
pnpm dev
```

Sonra tarayıcıda <http://localhost:3000> adresini aç.

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
