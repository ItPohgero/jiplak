<div align="center">

# jiplak

**Skeleton loading otomatis, dijiplak dari tampilan asli aplikasi React kamu.**

Bungkus komponen. Jalankan satu perintah. Skeleton langsung sama persis.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-%E2%89%A518-149eca?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Sponsored by Lokio](https://img.shields.io/badge/sponsored%20by-Lokio-FF7A57)](https://lokio.link)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wahyuagusarifin)

[English](./README.md) · Bahasa Indonesia

</div>

---

## Kenapa jiplak?

Skeleton yang digambar manual cepat tidak sesuai lagi begitu layout berubah.
jiplak memotret komponen asli di browser dan menyimpan bentuknya. Kamu tidak
perlu menggambar skeleton lagi.

- **Tanpa menggambar.** Bentuk diambil dari DOM asli: teks, gambar, tombol.
- **Tanpa daftar route.** CLI menjelajah aplikasi lewat link-nya sendiri.
- **Responsif.** Dipotret di beberapa lebar layar, dipilih otomatis saat tampil.
- **Satu file YAML.** `jiplak.yaml`, cukup satu baris untuk mulai.
- **Mode gelap.** Mengikuti class `.dark` (konvensi Tailwind).
- **Runtime kecil.** Satu komponen React; alat pemotret tidak ikut ke browser.

## Daftar isi

- [Mulai cepat](#mulai-cepat)
- [Pertanyaan umum](#pertanyaan-umum)
- [Konfigurasi](#konfigurasi)
- [API](#api)
- [Cara kerja](#cara-kerja)
- [Sponsor](#sponsor)
- [Pembuat](#pembuat)
- [Lisensi](#lisensi)

## Mulai cepat

### 1. Install

```bash
npm install jiplak
# atau
bun add jiplak
```

### 2. Bungkus komponen yang menunggu data

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

### 3. Buat `jiplak.yaml` di root project

```yaml
url: http://localhost:3000
```

### 4. Jalankan aplikasi, lalu potret

```bash
npm run dev
```

Di terminal lain:

```bash
npx jiplak build
```

### 5. Import registry hasil build sekali saja

Import dari komponen client yang selalu dimuat, misalnya providers:

```tsx
'use client'
import './bones/registry'
```

Selesai. Saat `loading` bernilai `true`, skeleton tampil otomatis.

## Pertanyaan umum

<details>
<summary><b>Apakah setiap screen harus diberi <code>&lt;Skeleton&gt;</code>?</b></summary>

Tidak. Bungkus hanya bagian yang menunggu data, misalnya card, list, atau
tabel. Bagian statis seperti header dan menu tidak perlu. Satu screen bisa
punya beberapa `<Skeleton>` dengan `name` yang berbeda.

</details>

<details>
<summary><b>Apakah skeleton benar-benar dibuat otomatis?</b></summary>

Ya. `jiplak build` menjelajah aplikasi lewat link, menemukan setiap
`<Skeleton>`, lalu mencatat bentuknya. Tugas kamu hanya membungkus komponen.

</details>

<details>
<summary><b>Kapan harus menjalankan <code>jiplak build</code> lagi?</b></summary>

Setelah layout komponen yang dibungkus berubah, atau setelah menambah
`<Skeleton>` baru. Commit folder `src/bones/` supaya tim tidak perlu build
ulang.

</details>

<details>
<summary><b>Bagaimana sebelum build pertama?</b></summary>

Aplikasi berjalan normal. Komponen tampil seperti biasa, hanya tanpa
skeleton.

</details>

<details>
<summary><b>Komponen saya kosong tanpa data.</b></summary>

Beri contoh isi lewat `fixture`. jiplak memotret `fixture`, bukan komponen
aslinya:

```tsx
<Skeleton name="profil-card" loading={isLoading} fixture={<ProfilCard user={contohUser} />}>
  <ProfilCard user={data} />
</Skeleton>
```

</details>

<details>
<summary><b>Ada halaman yang tidak ketemu.</b></summary>

Penjelajah hanya menemukan halaman yang punya link dari halaman lain.
Tambahkan halaman tanpa link sebagai titik awal:

```yaml
routes:
  - /
  - /pengaturan/profil
```

</details>

<details>
<summary><b>Ada halaman yang tidak boleh dikunjungi.</b></summary>

Link logout dan file (pdf, gambar, csv) selalu dilewati. Untuk path lain:

```yaml
ignore:
  - /admin
```

</details>

<details>
<summary><b>Build berhenti di <code>maxPages</code>.</b></summary>

Penjelajah berhenti di 50 halaman supaya route dinamis (`/post/1`,
`/post/2`, …) tidak dijelajah tanpa akhir. Naikkan bila perlu:

```yaml
maxPages: 200
```

</details>

<details>
<summary><b>Halaman saya butuh login.</b></summary>

Kirim cookie sesi:

```yaml
cookies:
  - session=isi-cookie-kamu
```

</details>

<details>
<summary><b>Browser tidak ditemukan.</b></summary>

Pakai Chrome yang sudah terpasang:

```yaml
channel: chrome
```

Atau unduh Chromium sekali:

```bash
npx playwright install chromium
```

</details>

## Konfigurasi

Semua key opsional. Nilai di bawah adalah default. Key yang salah ketik
langsung ditolak dengan pesan error.

```yaml
# pemotretan
url: http://localhost:3000       # alamat aplikasi yang berjalan
routes: [/]                      # titik awal jelajah
ignore: []                       # path yang tidak dikunjungi
maxPages: 50                     # batas jumlah halaman
breakpoints: [375, 768, 1280]    # lebar layar yang dipotret
out: ./src/bones                 # folder hasil
wait: 800                        # jeda (ms) setelah halaman dimuat
channel: chrome                  # opsional: pakai Chrome yang terpasang
cookies: []                      # opsional: name=value

# tampilan (props di <Skeleton> menimpa nilai ini)
animate: pulse                   # pulse | shimmer | solid
color: "#ececec"                 # mode terang
darkColor: "#262626"             # mode gelap (class .dark)
shimmerColor: "#f7f7f7"
darkShimmerColor: "#323232"
speed: 1.6s
```

## API

### `<Skeleton>`

| Prop | Wajib | Fungsi |
| --- | --- | --- |
| `name` | ya | Nama unik: huruf, angka, `-`, `_` |
| `loading` | ya | `true` saat data belum datang |
| `fixture` | tidak | Contoh isi yang dipotret saat build |
| `animate`, `color`, `darkColor`, `shimmerColor`, `darkShimmerColor`, `speed` | tidak | Menimpa `jiplak.yaml` untuk skeleton ini saja |
| `options` | tidak | `{ exclude: ['.badge'] }` melewati elemen; `{ leafTags: ['section'] }` menjadikan satu tag satu kotak |
| `bones` | tidak | Data skeleton langsung, tanpa registry |
| `className` | tidak | Class untuk elemen pembungkus |

### Fungsi

| Fungsi | Kegunaan |
| --- | --- |
| `registerBones(map)` | Mendaftarkan bones per nama. Dipanggil oleh registry hasil build. |
| `configureJiplak(theme)` | Mengatur tampilan global. Dipanggil oleh registry dengan nilai dari YAML. |

### CLI

```bash
jiplak build [url] [--config jiplak.yaml]
```

## Cara kerja

1. `jiplak build` membuka aplikasi di browser tanpa tampilan, mulai dari
   `routes`, lalu mengikuti link di domain yang sama.
2. Di setiap lebar layar, setiap `<Skeleton>` dipotret. Teks, gambar, dan
   tombol dicatat sebagai kotak ("bones").
3. Kotak disimpan ke `src/bones/<name>.bones.json`, ditambah `registry.ts`
   yang memuatnya.
4. Saat `loading`, kotak digambar di atas komponen yang disembunyikan,
   memakai lebar layar yang paling cocok dengan lebar container.

## Pengembangan

```bash
bun install
bun test
bun run typecheck
bun run build
```

Issue dan pull request terbuka di
[GitHub](https://github.com/ItPohgero/jiplak/issues).

## Sponsor

<a href="https://lokio.link">
  <img src="https://raw.githubusercontent.com/ItPohgero/jiplak/main/.github/assets/lokio.png" alt="Lokio" width="72" />
</a>

jiplak disponsori oleh **[Lokio](https://lokio.link)**.

Suka jiplak? Dukung pengembangannya:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wahyuagusarifin)

## Pembuat

**Wahyu Agus Arifin** · [@ItPohgero](https://github.com/ItPohgero)

## Lisensi

[MIT](./LICENSE) © 2026 Wahyu Agus Arifin
