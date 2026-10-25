// server/seedData.js
// Dữ liệu mở rộng quán ăn, danh mục và thực đơn phong phú tại Hà Nội

export const ORIGINAL_BASE_MENUS = {};

export const MASTER_CATEGORIES = [
  { id: 1, name: 'Cơm văn phòng', icon: 'rice_bowl', description: 'Cơm tấm, cơm niêu, cơm thố thơm ngon no bụng' },
  { id: 2, name: 'Phở & Bún', icon: 'ramen_dining', description: 'Phở bò, phở gà, bún chả, bún đậu chuẩn vị thủ đô' },
  { id: 3, name: 'Mì & Miến', icon: 'soup_kitchen', description: 'Miến lươn, mì Quảng, mì cay cay nồng hấp dẫn' },
  { id: 4, name: 'Đồ ăn nhanh & Gà rán', icon: 'lunch_dining', description: 'Burger, bánh mì giòn rụm, gà rán giòn rụm đậm đà' },
  { id: 5, name: 'Pizza & Pasta', icon: 'local_pizza', description: 'Pizza phô mai béo ngậy, mì Ý thơm lừng phong cách Ý' },
  { id: 6, name: 'Lẩu & Buffet', icon: 'skillet', description: 'Lẩu nấm thanh đạm, lẩu Thái chua cay, lẩu băng chuyền' },
  { id: 7, name: 'Thịt nướng & BBQ', icon: 'outdoor_grill', description: 'Nướng than hoa, BBQ chuẩn Hàn Quốc xèo xèo' },
  { id: 8, name: 'Đồ ăn vặt & Tráng miệng', icon: 'tapas', description: 'Nem chua rán, bánh tráng nướng, chè sầu, ốc luộc' },
  { id: 9, name: 'Trà sữa & Cà phê', icon: 'local_cafe', description: 'Trà sữa ô long, cafe trứng Hà Nội, trà hoa quả mát lạnh' },
  { id: 10, name: 'Món Chay thanh tịnh', icon: 'spa', description: 'Mâm cơm chay dinh dưỡng, tươi lành từ rau củ tự nhiên' },
  { id: 11, name: 'Đặc sản vùng miền', icon: 'restaurant', description: 'Chả cá Lã Vọng, nem nướng Nha Trang, bún bò Huế gia truyền' }
];

export const EXISTING_RESTAURANTS_EXTRA_MENU = {
  1: [ // Phở Thìn Lò Đúc
    { id: 101, name: 'Phở Tái Lăn Đặc Biệt', price: '75.000 đ', priceNum: 75000, description: 'Phở bò tái lăn xào lăn trên lửa lớn, nhiều hành hoa xanh mướt, nước dùng béo đậm đà', image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 102, name: 'Phở Tái Lăn Trứng Chần', price: '85.000 đ', priceNum: 85000, description: 'Bát tái lăn thêm quả trứng gà ta chần ngậy béo', image: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 103, name: 'Quẩy Giòn Phố Cổ (Đĩa 5 cái)', price: '15.000 đ', priceNum: 15000, description: 'Quẩy chiên vàng ruộm, giòn rụm nhúng cùng nước dùng phở', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 104, name: 'Trà Đá Hoa Nhài', price: '5.000 đ', priceNum: 5000, description: 'Trà đá ướp hoa nhài thanh mát giải nhiệt', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 105, name: 'Phở Xào Bò Rau Cải', price: '90.000 đ', priceNum: 90000, description: 'Bánh phở áp chảo giòn thơm xào cùng thăn bò và cải ngọt tươi', image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 106, name: 'Nước Mơ Hà Nội Ngâm Đường Phèn', price: '20.000 đ', priceNum: 20000, description: 'Mơ ngập thơm dịu, ngọt thanh vị đường phèn truyền thống', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
  ],
  2: [ // Bún Chả Hương Liên Obama
    { id: 201, name: 'Combo Đòn Bún Chả Obama', price: '105.000 đ', priceNum: 105000, description: 'Bao gồm 1 suất bún chả đặc biệt, 1 nem hải sản siêu giòn và 1 chai bia Hà Nội mát lạnh', image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 202, name: 'Bún Chả Nem Cua Bể', price: '70.000 đ', priceNum: 70000, description: 'Bún chả thịt nướng thơm lừng kèm 1 chiếc nem cua bể Hải Phòng vuông vức', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 203, name: 'Nem Hải Sản Phô Mai (Cái)', price: '20.000 đ', priceNum: 20000, description: 'Nhân tôm mực tươi kết hợp sợi phô mai kéo sợi độc đáo', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 204, name: 'Đĩa Chả Băm Nướng Thêm', price: '35.000 đ', priceNum: 35000, description: 'Chả viên băm thịt nạc vai ướp đậm vị nướng than hoa thơm nức mũi', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 205, name: 'Nước Sấu Hà Nội Đá Lạnh', price: '18.000 đ', priceNum: 18000, description: 'Quả sấu giòn chua ngọt kèm gừng tươi đập dập thơm lừng', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80', isAvailable: true }
  ],
  3: [ // Phở Bát Đàn
    { id: 301, name: 'Phở Bò Tái Nạm Gầu Bát Đàn', price: '80.000 đ', priceNum: 80000, description: 'Nước dùng trong veo ngọt tự nhiên từ xương bò hầm 24 tiếng, gầu giòn sần sật', image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 302, name: 'Phở Bò Tái Lăn Đặc Sắc', price: '70.000 đ', priceNum: 70000, description: 'Thịt bò tươi mềm ngọt xào tái đậm đà', image: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 303, name: 'Phở Sốt Vang Bát Đàn', price: '85.000 đ', priceNum: 85000, description: 'Bò sốt vang thơm nồng hương quế hồi và rượu vang đỏ óng ánh', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 304, name: 'Sữa Đậu Nành Tươi Nóng/Đá', price: '12.000 đ', priceNum: 12000, description: 'Đậu nành hạt nguyên chất nấu thơm béo', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', isAvailable: true }
  ],
  4: [ // Cơm Tấm Sà Bì Chưởng
    { id: 401, name: 'Cơm Tấm Sườn Bì Chả Đặc Biệt', price: '89.000 đ', priceNum: 89000, description: 'Dẻ sườn cốt lết nướng mật ong vàng óng, chả trứng hấp thơm lừng và bì trộn thính gạo rang', image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 402, name: 'Cơm Tấm Sườn Cây Khổng Lồ', price: '109.000 đ', priceNum: 109000, description: 'Cây sườn heo to bản ướp gia vị thượng hạng nướng chín mềm mọng nước', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 403, name: 'Canh Khổ Qua Nhồi Thịt Nạc', price: '25.000 đ', priceNum: 25000, description: 'Khổ qua đắng thanh nhồi thịt heo băm ngọt mát giải ngấy tuyệt hảo', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 404, name: 'Trà Tắc Xí Muội Đường Phèn', price: '22.000 đ', priceNum: 22000, description: 'Vị chua ngọt của quất hòa quyện cùng xí muội mặn nhẹ rất kích thích vị giác', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 405, name: 'Chả Cua Nướng Thêm', price: '30.000 đ', priceNum: 30000, description: 'Chả làm từ thịt cua biển tươi hấp cùng lòng đỏ trứng muối béo ngậy', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true }
  ],
  5: [ // Lẩu Nấm Ashima
    { id: 501, name: 'Set Lẩu Nấm Quý Ashima (2-3 người)', price: '580.000 đ', priceNum: 580000, description: 'Gồm các loại nấm quý: nấm tùng nhung, gan bò, tiên nga cùng thăn bò Wagyu thơm ngọt', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 502, name: 'Đĩa Bò Mỹ Cuộn Nấm Kim Châm', price: '145.000 đ', priceNum: 145000, description: 'Ba chỉ bò Mỹ vân mỡ đều cuộn nấm kim châm tươi giòn ngọt', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 503, name: 'Mì Trứng Tươi Kéo Tay', price: '35.000 đ', priceNum: 35000, description: 'Sợi mì thủ công dai mướt nhúng nước dùng nấm ngọt lịm', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 504, name: 'Salad Rong Biển Nấm Tuyết', price: '85.000 đ', priceNum: 85000, description: 'Khai vị thanh mát với sốt mè rang Nhật Bản thơm lừng', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80', isAvailable: true }
  ],
  6: [ // Bánh Mì Huỳnh Hoa
    { id: 601, name: 'Bánh Mì Thập Cẩm Đặc Biệt', price: '68.000 đ', priceNum: 68000, description: 'Trọng lượng gần 400g ngập tràn 8 tầng nhân: pate béo ngậy, bơ tươi, chả lụa, giò thủ, dăm bông, xá xíu', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 602, name: 'Bánh Mì Heo Quay Giòn Bì', price: '55.000 đ', priceNum: 55000, description: 'Heo quay bì nổ giòn tan kẹp dưa leo, ngò rí và sốt tương đen gia truyền', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 603, name: 'Pate Huỳnh Hoa Hộp 300g (Mua về)', price: '120.000 đ', priceNum: 120000, description: 'Pate gan heo công thức bí truyền thơm béo nức danh Sài Gòn', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 604, name: 'Trà Sữa Thái Xanh Phô Mai Tươi', price: '28.000 đ', priceNum: 28000, description: 'Trà thái thơm dịu kẹp viên phô mai béo ngậy', image: 'https://images.unsplash.com/photo-1558857563-b37cfb292e10?auto=format&fit=crop&w=600&q=80', isAvailable: true }
  ],
  7: [ // Trà Sữa Ô Long Phê La
    { id: 701, name: 'Ô Long Sữa Nướng Phê La', price: '55.000 đ', priceNum: 55000, description: 'Vị trà Ô Long Mộc Châu đậm vị hun khói hòa quyện sữa béo ngậy', image: 'https://images.unsplash.com/photo-1558857563-b37cfb292e10?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 702, name: 'Phê Truffle Kem Trứng', price: '65.000 đ', priceNum: 65000, description: 'Lớp foam kem trứng thơm ngậy rắc bột cacao cao cấp', image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 703, name: 'Trân Châu Ô Long Dẻo Thơm', price: '12.000 đ', priceNum: 12000, description: 'Topping trân châu nấu từ nước cốt trà Ô Long thơm mềm nhai cực thích', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 704, name: 'Cà Phê Muối Ô Long', price: '45.000 đ', priceNum: 45000, description: 'Sự giao thoa độc đáo giữa cà phê robusta Đắk Lắk và kem muối biển mịn màng', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
  ],
  8: [ // Nem Nướng Nha Trang Cô Điệp
    { id: 801, name: 'Suất Nem Nướng Nha Trang Đầy Đủ', price: '65.000 đ', priceNum: 65000, description: 'Nem nướng que thơm lừng, ram chiên giòn rụm, xoài xanh, dưa chuột và rổ rau thơm tươi sạch kèm nước chấm tương nếp nóng hổi', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 802, name: 'Ram Giòn Cuốn Bánh Tráng Thêm', price: '20.000 đ', priceNum: 20000, description: 'Bánh tráng cuốn ram chiên giòn tan rôm rốp', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 803, name: 'Đĩa Nem Nướng Thêm (4 que)', price: '35.000 đ', priceNum: 35000, description: 'Thịt heo tươi giã nhuyễn ướp tỏi tiêu nướng than hồng', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80', isAvailable: true },
    { id: 804, name: 'Sữa Chua Nếp Cẩm Mộc Châu', price: '20.000 đ', priceNum: 20000, description: 'Nếp cẩm ủ men dẻo ngọt tự nhiên ăn kèm sữa chua sánh mịn', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80', isAvailable: true }
  ]
};

// 27 QUÁN ĂN MỚI (IDs 9-35)
export const NEW_RESTAURANTS = [
  // --- 1. CƠM VĂN PHÒNG ---
  {
    id: 9,
    name: 'Cơm Niêu Singapore KOMBO Cầu Giấy',
    category: 'Cơm văn phòng',
    description: 'Cơm niêu giòn rụm đáy niêu chuẩn phong cách đảo quốc sư tử, sốt bò tiêu đen thơm nức mũi.',
    address: '86 Nguyễn Phong Sắc, P. Dịch Vọng Hậu, Q. Cầu Giấy, Hà Nội',
    phone: '0971234009',
    price: '70.000 - 130.000 đ',
    rating: 4.8,
    reviewsCount: 38,
    image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:00 - 21:30',
    isOpen: true,
    featured: true,
    lat: 21.0368,
    lng: 105.7891,
    mapUrl: 'https://maps.google.com/?q=21.0368,105.7891',
    menu: [
      { id: 901, name: 'Cơm Niêu Bò Sốt Tiêu Đen 2 Mặt Cháy', price: '89.000 đ', priceNum: 89000, description: 'Thịt bò xào mềm ngấm sốt tiêu đen cay nhẹ, cơm cháy vàng giòn 2 mặt', image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 902, name: 'Cơm Niêu Gà Sốt Nấm Tươi', price: '79.000 đ', priceNum: 79000, description: 'Gà ta xào cùng nấm đông cô tươi ngọt dịu tự nhiên', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 903, name: 'Cơm Niêu Thịt Sốt BBQ Kiểu Mỹ', price: '85.000 đ', priceNum: 85000, description: 'Thịt ba chỉ đẫm sốt BBQ nướng thơm lừng', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 904, name: 'Canh Chua Thịt Bằm Rau Muống', price: '20.000 đ', priceNum: 20000, description: 'Canh chua thanh giải nhiệt bữa cơm văn phòng', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 905, name: 'Salad Dầu Giấm Trứng Luộc', price: '25.000 đ', priceNum: 25000, description: 'Rau xà lách sạch Đà Lạt trộn dầu giấm chua ngọt', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 906, name: 'Trà Sâm Dứa Hạt É Nha Trang', price: '15.000 đ', priceNum: 15000, description: 'Trà sâm dứa dịu nhẹ, hạt é giòn mát', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 10,
    name: 'Cơm Gà Hội An Bà Buội - Phố Cổ',
    category: 'Cơm văn phòng',
    description: 'Thương hiệu cơm gà Hội An trứ danh, hạt cơm óng vàng vị nước luộc gà, thịt gà ta xé phay giòn sần sật.',
    address: '66 Bà Triệu, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội',
    phone: '0981234010',
    price: '65.000 - 120.000 đ',
    rating: 4.7,
    reviewsCount: 42,
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:30 - 21:00',
    isOpen: true,
    featured: true,
    lat: 21.0185,
    lng: 105.8502,
    mapUrl: 'https://maps.google.com/?q=21.0185,105.8502',
    menu: [
      { id: 1001, name: 'Cơm Gà Xé Phay Hội An Đặc Biệt', price: '68.000 đ', priceNum: 68000, description: 'Cơm gà nấu nước luộc gà kèm hành tây dưa chua và rau răm Trà Quế', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1002, name: 'Cơm Đùi Gà Nướng Mật Ong Rừng', price: '75.000 đ', priceNum: 75000, description: 'Đùi gà góc tư nướng xém da mật ong thơm phức', image: 'https://images.unsplash.com/photo-1527477378378-43d964f51478?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1003, name: 'Nộm Gà Xé Hoa Chuối', price: '50.000 đ', priceNum: 50000, description: 'Hoa chuối giòn, gà ta xé sợi và lạc rang bùi béo', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1004, name: 'Canh Lòng Mề Gà Nấu Nấm', price: '25.000 đ', priceNum: 25000, description: 'Nước dùng trong veo ngọt thơm từ lòng gà tươi', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1005, name: 'Nước Ngô Ngọt Luộc Ép Tươi', price: '18.000 đ', priceNum: 18000, description: 'Ngô ngọt nguyên chất thơm mát lành', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 11,
    name: 'Cơm Thố Bách Khoa - Tạ Quang Bửu',
    category: 'Cơm văn phòng',
    description: 'Cơm thố nóng hổi xèo xèo, suất ăn đầy ắp chất lượng cho học sinh sinh viên và dân công sở.',
    address: '157 Tạ Quang Bửu, P. Bách Khoa, Q. Hai Bà Trưng, Hà Nội',
    phone: '0961234011',
    price: '45.000 - 80.000 đ',
    rating: 4.6,
    reviewsCount: 29,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    openHours: '09:30 - 22:00',
    isOpen: true,
    featured: false,
    lat: 21.0028,
    lng: 105.8459,
    mapUrl: 'https://maps.google.com/?q=21.0028,105.8459',
    menu: [
      { id: 1101, name: 'Cơm Thố Xá Xíu Trứng Ốp La', price: '50.000 đ', priceNum: 50000, description: 'Xá xíu mềm thơm quyện cùng lòng đào béo ngậy', image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1102, name: 'Cơm Thố Bò Nướng Kim Chi', price: '55.000 đ', priceNum: 55000, description: 'Bò nướng tẩm vị chua cay cùng kim chi cải thảo', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1103, name: 'Cơm Thố Gà Teriyaki Nhật Bản', price: '50.000 đ', priceNum: 50000, description: 'Gà sốt tương ngọt kiểu Nhật đậm đà', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1104, name: 'Canh Rong Biển Đậu Hũ', price: '15.000 đ', priceNum: 15000, description: 'Rong biển thanh mát kèm đậu hũ non mềm mịn', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1105, name: 'Trà Chanh Đào Mật Ong', price: '15.000 đ', priceNum: 15000, description: 'Chanh đào ngâm mật ong rừng dịu giọng', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 2. PHỞ & BÚN ---
  {
    id: 12,
    name: 'Phở Gà Nguyệt - Phủ Doãn',
    category: 'Phở & Bún',
    description: 'Quán phở gà đạt giải Michelin Selected, gà ta đồi da vàng óng giòn sần sật, có phở nước và phở trộn cực đỉnh.',
    address: '5B Phủ Doãn, P. Hàng Bông, Q. Hoàn Kiếm, Hà Nội',
    phone: '0911234012',
    price: '55.000 - 110.000 đ',
    rating: 4.9,
    reviewsCount: 56,
    image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '06:00 - 13:00, 17:30 - 01:00',
    isOpen: true,
    featured: true,
    lat: 21.0315,
    lng: 105.8488,
    mapUrl: 'https://maps.google.com/?q=21.0315,105.8488',
    menu: [
      { id: 1201, name: 'Phở Gà Trộn Đùi Cánh Đặc Biệt', price: '85.000 đ', priceNum: 85000, description: 'Thịt đùi và cánh gà chặt miếng vàng ươm, trộn sốt tương ớt chua ngọt và hành phi giòn', image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1202, name: 'Phở Gà Nước Đùi Lưng', price: '70.000 đ', priceNum: 70000, description: 'Nước dùng gà thanh ngọt, lá chanh thái chỉ thơm ngát', image: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1203, name: 'Đĩa Trứng Non Kê Gà Chần', price: '50.000 đ', priceNum: 50000, description: 'Trứng non vàng ươm và kê gà bổ dưỡng chần nước phở béo', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1204, name: 'Lòng Mề Gà Luộc Chấm Muối Tiêu Chanh', price: '40.000 đ', priceNum: 40000, description: 'Mề gà giòn sần sật, gan gà bùi béo', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1205, name: 'Quẩy Giòn Phố Cổ (Đĩa)', price: '10.000 đ', priceNum: 10000, description: 'Quẩy vàng giòn tan chấm nước phở gà', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1206, name: 'Trà Nhài Ướp Hương Truyền Thống', price: '5.000 đ', priceNum: 5000, description: 'Trà nhài thơm sâu ngọt hậu', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 13,
    name: 'Phở Cuốn Hương Mai - Ngũ Xã',
    category: 'Phở & Bún',
    description: 'Phở cuốn trứ danh đảo Ngũ Xã làng đúc đồng, bánh phở mềm mướt cuốn thịt bò xào lăn và rau thơm ngát.',
    address: '25 Ngũ Xã, P. Trúc Bạch, Q. Ba Đình, Hà Nội',
    phone: '0941234013',
    price: '40.000 - 150.000 đ',
    rating: 4.8,
    reviewsCount: 47,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '09:00 - 22:00',
    isOpen: true,
    featured: true,
    lat: 21.0483,
    lng: 105.8415,
    mapUrl: 'https://maps.google.com/?q=21.0483,105.8415',
    menu: [
      { id: 1301, name: 'Đĩa Phở Cuốn Hương Mai (10 chiếc)', price: '80.000 đ', priceNum: 80000, description: 'Bánh phở mềm cuốn thăn bò xào lăn, chấm nước mắm tỏi ớt đu đủ chua ngọt', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1302, name: 'Phở Chiên Phồng Bò Xào Rau Cải', price: '95.000 đ', priceNum: 95000, description: 'Từng miếng bánh phở phồng giòn tan như chiếc gối ôm trọn sốt bò sền sệt', image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1303, name: 'Phở Chiên Trứng Bò Xào', price: '90.000 đ', priceNum: 90000, description: 'Bánh phở áp chảo cùng trứng thơm lừng giòn rụm bên ngoài', image: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1304, name: 'Chả Tôm Chiên Giòn', price: '75.000 đ', priceNum: 75000, description: 'Tôm tươi xay nhuyễn bọc bột chiên xù vàng ruộm', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1305, name: 'Nước Sấu Phố Cổ Ngâm Gừng', price: '20.000 đ', priceNum: 20000, description: 'Nước sấu chua thanh đánh tan cơn khát', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 14,
    name: 'Bún Đậu Mắm Tôm Hàng Khay',
    category: 'Phở & Bún',
    description: 'Bún đậu ngõ Hàng Khay nức tiếng bờ hồ, đậu Mơ rán giòn vàng ươm, chả cốm dẻo thơm, mắm tôm bông bọt.',
    address: 'Ngõ 29 Hàng Khay, P. Tràng Tiền, Q. Hoàn Kiếm, Hà Nội',
    phone: '0931234014',
    price: '45.000 - 95.000 đ',
    rating: 4.8,
    reviewsCount: 63,
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:00 - 20:30',
    isOpen: true,
    featured: true,
    lat: 21.0279,
    lng: 105.8524,
    mapUrl: 'https://maps.google.com/?q=21.0279,105.8524',
    menu: [
      { id: 1401, name: 'Mẹt Bún Đậu Đầy Đủ Thập Cẩm', price: '65.000 đ', priceNum: 65000, description: 'Đầy đủ đậu Mơ lướt ván giòn, thịt bắp chân giò luộc, chả cốm nếp, dồi sụn nướng, nem rán', image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1402, name: 'Đĩa Dồi Sụn Nướng Than Hoa Thêm', price: '40.000 đ', priceNum: 40000, description: 'Dồi sụn giòn sần sật ướp lá húng quế nướng thơm ngào ngạt', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1403, name: 'Đĩa Chả Cốm Làng Vòng Chiên Giòn', price: '35.000 đ', priceNum: 35000, description: 'Cốm xanh dẻo quánh quyện thịt nạc xay ngọt thịt', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1404, name: 'Đĩa Đậu Mơ Rán Giòn Lướt Ván', price: '25.000 đ', priceNum: 25000, description: 'Đậu ngoài giòn trong béo mịn như tào phớ', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1405, name: 'Nước Mơ Ngâm Chùa Hương Đá', price: '15.000 đ', priceNum: 15000, description: 'Mơ ngâm chua ngọt dịu cổ họng ăn bún đậu cực chuẩn', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 15,
    name: 'Bún Bò Huế Ngự Uyển - Kim Mã',
    category: 'Phở & Bún',
    description: 'Hương vị bún bò Cố Đô đúng chuẩn trên đất thủ đô, nước dùng hầm sả ruốc Huế thơm lừng cay cay.',
    address: '321 Kim Mã, P. Giảng Võ, Q. Ba Đình, Hà Nội',
    phone: '0921234015',
    price: '50.000 - 85.000 đ',
    rating: 4.7,
    reviewsCount: 34,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '06:30 - 22:00',
    isOpen: true,
    featured: false,
    lat: 21.0319,
    lng: 105.8205,
    mapUrl: 'https://maps.google.com/?q=21.0319,105.8205',
    menu: [
      { id: 1501, name: 'Bún Bò Huế Đặc Biệt Tô Lớn', price: '65.000 đ', priceNum: 65000, description: 'Đầy đủ bắp bò hoa, nạm bò mềm, móng giò giòn, chả cua Huế và chả bò quết', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1502, name: 'Bún Bắp Bò Gân Mềm', price: '55.000 đ', priceNum: 55000, description: 'Gân bò hầm trong veo giòn dẻo, bắp bò thái mỏng', image: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1503, name: 'Bánh Bột Lọc Tôm Thịt Lá Chuối (10 cái)', price: '50.000 đ', priceNum: 50000, description: 'Vỏ bột lọc trong veo thấy rõ con tôm đỏ au rim mặn ngọt', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1504, name: 'Chả Cua Huế Hấp Thêm', price: '20.000 đ', priceNum: 20000, description: 'Chả quết cua biển thơm lừng cay the đầu lưỡi', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1505, name: 'Trà Cung Đình Huế Mát Lạnh', price: '15.000 đ', priceNum: 15000, description: 'Trà thảo mộc cung đình 16 vị thanh lọc cơ thể', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 16,
    name: 'Bún Riêu Cua Hàng Bạc - Phố Cổ',
    category: 'Phở & Bún',
    description: 'Hương vị bún riêu truyền thống Hà Nội xưa, riêu cua đồng nguyên chất xốp mịn, giấm bỗng nếp chua thanh dịu ngọt.',
    address: '11 Hàng Bạc, P. Hàng Bạc, Q. Hoàn Kiếm, Hà Nội',
    phone: '0901234016',
    price: '40.000 - 75.000 đ',
    rating: 4.8,
    reviewsCount: 39,
    image: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '06:00 - 21:00',
    isOpen: true,
    featured: false,
    lat: 21.0345,
    lng: 105.8528,
    mapUrl: 'https://maps.google.com/?q=21.0345,105.8528',
    menu: [
      { id: 1601, name: 'Bún Riêu Cua Đầy Đủ Bò Giò Ốc', price: '60.000 đ', priceNum: 60000, description: 'Tô đầy ắp riêu cua đồng béo ngậy, thịt bò trần tái, ốc nhồi giòn sần sật và giò tai giòn ngọt', image: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1602, name: 'Bún Riêu Cua Trứng Vịt Lộn', price: '50.000 đ', priceNum: 50000, description: 'Riêu cua truyền thống kèm quả trứng vịt lộn ngọt đậm đà', image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1603, name: 'Đĩa Ốc Mít Luộc Chần Giòn Thêm', price: '30.000 đ', priceNum: 30000, description: 'Ốc mít béo ngậy nhúng nước riêu chua bỗng thơm lừng', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1604, name: 'Quẩy Giòn Phố Cổ (Đĩa)', price: '10.000 đ', priceNum: 10000, description: 'Quẩy giòn rụm nhúng canh riêu cua béo ngọt', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 3. MÌ & MIẾN ---
  {
    id: 17,
    name: 'Miến Lươn Đông Thịnh - Hàng Điếu',
    category: 'Mì & Miến',
    description: 'Thương hiệu miến lươn hơn 40 năm giữa lòng phố cổ, lươn giòn tan vàng rụm, nước dùng ngọt từ xương lươn ninh kỹ.',
    address: '87 Hàng Điếu, P. Cửa Đông, Q. Hoàn Kiếm, Hà Nội',
    phone: '0971234017',
    price: '55.000 - 100.000 đ',
    rating: 4.9,
    reviewsCount: 52,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '06:30 - 21:30',
    isOpen: true,
    featured: true,
    lat: 21.0336,
    lng: 105.8465,
    mapUrl: 'https://maps.google.com/?q=21.0336,105.8465',
    menu: [
      { id: 1701, name: 'Miến Lươn Trộn Giòn Đặc Biệt', price: '75.000 đ', priceNum: 75000, description: 'Lươn chiên giòn tan trộn giá đỗ, rau răm, lạc rang và nước sốt chua ngọt gia truyền', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1702, name: 'Miến Lươn Nước Xương Ninh', price: '65.000 đ', priceNum: 65000, description: 'Sợi miến dong dẻo dai bơi trong làn nước lèo màu nâu sẫm ngọt đậm đà', image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1703, name: 'Súp Lươn Nóng Hổi Ăn Kèm Bánh Mì', price: '60.000 đ', priceNum: 60000, description: 'Súp lươn mềm sánh đặc, tiêu cay ấm nồng', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1704, name: 'Lươn Xào Xả Ớt Xúc Bánh Đa', price: '120.000 đ', priceNum: 120000, description: 'Lươn đồng xào săn chắc cay xè ăn kèm bánh đa Đô Lương', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1705, name: 'Nước Chanh Tươi Muối Khoáng', price: '15.000 đ', priceNum: 15000, description: 'Chanh tươi đá giải nhiệt cực đã', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 18,
    name: 'Mì Quảng Bà Vị - Hoàng Cầu',
    category: 'Mì & Miến',
    description: 'Tinh hoa ẩm thực xứ Quảng giữa lòng thủ đô, sợi mì vàng tươi ngâm nghệ, tôm thịt rim mặn ngọt và bánh tráng mè nướng giòn.',
    address: '42 Hoàng Cầu, P. Ô Chợ Dừa, Q. Đống Đa, Hà Nội',
    phone: '0981234018',
    price: '45.000 - 80.000 đ',
    rating: 4.7,
    reviewsCount: 31,
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    openHours: '09:00 - 21:30',
    isOpen: true,
    featured: false,
    lat: 21.0181,
    lng: 105.8236,
    mapUrl: 'https://maps.google.com/?q=21.0181,105.8236',
    menu: [
      { id: 1801, name: 'Mì Quảng Tôm Thịt Trứng Cút', price: '55.000 đ', priceNum: 55000, description: 'Sợi mì gạo dẻo mềm, nước nhưn sánh ngọt từ tôm sông và thịt ba chỉ rim', image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1802, name: 'Mì Quảng Gà Ta Rút Xương', price: '60.000 đ', priceNum: 60000, description: 'Gà ta đồi vàng óng ướp củ nén thơm lừng', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1803, name: 'Bánh Tráng Mè Nướng Giòn Thêm', price: '15.000 đ', priceNum: 15000, description: 'Bánh tráng nướng mè đen bẻ vụn rắc lên mì Quảng giòn rụm', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1804, name: 'Trà Sâm Bí Đao Hạt Chia', price: '18.000 đ', priceNum: 18000, description: 'Nấu từ bí đao tươi và thục địa mát gan giải độc', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 4. ĐỒ ĂN NHANH & GÀ RÁN ---
  {
    id: 19,
    name: 'Gà Rán Popeyes - Vincom Bà Triệu',
    category: 'Đồ ăn nhanh & Gà rán',
    description: 'Thương hiệu gà rán giòn cay kiểu Louisiana nước Mỹ, tẩm ướp cay nồng 12 giờ đậm đà từng thớ thịt.',
    address: 'Tầng 5 Vincom Center, 191 Bà Triệu, Q. Hai Bà Trưng, Hà Nội',
    phone: '0961234019',
    price: '50.000 - 250.000 đ',
    rating: 4.7,
    reviewsCount: 65,
    image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
    openHours: '09:30 - 22:00',
    isOpen: true,
    featured: true,
    lat: 21.0118,
    lng: 105.8504,
    mapUrl: 'https://maps.google.com/?q=21.0118,105.8504',
    menu: [
      { id: 1901, name: 'Combo Gà Giòn Cay (3 Miếng + Khoai + Nước)', price: '119.000 đ', priceNum: 119000, description: '3 miếng gà giòn da vàng ươm cay xè, khoai tây chiên giòn và ly coca mát lạnh', image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1902, name: 'Burger Gà Giòn Phô Mai Tràn', price: '69.000 đ', priceNum: 69000, description: 'Phi lê gà giòn kẹp sốt phô mai cheddar tan chảy và xà lách tươi', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1903, name: 'Khoai Tây Lắc Phô Mai Béo', price: '39.000 đ', priceNum: 39000, description: 'Khoai tây cắt múi cau chiên vàng lắc đẫm bột phô mai mặn ngọt', image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1904, name: 'Gà Không Xương Tẩm Sốt Cay Ngọt (6 miếng)', price: '79.000 đ', priceNum: 79000, description: 'Thịt ức gà mềm ngọt chiên giòn áo lớp sốt ngọt cay hấp dẫn', image: 'https://images.unsplash.com/photo-1527477378378-43d964f51478?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 1905, name: 'Coca-Cola Tươi Cỡ Lớn', price: '20.000 đ', priceNum: 20000, description: 'Nước ngọt có ga sảng khoái mát lạnh', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 20,
    name: 'Bami King - Bánh Mì Bò Nướng Thái Hà',
    category: 'Đồ ăn nhanh & Gà rán',
    description: 'Thương hiệu bánh mì bò nướng thượng hạng đầu tiên tại Hà Nội, vỏ bánh giòn xốp nhân bò ngập tràn thơm mùi bơ tỏi.',
    address: '161 Thái Hà, P. Trung Liệt, Q. Đống Đa, Hà Nội',
    phone: '0911234020',
    price: '35.000 - 65.000 đ',
    rating: 4.6,
    reviewsCount: 28,
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    openHours: '06:30 - 22:00',
    isOpen: true,
    featured: false,
    lat: 21.0125,
    lng: 105.8198,
    mapUrl: 'https://maps.google.com/?q=21.0125,105.8198',
    menu: [
      { id: 2001, name: 'Bánh Mì Bò Nướng Xá Xíu Phô Mai', price: '55.000 đ', priceNum: 55000, description: 'Bò nướng than hoa mềm ướt sốt tiêu đen kèm phô mai dẻo kéo sợi', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2002, name: 'Bánh Mì Bò Nướng Tiêu Đen Tiêu Chuẩn', price: '45.000 đ', priceNum: 45000, description: 'Nhân thịt bò ướp sốt tiêu đen đậm đà kẹp dưa chuột ngò gai', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2003, name: 'Sữa Đậu Nành Tươi Lá Dứa', price: '15.000 đ', priceNum: 15000, description: 'Sữa đậu tự nấu thơm lừng hương lá dứa tự nhiên', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2004, name: 'Trà Đào Cam Sả Mát Lạnh', price: '25.000 đ', priceNum: 25000, description: 'Miếng đào giòn ngọt quyện hương thơm nồng nàn của sả cây', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 5. PIZZA & PASTA ---
  {
    id: 21,
    name: "Pizza 4P's - Hoàng Thành Tower",
    category: 'Pizza & Pasta',
    description: 'Thương hiệu Pizza củi kiểu Nhật lừng danh, phô mai Burrata tự sản xuất tươi mới hàng ngày, không gian ẩm thực sang trọng.',
    address: '114 Mai Hắc Đế, P. Lê Đại Hành, Q. Hai Bà Trưng, Hà Nội',
    phone: '02836220500',
    price: '150.000 - 450.000 đ',
    rating: 4.9,
    reviewsCount: 78,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:00 - 22:30',
    isOpen: true,
    featured: true,
    lat: 21.0112,
    lng: 105.8509,
    mapUrl: 'https://maps.google.com/?q=21.0112,105.8509',
    menu: [
      { id: 2101, name: 'Pizza 4 Loại Phô Mai Kèm Mật Ong Rừng (4 Cheese)', price: '260.000 đ', priceNum: 260000, description: 'Sự kết hợp hoàn mỹ của Mozzarella, Gorgonzola, Camembert và Parmesan chấm mật ong nguyên chất', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2102, name: 'Pizza Burrata Thịt Nguội Parma Ham', price: '320.000 đ', priceNum: 320000, description: 'Quả phô mai Burrata tươi béo ngậy ở giữa, xung quanh viền thịt nguội Ý thượng hạng', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2103, name: 'Mì Ý Sốt Cua Cà Chua Kem Béo (Crab Tomato Cream)', price: '240.000 đ', priceNum: 240000, description: 'Thịt cua biển ngọt lành quyện sốt cà chua kem béo ngậy trứ danh của 4Ps', image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2104, name: 'Salad Phô Mai Tươi Rau Củ Hữu Cơ', price: '135.000 đ', priceNum: 135000, description: 'Rau mầm và cà chua bi hữu cơ tươi giòn sốt dấm Balsamic Ý', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2105, name: 'Trà Trái Cây Nhiệt Đới Mát Lạnh', price: '65.000 đ', priceNum: 65000, description: 'Trà hoa quả ngâm cam vàng, dâu tây và chanh dây', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 22,
    name: 'The Pizza Company - Cầu Giấy',
    category: 'Pizza & Pasta',
    description: 'Chuyên gia pizza phong cách Ý đế dày ngập tràn nhân hải sản và viền phô mai thơm ngon khó cưỡng.',
    address: '333 Cầu Giấy, P. Dịch Vọng, Q. Cầu Giấy, Hà Nội',
    phone: '19006066',
    price: '99.000 - 300.000 đ',
    rating: 4.6,
    reviewsCount: 37,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:00 - 22:00',
    isOpen: true,
    featured: false,
    lat: 21.0345,
    lng: 105.7932,
    mapUrl: 'https://maps.google.com/?q=21.0345,105.7932',
    menu: [
      { id: 2201, name: 'Pizza Hải Sản Sốt Pesto Viền Phô Mai (Size M)', price: '219.000 đ', priceNum: 219000, description: 'Tôm, mực tươi roi rói trên nền sốt lá quế tây Pesto xanh mát', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2202, name: 'Pizza Thịt Xông Khói & Dứa Hawaii (Size M)', price: '189.000 đ', priceNum: 189000, description: 'Dăm bông thịt xông khói kết hợp dứa nhiệt đới ngọt chua kích thích', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2203, name: 'Mì Ý Đút Lò Phô Mai Thịt Bằm Bolognese', price: '119.000 đ', priceNum: 119000, description: 'Sốt bò băm cà chua đậm đà phủ kín lớp phô mai nướng xém vàng', image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2204, name: 'Cánh Gà Nướng BBQ Vị Cay (4 miếng)', price: '89.000 đ', priceNum: 89000, description: 'Cánh gà tẩm sốt BBQ nướng thơm lừng óng ả', image: 'https://images.unsplash.com/photo-1527477378378-43d964f51478?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2205, name: 'Bánh Mì Tỏi Nướng Giòn Rụm', price: '39.000 đ', priceNum: 39000, description: 'Bánh mì baguette phết bơ tỏi thơm ngậy', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 6. LẨU & BUFFET ---
  {
    id: 23,
    name: 'Kichi-Kichi Lẩu Băng Chuyền - Trần Thái Tông',
    category: 'Lẩu & Buffet',
    description: 'Thương hiệu lẩu băng chuyền hàng đầu Việt Nam, món nhúng chạy liên tục trên dải băng dài bất tận.',
    address: '105 Trần Thái Tông, P. Dịch Vọng Hậu, Q. Cầu Giấy, Hà Nội',
    phone: '02473007998',
    price: '239.000 - 329.000 đ',
    rating: 4.8,
    reviewsCount: 45,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:30 - 22:00',
    isOpen: true,
    featured: true,
    lat: 21.0315,
    lng: 105.7865,
    mapUrl: 'https://maps.google.com/?q=21.0315,105.7865',
    menu: [
      { id: 2301, name: 'Set Lẩu Thái Tomyum Mang Về (2-3 người)', price: '299.000 đ', priceNum: 299000, description: 'Gồm nước lẩu Thái Tomyum chua cay thơm sả cốt dừa, 500g ba chỉ bò Mỹ, tôm sú, viên thả lẩu và rau nấm tươi', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2302, name: 'Khay Ba Chỉ Bò Mỹ Nhúng Lẩu (300g)', price: '129.000 đ', priceNum: 129000, description: 'Ba chỉ bò Mỹ thái lát cuộn mỏng chuyên dùng nhúng lẩu', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2303, name: 'Khay Hải Sản Nhúng (Tôm, Mực, Ngao)', price: '149.000 đ', priceNum: 149000, description: 'Hải sản tươi sống làm sạch bảo quản mát', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2304, name: 'Khay Viên Thả Lẩu Phô Mai Nhập Khẩu', price: '69.000 đ', priceNum: 69000, description: 'Đậu hũ phô mai, bánh bao trứng cá hồi béo ngậy', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2305, name: 'Mì Ramen Nhúng Lẩu', price: '20.000 đ', priceNum: 20000, description: 'Sợi mì tươi dai ngon thấm đẫm vị lẩu', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 24,
    name: 'Manwah Taiwanese Hotpot - Thái Hà',
    category: 'Lẩu & Buffet',
    description: 'Hành trình khám phá lẩu Đài Loan truyền thống với nước cốt lẩu Mala cay nồng đậm vị thảo mộc thiên nhiên.',
    address: 'Số 1 Thái Hà, P. Trung Liệt, Q. Đống Đa, Hà Nội',
    phone: '02473007973',
    price: '290.000 - 450.000 đ',
    rating: 4.9,
    reviewsCount: 51,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:00 - 22:30',
    isOpen: true,
    featured: true,
    lat: 21.0119,
    lng: 105.8228,
    mapUrl: 'https://maps.google.com/?q=21.0119,105.8228',
    menu: [
      { id: 2401, name: 'Set Lẩu Đài Loan Mala 2 Ngăn Mang Về', price: '380.000 đ', priceNum: 380000, description: 'Gồm 2 vị nước lẩu (Mala cay tê & Nấm ngọt thanh), thăn bò Angus, há cảo Đài Loan và mì kéo tay', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2402, name: 'Khay Thịt Heo Iberico Tây Ban Nha (250g)', price: '180.000 đ', priceNum: 180000, description: 'Thịt heo đen ăn hạt sồi quý hiếm thịt ngọt mềm mọng nước', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2403, name: 'Đĩa Há Cảo Đài Loan Tôm Thịt (8 viên)', price: '75.000 đ', priceNum: 75000, description: 'Vỏ mỏng trong suốt nhân tôm tươi giòn ngọt', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2404, name: 'Trà Sữa Đài Loan Trân Châu Đường Đen', price: '35.000 đ', priceNum: 35000, description: 'Trà sữa nấu đậm hương trà đen Đài Bắc truyền thống', image: 'https://images.unsplash.com/photo-1558857563-b37cfb292e10?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 7. THỊT NƯỚNG & BBQ ---
  {
    id: 25,
    name: 'Gogi House - Quán Thịt Nướng Hàn Quốc Huỳnh Thúc Kháng',
    category: 'Thịt nướng & BBQ',
    description: 'Thương hiệu nướng chuẩn đường phố Seoul, thịt dẻ sườn bò sốt mật ong nướng than hoa thơm lừng.',
    address: '45 Huỳnh Thúc Kháng, P. Láng Hạ, Q. Đống Đa, Hà Nội',
    phone: '02473007338',
    price: '250.000 - 450.000 đ',
    rating: 4.8,
    reviewsCount: 68,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:30 - 22:00',
    isOpen: true,
    featured: true,
    lat: 21.0189,
    lng: 105.8115,
    mapUrl: 'https://maps.google.com/?q=21.0189,105.8115',
    menu: [
      { id: 2501, name: 'Set Thịt Nướng Gogi Tươi Tẩm Sốt Galbi (Giao tại nhà)', price: '389.000 đ', priceNum: 389000, description: 'Gồm dẻ sườn bò Mỹ sốt Galbi, ba chỉ bò Mỹ cuộn nấm, sốt chấm Ssamjang, xà lách sạch và kim chi Hàn Quốc', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2502, name: 'Khay Dẻ Sườn Bò Mỹ Ướp Sốt Mật Ong (300g)', price: '229.000 đ', priceNum: 229000, description: 'Dẻ sườn bò rút xương vân mỡ óng ánh tẩm sốt trái cây mật ong', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2503, name: 'Canh Kim Chi Thịt Heo Nóng Hổi', price: '69.000 đ', priceNum: 69000, description: 'Canh kim chi chua cay ăn kèm cơm trắng nóng hổi', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2504, name: 'Cơm Trộn Bát Đá Hàn Quốc (Bibimbap)', price: '79.000 đ', priceNum: 79000, description: 'Cơm trộn thịt bò băm, rau củ và tương ớt Gochujang', image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2505, name: 'Trà Gạo Rang Hàn Quốc', price: '25.000 đ', priceNum: 25000, description: 'Trà gạo lứt rang thơm dịu thanh lọc mỡ thừa', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 26,
    name: 'Bò Nướng Mã Mây - Xuân Xuân Phố Cổ',
    category: 'Thịt nướng & BBQ',
    description: 'Quán bò nướng chảo bơ than hoa huyền thoại phố cổ Mã Mây, bơ vàng thơm nức cả góc phố.',
    address: '47 Mã Mây, P. Hàng Buồm, Q. Hoàn Kiếm, Hà Nội',
    phone: '0901234026',
    price: '100.000 - 200.000 đ',
    rating: 4.7,
    reviewsCount: 44,
    image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '16:00 - 23:30',
    isOpen: true,
    featured: false,
    lat: 21.0348,
    lng: 105.8525,
    mapUrl: 'https://maps.google.com/?q=21.0348,105.8525',
    menu: [
      { id: 2601, name: 'Set Bò Nầm Nướng Chảo Bơ (2 người)', price: '200.000 đ', priceNum: 200000, description: 'Gồm thịt bò tươi thái mỏng, nầm heo giòn sần sật, bơ Tường An, bánh mì phết bơ và sốt me chua ngọt', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2602, name: 'Đĩa Nầm Heo Nướng Thêm (200g)', price: '85.000 đ', priceNum: 85000, description: 'Nầm giòn tươi ướp gia vị đậm đà không tanh', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2603, name: 'Bánh Mì Nướng Bơ Mật Ong (Cái)', price: '10.000 đ', priceNum: 10000, description: 'Bánh mì nướng trên chảo bơ nóng giòn rụm', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2604, name: 'Bia Trúc Bạch Hà Nội (Lon)', price: '25.000 đ', priceNum: 25000, description: 'Bia truyền thống đắng thanh uống kèm đồ nướng cực đã', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 8. ĐỒ ĂN VẶT & TRÁNG MIỆNG ---
  {
    id: 27,
    name: 'Bánh Cuốn Bà Hoành - Tô Hiến Thành',
    category: 'Đồ ăn vặt & Tráng miệng',
    description: 'Quán bánh cuốn gia truyền lâu đời nhất Hà Nội, bánh tráng mỏng tang nguội thơm mát, chả quế nướng than hoa béo ngậy.',
    address: '66 Tô Hiến Thành, P. Bùi Thị Xuân, Q. Hai Bà Trưng, Hà Nội',
    phone: '0911234027',
    price: '35.000 - 65.000 đ',
    rating: 4.8,
    reviewsCount: 60,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '06:00 - 20:00',
    isOpen: true,
    featured: true,
    lat: 21.0142,
    lng: 105.8501,
    mapUrl: 'https://maps.google.com/?q=21.0142,105.8501',
    menu: [
      { id: 2701, name: 'Suất Bánh Cuốn Chả Quế Đặc Biệt', price: '50.000 đ', priceNum: 50000, description: 'Bánh tráng tay mỏng tang mềm mướt rắc hành phi thơm nức, chấm nước mắm cà cuống thơm lừng', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2702, name: 'Bánh Cuốn Nhân Thịt Mộc Nhĩ Tươi', price: '45.000 đ', priceNum: 45000, description: 'Nhân thịt nạc vai xào nấm mèo giòn sần sật', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2703, name: 'Đĩa Chả Cốm Nóng Hổi Thêm', price: '25.000 đ', priceNum: 25000, description: 'Chả cốm chiên phồng béo ngọt', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2704, name: 'Sữa Đậu Nành Tươi Nóng', price: '12.000 đ', priceNum: 12000, description: 'Sữa đậu hạt nguyên chất béo ngậy thơm phức', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 28,
    name: 'Chè Chang Hi - Chè Ngon Sáng Tạo Đống Đa',
    category: 'Đồ ăn vặt & Tráng miệng',
    description: 'Thế giới chè hiện đại ít ngọt tốt cho sức khỏe, chè thốt nốt sầu riêng kem béo ngậy nức tiếng giới trẻ.',
    address: '113 Xã Đàn, P. Phương Liên, Q. Đống Đa, Hà Nội',
    phone: '0981234028',
    price: '25.000 - 45.000 đ',
    rating: 4.7,
    reviewsCount: 38,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    openHours: '09:00 - 22:30',
    isOpen: true,
    featured: false,
    lat: 21.0145,
    lng: 105.8362,
    mapUrl: 'https://maps.google.com/?q=21.0145,105.8362',
    menu: [
      { id: 2801, name: 'Chè Thốt Nốt Sầu Riêng Dừa Dầm', price: '38.000 đ', priceNum: 38000, description: 'Thịt sầu riêng Ri6 tươi thơm nức, hạt thốt nốt giòn dẻo chan nước cốt dừa béo mịn', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2802, name: 'Chè Bưởi An Giang Giòn Sần Sật', price: '30.000 đ', priceNum: 30000, description: 'Cùi bưởi khử đắng giòn trong veo, đậu xanh xào bùi béo', image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2803, name: 'Tàu Hũ Trân Châu Đường Đen', price: '28.000 đ', priceNum: 28000, description: 'Tàu hũ non núng nính tan trong miệng cùng trân châu dai mềm', image: 'https://images.unsplash.com/photo-1558857563-b37cfb292e10?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2804, name: 'Chè Khúc Bạch Phô Mai Hạnh Nhân', price: '35.000 đ', priceNum: 35000, description: 'Từng viên khúc bạch phô mai sữa béo ngậy kèm nhãn tươi mọng nước', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 29,
    name: 'Nem Chua Rán Tạm Thương - Hàng Bông',
    category: 'Đồ ăn vặt & Tráng miệng',
    description: 'Con ngõ Tạm Thương nổi danh đất Hà Thành với món nem chua rán bọc bột giòn rụm bên ngoài, dẻo ngọt bên trong.',
    address: '36 Ngõ Tạm Thương, P. Hàng Bông, Q. Hoàn Kiếm, Hà Nội',
    phone: '0931234029',
    price: '30.000 - 80.000 đ',
    rating: 4.8,
    reviewsCount: 50,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '09:00 - 23:00',
    isOpen: true,
    featured: false,
    lat: 21.0312,
    lng: 105.8471,
    mapUrl: 'https://maps.google.com/?q=21.0312,105.8471',
    menu: [
      { id: 2901, name: 'Đĩa Nem Chua Rán Giòn (10 chiếc)', price: '60.000 đ', priceNum: 60000, description: 'Nem chua lăn bột chiên vàng ruộm, chấm tương ớt cay nồng ăn kèm dưa chuột xoài xanh', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2902, name: 'Đĩa Khoai Tây Chiên Bơ Tỏi Lắc Phô Mai', price: '35.000 đ', priceNum: 35000, description: 'Khoai tây giòn rụm thơm lừng hương bơ tỏi', image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2903, name: 'Cá Bò Khô Nướng Than Hoa', price: '45.000 đ', priceNum: 45000, description: 'Cá bò dai ngọt nướng vàng thơm', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 2904, name: 'Trà Chanh Đào Hà Nội Đá', price: '15.000 đ', priceNum: 15000, description: 'Trà chanh truyền thống phố cổ giải khát tức thì', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 9. TRÀ SỮA & CÀ PHÊ ---
  {
    id: 30,
    name: 'Phúc Long Coffee & Tea - Vincom Center Phạm Ngọc Thạch',
    category: 'Trà sữa & Cà phê',
    description: 'Thương hiệu trà và cà phê đậm vị danh tiếng từ năm 1968, trà đào cam sả và trà sữa Ô Long thơm lừng khó quên.',
    address: 'Tầng 1 Vincom Center, 2 Phạm Ngọc Thạch, Q. Đống Đa, Hà Nội',
    phone: '02871001968',
    price: '40.000 - 75.000 đ',
    rating: 4.8,
    reviewsCount: 62,
    image: 'https://images.unsplash.com/photo-1558857563-b37cfb292e10?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
    openHours: '08:00 - 22:30',
    isOpen: true,
    featured: true,
    lat: 21.0078,
    lng: 105.8329,
    mapUrl: 'https://maps.google.com/?q=21.0078,105.8329',
    menu: [
      { id: 3001, name: 'Trà Đào Cam Sả Phúc Long Trứ Danh (Ly Lớn)', price: '60.000 đ', priceNum: 60000, description: 'Vị trà đen đậm chất Phúc Long, miếng đào giòn ngọt và tinh dầu cam sả thơm phức', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3002, name: 'Trà Sữa Phúc Long Đậm Vị Truyền Thống', price: '55.000 đ', priceNum: 55000, description: 'Trà đen Bảo Lộc ủ lâu năm hòa quyện sữa béo ngậy', image: 'https://images.unsplash.com/photo-1558857563-b37cfb292e10?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3003, name: 'Cà Phê Sữa Đá Đậm Đà Phong Cách Việt', price: '45.000 đ', priceNum: 45000, description: 'Cà phê Robusta thơm nồng pha phin truyền thống', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3004, name: 'Bánh Mì Croissant Bơ Tươi Nóng Giòn', price: '35.000 đ', priceNum: 35000, description: 'Bánh sừng bò ngàn lớp thơm phức mùi bơ Pháp', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 31,
    name: 'Cà Phê Giảng - 39 Nguyễn Hữu Huân',
    category: 'Trà sữa & Cà phê',
    description: 'Nơi khai sinh ra món Cà phê trứng trứ danh đất Hà Thành từ năm 1946, bọt trứng sánh mịn thơm béo ngậy.',
    address: '39 Nguyễn Hữu Huân, P. Lý Thái Tổ, Q. Hoàn Kiếm, Hà Nội',
    phone: '0981234031',
    price: '35.000 - 60.000 đ',
    rating: 4.9,
    reviewsCount: 75,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
    openHours: '07:00 - 22:00',
    isOpen: true,
    featured: true,
    lat: 21.0339,
    lng: 105.8542,
    mapUrl: 'https://maps.google.com/?q=21.0339,105.8542',
    menu: [
      { id: 3101, name: 'Cà Phê Trứng Nóng Truyền Thống Cụ Giảng', price: '40.000 đ', priceNum: 40000, description: 'Lớp kem trứng đánh bông mịn như mây đặt trên cốc cà phê phin đậm đà ngâm trong bát nước nóng', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3102, name: 'Cacao Trứng Nóng Ngọt Ngào', price: '40.000 đ', priceNum: 40000, description: 'Cacao nguyên chất béo thơm dành cho bạn không uống được cà phê', image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3103, name: 'Matcha Trứng Trà Xanh Nhật Bản', price: '45.000 đ', priceNum: 45000, description: 'Bột trà xanh Nhật Bản hòa quyện lớp kem trứng béo mịn', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3104, name: 'Cà Phê Nâu Đá Hà Nội Cổ Điển', price: '30.000 đ', priceNum: 30000, description: 'Cà phê nguyên chất đậm đà sữa đặc ngọt ngào', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 10. MÓN CHAY THANH TỊNH ---
  {
    id: 32,
    name: 'Cơm Chay An Lạc - Trần Hưng Đạo',
    category: 'Món Chay thanh tịnh',
    description: 'Ẩm thực chay thanh tịnh, chế biến 100% từ rau củ quả tươi sạch thuần tự nhiên tốt cho sức khỏe và tâm hồn.',
    address: '109 Trần Hưng Đạo, P. Cửa Nam, Q. Hoàn Kiếm, Hà Nội',
    phone: '0971234032',
    price: '40.000 - 150.000 đ',
    rating: 4.8,
    reviewsCount: 36,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    openHours: '09:00 - 21:00',
    isOpen: true,
    featured: false,
    lat: 21.0232,
    lng: 105.8436,
    mapUrl: 'https://maps.google.com/?q=21.0232,105.8436',
    menu: [
      { id: 3201, name: 'Cơm Chay Thập Cẩm An Lạc', price: '50.000 đ', priceNum: 50000, description: 'Mâm cơm gồm nấm kho tiêu gừng, sườn non chay rim dứa, đậu hũ sốt cà chua và canh chua nấm', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3202, name: 'Nem Nấm Chay Rán Giòn Rụm', price: '60.000 đ', priceNum: 60000, description: 'Cuốn từ nấm hương, mộc nhĩ, cà rốt và miến dong chiên vàng rụm', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3203, name: 'Nấm Đùi Gà Kho Tiêu Nồi Đất', price: '65.000 đ', priceNum: 65000, description: 'Nấm đùi gà tươi kho quẹt kẹo kẹo thơm cay vị tiêu xanh Phú Quốc', image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3204, name: 'Canh Rong Biển Hạt Sen Thanh Tịnh', price: '35.000 đ', priceNum: 35000, description: 'Hạt sen Huế bùi ngọt nấu cùng rong biển thanh mát', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3205, name: 'Trà Hoa Cúc Mật Ong Thanh Nhiệt', price: '20.000 đ', priceNum: 20000, description: 'Hoa cúc sấy lạnh kết hợp mật ong ngọt dịu an thần', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 33,
    name: 'Ưu Đàm Chay - Hàng Bài',
    category: 'Món Chay thanh tịnh',
    description: 'Không gian ẩm thực chay cao cấp và thiền vị, nơi nghệ thuật ẩm thực chay đạt đến độ tinh tế hoàn mỹ.',
    address: '34 Hàng Bài, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội',
    phone: '0981234033',
    price: '100.000 - 350.000 đ',
    rating: 4.9,
    reviewsCount: 48,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    openHours: '10:00 - 21:30',
    isOpen: true,
    featured: true,
    lat: 21.0215,
    lng: 105.8529,
    mapUrl: 'https://maps.google.com/?q=21.0215,105.8529',
    menu: [
      { id: 3301, name: 'Cơm Chiên Lá Sen Ưu Đàm', price: '95.000 đ', priceNum: 95000, description: 'Hạt cơm thơm lừng bọc trong lá sen tươi hấp cùng hạt sen, nấm đông cô và củ sen thái hạt lựu', image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3302, name: 'Lẩu Nấm Thảo Mộc Ưu Đàm (Set 2 người)', price: '280.000 đ', priceNum: 280000, description: 'Nước dùng thanh tao nấu từ lê, táo đỏ, kỷ tử và các loại nấm quý tươi ngọt', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3303, name: 'Đậu Hũ Non Sốt Nấm Truffle', price: '120.000 đ', priceNum: 120000, description: 'Đậu hũ tự làm mềm tan quyện sốt nấm Truffle đen quý phái', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3304, name: 'Trà Sen Tây Hồ Thượng Hạng', price: '55.000 đ', priceNum: 55000, description: 'Trà ướp gạo sen bách diệp Tây Hồ ngát hương thanh khiết', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },

  // --- 11. ĐẶC SẢN VÙNG MIỀN ---
  {
    id: 34,
    name: 'Chả Cá Lã Vọng - 14 Chả Cá',
    category: 'Đặc sản vùng miền',
    description: 'Di sản ẩm thực lâu đời hơn 100 năm của thủ đô, cá lăng tươi nướng vàng thơm chảo mỡ sôi sùng sục cùng thì là và hành hoa.',
    address: '14 Chả Cá, P. Hàng Bồ, Q. Hoàn Kiếm, Hà Nội',
    phone: '02438253929',
    price: '150.000 - 250.000 đ',
    rating: 4.9,
    reviewsCount: 82,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '11:00 - 14:00, 17:00 - 21:30',
    isOpen: true,
    featured: true,
    lat: 21.0355,
    lng: 105.8492,
    mapUrl: 'https://maps.google.com/?q=21.0355,105.8492',
    menu: [
      { id: 3401, name: 'Suất Chả Cá Lăng Lã Vọng Thượng Hạng', price: '180.000 đ', priceNum: 180000, description: 'Cá lăng sông nướng than hoa, xào nóng tại bàn cùng thì là, hành củ ăn kèm bún Phú Đô, lạc rang và mắm tôm đánh sủi bọt', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3402, name: 'Dạ Dày Cá Lăng Xào Thì Là', price: '130.000 đ', priceNum: 130000, description: 'Dạ dày cá giòn sần sật xào hành thì là thơm phức', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3403, name: 'Đĩa Bún Phú Đô & Lạc Rang Thêm', price: '20.000 đ', priceNum: 20000, description: 'Sợi bún tươi mềm mướt và lạc rang giòn bùi', image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3404, name: 'Bia Hơi Hà Nội Cổ Điển (Cốc)', price: '15.000 đ', priceNum: 15000, description: 'Bia hơi rót cốc vại thủy tinh bọt trắng mịn màng', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  },
  {
    id: 35,
    name: 'Bánh Tôm Hồ Tây - Đường Thanh Niên',
    category: 'Đặc sản vùng miền',
    description: 'Biểu tượng ẩm thực gắn liền ký ức người Hà Nội bên bờ Hồ Tây lộng gió, tôm tươi giòn ngọt bọc bột khoai chiên vàng giòn rụm.',
    address: 'Số 1 đường Thanh Niên, P. Yên Phụ, Q. Tây Hồ, Hà Nội',
    phone: '02438293737',
    price: '70.000 - 150.000 đ',
    rating: 4.7,
    reviewsCount: 46,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    openHours: '09:00 - 22:00',
    isOpen: true,
    featured: true,
    lat: 21.0456,
    lng: 105.8368,
    mapUrl: 'https://maps.google.com/?q=21.0456,105.8368',
    menu: [
      { id: 3501, name: 'Đĩa Bánh Tôm Hồ Tây Truyền Thống (4 cái)', price: '90.000 đ', priceNum: 90000, description: 'Tôm sông ngọt lịm nằm trên lớp bột khoai lang bào sợi chiên vàng giòn rụm, chấm nước mắm chua ngọt đu đủ', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3502, name: 'Ốc Hấp Sả Lá Gừng Hồ Tây', price: '75.000 đ', priceNum: 75000, description: 'Ốc nhồi to béo hấp cùng gừng sả thơm lừng chấm mắm gừng cay xè', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3503, name: 'Nem Hải Sản Chiên Xù', price: '80.000 đ', priceNum: 80000, description: 'Tôm mực tươi sốt mayonnaise chiên xù vàng óng', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80', isAvailable: true },
      { id: 3504, name: 'Dừa Xiêm Tươi Bến Tre Nguyên Trái', price: '35.000 đ', priceNum: 35000, description: 'Nước dừa ngọt thanh mát lạnh', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', isAvailable: true }
    ]
  }
];
