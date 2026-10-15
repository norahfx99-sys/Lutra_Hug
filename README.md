# Lutra Hug

Ứng dụng miễn phí cho cha mẹ có con ADHD. Bản đầu tiên tập trung vào ghi chép chi phí chăm sóc: mỗi khoản chi gắn với một hoặc nhiều bé, có ngân sách chung của gia đình theo tháng và báo cáo.

Dữ liệu chỉ nằm trên điện thoại, được mã hoá. Không có tài khoản, không có server. Hai phụ huynh đồng bộ trực tiếp giữa hai máy (đang làm).

Mô tả sản phẩm đầy đủ: [PRODUCT_DESCRIPTION.md](PRODUCT_DESCRIPTION.md).

## Tình trạng

Đã có:

- Màn chào, hướng dẫn 3 bước, tạo gia đình, thêm bé
- Trang chủ, danh sách chi phí, thêm/sửa chi phí (chia cho nhiều bé), ngân sách tháng, báo cáo
- Lưu trữ SQLite mã hoá (SQLCipher)

Chưa có: đồng bộ giữa hai máy, cộng đồng, trợ lý AI.

## Cài đặt môi trường

Làm theo [hướng dẫn chính thức của React Native](https://reactnative.dev/docs/set-up-your-environment) (mục "React Native CLI", không dùng Expo). Phiên bản dự án đang dùng:

| Công cụ | Phiên bản |
|---|---|
| Node.js | 22.11 trở lên |
| JDK | 17 |
| Android SDK | Platform 37, Build-Tools 37.0.0 |
| Android NDK | 27.1.12297006 |
| Gradle | 9.4.1 (tự tải qua `gradlew`) |
| Ruby + Bundler | Ruby 2.6.10 trở lên (chỉ cần cho iOS) |
| Xcode + CocoaPods | chỉ cần cho iOS, chỉ chạy trên macOS |

Android:

1. Cài Android Studio, mở SDK Manager, cài các bản SDK/NDK ở bảng trên.
2. Đặt biến môi trường `ANDROID_HOME` trỏ tới thư mục SDK, thêm `platform-tools` vào `PATH` (để có `adb`).
3. Tạo một máy ảo (AVD) hoặc cắm điện thoại thật đã bật USB debugging. Kiểm tra bằng `adb devices`.

Lưu trữ dùng SQLCipher qua `op-sqlite` (bật trong `package.json`, khoá `"op-sqlite": { "sqlcipher": true }`). Không cần cài gì thêm, thư viện tự build kèm app.

## Chạy app

```sh
npm install
npm start          # Metro, để chạy riêng một terminal
npm run android    # terminal khác: build và cài lên máy ảo/điện thoại
```

Font nằm ở `assets/fonts` và đã được link sẵn vào `android/` và `ios/`. Chỉ khi thêm hoặc đổi font mới cần chạy lại `npx react-native-asset`.

iOS (chưa kiểm tra, cần macOS):

```sh
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

### Thử đồng bộ giữa hai máy (bản dev)

Bản debug dùng kết nối TCP qua `adb` thay cho đồng bộ gần thật. Cắm hai máy (máy ảo + điện thoại, hoặc hai điện thoại), lấy serial bằng `adb devices`, rồi chạy:

```sh
scripts/dev-sync-link.sh <serial-máy-mời> <serial-máy-tham-gia>
```

- Máy mời: máy đã có gia đình, bấm "Mời điện thoại thứ hai".
- Máy tham gia: máy chưa có gia đình, ở màn chào chọn "Tham gia bằng đồng bộ gần".

Trên Windows chạy script này bằng Git Bash.

## Kiểm tra

```sh
npx tsc --noEmit
npm test
npm run lint
```

## Cấu trúc

```text
src/
  app/        điều hướng, màn chào, khởi động
  features/   mỗi tính năng một thư mục (care-cost, family, home, ...)
  shared/     theme, motion, component dùng chung
design/       file thiết kế .pen và ghi chú bàn giao
```
