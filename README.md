# Deeon Signal Cloud

Deeon Signal Cloud, biyolojik insan sinyallerini sanal ortamda görüntüleyip değiştirmeye yönelik, Termux ve Node.js ile çalışan hafif bir prototip bulut sunucu uygulamasıdır.

## Özellikler

- Kullanıcı kayıt ve giriş
- Bearer token tabanlı oturum doğrulama
- Erişim izni talebi ve onay akışı
- Sinyal titreşimi güncelleme ve dalga görselleştirme
- Termux üzerinde çalışmaya uygun hafif yapıda sunucu

## Gereksinimler

- Node.js 14+ (tercihen güncel sürüm)
- npm
- Termux veya benzeri Linux tabanlı ortam

## Kurulum

### Windows / masaüstü

```bash
cd C:\Users\ASUS\Deeon
npm install
npm start
```

Tarayıcıda açın:

```text
http://127.0.0.1:3000
```

### Termux

```bash
pkg update && pkg upgrade
pkg install nodejs git
cd ~/Deeon
npm install
npm start
```

Aynı ağdaki başka cihazdan erişmek için cihaz IP'nizi kullanın:

```text
http://<telefon-ip>:3000
```

## Test

```bash
npm test
```

## Yapı

- Sunucu: Node.js + HTTP sunucusu
- Ön yüz: HTML, CSS, JavaScript
- Veri: hafif bellek tabanlı durum yönetimi

## Not

Bu proje bir prototip ve araştırma platformu niteliğindedir. Gerçek üretim ortamında şifreleme, veritabanı, loglama ve daha güçlü güvenlik katmanları eklenmelidir.
