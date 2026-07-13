# 📘 YTÜ İYS Takip Paneli

YTÜ İngilizce Yeterlik Sınavı (İYS) hazırlığını tek bir panelden takip etmek için
tasarlanmış, **tek kullanıcılı yerel web uygulaması**. Grammar konuları, soru tipleri
ve günlük görevler birbirine bağlı şekilde izlenir; PDF notlar ve testler her konunun
kendi klasöründe, gerçek dosya sisteminde saklanır.

## Kurulum & Çalıştırma

```bash
npm install
npm start
```

Ardından tarayıcıdan **http://localhost:4173** adresini aç.

> Geliştirme için otomatik yeniden başlatma: `npm run dev`
> Farklı port: `PORT=5000 npm start`

## Özellikler

### 📊 Dashboard
- Grammar ve Soru Tipleri durum dağılımı (🔴/🟡/🟢)
- Genel ilerleme yüzdesi ("24 konudan 9'u pekişti")
- Bugünün görevleri özeti
- Son çözülen 5 test ve sonuçları

### 📚 Grammar & 🧩 Soru Tipleri
İkisi de aynı dinamik "konu penceresi" bileşenini kullanır. Her konuda:
- **3 durumlu takip:** 🔴 Çalışılmadı · 🟡 Çalışılıyor · 🟢 Pekişti
- **Notlar / Testler:** tarih damgalı PDF yükleme, listeleme, tarayıcıda görüntüleme, silme
- **Test Sonuçları:** doğru/yanlış + tarih; mini ilerleme grafiği
- **Kişisel not alanı** (serbest metin)

Konu listeleri **tamamen dinamiktir**:
- "+ Yeni Konu Ekle" her zaman görünür (kod değişikliği gerektirmez)
- Konular yeniden adlandırılabilir, silinebilir
- **Sürükle-bırak** ile sıralanabilir

İlk açılışta spesifikasyondaki varsayılan (seed) konular otomatik yüklenir;
hepsi düzenlenebilir/silinebilir.

### ✅ Günlük Görevler
- Ekle / tamamla / sil
- Görev opsiyonel olarak bir Grammar veya Soru Tipi konusuna **bağlanabilir**
  (bağlantıya tıklayınca ilgili pencere açılır)
- Görevler tarih bazlı arşivlenir (silinmez)
- 🔥 **Streak sayacı:** kaç gün üst üste çalışıldığını gösterir

## Veri & Dosya Organizasyonu

Tüm veri **yerel dosya sisteminde** tutulur (tarayıcı `localStorage`'a güvenilmez):

```
data/db.json                                     # durumlar, sonuçlar, görevler
uploads/<bölüm>/<konu-slug>_<id>/notlar/*.pdf    # tarih damgalı PDF'ler
uploads/<bölüm>/<konu-slug>_<id>/testler/*.pdf
```

PDF adları otomatik tarih eklenerek kaydedilir, örn:
`essay_test_2026-07-13_*.pdf`

`data/` ve `uploads/` klasörleri `.gitignore`'dadır — kişisel içerik versiyonlanmaz.

## Teknik

- **Backend:** Node.js + Express, dosya tabanlı JSON deposu (atomik yazma), PDF için `multer`
- **Frontend:** derleme adımı olmayan sade JavaScript SPA (build/bundler gerekmez)
- Karmaşık auth yok — tek kullanıcı (Tuna)

## Kapsam Dışı (şimdilik)
Bildirim/hatırlatma, çoklu kullanıcı paylaşımı, otomatik PDF içerik analizi (OCR).
