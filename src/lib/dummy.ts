// 더미 데이터 — 데이터 계층(Supabase) 연결 전, 화면을 먼저 완성하기 위한 샘플.
// 실제 연동 단계에서 이 파일을 데이터 조회로 교체한다.
import type { Tone } from "@/lib/status";

export interface AssetRow {
  mgmtNo: string;
  itemName: string;
  category: string;
  status: string;
  statusTone: Tone;
  user: string | null;
  location: string;
  unitPrice: number;
  acquiredAt: string;
}

export const ASSETS: AssetRow[] = [
  { mgmtNo: "501-0012", itemName: "노트북 (Galaxy Book4 Pro)", category: "전산기기", status: "대여중", statusTone: "sky", user: "김도윤", location: "공학1호관 304", unitPrice: 1890000, acquiredAt: "2025-03-11" },
  { mgmtNo: "501-0013", itemName: "노트북 (LG gram 16)", category: "전산기기", status: "보관중", statusTone: "mint", user: null, location: "사업단 사무실", unitPrice: 1750000, acquiredAt: "2025-03-11" },
  { mgmtNo: "502-0007", itemName: "4K 모니터 27\"", category: "전산기기", status: "사용중", statusTone: "purple", user: "이서연", location: "공학1호관 305", unitPrice: 420000, acquiredAt: "2025-02-20" },
  { mgmtNo: "503-0021", itemName: "레이저 복합기", category: "사무기기", status: "점검필요", statusTone: "apricot", user: null, location: "사업단 사무실", unitPrice: 680000, acquiredAt: "2024-11-05" },
  { mgmtNo: "504-0003", itemName: "전동 스크린", category: "영상장비", status: "정상", statusTone: "mint", user: null, location: "세미나실 A", unitPrice: 540000, acquiredAt: "2024-09-18" },
  { mgmtNo: "501-0014", itemName: "노트북 (MacBook Air M3)", category: "전산기기", status: "수리중", statusTone: "coral", user: "박준호", location: "외부 수리센터", unitPrice: 1690000, acquiredAt: "2025-01-09" },
  { mgmtNo: "505-0009", itemName: "회의용 웹캠 4K", category: "영상장비", status: "보관중", statusTone: "mint", user: null, location: "사업단 사무실", unitPrice: 230000, acquiredAt: "2025-04-02" },
  { mgmtNo: "502-0008", itemName: "듀얼 모니터암", category: "사무기기", status: "사용중", statusTone: "purple", user: "최민지", location: "공학1호관 304", unitPrice: 150000, acquiredAt: "2025-02-20" },
  { mgmtNo: "506-0001", itemName: "휴대용 빔프로젝터", category: "영상장비", status: "대여중", statusTone: "sky", user: "정우성", location: "산학협력단", unitPrice: 890000, acquiredAt: "2024-12-13" },
  { mgmtNo: "503-0022", itemName: "문서 세단기", category: "사무기기", status: "정상", statusTone: "mint", user: null, location: "사업단 사무실", unitPrice: 320000, acquiredAt: "2025-03-28" },
  { mgmtNo: "501-0015", itemName: "노트북 (Galaxy Book4)", category: "전산기기", status: "분실", statusTone: "coral", user: "한지민", location: "미확인", unitPrice: 1290000, acquiredAt: "2024-10-30" },
  { mgmtNo: "507-0004", itemName: "RFID 리더기", category: "전산기기", status: "정상", statusTone: "mint", user: null, location: "사업단 사무실", unitPrice: 180000, acquiredAt: "2025-05-07" },
];

export interface LoanRow {
  mgmtNo: string;
  itemName: string;
  borrower: string;
  affiliation: string;
  loanedAt: string;
  dueAt: string;
  overdue: boolean;
}

export const LOANS: LoanRow[] = [
  { mgmtNo: "501-0012", itemName: "Galaxy Book4 Pro", borrower: "김도윤", affiliation: "데이터보안학과", loanedAt: "2025-09-20", dueAt: "2025-10-20", overdue: false },
  { mgmtNo: "506-0001", itemName: "휴대용 빔프로젝터", borrower: "정우성", affiliation: "산학협력단", loanedAt: "2025-09-30", dueAt: "2025-10-14", overdue: true },
  { mgmtNo: "501-0016", itemName: "LG gram 15", borrower: "오하늘", affiliation: "융합혁신대학", loanedAt: "2025-10-06", dueAt: "2025-10-27", overdue: false },
];

export interface ConsumableRow {
  itemName: string;
  spec: string;
  qty: number;
  safetyQty: number;
  unit: string;
  status: string;
  statusTone: Tone;
}

export const CONSUMABLES: ConsumableRow[] = [
  { itemName: "A4 복사용지", spec: "80g 2500매", qty: 42, safetyQty: 20, unit: "박스", status: "정상", statusTone: "mint" },
  { itemName: "토너 (흑백)", spec: "CF259X", qty: 3, safetyQty: 4, unit: "개", status: "부족", statusTone: "apricot" },
  { itemName: "건전지 AA", spec: "알카라인", qty: 0, safetyQty: 10, unit: "팩", status: "소진", statusTone: "coral" },
  { itemName: "네임택 스티커", spec: "라벨지 A4", qty: 18, safetyQty: 8, unit: "팩", status: "정상", statusTone: "mint" },
];

export interface PromoRow {
  code: string;
  name: string;
  qty: number;
  safetyQty: number;
  unit: string;
  status: string;
  statusTone: Tone;
}

export const PROMO: PromoRow[] = [
  { code: "P", name: "곰두리 스마트톡", qty: 804, safetyQty: 200, unit: "개", status: "정상", statusTone: "mint" },
  { code: "Q", name: "백령잣 선물세트", qty: 60, safetyQty: 80, unit: "세트", status: "재고 주의", statusTone: "apricot" },
  { code: "R", name: "세라믹 고블렛잔", qty: 0, safetyQty: 50, unit: "개", status: "품절", statusTone: "coral" },
  { code: "U", name: "위글위글 보냉백", qty: 290, safetyQty: 100, unit: "개", status: "정상", statusTone: "mint" },
];

export interface MonthlyPoint {
  month: string;
  amount: number; // 취득 금액(만원)
}

export const MONTHLY: MonthlyPoint[] = [
  { month: "5월", amount: 180 },
  { month: "6월", amount: 240 },
  { month: "7월", amount: 95 },
  { month: "8월", amount: 310 },
  { month: "9월", amount: 265 },
  { month: "10월", amount: 420 },
];

export function won(n: number): string {
  return "₩" + n.toLocaleString("ko-KR");
}
