# Elle test senaryosu

Bu senaryo uygulamanın her bölümünü sırayla dener. Beklenen değerler aynı veriler uygulamaya
girilerek alındı. Hesaplar **17 Ekim 2026** gününe göre yapıldı; başka bir gün denersen
"maaşa kaç gün var", günlük limit, zarf payı ve tahmini tarihler değişir.

**(kur)** ile işaretli değerler TCMB'nin o günkü dolar kuruna göre değişir (burada 1 USD = 41,8723 TL).

## 0. Hazırlık

1. `git pull`, `pnpm db:migrate`, `pnpm build`, `pnpm start`
2. Temiz başlangıç: Ayarlar → **Hesabı sil** (veya **Verileri sıfırla**), sonra yeniden kayıt ol ve giriş yap.
3. Panelde "Uygulamayı nasıl kullanmak istersin?" → **Detaylı**.
4. Ayarlar: Görünen ad, dil Türkçe, ana para birimi TRY → Kaydet. Döviz kurları kartında USD, EUR, GBP görünmeli.

Menüde 10 bölüm olmalı: Panel, Nakit akışı, Hesaplar, İşlemler, Tekrarlayan, Bütçeler, Hedefler,
Borç planı, Raporlar, Ayarlar.

## 1. Hesaplar (Hesaplar → Yeni hesap)

| Ad              | Tür               | Ayrıntı                                                                                 |
| --------------- | ----------------- | --------------------------------------------------------------------------------------- |
| Maaş Hesabı     | Banka hesabı      | Açılış 10.000 · Harcanabilir ✓ (kendiliğinden işaretli)                                 |
| Cüzdan          | Nakit             | Açılış 1.500 · Harcanabilir ✓                                                           |
| Birikim         | Birikim / yatırım | Açılış 40.000 · Harcanabilir ✗ (kendiliğinden boş)                                      |
| Dolar Hesabı    | Banka hesabı      | Para birimi USD · Açılış 500 · **Harcanabilir işaretini kaldır**                        |
| Bonus Kart      | Kredi kartı       | Açılış borcu boş · Kesim günü 10 · Son ödeme 20 · Limit 50.000 · Asgari %20 · Faiz 4,25 |
| İhtiyaç Kredisi | Kredi / borç      | Kalan borç 90.000 · Taksit 4.500 · Faiz 3,05                                            |
| Kardeşime borç  | Kredi / borç      | Kalan borç 10.000 · Taksit 1.000 · Faiz boş                                             |
| Altın           | Altın             | Birim gram · Miktar 15 · Birim fiyat 4.200                                              |

Kontrol:

- Kredi kartında, kredide ve altında "Harcanabilir para" kutusu çıkmamalı.
- Kredi ve altında açılış bakiyesi alanı olmamalı.
- Altın: Bakiye ₺63.000,00, alt satırda "15 gram × ₺4.200,00 · Fiyat 17 Ekim 2026".
- İhtiyaç Kredisi sayfası: Kalan borç ₺90.000,00, Aylık taksit ₺4.500,00, faiz %3,05.

## 2. Alt kategori

Ayarlar → Kategorileri yönet → Yeni kategori: Ad **Kahve**, Tür Gider, Üst kategori **Yeme-içme**.

## 3. Tekrarlayan işlemler (Tekrarlayan → Yeni tekrarlayan işlem)

| Not              | Tür      | Hesap                 | Tutar  | Kategori             | Başlangıç  |
| ---------------- | -------- | --------------------- | ------ | -------------------- | ---------- |
| Maaş             | Gelir    | Maaş Hesabı           | 55.000 | Maaş                 | 15.08.2026 |
| Kira             | Gider    | Maaş Hesabı           | 18.000 | Konut › Kira         | 05.08.2026 |
| İnternet         | Gider    | Maaş Hesabı           | 500    | Faturalar › İnternet | 22.08.2026 |
| Netflix          | Gider    | Bonus Kart            | 229,99 | Abonelikler          | 28.08.2026 |
| Birikime aktarım | Transfer | Maaş Hesabı → Birikim | 5.000  | —                    | 16.11.2026 |

Hepsi "Her ay", bitiş "Bitmesin".

**Kredi taksiti:** Hesaplar → İhtiyaç Kredisi → **Aylık ödemeyi ekle**. Tür Transfer olmalı ve
Alan hesap İhtiyaç Kredisi, tutar 4.500,00 dolu gelmeli. Gönderen: Maaş Hesabı, başlangıç
25.10.2026, Not: Kredi taksiti.

Kontrol: Geçmiş tarihliler kendiliğinden oluşur. İşlemler listesinde "Tekrarlayan" etiketiyle
görünmeleri gerekenler:

- Maaş: 15 Ağu, 15 Eyl, 15 Eki
- Kira: 5 Ağu, 5 Eyl, 5 Eki
- İnternet: 22 Ağu, 22 Eyl
- Netflix: 28 Ağu, 28 Eyl

Tekrarlayan listesinde "Sonraki" tarihleri:

- İnternet: 22 Ekim
- Kredi taksiti: 25 Ekim
- Netflix: 28 Ekim
- Kira: 5 Kasım
- Maaş: 15 Kasım
- Birikime aktarım: 16 Kasım

## 4. İşlemler (İşlemler → Yeni işlem; "Kaydet ve yeni ekle" hızlandırır)

| Tarih      | Tür      | Hesap                    | Tutar  | Kategori               | Not / etiket                            |
| ---------- | -------- | ------------------------ | ------ | ---------------------- | --------------------------------------- |
| 12.08.2026 | Gider    | Maaş Hesabı              | 6.500  | Market                 |                                         |
| 20.08.2026 | Gider    | Maaş Hesabı              | 900    | Faturalar › Elektrik   |                                         |
| 25.08.2026 | Gider    | Maaş Hesabı              | 2.200  | Yeme-içme              | Doğum günü yemeği · etiket **dışarıda** |
| 14.09.2026 | Gider    | Maaş Hesabı              | 7.200  | Market                 |                                         |
| 16.09.2026 | Transfer | Maaş Hesabı → Birikim    | 10.000 |                        |                                         |
| 18.09.2026 | Gider    | Maaş Hesabı              | 2.500  | Ulaşım › Yakıt         |                                         |
| 20.09.2026 | Transfer | Maaş Hesabı → Bonus Kart | 229,99 |                        | Kart ödemesi                            |
| 02.10.2026 | Gider    | Dolar Hesabı             | 20     | Abonelikler            | Yazılım aboneliği                       |
| 03.10.2026 | Gider    | Bonus Kart               | 6.000  | Alışveriş › Elektronik | Kulaklık · **Taksit 3**                 |
| 07.10.2026 | Gider    | Bonus Kart               | 1.200  | Market                 |                                         |
| 08.10.2026 | Gider    | Maaş Hesabı              | 3.000  | Market                 |                                         |
| 10.10.2026 | Transfer | Maaş Hesabı → Cüzdan     | 1.000  |                        | Nakit çekme                             |
| 12.10.2026 | Gider    | Bonus Kart               | 850    | Yeme-içme              | Akşam yemeği · etiket **dışarıda**      |
| 14.10.2026 | Gider    | Cüzdan                   | 350    | Ulaşım › Taksi         |                                         |
| 16.10.2026 | Gider    | Cüzdan                   | 120    | Yeme-içme › Kahve      | etiket **kahve**                        |

Kulaklık girerken taksit seçince "3 × ₺2.000,00" önizlemesi görünmeli.

**Hesaplar sayfası:**

- Bakiyeler:

  | Hesap           | Bakiye                         |
  | --------------- | ------------------------------ |
  | Maaş Hesabı     | ₺86.470,01                     |
  | Cüzdan          | ₺2.030,00                      |
  | Birikim         | ₺50.000,00                     |
  | Dolar Hesabı    | $480,00 (≈ ₺20.098,70 **kur**) |
  | Bonus Kart      | −₺8.279,99                     |
  | İhtiyaç Kredisi | −₺90.000,00                    |
  | Kardeşime borç  | −₺10.000,00                    |
  | Altın           | ₺63.000,00                     |

- Üstte: Varlıklar ₺221.598,71 (**kur**), Borçlar −₺108.279,99, Net servet ₺113.318,72 (**kur**), "Borç planı" düğmesi

**Arama ve filtre (İşlemler):**

- Ara "dışarıda": iki işlem (Akşam yemeği 850, Doğum günü yemeği 2.200).
- Filtre Kategori "Yeme-içme": üç işlem (Kahve alt kategorisi de gelir).
- Etiket "kahve": bir işlem.
- Düzenle: 8 Ekim Market'e not ekle ("Haftalık market"), kaydet, notun listede göründüğünü kontrol et.
- Sil: 100 TL'lik deneme gideri ekle, açıp sil.

## 5. Kredi kartı (Hesaplar → Bonus Kart)

- **Kart özeti:**
  - Toplam borç ₺8.279,99
  - Kullanılabilir limit ₺41.720,01
- **10 Ekim 2026 ekstresi** (dönem 11 Eyl – 10 Eki):

  | Kalem        | Tutar     |
  | ------------ | --------- |
  | Ekstre borcu | ₺3.429,99 |
  | Asgari ödeme | ₺686,00   |
  | Kalan        | ₺3.429,99 |

  Son ödeme 20 Ekim 2026 · "3 gün kaldı".

- **Ekstre satırları:**
  - Kart ödemesi +229,99
  - Netflix 229,99
  - Kulaklık 1/3. taksit 2.000,00
  - Market 1.200,00
- **Güncel dönem** (10 Kasım'da kesilecek):
  - Kulaklık 2/3. taksit 2.000,00
  - Akşam yemeği 850,00
- **Gelecek taksitler:**
  - 10 Kasım: ₺2.000,00
  - 10 Aralık: ₺2.000,00
- **Önceki ekstreler:** 10 Eki ve 10 Eyl.

## 6. Bütçeler (Bütçeler → Bütçe ekle, Ekim 2026)

| Kategori  | Limit | Beklenen                                                                   |
| --------- | ----- | -------------------------------------------------------------------------- |
| Market    | 8.000 | ₺4.200,00 / ₺8.000,00 · Kalan ₺3.800,00 · Ay sonuna kadar günde ₺253,33    |
| Yeme-içme | 1.200 | ₺970,00 / ₺1.200,00 · **Limite yaklaşıldı** (sarı) · Alt kategoriler dahil |
| Ulaşım    | 300   | ₺350,00 / ₺300,00 · **Limit aşıldı · ₺50,00 aşıldı** (kırmızı)             |
| Alışveriş | 1.500 | ₺2.000,00 / ₺1.500,00 · **₺500,00 aşıldı** (kulaklığın Ekim taksiti)       |

**Ekim bütçe toplamı:**

| Toplam bütçe | Harcanan  | Kalan     |
| ------------ | --------- | --------- |
| ₺11.000,00   | ₺7.520,00 | ₺3.480,00 |

"Bütçesi olmayan harcamalar": Konut ₺18.000,00 ve Abonelikler ≈ ₺837,45 (**kur**).

**Önceki ay (Eylül):**

- "Bu ay için bütçe yok" yazmalı; limitler geçmiş aylara uygulanmaz.
- Bütçesiz harcamalar:

  | Kategori    | Tutar   |
  | ----------- | ------- |
  | Konut       | ₺18.000 |
  | Market      | ₺7.200  |
  | Ulaşım      | ₺2.500  |
  | Faturalar   | ₺500    |
  | Abonelikler | ₺229,99 |

**Sonraki ay (Kasım):** Ekim'de konan limitler görünmeli.

## 7. Hedefler (Hedefler → Yeni hedef)

**Acil durum fonu:**

- Ayarlar: Takip şekli "Birikim bakiyesini izle", Hedef 150.000, tarih boş. Para birimi kutusu kilitli olmalı.
- Beklenen: ₺50.000,00 / ₺150.000,00 %33.
- Tahmin: "Ortalama aylık birikimine göre: ayda ₺26.620,01".

  | Senaryo                          | Tarih         |
  | -------------------------------- | ------------- |
  | Mevcut düzenle                   | 9 Şubat 2027  |
  | Ayda ₺1.000 fazla biriktirirsen  | 5 Şubat 2027  |
  | Beklenmedik ₺15.000 gider olursa | 26 Şubat 2027 |

**Yaz tatili:**

- Ayarlar: Takip şekli "Elle", Hedef 45.000, tarih 30.06.2027. Sonra Katkılar'dan **Ekle 5.000**.
- Beklenen: ₺5.000,00 / ₺45.000,00 %11, "30 Haziran 2027 tarihine yetişmek için ayda ₺4.444,45".
- Tahmin: "Son katkılarına göre: ayda ₺5.000,00".

  | Senaryo                          | Tarih           | Sonuç                |
  | -------------------------------- | --------------- | -------------------- |
  | Mevcut düzenle                   | 18 Haziran 2027 | Hedef tarihe yetişir |
  | Ayda ₺1.000 fazla biriktirirsen  | 8 Mayıs 2027    | Hedef tarihe yetişir |
  | Beklenmedik ₺15.000 gider olursa | 17 Eylül 2027   | Hedef tarihten sonra |

- Ek deneme: **Çek 1.000** ekle (₺4.000'e düşer), sonra bu satırı çöp kutusuyla sil.

Hedefler listesinde her hedefin altında "Bu hızla …" tarihi görünmeli.

## 8. Nakit akışı

**Panel ve Nakit akışı (zarf eklemeden önce):**

- Özet:
  - Maaşa 29 gün var · **Günde ₺2.140,34** güvenle harcayabilirsin
  - Maaşa kadar toplam ₺62.070,02
  - Şu an kullanılabilir ₺88.500,01
  - En düşük bakiye 5 Kasım 2026 tarihinde ₺62.070,02
- Yaklaşan ödemeler:

  | Tarih    | Kalem                         | Tutar       | Sonra      |
  | -------- | ----------------------------- | ----------- | ---------- |
  | 20 Ekim  | Bonus Kart kart ödemesi       | −₺3.429,99  | ₺85.070,02 |
  | 22 Ekim  | İnternet                      | −₺500,00    | ₺84.570,02 |
  | 25 Ekim  | Kredi taksiti                 | −₺4.500,00  | ₺80.070,02 |
  | 5 Kasım  | Kira                          | −₺18.000,00 | ₺62.070,02 |
  | 15 Kasım | Maaş (Maaş günü, yeşil satır) | +₺55.000,00 |            |

**Nakit akışı sayfasındaki ödeme takviminde ayrıca:**

- 16 Kasım: Birikime aktarım −₺5.000,00
- 20 Kasım: Bonus Kart kart ödemesi −₺3.079,99 (850 + 2.000 taksit + 229,99 Netflix)

"Hesaba katılan hesaplar" yalnızca Maaş Hesabı ve Cüzdan olmalı. Diğerleri "Hesaba katılmayanlar"
altında görünmeli.

**Zarf:** Zarf ekle → Ne için "Kasko", Tutar 14.400, Ödeme tarihi 17.04.2027, Tekrar "Her yıl".

- Formda "Her ay ₺2.400,00 ayır" görünmeli.
- Kaydedince:
  - Günde ₺2.063,95
  - Maaşa kadar toplam ₺59.854,64
  - "Zarflara ayrılan: ₺2.215,38"

**Bunu alırsam ne olur?**

- **25.000, hesaptan:**
  - "Bu alışveriş maaşa kadar olan bütçene sığıyor."
  - Günlük limit ₺2.063,95 → ₺1.201,88
  - Maaştan önceki bakiye ₺59.854,64 → ₺34.854,64
  - Hedeflerine etkisi: iki hedef için de "yaklaşık 29 gün gecikir"
- **70.000, hesaptan:**
  - "Alırsan bakiye 5 Kasım 2026 tarihinde eksiye düşer."
  - Bakiye −₺10.145,36
- **24.000, "Bonus Kart kartıyla", 12 taksit:**
  - "sığıyor"
  - Günlük limit değişmez
  - "Kart ödemelerine eklenecek taksitler": 20 Kasım 2026'dan itibaren her ay ₺2.000,00
- Hiçbiri kaydedilmez; ödeme takvimi değişmemeli.

## 9. Dayanıklılık (panelde "Gelirin kesilse ~… ay" satırına tıkla)

- Başlık: **Güçlü** · "yaklaşık 6,5 ay idare edersin" (**kur**)
- Nedenler:
  - Hesaplarındaki para ≈ ₺213.318,72 (**kur**)
  - Kart borçları ₺8.279,99
  - Son 2 ayın ortalama harcaması ₺28.379,99
  - Kredi taksitlerin ayda ₺4.500,00
  - Ayda ortalama ₺26.620,01 biriktiriyorsun
  - Düzenli ödemeler ve zarflar ayda ₺25.629,99 (yaklaşık 8,3 ay)
  - Geçen ay sonundan bu yana rezervin ₺24.950,00 arttı
- Senaryolar:
  - Gelirin %20 azalırsa: "Yine de ayda ₺11.120,01 biriktirirsin."
  - Beklenmedik ₺15.000 gider: yaklaşık 6 ay (**kur**)
- Düzenli ödemeler listesi:

  | Kalem         | Aylık   |
  | ------------- | ------- |
  | Kira          | ₺18.000 |
  | Kredi taksiti | ₺4.500  |
  | İnternet      | ₺500    |
  | Netflix       | ₺229,99 |
  | Zarflar       | ₺2.400  |

## 10. Borç planı

**Borç listesi:**

| Borç            | Kalan      | Aylık faiz        | Asgari / taksit |
| --------------- | ---------- | ----------------- | --------------- |
| Bonus Kart      | ₺8.279,99  | %4,25             | ₺1.656,00       |
| İhtiyaç Kredisi | ₺90.000,00 | %3,05             | ₺4.500,00       |
| Kardeşime borç  | ₺10.000,00 | "faiz girilmemiş" | ₺1.000,00       |

"Ayda borçlara ayırabileceğin" kutusu ₺7.156,00 olarak gelmeli.

**Bu bütçeyle:**

- İki strateji de "21 ayda biter · 15 Temmuz 2028".
- Toplam faiz:

  | Strateji              | Toplam faiz                            |
  | --------------------- | -------------------------------------- |
  | En küçük borç önce    | ₺37.220,66 ("₺243,45 daha fazla faiz") |
  | En yüksek faizli önce | ₺36.977,21                             |

- "Ayda ₺1.000,00 ek ödeme yaparsan 3 ay erken biter, ₺6.517,30 daha az faiz ödersin."
- İlk ödeme 15 Kasım 2026 (maaş günü).

**Bütçe 10.000 → Karşılaştır:**

- 14 ayda biter · 15 Aralık 2027.
- Toplam faiz:

  | Strateji              | Toplam faiz |
  | --------------------- | ----------- |
  | En küçük borç önce    | ₺24.123,68  |
  | En yüksek faizli önce | ₺23.123,05  |

- Kapanma sırası, en küçük borç önce:
  1. Bonus Kart
  2. Kardeşime borç (15 Şub 2027)
  3. İhtiyaç Kredisi
- Kapanma sırası, en yüksek faizli önce:
  1. Bonus Kart
  2. Kardeşime borç (15 Ağu 2027)
  3. İhtiyaç Kredisi
- Hedef tarih 30.06.2027 gir → "Ayda ₺… ayırman gerekir." satırı çıkmalı.

## 11. Raporlar

**Son 3 ay:**

- Özet kartları:

  | Gelir       | Gider               | Birikim oranı |
  | ----------- | ------------------- | ------------- |
  | ₺165.000,00 | ≈ ₺83.117 (**kur**) | %50           |

- Kategori dağılımı:

  | Kategori    | Pay | Tutar     |
  | ----------- | --- | --------- |
  | Konut       | %65 | ₺54.000   |
  | Market      | %22 | ₺17.900   |
  | Yeme-içme   |     | ₺3.170    |
  | Ulaşım      |     | ₺2.850    |
  | Alışveriş   |     | ₺2.000    |
  | Faturalar   |     | ₺1.900    |
  | Abonelikler |     | (**kur**) |

- Grafik çubuklarının üzerine gelince ay ayrıntısı çıkmalı.
- Konut'a tıklayınca Kira alt kategorisi açılmalı; "İşlemleri gör" filtrelenmiş listeye götürmeli.
- Gelir sekmesi: Maaş %100.

**Bu ay:** günlük çubuklar (31 gün).

**Net varlık grafiği ve "Tablo olarak göster":** tablolar açılmalı.

## 12. Değiştirerek dene

- **Kart borcunu öde:** Bonus Kart → "Borcu öde" → Gönderen Maaş Hesabı, tutar 3.429,99 dolu gelmeli, kaydet.
  - Ekstre "Kalan ₺0,00 · Tamamı ödendi" olmalı.
  - Panelde 20 Ekim kart ödemesi listeden kalkmalı.
  - Günlük limit **değişmemeli**: ödeme zaten planlıydı.
- **Basit görünüm:** Ayarlar → Görünüm Basit → Kaydet.
  - Menü: Panel, Nakit akışı, Hesaplar, İşlemler, Hedefler, Ayarlar.
  - Panelde net varlık, bütçe uyarıları ve grafikler olmamalı.
  - Yeni işlem formunda Etiketler alanı olmamalı.
  - Sonra Detaylı'ya geri dön.
- **İngilizce:** sol alttan EN → "29 days to payday", tutarlar "₺2,063.95" biçiminde olmalı.
- **Telefon:** tarayıcı penceresini daralt; yatay kaydırma olmamalı.
- **Sonunda:** Ayarlar → Verileri sıfırla → panel boş, basit/detaylı sorusu yeniden çıkmalı.

Farklı bir değer görürsen o ekranın görüntüsünü ve hangi adımda olduğunu yaz.
