export type Lang = string;

export interface LangMeta {
  flag: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Record<string, LangMeta> = {
  vi:  { flag: "🇻🇳", name: "Vietnamese",   nativeName: "Tiếng Việt" },
  en:  { flag: "🇬🇧", name: "English",       nativeName: "English" },
  zh:  { flag: "🇨🇳", name: "Chinese",       nativeName: "中文" },
  ko:  { flag: "🇰🇷", name: "Korean",        nativeName: "한국어" },
  ja:  { flag: "🇯🇵", name: "Japanese",      nativeName: "日本語" },
  th:  { flag: "🇹🇭", name: "Thai",          nativeName: "ภาษาไทย" },
  id:  { flag: "🇮🇩", name: "Indonesian",    nativeName: "Bahasa Indonesia" },
  ms:  { flag: "🇲🇾", name: "Malay",         nativeName: "Bahasa Malaysia" },
  fil: { flag: "🇵🇭", name: "Filipino",      nativeName: "Filipino" },
  ru:  { flag: "🇷🇺", name: "Russian",       nativeName: "Русский" },
  es:  { flag: "🇪🇸", name: "Spanish",       nativeName: "Español" },
  pt:  { flag: "🇧🇷", name: "Portuguese",    nativeName: "Português" },
  fr:  { flag: "🇫🇷", name: "French",        nativeName: "Français" },
  de:  { flag: "🇩🇪", name: "German",        nativeName: "Deutsch" },
  hi:  { flag: "🇮🇳", name: "Hindi",         nativeName: "हिन्दी" },
  ar:  { flag: "🇸🇦", name: "Arabic",        nativeName: "العربية" },
  tr:  { flag: "🇹🇷", name: "Turkish",       nativeName: "Türkçe" },
  it:  { flag: "🇮🇹", name: "Italian",       nativeName: "Italiano" },
  nl:  { flag: "🇳🇱", name: "Dutch",         nativeName: "Nederlands" },
  pl:  { flag: "🇵🇱", name: "Polish",        nativeName: "Polski" },
};

type Translations = {
  // ── Menu buttons ────────────────────────────────────────────────
  menuProfile: string;
  menuGames: string;
  menuReferral: string;
  menuRanking: string;
  menuEvents: string;
  menuCommission: string;
  menuSupport: string;
  menuLanguage: string;
  menuPrompt: string;

  // ── Language menu ────────────────────────────────────────────────
  langTitle: string;
  langChanged: string;
  langCurrent: string;

  // ── Common ───────────────────────────────────────────────────────
  errGeneral: string;
  errUserNotFound: string;
  errInsufficient: string;
  loading: string;
  balance: string;
  remainingBalance: string;
  betAmount: string;
  winAmount: string;
  totalLabel: string;
  dateLabel: string;
  luckyNext: string;

  // ── Lô Đề ────────────────────────────────────────────────────────
  lodeBetSuccess: string;
  lodeNumbers: string;
  lodeEach: string;
  lodeIfWin: string;
  lodeSet: string;
  lodePoints: string;
  lodeMinErr: string;
  lodeClosed: string;
  lodeCloseDetail: string;
  lodeClosesSoon: string;
  lodeClosesSoonDetail: string;
  lodeViewPending: string;
  lodeMyBetsTitle: string;
  lodeMyBetsEmpty: string;
  lodeMyBetsEmptyHint: string;
  lodeMyBetsMin: string;
  lodeTotalBet: string;
  lodePending: string;
  lodeResultsTitle: string;
  lodeWonLabel: string;
  lodeLostLabel: string;
  lodeTotalWon: string;

  // ── Deposit ──────────────────────────────────────────────────────
  depositTitle: string;
  depositSuccess: string;
  depositPending: string;
  depositPrompt: string;
  depositBank: string;
  depositCard: string;

  // ── Withdrawal ───────────────────────────────────────────────────
  withdrawTitle: string;
  withdrawSuccess: string;
  withdrawPending: string;

  // ── Profile / Account ────────────────────────────────────────────
  profileTitle: string;
  profileName: string;
  profileVault: string;
  profileVaultNotSet: string;
  profileGames: string;
  profileCommission: string;
  profileGiftcode: string;
  profileGiftcodeUsed: string;
  profileGiftcodeNotUsed: string;
  profileAttendance: string;
  profileDays: string;
  profilePrompt: string;

  // ── Buttons ──────────────────────────────────────────────────────
  btnDeposit: string;
  btnWithdraw: string;
  btnBuyGiftcode: string;
  btnEnterGiftcode: string;
  btnDepositHistory: string;
  btnWithdrawHistory: string;
  btnRedEnvelope: string;
  btnBetHistory: string;
  btnVipLevel: string;
  btnTransfer: string;
  btnVault: string;
  btnBack: string;

  // ── Game menu ────────────────────────────────────────────────────
  gameMenuTitle: string;
  gameMenuPrompt: string;
  gameBasketball: string;
  gameFootball: string;
  gameMaybay: string;

  // ── Support ──────────────────────────────────────────────────────
  supportTitle: string;
  supportBody: string;
  supportBtnTelegram: string;

  // ── Help (full text) ─────────────────────────────────────────────
  helpFull: string;

  // ── Start / linking ──────────────────────────────────────────────
  startCaption: string;
  wlinkTitle: string;
  wlinkPrompt: string;
  wlinkBtn: string;
};

const t: Record<string, Translations> = {

  // ════════════════════════════════════════════════════════════════
  vi: {
    menuProfile:    "👤 Hồ Sơ",
    menuGames:      "🎮 Trò Chơi",
    menuReferral:   "🎁 Giới Thiệu",
    menuRanking:    "🏆 Xếp Hạng",
    menuEvents:     "🎊 Sự Kiện",
    menuCommission: "💰 Hoa Hồng",
    menuSupport:    "🆘 Hỗ Trợ",
    menuLanguage:   "🌐 Ngôn Ngữ",
    menuPrompt:     "✨ Chọn chức năng bên dưới để bắt đầu.",
    langTitle:      "🌐 <b>Chọn ngôn ngữ / Select language</b>",
    langChanged:    "✅ Đã đổi ngôn ngữ sang",
    langCurrent:    "Ngôn ngữ hiện tại",
    errGeneral:     "❌ Có lỗi xảy ra. Vui lòng thử lại!",
    errUserNotFound:"❌ Không tìm thấy thông tin tài khoản.",
    errInsufficient:"❌ Số dư không đủ!",
    loading:        "⏳ Đang xử lý...",
    balance:        "💎 Số dư",
    remainingBalance:"💎 Số dư còn lại",
    betAmount:      "💸 Tiền cược",
    winAmount:      "🏆 Tiền thắng",
    totalLabel:     "💸 Tổng",
    dateLabel:      "📅 Kết quả XSMB hôm nay",
    luckyNext:      "💡 Chúc may mắn lần sau! Đặt cược mới bắt đầu từ 00:00.",
    lodeBetSuccess: "✅ ĐẶT CƯỢC {type} THÀNH CÔNG!",
    lodeNumbers:    "🔢 Số đã cược",
    lodeEach:       "🎯 Mỗi số",
    lodeIfWin:      "🏆 Nếu trúng",
    lodeSet:        "🔢 Bộ số",
    lodePoints:     "điểm",
    lodeMinErr:     "❌ Tổng tiền cược tối thiểu <b>{min}đ</b>!",
    lodeClosed:     "⏰ <b>Đã hết giờ cược hôm nay!</b>",
    lodeCloseDetail:"Kết quả XSMB đã ra. Vui lòng đặt cược ngày mai.\n💡 Gõ <code>XSMB</code> để xem kết quả hôm nay.",
    lodeClosesSoon: "⏰ <b>Sắp hết giờ cược!</b>",
    lodeClosesSoonDetail: "Không nhận cược mới sau 18:25. Gõ <code>XSMB</code> để xem kết quả.",
    lodeViewPending:"💡 Gõ <code>CUOCLO</code> để xem cược đang chờ.",
    lodeMyBetsTitle:"📋 <b>Cược Lô Đề hôm nay ({date})</b>",
    lodeMyBetsEmpty:"Bạn chưa có cược nào hôm nay.",
    lodeMyBetsEmptyHint:"💡 Cú pháp đặt cược:\n• <code>/lo 00 10d</code> — Lô (x80, 23,000đ/điểm)\n• <code>/de 00 10d</code> — Đề (x90, 1,000đ/điểm)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Tối thiểu 2,000đ/lệnh",
    lodeTotalBet:   "💸 Tổng tiền cược",
    lodePending:    "⏰ Kết quả cập nhật tự động sau 18:30!",
    lodeResultsTitle:"🎰 <b>KẾT QUẢ CỦA BẠN - {date}</b>",
    lodeWonLabel:   "🏆 <b>TRÚNG THƯỞNG:</b>",
    lodeLostLabel:  "😢 <b>Không trúng:</b>",
    lodeTotalWon:   "💎 Tổng tiền thưởng:",
    depositTitle:   "💳 NẠP TIỀN",
    depositSuccess: "✅ Nạp tiền thành công!",
    depositPending: "⏳ Đang xử lý nạp tiền...",
    depositPrompt:  "Chọn phương thức nạp tiền:",
    depositBank:    "🏦 Ngân Hàng",
    depositCard:    "🎫 Thẻ Cào",
    withdrawTitle:  "🏦 Rút tiền",
    withdrawSuccess:"✅ Rút tiền thành công!",
    withdrawPending:"⏳ Đang xử lý yêu cầu rút tiền...",
    profileTitle:   "👤 <b>𝗛𝗢̂̀ 𝗦𝗢̛ 𝗛𝗔𝗥𝗨𝟴𝟴:</b>",
    profileName:    "Tên",
    profileVault:   "Cất Két",
    profileVaultNotSet: "chưa thiết lập",
    profileGames:   "Số ván",
    profileCommission: "Hoa hồng",
    profileGiftcode: "Giftcode",
    profileGiftcodeUsed: "✅ Đã dùng",
    profileGiftcodeNotUsed: "❌ Chưa",
    profileAttendance: "Điểm danh",
    profileDays:    "ngày",
    profilePrompt:  "✨ Chọn chức năng bên dưới để tiếp tục ✨",
    btnDeposit:     "🏦 Nạp Tiền",
    btnWithdraw:    "🏦 Rút Tiền",
    btnBuyGiftcode: "🎁 Mua Gifcode",
    btnEnterGiftcode: "🎉 Nhập Gifcode",
    btnDepositHistory: "📜 Lịch Sử Nạp",
    btnWithdrawHistory: "📜 Lịch Sử Rút",
    btnRedEnvelope: "🧧 LÌ XÌ",
    btnBetHistory:  "📊 Lịch Sử Cược",
    btnVipLevel:    "👑 CẤP VIP",
    btnTransfer:    "💸 Chuyển tiền",
    btnVault:       "🔐 Cất Két",
    btnBack:        "↩️ Quay Lại",
    gameMenuTitle:  "🎮 <b>KHU VỰC TRÒ CHƠI</b>",
    gameMenuPrompt: "Chọn trò chơi để bắt đầu:",
    gameBasketball: "🏀 Bóng Rổ 🏀",
    gameFootball:   "⚽️ Bóng Đá ⚽️",
    gameMaybay:     "✈️ Máy Bay",
    supportTitle:   "🆘 <b>HỖ TRỢ KHÁCH HÀNG</b> 🆘",
    supportBody:    "ẤN CÁC NÚT BÊN DƯỚI ĐỂ NHẬN HỖ TRỢ!\n\n🕰 Hỗ trợ 24/7 - Tất cả các ngày trong tuần",
    supportBtnTelegram: "📱 Telegram Hỗ Trợ",
    helpFull:
      `📖 <b>HƯỚNG DẪN SỬ DỤNG BOT HARU88</b>\n\n` +
      `💰 <b>NẠP TIỀN</b>\n` +
      `• /nap — Mở menu nạp tiền\n` +
      `• Nạp qua chuyển khoản ngân hàng, thẻ cào\n\n` +
      `💸 <b>RÚT TIỀN</b>\n` +
      `• /caidatbank — Cài đặt ngân hàng để rút tự động\n` +
      `• /rut [SỐ TIỀN] — Rút về ngân hàng đã liên kết\n` +
      `• /rut all — Rút toàn bộ số dư về ngân hàng đã liên kết\n` +
      `  Lưu ý: phí 1% số tiền rút, đổi ngân hàng mất 25,000đ.\n` +
      `⚠️ Rút MoMo/ZaloPay: <b>sai thông tin tiền vẫn trừ — kiểm tra kỹ!</b>\n\n` +
      `🎮 <b>TRÒ CHƠI</b>\n` +
      `• Tài Xỉu: gõ <code>T [tiền]</code> hoặc <code>X [tiền]</code>\n` +
      `• Lô đề: /lode — đoán 2 số\n` +
      `• Xúc xắc, Bowling, Bóng rổ, Bóng đá...\n` +
      `• Cược min: 1,000đ | max: 1,000,000đ\n\n` +
      `🎁 <b>GIFTCODE</b>\n` +
      `• /code [mã] — Nhập giftcode\n` +
      `  VD: <code>/code HARU88XYZ</code>\n\n` +
      `👤 <b>TÀI KHOẢN</b>\n` +
      `• /sd — Xem số dư\n` +
      `• /start — Mở menu chính\n` +
      `• /thongke — Thống kê cá nhân\n` +
      `• /chuyen [ID] [Số tiền] — Chuyển tiền cho người chơi khác\n\n` +
      `🏆 <b>ĐẶC QUYỀN VIP</b>\n` +
      `• /doidiemvip [số điểm] — Đổi điểm lấy tiền\n` +
      `• /homqua — Nhận thưởng hằng tuần\n\n` +
      `💼 <b>LIÊN KẾT NGÂN HÀNG</b>\n` +
      `• /rutbank → bấm "Cài đặt ngân hàng"\n` +
      `• Sau khi liên kết, chỉ cần nhập số tiền mỗi lần rút\n\n` +
      `🆘 <b>HỖ TRỢ</b>\n` +
      `• /hotro — Liên hệ hỗ trợ`,
    startCaption:   "🎫 ID của bạn là: {id}\n\n👉 Tham gia Room TX để săn hũ và nhận giftcode hằng ngày https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Liên kết tài khoản Haru88 Web</b>",
    wlinkPrompt:    "Để hoàn tất liên kết, hãy chia sẻ số điện thoại của bạn.\n📱 Nhấn nút <b>\"Gửi số điện thoại\"</b> bên dưới.",
    wlinkBtn:       "📱 Gửi số điện thoại",
  },

  // ════════════════════════════════════════════════════════════════
  en: {
    menuProfile:    "👤 Profile",
    menuGames:      "🎮 Games",
    menuReferral:   "🎁 Referral",
    menuRanking:    "🏆 Ranking",
    menuEvents:     "🎊 Events",
    menuCommission: "💰 Commission",
    menuSupport:    "🆘 Support",
    menuLanguage:   "🌐 Language",
    menuPrompt:     "✨ Select a feature below to get started.",
    langTitle:      "🌐 <b>Select language / Chọn ngôn ngữ</b>",
    langChanged:    "✅ Language changed to",
    langCurrent:    "Current language",
    errGeneral:     "❌ An error occurred. Please try again!",
    errUserNotFound:"❌ Account not found.",
    errInsufficient:"❌ Insufficient balance!",
    loading:        "⏳ Processing...",
    balance:        "💎 Balance",
    remainingBalance:"💎 Remaining balance",
    betAmount:      "💸 Bet amount",
    winAmount:      "🏆 Win amount",
    totalLabel:     "💸 Total",
    dateLabel:      "📅 XSMB result today",
    luckyNext:      "💡 Better luck next time! New bets start at 00:00.",
    lodeBetSuccess: "✅ {type} BET PLACED SUCCESSFULLY!",
    lodeNumbers:    "🔢 Numbers bet",
    lodeEach:       "🎯 Each number",
    lodeIfWin:      "🏆 If won",
    lodeSet:        "🔢 Number set",
    lodePoints:     "pts",
    lodeMinErr:     "❌ Minimum total bet is <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Betting is closed for today!</b>",
    lodeCloseDetail:"XSMB result has been drawn. Please place bets tomorrow.\n💡 Type <code>XSMB</code> to see today's result.",
    lodeClosesSoon: "⏰ <b>Betting closes soon!</b>",
    lodeClosesSoonDetail: "No new bets accepted after 18:25. Type <code>XSMB</code> to see the result.",
    lodeViewPending:"💡 Type <code>CUOCLO</code> to view pending bets.",
    lodeMyBetsTitle:"📋 <b>Today's Lottery Bets ({date})</b>",
    lodeMyBetsEmpty:"You have no bets placed today.",
    lodeMyBetsEmptyHint:"💡 Bet syntax:\n• <code>/lo 00 10d</code> — Lô (x80, 23,000₫/pt)\n• <code>/de 00 10d</code> — Đề (x90, 1,000₫/pt)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimum 2,000₫ per order",
    lodeTotalBet:   "💸 Total bet",
    lodePending:    "⏰ Results update automatically after 18:30!",
    lodeResultsTitle:"🎰 <b>YOUR RESULTS - {date}</b>",
    lodeWonLabel:   "🏆 <b>WINNER:</b>",
    lodeLostLabel:  "😢 <b>Not won:</b>",
    lodeTotalWon:   "💎 Total prize:",
    depositTitle:   "💳 DEPOSIT",
    depositSuccess: "✅ Deposit successful!",
    depositPending: "⏳ Processing deposit...",
    depositPrompt:  "Choose your deposit method:",
    depositBank:    "🏦 Bank Transfer",
    depositCard:    "🎫 Scratch Card",
    withdrawTitle:  "🏦 Withdrawal",
    withdrawSuccess:"✅ Withdrawal successful!",
    withdrawPending:"⏳ Processing withdrawal request...",
    profileTitle:   "👤 <b>HARU88 PROFILE:</b>",
    profileName:    "Name",
    profileVault:   "Vault",
    profileVaultNotSet: "not set up",
    profileGames:   "Games played",
    profileCommission: "Commission",
    profileGiftcode: "Giftcode",
    profileGiftcodeUsed: "✅ Used",
    profileGiftcodeNotUsed: "❌ Not used",
    profileAttendance: "Attendance",
    profileDays:    "days",
    profilePrompt:  "✨ Choose a feature below to continue ✨",
    btnDeposit:     "🏦 Deposit",
    btnWithdraw:    "🏦 Withdraw",
    btnBuyGiftcode: "🎁 Buy Giftcode",
    btnEnterGiftcode: "🎉 Enter Giftcode",
    btnDepositHistory: "📜 Deposit History",
    btnWithdrawHistory: "📜 Withdraw History",
    btnRedEnvelope: "🧧 Red Envelope",
    btnBetHistory:  "📊 Bet History",
    btnVipLevel:    "👑 VIP LEVEL",
    btnTransfer:    "💸 Transfer",
    btnVault:       "🔐 Vault",
    btnBack:        "↩️ Back",
    gameMenuTitle:  "🎮 <b>GAME ZONE</b>",
    gameMenuPrompt: "Choose a game to start:",
    gameBasketball: "🏀 Basketball 🏀",
    gameFootball:   "⚽️ Football ⚽️",
    gameMaybay:     "✈️ Crash Game",
    supportTitle:   "🆘 <b>CUSTOMER SUPPORT</b> 🆘",
    supportBody:    "PRESS THE BUTTONS BELOW FOR SUPPORT!\n\n🕰 Available 24/7 - Every day of the week",
    supportBtnTelegram: "📱 Telegram Support",
    helpFull:
      `📖 <b>HARU88 BOT USER GUIDE</b>\n\n` +
      `💰 <b>DEPOSIT</b>\n` +
      `• /nap — Open deposit menu\n` +
      `• Deposit via bank transfer or scratch card\n\n` +
      `💸 <b>WITHDRAW</b>\n` +
      `• /rutbank — Withdraw via linked bank account\n` +
      `• /rutmomo [Name] [MoMo phone] [Amount]\n` +
      `  e.g. <code>/rutmomo JOHN DOE 0901234567 200000</code>\n` +
      `• /rutzalo [Name] [ZaloPay phone] [Amount]\n` +
      `⚠️ MoMo/ZaloPay: <b>wrong info still deducts — double check!</b>\n\n` +
      `🎮 <b>GAMES</b>\n` +
      `• Tài Xỉu: type <code>T [amount]</code> or <code>X [amount]</code>\n` +
      `• Lottery: /lode — predict 2 numbers\n` +
      `• Dice, Bowling, Basketball, Football...\n` +
      `• Min bet: 1,000₫ | Max: 1,000,000₫\n\n` +
      `🎁 <b>GIFTCODE</b>\n` +
      `• /code [code] — Enter a giftcode\n` +
      `  e.g. <code>/code HARU88XYZ</code>\n\n` +
      `👤 <b>ACCOUNT</b>\n` +
      `• /sd — View balance\n` +
      `• /start — Open main menu\n` +
      `• /thongke — Personal statistics\n` +
      `• /chuyen [ID] [Amount] — Transfer to another player\n\n` +
      `🏆 <b>VIP PRIVILEGES</b>\n` +
      `• /doidiemvip [points] — Redeem points for cash\n` +
      `• /homqua — Claim weekly bonus\n\n` +
      `💼 <b>BANK LINKING</b>\n` +
      `• /rutbank → tap "Set up bank"\n` +
      `• Once linked, just enter amount each time\n\n` +
      `🆘 <b>SUPPORT</b>\n` +
      `• /hotro — Contact support`,
    startCaption:   "🎫 Your ID: {id}\n\n👉 Join Room TX to win jackpots & get daily giftcodes https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Link Haru88 Web Account</b>",
    wlinkPrompt:    "To complete linking, please share your phone number.\n📱 Press the <b>\"Send phone number\"</b> button below.",
    wlinkBtn:       "📱 Send phone number",
  },

  // ════════════════════════════════════════════════════════════════
  zh: {
    menuProfile:    "👤 个人中心",
    menuGames:      "🎮 游戏",
    menuReferral:   "🎁 推荐",
    menuRanking:    "🏆 排行榜",
    menuEvents:     "🎊 活动",
    menuCommission: "💰 佣金",
    menuSupport:    "🆘 客服",
    menuLanguage:   "🌐 语言",
    menuPrompt:     "✨ 请选择下方功能开始使用。",
    langTitle:      "🌐 <b>选择语言 / Select language</b>",
    langChanged:    "✅ 语言已切换为",
    langCurrent:    "当前语言",
    errGeneral:     "❌ 发生错误，请重试！",
    errUserNotFound:"❌ 未找到账户信息。",
    errInsufficient:"❌ 余额不足！",
    loading:        "⏳ 处理中...",
    balance:        "💎 余额",
    remainingBalance:"💎 剩余余额",
    betAmount:      "💸 投注金额",
    winAmount:      "🏆 中奖金额",
    totalLabel:     "💸 合计",
    dateLabel:      "📅 今日XSMB结果",
    luckyNext:      "💡 祝下次好运！新投注从00:00开始。",
    lodeBetSuccess: "✅ {type} 投注成功！",
    lodeNumbers:    "🔢 投注号码",
    lodeEach:       "🎯 每号",
    lodeIfWin:      "🏆 中奖可得",
    lodeSet:        "🔢 号码组合",
    lodePoints:     "分",
    lodeMinErr:     "❌ 最低投注金额为 <b>{min}</b>！",
    lodeClosed:     "⏰ <b>今日投注已截止！</b>",
    lodeCloseDetail:"XSMB结果已出，请明天再投注。\n💡 输入 <code>XSMB</code> 查看今日结果。",
    lodeClosesSoon: "⏰ <b>投注即将截止！</b>",
    lodeClosesSoonDetail: "18:25后不接受新投注。输入 <code>XSMB</code> 查看结果。",
    lodeViewPending:"💡 输入 <code>CUOCLO</code> 查看待处理投注。",
    lodeMyBetsTitle:"📋 <b>今日彩票投注 ({date})</b>",
    lodeMyBetsEmpty:"您今日尚未投注。",
    lodeMyBetsEmptyHint:"💡 投注语法：\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — 二串 (x15)\n• <code>/xienba 00,01,02 10d</code> — 三串 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — 四串 (x100)",
    lodeMyBetsMin:  "📌 每单最低 2,000₫",
    lodeTotalBet:   "💸 总投注额",
    lodePending:    "⏰ 结果将在18:30后自动更新！",
    lodeResultsTitle:"🎰 <b>您的结果 - {date}</b>",
    lodeWonLabel:   "🏆 <b>中奖：</b>",
    lodeLostLabel:  "😢 <b>未中奖：</b>",
    lodeTotalWon:   "💎 总奖励：",
    depositTitle:   "💳 充值",
    depositSuccess: "✅ 充值成功！",
    depositPending: "⏳ 正在处理充值...",
    depositPrompt:  "请选择充值方式：",
    depositBank:    "🏦 银行转账",
    depositCard:    "🎫 充值卡",
    withdrawTitle:  "🏦 提现",
    withdrawSuccess:"✅ 提现成功！",
    withdrawPending:"⏳ 正在处理提现请求...",
    profileTitle:   "👤 <b>HARU88 个人资料：</b>",
    profileName:    "姓名",
    profileVault:   "金库",
    profileVaultNotSet: "未设置",
    profileGames:   "游戏局数",
    profileCommission: "佣金",
    profileGiftcode: "礼品码",
    profileGiftcodeUsed: "✅ 已使用",
    profileGiftcodeNotUsed: "❌ 未使用",
    profileAttendance: "签到",
    profileDays:    "天",
    profilePrompt:  "✨ 选择下方功能继续 ✨",
    btnDeposit:     "🏦 充值",
    btnWithdraw:    "🏦 提现",
    btnBuyGiftcode: "🎁 购买礼品码",
    btnEnterGiftcode: "🎉 输入礼品码",
    btnDepositHistory: "📜 充值记录",
    btnWithdrawHistory: "📜 提现记录",
    btnRedEnvelope: "🧧 红包",
    btnBetHistory:  "📊 投注记录",
    btnVipLevel:    "👑 VIP等级",
    btnTransfer:    "💸 转账",
    btnVault:       "🔐 金库",
    btnBack:        "↩️ 返回",
    gameMenuTitle:  "🎮 <b>游戏区</b>",
    gameMenuPrompt: "选择游戏开始：",
    gameBasketball: "🏀 篮球 🏀",
    gameFootball:   "⚽️ 足球 ⚽️",
    gameMaybay:     "✈️ 飞机游戏",
    supportTitle:   "🆘 <b>客户服务</b> 🆘",
    supportBody:    "请点击下方按钮获取支持！\n\n🕰 全天候24/7 - 每天服务",
    supportBtnTelegram: "📱 Telegram客服",
    helpFull:
      `📖 <b>HARU88 机器人使用指南</b>\n\n` +
      `💰 <b>充值</b>\n` +
      `• /nap — 打开充值菜单\n` +
      `• 通过银行转账或充值卡充值\n\n` +
      `💸 <b>提现</b>\n` +
      `• /rutbank — 通过已绑定银行提现\n` +
      `• /rutmomo [姓名] [手机号] [金额]\n` +
      `⚠️ 信息错误仍会扣款，请仔细核对！\n\n` +
      `🎮 <b>游戏</b>\n` +
      `• 大小：输入 <code>T [金额]</code> 或 <code>X [金额]</code>\n` +
      `• 彩票：/lode — 猜2个数字\n` +
      `• 骰子、保龄球、篮球、足球...\n` +
      `• 最低投注：1,000₫ | 最高：1,000,000₫\n\n` +
      `🎁 <b>礼品码</b>\n` +
      `• /code [代码] — 输入礼品码\n\n` +
      `👤 <b>账户</b>\n` +
      `• /sd — 查看余额\n` +
      `• /start — 打开主菜单\n\n` +
      `🏆 <b>VIP特权</b>\n` +
      `• /doidiemvip [积分] — 积分兑换现金\n\n` +
      `🆘 <b>客服</b>\n` +
      `• /hotro — 联系客服`,
    startCaption:   "🎫 您的ID：{id}\n\n👉 加入TX房间赢取大奖并获取每日礼品码 https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>绑定Haru88网页账户</b>",
    wlinkPrompt:    "要完成绑定，请分享您的手机号码。\n📱 点击下方 <b>\"发送手机号\"</b> 按钮。",
    wlinkBtn:       "📱 发送手机号",
  },

  // ════════════════════════════════════════════════════════════════
  ko: {
    menuProfile:    "👤 프로필",
    menuGames:      "🎮 게임",
    menuReferral:   "🎁 추천",
    menuRanking:    "🏆 랭킹",
    menuEvents:     "🎊 이벤트",
    menuCommission: "💰 커미션",
    menuSupport:    "🆘 고객지원",
    menuLanguage:   "🌐 언어",
    menuPrompt:     "✨ 아래에서 기능을 선택하세요.",
    langTitle:      "🌐 <b>언어 선택 / Select language</b>",
    langChanged:    "✅ 언어가 변경되었습니다:",
    langCurrent:    "현재 언어",
    errGeneral:     "❌ 오류가 발생했습니다. 다시 시도해 주세요!",
    errUserNotFound:"❌ 계정을 찾을 수 없습니다.",
    errInsufficient:"❌ 잔액이 부족합니다!",
    loading:        "⏳ 처리 중...",
    balance:        "💎 잔액",
    remainingBalance:"💎 남은 잔액",
    betAmount:      "💸 베팅 금액",
    winAmount:      "🏆 당첨 금액",
    totalLabel:     "💸 합계",
    dateLabel:      "📅 오늘의 XSMB 결과",
    luckyNext:      "💡 다음에 행운을 빕니다! 새 베팅은 00:00부터 시작됩니다.",
    lodeBetSuccess: "✅ {type} 베팅 성공!",
    lodeNumbers:    "🔢 베팅 번호",
    lodeEach:       "🎯 각 번호",
    lodeIfWin:      "🏆 당첨 시",
    lodeSet:        "🔢 번호 세트",
    lodePoints:     "포인트",
    lodeMinErr:     "❌ 최소 베팅 금액은 <b>{min}</b>입니다!",
    lodeClosed:     "⏰ <b>오늘 베팅이 마감되었습니다!</b>",
    lodeCloseDetail:"XSMB 결과가 발표되었습니다. 내일 베팅해 주세요.\n💡 <code>XSMB</code> 입력으로 오늘 결과 확인.",
    lodeClosesSoon: "⏰ <b>베팅 마감이 임박했습니다!</b>",
    lodeClosesSoonDetail: "18:25 이후 새 베팅 불가. <code>XSMB</code>로 결과 확인.",
    lodeViewPending:"💡 <code>CUOCLO</code> 입력으로 대기 중인 베팅 확인.",
    lodeMyBetsTitle:"📋 <b>오늘의 복권 베팅 ({date})</b>",
    lodeMyBetsEmpty:"오늘 베팅한 내역이 없습니다.",
    lodeMyBetsEmptyHint:"💡 베팅 방법:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — 세트2 (x15)\n• <code>/xienba 00,01,02 10d</code> — 세트3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — 세트4 (x100)",
    lodeMyBetsMin:  "📌 최소 2,000₫/주문",
    lodeTotalBet:   "💸 총 베팅액",
    lodePending:    "⏰ 결과는 18:30 이후 자동 업데이트됩니다!",
    lodeResultsTitle:"🎰 <b>내 결과 - {date}</b>",
    lodeWonLabel:   "🏆 <b>당첨:</b>",
    lodeLostLabel:  "😢 <b>미당첨:</b>",
    lodeTotalWon:   "💎 총 상금:",
    depositTitle:   "💳 입금",
    depositSuccess: "✅ 입금 성공!",
    depositPending: "⏳ 입금 처리 중...",
    depositPrompt:  "입금 방법을 선택하세요:",
    depositBank:    "🏦 은행 이체",
    depositCard:    "🎫 충전 카드",
    withdrawTitle:  "🏦 출금",
    withdrawSuccess:"✅ 출금 성공!",
    withdrawPending:"⏳ 출금 요청 처리 중...",
    profileTitle:   "👤 <b>HARU88 프로필:</b>",
    profileName:    "이름",
    profileVault:   "금고",
    profileVaultNotSet: "미설정",
    profileGames:   "게임 수",
    profileCommission: "커미션",
    profileGiftcode: "기프트코드",
    profileGiftcodeUsed: "✅ 사용됨",
    profileGiftcodeNotUsed: "❌ 미사용",
    profileAttendance: "출석",
    profileDays:    "일",
    profilePrompt:  "✨ 아래 기능을 선택해 계속하세요 ✨",
    btnDeposit:     "🏦 입금",
    btnWithdraw:    "🏦 출금",
    btnBuyGiftcode: "🎁 기프트코드 구매",
    btnEnterGiftcode: "🎉 기프트코드 입력",
    btnDepositHistory: "📜 입금 내역",
    btnWithdrawHistory: "📜 출금 내역",
    btnRedEnvelope: "🧧 빨간 봉투",
    btnBetHistory:  "📊 베팅 내역",
    btnVipLevel:    "👑 VIP 등급",
    btnTransfer:    "💸 송금",
    btnVault:       "🔐 금고",
    btnBack:        "↩️ 뒤로",
    gameMenuTitle:  "🎮 <b>게임 존</b>",
    gameMenuPrompt: "게임을 선택하세요:",
    gameBasketball: "🏀 농구 🏀",
    gameFootball:   "⚽️ 축구 ⚽️",
    gameMaybay:     "✈️ 크래시 게임",
    supportTitle:   "🆘 <b>고객 지원</b> 🆘",
    supportBody:    "아래 버튼을 눌러 지원을 받으세요!\n\n🕰 24/7 지원 - 매일",
    supportBtnTelegram: "📱 텔레그램 지원",
    helpFull:
      `📖 <b>HARU88 봇 사용 가이드</b>\n\n` +
      `💰 <b>입금</b>\n` +
      `• /nap — 입금 메뉴 열기\n` +
      `• 은행 이체 또는 충전카드로 입금\n\n` +
      `💸 <b>출금</b>\n` +
      `• /rutbank — 연결된 은행으로 출금\n` +
      `⚠️ 잘못된 정보 입력 시 금액이 차감됩니다!\n\n` +
      `🎮 <b>게임</b>\n` +
      `• 타이시우: <code>T [금액]</code> 또는 <code>X [금액]</code>\n` +
      `• 복권: /lode — 2자리 숫자 예측\n` +
      `• 주사위, 볼링, 농구, 축구...\n` +
      `• 최소: 1,000₫ | 최대: 1,000,000₫\n\n` +
      `🎁 <b>기프트코드</b>\n` +
      `• /code [코드] — 기프트코드 입력\n\n` +
      `👤 <b>계정</b>\n` +
      `• /sd — 잔액 확인\n` +
      `• /start — 메인 메뉴\n\n` +
      `🏆 <b>VIP 특권</b>\n` +
      `• /doidiemvip [포인트] — 포인트로 현금 교환\n\n` +
      `🆘 <b>지원</b>\n` +
      `• /hotro — 지원 문의`,
    startCaption:   "🎫 회원님의 ID: {id}\n\n👉 TX룸에 참여하여 잭팟을 노리고 일일 기프트코드를 받으세요 https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Haru88 웹 계정 연결</b>",
    wlinkPrompt:    "연결을 완료하려면 전화번호를 공유해 주세요.\n📱 아래 <b>\"전화번호 전송\"</b> 버튼을 누르세요.",
    wlinkBtn:       "📱 전화번호 전송",
  },

  // ════════════════════════════════════════════════════════════════
  ja: {
    menuProfile:    "👤 プロフィール",
    menuGames:      "🎮 ゲーム",
    menuReferral:   "🎁 紹介",
    menuRanking:    "🏆 ランキング",
    menuEvents:     "🎊 イベント",
    menuCommission: "💰 コミッション",
    menuSupport:    "🆘 サポート",
    menuLanguage:   "🌐 言語",
    menuPrompt:     "✨ 下のメニューから機能を選んでください。",
    langTitle:      "🌐 <b>言語を選択 / Select language</b>",
    langChanged:    "✅ 言語が変更されました：",
    langCurrent:    "現在の言語",
    errGeneral:     "❌ エラーが発生しました。もう一度お試しください！",
    errUserNotFound:"❌ アカウントが見つかりません。",
    errInsufficient:"❌ 残高が不足しています！",
    loading:        "⏳ 処理中...",
    balance:        "💎 残高",
    remainingBalance:"💎 残高",
    betAmount:      "💸 ベット金額",
    winAmount:      "🏆 当選金額",
    totalLabel:     "💸 合計",
    dateLabel:      "📅 本日のXSMB結果",
    luckyNext:      "💡 次回の幸運をお祈りします！新しいベットは00:00から。",
    lodeBetSuccess: "✅ {type} ベット成功！",
    lodeNumbers:    "🔢 ベット番号",
    lodeEach:       "🎯 各番号",
    lodeIfWin:      "🏆 当選した場合",
    lodeSet:        "🔢 番号セット",
    lodePoints:     "ポイント",
    lodeMinErr:     "❌ 最低ベット額は <b>{min}</b> です！",
    lodeClosed:     "⏰ <b>本日のベットは締め切られました！</b>",
    lodeCloseDetail:"XSMB結果が発表されました。明日またベットしてください。\n💡 <code>XSMB</code>で本日の結果を確認。",
    lodeClosesSoon: "⏰ <b>ベット締め切りまで間もなく！</b>",
    lodeClosesSoonDetail: "18:25以降は新規ベット不可。<code>XSMB</code>で結果確認。",
    lodeViewPending:"💡 <code>CUOCLO</code>で待機中のベットを確認。",
    lodeMyBetsTitle:"📋 <b>本日のロト賭け ({date})</b>",
    lodeMyBetsEmpty:"本日のベットはありません。",
    lodeMyBetsEmptyHint:"💡 ベット方法:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — 2点セット (x15)\n• <code>/xienba 00,01,02 10d</code> — 3点セット (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — 4点セット (x100)",
    lodeMyBetsMin:  "📌 最低 2,000₫/注文",
    lodeTotalBet:   "💸 総ベット額",
    lodePending:    "⏰ 結果は18:30以降に自動更新されます！",
    lodeResultsTitle:"🎰 <b>あなたの結果 - {date}</b>",
    lodeWonLabel:   "🏆 <b>当選：</b>",
    lodeLostLabel:  "😢 <b>落選：</b>",
    lodeTotalWon:   "💎 総賞金：",
    depositTitle:   "💳 入金",
    depositSuccess: "✅ 入金成功！",
    depositPending: "⏳ 入金処理中...",
    depositPrompt:  "入金方法を選択してください：",
    depositBank:    "🏦 銀行振込",
    depositCard:    "🎫 プリペイドカード",
    withdrawTitle:  "🏦 出金",
    withdrawSuccess:"✅ 出金成功！",
    withdrawPending:"⏳ 出金リクエスト処理中...",
    profileTitle:   "👤 <b>HARU88 プロフィール：</b>",
    profileName:    "名前",
    profileVault:   "金庫",
    profileVaultNotSet: "未設定",
    profileGames:   "ゲーム数",
    profileCommission: "コミッション",
    profileGiftcode: "ギフトコード",
    profileGiftcodeUsed: "✅ 使用済み",
    profileGiftcodeNotUsed: "❌ 未使用",
    profileAttendance: "出席",
    profileDays:    "日",
    profilePrompt:  "✨ 下の機能を選んでください ✨",
    btnDeposit:     "🏦 入金",
    btnWithdraw:    "🏦 出金",
    btnBuyGiftcode: "🎁 ギフトコード購入",
    btnEnterGiftcode: "🎉 ギフトコード入力",
    btnDepositHistory: "📜 入金履歴",
    btnWithdrawHistory: "📜 出金履歴",
    btnRedEnvelope: "🧧 お年玉",
    btnBetHistory:  "📊 ベット履歴",
    btnVipLevel:    "👑 VIPレベル",
    btnTransfer:    "💸 送金",
    btnVault:       "🔐 金庫",
    btnBack:        "↩️ 戻る",
    gameMenuTitle:  "🎮 <b>ゲームゾーン</b>",
    gameMenuPrompt: "ゲームを選んでください：",
    gameBasketball: "🏀 バスケ 🏀",
    gameFootball:   "⚽️ サッカー ⚽️",
    gameMaybay:     "✈️ クラッシュゲーム",
    supportTitle:   "🆘 <b>カスタマーサポート</b> 🆘",
    supportBody:    "下のボタンを押してサポートを受けてください！\n\n🕰 24時間365日対応",
    supportBtnTelegram: "📱 テレグラムサポート",
    helpFull:
      `📖 <b>HARU88ボット使用ガイド</b>\n\n` +
      `💰 <b>入金</b>\n` +
      `• /nap — 入金メニューを開く\n` +
      `• 銀行振込またはプリペイドカードで入金\n\n` +
      `💸 <b>出金</b>\n` +
      `• /rutbank — 登録銀行へ出金\n` +
      `⚠️ 誤った情報は出金失敗でも残高から引かれます！\n\n` +
      `🎮 <b>ゲーム</b>\n` +
      `• タイシウ：<code>T [金額]</code> または <code>X [金額]</code>\n` +
      `• 宝くじ：/lode — 2桁を予測\n` +
      `• 最小：1,000₫ | 最大：1,000,000₫\n\n` +
      `🎁 <b>ギフトコード</b>\n` +
      `• /code [コード] — ギフトコード入力\n\n` +
      `👤 <b>アカウント</b>\n` +
      `• /sd — 残高確認\n` +
      `• /start — メインメニュー\n\n` +
      `🆘 <b>サポート</b>\n` +
      `• /hotro — サポートに連絡`,
    startCaption:   "🎫 あなたのID：{id}\n\n👉 TXルームに参加してジャックポットを狙い、毎日ギフトコードをゲット https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Haru88 Webアカウントのリンク</b>",
    wlinkPrompt:    "リンクを完了するには、電話番号を共有してください。\n📱 下の <b>「電話番号を送信」</b> ボタンを押してください。",
    wlinkBtn:       "📱 電話番号を送信",
  },

  // ════════════════════════════════════════════════════════════════
  th: {
    menuProfile:    "👤 โปรไฟล์",
    menuGames:      "🎮 เกม",
    menuReferral:   "🎁 แนะนำเพื่อน",
    menuRanking:    "🏆 อันดับ",
    menuEvents:     "🎊 กิจกรรม",
    menuCommission: "💰 คอมมิชชั่น",
    menuSupport:    "🆘 ช่วยเหลือ",
    menuLanguage:   "🌐 ภาษา",
    menuPrompt:     "✨ เลือกฟีเจอร์ด้านล่างเพื่อเริ่มต้น",
    langTitle:      "🌐 <b>เลือกภาษา / Select language</b>",
    langChanged:    "✅ เปลี่ยนภาษาเป็น",
    langCurrent:    "ภาษาปัจจุบัน",
    errGeneral:     "❌ เกิดข้อผิดพลาด กรุณาลองใหม่!",
    errUserNotFound:"❌ ไม่พบบัญชีผู้ใช้",
    errInsufficient:"❌ ยอดเงินไม่เพียงพอ!",
    loading:        "⏳ กำลังดำเนินการ...",
    balance:        "💎 ยอดเงิน",
    remainingBalance:"💎 ยอดเงินคงเหลือ",
    betAmount:      "💸 จำนวนเงินเดิมพัน",
    winAmount:      "🏆 จำนวนเงินรางวัล",
    totalLabel:     "💸 รวม",
    dateLabel:      "📅 ผลหวยวันนี้",
    luckyNext:      "💡 ขอให้โชคดีครั้งหน้า! เดิมพันใหม่เริ่ม 00:00 น.",
    lodeBetSuccess: "✅ เดิมพัน {type} สำเร็จ!",
    lodeNumbers:    "🔢 เลขที่เดิมพัน",
    lodeEach:       "🎯 ต่อเลข",
    lodeIfWin:      "🏆 ถ้าถูก",
    lodeSet:        "🔢 ชุดตัวเลข",
    lodePoints:     "แต้ม",
    lodeMinErr:     "❌ เดิมพันขั้นต่ำ <b>{min}</b>!",
    lodeClosed:     "⏰ <b>หมดเวลาเดิมพันวันนี้!</b>",
    lodeCloseDetail:"ผลหวยออกแล้ว กรุณาเดิมพันพรุ่งนี้\n💡 พิมพ์ <code>XSMB</code> ดูผลวันนี้",
    lodeClosesSoon: "⏰ <b>ใกล้หมดเวลาเดิมพัน!</b>",
    lodeClosesSoonDetail: "ไม่รับเดิมพันหลัง 18:25 พิมพ์ <code>XSMB</code> ดูผล",
    lodeViewPending:"💡 พิมพ์ <code>CUOCLO</code> ดูรายการรอผล",
    lodeMyBetsTitle:"📋 <b>รายการเดิมพันวันนี้ ({date})</b>",
    lodeMyBetsEmpty:"คุณยังไม่มีรายการเดิมพันวันนี้",
    lodeMyBetsEmptyHint:"💡 วิธีเดิมพัน:\n• <code>/lo 00 10d</code> — โล (x80)\n• <code>/de 00 10d</code> — เด (x90)\n• <code>/xienhai 00,01 10d</code> — เซียน2 (x15)\n• <code>/xienba 00,01,02 10d</code> — เซียน3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — เซียน4 (x100)",
    lodeMyBetsMin:  "📌 ขั้นต่ำ 2,000₫/คำสั่ง",
    lodeTotalBet:   "💸 รวมเงินเดิมพัน",
    lodePending:    "⏰ ผลจะอัปเดตอัตโนมัติหลัง 18:30!",
    lodeResultsTitle:"🎰 <b>ผลของคุณ - {date}</b>",
    lodeWonLabel:   "🏆 <b>ถูกรางวัล:</b>",
    lodeLostLabel:  "😢 <b>ไม่ถูก:</b>",
    lodeTotalWon:   "💎 รวมรางวัล:",
    depositTitle:   "💳 ฝากเงิน",
    depositSuccess: "✅ ฝากเงินสำเร็จ!",
    depositPending: "⏳ กำลังดำเนินการฝาก...",
    depositPrompt:  "เลือกวิธีฝากเงิน:",
    depositBank:    "🏦 โอนธนาคาร",
    depositCard:    "🎫 บัตรเติมเงิน",
    withdrawTitle:  "🏦 ถอนเงิน",
    withdrawSuccess:"✅ ถอนเงินสำเร็จ!",
    withdrawPending:"⏳ กำลังดำเนินการถอน...",
    profileTitle:   "👤 <b>โปรไฟล์ HARU88:</b>",
    profileName:    "ชื่อ",
    profileVault:   "ตู้นิรภัย",
    profileVaultNotSet: "ยังไม่ตั้งค่า",
    profileGames:   "จำนวนเกม",
    profileCommission: "คอมมิชชั่น",
    profileGiftcode: "กิฟต์โค้ด",
    profileGiftcodeUsed: "✅ ใช้แล้ว",
    profileGiftcodeNotUsed: "❌ ยังไม่ใช้",
    profileAttendance: "การเช็คอิน",
    profileDays:    "วัน",
    profilePrompt:  "✨ เลือกฟีเจอร์ด้านล่างเพื่อดำเนินการต่อ ✨",
    btnDeposit:     "🏦 ฝากเงิน",
    btnWithdraw:    "🏦 ถอนเงิน",
    btnBuyGiftcode: "🎁 ซื้อกิฟต์โค้ด",
    btnEnterGiftcode: "🎉 ใส่กิฟต์โค้ด",
    btnDepositHistory: "📜 ประวัติฝาก",
    btnWithdrawHistory: "📜 ประวัติถอน",
    btnRedEnvelope: "🧧 ซองแดง",
    btnBetHistory:  "📊 ประวัติเดิมพัน",
    btnVipLevel:    "👑 ระดับ VIP",
    btnTransfer:    "💸 โอนเงิน",
    btnVault:       "🔐 ตู้นิรภัย",
    btnBack:        "↩️ กลับ",
    gameMenuTitle:  "🎮 <b>โซนเกม</b>",
    gameMenuPrompt: "เลือกเกมที่ต้องการเล่น:",
    gameBasketball: "🏀 บาสเกตบอล 🏀",
    gameFootball:   "⚽️ ฟุตบอล ⚽️",
    gameMaybay:     "✈️ เกมเครื่องบิน",
    supportTitle:   "🆘 <b>บริการลูกค้า</b> 🆘",
    supportBody:    "กดปุ่มด้านล่างเพื่อรับการสนับสนุน!\n\n🕰 บริการ 24/7 - ทุกวัน",
    supportBtnTelegram: "📱 Telegram ช่วยเหลือ",
    helpFull:
      `📖 <b>คู่มือการใช้งานบอต HARU88</b>\n\n` +
      `💰 <b>ฝากเงิน</b>\n` +
      `• /nap — เปิดเมนูฝากเงิน\n` +
      `• ฝากผ่านโอนธนาคารหรือบัตรเติมเงิน\n\n` +
      `💸 <b>ถอนเงิน</b>\n` +
      `• /rutbank — ถอนผ่านธนาคารที่เชื่อมต่อ\n` +
      `⚠️ ข้อมูลผิดยังคงหักเงิน กรุณาตรวจสอบให้ดี!\n\n` +
      `🎮 <b>เกม</b>\n` +
      `• ไฮโล: พิมพ์ <code>T [จำนวน]</code> หรือ <code>X [จำนวน]</code>\n` +
      `• หวย: /lode — ทายเลข 2 หลัก\n` +
      `• ต่ำสุด: 1,000₫ | สูงสุด: 1,000,000₫\n\n` +
      `🎁 <b>กิฟต์โค้ด</b>\n` +
      `• /code [รหัส] — ใส่กิฟต์โค้ด\n\n` +
      `👤 <b>บัญชี</b>\n` +
      `• /sd — ดูยอดเงิน\n` +
      `• /start — เมนูหลัก\n\n` +
      `🆘 <b>สนับสนุน</b>\n` +
      `• /hotro — ติดต่อฝ่ายสนับสนุน`,
    startCaption:   "🎫 ID ของคุณ: {id}\n\n👉 เข้าร่วม Room TX เพื่อลุ้นแจ็คพ็อตและรับกิฟต์โค้ดประจำวัน https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>เชื่อมต่อบัญชี Haru88 Web</b>",
    wlinkPrompt:    "เพื่อเชื่อมต่อให้เสร็จสมบูรณ์ กรุณาแชร์หมายเลขโทรศัพท์ของคุณ\n📱 กดปุ่ม <b>\"ส่งหมายเลขโทรศัพท์\"</b> ด้านล่าง",
    wlinkBtn:       "📱 ส่งหมายเลขโทรศัพท์",
  },

  // ════════════════════════════════════════════════════════════════
  id: {
    menuProfile:    "👤 Profil",
    menuGames:      "🎮 Game",
    menuReferral:   "🎁 Referral",
    menuRanking:    "🏆 Peringkat",
    menuEvents:     "🎊 Event",
    menuCommission: "💰 Komisi",
    menuSupport:    "🆘 Bantuan",
    menuLanguage:   "🌐 Bahasa",
    menuPrompt:     "✨ Pilih fitur di bawah untuk mulai.",
    langTitle:      "🌐 <b>Pilih bahasa / Select language</b>",
    langChanged:    "✅ Bahasa diubah ke",
    langCurrent:    "Bahasa saat ini",
    errGeneral:     "❌ Terjadi kesalahan. Silakan coba lagi!",
    errUserNotFound:"❌ Akun tidak ditemukan.",
    errInsufficient:"❌ Saldo tidak mencukupi!",
    loading:        "⏳ Memproses...",
    balance:        "💎 Saldo",
    remainingBalance:"💎 Saldo tersisa",
    betAmount:      "💸 Jumlah taruhan",
    winAmount:      "🏆 Hadiah menang",
    totalLabel:     "💸 Total",
    dateLabel:      "📅 Hasil XSMB hari ini",
    luckyNext:      "💡 Semoga beruntung lain kali! Taruhan baru mulai 00:00.",
    lodeBetSuccess: "✅ TARUHAN {type} BERHASIL!",
    lodeNumbers:    "🔢 Nomor taruhan",
    lodeEach:       "🎯 Per nomor",
    lodeIfWin:      "🏆 Jika menang",
    lodeSet:        "🔢 Set nomor",
    lodePoints:     "poin",
    lodeMinErr:     "❌ Minimum taruhan <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Taruhan hari ini sudah ditutup!</b>",
    lodeCloseDetail:"Hasil XSMB sudah keluar. Taruhan lagi besok.\n💡 Ketik <code>XSMB</code> untuk melihat hasil hari ini.",
    lodeClosesSoon: "⏰ <b>Taruhan hampir ditutup!</b>",
    lodeClosesSoonDetail: "Tidak menerima taruhan setelah 18:25. Ketik <code>XSMB</code> untuk hasil.",
    lodeViewPending:"💡 Ketik <code>CUOCLO</code> untuk melihat taruhan tertunda.",
    lodeMyBetsTitle:"📋 <b>Taruhan Lotere Hari Ini ({date})</b>",
    lodeMyBetsEmpty:"Anda belum memasang taruhan hari ini.",
    lodeMyBetsEmptyHint:"💡 Cara taruhan:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimum 2.000₫/perintah",
    lodeTotalBet:   "💸 Total taruhan",
    lodePending:    "⏰ Hasil diperbarui otomatis setelah 18:30!",
    lodeResultsTitle:"🎰 <b>HASIL ANDA - {date}</b>",
    lodeWonLabel:   "🏆 <b>MENANG:</b>",
    lodeLostLabel:  "😢 <b>Tidak menang:</b>",
    lodeTotalWon:   "💎 Total hadiah:",
    depositTitle:   "💳 DEPOSIT",
    depositSuccess: "✅ Deposit berhasil!",
    depositPending: "⏳ Memproses deposit...",
    depositPrompt:  "Pilih metode deposit:",
    depositBank:    "🏦 Transfer Bank",
    depositCard:    "🎫 Kartu Isi Ulang",
    withdrawTitle:  "🏦 Penarikan",
    withdrawSuccess:"✅ Penarikan berhasil!",
    withdrawPending:"⏳ Memproses permintaan penarikan...",
    profileTitle:   "👤 <b>PROFIL HARU88:</b>",
    profileName:    "Nama",
    profileVault:   "Brankas",
    profileVaultNotSet: "belum diatur",
    profileGames:   "Jumlah game",
    profileCommission: "Komisi",
    profileGiftcode: "Giftcode",
    profileGiftcodeUsed: "✅ Sudah digunakan",
    profileGiftcodeNotUsed: "❌ Belum",
    profileAttendance: "Absensi",
    profileDays:    "hari",
    profilePrompt:  "✨ Pilih fitur di bawah untuk melanjutkan ✨",
    btnDeposit:     "🏦 Deposit",
    btnWithdraw:    "🏦 Tarik Dana",
    btnBuyGiftcode: "🎁 Beli Giftcode",
    btnEnterGiftcode: "🎉 Masukkan Giftcode",
    btnDepositHistory: "📜 Riwayat Deposit",
    btnWithdrawHistory: "📜 Riwayat Penarikan",
    btnRedEnvelope: "🧧 Amplop Merah",
    btnBetHistory:  "📊 Riwayat Taruhan",
    btnVipLevel:    "👑 LEVEL VIP",
    btnTransfer:    "💸 Transfer",
    btnVault:       "🔐 Brankas",
    btnBack:        "↩️ Kembali",
    gameMenuTitle:  "🎮 <b>ZONA GAME</b>",
    gameMenuPrompt: "Pilih game untuk mulai:",
    gameBasketball: "🏀 Basket 🏀",
    gameFootball:   "⚽️ Sepak Bola ⚽️",
    gameMaybay:     "✈️ Game Pesawat",
    supportTitle:   "🆘 <b>LAYANAN PELANGGAN</b> 🆘",
    supportBody:    "TEKAN TOMBOL DI BAWAH UNTUK BANTUAN!\n\n🕰 Tersedia 24/7 - Setiap hari",
    supportBtnTelegram: "📱 Telegram Support",
    helpFull:
      `📖 <b>PANDUAN BOT HARU88</b>\n\n` +
      `💰 <b>DEPOSIT</b>\n` +
      `• /nap — Buka menu deposit\n` +
      `• Deposit via transfer bank atau kartu\n\n` +
      `💸 <b>PENARIKAN</b>\n` +
      `• /rutbank — Tarik via bank terhubung\n` +
      `⚠️ Info salah tetap memotong saldo!\n\n` +
      `🎮 <b>GAME</b>\n` +
      `• Tài Xỉu: ketik <code>T [nominal]</code> atau <code>X [nominal]</code>\n` +
      `• Lotere: /lode\n` +
      `• Min: 1.000₫ | Maks: 1.000.000₫\n\n` +
      `🎁 <b>GIFTCODE</b>\n` +
      `• /code [kode] — Masukkan giftcode\n\n` +
      `🆘 <b>BANTUAN</b>\n` +
      `• /hotro — Hubungi support`,
    startCaption:   "🎫 ID Anda: {id}\n\n👉 Bergabung di Room TX untuk mengejar jackpot & dapatkan giftcode harian https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Hubungkan Akun Web Haru88</b>",
    wlinkPrompt:    "Untuk menyelesaikan penghubungan, bagikan nomor telepon Anda.\n📱 Tekan tombol <b>\"Kirim nomor telepon\"</b> di bawah.",
    wlinkBtn:       "📱 Kirim nomor telepon",
  },

  // ════════════════════════════════════════════════════════════════
  ms: {
    menuProfile:    "👤 Profil",
    menuGames:      "🎮 Permainan",
    menuReferral:   "🎁 Rujukan",
    menuRanking:    "🏆 Kedudukan",
    menuEvents:     "🎊 Acara",
    menuCommission: "💰 Komisen",
    menuSupport:    "🆘 Sokongan",
    menuLanguage:   "🌐 Bahasa",
    menuPrompt:     "✨ Pilih ciri di bawah untuk mula.",
    langTitle:      "🌐 <b>Pilih bahasa / Select language</b>",
    langChanged:    "✅ Bahasa ditukar kepada",
    langCurrent:    "Bahasa semasa",
    errGeneral:     "❌ Ralat berlaku. Sila cuba lagi!",
    errUserNotFound:"❌ Akaun tidak dijumpai.",
    errInsufficient:"❌ Baki tidak mencukupi!",
    loading:        "⏳ Memproses...",
    balance:        "💎 Baki",
    remainingBalance:"💎 Baki berbaki",
    betAmount:      "💸 Jumlah pertaruhan",
    winAmount:      "🏆 Jumlah menang",
    totalLabel:     "💸 Jumlah",
    dateLabel:      "📅 Keputusan XSMB hari ini",
    luckyNext:      "💡 Semoga bernasib baik lain kali! Pertaruhan baru bermula 00:00.",
    lodeBetSuccess: "✅ PERTARUHAN {type} BERJAYA!",
    lodeNumbers:    "🔢 Nombor pertaruhan",
    lodeEach:       "🎯 Setiap nombor",
    lodeIfWin:      "🏆 Jika menang",
    lodeSet:        "🔢 Set nombor",
    lodePoints:     "mata",
    lodeMinErr:     "❌ Pertaruhan minimum <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Pertaruhan hari ini telah ditutup!</b>",
    lodeCloseDetail:"Keputusan XSMB telah dikeluarkan. Buat pertaruhan esok.\n💡 Taip <code>XSMB</code> untuk lihat keputusan hari ini.",
    lodeClosesSoon: "⏰ <b>Pertaruhan hampir ditutup!</b>",
    lodeClosesSoonDetail: "Pertaruhan baru tidak diterima selepas 18:25. Taip <code>XSMB</code>.",
    lodeViewPending:"💡 Taip <code>CUOCLO</code> untuk lihat pertaruhan tertunda.",
    lodeMyBetsTitle:"📋 <b>Pertaruhan Loteri Hari Ini ({date})</b>",
    lodeMyBetsEmpty:"Anda belum membuat pertaruhan hari ini.",
    lodeMyBetsEmptyHint:"💡 Cara pertaruhan:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimum 2,000₫/pesanan",
    lodeTotalBet:   "💸 Jumlah pertaruhan",
    lodePending:    "⏰ Keputusan dikemas kini secara automatik selepas 18:30!",
    lodeResultsTitle:"🎰 <b>KEPUTUSAN ANDA - {date}</b>",
    lodeWonLabel:   "🏆 <b>MENANG:</b>",
    lodeLostLabel:  "😢 <b>Tidak menang:</b>",
    lodeTotalWon:   "💎 Jumlah hadiah:",
    depositTitle:   "💳 DEPOSIT",
    depositSuccess: "✅ Deposit berjaya!",
    depositPending: "⏳ Memproses deposit...",
    depositPrompt:  "Pilih kaedah deposit:",
    depositBank:    "🏦 Pindahan Bank",
    depositCard:    "🎫 Kad Tambah Nilai",
    withdrawTitle:  "🏦 Pengeluaran",
    withdrawSuccess:"✅ Pengeluaran berjaya!",
    withdrawPending:"⏳ Memproses permintaan pengeluaran...",
    profileTitle:   "👤 <b>PROFIL HARU88:</b>",
    profileName:    "Nama",
    profileVault:   "Peti Besi",
    profileVaultNotSet: "belum ditetapkan",
    profileGames:   "Bilangan permainan",
    profileCommission: "Komisen",
    profileGiftcode: "Kod Hadiah",
    profileGiftcodeUsed: "✅ Telah digunakan",
    profileGiftcodeNotUsed: "❌ Belum",
    profileAttendance: "Kehadiran",
    profileDays:    "hari",
    profilePrompt:  "✨ Pilih ciri di bawah untuk meneruskan ✨",
    btnDeposit:     "🏦 Deposit",
    btnWithdraw:    "🏦 Pengeluaran",
    btnBuyGiftcode: "🎁 Beli Kod Hadiah",
    btnEnterGiftcode: "🎉 Masuk Kod Hadiah",
    btnDepositHistory: "📜 Sejarah Deposit",
    btnWithdrawHistory: "📜 Sejarah Pengeluaran",
    btnRedEnvelope: "🧧 Sampul Merah",
    btnBetHistory:  "📊 Sejarah Pertaruhan",
    btnVipLevel:    "👑 TAHAP VIP",
    btnTransfer:    "💸 Pemindahan",
    btnVault:       "🔐 Peti Besi",
    btnBack:        "↩️ Kembali",
    gameMenuTitle:  "🎮 <b>ZON PERMAINAN</b>",
    gameMenuPrompt: "Pilih permainan untuk mula:",
    gameBasketball: "🏀 Bola Keranjang 🏀",
    gameFootball:   "⚽️ Bola Sepak ⚽️",
    gameMaybay:     "✈️ Permainan Kapal Terbang",
    supportTitle:   "🆘 <b>KHIDMAT PELANGGAN</b> 🆘",
    supportBody:    "TEKAN BUTANG DI BAWAH UNTUK SOKONGAN!\n\n🕰 Tersedia 24/7 - Setiap hari",
    supportBtnTelegram: "📱 Sokongan Telegram",
    helpFull:
      `📖 <b>PANDUAN BOT HARU88</b>\n\n` +
      `💰 <b>DEPOSIT</b>\n` +
      `• /nap — Buka menu deposit\n` +
      `• Deposit melalui pemindahan bank atau kad\n\n` +
      `💸 <b>PENGELUARAN</b>\n` +
      `• /rutbank — Keluarkan melalui bank yang dikaitkan\n` +
      `⚠️ Maklumat salah masih ditolak!\n\n` +
      `🎮 <b>PERMAINAN</b>\n` +
      `• Tài Xỉu: taip <code>T [jumlah]</code> atau <code>X [jumlah]</code>\n` +
      `• Loteri: /lode\n` +
      `• Min: 1,000₫ | Maks: 1,000,000₫\n\n` +
      `🎁 <b>KOD HADIAH</b>\n` +
      `• /code [kod] — Masukkan kod hadiah\n\n` +
      `🆘 <b>SOKONGAN</b>\n` +
      `• /hotro — Hubungi sokongan`,
    startCaption:   "🎫 ID Anda: {id}\n\n👉 Sertai Room TX untuk mengejar jackpot & dapatkan kod hadiah harian https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Kaitkan Akaun Web Haru88</b>",
    wlinkPrompt:    "Untuk melengkapkan pautan, sila kongsi nombor telefon anda.\n📱 Tekan butang <b>\"Hantar nombor telefon\"</b> di bawah.",
    wlinkBtn:       "📱 Hantar nombor telefon",
  },

  // ════════════════════════════════════════════════════════════════
  fil: {
    menuProfile:    "👤 Profile",
    menuGames:      "🎮 Laro",
    menuReferral:   "🎁 Referral",
    menuRanking:    "🏆 Ranggo",
    menuEvents:     "🎊 Events",
    menuCommission: "💰 Komisyon",
    menuSupport:    "🆘 Tulong",
    menuLanguage:   "🌐 Wika",
    menuPrompt:     "✨ Pumili ng feature sa ibaba upang magsimula.",
    langTitle:      "🌐 <b>Pumili ng wika / Select language</b>",
    langChanged:    "✅ Nabago ang wika sa",
    langCurrent:    "Kasalukuyang wika",
    errGeneral:     "❌ May naganap na error. Subukan ulit!",
    errUserNotFound:"❌ Hindi nahanap ang account.",
    errInsufficient:"❌ Hindi sapat ang balanse!",
    loading:        "⏳ Pinoproseso...",
    balance:        "💎 Balanse",
    remainingBalance:"💎 Natitirang balanse",
    betAmount:      "💸 Halaga ng taya",
    winAmount:      "🏆 Halaga ng panalo",
    totalLabel:     "💸 Kabuuan",
    dateLabel:      "📅 Resulta ng XSMB ngayon",
    luckyNext:      "💡 Sana mapalad ka sa susunod! Bagong taya mula 00:00.",
    lodeBetSuccess: "✅ MATAGUMPAY NA ITINAYA ANG {type}!",
    lodeNumbers:    "🔢 Mga numerong tinya",
    lodeEach:       "🎯 Bawat numero",
    lodeIfWin:      "🏆 Kung manalo",
    lodeSet:        "🔢 Set ng numero",
    lodePoints:     "puntos",
    lodeMinErr:     "❌ Minimum na taya ay <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Sarado na ang taya ngayon!</b>",
    lodeCloseDetail:"Lumabas na ang resulta ng XSMB. Tumaya bukas.\n💡 I-type <code>XSMB</code> para sa resulta ngayon.",
    lodeClosesSoon: "⏰ <b>Malapit nang magsara ang taya!</b>",
    lodeClosesSoonDetail: "Walang bagong taya pagkatapos ng 18:25. I-type <code>XSMB</code>.",
    lodeViewPending:"💡 I-type <code>CUOCLO</code> para sa mga pending na taya.",
    lodeMyBetsTitle:"📋 <b>Mga Taya Ngayon ({date})</b>",
    lodeMyBetsEmpty:"Wala kang taya ngayon.",
    lodeMyBetsEmptyHint:"💡 Paraan ng pagtaya:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimum 2,000₫/order",
    lodeTotalBet:   "💸 Kabuuang taya",
    lodePending:    "⏰ Awtomatikong ia-update ang resulta pagkatapos ng 18:30!",
    lodeResultsTitle:"🎰 <b>ANG INYONG RESULTA - {date}</b>",
    lodeWonLabel:   "🏆 <b>NANALO:</b>",
    lodeLostLabel:  "😢 <b>Hindi nanalo:</b>",
    lodeTotalWon:   "💎 Kabuuang premyo:",
    depositTitle:   "💳 DEPOSITO",
    depositSuccess: "✅ Matagumpay ang deposito!",
    depositPending: "⏳ Pinoproseso ang deposito...",
    depositPrompt:  "Piliin ang paraan ng deposito:",
    depositBank:    "🏦 Bank Transfer",
    depositCard:    "🎫 Prepaid Card",
    withdrawTitle:  "🏦 Withdrawal",
    withdrawSuccess:"✅ Matagumpay ang withdrawal!",
    withdrawPending:"⏳ Pinoproseso ang withdrawal...",
    profileTitle:   "👤 <b>PROFILE HARU88:</b>",
    profileName:    "Pangalan",
    profileVault:   "Vault",
    profileVaultNotSet: "hindi pa naka-set",
    profileGames:   "Bilang ng laro",
    profileCommission: "Komisyon",
    profileGiftcode: "Giftcode",
    profileGiftcodeUsed: "✅ Nagamit na",
    profileGiftcodeNotUsed: "❌ Hindi pa",
    profileAttendance: "Attendance",
    profileDays:    "araw",
    profilePrompt:  "✨ Pumili ng feature sa ibaba para magpatuloy ✨",
    btnDeposit:     "🏦 Deposito",
    btnWithdraw:    "🏦 Withdrawal",
    btnBuyGiftcode: "🎁 Bilhin ang Giftcode",
    btnEnterGiftcode: "🎉 Ilagay ang Giftcode",
    btnDepositHistory: "📜 Kasaysayan ng Deposito",
    btnWithdrawHistory: "📜 Kasaysayan ng Withdrawal",
    btnRedEnvelope: "🧧 Red Envelope",
    btnBetHistory:  "📊 Kasaysayan ng Taya",
    btnVipLevel:    "👑 ANTAS VIP",
    btnTransfer:    "💸 Transfer",
    btnVault:       "🔐 Vault",
    btnBack:        "↩️ Bumalik",
    gameMenuTitle:  "🎮 <b>GAME ZONE</b>",
    gameMenuPrompt: "Pumili ng laro para magsimula:",
    gameBasketball: "🏀 Basketball 🏀",
    gameFootball:   "⚽️ Football ⚽️",
    gameMaybay:     "✈️ Crash Game",
    supportTitle:   "🆘 <b>SERBISYO SA CUSTOMER</b> 🆘",
    supportBody:    "PINDUTIN ANG MGA BUTTON SA IBABA PARA SA TULONG!\n\n🕰 Available 24/7 - Bawat araw",
    supportBtnTelegram: "📱 Telegram Support",
    helpFull:
      `📖 <b>GABAY SA PAGGAMIT NG BOT HARU88</b>\n\n` +
      `💰 <b>DEPOSITO</b>\n` +
      `• /nap — Buksan ang menu ng deposito\n` +
      `• Mag-deposito sa pamamagitan ng bank o card\n\n` +
      `💸 <b>WITHDRAWAL</b>\n` +
      `• /rutbank — Mag-withdraw sa linked bank\n` +
      `⚠️ Maling impormasyon ay nagbabawas pa rin!\n\n` +
      `🎮 <b>LARO</b>\n` +
      `• Tài Xỉu: i-type <code>T [halaga]</code> o <code>X [halaga]</code>\n` +
      `• Lotterya: /lode\n` +
      `• Minimum: 1,000₫ | Maximum: 1,000,000₫\n\n` +
      `🎁 <b>GIFTCODE</b>\n` +
      `• /code [code] — Ilagay ang giftcode\n\n` +
      `🆘 <b>SUPORTA</b>\n` +
      `• /hotro — Makipag-ugnayan sa suporta`,
    startCaption:   "🎫 Ang iyong ID: {id}\n\n👉 Sumali sa Room TX para manalo ng jackpot at makakuha ng giftcode araw-araw https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>I-link ang Haru88 Web Account</b>",
    wlinkPrompt:    "Para makumpleto ang pag-link, ibahagi ang iyong numero ng telepono.\n📱 Pindutin ang <b>\"Ipadala ang numero ng telepono\"</b> na button sa ibaba.",
    wlinkBtn:       "📱 Ipadala ang numero ng telepono",
  },

  // ════════════════════════════════════════════════════════════════
  ru: {
    menuProfile:    "👤 Профиль",
    menuGames:      "🎮 Игры",
    menuReferral:   "🎁 Реферал",
    menuRanking:    "🏆 Рейтинг",
    menuEvents:     "🎊 Акции",
    menuCommission: "💰 Комиссия",
    menuSupport:    "🆘 Поддержка",
    menuLanguage:   "🌐 Язык",
    menuPrompt:     "✨ Выберите функцию ниже.",
    langTitle:      "🌐 <b>Выбор языка / Select language</b>",
    langChanged:    "✅ Язык изменён на",
    langCurrent:    "Текущий язык",
    errGeneral:     "❌ Произошла ошибка. Попробуйте снова!",
    errUserNotFound:"❌ Аккаунт не найден.",
    errInsufficient:"❌ Недостаточно средств!",
    loading:        "⏳ Обработка...",
    balance:        "💎 Баланс",
    remainingBalance:"💎 Остаток",
    betAmount:      "💸 Сумма ставки",
    winAmount:      "🏆 Сумма выигрыша",
    totalLabel:     "💸 Итого",
    dateLabel:      "📅 Результат XSMB сегодня",
    luckyNext:      "💡 Удачи в следующий раз! Новые ставки с 00:00.",
    lodeBetSuccess: "✅ СТАВКА {type} ПРИНЯТА!",
    lodeNumbers:    "🔢 Числа ставки",
    lodeEach:       "🎯 За число",
    lodeIfWin:      "🏆 При выигрыше",
    lodeSet:        "🔢 Набор чисел",
    lodePoints:     "очков",
    lodeMinErr:     "❌ Минимальная ставка <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Приём ставок на сегодня закрыт!</b>",
    lodeCloseDetail:"Результаты XSMB уже вышли. Ставьте завтра.\n💡 Введите <code>XSMB</code> для просмотра результатов.",
    lodeClosesSoon: "⏰ <b>Приём ставок скоро закрывается!</b>",
    lodeClosesSoonDetail: "Ставки после 18:25 не принимаются. Введите <code>XSMB</code>.",
    lodeViewPending:"💡 Введите <code>CUOCLO</code> для просмотра ставок.",
    lodeMyBetsTitle:"📋 <b>Ставки сегодня ({date})</b>",
    lodeMyBetsEmpty:"У вас нет ставок сегодня.",
    lodeMyBetsEmptyHint:"💡 Синтаксис ставок:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Минимум 2,000₫/заказ",
    lodeTotalBet:   "💸 Итого ставок",
    lodePending:    "⏰ Результаты обновятся автоматически после 18:30!",
    lodeResultsTitle:"🎰 <b>ВАШИ РЕЗУЛЬТАТЫ - {date}</b>",
    lodeWonLabel:   "🏆 <b>ВЫИГРЫШ:</b>",
    lodeLostLabel:  "😢 <b>Проигрыш:</b>",
    lodeTotalWon:   "💎 Итого приз:",
    depositTitle:   "💳 ПОПОЛНЕНИЕ",
    depositSuccess: "✅ Пополнение выполнено!",
    depositPending: "⏳ Обработка пополнения...",
    depositPrompt:  "Выберите способ пополнения:",
    depositBank:    "🏦 Банковский перевод",
    depositCard:    "🎫 Скретч-карта",
    withdrawTitle:  "🏦 Вывод",
    withdrawSuccess:"✅ Вывод выполнен!",
    withdrawPending:"⏳ Обработка запроса на вывод...",
    profileTitle:   "👤 <b>ПРОФИЛЬ HARU88:</b>",
    profileName:    "Имя",
    profileVault:   "Сейф",
    profileVaultNotSet: "не настроен",
    profileGames:   "Игр сыграно",
    profileCommission: "Комиссия",
    profileGiftcode: "Гифткод",
    profileGiftcodeUsed: "✅ Использован",
    profileGiftcodeNotUsed: "❌ Не использован",
    profileAttendance: "Посещаемость",
    profileDays:    "дней",
    profilePrompt:  "✨ Выберите функцию ниже для продолжения ✨",
    btnDeposit:     "🏦 Пополнить",
    btnWithdraw:    "🏦 Вывести",
    btnBuyGiftcode: "🎁 Купить гифткод",
    btnEnterGiftcode: "🎉 Ввести гифткод",
    btnDepositHistory: "📜 История пополнений",
    btnWithdrawHistory: "📜 История выводов",
    btnRedEnvelope: "🧧 Красный конверт",
    btnBetHistory:  "📊 История ставок",
    btnVipLevel:    "👑 УРОВЕНЬ VIP",
    btnTransfer:    "💸 Перевод",
    btnVault:       "🔐 Сейф",
    btnBack:        "↩️ Назад",
    gameMenuTitle:  "🎮 <b>ИГРОВАЯ ЗОНА</b>",
    gameMenuPrompt: "Выберите игру для начала:",
    gameBasketball: "🏀 Баскетбол 🏀",
    gameFootball:   "⚽️ Футбол ⚽️",
    gameMaybay:     "✈️ Краш-игра",
    supportTitle:   "🆘 <b>СЛУЖБА ПОДДЕРЖКИ</b> 🆘",
    supportBody:    "НАЖМИТЕ КНОПКИ НИЖЕ ДЛЯ ПОЛУЧЕНИЯ ПОДДЕРЖКИ!\n\n🕰 Работаем 24/7 - Каждый день",
    supportBtnTelegram: "📱 Поддержка Telegram",
    helpFull:
      `📖 <b>РУКОВОДСТВО БОТА HARU88</b>\n\n` +
      `💰 <b>ПОПОЛНЕНИЕ</b>\n` +
      `• /nap — Открыть меню пополнения\n` +
      `• Через банковский перевод или карту\n\n` +
      `💸 <b>ВЫВОД</b>\n` +
      `• /rutbank — Вывод через привязанный банк\n` +
      `⚠️ Неверные данные всё равно спишут средства!\n\n` +
      `🎮 <b>ИГРЫ</b>\n` +
      `• Тай Шу: введите <code>T [сумма]</code> или <code>X [сумма]</code>\n` +
      `• Лотерея: /lode\n` +
      `• Мин: 1,000₫ | Макс: 1,000,000₫\n\n` +
      `🎁 <b>ГИФТКОД</b>\n` +
      `• /code [код] — Ввести гифткод\n\n` +
      `🆘 <b>ПОДДЕРЖКА</b>\n` +
      `• /hotro — Связаться с поддержкой`,
    startCaption:   "🎫 Ваш ID: {id}\n\n👉 Присоединяйтесь к Room TX за джекпотами и ежедневными гифткодами https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Привязка аккаунта Haru88 Web</b>",
    wlinkPrompt:    "Для завершения привязки поделитесь своим номером телефона.\n📱 Нажмите кнопку <b>«Отправить номер телефона»</b> ниже.",
    wlinkBtn:       "📱 Отправить номер телефона",
  },

  // ════════════════════════════════════════════════════════════════
  es: {
    menuProfile:    "👤 Perfil",
    menuGames:      "🎮 Juegos",
    menuReferral:   "🎁 Referido",
    menuRanking:    "🏆 Clasificación",
    menuEvents:     "🎊 Eventos",
    menuCommission: "💰 Comisión",
    menuSupport:    "🆘 Soporte",
    menuLanguage:   "🌐 Idioma",
    menuPrompt:     "✨ Selecciona una función para comenzar.",
    langTitle:      "🌐 <b>Seleccionar idioma / Select language</b>",
    langChanged:    "✅ Idioma cambiado a",
    langCurrent:    "Idioma actual",
    errGeneral:     "❌ Ocurrió un error. ¡Inténtalo de nuevo!",
    errUserNotFound:"❌ Cuenta no encontrada.",
    errInsufficient:"❌ ¡Saldo insuficiente!",
    loading:        "⏳ Procesando...",
    balance:        "💎 Saldo",
    remainingBalance:"💎 Saldo restante",
    betAmount:      "💸 Monto apostado",
    winAmount:      "🏆 Monto ganado",
    totalLabel:     "💸 Total",
    dateLabel:      "📅 Resultado XSMB hoy",
    luckyNext:      "💡 ¡Suerte la próxima vez! Nuevas apuestas desde las 00:00.",
    lodeBetSuccess: "✅ ¡APUESTA {type} EXITOSA!",
    lodeNumbers:    "🔢 Números apostados",
    lodeEach:       "🎯 Por número",
    lodeIfWin:      "🏆 Si ganas",
    lodeSet:        "🔢 Conjunto de números",
    lodePoints:     "puntos",
    lodeMinErr:     "❌ ¡Apuesta mínima <b>{min}</b>!",
    lodeClosed:     "⏰ <b>¡Las apuestas de hoy están cerradas!</b>",
    lodeCloseDetail:"El resultado XSMB ya salió. Apuesta mañana.\n💡 Escribe <code>XSMB</code> para ver el resultado.",
    lodeClosesSoon: "⏰ <b>¡Las apuestas cierran pronto!</b>",
    lodeClosesSoonDetail: "No se aceptan apuestas después de las 18:25. Escribe <code>XSMB</code>.",
    lodeViewPending:"💡 Escribe <code>CUOCLO</code> para ver apuestas pendientes.",
    lodeMyBetsTitle:"📋 <b>Apuestas de Hoy ({date})</b>",
    lodeMyBetsEmpty:"No tienes apuestas hoy.",
    lodeMyBetsEmptyHint:"💡 Sintaxis:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Mínimo 2.000₫/orden",
    lodeTotalBet:   "💸 Total apostado",
    lodePending:    "⏰ ¡Los resultados se actualizan automáticamente después de las 18:30!",
    lodeResultsTitle:"🎰 <b>TUS RESULTADOS - {date}</b>",
    lodeWonLabel:   "🏆 <b>GANASTE:</b>",
    lodeLostLabel:  "😢 <b>No ganaste:</b>",
    lodeTotalWon:   "💎 Premio total:",
    depositTitle:   "💳 DEPÓSITO",
    depositSuccess: "✅ ¡Depósito exitoso!",
    depositPending: "⏳ Procesando depósito...",
    depositPrompt:  "Elige tu método de depósito:",
    depositBank:    "🏦 Transferencia Bancaria",
    depositCard:    "🎫 Tarjeta Prepago",
    withdrawTitle:  "🏦 Retiro",
    withdrawSuccess:"✅ ¡Retiro exitoso!",
    withdrawPending:"⏳ Procesando retiro...",
    profileTitle:   "👤 <b>PERFIL HARU88:</b>",
    profileName:    "Nombre",
    profileVault:   "Caja Fuerte",
    profileVaultNotSet: "no configurada",
    profileGames:   "Partidas jugadas",
    profileCommission: "Comisión",
    profileGiftcode: "Código de regalo",
    profileGiftcodeUsed: "✅ Usado",
    profileGiftcodeNotUsed: "❌ No usado",
    profileAttendance: "Asistencia",
    profileDays:    "días",
    profilePrompt:  "✨ Elige una función abajo para continuar ✨",
    btnDeposit:     "🏦 Depositar",
    btnWithdraw:    "🏦 Retirar",
    btnBuyGiftcode: "🎁 Comprar código",
    btnEnterGiftcode: "🎉 Ingresar código",
    btnDepositHistory: "📜 Historial de depósitos",
    btnWithdrawHistory: "📜 Historial de retiros",
    btnRedEnvelope: "🧧 Sobre Rojo",
    btnBetHistory:  "📊 Historial de apuestas",
    btnVipLevel:    "👑 NIVEL VIP",
    btnTransfer:    "💸 Transferir",
    btnVault:       "🔐 Caja Fuerte",
    btnBack:        "↩️ Atrás",
    gameMenuTitle:  "🎮 <b>ZONA DE JUEGOS</b>",
    gameMenuPrompt: "Elige un juego para empezar:",
    gameBasketball: "🏀 Baloncesto 🏀",
    gameFootball:   "⚽️ Fútbol ⚽️",
    gameMaybay:     "✈️ Juego de Crash",
    supportTitle:   "🆘 <b>ATENCIÓN AL CLIENTE</b> 🆘",
    supportBody:    "¡PRESIONA LOS BOTONES DE ABAJO PARA SOPORTE!\n\n🕰 Disponible 24/7 - Todos los días",
    supportBtnTelegram: "📱 Soporte por Telegram",
    helpFull:
      `📖 <b>GUÍA DEL BOT HARU88</b>\n\n` +
      `💰 <b>DEPÓSITO</b>\n` +
      `• /nap — Abrir menú de depósito\n` +
      `• Deposita vía transferencia bancaria o tarjeta\n\n` +
      `💸 <b>RETIRO</b>\n` +
      `• /rutbank — Retirar al banco vinculado\n` +
      `⚠️ ¡Info incorrecta igual descuenta el saldo!\n\n` +
      `🎮 <b>JUEGOS</b>\n` +
      `• Tài Xỉu: escribe <code>T [monto]</code> o <code>X [monto]</code>\n` +
      `• Lotería: /lode\n` +
      `• Mín: 1.000₫ | Máx: 1.000.000₫\n\n` +
      `🎁 <b>CÓDIGO DE REGALO</b>\n` +
      `• /code [código] — Ingresar código\n\n` +
      `🆘 <b>SOPORTE</b>\n` +
      `• /hotro — Contactar soporte`,
    startCaption:   "🎫 Tu ID: {id}\n\n👉 Únete a Room TX para ganar jackpots y obtener códigos de regalo diarios https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Vincular cuenta web de Haru88</b>",
    wlinkPrompt:    "Para completar la vinculación, comparte tu número de teléfono.\n📱 Presiona el botón <b>\"Enviar número de teléfono\"</b> abajo.",
    wlinkBtn:       "📱 Enviar número de teléfono",
  },

  // ════════════════════════════════════════════════════════════════
  pt: {
    menuProfile:    "👤 Perfil",
    menuGames:      "🎮 Jogos",
    menuReferral:   "🎁 Indicação",
    menuRanking:    "🏆 Ranking",
    menuEvents:     "🎊 Eventos",
    menuCommission: "💰 Comissão",
    menuSupport:    "🆘 Suporte",
    menuLanguage:   "🌐 Idioma",
    menuPrompt:     "✨ Selecione uma função abaixo para começar.",
    langTitle:      "🌐 <b>Selecionar idioma / Select language</b>",
    langChanged:    "✅ Idioma alterado para",
    langCurrent:    "Idioma atual",
    errGeneral:     "❌ Ocorreu um erro. Tente novamente!",
    errUserNotFound:"❌ Conta não encontrada.",
    errInsufficient:"❌ Saldo insuficiente!",
    loading:        "⏳ Processando...",
    balance:        "💎 Saldo",
    remainingBalance:"💎 Saldo restante",
    betAmount:      "💸 Valor apostado",
    winAmount:      "🏆 Valor do prêmio",
    totalLabel:     "💸 Total",
    dateLabel:      "📅 Resultado XSMB hoje",
    luckyNext:      "💡 Boa sorte na próxima! Novas apostas a partir das 00:00.",
    lodeBetSuccess: "✅ APOSTA {type} REALIZADA COM SUCESSO!",
    lodeNumbers:    "🔢 Números apostados",
    lodeEach:       "🎯 Por número",
    lodeIfWin:      "🏆 Se ganhar",
    lodeSet:        "🔢 Conjunto de números",
    lodePoints:     "pontos",
    lodeMinErr:     "❌ Aposta mínima <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Apostas encerradas para hoje!</b>",
    lodeCloseDetail:"O resultado XSMB já saiu. Aposte amanhã.\n💡 Digite <code>XSMB</code> para ver o resultado.",
    lodeClosesSoon: "⏰ <b>Apostas fechando em breve!</b>",
    lodeClosesSoonDetail: "Sem novas apostas após 18:25. Digite <code>XSMB</code>.",
    lodeViewPending:"💡 Digite <code>CUOCLO</code> para ver apostas pendentes.",
    lodeMyBetsTitle:"📋 <b>Apostas de Hoje ({date})</b>",
    lodeMyBetsEmpty:"Você não tem apostas hoje.",
    lodeMyBetsEmptyHint:"💡 Sintaxe:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Mínimo 2.000₫/pedido",
    lodeTotalBet:   "💸 Total apostado",
    lodePending:    "⏰ Resultados atualizados automaticamente após 18:30!",
    lodeResultsTitle:"🎰 <b>SEUS RESULTADOS - {date}</b>",
    lodeWonLabel:   "🏆 <b>GANHOU:</b>",
    lodeLostLabel:  "😢 <b>Não ganhou:</b>",
    lodeTotalWon:   "💎 Prêmio total:",
    depositTitle:   "💳 DEPÓSITO",
    depositSuccess: "✅ Depósito realizado!",
    depositPending: "⏳ Processando depósito...",
    depositPrompt:  "Escolha seu método de depósito:",
    depositBank:    "🏦 Transferência Bancária",
    depositCard:    "🎫 Cartão Pré-pago",
    withdrawTitle:  "🏦 Saque",
    withdrawSuccess:"✅ Saque realizado!",
    withdrawPending:"⏳ Processando saque...",
    profileTitle:   "👤 <b>PERFIL HARU88:</b>",
    profileName:    "Nome",
    profileVault:   "Cofre",
    profileVaultNotSet: "não configurado",
    profileGames:   "Partidas jogadas",
    profileCommission: "Comissão",
    profileGiftcode: "Código de presente",
    profileGiftcodeUsed: "✅ Usado",
    profileGiftcodeNotUsed: "❌ Não usado",
    profileAttendance: "Presença",
    profileDays:    "dias",
    profilePrompt:  "✨ Escolha uma função abaixo para continuar ✨",
    btnDeposit:     "🏦 Depositar",
    btnWithdraw:    "🏦 Sacar",
    btnBuyGiftcode: "🎁 Comprar código",
    btnEnterGiftcode: "🎉 Inserir código",
    btnDepositHistory: "📜 Histórico de depósitos",
    btnWithdrawHistory: "📜 Histórico de saques",
    btnRedEnvelope: "🧧 Envelope Vermelho",
    btnBetHistory:  "📊 Histórico de apostas",
    btnVipLevel:    "👑 NÍVEL VIP",
    btnTransfer:    "💸 Transferir",
    btnVault:       "🔐 Cofre",
    btnBack:        "↩️ Voltar",
    gameMenuTitle:  "🎮 <b>ZONA DE JOGOS</b>",
    gameMenuPrompt: "Escolha um jogo para começar:",
    gameBasketball: "🏀 Basquete 🏀",
    gameFootball:   "⚽️ Futebol ⚽️",
    gameMaybay:     "✈️ Jogo de Crash",
    supportTitle:   "🆘 <b>ATENDIMENTO AO CLIENTE</b> 🆘",
    supportBody:    "PRESSIONE OS BOTÕES ABAIXO PARA SUPORTE!\n\n🕰 Disponível 24/7 - Todos os dias",
    supportBtnTelegram: "📱 Suporte Telegram",
    helpFull:
      `📖 <b>GUIA DO BOT HARU88</b>\n\n` +
      `💰 <b>DEPÓSITO</b>\n` +
      `• /nap — Abrir menu de depósito\n` +
      `• Deposite via transferência bancária ou cartão\n\n` +
      `💸 <b>SAQUE</b>\n` +
      `• /rutbank — Sacar pelo banco vinculado\n` +
      `⚠️ Informação errada ainda desconta o saldo!\n\n` +
      `🎮 <b>JOGOS</b>\n` +
      `• Tài Xỉu: digite <code>T [valor]</code> ou <code>X [valor]</code>\n` +
      `• Loteria: /lode\n` +
      `• Mín: 1.000₫ | Máx: 1.000.000₫\n\n` +
      `🎁 <b>CÓDIGO DE PRESENTE</b>\n` +
      `• /code [código] — Inserir código\n\n` +
      `🆘 <b>SUPORTE</b>\n` +
      `• /hotro — Contatar suporte`,
    startCaption:   "🎫 Seu ID: {id}\n\n👉 Junte-se à Room TX para ganhar jackpots e receber códigos diários https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Vincular conta web Haru88</b>",
    wlinkPrompt:    "Para concluir a vinculação, compartilhe seu número de telefone.\n📱 Pressione o botão <b>\"Enviar número de telefone\"</b> abaixo.",
    wlinkBtn:       "📱 Enviar número de telefone",
  },

  // ════════════════════════════════════════════════════════════════
  fr: {
    menuProfile:    "👤 Profil",
    menuGames:      "🎮 Jeux",
    menuReferral:   "🎁 Parrainage",
    menuRanking:    "🏆 Classement",
    menuEvents:     "🎊 Événements",
    menuCommission: "💰 Commission",
    menuSupport:    "🆘 Support",
    menuLanguage:   "🌐 Langue",
    menuPrompt:     "✨ Sélectionnez une fonction ci-dessous.",
    langTitle:      "🌐 <b>Choisir la langue / Select language</b>",
    langChanged:    "✅ Langue changée en",
    langCurrent:    "Langue actuelle",
    errGeneral:     "❌ Une erreur est survenue. Veuillez réessayer!",
    errUserNotFound:"❌ Compte introuvable.",
    errInsufficient:"❌ Solde insuffisant!",
    loading:        "⏳ Traitement en cours...",
    balance:        "💎 Solde",
    remainingBalance:"💎 Solde restant",
    betAmount:      "💸 Montant misé",
    winAmount:      "🏆 Montant gagné",
    totalLabel:     "💸 Total",
    dateLabel:      "📅 Résultat XSMB aujourd'hui",
    luckyNext:      "💡 Bonne chance la prochaine fois! Nouvelles mises à 00:00.",
    lodeBetSuccess: "✅ MISE {type} ACCEPTÉE!",
    lodeNumbers:    "🔢 Numéros misés",
    lodeEach:       "🎯 Par numéro",
    lodeIfWin:      "🏆 En cas de gain",
    lodeSet:        "🔢 Ensemble de numéros",
    lodePoints:     "pts",
    lodeMinErr:     "❌ Mise minimale <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Les mises sont fermées pour aujourd'hui!</b>",
    lodeCloseDetail:"Les résultats XSMB sont sortis. Misez demain.\n💡 Tapez <code>XSMB</code> pour voir les résultats.",
    lodeClosesSoon: "⏰ <b>Les mises ferment bientôt!</b>",
    lodeClosesSoonDetail: "Pas de nouvelles mises après 18h25. Tapez <code>XSMB</code>.",
    lodeViewPending:"💡 Tapez <code>CUOCLO</code> pour voir les mises en attente.",
    lodeMyBetsTitle:"📋 <b>Mises d'Aujourd'hui ({date})</b>",
    lodeMyBetsEmpty:"Vous n'avez pas de mises aujourd'hui.",
    lodeMyBetsEmptyHint:"💡 Syntaxe:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimum 2 000₫/commande",
    lodeTotalBet:   "💸 Total misé",
    lodePending:    "⏰ Résultats mis à jour automatiquement après 18h30!",
    lodeResultsTitle:"🎰 <b>VOS RÉSULTATS - {date}</b>",
    lodeWonLabel:   "🏆 <b>GAGNÉ:</b>",
    lodeLostLabel:  "😢 <b>Non gagné:</b>",
    lodeTotalWon:   "💎 Prix total:",
    depositTitle:   "💳 DÉPÔT",
    depositSuccess: "✅ Dépôt réussi!",
    depositPending: "⏳ Traitement du dépôt...",
    depositPrompt:  "Choisissez votre méthode de dépôt:",
    depositBank:    "🏦 Virement Bancaire",
    depositCard:    "🎫 Carte Prépayée",
    withdrawTitle:  "🏦 Retrait",
    withdrawSuccess:"✅ Retrait réussi!",
    withdrawPending:"⏳ Traitement du retrait...",
    profileTitle:   "👤 <b>PROFIL HARU88:</b>",
    profileName:    "Nom",
    profileVault:   "Coffre",
    profileVaultNotSet: "non configuré",
    profileGames:   "Parties jouées",
    profileCommission: "Commission",
    profileGiftcode: "Code cadeau",
    profileGiftcodeUsed: "✅ Utilisé",
    profileGiftcodeNotUsed: "❌ Non utilisé",
    profileAttendance: "Présence",
    profileDays:    "jours",
    profilePrompt:  "✨ Choisissez une fonction ci-dessous pour continuer ✨",
    btnDeposit:     "🏦 Déposer",
    btnWithdraw:    "🏦 Retirer",
    btnBuyGiftcode: "🎁 Acheter un code",
    btnEnterGiftcode: "🎉 Saisir un code",
    btnDepositHistory: "📜 Historique des dépôts",
    btnWithdrawHistory: "📜 Historique des retraits",
    btnRedEnvelope: "🧧 Enveloppe Rouge",
    btnBetHistory:  "📊 Historique des mises",
    btnVipLevel:    "👑 NIVEAU VIP",
    btnTransfer:    "💸 Virement",
    btnVault:       "🔐 Coffre",
    btnBack:        "↩️ Retour",
    gameMenuTitle:  "🎮 <b>ZONE DE JEUX</b>",
    gameMenuPrompt: "Choisissez un jeu pour commencer:",
    gameBasketball: "🏀 Basketball 🏀",
    gameFootball:   "⚽️ Football ⚽️",
    gameMaybay:     "✈️ Jeu Crash",
    supportTitle:   "🆘 <b>SERVICE CLIENT</b> 🆘",
    supportBody:    "APPUYEZ SUR LES BOUTONS CI-DESSOUS POUR LE SUPPORT!\n\n🕰 Disponible 24h/24 7j/7",
    supportBtnTelegram: "📱 Support Telegram",
    helpFull:
      `📖 <b>GUIDE DU BOT HARU88</b>\n\n` +
      `💰 <b>DÉPÔT</b>\n` +
      `• /nap — Ouvrir le menu de dépôt\n` +
      `• Dépôt via virement bancaire ou carte\n\n` +
      `💸 <b>RETRAIT</b>\n` +
      `• /rutbank — Retrait via banque liée\n` +
      `⚠️ Une info incorrecte déduira quand même le solde!\n\n` +
      `🎮 <b>JEUX</b>\n` +
      `• Tài Xỉu: tapez <code>T [montant]</code> ou <code>X [montant]</code>\n` +
      `• Loterie: /lode\n` +
      `• Min: 1 000₫ | Max: 1 000 000₫\n\n` +
      `🎁 <b>CODE CADEAU</b>\n` +
      `• /code [code] — Saisir un code\n\n` +
      `🆘 <b>SUPPORT</b>\n` +
      `• /hotro — Contacter le support`,
    startCaption:   "🎫 Votre ID: {id}\n\n👉 Rejoignez Room TX pour gagner des jackpots et recevoir des codes cadeaux quotidiens https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Lier le compte web Haru88</b>",
    wlinkPrompt:    "Pour terminer la liaison, partagez votre numéro de téléphone.\n📱 Appuyez sur le bouton <b>«Envoyer le numéro»</b> ci-dessous.",
    wlinkBtn:       "📱 Envoyer le numéro de téléphone",
  },

  // ════════════════════════════════════════════════════════════════
  de: {
    menuProfile:    "👤 Profil",
    menuGames:      "🎮 Spiele",
    menuReferral:   "🎁 Empfehlung",
    menuRanking:    "🏆 Rangliste",
    menuEvents:     "🎊 Events",
    menuCommission: "💰 Provision",
    menuSupport:    "🆘 Support",
    menuLanguage:   "🌐 Sprache",
    menuPrompt:     "✨ Wähle unten eine Funktion aus.",
    langTitle:      "🌐 <b>Sprache wählen / Select language</b>",
    langChanged:    "✅ Sprache geändert zu",
    langCurrent:    "Aktuelle Sprache",
    errGeneral:     "❌ Ein Fehler ist aufgetreten. Bitte erneut versuchen!",
    errUserNotFound:"❌ Konto nicht gefunden.",
    errInsufficient:"❌ Guthaben unzureichend!",
    loading:        "⏳ Verarbeitung...",
    balance:        "💎 Guthaben",
    remainingBalance:"💎 Verbleibendes Guthaben",
    betAmount:      "💸 Wetteinsatz",
    winAmount:      "🏆 Gewinnbetrag",
    totalLabel:     "💸 Gesamt",
    dateLabel:      "📅 XSMB-Ergebnis heute",
    luckyNext:      "💡 Viel Glück beim nächsten Mal! Neue Wetten ab 00:00.",
    lodeBetSuccess: "✅ WETTE {type} ERFOLGREICH!",
    lodeNumbers:    "🔢 Gewettete Zahlen",
    lodeEach:       "🎯 Pro Zahl",
    lodeIfWin:      "🏆 Bei Gewinn",
    lodeSet:        "🔢 Zahlenset",
    lodePoints:     "Punkte",
    lodeMinErr:     "❌ Mindesteinsatz <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Wetten für heute geschlossen!</b>",
    lodeCloseDetail:"XSMB-Ergebnisse sind raus. Morgen erneut wetten.\n💡 Tippe <code>XSMB</code> für heutige Ergebnisse.",
    lodeClosesSoon: "⏰ <b>Wetten schließen bald!</b>",
    lodeClosesSoonDetail: "Keine neuen Wetten nach 18:25. Tippe <code>XSMB</code>.",
    lodeViewPending:"💡 Tippe <code>CUOCLO</code> für ausstehende Wetten.",
    lodeMyBetsTitle:"📋 <b>Heutige Wetten ({date})</b>",
    lodeMyBetsEmpty:"Du hast heute keine Wetten.",
    lodeMyBetsEmptyHint:"💡 Syntax:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Mindest 2.000₫/Bestellung",
    lodeTotalBet:   "💸 Gesamteinsatz",
    lodePending:    "⏰ Ergebnisse nach 18:30 Uhr automatisch aktualisiert!",
    lodeResultsTitle:"🎰 <b>IHRE ERGEBNISSE - {date}</b>",
    lodeWonLabel:   "🏆 <b>GEWONNEN:</b>",
    lodeLostLabel:  "😢 <b>Nicht gewonnen:</b>",
    lodeTotalWon:   "💎 Gesamtpreis:",
    depositTitle:   "💳 EINZAHLUNG",
    depositSuccess: "✅ Einzahlung erfolgreich!",
    depositPending: "⏳ Einzahlung wird verarbeitet...",
    depositPrompt:  "Wähle deine Einzahlungsmethode:",
    depositBank:    "🏦 Banküberweisung",
    depositCard:    "🎫 Prepaid-Karte",
    withdrawTitle:  "🏦 Auszahlung",
    withdrawSuccess:"✅ Auszahlung erfolgreich!",
    withdrawPending:"⏳ Auszahlungsanfrage wird verarbeitet...",
    profileTitle:   "👤 <b>HARU88 PROFIL:</b>",
    profileName:    "Name",
    profileVault:   "Tresor",
    profileVaultNotSet: "nicht eingerichtet",
    profileGames:   "Gespielte Spiele",
    profileCommission: "Provision",
    profileGiftcode: "Geschenkcode",
    profileGiftcodeUsed: "✅ Verwendet",
    profileGiftcodeNotUsed: "❌ Nicht verwendet",
    profileAttendance: "Anwesenheit",
    profileDays:    "Tage",
    profilePrompt:  "✨ Wähle eine Funktion unten aus ✨",
    btnDeposit:     "🏦 Einzahlen",
    btnWithdraw:    "🏦 Auszahlen",
    btnBuyGiftcode: "🎁 Code kaufen",
    btnEnterGiftcode: "🎉 Code eingeben",
    btnDepositHistory: "📜 Einzahlungsverlauf",
    btnWithdrawHistory: "📜 Auszahlungsverlauf",
    btnRedEnvelope: "🧧 Roter Umschlag",
    btnBetHistory:  "📊 Wettverlauf",
    btnVipLevel:    "👑 VIP-LEVEL",
    btnTransfer:    "💸 Überweisung",
    btnVault:       "🔐 Tresor",
    btnBack:        "↩️ Zurück",
    gameMenuTitle:  "🎮 <b>SPIELBEREICH</b>",
    gameMenuPrompt: "Wähle ein Spiel zum Starten:",
    gameBasketball: "🏀 Basketball 🏀",
    gameFootball:   "⚽️ Fußball ⚽️",
    gameMaybay:     "✈️ Crash-Spiel",
    supportTitle:   "🆘 <b>KUNDENDIENST</b> 🆘",
    supportBody:    "DRÜCKE DIE SCHALTFLÄCHEN UNTEN FÜR SUPPORT!\n\n🕰 Verfügbar 24/7 - Jeden Tag",
    supportBtnTelegram: "📱 Telegram-Support",
    helpFull:
      `📖 <b>HARU88 BOT ANLEITUNG</b>\n\n` +
      `💰 <b>EINZAHLUNG</b>\n` +
      `• /nap — Einzahlungsmenü öffnen\n` +
      `• Per Banküberweisung oder Karte\n\n` +
      `💸 <b>AUSZAHLUNG</b>\n` +
      `• /rutbank — Über verknüpfte Bank auszahlen\n` +
      `⚠️ Falsche Daten führen trotzdem zu Abzügen!\n\n` +
      `🎮 <b>SPIELE</b>\n` +
      `• Tài Xỉu: tippe <code>T [Betrag]</code> oder <code>X [Betrag]</code>\n` +
      `• Lotterie: /lode\n` +
      `• Min: 1.000₫ | Max: 1.000.000₫\n\n` +
      `🎁 <b>GESCHENKCODE</b>\n` +
      `• /code [Code] — Code eingeben\n\n` +
      `🆘 <b>SUPPORT</b>\n` +
      `• /hotro — Support kontaktieren`,
    startCaption:   "🎫 Deine ID: {id}\n\n👉 Tritt Room TX bei für Jackpots und tägliche Geschenkcodes https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Haru88 Web-Konto verknüpfen</b>",
    wlinkPrompt:    "Zum Abschluss der Verknüpfung teile deine Telefonnummer.\n📱 Drücke die Schaltfläche <b>«Telefonnummer senden»</b> unten.",
    wlinkBtn:       "📱 Telefonnummer senden",
  },

  // ════════════════════════════════════════════════════════════════
  hi: {
    menuProfile:    "👤 प्रोफ़ाइल",
    menuGames:      "🎮 खेल",
    menuReferral:   "🎁 रेफ़रल",
    menuRanking:    "🏆 रैंकिंग",
    menuEvents:     "🎊 इवेंट",
    menuCommission: "💰 कमीशन",
    menuSupport:    "🆘 सहायता",
    menuLanguage:   "🌐 भाषा",
    menuPrompt:     "✨ नीचे से एक सुविधा चुनें।",
    langTitle:      "🌐 <b>भाषा चुनें / Select language</b>",
    langChanged:    "✅ भाषा बदल दी गई:",
    langCurrent:    "वर्तमान भाषा",
    errGeneral:     "❌ त्रुटि हुई। कृपया पुनः प्रयास करें!",
    errUserNotFound:"❌ खाता नहीं मिला।",
    errInsufficient:"❌ पर्याप्त बैलेंस नहीं!",
    loading:        "⏳ प्रोसेस हो रहा है...",
    balance:        "💎 बैलेंस",
    remainingBalance:"💎 शेष बैलेंस",
    betAmount:      "💸 दांव राशि",
    winAmount:      "🏆 जीत राशि",
    totalLabel:     "💸 कुल",
    dateLabel:      "📅 आज का XSMB परिणाम",
    luckyNext:      "💡 अगली बार भाग्य साथ हो! नए दांव 00:00 से।",
    lodeBetSuccess: "✅ {type} दांव सफल!",
    lodeNumbers:    "🔢 दांव संख्याएं",
    lodeEach:       "🎯 प्रत्येक संख्या",
    lodeIfWin:      "🏆 जीतने पर",
    lodeSet:        "🔢 संख्या सेट",
    lodePoints:     "पॉइंट",
    lodeMinErr:     "❌ न्यूनतम दांव <b>{min}</b>!",
    lodeClosed:     "⏰ <b>आज के दांव बंद हो गए!</b>",
    lodeCloseDetail:"XSMB परिणाम आ गया। कल दांव लगाएं।\n💡 <code>XSMB</code> टाइप करें।",
    lodeClosesSoon: "⏰ <b>दांव जल्द बंद होंगे!</b>",
    lodeClosesSoonDetail: "18:25 के बाद नए दांव नहीं। <code>XSMB</code> टाइप करें।",
    lodeViewPending:"💡 <code>CUOCLO</code> टाइप करें।",
    lodeMyBetsTitle:"📋 <b>आज के दांव ({date})</b>",
    lodeMyBetsEmpty:"आज कोई दांव नहीं।",
    lodeMyBetsEmptyHint:"💡 दांव का तरीका:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 न्यूनतम 2,000₫/ऑर्डर",
    lodeTotalBet:   "💸 कुल दांव",
    lodePending:    "⏰ परिणाम 18:30 के बाद स्वत: अपडेट!",
    lodeResultsTitle:"🎰 <b>आपका परिणाम - {date}</b>",
    lodeWonLabel:   "🏆 <b>जीते:</b>",
    lodeLostLabel:  "😢 <b>नहीं जीते:</b>",
    lodeTotalWon:   "💎 कुल पुरस्कार:",
    depositTitle:   "💳 जमा",
    depositSuccess: "✅ जमा सफल!",
    depositPending: "⏳ जमा प्रोसेस हो रही है...",
    depositPrompt:  "जमा का तरीका चुनें:",
    depositBank:    "🏦 बैंक ट्रांसफर",
    depositCard:    "🎫 प्रीपेड कार्ड",
    withdrawTitle:  "🏦 निकासी",
    withdrawSuccess:"✅ निकासी सफल!",
    withdrawPending:"⏳ निकासी प्रोसेस हो रही है...",
    profileTitle:   "👤 <b>HARU88 प्रोफ़ाइल:</b>",
    profileName:    "नाम",
    profileVault:   "तिजोरी",
    profileVaultNotSet: "सेट नहीं",
    profileGames:   "खेल खेले",
    profileCommission: "कमीशन",
    profileGiftcode: "गिफ्ट कोड",
    profileGiftcodeUsed: "✅ उपयोग किया",
    profileGiftcodeNotUsed: "❌ नहीं किया",
    profileAttendance: "उपस्थिति",
    profileDays:    "दिन",
    profilePrompt:  "✨ जारी रखने के लिए नीचे से चुनें ✨",
    btnDeposit:     "🏦 जमा करें",
    btnWithdraw:    "🏦 निकालें",
    btnBuyGiftcode: "🎁 गिफ्ट कोड खरीदें",
    btnEnterGiftcode: "🎉 गिफ्ट कोड डालें",
    btnDepositHistory: "📜 जमा इतिहास",
    btnWithdrawHistory: "📜 निकासी इतिहास",
    btnRedEnvelope: "🧧 लाल लिफाफा",
    btnBetHistory:  "📊 दांव इतिहास",
    btnVipLevel:    "👑 VIP स्तर",
    btnTransfer:    "💸 ट्रांसफर",
    btnVault:       "🔐 तिजोरी",
    btnBack:        "↩️ वापस",
    gameMenuTitle:  "🎮 <b>गेम जोन</b>",
    gameMenuPrompt: "शुरू करने के लिए गेम चुनें:",
    gameBasketball: "🏀 बास्केटबॉल 🏀",
    gameFootball:   "⚽️ फुटबॉल ⚽️",
    gameMaybay:     "✈️ क्रैश गेम",
    supportTitle:   "🆘 <b>ग्राहक सेवा</b> 🆘",
    supportBody:    "सहायता के लिए नीचे बटन दबाएं!\n\n🕰 24/7 उपलब्ध - हर दिन",
    supportBtnTelegram: "📱 Telegram सहायता",
    helpFull:
      `📖 <b>HARU88 बॉट उपयोग गाइड</b>\n\n` +
      `💰 <b>जमा</b>\n` +
      `• /nap — जमा मेनू खोलें\n` +
      `• बैंक ट्रांसफर या कार्ड से जमा करें\n\n` +
      `💸 <b>निकासी</b>\n` +
      `• /rutbank — लिंक्ड बैंक से निकालें\n` +
      `⚠️ गलत जानकारी से भी राशि कटेगी!\n\n` +
      `🎮 <b>खेल</b>\n` +
      `• Tài Xỉu: <code>T [राशि]</code> या <code>X [राशि]</code> टाइप करें\n` +
      `• लॉटरी: /lode\n` +
      `• न्यूनतम: 1,000₫ | अधिकतम: 1,000,000₫\n\n` +
      `🎁 <b>गिफ्ट कोड</b>\n` +
      `• /code [कोड] — गिफ्ट कोड डालें\n\n` +
      `🆘 <b>सहायता</b>\n` +
      `• /hotro — सहायता से संपर्क करें`,
    startCaption:   "🎫 आपका ID: {id}\n\n👉 जैकपॉट जीतने और दैनिक गिफ्ट कोड पाने के लिए Room TX में शामिल हों https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Haru88 वेब अकाउंट लिंक करें</b>",
    wlinkPrompt:    "लिंकिंग पूरी करने के लिए अपना फोन नंबर साझा करें।\n📱 नीचे <b>\"फोन नंबर भेजें\"</b> बटन दबाएं।",
    wlinkBtn:       "📱 फोन नंबर भेजें",
  },

  // ════════════════════════════════════════════════════════════════
  ar: {
    menuProfile:    "👤 الملف الشخصي",
    menuGames:      "🎮 الألعاب",
    menuReferral:   "🎁 الإحالة",
    menuRanking:    "🏆 التصنيف",
    menuEvents:     "🎊 الأحداث",
    menuCommission: "💰 العمولة",
    menuSupport:    "🆘 الدعم",
    menuLanguage:   "🌐 اللغة",
    menuPrompt:     "✨ اختر ميزة أدناه للبدء.",
    langTitle:      "🌐 <b>اختر اللغة / Select language</b>",
    langChanged:    "✅ تم تغيير اللغة إلى",
    langCurrent:    "اللغة الحالية",
    errGeneral:     "❌ حدث خطأ. يرجى المحاولة مجدداً!",
    errUserNotFound:"❌ الحساب غير موجود.",
    errInsufficient:"❌ الرصيد غير كافٍ!",
    loading:        "⏳ جارٍ المعالجة...",
    balance:        "💎 الرصيد",
    remainingBalance:"💎 الرصيد المتبقي",
    betAmount:      "💸 مبلغ الرهان",
    winAmount:      "🏆 مبلغ الفوز",
    totalLabel:     "💸 الإجمالي",
    dateLabel:      "📅 نتيجة XSMB اليوم",
    luckyNext:      "💡 حظاً موفقاً في المرة القادمة! رهانات جديدة تبدأ 00:00.",
    lodeBetSuccess: "✅ تم قبول الرهان {type}!",
    lodeNumbers:    "🔢 الأرقام المراهن عليها",
    lodeEach:       "🎯 لكل رقم",
    lodeIfWin:      "🏆 عند الفوز",
    lodeSet:        "🔢 مجموعة الأرقام",
    lodePoints:     "نقطة",
    lodeMinErr:     "❌ الحد الأدنى للرهان <b>{min}</b>!",
    lodeClosed:     "⏰ <b>الرهانات مغلقة اليوم!</b>",
    lodeCloseDetail:"صدرت نتائج XSMB. راهن غداً.\n💡 اكتب <code>XSMB</code> للنتيجة.",
    lodeClosesSoon: "⏰ <b>الرهانات ستُغلق قريباً!</b>",
    lodeClosesSoonDetail: "لا رهانات بعد 18:25. اكتب <code>XSMB</code>.",
    lodeViewPending:"💡 اكتب <code>CUOCLO</code> للرهانات المعلقة.",
    lodeMyBetsTitle:"📋 <b>رهانات اليوم ({date})</b>",
    lodeMyBetsEmpty:"لا رهانات لديك اليوم.",
    lodeMyBetsEmptyHint:"💡 طريقة الرهان:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 الحد الأدنى 2,000₫/طلب",
    lodeTotalBet:   "💸 إجمالي الرهانات",
    lodePending:    "⏰ ستُحدَّث النتائج تلقائياً بعد 18:30!",
    lodeResultsTitle:"🎰 <b>نتائجك - {date}</b>",
    lodeWonLabel:   "🏆 <b>فزت:</b>",
    lodeLostLabel:  "😢 <b>لم تفز:</b>",
    lodeTotalWon:   "💎 إجمالي الجائزة:",
    depositTitle:   "💳 إيداع",
    depositSuccess: "✅ تم الإيداع بنجاح!",
    depositPending: "⏳ جارٍ معالجة الإيداع...",
    depositPrompt:  "اختر طريقة الإيداع:",
    depositBank:    "🏦 تحويل بنكي",
    depositCard:    "🎫 بطاقة مدفوعة مسبقاً",
    withdrawTitle:  "🏦 سحب",
    withdrawSuccess:"✅ تم السحب بنجاح!",
    withdrawPending:"⏳ جارٍ معالجة طلب السحب...",
    profileTitle:   "👤 <b>ملف HARU88:</b>",
    profileName:    "الاسم",
    profileVault:   "الخزنة",
    profileVaultNotSet: "غير مُعدَّة",
    profileGames:   "الألعاب المُلعبة",
    profileCommission: "العمولة",
    profileGiftcode: "رمز الهدية",
    profileGiftcodeUsed: "✅ مُستخدَم",
    profileGiftcodeNotUsed: "❌ غير مُستخدَم",
    profileAttendance: "الحضور",
    profileDays:    "أيام",
    profilePrompt:  "✨ اختر ميزة أدناه للمتابعة ✨",
    btnDeposit:     "🏦 إيداع",
    btnWithdraw:    "🏦 سحب",
    btnBuyGiftcode: "🎁 شراء رمز هدية",
    btnEnterGiftcode: "🎉 إدخال رمز هدية",
    btnDepositHistory: "📜 سجل الإيداع",
    btnWithdrawHistory: "📜 سجل السحب",
    btnRedEnvelope: "🧧 المغلف الأحمر",
    btnBetHistory:  "📊 سجل الرهانات",
    btnVipLevel:    "👑 مستوى VIP",
    btnTransfer:    "💸 تحويل",
    btnVault:       "🔐 الخزنة",
    btnBack:        "↩️ رجوع",
    gameMenuTitle:  "🎮 <b>منطقة الألعاب</b>",
    gameMenuPrompt: "اختر لعبة للبدء:",
    gameBasketball: "🏀 كرة السلة 🏀",
    gameFootball:   "⚽️ كرة القدم ⚽️",
    gameMaybay:     "✈️ لعبة كراش",
    supportTitle:   "🆘 <b>خدمة العملاء</b> 🆘",
    supportBody:    "اضغط على الأزرار أدناه للحصول على الدعم!\n\n🕰 متاح 24/7 - كل يوم",
    supportBtnTelegram: "📱 دعم Telegram",
    helpFull:
      `📖 <b>دليل بوت HARU88</b>\n\n` +
      `💰 <b>الإيداع</b>\n` +
      `• /nap — فتح قائمة الإيداع\n` +
      `• الإيداع عبر تحويل بنكي أو بطاقة\n\n` +
      `💸 <b>السحب</b>\n` +
      `• /rutbank — السحب عبر البنك المرتبط\n` +
      `⚠️ المعلومات الخاطئة تخصم الرصيد!\n\n` +
      `🎮 <b>الألعاب</b>\n` +
      `• Tài Xỉu: اكتب <code>T [مبلغ]</code> أو <code>X [مبلغ]</code>\n` +
      `• اليانصيب: /lode\n` +
      `• الحد الأدنى: 1,000₫ | الأقصى: 1,000,000₫\n\n` +
      `🎁 <b>رمز الهدية</b>\n` +
      `• /code [رمز] — إدخال رمز هدية\n\n` +
      `🆘 <b>الدعم</b>\n` +
      `• /hotro — التواصل مع الدعم`,
    startCaption:   "🎫 معرّفك: {id}\n\n👉 انضم إلى Room TX للفوز بالجوائز الكبرى والحصول على رموز هدايا يومية https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>ربط حساب Haru88 Web</b>",
    wlinkPrompt:    "لإتمام الربط، شارك رقم هاتفك.\n📱 اضغط زر <b>«إرسال رقم الهاتف»</b> أدناه.",
    wlinkBtn:       "📱 إرسال رقم الهاتف",
  },

  // ════════════════════════════════════════════════════════════════
  tr: {
    menuProfile:    "👤 Profil",
    menuGames:      "🎮 Oyunlar",
    menuReferral:   "🎁 Referans",
    menuRanking:    "🏆 Sıralama",
    menuEvents:     "🎊 Etkinlikler",
    menuCommission: "💰 Komisyon",
    menuSupport:    "🆘 Destek",
    menuLanguage:   "🌐 Dil",
    menuPrompt:     "✨ Başlamak için aşağıdan bir özellik seçin.",
    langTitle:      "🌐 <b>Dil seçin / Select language</b>",
    langChanged:    "✅ Dil değiştirildi:",
    langCurrent:    "Mevcut dil",
    errGeneral:     "❌ Bir hata oluştu. Lütfen tekrar deneyin!",
    errUserNotFound:"❌ Hesap bulunamadı.",
    errInsufficient:"❌ Yetersiz bakiye!",
    loading:        "⏳ İşleniyor...",
    balance:        "💎 Bakiye",
    remainingBalance:"💎 Kalan bakiye",
    betAmount:      "💸 Bahis tutarı",
    winAmount:      "🏆 Kazanç tutarı",
    totalLabel:     "💸 Toplam",
    dateLabel:      "📅 Bugünkü XSMB sonucu",
    luckyNext:      "💡 Bir dahaki sefere şans! Yeni bahisler 00:00'dan itibaren.",
    lodeBetSuccess: "✅ {type} BAHSİ BAŞARILI!",
    lodeNumbers:    "🔢 Bahis numaraları",
    lodeEach:       "🎯 Her numara için",
    lodeIfWin:      "🏆 Kazanırsan",
    lodeSet:        "🔢 Numara seti",
    lodePoints:     "puan",
    lodeMinErr:     "❌ Minimum bahis <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Bugünkü bahisler kapatıldı!</b>",
    lodeCloseDetail:"XSMB sonuçları çıktı. Yarın bahis yap.\n💡 <code>XSMB</code> yaz.",
    lodeClosesSoon: "⏰ <b>Bahisler yakında kapanıyor!</b>",
    lodeClosesSoonDetail: "18:25 sonrası yeni bahis yok. <code>XSMB</code> yaz.",
    lodeViewPending:"💡 <code>CUOCLO</code> yazarak bekleyen bahisleri gör.",
    lodeMyBetsTitle:"📋 <b>Bugünkü Bahisler ({date})</b>",
    lodeMyBetsEmpty:"Bugün bahisiniz yok.",
    lodeMyBetsEmptyHint:"💡 Bahis yöntemi:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimum 2.000₫/sipariş",
    lodeTotalBet:   "💸 Toplam bahis",
    lodePending:    "⏰ Sonuçlar 18:30 sonrası otomatik güncellenir!",
    lodeResultsTitle:"🎰 <b>SONUÇLARINIZ - {date}</b>",
    lodeWonLabel:   "🏆 <b>KAZANDI:</b>",
    lodeLostLabel:  "😢 <b>Kazanamadı:</b>",
    lodeTotalWon:   "💎 Toplam ödül:",
    depositTitle:   "💳 PARA YATIRMA",
    depositSuccess: "✅ Para yatırma başarılı!",
    depositPending: "⏳ Para yatırma işleniyor...",
    depositPrompt:  "Para yatırma yönteminizi seçin:",
    depositBank:    "🏦 Banka Transferi",
    depositCard:    "🎫 Ön Ödemeli Kart",
    withdrawTitle:  "🏦 Para Çekme",
    withdrawSuccess:"✅ Para çekme başarılı!",
    withdrawPending:"⏳ Para çekme işleniyor...",
    profileTitle:   "👤 <b>HARU88 PROFİLİ:</b>",
    profileName:    "İsim",
    profileVault:   "Kasa",
    profileVaultNotSet: "ayarlanmamış",
    profileGames:   "Oynanan oyunlar",
    profileCommission: "Komisyon",
    profileGiftcode: "Hediye kodu",
    profileGiftcodeUsed: "✅ Kullanıldı",
    profileGiftcodeNotUsed: "❌ Kullanılmadı",
    profileAttendance: "Devam",
    profileDays:    "gün",
    profilePrompt:  "✨ Devam etmek için aşağıdan bir özellik seçin ✨",
    btnDeposit:     "🏦 Para Yatır",
    btnWithdraw:    "🏦 Para Çek",
    btnBuyGiftcode: "🎁 Hediye Kodu Al",
    btnEnterGiftcode: "🎉 Hediye Kodu Gir",
    btnDepositHistory: "📜 Yatırma Geçmişi",
    btnWithdrawHistory: "📜 Çekme Geçmişi",
    btnRedEnvelope: "🧧 Kırmızı Zarf",
    btnBetHistory:  "📊 Bahis Geçmişi",
    btnVipLevel:    "👑 VIP SEVİYESİ",
    btnTransfer:    "💸 Transfer",
    btnVault:       "🔐 Kasa",
    btnBack:        "↩️ Geri",
    gameMenuTitle:  "🎮 <b>OYUN ALANI</b>",
    gameMenuPrompt: "Başlamak için bir oyun seçin:",
    gameBasketball: "🏀 Basketbol 🏀",
    gameFootball:   "⚽️ Futbol ⚽️",
    gameMaybay:     "✈️ Crash Oyunu",
    supportTitle:   "🆘 <b>MÜŞTERİ HİZMETLERİ</b> 🆘",
    supportBody:    "DESTEK İÇİN AŞAĞIDAKİ BUTONLARA BASIN!\n\n🕰 7/24 Mevcut - Her gün",
    supportBtnTelegram: "📱 Telegram Desteği",
    helpFull:
      `📖 <b>HARU88 BOT KULLANIM KILAVUZU</b>\n\n` +
      `💰 <b>PARA YATIRMA</b>\n` +
      `• /nap — Para yatırma menüsü\n` +
      `• Banka transferi veya kart ile yatırın\n\n` +
      `💸 <b>PARA ÇEKME</b>\n` +
      `• /rutbank — Bağlı banka hesabına çekin\n` +
      `⚠️ Yanlış bilgi bakiyeden kesilir!\n\n` +
      `🎮 <b>OYUNLAR</b>\n` +
      `• Tài Xỉu: <code>T [miktar]</code> veya <code>X [miktar]</code> yazın\n` +
      `• Piyango: /lode\n` +
      `• Min: 1.000₫ | Maks: 1.000.000₫\n\n` +
      `🎁 <b>HEDİYE KODU</b>\n` +
      `• /code [kod] — Hediye kodu gir\n\n` +
      `🆘 <b>DESTEK</b>\n` +
      `• /hotro — Destek ile iletişime geç`,
    startCaption:   "🎫 ID'niz: {id}\n\n👉 Büyük ikramiyeler kazanmak ve günlük hediye kodları almak için Room TX'e katılın https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Haru88 Web Hesabını Bağla</b>",
    wlinkPrompt:    "Bağlamayı tamamlamak için telefon numaranızı paylaşın.\n📱 Aşağıdaki <b>«Telefon numarası gönder»</b> düğmesine basın.",
    wlinkBtn:       "📱 Telefon numarası gönder",
  },

  // ════════════════════════════════════════════════════════════════
  it: {
    menuProfile:    "👤 Profilo",
    menuGames:      "🎮 Giochi",
    menuReferral:   "🎁 Referral",
    menuRanking:    "🏆 Classifica",
    menuEvents:     "🎊 Eventi",
    menuCommission: "💰 Commissione",
    menuSupport:    "🆘 Supporto",
    menuLanguage:   "🌐 Lingua",
    menuPrompt:     "✨ Seleziona una funzione qui sotto per iniziare.",
    langTitle:      "🌐 <b>Seleziona lingua / Select language</b>",
    langChanged:    "✅ Lingua cambiata in",
    langCurrent:    "Lingua attuale",
    errGeneral:     "❌ Si è verificato un errore. Riprova!",
    errUserNotFound:"❌ Account non trovato.",
    errInsufficient:"❌ Saldo insufficiente!",
    loading:        "⏳ Elaborazione...",
    balance:        "💎 Saldo",
    remainingBalance:"💎 Saldo rimanente",
    betAmount:      "💸 Importo puntata",
    winAmount:      "🏆 Importo vinto",
    totalLabel:     "💸 Totale",
    dateLabel:      "📅 Risultato XSMB oggi",
    luckyNext:      "💡 Buona fortuna la prossima volta! Nuove puntate dalle 00:00.",
    lodeBetSuccess: "✅ PUNTATA {type} EFFETTUATA!",
    lodeNumbers:    "🔢 Numeri puntati",
    lodeEach:       "🎯 Per numero",
    lodeIfWin:      "🏆 In caso di vincita",
    lodeSet:        "🔢 Set di numeri",
    lodePoints:     "punti",
    lodeMinErr:     "❌ Puntata minima <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Le puntate di oggi sono chiuse!</b>",
    lodeCloseDetail:"I risultati XSMB sono usciti. Punta domani.\n💡 Scrivi <code>XSMB</code>.",
    lodeClosesSoon: "⏰ <b>Le puntate chiuderanno presto!</b>",
    lodeClosesSoonDetail: "Nessuna nuova puntata dopo le 18:25. Scrivi <code>XSMB</code>.",
    lodeViewPending:"💡 Scrivi <code>CUOCLO</code> per le puntate in sospeso.",
    lodeMyBetsTitle:"📋 <b>Puntate di Oggi ({date})</b>",
    lodeMyBetsEmpty:"Non hai puntate oggi.",
    lodeMyBetsEmptyHint:"💡 Sintassi:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimo 2.000₫/ordine",
    lodeTotalBet:   "💸 Totale puntato",
    lodePending:    "⏰ Risultati aggiornati automaticamente dopo le 18:30!",
    lodeResultsTitle:"🎰 <b>I TUOI RISULTATI - {date}</b>",
    lodeWonLabel:   "🏆 <b>VINTO:</b>",
    lodeLostLabel:  "😢 <b>Non vinto:</b>",
    lodeTotalWon:   "💎 Premio totale:",
    depositTitle:   "💳 DEPOSITO",
    depositSuccess: "✅ Deposito riuscito!",
    depositPending: "⏳ Elaborazione deposito...",
    depositPrompt:  "Scegli il metodo di deposito:",
    depositBank:    "🏦 Bonifico Bancario",
    depositCard:    "🎫 Carta Prepagata",
    withdrawTitle:  "🏦 Prelievo",
    withdrawSuccess:"✅ Prelievo riuscito!",
    withdrawPending:"⏳ Elaborazione prelievo...",
    profileTitle:   "👤 <b>PROFILO HARU88:</b>",
    profileName:    "Nome",
    profileVault:   "Cassaforte",
    profileVaultNotSet: "non configurata",
    profileGames:   "Partite giocate",
    profileCommission: "Commissione",
    profileGiftcode: "Codice regalo",
    profileGiftcodeUsed: "✅ Usato",
    profileGiftcodeNotUsed: "❌ Non usato",
    profileAttendance: "Presenze",
    profileDays:    "giorni",
    profilePrompt:  "✨ Scegli una funzione qui sotto per continuare ✨",
    btnDeposit:     "🏦 Deposita",
    btnWithdraw:    "🏦 Preleva",
    btnBuyGiftcode: "🎁 Acquista codice",
    btnEnterGiftcode: "🎉 Inserisci codice",
    btnDepositHistory: "📜 Storico depositi",
    btnWithdrawHistory: "📜 Storico prelievi",
    btnRedEnvelope: "🧧 Busta Rossa",
    btnBetHistory:  "📊 Storico puntate",
    btnVipLevel:    "👑 LIVELLO VIP",
    btnTransfer:    "💸 Trasferimento",
    btnVault:       "🔐 Cassaforte",
    btnBack:        "↩️ Indietro",
    gameMenuTitle:  "🎮 <b>ZONA GIOCHI</b>",
    gameMenuPrompt: "Scegli un gioco per iniziare:",
    gameBasketball: "🏀 Basket 🏀",
    gameFootball:   "⚽️ Calcio ⚽️",
    gameMaybay:     "✈️ Gioco Crash",
    supportTitle:   "🆘 <b>SERVIZIO CLIENTI</b> 🆘",
    supportBody:    "PREMI I PULSANTI SOTTOSTANTI PER SUPPORTO!\n\n🕰 Disponibile 24/7 - Ogni giorno",
    supportBtnTelegram: "📱 Supporto Telegram",
    helpFull:
      `📖 <b>GUIDA BOT HARU88</b>\n\n` +
      `💰 <b>DEPOSITO</b>\n` +
      `• /nap — Apri menu deposito\n` +
      `• Deposita via bonifico o carta\n\n` +
      `💸 <b>PRELIEVO</b>\n` +
      `• /rutbank — Preleva alla banca collegata\n` +
      `⚠️ Info errate deducono comunque il saldo!\n\n` +
      `🎮 <b>GIOCHI</b>\n` +
      `• Tài Xỉu: scrivi <code>T [importo]</code> o <code>X [importo]</code>\n` +
      `• Lotteria: /lode\n` +
      `• Min: 1.000₫ | Max: 1.000.000₫\n\n` +
      `🎁 <b>CODICE REGALO</b>\n` +
      `• /code [codice] — Inserisci codice\n\n` +
      `🆘 <b>SUPPORTO</b>\n` +
      `• /hotro — Contatta il supporto`,
    startCaption:   "🎫 Il tuo ID: {id}\n\n👉 Unisciti a Room TX per jackpot e codici regalo giornalieri https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Collega account web Haru88</b>",
    wlinkPrompt:    "Per completare il collegamento, condividi il tuo numero di telefono.\n📱 Premi il pulsante <b>«Invia numero di telefono»</b> qui sotto.",
    wlinkBtn:       "📱 Invia numero di telefono",
  },

  // ════════════════════════════════════════════════════════════════
  nl: {
    menuProfile:    "👤 Profiel",
    menuGames:      "🎮 Spellen",
    menuReferral:   "🎁 Verwijzing",
    menuRanking:    "🏆 Ranglijst",
    menuEvents:     "🎊 Evenementen",
    menuCommission: "💰 Commissie",
    menuSupport:    "🆘 Ondersteuning",
    menuLanguage:   "🌐 Taal",
    menuPrompt:     "✨ Selecteer hieronder een functie om te beginnen.",
    langTitle:      "🌐 <b>Taal selecteren / Select language</b>",
    langChanged:    "✅ Taal gewijzigd naar",
    langCurrent:    "Huidige taal",
    errGeneral:     "❌ Er is een fout opgetreden. Probeer opnieuw!",
    errUserNotFound:"❌ Account niet gevonden.",
    errInsufficient:"❌ Onvoldoende saldo!",
    loading:        "⏳ Verwerken...",
    balance:        "💎 Saldo",
    remainingBalance:"💎 Resterend saldo",
    betAmount:      "💸 Inzetbedrag",
    winAmount:      "🏆 Winstbedrag",
    totalLabel:     "💸 Totaal",
    dateLabel:      "📅 XSMB resultaat vandaag",
    luckyNext:      "💡 Succes de volgende keer! Nieuwe inzetten vanaf 00:00.",
    lodeBetSuccess: "✅ INZET {type} GEPLAATST!",
    lodeNumbers:    "🔢 Ingezette nummers",
    lodeEach:       "🎯 Per nummer",
    lodeIfWin:      "🏆 Bij winst",
    lodeSet:        "🔢 Nummerreeks",
    lodePoints:     "punten",
    lodeMinErr:     "❌ Minimale inzet <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Inzetten voor vandaag gesloten!</b>",
    lodeCloseDetail:"XSMB resultaten zijn uit. Inzet morgen.\n💡 Typ <code>XSMB</code>.",
    lodeClosesSoon: "⏰ <b>Inzetten sluiten binnenkort!</b>",
    lodeClosesSoonDetail: "Geen nieuwe inzetten na 18:25. Typ <code>XSMB</code>.",
    lodeViewPending:"💡 Typ <code>CUOCLO</code> voor uitstaande inzetten.",
    lodeMyBetsTitle:"📋 <b>Inzetten van Vandaag ({date})</b>",
    lodeMyBetsEmpty:"Je hebt vandaag geen inzetten.",
    lodeMyBetsEmptyHint:"💡 Syntaxis:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimum 2.000₫/bestelling",
    lodeTotalBet:   "💸 Totaal ingezet",
    lodePending:    "⏰ Resultaten worden automatisch bijgewerkt na 18:30!",
    lodeResultsTitle:"🎰 <b>UW RESULTATEN - {date}</b>",
    lodeWonLabel:   "🏆 <b>GEWONNEN:</b>",
    lodeLostLabel:  "😢 <b>Niet gewonnen:</b>",
    lodeTotalWon:   "💎 Totale prijs:",
    depositTitle:   "💳 STORTING",
    depositSuccess: "✅ Storting geslaagd!",
    depositPending: "⏳ Storting verwerken...",
    depositPrompt:  "Kies uw stortingsmethode:",
    depositBank:    "🏦 Bankoverschrijving",
    depositCard:    "🎫 Prepaidkaart",
    withdrawTitle:  "🏦 Opname",
    withdrawSuccess:"✅ Opname geslaagd!",
    withdrawPending:"⏳ Opnameverzoek verwerken...",
    profileTitle:   "👤 <b>HARU88 PROFIEL:</b>",
    profileName:    "Naam",
    profileVault:   "Kluis",
    profileVaultNotSet: "niet ingesteld",
    profileGames:   "Gespeelde spellen",
    profileCommission: "Commissie",
    profileGiftcode: "Cadeaucode",
    profileGiftcodeUsed: "✅ Gebruikt",
    profileGiftcodeNotUsed: "❌ Niet gebruikt",
    profileAttendance: "Aanwezigheid",
    profileDays:    "dagen",
    profilePrompt:  "✨ Kies een functie hieronder om door te gaan ✨",
    btnDeposit:     "🏦 Storten",
    btnWithdraw:    "🏦 Opnemen",
    btnBuyGiftcode: "🎁 Cadeaucode kopen",
    btnEnterGiftcode: "🎉 Cadeaucode invoeren",
    btnDepositHistory: "📜 Stortingsgeschiedenis",
    btnWithdrawHistory: "📜 Opnamegeschiedenis",
    btnRedEnvelope: "🧧 Rode Envelop",
    btnBetHistory:  "📊 Inzetgeschiedenis",
    btnVipLevel:    "👑 VIP-NIVEAU",
    btnTransfer:    "💸 Overschrijving",
    btnVault:       "🔐 Kluis",
    btnBack:        "↩️ Terug",
    gameMenuTitle:  "🎮 <b>SPELZONE</b>",
    gameMenuPrompt: "Kies een spel om te beginnen:",
    gameBasketball: "🏀 Basketbal 🏀",
    gameFootball:   "⚽️ Voetbal ⚽️",
    gameMaybay:     "✈️ Crash-spel",
    supportTitle:   "🆘 <b>KLANTENSERVICE</b> 🆘",
    supportBody:    "DRUK OP DE KNOPPEN HIERONDER VOOR ONDERSTEUNING!\n\n🕰 Beschikbaar 24/7 - Elke dag",
    supportBtnTelegram: "📱 Telegram-ondersteuning",
    helpFull:
      `📖 <b>HARU88 BOT GEBRUIKERSGIDS</b>\n\n` +
      `💰 <b>STORTING</b>\n` +
      `• /nap — Stortingsmenu openen\n` +
      `• Storten via bankoverschrijving of kaart\n\n` +
      `💸 <b>OPNAME</b>\n` +
      `• /rutbank — Opnemen via gekoppelde bank\n` +
      `⚠️ Foutieve info trekt nog steeds af!\n\n` +
      `🎮 <b>SPELLEN</b>\n` +
      `• Tài Xỉu: typ <code>T [bedrag]</code> of <code>X [bedrag]</code>\n` +
      `• Loterij: /lode\n` +
      `• Min: 1.000₫ | Max: 1.000.000₫\n\n` +
      `🎁 <b>CADEAUCODE</b>\n` +
      `• /code [code] — Cadeaucode invoeren\n\n` +
      `🆘 <b>ONDERSTEUNING</b>\n` +
      `• /hotro — Contact opnemen`,
    startCaption:   "🎫 Uw ID: {id}\n\n👉 Sluit je aan bij Room TX voor jackpots en dagelijkse cadeaucodes https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Haru88 webaccount koppelen</b>",
    wlinkPrompt:    "Deel uw telefoonnummer om de koppeling te voltooien.\n📱 Druk op de knop <b>«Telefoonnummer verzenden»</b> hieronder.",
    wlinkBtn:       "📱 Telefoonnummer verzenden",
  },

  // ════════════════════════════════════════════════════════════════
  pl: {
    menuProfile:    "👤 Profil",
    menuGames:      "🎮 Gry",
    menuReferral:   "🎁 Polecenie",
    menuRanking:    "🏆 Ranking",
    menuEvents:     "🎊 Wydarzenia",
    menuCommission: "💰 Prowizja",
    menuSupport:    "🆘 Wsparcie",
    menuLanguage:   "🌐 Język",
    menuPrompt:     "✨ Wybierz funkcję poniżej, aby zacząć.",
    langTitle:      "🌐 <b>Wybierz język / Select language</b>",
    langChanged:    "✅ Język zmieniony na",
    langCurrent:    "Obecny język",
    errGeneral:     "❌ Wystąpił błąd. Spróbuj ponownie!",
    errUserNotFound:"❌ Konto nie znalezione.",
    errInsufficient:"❌ Niewystarczające saldo!",
    loading:        "⏳ Przetwarzanie...",
    balance:        "💎 Saldo",
    remainingBalance:"💎 Pozostałe saldo",
    betAmount:      "💸 Kwota zakładu",
    winAmount:      "🏆 Kwota wygranej",
    totalLabel:     "💸 Razem",
    dateLabel:      "📅 Wynik XSMB dziś",
    luckyNext:      "💡 Powodzenia następnym razem! Nowe zakłady od 00:00.",
    lodeBetSuccess: "✅ ZAKŁAD {type} PRZYJĘTY!",
    lodeNumbers:    "🔢 Zakładane numery",
    lodeEach:       "🎯 Na numer",
    lodeIfWin:      "🏆 Przy wygranej",
    lodeSet:        "🔢 Zestaw numerów",
    lodePoints:     "pkt",
    lodeMinErr:     "❌ Minimalny zakład <b>{min}</b>!",
    lodeClosed:     "⏰ <b>Zakłady na dziś są zamknięte!</b>",
    lodeCloseDetail:"Wyniki XSMB już wyszły. Zakładaj jutro.\n💡 Wpisz <code>XSMB</code>.",
    lodeClosesSoon: "⏰ <b>Zakłady wkrótce się zamkną!</b>",
    lodeClosesSoonDetail: "Brak nowych zakładów po 18:25. Wpisz <code>XSMB</code>.",
    lodeViewPending:"💡 Wpisz <code>CUOCLO</code> dla oczekujących zakładów.",
    lodeMyBetsTitle:"📋 <b>Zakłady Dzisiaj ({date})</b>",
    lodeMyBetsEmpty:"Nie masz dziś zakładów.",
    lodeMyBetsEmptyHint:"💡 Składnia:\n• <code>/lo 00 10d</code> — Lô (x80)\n• <code>/de 00 10d</code> — Đề (x90)\n• <code>/xienhai 00,01 10d</code> — Xiên 2 (x15)\n• <code>/xienba 00,01,02 10d</code> — Xiên 3 (x40)\n• <code>/xienbon 00,01,02,03 10d</code> — Xiên 4 (x100)",
    lodeMyBetsMin:  "📌 Minimum 2.000₫/zamówienie",
    lodeTotalBet:   "💸 Łączny zakład",
    lodePending:    "⏰ Wyniki aktualizują się automatycznie po 18:30!",
    lodeResultsTitle:"🎰 <b>TWOJE WYNIKI - {date}</b>",
    lodeWonLabel:   "🏆 <b>WYGRANA:</b>",
    lodeLostLabel:  "😢 <b>Przegrana:</b>",
    lodeTotalWon:   "💎 Łączna nagroda:",
    depositTitle:   "💳 WPŁATA",
    depositSuccess: "✅ Wpłata udana!",
    depositPending: "⏳ Przetwarzanie wpłaty...",
    depositPrompt:  "Wybierz metodę wpłaty:",
    depositBank:    "🏦 Przelew Bankowy",
    depositCard:    "🎫 Karta Przedpłacona",
    withdrawTitle:  "🏦 Wypłata",
    withdrawSuccess:"✅ Wypłata udana!",
    withdrawPending:"⏳ Przetwarzanie wypłaty...",
    profileTitle:   "👤 <b>PROFIL HARU88:</b>",
    profileName:    "Imię",
    profileVault:   "Sejf",
    profileVaultNotSet: "nie skonfigurowany",
    profileGames:   "Rozegrane gry",
    profileCommission: "Prowizja",
    profileGiftcode: "Kod podarunkowy",
    profileGiftcodeUsed: "✅ Użyty",
    profileGiftcodeNotUsed: "❌ Nie użyty",
    profileAttendance: "Obecność",
    profileDays:    "dni",
    profilePrompt:  "✨ Wybierz funkcję poniżej, aby kontynuować ✨",
    btnDeposit:     "🏦 Wpłać",
    btnWithdraw:    "🏦 Wypłać",
    btnBuyGiftcode: "🎁 Kup kod",
    btnEnterGiftcode: "🎉 Wpisz kod",
    btnDepositHistory: "📜 Historia wpłat",
    btnWithdrawHistory: "📜 Historia wypłat",
    btnRedEnvelope: "🧧 Czerwona koperta",
    btnBetHistory:  "📊 Historia zakładów",
    btnVipLevel:    "👑 POZIOM VIP",
    btnTransfer:    "💸 Przelew",
    btnVault:       "🔐 Sejf",
    btnBack:        "↩️ Wróć",
    gameMenuTitle:  "🎮 <b>STREFA GIER</b>",
    gameMenuPrompt: "Wybierz grę, aby zacząć:",
    gameBasketball: "🏀 Koszykówka 🏀",
    gameFootball:   "⚽️ Piłka nożna ⚽️",
    gameMaybay:     "✈️ Gra Crash",
    supportTitle:   "🆘 <b>OBSŁUGA KLIENTA</b> 🆘",
    supportBody:    "NACIŚNIJ PRZYCISKI PONIŻEJ, ABY UZYSKAĆ WSPARCIE!\n\n🕰 Dostępne 24/7 - Każdego dnia",
    supportBtnTelegram: "📱 Wsparcie Telegram",
    helpFull:
      `📖 <b>PRZEWODNIK BOTA HARU88</b>\n\n` +
      `💰 <b>WPŁATA</b>\n` +
      `• /nap — Otwórz menu wpłat\n` +
      `• Wpłać przelewem bankowym lub kartą\n\n` +
      `💸 <b>WYPŁATA</b>\n` +
      `• /rutbank — Wypłać na powiązane konto\n` +
      `⚠️ Błędne dane nadal potrącają saldo!\n\n` +
      `🎮 <b>GRY</b>\n` +
      `• Tài Xỉu: wpisz <code>T [kwota]</code> lub <code>X [kwota]</code>\n` +
      `• Loteria: /lode\n` +
      `• Min: 1.000₫ | Maks: 1.000.000₫\n\n` +
      `🎁 <b>KOD PODARUNKOWY</b>\n` +
      `• /code [kod] — Wpisz kod\n\n` +
      `🆘 <b>WSPARCIE</b>\n` +
      `• /hotro — Skontaktuj się ze wsparciem`,
    startCaption:   "🎫 Twoje ID: {id}\n\n👉 Dołącz do Room TX po jackpoty i codzienne kody podarunkowe https://t.me/TXCLHARU88",
    wlinkTitle:     "🔗 <b>Połącz konto web Haru88</b>",
    wlinkPrompt:    "Aby zakończyć łączenie, udostępnij swój numer telefonu.\n📱 Naciśnij przycisk <b>«Wyślij numer telefonu»</b> poniżej.",
    wlinkBtn:       "📱 Wyślij numer telefonu",
  },

};

/** Lấy translation — merge với English defaults để không bao giờ thiếu field */
export function tr(lang: string): Translations {
  const en = t["en"]!;
  const specific = t[lang];
  if (!specific || specific === en) return en;
  return { ...en, ...specific };
}

/** Tên hiển thị đầy đủ của một ngôn ngữ, kèm flag */
export function langLabel(lang: string): string {
  const meta = SUPPORTED_LANGUAGES[lang];
  if (!meta) return lang.toUpperCase();
  return `${meta.flag} ${meta.nativeName}`;
}

/** Keyboard chọn ngôn ngữ — 2 cột */
export function buildLangKeyboard(currentLang: string) {
  const langs = Object.entries(SUPPORTED_LANGUAGES);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (let i = 0; i < langs.length; i += 2) {
    const row: Array<{ text: string; callback_data: string }> = [];
    const [code1, meta1] = langs[i]!;
    const check1 = code1 === currentLang ? " ✓" : "";
    row.push({ text: `${meta1.flag} ${meta1.nativeName}${check1}`, callback_data: `set_lang_${code1}` });

    if (i + 1 < langs.length) {
      const [code2, meta2] = langs[i + 1]!;
      const check2 = code2 === currentLang ? " ✓" : "";
      row.push({ text: `${meta2.flag} ${meta2.nativeName}${check2}`, callback_data: `set_lang_${code2}` });
    }
    rows.push(row);
  }

  rows.push([{ text: "↩️ Back / Quay lại", callback_data: "main_menu" }]);
  return { inline_keyboard: rows };
}
