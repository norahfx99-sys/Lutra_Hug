// Built-in sample content. General, non-clinical, fictional: no medical claims,
// no real organisations, no real phone numbers.
export type Resource = {
  id: string;
  title: string;
  summary: string;
  topic: string;
  readMinutes: number;
  sections: { heading: string; body: string }[];
  source: { name: string; reviewedOn: string /* YYYY-MM-DD */ };
  sample: true;
};

export type ServiceKind = 'telemedicine' | 'center' | 'hotline';

export type Service = {
  id: string;
  name: string;
  kind: ServiceKind;
  summary: string;
  hours: string;
  area: string;
  howToReach: string;
  sample: true;
};

export const KIND_LABELS: Record<ServiceKind, string> = {
  telemedicine: 'Tư vấn từ xa',
  center: 'Trung tâm',
  hotline: 'Đường dây hỗ trợ',
};

const SRC = 'Nhóm biên tập Lutra Hug (mẫu)';

export const resources: Resource[] = [
  {
    id: 'res-morning-routine',
    title: 'Xây dựng nếp buổi sáng nhẹ nhàng',
    summary: 'Vài gợi ý để buổi sáng của cả nhà bớt vội và dễ đoán hơn.',
    topic: 'Thói quen hằng ngày',
    readMinutes: 3,
    sections: [
      {
        heading: 'Chuẩn bị từ tối hôm trước',
        body: 'Soạn sẵn cặp sách, quần áo và đồ dùng cần mang. Việc nhỏ này giúp buổi sáng bớt phải quyết định và bớt thúc giục nhau.',
      },
      {
        heading: 'Giữ trình tự quen thuộc',
        body: 'Một trình tự giống nhau mỗi ngày giúp trẻ biết điều gì sẽ đến tiếp theo. Bạn có thể dán một tờ danh sách việc cần làm bằng hình vẽ đơn giản.',
      },
      {
        heading: 'Chừa thời gian đệm',
        body: 'Thêm mười phút dự phòng cho những lúc không như dự định. Không cần hoàn hảo; mục tiêu là cả nhà bước ra cửa với tâm trạng ổn.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-09-12' },
    sample: true,
  },
  {
    id: 'res-bedtime-routine',
    title: 'Nếp buổi tối và giờ đi ngủ',
    summary:
      'Cách giữ giờ đi ngủ đều đặn mà không biến nó thành cuộc giằng co.',
    topic: 'Thói quen hằng ngày',
    readMinutes: 4,
    sections: [
      {
        heading: 'Báo trước giờ kết thúc',
        body: 'Nhắc trẻ trước vài lần rằng sắp đến giờ dọn đồ chơi và chuẩn bị đi ngủ. Việc được báo trước thường dễ chấp nhận hơn bị ngắt đột ngột.',
      },
      {
        heading: 'Những hoạt động yên tĩnh',
        body: 'Đọc truyện, nghe nhạc nhẹ hoặc trò chuyện về một điều vui trong ngày là những lựa chọn quen thuộc của nhiều gia đình.',
      },
      {
        heading: 'Điều chỉnh theo gia đình bạn',
        body: 'Mỗi nhà có nhịp sinh hoạt riêng. Hãy chọn những gì phù hợp và thử thay đổi dần dần.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-09-12' },
    sample: true,
  },
  {
    id: 'res-prepare-appointment',
    title: 'Chuẩn bị cho một buổi hẹn với chuyên gia',
    summary: 'Danh sách việc nên chuẩn bị để tận dụng thời gian của buổi hẹn.',
    topic: 'Chuẩn bị buổi hẹn',
    readMinutes: 4,
    sections: [
      {
        heading: 'Ghi lại câu hỏi trước',
        body: 'Viết ra những điều bạn muốn hỏi và những quan sát gần đây về con. Khi vào buổi hẹn, danh sách ngắn giúp bạn không bỏ sót ý quan trọng.',
      },
      {
        heading: 'Mang theo giấy tờ và hồ sơ cũ',
        body: 'Gom sổ khám, kết quả và các ghi chú cũ vào một chỗ. Nếu có thể, chụp lại để tiện tìm khi cần.',
      },
      {
        heading: 'Sau buổi hẹn',
        body: 'Ghi lại những điều đã trao đổi và việc cần làm tiếp theo ngay khi còn nhớ rõ. Bạn có thể ghi chi phí buổi hẹn vào mục Chi tiêu.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-09-18' },
    sample: true,
  },
  {
    id: 'res-questions-list',
    title: 'Cách đặt câu hỏi rõ ràng cho buổi tư vấn',
    summary: 'Mẹo diễn đạt để người tư vấn hiểu nhanh điều bạn đang lo.',
    topic: 'Chuẩn bị buổi hẹn',
    readMinutes: 3,
    sections: [
      {
        heading: 'Nêu bối cảnh ngắn gọn',
        body: 'Bắt đầu bằng một hai câu về tình huống: chuyện gì xảy ra, từ khi nào, xảy ra thường xuyên đến đâu.',
      },
      {
        heading: 'Hỏi từng việc một',
        body: 'Mỗi câu hỏi nên xoay quanh một vấn đề. Nếu có nhiều việc, hãy xếp thứ tự ưu tiên và hỏi việc quan trọng nhất trước.',
      },
      {
        heading: 'Xác nhận lại điều đã nghe',
        body: 'Nhắc lại bằng lời của bạn những gì vừa trao đổi để chắc rằng hai bên hiểu giống nhau.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-09-18' },
    sample: true,
  },
  {
    id: 'res-track-expenses',
    title: 'Theo dõi chi phí chăm sóc không quá phức tạp',
    summary: 'Một cách ghi chép đơn giản để biết tiền đi đâu mỗi tháng.',
    topic: 'Theo dõi chi phí',
    readMinutes: 4,
    sections: [
      {
        heading: 'Ghi ngay khi phát sinh',
        body: 'Ghi khoản chi vào ngày nó xảy ra, dù chỉ một dòng ngắn. Để dồn cuối tháng thường dễ quên và mất công hơn.',
      },
      {
        heading: 'Chia theo nhóm vừa phải',
        body: 'Vài nhóm lớn như khám, thuốc, học tập, đi lại là đủ. Quá nhiều nhóm sẽ khiến việc ghi chép nặng nề.',
      },
      {
        heading: 'Đặt ngân sách để tham khảo',
        body: 'Ngân sách là con số giúp bạn hình dung, không phải điểm số. Hãy điều chỉnh khi hoàn cảnh thay đổi.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-09-20' },
    sample: true,
  },
  {
    id: 'res-keep-receipts',
    title: 'Lưu hóa đơn và chứng từ gọn gàng',
    summary: 'Gợi ý sắp xếp giấy tờ để cần là tìm thấy.',
    topic: 'Theo dõi chi phí',
    readMinutes: 2,
    sections: [
      {
        heading: 'Một nơi cho tất cả',
        body: 'Chọn một cặp hồ sơ hoặc thư mục trong điện thoại để gom hóa đơn. Đặt tên theo ngày và nội dung để dễ tìm.',
      },
      {
        heading: 'Giữ bao lâu',
        body: 'Thời hạn lưu giữ tùy mục đích sử dụng của bạn. Nếu cần dùng cho việc chính thức, hãy hỏi đơn vị tiếp nhận về yêu cầu của họ.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-09-20' },
    sample: true,
  },
  {
    id: 'res-talk-to-school',
    title: 'Trao đổi với nhà trường một cách hiệu quả',
    summary: 'Gợi ý để cuộc trò chuyện với giáo viên mang tính hợp tác.',
    topic: 'Làm việc với nhà trường',
    readMinutes: 5,
    sections: [
      {
        heading: 'Hẹn trước và nêu mục đích',
        body: 'Gửi tin nhắn ngắn để hẹn thời gian và nói trước chủ đề. Giáo viên sẽ có thể chuẩn bị và buổi trao đổi tập trung hơn.',
      },
      {
        heading: 'Chia sẻ điều giúp ích cho con',
        body: 'Cho nhà trường biết những điều quen thuộc với con ở nhà: điều con thích, điều con thấy khó. Hai bên cùng nhìn một bức tranh sẽ dễ phối hợp.',
      },
      {
        heading: 'Thống nhất việc tiếp theo',
        body: 'Kết thúc bằng một hai việc cụ thể, ai làm và khi nào xem lại. Ghi lại để cùng đối chiếu.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-09-25' },
    sample: true,
  },
  {
    id: 'res-school-records',
    title: 'Giữ hồ sơ trao đổi với nhà trường',
    summary: 'Cách ghi lại các trao đổi để lần sau không phải kể lại từ đầu.',
    topic: 'Làm việc với nhà trường',
    readMinutes: 3,
    sections: [
      {
        heading: 'Ghi ngày và nội dung chính',
        body: 'Mỗi lần trao đổi, ghi ngày, người tham gia và điều đã thống nhất. Một ghi chú ngắn là đủ.',
      },
      {
        heading: 'Gửi lại tóm tắt',
        body: 'Có thể gửi một tin nhắn tóm tắt cho giáo viên để xác nhận. Việc này giúp tránh hiểu lầm.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-09-25' },
    sample: true,
  },
  {
    id: 'res-parent-self-care',
    title: 'Chăm sóc bản thân khi đang chăm sóc người khác',
    summary: 'Những điều nhỏ giúp bạn giữ sức trong những giai đoạn bận rộn.',
    topic: 'Chăm sóc bản thân',
    readMinutes: 4,
    sections: [
      {
        heading: 'Cho phép mình nghỉ',
        body: 'Nghỉ không phải là bỏ bê. Vài phút yên tĩnh trong ngày có thể giúp bạn quay lại với tâm thế tốt hơn.',
      },
      {
        heading: 'Nhờ và nhận sự giúp đỡ',
        body: 'Hãy nói cụ thể điều bạn cần: đón con hộ một buổi, nấu giúp một bữa. Lời nhờ rõ ràng thường dễ được đáp lại.',
      },
      {
        heading: 'Tìm người đồng hành',
        body: 'Trò chuyện với những phụ huynh có hoàn cảnh tương tự có thể giúp bạn bớt cảm giác một mình.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-10-02' },
    sample: true,
  },
  {
    id: 'res-family-time',
    title: 'Dành thời gian chất lượng cho cả nhà',
    summary: 'Những hoạt động đơn giản để cả gia đình gắn kết.',
    topic: 'Chăm sóc bản thân',
    readMinutes: 3,
    sections: [
      {
        heading: 'Nhỏ nhưng đều đặn',
        body: 'Một bữa ăn chung hay mười phút trò chuyện mỗi tối thường bền hơn một kế hoạch lớn ít khi thực hiện được.',
      },
      {
        heading: 'Để con chọn',
        body: 'Thỉnh thoảng hãy để con chọn hoạt động. Điều này cho con cảm giác được lắng nghe.',
      },
    ],
    source: { name: SRC, reviewedOn: '2026-10-02' },
    sample: true,
  },
];

export const services: Service[] = [
  {
    id: 'svc-tele-a',
    name: 'Tư vấn từ xa Ví Dụ A',
    kind: 'telemedicine',
    summary: 'Đơn vị minh họa cho hình thức trò chuyện video với chuyên viên.',
    hours: 'Giờ hành chính (mẫu)',
    area: 'Toàn quốc (mẫu)',
    howToReach: 'Đặt lịch qua ứng dụng của đơn vị (mẫu)',
    sample: true,
  },
  {
    id: 'svc-tele-b',
    name: 'Phòng tư vấn trực tuyến Ví Dụ B',
    kind: 'telemedicine',
    summary: 'Đơn vị minh họa cho tư vấn qua tin nhắn và cuộc gọi.',
    hours: 'Buổi tối các ngày trong tuần (mẫu)',
    area: 'Toàn quốc (mẫu)',
    howToReach: 'Đăng ký trên trang web của đơn vị (mẫu)',
    sample: true,
  },
  {
    id: 'svc-center-a',
    name: 'Trung tâm hỗ trợ gia đình Ví Dụ C',
    kind: 'center',
    summary: 'Đơn vị minh họa cho trung tâm có buổi gặp trực tiếp.',
    hours: 'Thứ Hai đến thứ Bảy (mẫu)',
    area: 'Thành phố mẫu 1',
    howToReach: 'Liên hệ quầy tiếp nhận của đơn vị (mẫu)',
    sample: true,
  },
  {
    id: 'svc-center-b',
    name: 'Câu lạc bộ phụ huynh Ví Dụ D',
    kind: 'center',
    summary: 'Đơn vị minh họa cho nhóm sinh hoạt định kỳ của phụ huynh.',
    hours: 'Cuối tuần (mẫu)',
    area: 'Thành phố mẫu 2',
    howToReach: 'Đăng ký tham gia qua biểu mẫu của đơn vị (mẫu)',
    sample: true,
  },
  {
    id: 'svc-hotline-a',
    name: 'Đường dây lắng nghe Ví Dụ E',
    kind: 'hotline',
    summary: 'Đơn vị minh họa cho đường dây trò chuyện không phán xét.',
    hours: 'Theo thông báo của đơn vị (mẫu)',
    area: 'Toàn quốc (mẫu)',
    howToReach: 'Số liên hệ do đơn vị công bố, chưa có trong dữ liệu mẫu',
    sample: true,
  },
  {
    id: 'svc-hotline-b',
    name: 'Đường dây hỏi đáp Ví Dụ F',
    kind: 'hotline',
    summary: 'Đơn vị minh họa cho đường dây giải đáp thông tin chung.',
    hours: 'Giờ hành chính (mẫu)',
    area: 'Toàn quốc (mẫu)',
    howToReach: 'Số liên hệ do đơn vị công bố, chưa có trong dữ liệu mẫu',
    sample: true,
  },
];

export const topics = Array.from(new Set(resources.map(r => r.topic)));

export const SAMPLE_LABEL = 'Nội dung mẫu';

export const sourceLine = (s: Resource['source']) =>
  `Nguồn: ${s.name} · Rà soát ngày ${s.reviewedOn
    .split('-')
    .reverse()
    .join('/')}`;
