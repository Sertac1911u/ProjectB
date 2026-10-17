// Applies pending migrations and explains common connection problems.
// drizzle-kit's own `migrate` command exits without printing the cause.
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

const url = process.env.DATABASE_URL;
if (!url) {
  fail("DATABASE_URL tanımlı değil. apps/web/.env.local dosyasını kontrol et.");
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  fail(
    "DATABASE_URL geçerli bir adres değil. Şifrede @ : / # ? % gibi karakterler varsa " +
      "Supabase'de şifreyi yeniden oluştur (Project Settings > Database).",
  );
}

if (url.includes("[YOUR-PASSWORD]")) {
  fail(
    "DATABASE_URL içindeki [YOUR-PASSWORD] kısmını köşeli parantezler dahil silip şifreni yaz.",
  );
}

const hints = {
  ENOTFOUND: `"${host}" adresi bulunamadı.`,
  ETIMEDOUT: `"${host}" adresine bağlanılamadı (zaman aşımı).`,
  ECONNREFUSED: `"${host}" bağlantıyı reddetti.`,
  ENETUNREACH: `"${host}" adresine ağ üzerinden ulaşılamıyor.`,
  "28P01": "Veritabanı şifresi hatalı.",
  28000: "Kullanıcı adı veya şifre hatalı.",
  XX000:
    "Supabase bağlantıyı reddetti; kullanıcı adının postgres.<proje-kimliği> biçiminde olduğunu kontrol et.",
};
const directHint = host?.startsWith("db.")
  ? '\n  Bu "Direct connection" adresi; çoğu ev internetinde çalışmaz. Supabase\'deki Connect penceresinden "Session pooler" adresini kullan.'
  : "";

const client = postgres(url, {
  max: 1,
  connect_timeout: 15,
  onnotice: () => {},
});
try {
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  console.log("\n✓ Veritabanı güncel, tüm migration'lar uygulandı.\n");
} catch (error) {
  const cause = error?.cause ?? error;
  const code = cause?.code ?? cause?.errno;
  console.error(`\n✗ Migration başarısız: ${cause?.message ?? cause}`);
  if (hints[code]) console.error(`  ${hints[code]}${directHint}`);
  else if (directHint) console.error(directHint.trimStart());
  console.error(
    "  Hiçbir değişiklik kaydedilmedi; sorunu düzeltip tekrar çalıştırabilirsin.\n",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
