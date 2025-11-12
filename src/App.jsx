import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Plus, Trash2, ChevronRight, ChevronLeft, Info, RefreshCw, Wallet, DollarSign, PieChart } from 'lucide-react';

// --- 2024년 귀속 기본 세율표 (2025년 신고용) ---
const TAX_BRACKETS = [
  { limit: 14000000, rate: 0.06, deduction: 0 },
  { limit: 50000000, rate: 0.15, deduction: 1260000 },
  { limit: 88000000, rate: 0.24, deduction: 5760000 },
  { limit: 150000000, rate: 0.35, deduction: 15440000 },
  { limit: 300000000, rate: 0.38, deduction: 19940000 },
  { limit: 500000000, rate: 0.40, deduction: 25940000 },
  { limit: 1000000000, rate: 0.42, deduction: 35940000 },
  { limit: Infinity, rate: 0.45, deduction: 65940000 },
];

// 근로소득공제 계산 함수
const calculateEarnedIncomeDeduction = (salary) => {
  if (salary <= 5000000) return salary * 0.7;
  if (salary <= 15000000) return 3500000 + (salary - 5000000) * 0.4;
  if (salary <= 45000000) return 7500000 + (salary - 15000000) * 0.15;
  if (salary <= 100000000) return 12000000 + (salary - 45000000) * 0.05;
  return Math.min(20000000, 14750000 + (salary - 100000000) * 0.02);
};

// 종합소득세 산출세액 계산 함수
const calculateBasicTax = (taxBase) => {
  if (taxBase <= 0) return 0;
  const bracket = TAX_BRACKETS.find((b) => taxBase <= b.limit);
  return Math.floor(taxBase * bracket.rate - bracket.deduction);
};

const App = () => {
  const [step, setStep] = useState(1);
  
  // --- State: 소득 ---
  const [incomes, setIncomes] = useState({
    wage: { active: false, gross: 0, withheld: 0 }, // 근로소득
    business: { active: false, revenue: 0, expense: 0, withheld: 0 }, // 사업소득
    financial: { active: false, interest: 0, dividend: 0, withheld: 0 }, // 금융소득
    other: { active: false, gross: 0, expense: 0, withheld: 0 }, // 기타소득
    pension: { active: false, gross: 0, withheld: 0 }, // 연금소득
  });

  // --- State: 공제 및 감면 ---
  const [deductions, setDeductions] = useState({
    familyCount: 1, // 본인 포함 부양가족 수
    pensionPremium: 0, // 국민연금 등 보험료
    creditCard: 0, // 신용카드 등 소득공제
    otherDeductions: 0, // 기타 소득공제 합계
    taxCredits: 0, // 세액공제 합계 (자녀, 연금계좌 등)
  });

  // --- 계산 로직 (Memoized) ---
  const result = useMemo(() => {
    let globalIncome = 0; // 종합과세 대상 소득금액
    let separatedTax = 0; // 분리과세 세액
    let totalWithheld = 0; // 기납부세액 합계
    let report = []; // 결과 리포트용 텍스트

    // 1. 근로소득 처리
    if (incomes.wage.active) {
      const deduction = calculateEarnedIncomeDeduction(incomes.wage.gross);
      const incomeAmount = incomes.wage.gross - deduction;
      globalIncome += incomeAmount;
      totalWithheld += incomes.wage.withheld;
      report.push({ type: '근로소득', gross: incomes.wage.gross, deduction: deduction, amount: incomeAmount, note: '근로소득공제 적용됨' });
    }

    // 2. 사업소득 처리
    if (incomes.business.active) {
      const incomeAmount = incomes.business.revenue - incomes.business.expense;
      globalIncome += incomeAmount;
      totalWithheld += incomes.business.withheld;
      report.push({ type: '사업소득', gross: incomes.business.revenue, deduction: incomes.business.expense, amount: incomeAmount, note: '수입 - 필요경비' });
    }

    // 3. 금융소득 처리 (2,000만원 분리과세 기준)
    if (incomes.financial.active) {
      const totalFinancial = incomes.financial.interest + incomes.financial.dividend;
      totalWithheld += incomes.financial.withheld;
      
      if (totalFinancial <= 20000000) {
        // 분리과세
        separatedTax += totalFinancial * 0.14; // 지방세 제외 14%
        report.push({ type: '금융소득(분리)', gross: totalFinancial, deduction: 0, amount: 0, note: '2천만원 이하 분리과세 종결 (14%)' });
      } else {
        // 종합과세 (단순화를 위해 2천만원 초과분 전액 합산으로 처리하되, 실제로는 비교과세가 적용됨)
        // 여기서는 계산기 목적상 전액 합산으로 처리합니다.
        globalIncome += totalFinancial;
        report.push({ type: '금융소득(종합)', gross: totalFinancial, deduction: 0, amount: totalFinancial, note: '2천만원 초과로 종합과세 합산' });
      }
    }

    // 4. 기타소득 처리 (300만원 기준 선택적 분리과세)
    if (incomes.other.active) {
      const incomeAmount = incomes.other.gross - incomes.other.expense;
      totalWithheld += incomes.other.withheld;

      if (incomeAmount <= 3000000) {
        // 300만원 이하는 분리과세가 유리한 경우가 많음 (기본값 분리과세 적용)
        separatedTax += (incomes.other.gross - incomes.other.expense) * 0.20; // 기타소득 세율 20%
        report.push({ type: '기타소득(분리)', gross: incomes.other.gross, deduction: incomes.other.expense, amount: 0, note: '소득금액 300만원 이하 분리과세 선택' });
      } else {
        globalIncome += incomeAmount;
        report.push({ type: '기타소득(종합)', gross: incomes.other.gross, deduction: incomes.other.expense, amount: incomeAmount, note: '종합과세 합산' });
      }
    }

    // 5. 연금소득 (간략화: 공적연금 전액 합산 가정)
    if (incomes.pension.active) {
        // 연금소득공제는 복잡하여 여기서는 생략하고 전액 합산으로 가정 (실제로는 연금소득공제 있음)
        // 편의상 소득금액 그대로 합산
        globalIncome += incomes.pension.gross; 
        totalWithheld += incomes.pension.withheld;
        report.push({ type: '연금소득', gross: incomes.pension.gross, deduction: 0, amount: incomes.pension.gross, note: '공적연금 전액 합산(간이)' });
    }

    // --- 과세표준 계산 ---
    const basicDeduction = deductions.familyCount * 1500000; // 인적공제
    const totalDeduction = basicDeduction + deductions.pensionPremium + deductions.creditCard + deductions.otherDeductions;
    
    const taxBase = Math.max(0, globalIncome - totalDeduction);
    
    // --- 산출세액 ---
    const calculatedTax = calculateBasicTax(taxBase);
    
    // --- 결정세액 ---
    // 표준세액공제 자동적용 (특별소득공제 등이 없으면 7만원, 근로소득자 기준 13만원 등이나 여기선 단순화)
    let finalTaxCredits = deductions.taxCredits;
    if (totalDeduction < 2000000 && finalTaxCredits === 0) finalTaxCredits = 70000;

    const determinedTax = Math.max(0, calculatedTax - finalTaxCredits);
    
    // --- 최종 납부/환급 세액 ---
    // 종합소득세 + 지방소득세(10%)
    const finalGlobalTax = determinedTax;
    const finalLocalTax = Math.floor(finalGlobalTax * 0.1);
    
    const finalSeparatedTax = separatedTax;
    const finalSeparatedLocalTax = Math.floor(separatedTax * 0.1);

    const totalTaxLiability = finalGlobalTax + finalLocalTax + finalSeparatedTax + finalSeparatedLocalTax;
    
    // 기납부세액에는 지방소득세가 포함되어 있다고 가정 (보통 원천징수 시 포함하므로)
    // 정확한 비교를 위해 기납부세액을 국세/지방세로 나누지 않고 통으로 비교
    const balance = totalTaxLiability - totalWithheld;

    return {
      globalIncome,
      report,
      taxBase,
      totalDeduction,
      calculatedTax,
      determinedTax,
      finalGlobalTax,
      finalLocalTax,
      separatedTax: finalSeparatedTax,
      separatedLocalTax: finalSeparatedLocalTax,
      totalTaxLiability,
      totalWithheld,
      balance,
      bracketRate: TAX_BRACKETS.find(b => taxBase <= b.limit)?.rate * 100
    };

  }, [incomes, deductions]);

  // --- UI Helpers ---
  const formatMoney = (val) => val.toLocaleString() + " 원";
  const handleIncomeChange = (type, field, value) => {
    setIncomes(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: Number(value) }
    }));
  };
  const toggleIncome = (type) => {
    setIncomes(prev => ({
      ...prev,
      [type]: { ...prev[type], active: !prev[type].active }
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calculator className="w-6 h-6" />
                종합소득세 계산기
              </h1>
              <p className="text-indigo-100 text-sm mt-1">2024년 귀속 소득 기준 (2025년 5월 신고용)</p>
            </div>
            <div className="hidden md:block bg-indigo-500 px-4 py-2 rounded-lg text-sm">
              예상 세액을 미리 확인해보세요
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex border-b border-gray-200">
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              onClick={() => setStep(num)}
              className={`flex-1 py-4 text-center font-medium text-sm transition-colors duration-200 
                ${step === num ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {num === 1 && "1. 소득 입력"}
              {num === 2 && "2. 공제 입력"}
              {num === 3 && "3. 결과 확인"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* STEP 1: 소득 입력 */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>해당되는 소득 종류를 체크하고, 1년간의 총 수입금액과 이미 납부한 세금(원천징수세액)을 입력해주세요.</p>
              </div>

              {/* 근로소득 */}
              <div className={`border rounded-xl p-4 transition-all ${incomes.wage.active ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleIncome('wage')}>
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${incomes.wage.active ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                      {incomes.wage.active && <span className="text-white text-xs">✓</span>}
                    </div>
                    <h3 className="font-bold text-lg">근로소득 (월급)</h3>
                  </div>
                  <span className="text-xs text-gray-400">직장인</span>
                </div>
                {incomes.wage.active && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">총 급여액 (세전 연봉)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.wage.gross} onChange={(e) => handleIncomeChange('wage', 'gross', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">기납부세액 (연말정산 등)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.wage.withheld} onChange={(e) => handleIncomeChange('wage', 'withheld', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

              {/* 사업소득 */}
              <div className={`border rounded-xl p-4 transition-all ${incomes.business.active ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleIncome('business')}>
                  <div className="flex items-center gap-3">
                     <div className={`w-5 h-5 rounded border flex items-center justify-center ${incomes.business.active ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                      {incomes.business.active && <span className="text-white text-xs">✓</span>}
                    </div>
                    <h3 className="font-bold text-lg">사업소득 (프리랜서/사업자)</h3>
                  </div>
                  <span className="text-xs text-gray-400">3.3% 프리랜서 등</span>
                </div>
                {incomes.business.active && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">총 수입금액 (매출)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.business.revenue} onChange={(e) => handleIncomeChange('business', 'revenue', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">필요경비 (단순경비율 등)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.business.expense} onChange={(e) => handleIncomeChange('business', 'expense', e.target.value)} placeholder="0" />
                    </div>
                     <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">원천징수세액 (3.3% 등)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.business.withheld} onChange={(e) => handleIncomeChange('business', 'withheld', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

               {/* 기타소득 */}
               <div className={`border rounded-xl p-4 transition-all ${incomes.other.active ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleIncome('other')}>
                  <div className="flex items-center gap-3">
                     <div className={`w-5 h-5 rounded border flex items-center justify-center ${incomes.other.active ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                      {incomes.other.active && <span className="text-white text-xs">✓</span>}
                    </div>
                    <h3 className="font-bold text-lg">기타소득</h3>
                  </div>
                  <span className="text-xs text-gray-400">강연료, 원고료 등</span>
                </div>
                {incomes.other.active && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">총 지급액</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.other.gross} onChange={(e) => handleIncomeChange('other', 'gross', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">필요경비 (60% 등)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.other.expense} onChange={(e) => handleIncomeChange('other', 'expense', e.target.value)} placeholder="0" />
                    </div>
                     <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">원천징수세액 (8.8% 등)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.other.withheld} onChange={(e) => handleIncomeChange('other', 'withheld', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

              {/* 금융소득 */}
               <div className={`border rounded-xl p-4 transition-all ${incomes.financial.active ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleIncome('financial')}>
                  <div className="flex items-center gap-3">
                     <div className={`w-5 h-5 rounded border flex items-center justify-center ${incomes.financial.active ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                      {incomes.financial.active && <span className="text-white text-xs">✓</span>}
                    </div>
                    <h3 className="font-bold text-lg">금융소득 (이자/배당)</h3>
                  </div>
                  <span className="text-xs text-gray-400">2천만원 초과시 종합과세</span>
                </div>
                {incomes.financial.active && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">이자 + 배당 합계액</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.financial.interest} onChange={(e) => handleIncomeChange('financial', 'interest', e.target.value)} placeholder="0" />
                    </div>
                     <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">원천징수세액 (15.4%)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={incomes.financial.withheld} onChange={(e) => handleIncomeChange('financial', 'withheld', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* STEP 2: 공제 입력 */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-green-50 p-4 rounded-lg text-sm text-green-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>소득공제 및 세액공제 항목을 입력하세요. 입력하지 않으면 표준세액공제 등이 적용될 수 있습니다.</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="border border-gray-200 rounded-xl p-5">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">1. 인적 공제 (본인 포함)</h3>
                  <div className="flex items-center gap-4">
                    <button 
                      className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-xl"
                      onClick={() => setDeductions(prev => ({...prev, familyCount: Math.max(1, prev.familyCount - 1)}))}
                    >-</button>
                    <span className="text-2xl font-bold w-12 text-center">{deductions.familyCount}</span>
                    <button 
                       className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-xl"
                       onClick={() => setDeductions(prev => ({...prev, familyCount: prev.familyCount + 1}))}
                    >+</button>
                    <span className="text-gray-500 text-sm ml-2">명 x 150만원 = <span className="text-indigo-600 font-bold">{formatMoney(deductions.familyCount * 1500000)}</span> 공제</span>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-lg text-gray-800">2. 소득 공제 항목</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">국민연금 보험료 (본인부담금)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                         value={deductions.pensionPremium} onChange={(e) => setDeductions(prev => ({...prev, pensionPremium: Number(e.target.value)}))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">신용카드 등 사용금액 공제액</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                         value={deductions.creditCard} onChange={(e) => setDeductions(prev => ({...prev, creditCard: Number(e.target.value)}))} placeholder="계산된 공제액 입력" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">기타 소득공제 (주택청약, 소기업소상공인 등)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                         value={deductions.otherDeductions} onChange={(e) => setDeductions(prev => ({...prev, otherDeductions: Number(e.target.value)}))} />
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                   <h3 className="font-bold text-lg text-gray-800">3. 세액 공제 항목</h3>
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">세액공제 합계 (자녀, 연금계좌, 보험료, 의료비, 교육비, 월세 등)</label>
                      <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                         value={deductions.taxCredits} onChange={(e) => setDeductions(prev => ({...prev, taxCredits: Number(e.target.value)}))} placeholder="최종 산출된 세액공제 금액 입력" />
                    </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 결과 확인 */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <p className="text-xs text-indigo-500 font-bold uppercase mb-1">종합소득금액</p>
                  <p className="text-2xl font-bold text-indigo-900">{formatMoney(result.globalIncome)}</p>
                </div>
                <div className="bg-pink-50 p-4 rounded-xl border border-pink-100">
                  <p className="text-xs text-pink-500 font-bold uppercase mb-1">적용 세율</p>
                  <p className="text-2xl font-bold text-pink-900">{result.bracketRate}% <span className="text-sm font-normal text-pink-700">구간</span></p>
                </div>
                <div className={`p-4 rounded-xl border text-white ${result.balance > 0 ? 'bg-red-500 border-red-600' : 'bg-blue-500 border-blue-600'}`}>
                  <p className="text-xs font-bold uppercase mb-1 opacity-80">최종 납부/환급 세액 (예상)</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    {result.balance > 0 ? <Plus className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                    {formatMoney(Math.abs(result.balance))}
                  </p>
                  <p className="text-xs opacity-80 text-right">{result.balance > 0 ? '추가 납부 필요' : '환급 예상'}</p>
                </div>
              </div>

              {/* Calculation Detail Waterfall */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-gray-100 p-3 border-b font-bold text-gray-700 flex justify-between items-center">
                  <span>계산 상세 내역</span>
                  <PieChart className="w-4 h-4" />
                </div>
                <div className="p-4 space-y-3 text-sm">
                  
                  {/* 1. 소득 구성 */}
                  <div className="pb-3 border-b border-dashed">
                    <p className="font-bold text-gray-600 mb-2">1. 소득 구성</p>
                    {result.report.length === 0 ? <p className="text-gray-400 italic">입력된 소득 없음</p> : 
                      result.report.map((item, idx) => (
                        <div key={idx} className="flex justify-between py-1">
                          <span>{item.type} <span className="text-xs text-gray-400">({item.note})</span></span>
                          <span className="font-medium">{formatMoney(item.amount)}</span>
                        </div>
                      ))
                    }
                     <div className="flex justify-between py-1 mt-2 bg-gray-50 p-2 rounded">
                        <span className="font-bold">종합소득금액 합계</span>
                        <span className="font-bold text-indigo-600">{formatMoney(result.globalIncome)}</span>
                      </div>
                  </div>

                  {/* 2. 과세표준 */}
                  <div className="pb-3 border-b border-dashed">
                     <div className="flex justify-between py-1 text-gray-500">
                        <span>(-) 소득공제 합계</span>
                        <span>{formatMoney(result.totalDeduction)}</span>
                      </div>
                      <div className="flex justify-between py-1 mt-1 bg-gray-50 p-2 rounded">
                        <span className="font-bold">과세표준</span>
                        <span className="font-bold text-indigo-600">{formatMoney(result.taxBase)}</span>
                      </div>
                  </div>

                   {/* 3. 산출세액 */}
                   <div className="pb-3 border-b border-dashed">
                     <div className="flex justify-between py-1 text-gray-500">
                        <span>기본 세율 산출 세액</span>
                        <span>{formatMoney(result.calculatedTax)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-gray-500">
                        <span>(-) 세액공제 합계</span>
                        <span>{formatMoney(deductions.taxCredits || (result.totalDeduction < 2000000 ? 70000 : 0))}</span>
                      </div>
                      <div className="flex justify-between py-1 mt-1 bg-gray-50 p-2 rounded">
                        <span className="font-bold">결정 세액 (국세)</span>
                        <span className="font-bold text-indigo-600">{formatMoney(result.determinedTax)}</span>
                      </div>
                  </div>

                  {/* 4. 최종 합계 */}
                   <div>
                     <div className="flex justify-between py-1 text-gray-500">
                        <span>(+) 지방소득세 (국세의 10%)</span>
                        <span>{formatMoney(result.finalLocalTax)}</span>
                      </div>
                      {result.separatedTax > 0 && (
                        <div className="flex justify-between py-1 text-gray-500">
                          <span>(+) 분리과세 세액 (지방세 포함)</span>
                          <span>{formatMoney(result.separatedTax + result.separatedLocalTax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 text-gray-500">
                        <span>(-) 기납부세액 합계</span>
                        <span className="text-red-500">-{formatMoney(result.totalWithheld)}</span>
                      </div>
                  </div>

                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-xs text-yellow-800">
                <p className="font-bold mb-1">⚠️ 주의사항</p>
                본 계산기는 단순 모의 계산용이며, 복잡한 세법(이월결손금, 각종 감면, 중과세 등)을 모두 반영하지 않습니다. 
                정확한 세액은 국세청 홈택스 또는 세무 전문가를 통해 확인하시기 바랍니다.
              </div>

            </div>
          )}

        </div>

        {/* Footer Nav */}
        <div className="bg-gray-50 p-4 border-t flex justify-between items-center">
          <button
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors
              ${step === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            <ChevronLeft className="w-4 h-4" /> 이전
          </button>
          
          {step < 3 ? (
            <button
              onClick={() => setStep(prev => Math.min(3, prev + 1))}
              className="flex items-center gap-1 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-md"
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 px-6 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors shadow-md"
            >
              <RefreshCw className="w-4 h-4" /> 다시 계산하기
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default App;