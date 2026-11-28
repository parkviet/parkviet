import sharedEn from '@shared/locales/en.json'
import sharedVi from '@shared/locales/vi.json'
import { ADMIN_LOCALE_STORAGE_KEY, i18n } from '@spree/dashboard-core'
import counterEn from './counter/locales/en.json'
import counterVi from './counter/locales/vi.json'
import en from './locales/en.json'
import vi from './locales/vi.json'

const shell = {
  en: {
    posDashboard: {
      title: 'POS administration',
      signIn: 'Sign in',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot password?',
      resetPassword: 'Send reset instructions',
      resetSent: 'If this account exists, password reset instructions have been sent.',
      backToLogin: 'Back to sign in',
      noStore: 'You do not have access to a store.',
      signOut: 'Sign out',
      settings: 'Settings',
      overview: 'Overview',
      forbidden: 'You do not have permission to view this page.',
      notFound: 'Page not found',
      error: 'Something went wrong. Please try again.',
      branch: 'Branch',
      noBranches: 'No available branches',
      openCounter: 'POS',
      welcomeBack: 'Welcome back',
      signInHint: 'Sign in with your administrator account to manage your stores.',
      loginFailed: 'Incorrect email or password. Please try again.',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      loginHeadline: 'Run every branch from one place',
      loginIntro: 'Set up the counters, keep the books straight and see how each branch is doing.',
      loginSecurity: 'Each account only sees the branches and screens it is allowed to.',
      forgotPasswordTitle: 'Reset your password',
      forgotPasswordIntro:
        'Enter your account email and we will send you a link to set a new password.',
      noAccountYet: 'No store yet?',
      createAccountLink: 'Create a store',
      registerTitle: 'Create your store',
      registerIntro: 'Set up an administrator account and open your store right away.',
      storeName: 'Store name',
      storeNamePlaceholder: 'e.g. Saigon Coffee',
      fullName: 'Full name',
      fullNamePlaceholder: 'e.g. Nguyen Van An',
      passwordHint: 'At least 6 characters',
      registerSubmit: 'Create store & get started',
      alreadyHaveAccount: 'Already have an account?',
      registerDisabled: 'Public registration is currently disabled on this server.',
      registerEmailTaken: 'An account with this email already exists.',
      registerPasswordTooShort: 'Password must be at least 6 characters.',
      registerRateLimited: 'Too many attempts. Please wait a few minutes and try again.',
      registerFailed: 'Could not create your store. Please check the information and try again.',
      loginTasks: {
        branches: {
          title: 'Branches & registers',
          body: 'Open branches, set up registers, printers, scales and business modules.',
        },
        catalog: {
          title: 'Menu & products',
          body: 'Choose each branch’s assortment, prices, units and print templates.',
        },
        staff: {
          title: 'Staff & roles',
          body: 'Add staff, assign roles and limit what each can do.',
        },
        sales: {
          title: 'Orders & deliveries',
          body: 'Follow orders, deliveries and electronic invoices.',
        },
        money: {
          title: 'Funds & shifts',
          body: 'Reconcile cash funds, close shifts and settle receivables.',
        },
        reports: {
          title: 'Reports & inventory',
          body: 'Track revenue, stock and traceability per branch.',
        },
      },
    },
  },
  vi: {
    posDashboard: {
      title: 'Quản trị POS',
      signIn: 'Đăng nhập',
      email: 'Email',
      password: 'Mật khẩu',
      forgotPassword: 'Quên mật khẩu?',
      resetPassword: 'Gửi hướng dẫn đặt lại mật khẩu',
      resetSent: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.',
      backToLogin: 'Quay lại đăng nhập',
      noStore: 'Bạn chưa được cấp quyền truy cập cửa hàng.',
      signOut: 'Đăng xuất',
      settings: 'Cài đặt',
      overview: 'Tổng quan',
      forbidden: 'Bạn không có quyền xem trang này.',
      notFound: 'Không tìm thấy trang',
      error: 'Đã xảy ra lỗi. Vui lòng thử lại.',
      branch: 'Chi nhánh',
      noBranches: 'Chưa có chi nhánh',
      openCounter: 'POS',
      welcomeBack: 'Chào mừng trở lại',
      signInHint: 'Đăng nhập bằng tài khoản quản trị để quản lý cửa hàng của bạn.',
      loginFailed: 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
      showPassword: 'Hiện mật khẩu',
      hidePassword: 'Ẩn mật khẩu',
      loginHeadline: 'Vận hành mọi chi nhánh từ một nơi',
      loginIntro: 'Thiết lập quầy bán, giữ sổ sách minh bạch và theo dõi tình hình từng chi nhánh.',
      loginSecurity: 'Mỗi tài khoản chỉ thấy chi nhánh và màn hình được cấp quyền.',
      forgotPasswordTitle: 'Đặt lại mật khẩu',
      forgotPasswordIntro: 'Nhập email tài khoản, chúng tôi sẽ gửi đường dẫn để đặt mật khẩu mới.',
      noAccountYet: 'Chưa có cửa hàng?',
      createAccountLink: 'Đăng ký mở cửa hàng',
      registerTitle: 'Đăng ký mở cửa hàng',
      registerIntro: 'Tạo tài khoản quản trị và khởi tạo cửa hàng riêng để bắt đầu ngay.',
      storeName: 'Tên cửa hàng',
      storeNamePlaceholder: 'VD: Cà phê Sài Gòn',
      fullName: 'Họ và tên',
      fullNamePlaceholder: 'VD: Nguyễn Văn An',
      passwordHint: 'Tối thiểu 6 ký tự',
      registerSubmit: 'Tạo cửa hàng & bắt đầu',
      alreadyHaveAccount: 'Đã có tài khoản?',
      registerDisabled: 'Tính năng tự đăng ký hiện đang tắt trên máy chủ này.',
      registerEmailTaken: 'Email này đã được sử dụng cho một tài khoản khác.',
      registerPasswordTooShort: 'Mật khẩu cần tối thiểu 6 ký tự.',
      registerRateLimited: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
      registerFailed: 'Không thể tạo cửa hàng. Vui lòng kiểm tra lại thông tin và thử lại.',
      loginTasks: {
        branches: {
          title: 'Chi nhánh & quầy',
          body: 'Mở chi nhánh, thiết lập quầy thu ngân, máy in, cân và mô hình kinh doanh.',
        },
        catalog: {
          title: 'Thực đơn & sản phẩm',
          body: 'Chọn hàng bán, giá, đơn vị tính và mẫu in cho từng chi nhánh.',
        },
        staff: {
          title: 'Nhân viên & phân quyền',
          body: 'Thêm nhân viên, gán vai trò và giới hạn quyền thao tác.',
        },
        sales: {
          title: 'Đơn hàng & giao hàng',
          body: 'Theo dõi đơn hàng, giao hàng và hoá đơn điện tử.',
        },
        money: {
          title: 'Quỹ tiền & ca làm',
          body: 'Đối soát quỹ tiền mặt, chốt ca và thu hồi công nợ.',
        },
        reports: {
          title: 'Báo cáo & tồn kho',
          body: 'Theo dõi doanh thu, tồn kho và truy xuất nguồn gốc theo chi nhánh.',
        },
      },
    },
  },
}
const shared = { en: sharedEn, vi: sharedVi }
const counter = { en: counterEn, vi: counterVi }
// Shared POS logic, counter UI, and administration texts join in both
// namespaces; deep merge keeps sections filled by more than one bundle.
for (const [code, bundle] of Object.entries({ en, vi })) {
  const lang = code as 'en' | 'vi'
  for (const ns of ['translation', 'pos']) {
    i18n.addResourceBundle(code, ns, shared[lang], true, true)
    i18n.addResourceBundle(code, ns, counter[lang], true, true)
    i18n.addResourceBundle(code, ns, bundle, true, true)
  }
  i18n.addResourceBundle(code, 'translation', shell[lang], true, true)
}

try {
  if (typeof localStorage !== 'undefined' && !localStorage.getItem(ADMIN_LOCALE_STORAGE_KEY)) {
    localStorage.setItem(ADMIN_LOCALE_STORAGE_KEY, 'vi')
  }
} catch {
  // Ignore storage restrictions.
}
if (i18n.language !== 'vi') {
  void i18n.changeLanguage('vi')
}

export { i18n }
export default i18n
