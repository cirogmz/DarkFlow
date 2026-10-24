'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Building2, 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Download, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  CreditCard, 
  Calculator, 
  ShieldCheck, 
  FileSpreadsheet, 
  Briefcase, 
  Calendar, 
  User, 
  Edit, 
  Trash2, 
  RefreshCw, 
  ChevronRight, 
  Eye, 
  AlertCircle, 
  Sparkles,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

interface FranchiseContract {
  id: string;
  brandId: string;
  userId?: string | null;
  contractFolio: string;
  partnerType: 'FRANCHISEE' | 'INVESTOR' | 'JOINT_VENTURE';
  partnerName: string;
  partnerEmail?: string | null;
  partnerPhone?: string | null;
  partnerRfc?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  royaltyFeePct: number;
  marketingFeePct: number;
  techFeeMonthly: number;
  commissaryFeePct: number;
  calculationBasis: 'NET_SALES' | 'GROSS_SALES';
  equitySharePct: number;
  minimumMonthlyFee: number;
  startDate: string;
  endDate?: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'TERMINATED';
  notes?: string | null;
  _count?: { statements: number };
  statements?: Array<{
    id: string;
    statementFolio: string;
    periodMonth: number;
    periodYear: number;
    netSales: number;
    totalDue: number;
    investorShareAmount: number;
    status: string;
  }>;
}

interface RoyaltyStatement {
  id: string;
  brandId: string;
  contractId: string;
  statementFolio: string;
  periodMonth: number;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  ordersCount: number;
  grossSales: number;
  taxAmount: number;
  discountsAmount: number;
  netSales: number;
  royaltyFeeAmount: number;
  marketingFeeAmount: number;
  techFeeAmount: number;
  commissaryFeeAmount: number;
  totalDue: number;
  investorShareAmount: number;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'DISPUTED' | 'CANCELLED';
  issuedAt?: string | null;
  paidAt?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  contract: {
    contractFolio: string;
    partnerType: string;
    partnerName: string;
    royaltyFeePct: number;
    marketingFeePct: number;
    equitySharePct: number;
  };
}

interface ReportData {
  selectedYear: number;
  metrics: {
    totalGrossSales: number;
    totalNetSales: number;
    totalRoyaltyFee: number;
    totalMarketingFee: number;
    totalTechFee: number;
    totalCommissaryFee: number;
    totalInvestorDividends: number;
    totalDue: number;
    totalPaid: number;
    totalOutstanding: number;
    totalOrdersCount: number;
  };
  monthlyEvolution: Array<{
    month: number;
    monthName: string;
    grossSales: number;
    netSales: number;
    royalties: number;
    marketing: number;
    tech: number;
    investorDividends: number;
    ordersCount: number;
    totalDue: number;
  }>;
  partnerBreakdown: Array<{
    contractId: string;
    contractFolio: string;
    partnerName: string;
    partnerType: string;
    royaltyFeePct: number;
    equitySharePct: number;
    status: string;
    statementsCount: number;
    ordersCount: number;
    grossSales: number;
    netSales: number;
    totalDue: number;
    totalDividends: number;
    totalPaid: number;
    balanceDue: number;
  }>;
  pAndLSummary: {
    brandName: string;
    grossRevenue: number;
    discounts: number;
    taxes: number;
    netRevenue: number;
    estimatedCogs: number;
    foodCostPct: number;
    estimatedGrossProfit: number;
    royaltiesCollected: number;
    marketingFund: number;
    techFees: number;
    commissaryFees: number;
    investorDividendsDistributed: number;
    retainedOperatingProfit: number;
  };
}

export default function FranchisePage() {
  const { activeBrand, addNotification } = useAppStore();
  const [activeTab, setActiveTab] = useState<'STATEMENTS' | 'CONTRACTS' | 'REPORTS' | 'SIMULATOR'>('STATEMENTS');
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: string } | null>(null);

  // Contracts state
  const [contracts, setContracts] = useState<FranchiseContract[]>([]);
  const [contractFilterType, setContractFilterType] = useState<string>('ALL');
  const [contractFilterStatus, setContractFilterStatus] = useState<string>('ALL');
  const [contractSearch, setContractSearch] = useState<string>('');
  const [loadingContracts, setLoadingContracts] = useState<boolean>(true);

  // Statements state
  const [statements, setStatements] = useState<RoyaltyStatement[]>([]);
  const [statementFilterContract, setStatementFilterContract] = useState<string>('ALL');
  const [statementFilterStatus, setStatementFilterStatus] = useState<string>('ALL');
  const [statementFilterYear, setStatementFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [loadingStatements, setLoadingStatements] = useState<boolean>(true);

  // Reports state
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportYear, setReportYear] = useState<string>(String(new Date().getFullYear()));
  const [loadingReports, setLoadingReports] = useState<boolean>(true);

  // Modals state
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<FranchiseContract | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedStatementDetail, setSelectedStatementDetail] = useState<RoyaltyStatement | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [targetPayStatement, setTargetPayStatement] = useState<RoyaltyStatement | null>(null);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [targetDisputeStatement, setTargetDisputeStatement] = useState<RoyaltyStatement | null>(null);

  // Forms state
  const [contractForm, setContractForm] = useState({
    partnerType: 'FRANCHISEE',
    partnerName: '',
    partnerEmail: '',
    partnerPhone: '',
    partnerRfc: '',
    bankName: '',
    bankAccount: '',
    royaltyFeePct: 5.0,
    marketingFeePct: 2.0,
    techFeeMonthly: 1500.0,
    commissaryFeePct: 0.0,
    calculationBasis: 'NET_SALES',
    equitySharePct: 0.0,
    minimumMonthlyFee: 0.0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: '',
  });

  const [statementForm, setStatementForm] = useState({
    contractId: '',
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    notes: '',
  });

  const [payForm, setPayForm] = useState({
    paymentMethod: 'SPEI',
    paymentReference: '',
    notes: '',
  });

  const [disputeForm, setDisputeForm] = useState({
    notes: '',
  });

  // Simulator state
  const [simSales, setSimSales] = useState<number>(350000);
  const [simRoyaltyPct, setSimRoyaltyPct] = useState<number>(5.0);
  const [simMarketingPct, setSimMarketingPct] = useState<number>(2.0);
  const [simTechFee, setSimTechFee] = useState<number>(1500.0);
  const [simCommissaryPct, setSimCommissaryPct] = useState<number>(0.0);
  const [simEquityPct, setSimEquityPct] = useState<number>(12.0);

  // Fetch current user session
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setCurrentUser(data.user);
        }
      })
      .catch((err) => console.error('Error fetching session:', err));
  }, []);

  const isB2BPartner = currentUser?.role === 'FRANCHISEE' || currentUser?.role === 'INVESTOR';
  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BRAND_ADMIN';

  // Load contracts
  const fetchContracts = useCallback(async () => {
    setLoadingContracts(true);
    try {
      const params = new URLSearchParams();
      if (contractFilterType !== 'ALL') params.set('partnerType', contractFilterType);
      if (contractFilterStatus !== 'ALL') params.set('status', contractFilterStatus);
      const res = await fetch(`/api/franchise/contracts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch (err) {
      console.error('Error loading contracts:', err);
    } finally {
      setLoadingContracts(false);
    }
  }, [contractFilterType, contractFilterStatus]);

  // Load statements
  const fetchStatements = useCallback(async () => {
    setLoadingStatements(true);
    try {
      const params = new URLSearchParams();
      if (statementFilterContract !== 'ALL') params.set('contractId', statementFilterContract);
      if (statementFilterStatus !== 'ALL') params.set('status', statementFilterStatus);
      if (statementFilterYear !== 'ALL') params.set('year', statementFilterYear);
      const res = await fetch(`/api/franchise/statements?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStatements(data.statements || []);
      }
    } catch (err) {
      console.error('Error loading statements:', err);
    } finally {
      setLoadingStatements(false);
    }
  }, [statementFilterContract, statementFilterStatus, statementFilterYear]);

  // Load executive reports
  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`/api/franchise/reports?year=${reportYear}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, [reportYear]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Save Contract (Create / Update)
  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractForm.partnerName || !contractForm.startDate) {
      addNotification('Nombre del socio y fecha de inicio son obligatorios', 'error');
      return;
    }

    try {
      const url = editingContract 
        ? `/api/franchise/contracts/${editingContract.id}` 
        : '/api/franchise/contracts';
      const method = editingContract ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractForm),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(data.message || 'Contrato guardado exitosamente', 'success');
        setIsContractModalOpen(false);
        setEditingContract(null);
        fetchContracts();
        fetchReports();
      } else {
        addNotification(data.error || 'Error al guardar contrato', 'error');
      }
    } catch {
      addNotification('Error al conectar con el servidor', 'error');
    }
  };

  // Open Edit Contract
  const handleEditContract = (c: FranchiseContract) => {
    setEditingContract(c);
    setContractForm({
      partnerType: c.partnerType,
      partnerName: c.partnerName,
      partnerEmail: c.partnerEmail || '',
      partnerPhone: c.partnerPhone || '',
      partnerRfc: c.partnerRfc || '',
      bankName: c.bankName || '',
      bankAccount: c.bankAccount || '',
      royaltyFeePct: c.royaltyFeePct,
      marketingFeePct: c.marketingFeePct,
      techFeeMonthly: c.techFeeMonthly,
      commissaryFeePct: c.commissaryFeePct,
      calculationBasis: c.calculationBasis,
      equitySharePct: c.equitySharePct,
      minimumMonthlyFee: c.minimumMonthlyFee,
      startDate: c.startDate ? c.startDate.split('T')[0] : '',
      endDate: c.endDate ? c.endDate.split('T')[0] : '',
      notes: c.notes || '',
    });
    setIsContractModalOpen(true);
  };

  // Generate Statement
  const handleGenerateStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementForm.contractId) {
      addNotification('Selecciona un contrato para auditar', 'error');
      return;
    }

    try {
      const res = await fetch('/api/franchise/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statementForm),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(data.message || 'Estado de cuenta generado', 'success');
        setIsStatementModalOpen(false);
        fetchStatements();
        fetchReports();
      } else {
        addNotification(data.error || 'Error al generar estado de cuenta', 'error');
      }
    } catch {
      addNotification('Error al conectar con el servidor', 'error');
    }
  };

  // Mark Statement as Paid
  const handleMarkAsPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPayStatement) return;

    try {
      const res = await fetch(`/api/franchise/statements/${targetPayStatement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAID',
          paymentMethod: payForm.paymentMethod,
          paymentReference: payForm.paymentReference,
          notes: payForm.notes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(`Liquidación registrada: Folio ${targetPayStatement.statementFolio}`, 'success');
        setIsPayModalOpen(false);
        setTargetPayStatement(null);
        fetchStatements();
        fetchReports();
      } else {
        addNotification(data.error || 'Error al registrar pago', 'error');
      }
    } catch {
      addNotification('Error al procesar liquidación', 'error');
    }
  };

  // Mark Statement as Disputed
  const handleDisputeStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDisputeStatement) return;

    try {
      const res = await fetch(`/api/franchise/statements/${targetDisputeStatement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DISPUTED',
          notes: disputeForm.notes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(`Discrepancia reportada en folio ${targetDisputeStatement.statementFolio}`, 'warning');
        setIsDisputeModalOpen(false);
        setTargetDisputeStatement(null);
        fetchStatements();
        fetchReports();
      } else {
        addNotification(data.error || 'Error al registrar discrepancia', 'error');
      }
    } catch {
      addNotification('Error al conectar con el servidor', 'error');
    }
  };

  // Filtered contracts
  const filteredContracts = contracts.filter((c) => {
    const q = contractSearch.toLowerCase();
    return (
      c.partnerName.toLowerCase().includes(q) ||
      c.contractFolio.toLowerCase().includes(q) ||
      (c.partnerEmail && c.partnerEmail.toLowerCase().includes(q)) ||
      (c.partnerRfc && c.partnerRfc.toLowerCase().includes(q))
    );
  });

  // Calculate totals from statements
  const totalStatementsCount = statements.length;
  const totalCollected = statements
    .filter((s) => s.status === 'PAID')
    .reduce((acc, s) => acc + s.totalDue, 0);
  const totalOutstanding = statements
    .filter((s) => s.status === 'ISSUED' || s.status === 'DRAFT' || s.status === 'DISPUTED')
    .reduce((acc, s) => acc + s.totalDue, 0);
  const totalDividends = statements
    .reduce((acc, s) => acc + s.investorShareAmount, 0);

  // Simulator calculations
  const simRoyaltyAmount = (simSales * simRoyaltyPct) / 100;
  const simMarketingAmount = (simSales * simMarketingPct) / 100;
  const simCommissaryAmount = (simSales * simCommissaryPct) / 100;
  const simTotalFranchiseFee = simRoyaltyAmount + simMarketingAmount + simTechFee + simCommissaryAmount;
  const simInvestorDividend = (simSales * simEquityPct) / 100;
  const simEffectiveFranchiseRate = simSales > 0 ? (simTotalFranchiseFee / simSales) * 100 : 0;

  return (
    <DashboardContainer>
      <div className="space-y-6 pb-12">
        {/* Header / B2B Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Portal B2B de Franquiciatarios & Inversionistas
                  {isB2BPartner && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                      Vista Socio
                    </span>
                  )}
                </h1>
                <p className="text-sm text-slate-400">
                  {isB2BPartner
                    ? `Bienvenido, ${currentUser?.name}. Consulta tus estados de cuenta, liquidación de regalías y desglose financiero.`
                    : 'Gestión contractual multi-marca, auditoría automatizada de comandas y reportes consolidados de revenue share.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchContracts();
                fetchStatements();
                fetchReports();
                addNotification('Datos actualizados', 'info');
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
              title="Refrescar datos"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setIsStatementModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors border border-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-brand-primary" />
                  Auditar Período
                </button>
                <button
                  onClick={() => {
                    setEditingContract(null);
                    setContractForm({
                      partnerType: 'FRANCHISEE',
                      partnerName: '',
                      partnerEmail: '',
                      partnerPhone: '',
                      partnerRfc: '',
                      bankName: '',
                      bankAccount: '',
                      royaltyFeePct: 5.0,
                      marketingFeePct: 2.0,
                      techFeeMonthly: 1500.0,
                      commissaryFeePct: 0.0,
                      calculationBasis: 'NET_SALES',
                      equitySharePct: 0.0,
                      minimumMonthlyFee: 0.0,
                      startDate: new Date().toISOString().split('T')[0],
                      endDate: '',
                      notes: '',
                    });
                    setIsContractModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-brand-primary hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Contrato
                </button>
              </>
            )}
          </div>
        </div>

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isB2BPartner ? 'Regalías por Liquidar' : 'Regalías Pendientes'}
              </p>
              <p className="text-2xl font-black text-amber-400 mt-1">
                ${totalOutstanding.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {statements.filter((s) => s.status !== 'PAID').length} estados por conciliar
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Regalías Cobradas
              </p>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                ${totalCollected.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {statements.filter((s) => s.status === 'PAID').length} periodos liquidados
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Dividendos Inversionistas
              </p>
              <p className="text-2xl font-black text-indigo-400 mt-1">
                ${totalDividends.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Revenue share acumulado
              </p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Socios & Contratos
              </p>
              <p className="text-2xl font-black text-white mt-1">
                {contracts.filter((c) => c.status === 'ACTIVE').length} / {contracts.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Activos en {activeBrand?.name || 'Marca'}
              </p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('STATEMENTS')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'STATEMENTS'
                ? 'bg-slate-800 text-white border-b-2 border-brand-primary'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            Estados de Cuenta & Liquidación
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950 text-slate-400 font-mono">
              {statements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('CONTRACTS')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'CONTRACTS'
                ? 'bg-slate-800 text-white border-b-2 border-brand-primary'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4 text-indigo-400" />
            Directorio de Contratos
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950 text-slate-400 font-mono">
              {contracts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'REPORTS'
                ? 'bg-slate-800 text-white border-b-2 border-brand-primary'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Reportes Ejecutivos & P&L
          </button>

          <button
            onClick={() => setActiveTab('SIMULATOR')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'SIMULATOR'
                ? 'bg-slate-800 text-white border-b-2 border-brand-primary'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Calculator className="h-4 w-4 text-cyan-400" />
            Simulador de Regalías & ROI
          </button>
        </div>

        {/* TAB 1: ESTADOS DE CUENTA & LIQUIDACIÓN */}
        {activeTab === 'STATEMENTS' && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Contrato:</span>
                  <select
                    value={statementFilterContract}
                    onChange={(e) => setStatementFilterContract(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand-primary"
                  >
                    <option value="ALL">Todos los Contratos</option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contractFolio} - {c.partnerName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Estatus:</span>
                  <select
                    value={statementFilterStatus}
                    onChange={(e) => setStatementFilterStatus(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand-primary"
                  >
                    <option value="ALL">Todos los Estados</option>
                    <option value="ISSUED">Emitido (Pendiente)</option>
                    <option value="PAID">Pagado / Liquidado</option>
                    <option value="DISPUTED">En Disputa</option>
                    <option value="DRAFT">Borrador</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Año:</span>
                  <select
                    value={statementFilterYear}
                    onChange={(e) => setStatementFilterYear(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand-primary"
                  >
                    <option value="ALL">Histórico Completo</option>
                    <option value="2027">2027</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                Mostrando <span className="font-bold text-white">{statements.length}</span> estados de cuenta
              </div>
            </div>

            {/* Statements Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              {loadingStatements ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-brand-primary" />
                  <p className="text-sm">Cargando estados de cuenta auditados...</p>
                </div>
              ) : statements.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-base font-bold text-slate-200">No hay estados de cuenta generados</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {isAdmin
                      ? 'Haz clic en "Auditar Período" para calcular automáticamente las regalías con base en las órdenes del mes.'
                      : 'Aún no se han emitido estados de cuenta para tu contrato en este período.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Folio Estado</th>
                        <th className="py-3 px-4">Socio / Franquicia</th>
                        <th className="py-3 px-4">Período</th>
                        <th className="py-3 px-4 text-right">Comandas</th>
                        <th className="py-3 px-4 text-right">Venta Neta</th>
                        <th className="py-3 px-4 text-right">Regalías %</th>
                        <th className="py-3 px-4 text-right">Marketing & Tech</th>
                        <th className="py-3 px-4 text-right">Total Liquidable</th>
                        <th className="py-3 px-4 text-center">Estatus</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {statements.map((s) => {
                        const isPaid = s.status === 'PAID';
                        const isDisputed = s.status === 'DISPUTED';
                        const isIssued = s.status === 'ISSUED';

                        return (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              {s.statementFolio}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-200">{s.contract.partnerName}</p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {s.contract.contractFolio} ({s.contract.partnerType})
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <p className="text-slate-200 font-semibold">{s.periodYear}-M{String(s.periodMonth).padStart(2, '0')}</p>
                              <span className="text-[10px] text-slate-500">
                                {s.periodStart.split('T')[0]} a {s.periodEnd.split('T')[0]}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {s.ordersCount.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-200">
                              ${s.netSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-amber-300">
                              ${s.royaltyFeeAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              <span className="block text-[10px] text-slate-500 font-sans">
                                ({s.contract.royaltyFeePct}%)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-300">
                              ${(s.marketingFeeAmount + s.techFeeAmount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                              ${s.totalDue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              {s.investorShareAmount > 0 && (
                                <span className="block text-[10px] text-indigo-400 font-sans">
                                  +${s.investorShareAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} Div.
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isPaid && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Liquidado
                                </span>
                              )}
                              {isIssued && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                                  <Clock className="h-3 w-3" />
                                  Pendiente
                                </span>
                              )}
                              {isDisputed && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-800">
                                  <AlertTriangle className="h-3 w-3" />
                                  En Disputa
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedStatementDetail(s)}
                                  className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Ver detalle financiero"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <a
                                  href={`/api/franchise/statements/${s.id}/export`}
                                  download
                                  className="p-1.5 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors cursor-pointer"
                                  title="Descargar CSV / Excel"
                                >
                                  <Download className="h-4 w-4" />
                                </a>

                                {isAdmin && !isPaid && (
                                  <button
                                    onClick={() => {
                                      setTargetPayStatement(s);
                                      setPayForm({
                                        paymentMethod: 'SPEI',
                                        paymentReference: '',
                                        notes: '',
                                      });
                                      setIsPayModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Registrar Liquidación"
                                  >
                                    Pagar
                                  </button>
                                )}

                                {!isPaid && !isDisputed && (
                                  <button
                                    onClick={() => {
                                      setTargetDisputeStatement(s);
                                      setDisputeForm({ notes: '' });
                                      setIsDisputeModalOpen(true);
                                    }}
                                    className="p-1.5 hover:bg-red-950/50 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                    title="Reportar Discrepancia"
                                  >
                                    <AlertCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DIRECTORIO DE CONTRATOS & SOCIOS */}
        {activeTab === 'CONTRACTS' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                    placeholder="Buscar socio, folio, RFC..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Tipo:</span>
                  <select
                    value={contractFilterType}
                    onChange={(e) => setContractFilterType(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand-primary"
                  >
                    <option value="ALL">Todos los Tipos</option>
                    <option value="FRANCHISEE">Franquiciatario</option>
                    <option value="INVESTOR">Inversionista</option>
                    <option value="JOINT_VENTURE">Joint Venture</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Estado:</span>
                  <select
                    value={contractFilterStatus}
                    onChange={(e) => setContractFilterStatus(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand-primary"
                  >
                    <option value="ALL">Todos los Estados</option>
                    <option value="ACTIVE">Activo</option>
                    <option value="PAUSED">Pausado</option>
                    <option value="TERMINATED">Terminado</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                Total: <span className="font-bold text-white">{filteredContracts.length}</span> contratos
              </div>
            </div>

            {/* Contracts Cards Grid */}
            {loadingContracts ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-brand-primary" />
                <p className="text-sm">Cargando contratos de franquicia...</p>
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                <Briefcase className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-bold text-slate-200">No se encontraron contratos</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {isAdmin
                    ? 'Agrega un nuevo contrato de franquicia o inversionista con el botón superior.'
                    : 'No tienes contratos registrados asociados a tu cuenta.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContracts.map((c) => {
                  const isInvestor = c.partnerType === 'INVESTOR';

                  return (
                    <div
                      key={c.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-brand-primary tracking-wide">
                              {c.contractFolio}
                            </span>
                            <h3 className="text-base font-bold text-white mt-0.5 leading-snug">
                              {c.partnerName}
                            </h3>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isInvestor
                                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}
                          >
                            {c.partnerType}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            Base: {c.calculationBasis}
                          </span>
                        </div>

                        {/* Financial Parameters */}
                        <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                              Regalías Marca
                            </span>
                            <span className="font-mono font-bold text-amber-400 text-sm">
                              {c.royaltyFeePct}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                              Fondo Marketing
                            </span>
                            <span className="font-mono font-bold text-slate-200 text-sm">
                              {c.marketingFeePct}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                              Software / POS
                            </span>
                            <span className="font-mono font-bold text-slate-200">
                              ${c.techFeeMonthly.toLocaleString('es-MX')}/mes
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                              {isInvestor ? 'Participación Eq.' : 'Ghost Kitchen'}
                            </span>
                            <span className="font-mono font-bold text-indigo-400">
                              {isInvestor ? `${c.equitySharePct}%` : `${c.commissaryFeePct}%`}
                            </span>
                          </div>
                        </div>

                        {/* Contact details */}
                        <div className="mt-3 space-y-1 text-xs text-slate-400">
                          {c.partnerEmail && <p className="truncate">✉️ {c.partnerEmail}</p>}
                          {c.partnerPhone && <p>📞 {c.partnerPhone}</p>}
                          {c.partnerRfc && <p className="font-mono text-[11px]">RFC: {c.partnerRfc}</p>}
                          {c.bankAccount && (
                            <p className="font-mono text-[11px] text-slate-500 truncate">
                              CLABE: {c.bankName || 'Banco'} •••• {c.bankAccount.slice(-4)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer actions */}
                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {c._count?.statements || 0} estados auditados
                        </span>

                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditContract(c)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="h-3 w-3" />
                              Editar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REPORTES EJECUTIVOS & P&L */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-6">
            {/* Year Selector */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Consolidado Ejecutivo de Revenue Share & P&L
                </h3>
                <p className="text-xs text-slate-400">
                  Desglose financiero anual de ingresos brutos, deducciones, fondos de mercadeo y dividendos.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Ejercicio Fiscal:</span>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-brand-primary"
                >
                  <option value="2027">2027</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>
            </div>

            {loadingReports ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-brand-primary" />
                <p className="text-sm">Generando analítica financiera...</p>
              </div>
            ) : !reportData ? (
              <div className="p-12 text-center text-slate-400">
                <p>No se encontraron datos para el ejercicio seleccionado.</p>
              </div>
            ) : (
              <>
                {/* Evolution Chart */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Evolución Mensual de Ventas vs Regalías Liquidables ({reportYear})
                  </h4>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={reportData.monthlyEvolution}>
                        <defs>
                          <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorRoy" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="monthName" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v / 1000}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                          formatter={(value: any) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, '']}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Area type="monotone" dataKey="netSales" name="Venta Neta Imputable" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNet)" />
                        <Area type="monotone" dataKey="royalties" name="Regalías Cobradas" stroke="#f59e0b" fillOpacity={1} fill="url(#colorRoy)" />
                        <Area type="monotone" dataKey="investorDividends" name="Dividendos Inversionistas" stroke="#10b981" fillOpacity={1} fill="none" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Executive P&L Statement */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Estado de Resultados Ejecutivo (P&L Franquicia / Inversión)</span>
                    <span className="text-[11px] text-brand-primary font-mono lowercase">ejercicio {reportYear}</span>
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-200">
                      <thead className="bg-slate-950 font-bold text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Línea Financiera</th>
                          <th className="py-2.5 px-3 text-right">Monto Anual</th>
                          <th className="py-2.5 px-3 text-right">% sobre Venta</th>
                          <th className="py-2.5 px-3">Observaciones Fiscales / Contables</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        <tr>
                          <td className="py-2 px-3 font-bold text-white">Ventas Brutas Totales (POS + Delivery)</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">
                            ${reportData.pAndLSummary.grossRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">100.0%</td>
                          <td className="py-2 px-3 text-slate-500">Ingresos brutos acumulados en todas las comandas</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-red-400">(-) Descuentos, Cupones & Promociones</td>
                          <td className="py-2 px-3 text-right font-mono text-red-400">
                            -${reportData.pAndLSummary.discounts.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-red-400">
                            {reportData.pAndLSummary.grossRevenue > 0
                              ? ((reportData.pAndLSummary.discounts / reportData.pAndLSummary.grossRevenue) * 100).toFixed(1)
                              : 0}%
                          </td>
                          <td className="py-2 px-3 text-slate-500">Campañas de absorción conjunta</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-amber-400">(-) Impuestos Trasladados (IVA 16%)</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-400">
                            -${reportData.pAndLSummary.taxes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">-</td>
                          <td className="py-2 px-3 text-slate-500">Pasivo fiscal ante el SAT</td>
                        </tr>
                        <tr className="bg-slate-950/60 font-bold">
                          <td className="py-2.5 px-3 text-emerald-400">(=) Ingreso Neto Imputable (Venta Neta)</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400 text-sm">
                            ${reportData.pAndLSummary.netRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                            {reportData.pAndLSummary.grossRevenue > 0
                              ? ((reportData.pAndLSummary.netRevenue / reportData.pAndLSummary.grossRevenue) * 100).toFixed(1)
                              : 0}%
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">Base contractual de cálculo de regalías</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-400">(-) Costo de Alimentos & Bebidas (COGS Estimado)</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">
                            -${reportData.pAndLSummary.estimatedCogs.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">
                            {reportData.pAndLSummary.foodCostPct}%
                          </td>
                          <td className="py-2 px-3 text-slate-500">Target Food Cost de la marca</td>
                        </tr>
                        <tr className="bg-slate-950/40">
                          <td className="py-2 px-3 text-amber-300 font-semibold">Regalías de Marca Acumuladas</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-300 font-bold">
                            ${reportData.pAndLSummary.royaltiesCollected.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-300">
                            {reportData.pAndLSummary.netRevenue > 0
                              ? ((reportData.pAndLSummary.royaltiesCollected / reportData.pAndLSummary.netRevenue) * 100).toFixed(1)
                              : 0}%
                          </td>
                          <td className="py-2 px-3 text-slate-500">Royalties imputables a franquiciatarios</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-blue-300">Fondo Cooperativo de Marketing (Ad Fund)</td>
                          <td className="py-2 px-3 text-right font-mono text-blue-300">
                            ${reportData.pAndLSummary.marketingFund.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-blue-300">
                            {reportData.pAndLSummary.netRevenue > 0
                              ? ((reportData.pAndLSummary.marketingFund / reportData.pAndLSummary.netRevenue) * 100).toFixed(1)
                              : 0}%
                          </td>
                          <td className="py-2 px-3 text-slate-500">Publicidad digital cooperativa de la marca</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-300">Cuotas Tecnológicas (SaaS Software & KDS)</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            ${reportData.pAndLSummary.techFees.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">-</td>
                          <td className="py-2 px-3 text-slate-500">Cuota fija de plataforma DarkFlow POS</td>
                        </tr>
                        <tr className="bg-indigo-950/20 font-bold">
                          <td className="py-2 px-3 text-indigo-400">Dividendos Repartidos a Inversionistas</td>
                          <td className="py-2 px-3 text-right font-mono text-indigo-400">
                            ${reportData.pAndLSummary.investorDividendsDistributed.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-indigo-400">-</td>
                          <td className="py-2 px-3 text-slate-400">Liquidaciones de equity share socios capitalistas</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Partner Contribution Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Desglose por Socio Contractual ({reportYear})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 font-bold text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Folio Contrato</th>
                          <th className="py-2.5 px-3">Socio / Titular</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3 text-right">Comandas</th>
                          <th className="py-2.5 px-3 text-right">Venta Neta</th>
                          <th className="py-2.5 px-3 text-right">Total Regalías & Fees</th>
                          <th className="py-2.5 px-3 text-right">Liquidado (Pagado)</th>
                          <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {reportData.partnerBreakdown.map((p) => (
                          <tr key={p.contractId} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-mono text-brand-primary">{p.contractFolio}</td>
                            <td className="py-2 px-3 font-bold text-white">{p.partnerName}</td>
                            <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{p.partnerType}</td>
                            <td className="py-2 px-3 text-right font-mono">{p.ordersCount.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-200">
                              ${p.netSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              ${p.totalDue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-400">
                              ${p.totalPaid.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-amber-400">
                              ${p.balanceDue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: SIMULADOR DE REGALÍAS & ROI */}
        {activeTab === 'SIMULATOR' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calculator className="h-5 w-5 text-cyan-400" />
                Simulador Dinámico de Regalías & Retorno de Inversión (ROI)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Herramienta interactiva para proyectar liquidaciones mensuales, absorción de fees y retorno de capital para socios.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sliders Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  Parámetros de Simulación Mensual
                </h4>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">Venta Mensual Estimada:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ${simSales.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50000"
                    max="1500000"
                    step="10000"
                    value={simSales}
                    onChange={(e) => setSimSales(Number(e.target.value))}
                    className="w-full accent-brand-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>$50,000</span>
                    <span>$750,000</span>
                    <span>$1,500,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">Regalía de Marca (Royalty %):</span>
                    <span className="font-mono font-bold text-amber-400">{simRoyaltyPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.5"
                    value={simRoyaltyPct}
                    onChange={(e) => setSimRoyaltyPct(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">Fondo Cooperativo de Marketing (%):</span>
                    <span className="font-mono font-bold text-blue-400">{simMarketingPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6"
                    step="0.5"
                    value={simMarketingPct}
                    onChange={(e) => setSimMarketingPct(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">Cuota Tecnológica Mensual Fija:</span>
                    <span className="font-mono font-bold text-slate-200">${simTechFee} MXN</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    step="250"
                    value={simTechFee}
                    onChange={(e) => setSimTechFee(Number(e.target.value))}
                    className="w-full accent-slate-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">Uso de Dark Kitchen Central (%):</span>
                    <span className="font-mono font-bold text-purple-400">{simCommissaryPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={simCommissaryPct}
                    onChange={(e) => setSimCommissaryPct(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">Participación Equity Inversionista (%):</span>
                    <span className="font-mono font-bold text-indigo-400">{simEquityPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="0.5"
                    value={simEquityPct}
                    onChange={(e) => setSimEquityPct(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Calculated Results */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Proyección de Liquidación Mensual
                  </h4>

                  <div className="space-y-3 mt-4 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Regalías de Marca ({simRoyaltyPct}%):</span>
                      <span className="font-mono font-bold text-amber-400">
                        ${simRoyaltyAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Fondo Cooperativo de Marketing ({simMarketingPct}%):</span>
                      <span className="font-mono font-bold text-blue-400">
                        ${simMarketingAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Software DarkFlow & KDS (Cuota fija):</span>
                      <span className="font-mono font-bold text-slate-200">
                        ${simTechFee.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {simCommissaryPct > 0 && (
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Cocina Central / Commissary ({simCommissaryPct}%):</span>
                        <span className="font-mono font-bold text-purple-400">
                          ${simCommissaryAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-2.5 bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm">
                      <span className="font-bold text-white">Total Pago Franquicia (Fee Total):</span>
                      <span className="font-mono font-black text-amber-400 text-base">
                        ${simTotalFranchiseFee.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 text-xs text-slate-400">
                      <span>Tasa efectiva total sobre venta:</span>
                      <span className="font-mono font-semibold text-slate-300">
                        {simEffectiveFranchiseRate.toFixed(2)}%
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center bg-indigo-950/30 p-3 rounded-lg border border-indigo-900/50">
                      <div>
                        <span className="text-xs font-bold text-indigo-300 block">
                          Dividendo Socio Inversionista ({simEquityPct}%):
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Monto liquidable a favor del socio capitalista
                        </span>
                      </div>
                      <span className="font-mono font-black text-indigo-400 text-base">
                        ${simInvestorDividend.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                    Proyección de Retorno Anualizado
                  </p>
                  <p>
                    Con una venta mensual sostenida de ${simSales.toLocaleString()} MXN, el inversionista percibiría aproximadamente{' '}
                    <strong className="text-emerald-400 font-mono">
                      ${(simInvestorDividend * 12).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                    </strong>{' '}
                    anuales antes de impuestos corporativos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: NUEVO / EDITAR CONTRATO */}
        {isContractModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-brand-primary" />
                  {editingContract ? 'Editar Contrato de Franquicia' : 'Registrar Nuevo Contrato B2B'}
                </h3>
                <button
                  onClick={() => setIsContractModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveContract} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Tipo de Socio / Alianza *
                    </label>
                    <select
                      value={contractForm.partnerType}
                      onChange={(e) => setContractForm({ ...contractForm, partnerType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="FRANCHISEE">Franquiciatario (Operador de Marca)</option>
                      <option value="INVESTOR">Socio Inversionista (Revenue Share / Equity)</option>
                      <option value="JOINT_VENTURE">Joint Venture (Alianza Estratégica)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Nombre o Razón Social del Socio *
                    </label>
                    <input
                      type="text"
                      required
                      value={contractForm.partnerName}
                      onChange={(e) => setContractForm({ ...contractForm, partnerName: e.target.value })}
                      placeholder="Ej. Operadora Gastronómica del Norte S.A. de C.V."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Correo Electrónico (Para Login Portal B2B)
                    </label>
                    <input
                      type="email"
                      value={contractForm.partnerEmail}
                      onChange={(e) => setContractForm({ ...contractForm, partnerEmail: e.target.value })}
                      placeholder="socio@ejemplo.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="text"
                      value={contractForm.partnerPhone}
                      onChange={(e) => setContractForm({ ...contractForm, partnerPhone: e.target.value })}
                      placeholder="55-1234-5678"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      RFC del Socio (SAT)
                    </label>
                    <input
                      type="text"
                      value={contractForm.partnerRfc}
                      onChange={(e) => setContractForm({ ...contractForm, partnerRfc: e.target.value.toUpperCase() })}
                      placeholder="OGN200115XX1"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Cuenta CLABE / Banco (Liquidación)
                    </label>
                    <input
                      type="text"
                      value={contractForm.bankAccount}
                      onChange={(e) => setContractForm({ ...contractForm, bankAccount: e.target.value })}
                      placeholder="18 dígitos de cuenta bancaria"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Financial Rates Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">
                    Esquema de Regalías & Tarifas Contractuales
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Regalías (% Royalty)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={contractForm.royaltyFeePct}
                        onChange={(e) => setContractForm({ ...contractForm, royaltyFeePct: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Fondo Marketing (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={contractForm.marketingFeePct}
                        onChange={(e) => setContractForm({ ...contractForm, marketingFeePct: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Cuota Tech Mensual ($)
                      </label>
                      <input
                        type="number"
                        step="50"
                        value={contractForm.techFeeMonthly}
                        onChange={(e) => setContractForm({ ...contractForm, techFeeMonthly: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Base Imputable
                      </label>
                      <select
                        value={contractForm.calculationBasis}
                        onChange={(e) => setContractForm({ ...contractForm, calculationBasis: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="NET_SALES">Venta Neta</option>
                        <option value="GROSS_SALES">Venta Bruta</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Equity Share (% Socio)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={contractForm.equitySharePct}
                        onChange={(e) => setContractForm({ ...contractForm, equitySharePct: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Ghost Kitchen (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={contractForm.commissaryFeePct}
                        onChange={(e) => setContractForm({ ...contractForm, commissaryFeePct: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Cuota Mínima Garantizada ($)
                      </label>
                      <input
                        type="number"
                        step="100"
                        value={contractForm.minimumMonthlyFee}
                        onChange={(e) => setContractForm({ ...contractForm, minimumMonthlyFee: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Fecha de Inicio *
                      </label>
                      <input
                        type="date"
                        required
                        value={contractForm.startDate}
                        onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Notas o Cláusulas Especiales
                  </label>
                  <textarea
                    rows={2}
                    value={contractForm.notes}
                    onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                    placeholder="Detalles del territorio exclusivo, fechas de corte, etc."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsContractModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-brand-primary hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    {editingContract ? 'Actualizar Contrato' : 'Guardar Contrato'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: AUDITAR PERÍODO & GENERAR ESTADO DE CUENTA */}
        {isStatementModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-400" />
                  Auditar Período & Emitir Estado de Cuenta
                </h3>
                <button
                  onClick={() => setIsStatementModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateStatement} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Contrato a Auditar *
                  </label>
                  <select
                    required
                    value={statementForm.contractId}
                    onChange={(e) => setStatementForm({ ...statementForm, contractId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="">Selecciona un contrato activo...</option>
                    {contracts
                      .filter((c) => c.status === 'ACTIVE')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.contractFolio} - {c.partnerName} ({c.royaltyFeePct}% regalía)
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Mes del Período
                    </label>
                    <select
                      value={statementForm.periodMonth}
                      onChange={(e) => {
                        const m = parseInt(e.target.value, 10);
                        const y = statementForm.periodYear;
                        setStatementForm({
                          ...statementForm,
                          periodMonth: m,
                          periodStart: new Date(y, m - 1, 1).toISOString().split('T')[0],
                          periodEnd: new Date(y, m, 0).toISOString().split('T')[0],
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="1">Enero</option>
                      <option value="2">Febrero</option>
                      <option value="3">Marzo</option>
                      <option value="4">Abril</option>
                      <option value="5">Mayo</option>
                      <option value="6">Junio</option>
                      <option value="7">Julio</option>
                      <option value="8">Agosto</option>
                      <option value="9">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Año
                    </label>
                    <input
                      type="number"
                      value={statementForm.periodYear}
                      onChange={(e) => setStatementForm({ ...statementForm, periodYear: parseInt(e.target.value, 10) || 2026 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      required
                      value={statementForm.periodStart}
                      onChange={(e) => setStatementForm({ ...statementForm, periodStart: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      required
                      value={statementForm.periodEnd}
                      onChange={(e) => setStatementForm({ ...statementForm, periodEnd: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Notas o Referencia Administrativa
                  </label>
                  <input
                    type="text"
                    value={statementForm.notes}
                    onChange={(e) => setStatementForm({ ...statementForm, notes: e.target.value })}
                    placeholder="Ej. Cierre regular del mes"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Info className="h-4 w-4" />
                    Cálculo Automatizado en Base de Datos
                  </p>
                  <p className="mt-1 text-slate-400">
                    El sistema auditará todas las órdenes no canceladas registradas en el rango de fechas, computará la venta bruta, deducciones e impuestos, y aplicará las tasas estipuladas en el contrato.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsStatementModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-brand-primary hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Generar & Auditar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: DETALLE FINANCIERO DEL ESTADO DE CUENTA */}
        {selectedStatementDetail && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="font-mono text-xs text-brand-primary font-bold">
                    Folio: {selectedStatementDetail.statementFolio}
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    Desglose Financiero - {selectedStatementDetail.contract.partnerName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedStatementDetail(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Período</span>
                  <span className="font-bold text-white">
                    {selectedStatementDetail.periodYear}-M{String(selectedStatementDetail.periodMonth).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Comandas Auditadas</span>
                  <span className="font-mono font-bold text-white">
                    {selectedStatementDetail.ordersCount} pedidos
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Estatus</span>
                  <span className="font-bold text-amber-400">{selectedStatementDetail.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Venta Bruta</span>
                  <span className="font-mono font-bold text-white">
                    ${selectedStatementDetail.grossSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 font-bold text-slate-400 text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Concepto</th>
                      <th className="py-2.5 px-4 text-center">Tasa / Cuota</th>
                      <th className="py-2.5 px-4 text-right">Monto Liquidable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-medium">
                    <tr>
                      <td className="py-2.5 px-4">Venta Neta Imputable</td>
                      <td className="py-2.5 px-4 text-center text-slate-500">Base</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-white">
                        ${selectedStatementDetail.netSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-amber-300">Regalías de Marca (Royalties)</td>
                      <td className="py-2.5 px-4 text-center font-mono text-amber-400">
                        {selectedStatementDetail.contract.royaltyFeePct}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-300 font-bold">
                        ${selectedStatementDetail.royaltyFeeAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-blue-300">Fondo Cooperativo de Marketing</td>
                      <td className="py-2.5 px-4 text-center font-mono text-blue-400">
                        {selectedStatementDetail.contract.marketingFeePct}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-blue-300">
                        ${selectedStatementDetail.marketingFeeAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-300">Cuota Tecnológica Software POS & KDS</td>
                      <td className="py-2.5 px-4 text-center text-slate-500">Cuota fija</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-300">
                        ${selectedStatementDetail.techFeeAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {selectedStatementDetail.commissaryFeeAmount > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-purple-300">Cocina Central / Ghost Kitchen</td>
                        <td className="py-2.5 px-4 text-center text-purple-400">Variable</td>
                        <td className="py-2.5 px-4 text-right font-mono text-purple-300">
                          ${selectedStatementDetail.commissaryFeeAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-900 font-bold text-white">
                      <td className="py-3 px-4 text-sm">TOTAL REGALÍAS & FEES POR PAGAR</td>
                      <td className="py-3 px-4 text-center">-</td>
                      <td className="py-3 px-4 text-right font-mono text-base text-brand-primary">
                        ${selectedStatementDetail.totalDue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {selectedStatementDetail.investorShareAmount > 0 && (
                      <tr className="bg-indigo-950/40 text-indigo-300 font-bold">
                        <td className="py-3 px-4">DIVIDENDO SOCIO INVERSIONISTA</td>
                        <td className="py-3 px-4 text-center font-mono">
                          {selectedStatementDetail.contract.equitySharePct}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-indigo-400">
                          ${selectedStatementDetail.investorShareAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedStatementDetail.paidAt && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-xs text-emerald-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Liquidación Confirmada
                  </p>
                  <p className="text-slate-400">
                    Método: <strong className="text-white">{selectedStatementDetail.paymentMethod}</strong> | 
                    Referencia: <strong className="text-white font-mono">{selectedStatementDetail.paymentReference || 'N/A'}</strong> | 
                    Fecha: <strong className="text-white">{selectedStatementDetail.paidAt.split('T')[0]}</strong>
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <a
                  href={`/api/franchise/statements/${selectedStatementDetail.id}/export`}
                  download
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold text-xs flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Descargar Reporte (CSV)
                </a>

                <button
                  onClick={() => setSelectedStatementDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: REGISTRAR PAGO / LIQUIDACIÓN */}
        {isPayModalOpen && targetPayStatement && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                  Registrar Liquidación de Regalías
                </h3>
                <button
                  onClick={() => setIsPayModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleMarkAsPaid} className="space-y-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <p className="text-slate-400">Folio: <strong className="text-white font-mono">{targetPayStatement.statementFolio}</strong></p>
                  <p className="text-slate-400">Socio: <strong className="text-white">{targetPayStatement.contract.partnerName}</strong></p>
                  <p className="text-slate-400 mt-1">
                    Total a Liquidar: <strong className="text-emerald-400 font-mono text-sm">${targetPayStatement.totalDue.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="SPEI">Transferencia Bancaria SPEI</option>
                    <option value="CREDIT_CARD">Tarjeta de Crédito / Débito</option>
                    <option value="OFFSET">Compensación / Cruce de Cuentas</option>
                    <option value="CASH">Efectivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Folio de Rastreo / Referencia Bancaria *
                  </label>
                  <input
                    type="text"
                    required
                    value={payForm.paymentReference}
                    onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })}
                    placeholder="Ej. SPEI-7749204128 o clave de rastreo"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Comentarios / Notas
                  </label>
                  <input
                    type="text"
                    value={payForm.notes}
                    onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                    placeholder="Comprobante verificado en portal bancario"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsPayModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Confirmar Liquidación
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: REPORTAR DISCREPANCIA / DISPUTA */}
        {isDisputeModalOpen && targetDisputeStatement && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  Reportar Discrepancia en Estado de Cuenta
                </h3>
                <button
                  onClick={() => setIsDisputeModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleDisputeStatement} className="space-y-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <p className="text-slate-400">Folio: <strong className="text-white font-mono">{targetDisputeStatement.statementFolio}</strong></p>
                  <p className="text-slate-400">Socio: <strong className="text-white">{targetDisputeStatement.contract.partnerName}</strong></p>
                  <p className="text-slate-400 mt-1">Total Liquidable: <strong className="text-white font-mono">${targetDisputeStatement.totalDue.toFixed(2)} MXN</strong></p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Motivo de la Discrepancia *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={disputeForm.notes}
                    onChange={(e) => setDisputeForm({ notes: e.target.value })}
                    placeholder="Describe las comandas, cancelaciones o cálculos que presentan diferencias..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDisputeModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                  >
                    Marcar en Disputa
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
}
