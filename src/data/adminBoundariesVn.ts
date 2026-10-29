import { AdminLevel } from '../types/trip';

export interface AdministrativeBoundary {
  name: string;
  shortName: string;
  level: AdminLevel;
  latitude: number;
  longitude: number;
  aliases: string[];
}

export const ADMIN_BOUNDARIES_VN: AdministrativeBoundary[] = [
  // TP. Hồ Chí Minh
  {
    name: 'Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    shortName: 'Quận 1',
    level: 'district',
    latitude: 10.7769,
    longitude: 106.7009,
    aliases: ['ben nghe', 'quan 1', 'q1', 'district 1', 'sai gon', 'tp.hcm'],
  },
  {
    name: 'Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    shortName: 'Quận 3',
    level: 'district',
    latitude: 10.7844,
    longitude: 106.6845,
    aliases: ['quan 3', 'q3', 'district 3'],
  },
  {
    name: 'Phường 12, Quận 4, TP. Hồ Chí Minh',
    shortName: 'Quận 4',
    level: 'district',
    latitude: 10.7644,
    longitude: 106.7073,
    aliases: ['quan 4', 'q4'],
  },
  {
    name: 'Phường 11, Quận 5, TP. Hồ Chí Minh',
    shortName: 'Quận 5',
    level: 'district',
    latitude: 10.7554,
    longitude: 106.6644,
    aliases: ['quan 5', 'q5', 'cho lon'],
  },
  {
    name: 'Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
    shortName: 'Quận 7',
    level: 'district',
    latitude: 10.7328,
    longitude: 106.7118,
    aliases: ['quan 7', 'q7', 'phu my hung'],
  },
  {
    name: 'Phường 12, Quận 10, TP. Hồ Chí Minh',
    shortName: 'Quận 10',
    level: 'district',
    latitude: 10.7719,
    longitude: 106.6678,
    aliases: ['quan 10', 'q10'],
  },
  {
    name: 'Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh',
    shortName: 'Bình Thạnh',
    level: 'district',
    latitude: 10.8031,
    longitude: 106.7126,
    aliases: ['binh thanh', 'hang xanh', 'thanh da'],
  },
  {
    name: 'Phường 2, Quận Phú Nhuận, TP. Hồ Chí Minh',
    shortName: 'Phú Nhuận',
    level: 'district',
    latitude: 10.7992,
    longitude: 106.6803,
    aliases: ['phu nhuan', 'phan xich long'],
  },
  {
    name: 'Phường 2, Quận Tân Bình, TP. Hồ Chí Minh',
    shortName: 'Tân Bình',
    level: 'district',
    latitude: 10.8015,
    longitude: 106.6622,
    aliases: ['tan binh', 'san bay tan son nhat'],
  },
  {
    name: 'Phường Thảo Điền, TP. Thủ Đức, TP. Hồ Chí Minh',
    shortName: 'Thảo Điền, TP. Thủ Đức',
    level: 'ward',
    latitude: 10.8058,
    longitude: 106.7328,
    aliases: ['thao dien', 'thu duc', 'tp thu duc', 'quan 2'],
  },
  {
    name: 'Phường Cát Lái, TP. Thủ Đức, TP. Hồ Chí Minh',
    shortName: 'Phà Cát Lái',
    level: 'landmark',
    latitude: 10.7631,
    longitude: 106.7825,
    aliases: ['cat lai', 'pha cat lai'],
  },
  {
    name: 'Thị trấn Cần Giờ, Huyện Cần Giờ, TP. Hồ Chí Minh',
    shortName: 'Cần Giờ',
    level: 'district',
    latitude: 10.4116,
    longitude: 106.9555,
    aliases: ['can gio', 'bien can gio', 'rung sac'],
  },

  // Đồng Nai & Touring Waypoints
  {
    name: 'Huyện Nhơn Trạch, Đồng Nai',
    shortName: 'Nhơn Trạch',
    level: 'district',
    latitude: 10.7258,
    longitude: 106.8791,
    aliases: ['nhon trach', 'dong nai'],
  },
  {
    name: 'Huyện Long Thành, Đồng Nai',
    shortName: 'Long Thành',
    level: 'district',
    latitude: 10.7816,
    longitude: 106.9542,
    aliases: ['long thanh', 'san bay long thanh'],
  },
  {
    name: 'Hồ Trị An, Huyện Vĩnh Cửu, Đồng Nai',
    shortName: 'Hồ Trị An',
    level: 'landmark',
    latitude: 11.0833,
    longitude: 107.0167,
    aliases: ['tri an', 'ho tri an', 'thuy dien tri an'],
  },
  {
    name: 'Thành phố Biên Hòa, Đồng Nai',
    shortName: 'Biên Hòa',
    level: 'province',
    latitude: 10.9574,
    longitude: 106.8427,
    aliases: ['bien hoa'],
  },

  // Bà Rịa - Vũng Tàu
  {
    name: 'Thành phố Bà Rịa, Bà Rịa - Vũng Tàu',
    shortName: 'Bà Rịa',
    level: 'district',
    latitude: 10.4962,
    longitude: 107.1685,
    aliases: ['ba ria', 'tp ba ria'],
  },
  {
    name: 'Bãi Sau, Thành phố Vũng Tàu, Bà Rịa - Vũng Tàu',
    shortName: 'Vũng Tàu',
    level: 'province',
    latitude: 10.3460,
    longitude: 107.0843,
    aliases: ['vung tau', 'bai sau', 'bai truoc', 'mui nghinh phong'],
  },
  {
    name: 'Thị trấn Long Hải, Huyện Long Điền, Bà Rịa - Vũng Tàu',
    shortName: 'Long Hải',
    level: 'district',
    latitude: 10.3752,
    longitude: 107.2407,
    aliases: ['long hai', 'dinh co'],
  },
  {
    name: 'Hồ Tràm, Huyện Xuyên Mộc, Bà Rịa - Vũng Tàu',
    shortName: 'Hồ Tràm',
    level: 'landmark',
    latitude: 10.4735,
    longitude: 107.4589,
    aliases: ['ho tram', 'xuyen moc'],
  },

  // Lâm Đồng / Đà Lạt
  {
    name: 'Đèo Prenn, TP. Đà Lạt, Lâm Đồng',
    shortName: 'Đèo Prenn',
    level: 'landmark',
    latitude: 11.9056,
    longitude: 108.4389,
    aliases: ['deo prenn', 'prenn'],
  },
  {
    name: 'Hồ Xuân Hương, TP. Đà Lạt, Lâm Đồng',
    shortName: 'Đà Lạt',
    level: 'province',
    latitude: 11.9404,
    longitude: 108.4583,
    aliases: ['da lat', 'lam dong', 'ho xuan huong'],
  },
  {
    name: 'Thành phố Bảo Lộc, Lâm Đồng',
    shortName: 'Bảo Lộc',
    level: 'district',
    latitude: 11.5458,
    longitude: 107.8083,
    aliases: ['bao loc', 'deo bao loc'],
  },

  // Bình Thuận / Phan Thiết
  {
    name: 'Thành phố Phan Thiết, Bình Thuận',
    shortName: 'Phan Thiết',
    level: 'province',
    latitude: 10.9288,
    longitude: 108.1021,
    aliases: ['phan thiet', 'binh thuan', 'mui ne', 'ke ga'],
  },
  {
    name: 'Mũi Kê Gà, Hàm Thuận Nam, Bình Thuận',
    shortName: 'Hải đăng Kê Gà',
    level: 'landmark',
    latitude: 10.6974,
    longitude: 107.9942,
    aliases: ['ke ga', 'hai dang ke ga'],
  },

  // Tây Ninh
  {
    name: 'Núi Bà Đen, Thành phố Tây Ninh, Tây Ninh',
    shortName: 'Núi Bà Đen, Tây Ninh',
    level: 'landmark',
    latitude: 11.3789,
    longitude: 106.1689,
    aliases: ['tay ninh', 'nui ba den'],
  },
];
