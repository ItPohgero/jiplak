# jiplak

Skeleton loading otomatis, dijiplak dari tampilan asli aplikasi kamu.

Kamu tidak perlu menggambar skeleton sendiri. Bungkus komponen dengan
`<Skeleton>`, jalankan satu perintah, dan jiplak membuat skeleton yang
bentuknya sama persis dengan komponen itu.

Saat ini jiplak baru mendukung React.

---

## Cara pakai (3 langkah)

### 1. Bungkus komponen yang menunggu data

```tsx
import { Skeleton } from 'jiplak/react'

function Profil() {
  const { data, isLoading } = useProfil()

  return (
    <Skeleton name="profil-card" loading={isLoading}>
      <ProfilCard user={data} />
    </Skeleton>
  )
}
```

- `name`: nama unik untuk skeleton ini (huruf, angka, `-`, `_`).
- `loading`: `true` saat data belum datang.

### 2. Buat `jiplak.yaml` di root project

```yaml
url: http://localhost:3000
```

Satu baris saja. jiplak mulai dari halaman `/`, lalu mengikuti semua link di
aplikasi kamu dan mencari `<Skeleton>` sendiri. Route tidak perlu ditulis.

### 3. Jalankan aplikasi, lalu jalankan jiplak

```bash
bun dev
```

Di terminal lain:

```bash
bunx jiplak build
```

Hasilnya ada di folder `src/bones/`. Import sekali di komponen client yang
selalu dimuat (misalnya `providers.tsx`):

```tsx
'use client'
import '@/bones/registry'
```

Selesai. Saat `loading` bernilai `true`, skeleton tampil otomatis.

---

## Pertanyaan umum

**Apakah setiap screen harus diberi `<Skeleton>`?**

Tidak. Bungkus hanya bagian yang menunggu data dari API, misalnya card,
list, atau tabel. Bagian statis seperti header dan menu tidak perlu.
Satu screen bisa punya beberapa `<Skeleton>` dengan `name` yang berbeda.

**Apakah skeleton dibuat otomatis?**

Ya. `jiplak build` menjelajah aplikasi kamu lewat link, menemukan setiap
`<Skeleton>`, lalu membuat bentuknya. Yang kamu lakukan hanya membungkus
komponen dengan `<Skeleton>`.

**Ada halaman yang tidak ketemu. Kenapa?**

jiplak hanya menemukan halaman yang punya link dari halaman lain. Halaman
tanpa link (misalnya hanya dibuka lewat tombol atau redirect) tambahkan
sebagai titik awal:

```yaml
routes:
  - /
  - /pengaturan/profil
```

**Ada halaman yang tidak boleh dikunjungi?**

Link logout dan file (pdf, gambar, csv) selalu dilewati. Untuk path lain:

```yaml
ignore:
  - /admin
```

**Build berhenti dengan pesan `maxPages`.**

jiplak berhenti di 50 halaman supaya halaman dinamis (`/event/1`,
`/event/2`, ...) tidak dijelajah tanpa akhir. Naikkan bila perlu:

```yaml
maxPages: 200
```

**Kapan harus menjalankan `jiplak build` lagi?**

Setiap kali tampilan komponen berubah, atau setelah menambah `<Skeleton>`
baru. Commit folder `src/bones/` ke Git supaya tim tidak perlu build ulang.

**Bagaimana kalau belum menjalankan build?**

Aplikasi tetap berjalan normal. Komponen asli tampil seperti biasa, hanya
tanpa skeleton.

**Komponen saya kosong kalau tidak ada data. Bagaimana?**

Beri contoh data lewat `fixture`. jiplak memotret `fixture` saat build,
bukan komponen aslinya:

```tsx
<Skeleton name="profil-card" loading={isLoading} fixture={<ProfilCard user={contohUser} />}>
  <ProfilCard user={data} />
</Skeleton>
```

**Halaman saya butuh login. Bagaimana?**

Tambahkan cookie sesi di `jiplak.yaml`:

```yaml
cookies:
  - session=isi-cookie-kamu
```

**Muncul error browser tidak ditemukan.**

Pakai Chrome yang sudah terpasang:

```yaml
channel: chrome
```

Atau unduh Chromium sekali:

```bash
bunx playwright install chromium
```

---

## Instalasi di project Lokio

jiplak belum dipublikasikan ke npm. Pasang dari folder lokal:

```bash
cd apps/jiplak && bun install && bun run build
```

```bash
cd apps/cln-lokio && bun add ../jiplak
```

---

## Semua opsi `jiplak.yaml`

Semua opsi boleh dilewati. Nilai di bawah adalah default.

```yaml
url: http://localhost:3000       # alamat aplikasi yang sedang berjalan
routes: [/]                      # titik awal jelajah
ignore: []                       # path yang tidak dikunjungi
maxPages: 50                     # batas jumlah halaman
breakpoints: [375, 768, 1280]    # lebar layar yang dipotret
out: ./src/bones                 # folder hasil
wait: 800                        # jeda (ms) setelah halaman dimuat
channel: chrome                  # opsional: pakai Chrome yang terpasang
cookies: []                      # opsional: cookie login, format name=value

animate: pulse                   # pulse | shimmer | solid
color: "#ececec"                 # warna skeleton mode terang
darkColor: "#262626"             # warna skeleton mode gelap (class .dark)
shimmerColor: "#f7f7f7"
darkShimmerColor: "#323232"
speed: 1.6s
```

Key yang salah ketik langsung ditolak dengan pesan error.

## Props `<Skeleton>`

| Prop | Wajib | Fungsi |
| --- | --- | --- |
| `name` | ya | Nama unik skeleton |
| `loading` | ya | `true` saat data belum datang |
| `fixture` | tidak | Contoh tampilan yang dipotret saat build |
| `animate`, `color`, `darkColor`, ... | tidak | Menimpa nilai dari `jiplak.yaml` untuk skeleton ini saja |
| `options` | tidak | `{ exclude: ['.badge'] }` untuk melewati elemen tertentu, `{ leafTags: ['section'] }` untuk menjadikan satu tag satu kotak |
| `bones` | tidak | Data skeleton langsung, tanpa registry |

## Cara kerja singkat

1. `jiplak build` membuka aplikasi di browser tanpa tampilan, mulai dari
   `routes`, lalu mengikuti link ke halaman lain di domain yang sama.
2. Setiap `<Skeleton>` di halaman dipotret: posisi teks, gambar, dan tombol
   dicatat sebagai kotak.
3. Kotak disimpan ke `src/bones/<name>.bones.json`.
4. Saat `loading`, kotak itu digambar di atas komponen yang disembunyikan.

## Pengembangan

```bash
bun install
bun test
bun run typecheck
bun run build
```
