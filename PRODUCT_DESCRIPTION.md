# Lutra Hug — Mô tả sản phẩm

## Trạng thái tài liệu

- Loại tài liệu: Mô tả sản phẩm
- Trạng thái: Bản nháp
- Nền tảng: Ứng dụng di động
- Đối tượng chính: Phụ huynh có con mắc ADHD
- Tài liệu nguồn: [Google Docs — Mô tả Lutra Hug](https://docs.google.com/document/d/1dNxeCPX9aCIr4fiur_fzs9fzFia8BLs_hDQ_T5Bh6IM/edit?tab=t.0)
- Thiết kế bổ sung: [Chi tiết màn hình, luồng thao tác và chart](docs/SCREEN_DESIGN.md).
- Đối chiếu mã nguồn: [Phạm vi tái sử dụng MoneyLover và các phần cần bổ sung](docs/FEATURE_AUDIT.md).

## Tổng quan

Lutra Hug là ứng dụng di động miễn phí hỗ trợ phụ huynh có con mắc ADHD quản lý chi phí chăm sóc, tiếp cận cộng đồng và tìm kiếm thông tin hỗ trợ phù hợp.

Sản phẩm tập trung vào ba nhu cầu chính:

- Theo dõi chi phí chăm sóc và can thiệp ADHD một cách trực quan.
- Kết nối phụ huynh với cộng đồng, tình nguyện viên, mentor và các nguồn lực hỗ trợ.
- Cung cấp Trợ lý AI để giải đáp câu hỏi thường gặp, hướng dẫn hỗ trợ tại nhà và điều hướng tới dịch vụ y tế phù hợp.

Lutra Hug không thay thế chuyên gia y tế và không được sử dụng để chẩn đoán, kê đơn hoặc tự ý thay đổi phương pháp điều trị.

## Vấn đề cần giải quyết

Quá trình chăm sóc trẻ mắc ADHD thường liên quan đến nhiều nhóm chi phí như khám và trị liệu, thuốc, giáo dục đặc biệt và đi lại. Các khoản chi phân tán khiến phụ huynh khó theo dõi tổng chi phí, kiểm soát ngân sách hoặc nhận biết nhóm chi phí đang tăng.

Bên cạnh áp lực tài chính, phụ huynh có thể gặp khó khăn khi tìm kiếm kinh nghiệm thực tế, tài liệu đáng tin cậy, người hỗ trợ hoặc dịch vụ y tế phù hợp. Thông tin trên Internet thường phân mảnh và khó đánh giá chất lượng.

Lutra Hug tập hợp các nhu cầu trên trong một ứng dụng duy nhất với trải nghiệm đơn giản và dễ tiếp cận.

## Mục tiêu sản phẩm

- Giúp phụ huynh hiểu rõ tiền đang được sử dụng cho những nhu cầu chăm sóc nào.
- Giảm thao tác thủ công khi ghi chép và phân loại chi phí.
- Tạo không gian để phụ huynh đặt câu hỏi, chia sẻ kinh nghiệm và tài liệu.
- Giúp người dùng tiếp cận nguồn thông tin và dịch vụ đã được kiểm duyệt.
- Cung cấp hỗ trợ thông tin liên tục nhưng vẫn duy trì ranh giới an toàn y tế.

## Người dùng

### Phụ huynh

Người dùng chính của ứng dụng. Phụ huynh có thể quản lý ngân sách và chi phí, tham gia cộng đồng, tìm nguồn lực hỗ trợ và sử dụng Trợ lý AI.

### Volunteer và Mentor

Những người có hồ sơ phù hợp, chẳng hạn sinh viên tâm lý học, tình nguyện viên hoặc mentor, có thể cung cấp hỗ trợ trong phạm vi chuyên môn và vai trò đã được xác minh.

### Người kiểm duyệt

Người chịu trách nhiệm quản lý nội dung cộng đồng, xác minh nguồn lực, xử lý báo cáo và bảo đảm các hồ sơ hỗ trợ được trình bày đúng vai trò.

## Các khu vực chức năng

### HOME

HOME cung cấp cái nhìn nhanh về tình hình chi tiêu và các lối tắt quan trọng.

Nội dung chính:

- Tổng chi phí chăm sóc trong tháng.
- Ngân sách còn lại trong tháng.
- Biểu đồ chi phí theo nhóm.
- Danh sách các khoản chi gần đây.
- Quick Access tới Add Expense, COMMUNITY và Trợ lý AI.
- Community & Healthcare Highlights từ các nguồn đã được chọn lọc.

Thông tin trên HOME phải được tính từ cùng dữ liệu với CARE COST để tránh chênh lệch số liệu.

### CARE COST

CARE COST giúp phụ huynh ghi nhận, phân loại và phân tích các khoản chi liên quan đến quá trình chăm sóc trẻ.

#### Add Expense

Mỗi khoản chi gồm:

- Amount.
- Date.
- Description.
- Category.
- Note.

Người dùng chọn một trong các category có sẵn:

- Medical & Therapy — khám và trị liệu.
- Medication — thuốc.
- Special Education — giáo dục đặc biệt.
- Transportation — đi lại.
- Other — chi phí phát sinh khác.

Danh sách category cố định giúp người dùng không phải tự xây dựng hệ thống phân loại. Trong phạm vi hiện tại, tính năng này không yêu cầu AI tự suy đoán category từ nội dung mô tả.

#### Monthly Budget

Người dùng cần có khả năng thiết lập và chỉnh sửa ngân sách tháng. Dữ liệu này được dùng để tính ngân sách còn lại trên HOME.

#### Expense Dashboard

Dashboard hiển thị:

- Tổng chi phí theo tháng.
- Chi phí theo từng category.
- Biểu đồ biến động chi phí.
- Tỷ trọng của từng nhóm chi phí.
- So sánh tháng hiện tại với tháng trước.

#### Quy tắc dữ liệu chi phí

- Amount phải lớn hơn không.
- Date phải là ngày hợp lệ.
- Description và Category là thông tin bắt buộc.
- Note là thông tin tùy chọn.
- Việc sửa hoặc xóa khoản chi phải cập nhật lại HOME và Dashboard.
- Cách làm tròn, định dạng tiền tệ và múi giờ phải nhất quán trên toàn ứng dụng.

Các ví dụ trong tài liệu nguồn sử dụng VND. Đơn vị tiền tệ chính thức của sản phẩm cần được xác nhận trước khi triển khai.

### COMMUNITY

COMMUNITY là không gian trao đổi dành cho phụ huynh và các thành viên hỗ trợ.

Người dùng có thể:

- Đăng bài.
- Đặt câu hỏi.
- Chia sẻ kinh nghiệm.
- Bình luận.
- Chia sẻ liên kết tới tài liệu.
- Báo cáo nội dung không phù hợp.
- Chặn tài khoản gây ảnh hưởng tiêu cực.

Người dùng chỉ được sửa hoặc xóa nội dung do chính mình tạo. Người kiểm duyệt có thể ẩn nội dung, xử lý báo cáo và hạn chế tài khoản vi phạm.

#### Volunteer / Mentor Connection

Khu vực này giúp phụ huynh tìm kiếm và gửi yêu cầu kết nối tới:

- Psychology students.
- Volunteers.
- Mentors.

Ứng dụng phải phân biệt rõ vai trò, phạm vi hỗ trợ và trạng thái xác minh của từng hồ sơ. Việc xuất hiện trong danh sách không được diễn đạt như một chứng nhận y khoa nếu người đó không có chuyên môn tương ứng.

Chat riêng và nhắn tin thời gian thực không thuộc phạm vi tối thiểu. Giai đoạn đầu chỉ cần hồ sơ và yêu cầu kết nối.

### Trợ lý AI điều hướng

Trợ lý AI hỗ trợ người dùng trong ba nhóm tác vụ:

#### Sơ cứu thông tin

- Trả lời các câu hỏi thường gặp về ADHD.
- Giải thích thông tin phổ thông về triệu chứng và thuốc dựa trên nguồn đã được duyệt.
- Chỉ ra nguồn tham khảo để người dùng có thể kiểm tra lại.

#### Hỗ trợ tại nhà

- Hướng dẫn các bước hỗ trợ hành vi tại nhà.
- Cung cấp kịch bản giao tiếp và ổn định tình huống phù hợp với nội dung đã được chuyên gia phê duyệt.
- Khuyến nghị liên hệ chuyên gia khi tình huống vượt khỏi phạm vi tự hỗ trợ.

#### Điều hướng y tế

- Xác định loại hỗ trợ mà người dùng đang tìm kiếm.
- Gợi ý dịch vụ Telemedicine đã được xác minh.
- Giải thích rõ tiêu chí và nguồn của đề xuất.

#### Ranh giới an toàn

- Không chẩn đoán ADHD hoặc tình trạng y tế khác.
- Không kê đơn, đề xuất liều dùng hoặc yêu cầu người dùng thay đổi thuốc.
- Không trình bày câu trả lời AI như kết luận của bác sĩ.
- Khi phát hiện nguy cơ gây hại, tự gây hại hoặc tình huống khẩn cấp, ứng dụng phải chuyển sang hướng dẫn cố định và thông tin liên hệ phù hợp với khu vực phát hành.
- Nội dung y tế phải được kiểm duyệt bởi người có chuyên môn trước khi sử dụng làm nguồn cho AI.
- Khóa truy cập dịch vụ AI chỉ được lưu ở backend, không được nhúng trong ứng dụng di động.
- Việc lưu lịch sử hội thoại phải có mục đích, thời hạn lưu giữ và sự đồng ý rõ ràng của người dùng.

## Benchmarking

Benchmarking là tính năng tùy chọn, không bắt buộc trong phiên bản đầu tiên.

Tính năng dự kiến cho phép người dùng:

- So sánh tổng chi phí tháng với mức trung bình ẩn danh của cộng đồng.
- So sánh từng category với mức trung bình tương ứng.
- Nhận biết khoản chi có mức chênh lệch đáng chú ý.

Benchmarking chỉ nên được triển khai khi có đủ dữ liệu và cơ chế bảo vệ quyền riêng tư. Kết quả phải được tổng hợp ở backend, không để lộ dữ liệu cá nhân hoặc nhóm có quá ít thành viên. Giao diện phải nêu rõ kỳ dữ liệu, cỡ mẫu và phương pháp tính.

## Luồng sử dụng chính

### Quản lý chi phí

`Thiết lập ngân sách → Add Expense → Chọn category → Lưu khoản chi → Xem Dashboard → HOME được cập nhật`

### Tham gia cộng đồng

`Mở COMMUNITY → Xem hoặc tạo bài viết → Bình luận hoặc chia sẻ tài liệu → Báo cáo nội dung nếu cần`

### Kết nối hỗ trợ

`Mở danh sách Volunteer / Mentor → Xem hồ sơ và trạng thái xác minh → Gửi yêu cầu kết nối`

### Sử dụng Trợ lý AI

`Chọn nhu cầu → Gửi câu hỏi → Nhận câu trả lời có nguồn → Xem hướng dẫn hoặc dịch vụ phù hợp → Liên hệ chuyên gia khi cần`

## Dữ liệu và quyền riêng tư

Ứng dụng có thể xử lý dữ liệu tài chính và dữ liệu liên quan đến sức khỏe gia đình. Chỉ thu thập dữ liệu thực sự cần thiết cho chức năng đã mô tả.

Yêu cầu tối thiểu:

- Dữ liệu chi phí của một tài khoản không được truy cập bởi tài khoản khác.
- Quyền tạo, sửa và xóa nội dung phải được kiểm tra ở backend.
- Người dùng có thể yêu cầu xóa tài khoản và dữ liệu cá nhân.
- Dữ liệu nhạy cảm phải được bảo vệ khi truyền và khi lưu trữ.
- Không sử dụng nội dung trò chuyện AI để huấn luyện hoặc phân tích ngoài mục đích đã thông báo mà không có sự đồng ý.
- Nguồn y tế, hồ sơ mentor và dịch vụ Telemedicine phải có trạng thái xác minh và thời điểm kiểm tra gần nhất.

## Yêu cầu trải nghiệm

- Giao diện dễ đọc, ưu tiên thao tác ngắn và ngôn ngữ rõ ràng.
- Có trạng thái loading, empty và error cho các màn hình lấy dữ liệu.
- Hỗ trợ cỡ chữ lớn và trình đọc màn hình.
- Không biểu đạt thông tin tài chính chỉ bằng màu sắc.
- Nội dung quan trọng phải sử dụng nhãn văn bản rõ ràng thay vì chỉ dùng biểu tượng.
- Ứng dụng phải xử lý được mạng yếu hoặc mất kết nối mà không làm mất dữ liệu người dùng vừa nhập.

## Phạm vi chưa bao gồm

- Chẩn đoán hoặc điều trị ADHD bằng AI.
- Kê đơn hoặc thay đổi liều thuốc.
- Chat riêng và nhắn tin thời gian thực.
- Thanh toán trực tiếp trong ứng dụng.
- Mạng xã hội với cơ chế theo dõi hoặc gợi ý người dùng phức tạp.
- Benchmarking trước khi đáp ứng điều kiện về dữ liệu và ẩn danh.

## Chỉ số cần theo dõi

Chưa đặt mục tiêu định lượng vì tài liệu nguồn không cung cấp baseline hoặc mục tiêu kinh doanh. Sản phẩm nên theo dõi:

- Tỷ lệ người dùng thiết lập ngân sách và ghi nhận khoản chi đầu tiên.
- Mức độ quay lại để cập nhật chi phí theo tháng.
- Tỷ lệ bài viết nhận được phản hồi hữu ích.
- Số lượng và thời gian xử lý báo cáo cộng đồng.
- Mức độ hữu ích do người dùng đánh giá cho câu trả lời AI.
- Tỷ lệ câu trả lời AI có nguồn hợp lệ.
- Số lần hệ thống an toàn phải chuyển người dùng sang hỗ trợ chuyên môn hoặc khẩn cấp.

## Các quyết định cần xác nhận

- Quốc gia và khu vực phát hành.
- Ngôn ngữ giao diện.
- Đơn vị tiền tệ.
- Phương thức đăng nhập.
- Một tài khoản quản lý một trẻ hay nhiều trẻ.
- Tiêu chí xác minh Volunteer và Mentor.
- Danh sách nguồn y tế và dịch vụ Telemedicine được phép sử dụng.
- Danh bạ hỗ trợ khẩn cấp áp dụng cho khu vực phát hành.
- Chính sách lưu giữ và xóa lịch sử trò chuyện AI.
- Người hoặc tổ chức chịu trách nhiệm kiểm duyệt nội dung y tế và cộng đồng.

## Tài liệu tham khảo về an toàn nội dung

- [CDC — ADHD in Children](https://www.cdc.gov/adhd/about/index.html)
- [WHO — Ethics and governance of artificial intelligence for health](https://www.who.int/publications/i/item/9789240037403)
