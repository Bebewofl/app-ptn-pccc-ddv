import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc
} from 'firebase/firestore';

import { 
  ClipboardList, Settings2, LayoutDashboard, CheckCircle2, Users, Sun, Moon, AlertTriangle, Calendar, Activity, Archive, Printer, Search, UploadCloud, Loader2, RefreshCw, XCircle, PlusCircle, Trash2, Edit2, Check, X, History, Briefcase, ChevronDown, ChevronUp, ChevronRight, ShieldAlert, Filter, Download, FileSpreadsheet, LogOut, KeyRound, ListFilter, ThermometerSun, Wind, Timer, Pause, Play, Layers, UserMinus, UserCheck, UserX, Clock, CalendarCheck, ShieldCheck, UserCog, Crosshair, Cpu, Database, ChevronsLeft, ChevronLeft, ChevronsRight
} from 'lucide-react';

// =========================================================================
// 🚀 CẤU HÌNH FIREBASE ÉP BUỘC KẾT NỐI VÀO DB GỐC CỦA BẠN (KHÔNG DÙNG DB ẢO)
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCoYYrj_cuqwm_5N0NQLUCEzKGh7DYheDE",
  authDomain: "app-ptn-pccc.firebaseapp.com",
  projectId: "app-ptn-pccc",
  storageBucket: "app-ptn-pccc.firebasestorage.app",
  messagingSenderId: "1070884929418",
  appId: "1:1070884929418:web:aa64e2aac0b01b53821273"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Ép buộc kết nối trực tiếp vào Collection gốc của bạn
const getCol = (colName) => collection(db, colName);
const getDocument = (colName, docId) => doc(db, colName, docId);

// =========================================================================
// 🚀 HÀM HỖ TRỢ LÕI
// =========================================================================
const getLocalYYYYMMDD = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const isSundayStr = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr).getDay() === 0;
};

const getRoleWeight = (role) => {
  const r = String(role || '').toLowerCase();
  if (r.includes('trưởng phòng')) return 1;
  if (r.includes('phó phòng')) return 2;
  if (r.includes('quản lý') || r.includes('ktv trưởng')) return 3;
  if (r.includes('thư ký') || r.includes('hành chính') || r.includes('thủ kho') || r.includes('kế toán')) return 4;
  return 5; 
};

const getElapsedMs = (test, currentTime) => {
   let elapsed = test.accumulatedTimeMs || 0;
   if (!test.isPaused && test.lastResumeTime) {
       elapsed += (currentTime.getTime() - new Date(test.lastResumeTime).getTime());
   } else if (!test.isPaused && test.phaseStartTime && !test.lastResumeTime) {
       elapsed += (currentTime.getTime() - new Date(test.phaseStartTime).getTime());
   }
   return Math.max(0, elapsed);
};

const formatMs = (diffMs) => {
  if (diffMs < 0) return '0 phút';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffMs / 1000 / 60) % 60);
  const seconds = Math.floor((diffMs / 1000) % 60);
  if (days > 0) return `${days} ngày ${hours}h ${minutes}p`;
  if (hours > 0) return `${hours}h ${minutes}p ${seconds}s`;
  return `${minutes}p ${seconds}s`;
};

const CORROSION_TIME_MS = 21 * 24 * 60 * 60 * 1000; 
const DRYING_TIME_MS = 16 * 60 * 60 * 1000; 

const categorizeDevice = (type) => {
  const t = String(type || '').toLowerCase();
  if (t.includes('tủ')) return 'Tủ trung tâm';
  if (t.includes('nhiệt')) return 'Đầu báo nhiệt';
  if (t.includes('khói')) return 'Đầu báo khói';
  if (t.includes('còi đèn') || t.includes('kết hợp')) return 'Còi đèn kết hợp';
  if (t.includes('chuông')) return 'Chuông báo cháy';
  if (t.includes('đèn')) return 'Đèn báo cháy';
  if (t.includes('nút ấn') || t.includes('nút nhấn')) return 'Nút ấn báo cháy';
  return 'Loại khác';
};

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'TỔNG QUAN HỆ THỐNG' },
  { id: 'orders', icon: ClipboardList, label: 'QUẢN LÝ ĐƠN KĐ' },
  { id: 'inventory', icon: Database, label: 'DỮ LIỆU KHO' },
  { id: 'equipment', icon: Cpu, label: 'TRẠM MÁY' },
  { id: 'personnel', icon: Users, label: 'NHÂN SỰ' },
];

export default function App() {
  const [userRole, setUserRole] = useState(null); 
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginError, setShowLoginError] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentShift, setCurrentShift] = useState('Ngày');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingPersonnel, setIsUploadingPersonnel] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [isOrderDetailsExpanded, setIsOrderDetailsExpanded] = useState(false);
  const [isPersonnelExpanded, setIsPersonnelExpanded] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderModalFilter, setOrderModalFilter] = useState('Quá hạn');

  // Print Config State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMonth, setPrintMonth] = useState(new Date().getMonth() + 1);
  const [printYear, setPrintYear] = useState(new Date().getFullYear());
  const [isPrintingMonthly, setIsPrintingMonthly] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    // Nhúng thư viện Xuất PDF Html2Pdf
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    document.body.appendChild(script);

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [personnel, setPersonnel] = useState([]);
  const [samplesInStock, setSamplesInStock] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [orders, setOrders] = useState([]);

  const [editingPersonnelId, setEditingPersonnelId] = useState(null);
  const [confirmDeletePersonnelId, setConfirmDeletePersonnelId] = useState(null);
  const [editPersonnelData, setEditPersonnelData] = useState({ name: '', role: '', shift: '' });
  const [newPersonnel, setNewPersonnel] = useState({ name: '', role: 'KTV', shift: 'Hành Chính' });
  const [showAddPersonnel, setShowAddPersonnel] = useState(false);

  const [showAttendanceCalendar, setShowAttendanceCalendar] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState('date');
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(getLocalYYYYMMDD(new Date()));
  const [selectedAttendanceStaffId, setSelectedAttendanceStaffId] = useState(null);
  const [attendanceViewDate, setAttendanceViewDate] = useState(new Date());
  const [attendanceBatchData, setAttendanceBatchData] = useState({});
  const [personBatchData, setPersonBatchData] = useState({});
  const [pinnedTooltip, setPinnedTooltip] = useState(null);

  const [editingSampleId, setEditingSampleId] = useState(null);
  const [confirmDeleteSampleId, setConfirmDeleteSampleId] = useState(null);
  const [editSampleData, setEditSampleData] = useState({ client: '', type: '', model: '', qty: 1 });

  const [editingOrderId, setEditingOrderId] = useState(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState(null);
  const [editOrderData, setEditOrderData] = useState({ client: '', type: '', model: '', sampleSize: 1, deadline: '', urgency: 'Bình thường' });
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [newOrderData, setNewOrderData] = useState({ client: '', type: 'Tủ trung tâm', model: '', sampleSize: 1, deadline: '', urgency: 'Mới' });

  const [assigningStation, setAssigningStation] = useState(null);
  const [selectedOrderIdToAssign, setSelectedOrderIdToAssign] = useState('');
  const [selectedPersonnelToAssign, setSelectedPersonnelToAssign] = useState('');
  const [tso2SelectedUser, setTso2SelectedUser] = useState('');
  const [newStationName, setNewStationName] = useState(''); 

  const todayStr = getLocalYYYYMMDD(new Date());
  const isTodaySunday = new Date().getDay() === 0;

  // --- LOGIC PHÂN QUYỀN TRUY CẬP BUTTONS ---
  const canEditData = userRole === 'ADMIN' || userRole === 'USER'; 
  const isSuperAdmin = userRole === 'ADMIN'; 

  const handleLogin = () => {
    if (loginPassword === '9299') setUserRole('ADMIN');
    else if (loginPassword === '6789') setUserRole('USER');
    else if (loginPassword === '3333') setUserRole('TESTER');
    else setShowLoginError(true);
  };

  const handleLogout = () => {
    setUserRole(null);
    setLoginPassword('');
  };

  const getItemStatus = (item) => {
    if (!item.tests || !Array.isArray(item.tests) || item.tests.length === 0) return { text: 'KHO_CHỜ', color: 'text-slate-500 bg-slate-900 border-slate-700' };
    const validTests = item.tests.filter(t => t);
    if (validTests.length === 0) return { text: 'KHO_CHỜ', color: 'text-slate-500 bg-slate-900 border-slate-700' };

    const runningTests = validTests.filter(t => t.status === 'Đang chạy');
    if (runningTests.length > 0) {
       const stations = runningTests.map(t => t.equip).join(', ');
       return { text: `ĐANG_CHẠY (${stations})`, color: 'text-emerald-400 bg-emerald-950/30 border-emerald-800' };
    }
    const waitingTests = validTests.filter(t => t.status === 'Chờ chạy');
    if (waitingTests.length > 0) {
       return { text: `CHỜ_GHÉP_MÁY`, color: 'text-amber-400 bg-amber-950/30 border-amber-800' };
    }
    const allDone = validTests.every(t => t.status === 'Xong');
    if (allDone) return { text: 'HOÀN_THÀNH', color: 'text-cyan-400 bg-cyan-950/30 border-cyan-800' };
    return { text: 'ĐANG_XỬ_LÝ', color: 'text-indigo-400 bg-indigo-950/30 border-indigo-800' };
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      let match = true;
      if (orderSearchTerm) {
         const term = orderSearchTerm.toLowerCase();
         if (!(o.model || '').toLowerCase().includes(term) && !(o.client || '').toLowerCase().includes(term) && !(o.reqId || '').toLowerCase().includes(term)) match = false;
      }
      return match;
    });
  }, [orders, orderSearchTerm]);

  const groupedOrdersArr = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(o => {
      const groupKey = String(o.client).trim().toUpperCase(); 
      if (!groups[groupKey]) {
        groups[groupKey] = { groupId: groupKey, reqId: o.reqId, client: o.client, deadline: o.deadline, urgency: o.urgency, items: [], totalQty: 0 };
      }
      groups[groupKey].items.push(o);
      groups[groupKey].totalQty += Number(o.sampleSize || 1);
      if (o.urgency === 'Quá hạn') groups[groupKey].urgency = 'Quá hạn';
      else if (o.urgency === 'Gấp' && groups[groupKey].urgency !== 'Quá hạn') groups[groupKey].urgency = 'Gấp';
    });
    return Object.values(groups).map(group => {
      let totalTests = 0; let doneTests = 0;
      group.items.forEach(item => {
        if (item.tests && Array.isArray(item.tests)) {
          const valid = item.tests.filter(t => t);
          if (valid.length > 0) {
              totalTests += valid.length;
              doneTests += valid.filter(t => t.status === 'Xong').length;
          } else totalTests += 1;
        } else totalTests += 1; 
      });
      group.progress = totalTests === 0 ? 0 : Math.round((doneTests / totalTests) * 100);
      return group;
    });
  }, [filteredOrders]);

  const duplicateCounts = useMemo(() => {
    const counts = {};
    samplesInStock.forEach(s => {
      const key = `${String(s.client || '').trim().toLowerCase()}_${String(s.type || '').trim().toLowerCase()}_${String(s.model || '').trim().toLowerCase()}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [samplesInStock]);

  const checkIsDuplicate = (client, type, model) => {
    if (!client || !model) return false;
    const key = `${String(client).trim().toLowerCase()}_${String(type || '').trim().toLowerCase()}_${String(model).trim().toLowerCase()}`;
    return duplicateCounts[key] > 1; 
  };

  const isDeviceCompatibleWithStation = (stationId, deviceType) => {
    const cat = categorizeDevice(deviceType);
    switch (stationId) {
      case 'TNL-K': return cat === 'Đầu báo khói';
      case 'TNL-N': return cat === 'Đầu báo nhiệt';
      case 'TSO2': return ['Đầu báo khói', 'Đầu báo nhiệt', 'Chuông báo cháy', 'Đèn báo cháy', 'Nút ấn báo cháy', 'Còi đèn kết hợp'].includes(cat);
      case 'PAS': return ['Chuông báo cháy', 'Đèn báo cháy', 'Còi đèn kết hợp'].includes(cat);
      case 'MR': case 'TNA-N': case 'TNA-T': default: return true; 
    }
  };

  const handleDeleteAllDuplicates = async () => {
    if (!isSuperAdmin || !user) return;
    if (!window.confirm("BẠN CÓ CHẮC CHẮN MƯỐN DỌN DẸP?\nHệ thống sẽ gộp số lượng các thiết bị giống hệt nhau.")) return;
    const keptSamples = new Map(); const keptOrders = new Map();
    const deletePromises = []; const updatePromises = [];

    samplesInStock.forEach(sample => {
      const key = `${String(sample.client).trim().toLowerCase()}_${String(sample.type).trim().toLowerCase()}_${String(sample.model).trim().toLowerCase()}`;
      if (!keptSamples.has(key)) keptSamples.set(key, { ...sample, qty: Number(sample.qty || 1) });
      else {
        keptSamples.get(key).qty += Number(sample.qty || 1);
        deletePromises.push(deleteDoc(getDocument('samplesInStock', sample.id)));
      }
    });

    keptSamples.forEach(sample => {
       const original = samplesInStock.find(s => s.id === sample.id);
       if (original && Number(original.qty) !== sample.qty) updatePromises.push(updateDoc(getDocument('samplesInStock', sample.id), { qty: sample.qty }));
    });

    orders.forEach(order => {
       const key = `${String(order.client).trim().toLowerCase()}_${String(order.type).trim().toLowerCase()}_${String(order.model).trim().toLowerCase()}`;
       if (!keptOrders.has(key)) keptOrders.set(key, { ...order, sampleSize: Number(order.sampleSize || 1) });
       else {
          keptOrders.get(key).sampleSize += Number(order.sampleSize || 1);
          deletePromises.push(deleteDoc(getDocument('orders', order.id)));
       }
    });

    keptOrders.forEach(order => {
       const original = orders.find(o => o.id === order.id);
       if (original && Number(original.sampleSize) !== order.sampleSize) updatePromises.push(updateDoc(getDocument('orders', order.id), { sampleSize: order.sampleSize }));
    });

    if (deletePromises.length > 0 || updatePromises.length > 0) {
      try {
        await Promise.all([...deletePromises, ...updatePromises]);
        alert(`Thành công! Đã cập nhật ${deletePromises.length + updatePromises.length} bản ghi.`);
      } catch (err) { setErrorMessage("Lỗi gộp mã: " + err.message); }
    } else alert("Dữ liệu đã sạch, không có bản ghi bị chia nhỏ!");
  };

  const exportToCSV = () => {
    let csvContent = "Mã Đơn,Khách Hàng,Loại Thiết Bị,Model,Số Lượng,Hạn Chót,Mức Độ Gấp,Trạng Thái,Trạm Máy Đang Chạy,KTV Phụ Trách\n";
    orders.forEach(order => {
       const statusInfo = getItemStatus(order);
       const runningTest = (order.tests || []).find(t => t && t.status === 'Đang chạy') || {};
       const eqName = equipments.find(e => e.id === runningTest.equip)?.name || runningTest.equip || '';
       const ktv = runningTest.assignedUser || '';
       const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
       csvContent += `${escapeCsv(order.reqId)},${escapeCsv(order.client)},${escapeCsv(order.type)},${escapeCsv(order.model)},${order.sampleSize},${escapeCsv(order.deadline)},${escapeCsv(order.urgency)},${escapeCsv(statusInfo.text)},${escapeCsv(eqName)},${escapeCsv(ktv)}\n`;
    });
    const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `BaoCao_KiemDinh_PTN_${getLocalYYYYMMDD(new Date())}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  // --- LOGIC XUẤT PDF CHUYÊN NGHIỆP ---
  const handleExportPDF = () => {
    if (!window.html2pdf) {
        window.print();
        return;
    }
    const container = document.createElement('div');
    let title = ""; let tableHTML = "";

    if (activeTab === 'orders') {
        title = "BÁO CÁO TRẠNG THÁI ĐƠN KIỂM ĐỊNH";
        tableHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:15px;">
                <tr style="background-color:#f1f5f9;">
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Mã Đơn</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Khách Hàng</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Hạn Chót</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Mức Độ</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Tổng TB</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Tiến Độ</th>
                </tr>
                ${groupedOrdersArr.map(g => `
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:8px; font-weight:bold;">${g.reqId}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${g.client}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${g.deadline}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${g.urgency}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${g.totalQty}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${g.progress}%</td>
                    </tr>
                `).join('')}
            </table>
        `;
    } else if (activeTab === 'inventory') {
        title = "BÁO CÁO KIỂM KÊ KHO THIẾT BỊ";
        tableHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:15px;">
                <tr style="background-color:#f1f5f9;">
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Khách Hàng</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Loại TB</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Model</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Tồn Kho</th>
                </tr>
                ${samplesInStock.map(s => `
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${s.client}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${s.type}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; font-weight:bold;">${s.model}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${s.qty}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    } else if (activeTab === 'personnel') {
        title = "DANH SÁCH NHÂN SỰ VẬN HÀNH";
        tableHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:15px;">
                <tr style="background-color:#f1f5f9;">
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Họ và Tên</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Chức Vụ</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Ca Làm Việc</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Trạng Thái Hiện Tại</th>
                </tr>
                ${personnel.map(p => `
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:8px; font-weight:bold;">${p.name}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${p.role}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${p.shift}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${p.status}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    } else if (activeTab === 'equipment') {
        title = "BÁO CÁO TRẠNG THÁI TRẠM MÁY";
        const eqStats = equipments.map(eq => {
           const { running, waiting } = getTestsForStation(eq.id);
           const operators = [...new Set(running.map(t => t.assignedUser).filter(Boolean))].join(', ');
           return { ...eq, runningCount: running.length, waitingCount: waiting.length, operators };
        });
        tableHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:15px;">
                <tr style="background-color:#f1f5f9;">
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Tên Trạm Máy</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Trạng Thái</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Đang Chạy</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">Chờ Xử Lý</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">KTV Vận Hành</th>
                </tr>
                ${eqStats.map(eq => `
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:8px; font-weight:bold;">${eq.name}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">
                            ${eq.runningCount > 0 ? '<span style="color:#10b981; font-weight:bold;">ĐANG VẬN HÀNH</span>' : '<span style="color:#64748b;">TRỐNG</span>'}
                        </td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${eq.runningCount}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${eq.waitingCount}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${eq.operators || '-'}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    }

    container.innerHTML = `
        <div style="font-family: Arial, sans-serif; background:white; color:black; padding:20px;">
            <h1 style="text-align:center; margin-bottom:5px; font-size:18px; color:#1e293b;">CÔNG TY / PHÒNG THÍ NGHIỆM PCCC</h1>
            <h2 style="text-align:center; font-size:14px; color:#334155; margin-top:0;">${title}</h2>
            <p style="text-align:right; font-size:10px; color:#64748b; margin-top:10px;">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}</p>
            ${tableHTML}
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `BaoCao_${activeTab}_${getLocalYYYYMMDD(new Date())}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(container).save();
  };

  const daysInPrintMonth = new Date(printYear, printMonth, 0).getDate();
  const printDaysArray = Array.from({length: daysInPrintMonth}, (_, i) => `${printYear}-${String(printMonth).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);

  useEffect(() => {
    const initAuth = async () => { 
        try { 
            await signInAnonymously(auth); 
        } catch (error) { 
            console.error("Lỗi xác thực hệ thống:", error); 
            setIsLoading(false); 
        } 
    };
    initAuth();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); 
      if (!currentUser) setIsLoading(false);
    });

    const safeTimer = setTimeout(() => {
        setIsLoading(false);
    }, 4000);

    return () => { unsubscribeAuth(); clearTimeout(safeTimer); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const errHandler = (err) => {
        console.warn("Lỗi đồng bộ Dữ liệu:", err.message);
        setIsLoading(false);
    };

    const unsubPersonnel = onSnapshot(getCol('personnel'), (snap) => setPersonnel(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), errHandler);
    const unsubEquipments = onSnapshot(getCol('equipments'), (snap) => {
       const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       const core = [ { id: 'TNL-K', name: 'Tunel Khói' }, { id: 'TNL-N', name: 'Tunel Nhiệt' }, { id: 'MR', name: 'Máy Rung' }, { id: 'TNA-N', name: 'Tủ Nóng ẩm cỡ nhỏ' }, { id: 'TNA-T', name: 'Tủ Nóng ẩm cỡ trung' }, { id: 'TSO2', name: 'Tủ SO2' }, { id: 'PAS', name: 'Phòng âm thanh + ánh sáng' } ];
       core.forEach(c => { if (!data.some(eq => eq.id === c.id)) setDoc(getDocument('equipments', c.id), c).catch(e => console.warn(e)); });
       setEquipments(data.sort((a, b) => { if(a.id==='TSO2') return -1; if(b.id==='TSO2') return 1; return (a.name||'').localeCompare(b.name||'','vi'); }));
    }, errHandler);
    const unsubSamples = onSnapshot(getCol('samplesInStock'), (snap) => setSamplesInStock(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), errHandler);
    const unsubOrders = onSnapshot(getCol('orders'), (snap) => { setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); }, errHandler);
    return () => { unsubPersonnel(); unsubSamples(); unsubEquipments(); unsubOrders(); };
  }, [user]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsUploading(true); setErrorMessage('');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let text = event.target.result; if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) throw new Error("File trống hoặc không hợp lệ.");
        const sep = rows[0].includes(';') ? ';' : (rows[0].includes('\t') ? '\t' : ',');
        const uploadPromises = []; const batchTimestamp = Date.now(); const clientReqIds = {}; 

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
          const client = cols[0] || 'Chưa có thông tin';
          if (!clientReqIds[client]) clientReqIds[client] = cols[6] || `${client.substring(0, 3).toUpperCase()}-KĐ-${batchTimestamp.toString().slice(-4)}`;
          const type = cols[1] || 'Thiết bị'; const model = cols[2] || `Model (${i})`; const qty = cols[3] || '1';
          const deadline = cols[4] || new Date().toLocaleDateString('vi-VN'); const urgency = cols[5] || 'Bình thường';
          const ts = Date.now() + i;
          uploadPromises.push(setDoc(getDocument('samplesInStock', `K${ts}`), { id: `K${ts}`, client, type, model, qty: parseInt(qty, 10) || 1, status: 'Kho chờ', date: new Date().toLocaleDateString('vi-VN') }));
          uploadPromises.push(setDoc(getDocument('orders', `O${ts}`), { id: `O${ts}`, reqId: clientReqIds[client], client, type, model, sampleSize: parseInt(qty, 10) || 1, deadline, urgency, tests: [] }));
        }
        await Promise.all(uploadPromises);
      } catch (error) { setErrorMessage("Lỗi xử lý file: " + error.message); } 
      finally { setIsUploading(false); e.target.value = null; }
    };
    reader.readAsText(file);
  };

  const handlePersonnelFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsUploadingPersonnel(true); setErrorMessage('');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let text = event.target.result; if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const sep = rows[0].includes(';') ? ';' : (rows[0].includes('\t') ? '\t' : ',');
        const uploadPromises = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
          const name = cols[0]; const role = cols[1] || 'KTV'; const shift = cols[2] || 'Hành Chính'; 
          if (!name) continue; 
          if (personnel.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())) continue;
          const id = `NV${Date.now() + i}`;
          uploadPromises.push(setDoc(getDocument('personnel', id), { id, name, role, shift, status: 'Đang làm', timesheet: {} }));
        }
        await Promise.all(uploadPromises); setShowAddPersonnel(false);
      } catch (error) { setErrorMessage("Lỗi: " + error.message); } 
      finally { setIsUploadingPersonnel(false); e.target.value = null; }
    };
    reader.readAsText(file);
  };

  const handleAddOrder = async () => {
    if (!newOrderData.client.trim() || !newOrderData.model.trim() || !user) return;
    const ts = Date.now();
    const reqId = `${newOrderData.client.substring(0, 3).toUpperCase()}-KĐ-${ts.toString().slice(-4)}`;
    const deadline = newOrderData.deadline ? new Date(newOrderData.deadline).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN');
    await setDoc(getDocument('orders', `O${ts}`), { id: `O${ts}`, reqId, client: newOrderData.client.trim(), type: newOrderData.type, model: newOrderData.model.trim(), sampleSize: parseInt(newOrderData.sampleSize) || 1, deadline, urgency: newOrderData.urgency, tests: [] });
    await setDoc(getDocument('samplesInStock', `K${ts}`), { id: `K${ts}`, client: newOrderData.client.trim(), type: newOrderData.type, model: newOrderData.model, qty: newOrderData.sampleSize, status: 'Kho chờ', date: new Date().toLocaleDateString('vi-VN') });
    setShowAddOrder(false); setNewOrderData({ client: '', type: 'Tủ trung tâm', model: '', sampleSize: 1, deadline: '', urgency: 'Mới' });
  };

  const handleAssignToStation = async (stationId) => {
    if(!selectedOrderIdToAssign || !user) return;
    const targetOrder = orders.find(o => o.id === selectedOrderIdToAssign); if(!targetOrder) return;
    const newTest = { name: 'Kiểm định', status: stationId === 'TSO2' ? 'Chờ chạy' : 'Đang chạy', equip: stationId, assignedUser: selectedPersonnelToAssign || 'Chưa phân công', startTime: new Date().toISOString() };
    await updateDoc(getDocument('orders', targetOrder.id), { tests: [...(targetOrder.tests || []), newTest] });
    setAssigningStation(null); setSelectedOrderIdToAssign(''); setSelectedPersonnelToAssign('');
  };

  const getTestsForStation = (stationId) => {
    const waiting = []; const running = []; const history = [];
    orders.forEach(order => {
      (order.tests || []).forEach((test, index) => {
        if (!test || test.equip !== stationId) return; 
        const testData = { ...test, orderId: order.id, reqId: order.reqId, model: order.model, sampleSize: order.sampleSize, testIndex: index, client: order.client };
        if (test.status === 'Chờ chạy') waiting.push(testData);
        else if (test.status === 'Đang chạy') running.push(testData);
        else if (test.status === 'Xong') history.push(testData);
      });
    });
    return { waiting, running, history };
  };

  const markTestAsDone = async (orderId, testIndex) => {
    const targetOrder = orders.find(o => o.id === orderId); if(!targetOrder) return;
    const updatedTests = [...targetOrder.tests];
    updatedTests[testIndex].status = 'Xong'; updatedTests[testIndex].endTime = new Date().toISOString();
    await updateDoc(getDocument('orders', orderId), { tests: updatedTests });
  };

  const changeGroupUrgency = async (groupId, newUrgency) => {
    if (!canEditData) return;
    const group = groupedOrdersArr.find(g => g.groupId === groupId); if (!group) return;
    await Promise.all(group.items.map(item => updateDoc(getDocument('orders', item.id), { urgency: newUrgency })));
  };

  const handleRemoveTest = async (orderId, testIndex) => {
    if (!canEditData) return;
    if (!window.confirm("Gỡ thiết bị khỏi trạm?")) return;
    const targetOrder = orders.find(o => o.id === orderId);
    const updatedTests = [...targetOrder.tests]; updatedTests.splice(testIndex, 1); 
    await updateDoc(getDocument('orders', orderId), { tests: updatedTests });
  };

  const changePersonnelStatus = async (id, newStatus) => {
    const p = personnel.find(x => x.id === id);
    const timesheet = { ...(p?.timesheet || {}) };
    timesheet[todayStr] = { ...(timesheet[todayStr] || {}), status: newStatus };
    await updateDoc(getDocument('personnel', id), { status: newStatus, timesheet });
  };

  const updatePersonnelNote = async (id, note) => {
    const p = personnel.find(x => x.id === id);
    const timesheet = { ...(p?.timesheet || {}) };
    timesheet[todayStr] = { ...(timesheet[todayStr] || {}), note };
    await updateDoc(getDocument('personnel', id), { timesheet });
  };

  const handleAddPersonnel = async () => {
    if (!newPersonnel.name) return; const id = 'NV' + Date.now();
    await setDoc(getDocument('personnel', id), { id, name: newPersonnel.name, role: newPersonnel.role, shift: newPersonnel.shift, status: 'Đang làm', timesheet: {} });
    setShowAddPersonnel(false); setNewPersonnel({ name: '', role: 'KTV', shift: 'Hành Chính' });
  };

  const handleDeletePersonnel = async (id) => {
    if (!user) return;
    await deleteDoc(getDocument('personnel', id));
    setConfirmDeletePersonnelId(null);
  };

  const handleSaveEditPersonnel = async (id) => {
    if (!user) return;
    await updateDoc(getDocument('personnel', id), { name: editPersonnelData.name, role: editPersonnelData.role, shift: editPersonnelData.shift });
    setEditingPersonnelId(null);
  };

  const handleDeleteSample = async (id) => {
    if (!user) return;
    await deleteDoc(getDocument('samplesInStock', id));
    setConfirmDeleteSampleId(null);
  };

  const handleSaveEditSample = async (id) => {
    if (!user) return;
    await updateDoc(getDocument('samplesInStock', id), { 
      client: editSampleData.client, type: editSampleData.type, model: editSampleData.model, qty: parseInt(editSampleData.qty, 10) || 1 
    });
    setEditingSampleId(null);
  };

  const handleAddStation = async () => {
    if (!newStationName.trim() || !user || userRole !== 'ADMIN') return;
    const id = 'TR' + Date.now();
    await setDoc(getDocument('equipments', id), { id, name: newStationName.trim() });
    setNewStationName('');
  };

  const handleDeleteStation = async (id, name) => {
    if (userRole !== 'ADMIN') return;
    if (!window.confirm(`Bạn có chắc muốn xóa trạm máy "${name}" không? \nCảnh báo: Các đơn hàng đang chạy trong trạm này có thể bị mất trạng thái hiển thị!`)) return;
    await deleteDoc(getDocument('equipments', id));
  };

  const toggleShift = () => setCurrentShift(prev => prev === 'Ngày' ? 'Đêm' : 'Ngày');

  // HIỆU CHỈNH: Tính năng đếm nhân sự và lọc KTV Vận Hành
  const activeStaff = useMemo(() => personnel.filter(p => p.status === 'Đang làm' || p.status === 'Làm việc' || p.status === 'Part-time').sort((a, b) => getRoleWeight(a.role) - getRoleWeight(b.role) || (a.name||'').localeCompare(b.name||'','vi')), [personnel]);
  const activePersonnel = useMemo(() => personnel.filter(p => p.status !== 'Đã nghỉ việc').sort((a, b) => getRoleWeight(a.role) - getRoleWeight(b.role) || (a.name||'').localeCompare(b.name||'','vi')), [personnel]);
  
  const operatorStaff = useMemo(() => activeStaff.filter(p => {
     const r = String(p.role).toLowerCase();
     return !r.includes('hành chính') && !r.includes('thư ký') && !r.includes('quản lý') && !r.includes('kế toán');
  }), [activeStaff]);

  const { countHC, countNgay, countDem } = useMemo(() => {
    let hc = 0, ngay = 0, dem = 0;
    activeStaff.forEach(p => {
       const s = String(p.shift || '').toLowerCase();
       if (s.includes('hành chính') || s === 'hc') hc++; else if (s.includes('đêm')) dem++; else ngay++; 
    });
    return { countHC: hc, countNgay: ngay, countDem: dem };
  }, [activeStaff]);

  const staffLocations = useMemo(() => {
    const locs = {};
    orders.forEach(o => o.tests?.forEach(t => {
      if (t?.status === 'Đang chạy' && t.assignedUser && t.assignedUser !== 'Chưa phân công') {
        if (!locs[t.assignedUser]) locs[t.assignedUser] = new Set();
        locs[t.assignedUser].add(equipments.find(e => e.id === t.equip)?.name || t.equip);
      }
    }));
    return locs;
  }, [orders, equipments]);

  // LOGIC ĐẶC QUYỀN CHỦ NHẬT (TỰ ĐỘNG TÍNH LÀ NGHỈ NẾU KHÔNG CÓ TRẠNG THÁI LÀM VIỆC CỤ THỂ TRONG NGÀY)
  const dashboardStaff = useMemo(() => activeStaff.filter(p => {
     const timesheetToday = p.timesheet?.[todayStr]?.status;
     if (isTodaySunday) {
         // Chủ nhật: Chỉ hiện trên Dashboard nếu có chấm công 'Đang làm' hoặc có thao tác đứng máy
         return timesheetToday === 'Đang làm' || timesheetToday === 'Làm việc' || timesheetToday === 'Part-time' || (staffLocations[p.name] && staffLocations[p.name].size > 0);
     }
     const s = String(p.shift || 'Hành Chính').toLowerCase();
     const isDayPerson = s.includes('hành chính') || s === 'hc' || s.includes('ngày') || s.includes('part');
     return currentShift === 'Ngày' ? isDayPerson : (!isDayPerson || (staffLocations[p.name] && staffLocations[p.name].size > 0));
  }), [activeStaff, currentShift, staffLocations, todayStr, isTodaySunday]);

  const overdueGroups = useMemo(() => groupedOrdersArr.filter(g => g.urgency === 'Quá hạn'), [groupedOrdersArr]);
  const urgentGroupsOnly = useMemo(() => groupedOrdersArr.filter(g => g.urgency === 'Gấp'), [groupedOrdersArr]);
  const runningGroups = useMemo(() => groupedOrdersArr.filter(g => g.items.some(item => item.tests?.some(t => t?.status === 'Đang chạy'))), [groupedOrdersArr]);

  useEffect(() => {
      if (showAttendanceCalendar && attendanceMode === 'date') {
          const batch = {};
          activePersonnel.forEach(p => {
              const status = p.timesheet?.[selectedAttendanceDate]?.status;
              const note = p.timesheet?.[selectedAttendanceDate]?.note;
              if (status === 'Đang làm' || status === 'Làm việc') batch[p.id] = 'V';
              else if (status === 'Nghỉ phép' || status === 'Nghỉ' || status === 'Vắng mặt') batch[p.id] = 'X';
              else if (status === 'Part-time') batch[p.id] = `P-${note?.match(/(\d+)/)?.[1] || '4'}`;
              else batch[p.id] = ''; 
          });
          setAttendanceBatchData(batch);
      } else if (showAttendanceCalendar && attendanceMode === 'person') setPersonBatchData({});
  }, [showAttendanceCalendar, selectedAttendanceDate, attendanceMode, selectedAttendanceStaffId, activePersonnel]);

  const handleMarkStaff = (staffId, mark) => {
      setAttendanceBatchData(prev => {
          const isSameMark = prev[staffId] === mark;
          const newMark = isSameMark && !mark.startsWith('P') ? '' : mark;
          return { ...prev, [staffId]: newMark };
      });
  };

  const handleTogglePersonDay = (dateStr) => {
      if (!selectedAttendanceStaffId) return;
      const staff = activePersonnel.find(p => p.id === selectedAttendanceStaffId);
      let currentMark = personBatchData[dateStr];
      if (currentMark === undefined) {
          const st = staff?.timesheet?.[dateStr]?.status;
          const nt = staff?.timesheet?.[dateStr]?.note;
          if (st === 'Đang làm' || st === 'Làm việc') currentMark = 'V';
          else if (st === 'Nghỉ phép' || st === 'Nghỉ' || st === 'Vắng mặt') currentMark = 'X';
          else if (st === 'Part-time') currentMark = `P-${nt?.match(/(\d+)/)?.[1] || '4'}`;
          else currentMark = '';
      }
      let nextStatus = currentMark === '' ? 'V' : currentMark === 'V' ? 'X' : currentMark === 'X' ? 'P-4' : (currentMark.startsWith('P') ? '' : '');
      setPersonBatchData(prev => ({ ...prev, [dateStr]: nextStatus }));
  };

  const handleSaveBatchAttendance = async () => {
      if (!user) return;
      try {
          const promises = activePersonnel.map(p => {
              const mark = attendanceBatchData[p.id];
              if (mark === undefined) return Promise.resolve();
              let newStatus = '';
              let newNote = p.timesheet?.[selectedAttendanceDate]?.note || '';
              if (mark === 'V') newStatus = 'Đang làm';
              else if (mark === 'X') newStatus = 'Nghỉ phép';
              else if (mark.startsWith('P')) { newStatus = 'Part-time'; newNote = `Làm ${mark.split('-')[1]} tiếng`; }
              
              const currentTimesheet = { ...(p.timesheet || {}) };
              if (newStatus === '') delete currentTimesheet[selectedAttendanceDate];
              else currentTimesheet[selectedAttendanceDate] = { ...(currentTimesheet[selectedAttendanceDate] || {}), status: newStatus, ...(mark.startsWith('P') && { note: newNote }) };
              return updateDoc(getDocument('personnel', p.id), { timesheet: currentTimesheet });
          });
          await Promise.all(promises); alert("Đã lưu lịch chấm công thành công!");
          setShowAttendanceCalendar(false); setPinnedTooltip(null);
      } catch (error) { console.error(error); alert("Có lỗi xảy ra khi lưu chấm công!"); }
  };

  const handleSavePersonAttendance = async () => {
      if (!user || !selectedAttendanceStaffId) return;
      try {
          const staff = activePersonnel.find(p => p.id === selectedAttendanceStaffId);
          const currentTimesheet = { ...(staff.timesheet || {}) };
          let hasChanges = false;
          Object.keys(personBatchData).forEach(dateStr => {
              const mark = personBatchData[dateStr];
              if (mark === 'V') { currentTimesheet[dateStr] = { ...(currentTimesheet[dateStr] || {}), status: 'Đang làm' }; hasChanges = true; } 
              else if (mark === 'X') { currentTimesheet[dateStr] = { ...(currentTimesheet[dateStr] || {}), status: 'Nghỉ phép' }; hasChanges = true; } 
              else if (mark.startsWith('P')) { currentTimesheet[dateStr] = { ...(currentTimesheet[dateStr] || {}), status: 'Part-time', note: `Làm ${mark.split('-')[1] || '4'} tiếng` }; hasChanges = true; } 
              else if (mark === '') { delete currentTimesheet[dateStr]; hasChanges = true; }
          });
          if (!hasChanges) { alert("Không có thay đổi nào để lưu!"); return; }
          await updateDoc(getDocument('personnel', staff.id), { timesheet: currentTimesheet });
          alert(`Đã lưu toàn bộ các ngày cho nhân sự ${staff.name}!`); setPersonBatchData({});
      } catch (error) { console.error(error); alert("Có lỗi xảy ra khi lưu chấm công!"); }
  };

  // =========================================================================
  // 💻 MÀN HÌNH ĐĂNG NHẬP GIAO DIỆN HACKER / KỸ THUẬT
  // =========================================================================
  if (!userRole) {
    return (
      <div className="min-h-screen bg-[#050b14] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:30px_30px]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="bg-[#0b1221]/90 backdrop-blur-md border border-cyan-900/50 p-10 rounded-lg shadow-[0_0_40px_rgba(6,182,212,0.15)] max-w-md w-full text-center relative z-10">
           <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
           <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
           <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
           <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>

           <div className="bg-[#050b14] border border-cyan-800 w-24 h-24 rounded-lg flex items-center justify-center mx-auto mb-6 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
             <Crosshair size={48} className="text-cyan-400" />
           </div>
           <h1 className="text-3xl font-black text-cyan-50 mb-1 tracking-[0.1em] font-mono">PTN-PCCC</h1>
           <p className="text-xs font-semibold text-cyan-600 mb-8 uppercase tracking-[0.2em] font-mono">Hệ Thống Trạm Chỉ Huy</p>
           
           <div className="space-y-5">
             <div className="relative">
               <KeyRound size={20} className="absolute left-4 top-4 text-cyan-700"/>
               <input 
                  type="password" 
                  placeholder="NHẬP MÃ XÁC THỰC" 
                  value={loginPassword} 
                  onChange={e => {setLoginPassword(e.target.value); setShowLoginError(false);}} 
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-[#050b14] border border-cyan-900/50 text-cyan-400 placeholder-cyan-900/50 pl-12 pr-4 py-4 rounded-md text-center text-xl tracking-[0.5em] focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] outline-none transition font-mono"
               />
             </div>
             {showLoginError && <p className="text-rose-500 text-xs font-bold animate-pulse bg-rose-950/30 py-2 rounded border border-rose-900 font-mono">TỪ CHỐI TRUY CẬP. MÃ KHÔNG HỢP LỆ.</p>}
             <button onClick={handleLogin} className="w-full bg-cyan-600/10 border border-cyan-500/50 text-cyan-400 font-bold py-4 rounded-md hover:bg-cyan-500 hover:text-slate-900 transition-all duration-300 flex items-center justify-center gap-2 font-mono tracking-widest hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                XÁC THỰC <ChevronRight size={18}/>
             </button>
           </div>
        </div>
        <p className="text-[10px] text-cyan-900 mt-8 relative z-10 font-mono tracking-widest">
           QUẢN TRỊ VIÊN: 9299 | QUẢN LÝ: 6789 | KIỂM THỬ: 3333
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050b14]">
        <Loader2 size={40} className="text-cyan-500 animate-spin mb-4" />
        <p className="text-cyan-600 font-mono tracking-[0.2em] uppercase text-xs animate-pulse">Đang kết nối đến CSDL PCCC...</p>
      </div>
    );
  }

  // =========================================================================
  // 💻 MAIN LAYOUT CHUYÊN NGHIỆP CÔNG NGHỆ CAO
  // =========================================================================
  const renderMonthlyPrintContent = () => {
    let tableRows = activePersonnel.map((p, index) => {
        let totalCong = 0; const notes = [];
        const cells = printDaysArray.map(dateStr => {
            const dayData = p.timesheet?.[dateStr];
            const status = dayData?.status;
            let mark = '';
            // TỰ ĐỘNG CHẤM CÔNG CHỦ NHẬT KHI LÊN PDF
            if (status === 'Đang làm' || status === 'Làm việc') { 
                mark = isSundayStr(dateStr) ? 'TC' : 'X'; 
                totalCong += 1; 
            } 
            else if (status === 'Nghỉ phép' || status === 'Nghỉ') mark = 'P';
            else if (status === 'Part-time') { mark = 'Ca'; totalCong += 0.5; }
            else if (status === 'Vắng mặt' || status === 'Nghỉ không phép') mark = 'V';
            else if (isSundayStr(dateStr)) mark = '-'; // Mặc định Chủ Nhật là nghỉ
            
            if (dayData?.note) notes.push(`Ngày ${dateStr.split('-')[2]}: ${dayData.note}`);
            
            let cellColor = isSundayStr(dateStr) ? 'background-color:#f8fafc;' : '';
            if (mark === 'TC') cellColor += 'color:#10b981;'; // Bôi xanh nếu tăng ca Chủ nhật
            return `<td style="border:1px solid #000; padding:2px; text-align:center; font-weight:bold; ${cellColor}">${mark}</td>`;
        }).join('');
        return `
            <tr>
                <td style="border:1px solid #000; padding:2px; text-align:center;">${index + 1}</td>
                <td style="border:1px solid #000; padding:2px; font-weight:bold;">${p.name}</td>
                <td style="border:1px solid #000; padding:2px; text-align:center; font-size:9px;">${p.role}</td>
                ${cells}
                <td style="border:1px solid #000; padding:2px; text-align:center; font-weight:bold;">${totalCong}</td>
                <td style="border:1px solid #000; padding:2px; font-size:8px;">${notes.join('; ')}</td>
            </tr>
        `;
    }).join('');

    const daysHeaders = printDaysArray.map((_, i) => {
        const isSun = isSundayStr(printDaysArray[i]);
        return `<th style="border:1px solid #000; padding:2px; width:15px; ${isSun ? 'background-color:#fee2e2; color:#be123c;' : ''}">${i + 1}</th>`;
    }).join('');

    return `
        <div style="font-family: Arial, sans-serif; background:white; color:black; padding:20px;">
            <h1 style="text-align:center; font-size:18px; margin-bottom:5px;">CÔNG TY / PHÒNG THÍ NGHIỆM PCCC</h1>
            <h2 style="text-align:center; font-size:14px; margin-top:0;">BẢNG CHẤM CÔNG THÁNG ${printMonth}/${printYear}</h2>
            <p style="font-size:10px; font-style:italic; text-align:right;">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</p>
            <table style="width:100%; border-collapse:collapse; font-size:10px; margin-top:10px;">
                <tr style="background-color:#f0f0f0;">
                    <th style="border:1px solid #000; padding:2px; width:20px;">STT</th>
                    <th style="border:1px solid #000; padding:2px; text-align:left;">Họ và Tên</th>
                    <th style="border:1px solid #000; padding:2px; width:50px;">Chức vụ</th>
                    ${daysHeaders}
                    <th style="border:1px solid #000; padding:2px; width:30px;">Tổng</th>
                    <th style="border:1px solid #000; padding:2px; width:80px;">Ghi chú</th>
                </tr>
                ${tableRows}
            </table>
            <div style="margin-top:15px; font-size:9px; font-style:italic;">* Ký hiệu: X (Đi làm/Hành chính) | TC (Tăng ca CN) | Ca (Part-time) | P (Nghỉ phép) | V (Vắng mặt) | - (Nghỉ CN)</div>
            <div style="display:flex; justify-content:space-around; margin-top:30px;">
                <div style="text-align:center;"><p style="font-weight:bold; font-size:12px; margin-bottom:40px;">Người lập bảng</p><p style="font-size:10px;">(Ký và ghi rõ họ tên)</p></div>
                <div style="text-align:center;"><p style="font-weight:bold; font-size:12px; margin-bottom:40px;">Quản lý / Giám đốc</p><p style="font-size:10px;">(Ký và ghi rõ họ tên)</p></div>
            </div>
        </div>
    `;
  };

  const handleMonthlyPrintHtml2Pdf = () => {
    if (!window.html2pdf) { 
        window.print();
        setIsPrintingMonthly(false);
        setShowPrintModal(false);
        return; 
    }
    
    setIsPrintingMonthly(true);
    const container = document.createElement('div');
    container.innerHTML = renderMonthlyPrintContent();

    const opt = {
        margin:       5,
        filename:     `BangChamCong_T${printMonth}_${printYear}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    window.html2pdf().set(opt).from(container).save().then(() => {
        setIsPrintingMonthly(false);
        setShowPrintModal(false);
    });
  };

  return (
    <>
    <style dangerouslySetInnerHTML={{__html: `
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: #050b14; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #164e63; border-radius: 4px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #0891b2; }
      @media print {
        @page { size: landscape; margin: 10mm; }
        body, main, div { background: white !important; color: black !important; border-color: #ccc !important; box-shadow: none !important; text-shadow: none !important; }
        .print\\:hidden { display: none !important; }
        .print\\:block { display: block !important; }
        .print\\:text-black { color: black !important; }
        .print\\:border-black { border-color: black !important; }
        * { color: black !important; }
      }
    `}} />

    {/* MODAL CẤU HÌNH IN PDF THÁNG */}
    {showPrintModal && (
        <div className="fixed inset-0 bg-[#050b14]/90 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0b1221] border border-cyan-800 p-6 rounded-md shadow-[0_0_20px_rgba(6,182,212,0.2)] w-full max-w-sm">
                <h2 className="text-cyan-400 font-bold font-mono mb-4 text-center tracking-widest">CẤU_HÌNH_XUẤT_PDF</h2>
                <div className="flex gap-4 mb-6">
                <select value={printMonth} onChange={e=>setPrintMonth(e.target.value)} className="flex-1 bg-[#050b14] border border-cyan-900 text-cyan-300 p-2 rounded outline-none font-mono">
                    {[...Array(12)].map((_, i) => <option key={i} value={i+1}>THÁNG {i+1}</option>)}
                </select>
                <select value={printYear} onChange={e=>setPrintYear(e.target.value)} className="flex-1 bg-[#050b14] border border-cyan-900 text-cyan-300 p-2 rounded outline-none font-mono">
                    {[2024,2025,2026,2027].map(y => <option key={y} value={y}>NĂM {y}</option>)}
                </select>
                </div>
                <div className="flex justify-end gap-2 font-mono text-xs">
                <button onClick={()=>setShowPrintModal(false)} className="px-4 py-2 bg-slate-800 text-slate-400 rounded hover:bg-slate-700">HỦY</button>
                <button onClick={handleMonthlyPrintHtml2Pdf} className="px-4 py-2 bg-cyan-600 text-slate-900 font-bold rounded hover:bg-cyan-500 flex gap-2 items-center">
                    {isPrintingMonthly ? <Loader2 className="animate-spin" size={14}/> : <Printer size={14}/>} XUẤT_BẢNG
                </button>
                </div>
            </div>
        </div>
    )}

    {/* BẢNG CHẤM CÔNG THÁNG (CHỈ HIỆN KHI IN THÔNG THƯỜNG) */}
    <div className={`hidden ${isPrintingMonthly ? 'print:block' : ''} bg-white w-full text-black font-sans`} dangerouslySetInnerHTML={{ __html: renderMonthlyPrintContent() }}></div>

    <div className={`flex h-screen w-full bg-[#050b14] font-sans overflow-hidden text-slate-300 selection:bg-cyan-900 selection:text-cyan-100 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:40px_40px] ${isPrintingMonthly ? 'print:hidden' : ''}`}>
      
      {/* 💻 SIDEBAR KỸ THUẬT */}
      <aside className="hidden md:flex flex-col w-60 bg-[#0b1221]/90 backdrop-blur-md z-20 border-r border-cyan-900/50 transition-all duration-300 shadow-[5px_0_25px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-cyan-900/50 flex items-center gap-4 bg-[#050b14]/50 relative">
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
          <div className="bg-cyan-950/50 border border-cyan-700/50 text-cyan-400 p-2.5 rounded shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <Cpu size={26} />
          </div>
          <div>
             <h1 className="text-xl font-black text-slate-100 tracking-wider font-mono">PTN-PCCC</h1>
             <p className="text-[9px] text-cyan-500 font-bold uppercase mt-1 tracking-[0.2em]">Trung Tâm Chỉ Huy</p>
          </div>
        </div>
        
        <div className="px-4 py-6">
           <p className="text-[10px] font-bold text-cyan-800 uppercase tracking-[0.2em] mb-4 pl-2 font-mono">Các Phân Hệ</p>
           <nav className="space-y-2">
             {navItems.map(item => {
               const Icon = item.icon; const isActive = activeTab === item.id;
               return (
                 <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 font-bold text-xs tracking-wider font-mono ${isActive ? 'bg-cyan-900/30 border-l-4 border-cyan-400 text-cyan-300 shadow-[inset_20px_0_20px_-20px_rgba(6,182,212,0.3)]' : 'border-l-4 border-transparent text-slate-500 hover:bg-[#050b14] hover:text-slate-300 hover:border-slate-700'}`}>
                   <Icon size={16} className={isActive ? 'text-cyan-400' : 'text-slate-600'} />{item.label}
                 </button>
               )
             })}
           </nav>
        </div>

        <div className="mt-auto p-4 border-t border-cyan-900/50 bg-[#050b14]/50">
           <div className="flex items-center justify-between bg-[#0b1221] border border-cyan-900/50 p-3 rounded-md">
             <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded flex items-center justify-center text-xs font-black text-slate-900 border ${userRole === 'ADMIN' ? 'bg-rose-500 border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : userRole === 'USER' ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-emerald-500 border-emerald-400'}`}>
                   {userRole === 'ADMIN' ? 'AD' : userRole === 'USER' ? 'US' : 'TE'}
                </div>
                <div className="flex flex-col text-left font-mono">
                   <span className="text-xs font-bold text-slate-200">{userRole === 'ADMIN' ? 'QUẢN TRỊ VIÊN' : userRole === 'USER' ? 'QUẢN LÝ' : 'KIỂM THỬ'}</span>
                   <span className="text-[9px] text-cyan-500 flex items-center gap-1 tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_5px_#22d3ee]"></span> TRỰC TUYẾN</span>
                </div>
             </div>
             <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition" title="Đăng xuất"><LogOut size={16}/></button>
           </div>
        </div>
      </aside>

      {/* 📱 KHU VỰC MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        
        {/* HEADER CÔNG NGHỆ */}
        <header className="bg-[#0b1221]/80 backdrop-blur-md text-slate-200 h-16 px-6 lg:px-8 border-b border-cyan-900/50 z-10 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold tracking-widest text-cyan-50 capitalize hidden md:block font-mono">
               {navItems.find(i => i.id === activeTab)?.label}
             </h2>
             <div className="md:hidden flex flex-col font-mono">
                <h1 className="text-sm font-black text-cyan-500 tracking-widest">PTN-PCCC</h1>
                <span className="text-[9px] font-bold text-slate-500 uppercase">{navItems.find(i => i.id === activeTab)?.label}</span>
             </div>
          </div>
          
          <div className="flex items-center gap-4 lg:gap-6 font-mono">
             <div className="h-6 w-px bg-cyan-900/50 hidden md:block"></div>
             <div className="flex flex-col text-right">
                <div className="text-sm font-black text-cyan-400">{currentTime.toLocaleTimeString('vi-VN')}</div>
                <div className="text-[9px] text-cyan-700 uppercase font-bold tracking-[0.2em]">{currentTime.toLocaleDateString('vi-VN')}</div>
             </div>
             <div className="flex items-center gap-2 bg-[#050b14] px-3 py-1.5 rounded border border-cyan-900/50 shadow-inner cursor-pointer hover:border-cyan-500/50 transition" onClick={toggleShift}>
                {currentShift === 'Ngày' ? <Sun size={14} className="text-amber-500"/> : <Moon size={14} className="text-indigo-400"/>}
                <span className="text-xs font-bold text-slate-300 hidden sm:block tracking-wider">CA LÀM: {currentShift.toUpperCase()}</span>
             </div>
             <button onClick={handleLogout} className="md:hidden p-1.5 bg-[#050b14] border border-cyan-900 text-rose-500 rounded"><LogOut size={16}/></button>
          </div>
        </header>

        {/* NỘI DUNG CHÍNH */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8 scroll-smooth">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div onClick={() => {setOrderModalFilter('Quá hạn'); setShowOrderModal(true);}} className="cursor-pointer bg-[#0b1221] p-6 rounded-md border border-rose-900 hover:border-rose-500/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.2)] transition-all flex flex-col justify-center items-center text-center relative overflow-hidden h-full group">
                       <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-rose-500/50"></div>
                       <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-rose-500/50"></div>
                       <AlertTriangle size={32} className="mb-2 text-rose-500/80 group-hover:text-rose-400 transition-colors" />
                       <span className="font-mono font-black text-5xl text-rose-500">{overdueGroups.length}</span>
                       <span className="text-xs font-bold mt-2 uppercase tracking-[0.2em] text-rose-200/60">Quá Hạn</span>
                    </div>
                    <div onClick={() => {setOrderModalFilter('Gấp'); setShowOrderModal(true);}} className="cursor-pointer bg-[#0b1221] p-6 rounded-md border border-amber-900/80 hover:border-amber-500/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all flex flex-col justify-center items-center text-center h-full relative group">
                       <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-amber-500/50"></div>
                       <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-amber-500/50"></div>
                       <span className="font-mono font-black text-5xl text-amber-500">{urgentGroupsOnly.length}</span>
                       <span className="text-xs font-bold mt-2 mb-2 uppercase tracking-[0.2em] text-amber-200/60">Đơn Gấp</span>
                       {urgentGroupsOnly.length > 0 ? (<div className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/30 font-mono w-full truncate">MỤC TIÊU: {urgentGroupsOnly[0].client}</div>) : (<div className="text-[9px] font-mono text-slate-600">TRỐNG</div>)}
                    </div>
                    <div onClick={() => {setOrderModalFilter('Đang chạy'); setShowOrderModal(true);}} className="cursor-pointer bg-[#0b1221] p-6 rounded-md border border-emerald-900/80 hover:border-emerald-500/80 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all flex flex-col justify-center items-center text-center h-full relative group">
                       <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-emerald-500/50"></div>
                       <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-emerald-500/50"></div>
                       <Activity size={32} className="mb-2 text-emerald-500/80 group-hover:text-emerald-400 group-hover:animate-pulse transition-colors" />
                       <span className="font-mono font-black text-5xl text-emerald-500">{runningGroups.length}</span>
                       <span className="text-xs font-bold mt-2 uppercase tracking-[0.2em] text-emerald-200/60">Đang Chạy</span>
                    </div>
                 </div>
                 <div onClick={() => { setIsOrderDetailsExpanded(true); document.getElementById('details-section')?.scrollIntoView({behavior: 'smooth'}); }} className="cursor-pointer bg-[#0b1221] p-8 rounded-md border border-cyan-800 shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all flex flex-col justify-center items-center text-center h-full min-h-[200px] group relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-cyan-900/30 rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-cyan-800/40 rounded-full border-dashed group-hover:animate-[spin_10s_linear_infinite]"></div>
                    <Database size={40} className="mb-2 text-cyan-500 z-10 group-hover:text-cyan-300 transition-colors drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]"/>
                    <span className="font-mono font-black text-6xl text-cyan-50 z-10 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">{groupedOrdersArr.length}</span>
                    <span className="text-[10px] font-bold mt-2 uppercase tracking-[0.3em] text-cyan-500 z-10">Tổng Dữ Liệu</span>
                 </div>
              </div>

              <div id="details-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                 <div className="bg-[#0b1221] rounded-md border border-slate-800 overflow-hidden h-fit flex flex-col">
                    <button onClick={() => setIsOrderDetailsExpanded(!isOrderDetailsExpanded)} className="w-full bg-[#050b14] px-5 py-4 border-b border-slate-800 flex justify-between items-center focus:outline-none hover:bg-cyan-950/20 transition-colors">
                       <div className="flex items-center gap-3"><Archive size={16} className="text-cyan-500"/><h3 className="font-bold text-sm text-slate-300 font-mono tracking-wider">CHI_TIẾT_DỰ_ÁN ({groupedOrdersArr.length})</h3></div>
                       {isOrderDetailsExpanded ? <ChevronUp size={16} className="text-cyan-700"/> : <ChevronDown size={16} className="text-cyan-700"/>}
                    </button>
                    {isOrderDetailsExpanded && (
                      <div className="p-4 space-y-3 bg-[#0b1221] max-h-[500px] overflow-y-auto custom-scrollbar">
                         {groupedOrdersArr.length === 0 && <p className="text-xs font-mono text-slate-600 text-center py-4">KHÔNG CÓ DỮ LIỆU.</p>}
                         {groupedOrdersArr.map(group => {
                            const typeCounts = {};
                            group.items.forEach(item => { const cat = categorizeDevice(item.type); typeCounts[cat] = (typeCounts[cat] || 0) + (item.sampleSize || 1); });
                            return (
                               <div key={group.groupId} className="border border-slate-800 rounded bg-[#050b14]/50 p-4 transition hover:border-cyan-800 hover:bg-cyan-950/10">
                                  <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
                                     <div className="font-bold text-sm text-cyan-100 truncate pr-2">{group.client}</div>
                                     <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded font-mono tracking-wider">{group.reqId}</div>
                                        {canEditData ? (
                                           <select value={group.urgency} onChange={(e) => changeGroupUrgency(group.groupId, e.target.value)} className={`text-[9px] font-bold px-2 py-0.5 rounded border outline-none cursor-pointer uppercase font-mono ${group.urgency === 'Gấp' || group.urgency === 'Quá hạn' ? 'bg-rose-950/50 text-rose-400 border-rose-800' : 'bg-[#050b14] text-slate-400 border-slate-700 hover:border-cyan-600'}`}>
                                              <option value="Mới">Mới</option><option value="Bình thường">Bình thường</option><option value="Gấp">Gấp</option><option value="Quá hạn">Quá hạn</option>
                                           </select>
                                        ) : (<div className="text-[9px] font-bold px-2 py-0.5 rounded border bg-slate-900 text-slate-500 font-mono uppercase">{group.urgency}</div>)}
                                     </div>
                                  </div>
                                  <div className="text-xs space-y-2">
                                     <div className="font-semibold text-slate-500 font-mono">TỔNG_SL: <span className="text-cyan-400 text-sm font-black">{group.totalQty}</span></div>
                                     <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono">
                                        {Object.entries(typeCounts).map(([typeName, qty]) => (<div key={typeName} className="bg-slate-900/80 px-2 py-1 rounded border border-slate-800 flex items-center gap-2"><span>{typeName}</span><span className="font-black text-cyan-300">{qty}</span></div>))}
                                     </div>
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                    )}
                 </div>

                 <div className="bg-[#0b1221] rounded-md border border-slate-800 overflow-hidden h-fit flex flex-col">
                    <button onClick={() => setIsPersonnelExpanded(!isPersonnelExpanded)} className="w-full bg-[#050b14] px-5 py-4 border-b border-slate-800 flex flex-col items-start gap-1 focus:outline-none hover:bg-cyan-950/20 transition-colors">
                       <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-3">
                             <Users size={16} className="text-emerald-500"/>
                             <div className="flex flex-col text-left">
                                <h3 className="font-bold text-sm text-slate-300 font-mono tracking-wider">NHÂN_SỰ_ĐANG_TRỰC ({dashboardStaff.length})</h3>
                                <span className="text-[9px] text-cyan-600 font-mono mt-0.5 tracking-widest">
                                    HC:{countHC} | NGÀY:{countNgay} | ĐÊM:{countDem}
                                </span>
                             </div>
                          </div>
                          {isPersonnelExpanded ? <ChevronUp size={16} className="text-cyan-700"/> : <ChevronDown size={16} className="text-cyan-700"/>}
                       </div>
                    </button>
                    {isPersonnelExpanded && (
                      <div className="p-4 max-h-[500px] overflow-y-auto space-y-2 bg-[#0b1221] custom-scrollbar">
                         {dashboardStaff.length === 0 && <p className="text-xs font-mono text-slate-600 text-center py-4">{isTodaySunday ? "CHỦ NHẬT KHÔNG CÓ AI TRỰC (TRỪ KHI TĂNG CA)." : "KHÔNG CÓ NHÂN SỰ TRỰC CA NÀY."}</p>}
                         {dashboardStaff.map(p => {
                            const locs = staffLocations[p.name]; const hasMachine = locs && locs.size > 0;
                            const isLeave = p.timesheet?.[todayStr]?.status === 'Nghỉ phép';
                            const isPartTime = p.timesheet?.[todayStr]?.status === 'Part-time';
                            const ptNote = p.timesheet?.[todayStr]?.note;
                            
                            return (
                               <div key={p.id} className="flex items-center justify-between bg-[#050b14]/80 p-3 rounded border border-slate-800 hover:border-cyan-900 transition-colors">
                                  <div className="flex items-center gap-3">
                                     <div className="bg-slate-900 border border-slate-700 p-1.5 rounded"><Briefcase size={14} className="text-cyan-600"/></div>
                                     <div>
                                        <div className="text-xs font-bold text-slate-200">{p.name}</div>
                                        <div className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">{p.role} // {p.shift}</div>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                    {isLeave ? <span className="text-[9px] font-bold text-rose-500 bg-rose-950/30 px-2 py-0.5 rounded border border-rose-900 font-mono">NGHỈ_PHÉP</span> 
                                     : isPartTime ? <span className="text-[9px] font-bold text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900 font-mono">PART_TIME ({ptNote?.match(/(\d+)/)?.[1] || '4'}H)</span>
                                     : isTodaySunday ? <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900 flex items-center gap-1.5 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> TĂNG_CA_CN</span>
                                     : hasMachine ? <span className="text-[9px] font-bold text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-900 truncate font-mono">{Array.from(locs).join(', ')}</span>
                                     : <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900 flex items-center gap-1.5 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ĐANG_LÀM</span>}
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                    )}
                 </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUẢN LÝ ĐƠN HÀNG */}
          {activeTab === 'orders' && (
            <div className="max-w-7xl mx-auto flex flex-col h-full print:block">
              <div className="flex flex-col md:flex-row gap-3 mb-4 print:hidden">
                 <div className="relative flex-1">
                    <input type="text" placeholder="TÌM KHÁCH HÀNG, MODEL, MÃ..." value={orderSearchTerm} onChange={(e) => setOrderSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-md bg-[#050b14] border border-cyan-900/50 text-cyan-400 placeholder-cyan-900/50 focus:outline-none focus:border-cyan-400 font-mono text-xs"/>
                    <Search size={16} className="absolute left-3 top-3 text-cyan-700" />
                 </div>
                 <div className="flex gap-2 flex-wrap md:flex-nowrap">
                    {isSuperAdmin && (<button onClick={() => setShowAddOrder(!showAddOrder)} className="flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold border transition-colors bg-cyan-900/30 text-cyan-400 border-cyan-700 hover:bg-cyan-800 hover:text-cyan-50 font-mono tracking-widest">{showAddOrder ? <X size={14}/> : <PlusCircle size={14}/>}<span className="hidden md:inline">{showAddOrder ? 'ĐÓNG_FORM' : 'THÊM_DỮ_LIỆU'}</span></button>)}
                    <button onClick={exportToCSV} className="flex items-center gap-2 bg-emerald-900/30 text-emerald-400 px-4 py-2.5 rounded-md border border-emerald-700 font-bold hover:bg-emerald-800 hover:text-emerald-50 transition font-mono tracking-widest"><Download size={14} /> XUẤT_EXCEL</button>
                    {canEditData && (<button onClick={handleExportPDF} className="hidden md:flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2.5 rounded-md border border-slate-600 font-bold hover:bg-slate-700 hover:text-white transition font-mono tracking-widest"><Printer size={14} /> XUẤT_PDF</button>)}
                 </div>
              </div>

              {showAddOrder && isSuperAdmin && (
                 <div className="bg-[#0b1221] p-4 lg:p-6 rounded-md border border-cyan-800 shadow-md mb-6 animate-in slide-in-from-top-4 print:hidden font-mono">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 font-mono">
                        <input type="text" placeholder="Khách hàng..." value={newOrderData.client} onChange={e => setNewOrderData({...newOrderData, client: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none" />
                        <input type="text" placeholder="Model thiết bị..." value={newOrderData.model} onChange={e => setNewOrderData({...newOrderData, model: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none" />
                        <select value={newOrderData.type} onChange={e => setNewOrderData({...newOrderData, type: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none">
                            <option value="Tủ trung tâm">Tủ trung tâm</option><option value="Đầu báo khói">Đầu báo khói</option><option value="Đầu báo nhiệt">Đầu báo nhiệt</option><option value="Chuông báo cháy">Chuông báo cháy</option><option value="Đèn báo cháy">Đèn báo cháy</option><option value="Nút ấn báo cháy">Nút ấn báo cháy</option><option value="Còi đèn kết hợp">Còi đèn kết hợp</option>
                        </select>
                        <input type="number" placeholder="Số lượng" value={newOrderData.sampleSize} onChange={e => setNewOrderData({...newOrderData, sampleSize: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none" />
                        <input type="date" value={newOrderData.deadline} onChange={e => setNewOrderData({...newOrderData, deadline: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none" />
                        <select value={newOrderData.urgency} onChange={e => setNewOrderData({...newOrderData, urgency: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none">
                            <option value="Mới">Mới</option><option value="Bình thường">Bình thường</option><option value="Gấp">Gấp</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 font-mono text-xs">
                        <button onClick={() => setShowAddOrder(false)} className="px-4 py-2.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">HỦY</button>
                        <button onClick={handleAddOrder} className="px-5 py-2.5 rounded text-cyan-900 font-bold bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]">LƯU_DỮ_LIỆU</button>
                    </div>
                 </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-4 print:space-y-6 print:overflow-visible pb-10 custom-scrollbar print:text-black">
                 {groupedOrdersArr.length === 0 && <p className="text-center text-slate-500 font-mono mt-10">KHÔNG CÓ DỮ LIỆU.</p>}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 print:grid-cols-1 print:gap-4 print:text-black">
                   {groupedOrdersArr.map(group => {
                     const itemsByType = {};
                     group.items.forEach(item => { if(!itemsByType[item.type]) itemsByType[item.type] = []; itemsByType[item.type].push(item); });
                     let borderColor = group.urgency === 'Gấp' || group.urgency === 'Quá hạn' ? 'border-rose-900/50 bg-[#0b1221]' : (group.urgency === 'Mới' ? 'border-emerald-900/50 bg-[#0b1221]' : 'border-slate-800 bg-[#0b1221]');

                     return (
                       <div key={group.groupId} className={`p-4 rounded-md border ${borderColor} flex flex-col print:border-black print:bg-white print:text-black`}>
                         <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3 print:border-black">
                           <div className="flex-1">
                             <div className="flex flex-wrap items-center gap-2 mb-1"><span className="text-[10px] font-black text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 tracking-widest font-mono print:text-black print:border-black print:bg-transparent">SYS: {group.reqId}</span></div>
                             <h3 className="font-bold text-slate-200 text-sm print:text-black">{group.client}</h3>
                           </div>
                           <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                             <span className="text-[9px] font-bold text-slate-500 font-mono"><Calendar size={10} className="inline print:text-black"/> {group.deadline}</span>
                             <span className="text-xs font-bold text-cyan-500 font-mono print:text-black">{group.progress}% HOÀN_TẤT</span>
                           </div>
                         </div>
                         <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                           {Object.entries(itemsByType).map(([type, items]) => (
                             <div key={type} className="bg-[#050b14]/50 rounded border border-slate-800 overflow-hidden print:border-black print:bg-white">
                               <div className="bg-slate-900/50 px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 font-mono print:text-black print:bg-transparent print:border-black"><Layers size={10} className="inline mr-1"/>{type}</div>
                               <div className="p-2 space-y-2">
                                 {items.map(item => {
                                   const statusInfo = getItemStatus(item);
                                   return (
                                     <div key={item.id} className="flex flex-col gap-2 border-b border-slate-800/50 last:border-0 pb-3 last:pb-0 pt-1 print:border-black">
                                       <div className="flex justify-between items-start">
                                         <div className="flex-1 pr-2">
                                            <span className="text-xs font-semibold text-slate-300 print:text-black">{item.model}</span>
                                            <div className="text-[9px] text-slate-500 font-mono print:text-black">SL: <b className="text-cyan-500 print:text-black">{item.sampleSize}</b></div>
                                         </div>
                                         <div className="flex flex-col items-end gap-1.5">
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border font-mono tracking-wider ${statusInfo.color} print:text-black print:border-black print:bg-transparent`}>{statusInfo.text}</span>
                                            {isSuperAdmin && (
                                              <div className="flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity print:hidden">
                                                 {confirmDeleteOrderId === item.id ? (
                                                     <div className="flex items-center gap-1 bg-rose-950/50 p-0.5 rounded"><button onClick={() => handleDeleteOrder(item.id)} className="bg-rose-600 text-white p-1 rounded"><Check size={10}/></button><button onClick={() => setConfirmDeleteOrderId(null)} className="bg-slate-700 p-1 rounded"><X size={10}/></button></div>
                                                 ) : (<button onClick={() => setConfirmDeleteOrderId(item.id)} className="text-rose-500 p-1 rounded"><Trash2 size={12}/></button>)}
                                              </div>
                                            )}
                                         </div>
                                       </div>
                                     </div>
                                   );
                                 })}
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   })}
                 </div>
              </div>
            </div>
          )}

          {/* TAB 3: DỮ LIỆU KHO HÀNG */}
          {activeTab === 'inventory' && (
             <div className="space-y-4 lg:space-y-6 print:block max-w-7xl mx-auto h-full flex flex-col print:text-black">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 print:hidden">
                 <div className="w-full md:w-1/2 lg:w-1/3 relative flex gap-2">
                   <div className="relative flex-1">
                     <input type="text" placeholder="TÌM KIẾM MODEL, KHÁCH HÀNG..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-md bg-[#050b14] border border-cyan-900/50 text-cyan-400 placeholder-cyan-900/50 focus:outline-none focus:border-cyan-400 font-mono text-xs shadow-inner"/>
                     <Search size={16} className="absolute left-3 top-3 text-cyan-700" />
                   </div>
                 </div>
                 {canEditData && (
                   <div className="flex gap-2 w-full md:w-auto overflow-x-auto shrink-0 font-mono">
                     {Object.values(duplicateCounts).some(count => count > 1) && (
                       <button onClick={handleDeleteAllDuplicates} className="flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[10px] font-bold border bg-rose-900/30 text-rose-400 border-rose-800 hover:bg-rose-800 transition tracking-widest"><Trash2 size={14}/> DỌN_MÃ_TRÙNG</button>
                     )}
                     <label htmlFor="upload-data" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[10px] font-bold border bg-cyan-900/30 text-cyan-400 border-cyan-700 hover:bg-cyan-800 transition tracking-widest whitespace-nowrap">
                       {isUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                       {isUploading ? 'ĐANG_XỬ_LÝ...' : 'NHẬP_CSV'}
                     </label>
                     <input type="file" accept=".csv" id="upload-data" className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                     <button onClick={handleExportPDF} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded-md border border-slate-600 font-bold hover:bg-slate-700 transition tracking-widest text-[10px]"><Printer size={14}/> XUẤT_PDF</button>
                   </div>
                 )}
               </div>
               <div className="flex-1 overflow-y-auto pb-10 custom-scrollbar print:overflow-visible">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 print:grid-cols-2 print:gap-4">
                   {samplesInStock.filter(s => (s.model||'').toLowerCase().includes(searchTerm.toLowerCase()) || (s.client||'').toLowerCase().includes(searchTerm.toLowerCase())).map((sample) => {
                     const isDuplicate = checkIsDuplicate(sample.client, sample.type, sample.model);
                     const isEditing = editingSampleId === sample.id;
                     return (
                       <div key={sample.id} className={`p-3 md:p-4 rounded-md border transition print:border-black print:bg-white print:text-black ${isDuplicate ? 'bg-rose-950/20 border-rose-900/50 print:bg-white' : 'bg-[#0b1221] border-slate-800 hover:border-cyan-900'}`}>
                         <div className="flex justify-between items-start h-full">
                           {isEditing ? (
                              <div className="flex-1 space-y-2 pr-2 font-mono">
                                 <input type="text" placeholder="Khách hàng" value={editSampleData.client} onChange={e => setEditSampleData({...editSampleData, client: e.target.value})} className="w-full text-[10px] border border-cyan-800 bg-[#050b14] text-cyan-400 p-1.5 rounded outline-none" />
                                 <input type="text" placeholder="Loại TB" value={editSampleData.type} onChange={e => setEditSampleData({...editSampleData, type: e.target.value})} className="w-full text-[10px] border border-cyan-800 bg-[#050b14] text-cyan-400 p-1.5 rounded outline-none" />
                                 <input type="text" placeholder="Model" value={editSampleData.model} onChange={e => setEditSampleData({...editSampleData, model: e.target.value})} className="w-full text-[11px] font-bold border border-cyan-800 bg-[#050b14] text-cyan-400 p-1.5 rounded outline-none" />
                                 <input type="number" placeholder="Số lượng" value={editSampleData.qty} onChange={e => setEditSampleData({...editSampleData, qty: e.target.value})} className="w-1/3 text-[10px] border border-cyan-800 bg-[#050b14] text-cyan-400 p-1.5 rounded outline-none" />
                              </div>
                           ) : (
                             <div className="flex-1 flex flex-col h-full justify-between pr-2">
                               <div>
                                  <div className="flex items-start gap-2 mb-1"><h3 className={`font-bold text-sm leading-tight print:text-black ${isDuplicate ? 'text-rose-400' : 'text-slate-200'}`}>{sample.model}</h3></div>
                                  <p className="text-[10px] text-slate-500 font-mono tracking-wider mb-1 print:text-black">{sample.client}</p>
                                  <p className="text-[9px] text-slate-600 font-mono print:text-black">{sample.type}</p>
                               </div>
                               <div className="mt-3 flex items-center justify-between font-mono">
                                  <span className="text-[10px] font-black text-cyan-400 bg-cyan-950/50 border border-cyan-900 px-2 py-0.5 rounded print:bg-transparent print:border-black print:text-black">SL: {sample.qty}</span>
                                  {isDuplicate && <span className="text-[8px] font-bold text-rose-300 bg-rose-950/50 border border-rose-800 px-1.5 py-0.5 rounded flex items-center gap-1 print:hidden"><AlertTriangle size={8}/> TRÙNG_LẶP</span>}
                               </div>
                             </div>
                           )}
                           {canEditData && (
                             <div className="print:hidden">
                               {confirmDeleteSampleId === sample.id ? (
                                 <div className="flex flex-col gap-1 items-end shrink-0 bg-[#050b14] p-1 rounded border border-rose-900/50">
                                   <span className="text-[8px] text-rose-500 font-mono">XÁC_NHẬN_XÓA?</span>
                                   <div className="flex gap-1">
                                     <button onClick={() => handleDeleteSample(sample.id)} className="p-1 bg-rose-600 text-white rounded"><Check size={10}/></button>
                                     <button onClick={() => setConfirmDeleteSampleId(null)} className="p-1 bg-slate-700 text-slate-300 rounded"><X size={10}/></button>
                                   </div>
                                 </div>
                               ) : isEditing ? (
                                 <div className="flex flex-col gap-1.5 items-end shrink-0">
                                   <button onClick={() => handleSaveEditSample(sample.id)} className="p-1.5 bg-emerald-900/50 border border-emerald-700 text-emerald-400 rounded"><Check size={12}/></button>
                                   <button onClick={() => setEditingSampleId(null)} className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 rounded"><X size={12}/></button>
                                 </div>
                               ) : (
                                 <div className="flex flex-col gap-1.5 items-end shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                                   <button onClick={() => { setEditingSampleId(sample.id); setEditSampleData({client: sample.client, type: sample.type, model: sample.model, qty: sample.qty}); }} className="p-1.5 text-cyan-600 bg-cyan-950/30 rounded border border-transparent hover:border-cyan-800"><Edit2 size={12}/></button>
                                   <button onClick={() => setConfirmDeleteSampleId(sample.id)} className="p-1.5 text-rose-600 bg-rose-950/30 rounded border border-transparent hover:border-rose-800"><Trash2 size={12}/></button>
                                 </div>
                               )}
                             </div>
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             </div>
          )}

          {/* TAB 4: ĐIỀU KHIỂN TRẠM MÁY */}
          {activeTab === 'equipment' && (() => {
            const eqStats = equipments.map(eq => {
               const { running, waiting } = getTestsForStation(eq.id);
               return { ...eq, runningCount: running.length, waitingCount: waiting.length };
            });
            const totalRunning = eqStats.reduce((sum, eq) => sum + eq.runningCount, 0);
            const totalWaiting = eqStats.reduce((sum, eq) => sum + eq.waitingCount, 0);

             return (
               <div className="space-y-6 print:hidden max-w-7xl mx-auto">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 print:hidden">
                    <h2 className="text-xl font-bold text-cyan-50 md:hidden font-mono tracking-widest">TRẠM MÁY</h2>
                    <div className="flex gap-2 w-full md:w-auto flex-wrap font-mono md:ml-auto">
                       {canEditData && (
                         <button onClick={handleExportPDF} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded border border-slate-600 hover:bg-slate-700 text-[10px] tracking-widest">
                           <Printer size={14} /> XUẤT_PDF
                         </button>
                       )}
                    </div>
                 </div>

                 {isSuperAdmin && (
                    <div className="bg-[#0b1221] rounded-md border border-cyan-900/50 p-4 flex flex-col sm:flex-row gap-3 items-center shadow-lg">
                       <div className="flex items-center gap-2 w-full sm:w-auto flex-1 font-mono">
                          <Settings2 size={18} className="text-cyan-500" />
                          <input type="text" placeholder="NHẬP TÊN TRẠM MỚI..." value={newStationName} onChange={e => setNewStationName(e.target.value)} className="flex-1 bg-[#050b14] border border-cyan-800 rounded p-2 text-xs text-cyan-400 focus:border-cyan-400 outline-none" onKeyDown={e => e.key === 'Enter' && handleAddStation()}/>
                       </div>
                       <button onClick={handleAddStation} className="w-full sm:w-auto bg-cyan-600/20 border border-cyan-500/50 text-cyan-400 font-mono text-[10px] tracking-widest px-4 py-2.5 rounded hover:bg-cyan-500 hover:text-slate-900 transition">KHỞI_TẠO</button>
                    </div>
                 )}
   
                 <div className="bg-[#0b1221] rounded-md border border-slate-800 overflow-hidden mb-6">
                    <div className="bg-[#050b14] px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                       <h3 className="font-bold text-xs text-slate-300 flex items-center gap-2 font-mono tracking-widest"><Activity size={16} className="text-cyan-500"/> TRẠNG_THÁI_HỆ_THỐNG</h3>
                       <div className="flex gap-3 text-[9px] font-bold font-mono">
                          <span className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded">ĐANG_CHẠY: {totalRunning}</span>
                          <span className="bg-amber-950/50 border border-amber-800 text-amber-400 px-2 py-0.5 rounded">CHỜ_XỬ_LÝ: {totalWaiting}</span>
                       </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                       {eqStats.map(eq => (
                          <div key={'stat-'+eq.id} className={`p-3 rounded border flex flex-col items-center text-center transition ${eq.runningCount > 0 ? 'bg-cyan-950/20 border-cyan-900/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'bg-[#050b14] border-slate-800 opacity-60'}`}>
                             <span className="text-[9px] font-bold text-slate-400 font-mono mb-2">{eq.name}</span>
                             <span className={`text-2xl font-black font-mono ${eq.runningCount > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>{eq.runningCount}</span>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {equipments.map(eq => {
                     const { running, waiting, history } = getTestsForStation(eq.id);
                     const isAssigning = assigningStation === eq.id;
   
                     if (eq.id === 'TSO2') {
                        const activeBatch = running.length > 0 ? running[0] : null; 
                        const phase = activeBatch?.phase || ''; 
                        const isPaused = activeBatch?.isPaused || false;
                        let elapsedMs = 0; let isTimeUp = false; let timeColor = 'text-emerald-400';
   
                        if (activeBatch) {
                           elapsedMs = getElapsedMs(activeBatch, currentTime);
                           if (phase === 'Ăn mòn' && elapsedMs >= CORROSION_TIME_MS) { isTimeUp = true; timeColor = 'text-rose-500 animate-pulse'; } 
                           else if (phase === 'Sấy khô' && elapsedMs >= DRYING_TIME_MS) { isTimeUp = true; timeColor = 'text-rose-500 animate-pulse'; }
                        }

                        const toggleSO2Pause = async () => {
                            if (!isSuperAdmin) return; const now = new Date(); const updatesByOrder = {};
                            running.forEach(t => {
                                if (!updatesByOrder[t.orderId]) { const targetOrder = orders.find(o => o.id === t.orderId); updatesByOrder[t.orderId] = [...targetOrder.tests]; }
                                const currentTest = updatesByOrder[t.orderId][t.testIndex];
                                let newAccumulated = currentTest.accumulatedTimeMs || 0; let newIsPaused = !currentTest.isPaused;
                                let newLastResumeTime = currentTest.lastResumeTime || currentTest.phaseStartTime;
                                if (newIsPaused) { if (newLastResumeTime) newAccumulated += (now.getTime() - new Date(newLastResumeTime).getTime()); } 
                                else newLastResumeTime = now.toISOString();
                                updatesByOrder[t.orderId][t.testIndex] = { ...currentTest, isPaused: newIsPaused, accumulatedTimeMs: newAccumulated, lastResumeTime: newIsPaused ? null : newLastResumeTime };
                            });
                            await Promise.all(Object.keys(updatesByOrder).map(orderId => updateDoc(getDocument('orders', orderId), { tests: updatesByOrder[orderId] })));
                        };

                        const finishSO2Batch = async () => {
                            if (!window.confirm("Hoàn tất và đưa toàn bộ lô mẫu SO2 vào Lịch sử?")) return;
                            const now = new Date().toISOString(); const updatesByOrder = {};
                            running.forEach(t => {
                                if (!updatesByOrder[t.orderId]) { const targetOrder = orders.find(o => o.id === t.orderId); updatesByOrder[t.orderId] = [...targetOrder.tests]; }
                                updatesByOrder[t.orderId][t.testIndex] = { ...updatesByOrder[t.orderId][t.testIndex], status: 'Xong', endTime: now, isPaused: false };
                            });
                            await Promise.all(Object.keys(updatesByOrder).map(orderId => updateDoc(getDocument('orders', orderId), { tests: updatesByOrder[orderId] })));
                        };

                        const startSO2Batch = async () => {
                            if (!tso2SelectedUser) { alert("Vui lòng chọn KTV đứng máy!"); return; }
                            const now = new Date().toISOString(); const updatesByOrder = {};
                            waiting.forEach(t => {
                                if (!updatesByOrder[t.orderId]) { const targetOrder = orders.find(o => o.id === t.orderId); updatesByOrder[t.orderId] = [...targetOrder.tests]; }
                                updatesByOrder[t.orderId][t.testIndex] = { ...updatesByOrder[t.orderId][t.testIndex], status: 'Đang chạy', phase: 'Ăn mòn', assignedUser: tso2SelectedUser, phaseStartTime: now, lastResumeTime: null, accumulatedTimeMs: 0, isPaused: false };
                            });
                            await Promise.all(Object.keys(updatesByOrder).map(orderId => updateDoc(getDocument('orders', orderId), { tests: updatesByOrder[orderId] })));
                            setTso2SelectedUser('');
                        };

                        const switchSO2Phase = async () => {
                            if (!window.confirm("Chuyển toàn bộ lô sang Sấy khô (16h)?")) return;
                            const now = new Date().toISOString(); const updatesByOrder = {};
                            running.forEach(t => {
                                if (!updatesByOrder[t.orderId]) { const targetOrder = orders.find(o => o.id === t.orderId); updatesByOrder[t.orderId] = [...targetOrder.tests]; }
                                updatesByOrder[t.orderId][t.testIndex] = { ...updatesByOrder[t.orderId][t.testIndex], phase: 'Sấy khô', phaseStartTime: now, lastResumeTime: null, accumulatedTimeMs: 0, isPaused: false };
                            });
                            await Promise.all(Object.keys(updatesByOrder).map(orderId => updateDoc(getDocument('orders', orderId), { tests: updatesByOrder[orderId] })));
                        };

                        return (
                          <div key={eq.id} className={`bg-[#0b1221] rounded-md border overflow-hidden flex flex-col h-full relative transition-colors ${isTimeUp ? 'border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]' : 'border-cyan-800'}`}>
                            <div className={`absolute top-0 right-0 text-[8px] font-bold px-2 py-0.5 rounded-bl font-mono z-10 ${isTimeUp ? 'bg-rose-600 text-white' : 'bg-cyan-900 text-cyan-100'}`}>
                               {isTimeUp ? 'YÊU_CẦU_ĐỔI_PHA' : 'QUY_TRÌNH_ĐẶC_BIỆT'}
                            </div>
                            <div className={`p-3 border-b flex justify-between items-center ${isTimeUp ? 'bg-rose-950/30 border-rose-900' : 'bg-[#050b14] border-cyan-900/50'}`}>
                              <h3 className={`font-bold text-sm flex items-center gap-2 font-mono tracking-wider ${isTimeUp ? 'text-rose-400' : 'text-cyan-400'}`}>{eq.name}</h3>
                              {canEditData && <button onClick={() => setAssigningStation(isAssigning ? null : eq.id)} className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 font-mono tracking-widest" disabled={running.length > 0}>{isAssigning ? 'HỦY' : 'THÊM_VÀO_LÔ'}</button>}
                            </div>

                            {isAssigning && (() => {
                              const compatibleOrders = orders.filter(o => isDeviceCompatibleWithStation(eq.id, o.type) && !(o.tests || []).some(t => t && t.equip === eq.id && (t.status === 'Đang chạy' || t.status === 'Chờ chạy')));
                              return (
                                <div className="p-3 bg-indigo-950/30 border-b border-indigo-900 flex flex-col gap-2 font-mono">
                                  <select className="w-full text-[10px] bg-[#050b14] border border-indigo-800 text-indigo-300 rounded p-1.5 outline-none" value={selectedOrderIdToAssign} onChange={(e) => setSelectedOrderIdToAssign(e.target.value)}>
                                    <option value="">-- CHỌN_MỤC_TIÊU --</option>
                                    {compatibleOrders.length === 0 ? <option value="" disabled>KHÔNG_CÓ_TB_TƯƠNG_THÍCH</option> : compatibleOrders.map(o => <option key={o.id} value={o.id}>[{o.reqId}] {o.model}</option>)}
                                  </select>
                                  <button onClick={async () => {
                                       if(!selectedOrderIdToAssign || !user) return; const targetOrder = orders.find(o => o.id === selectedOrderIdToAssign); if(!targetOrder) return;
                                       const updatedTests = [...(targetOrder.tests || []), { name: 'Kiểm định', status: 'Chờ chạy', equip: eq.id }];
                                       await updateDoc(getDocument('orders', targetOrder.id), { tests: updatedTests }); setAssigningStation(null); setSelectedOrderIdToAssign('');
                                    }} 
                                    className="bg-indigo-600/30 border border-indigo-500 text-indigo-300 p-1.5 rounded text-[10px] hover:bg-indigo-600 hover:text-white transition disabled:opacity-50" disabled={!selectedOrderIdToAssign}>ĐƯA_VÀO_LÔ_CHỜ</button>
                                </div>
                              );
                            })()}

                            <div className="flex-1 overflow-y-auto flex flex-col p-3 custom-scrollbar">
                               {waiting.length > 0 && running.length === 0 && (
                                  <div className="p-3 bg-amber-950/20 border border-amber-900/50 mb-3 rounded font-mono">
                                     <h4 className="text-[9px] font-bold text-amber-500 mb-2 uppercase flex items-center gap-1"><Layers size={12}/> LÔ_CHỜ_CHẠY ({waiting.length})</h4>
                                     <div className="space-y-1 mb-2 max-h-32 overflow-y-auto custom-scrollbar">
                                        {waiting.map((test) => (
                                           <div key={`${test.orderId}-${test.testIndex}`} className="bg-[#050b14] border border-amber-900/50 px-2 py-1 rounded text-[10px] text-slate-300 flex justify-between items-center">
                                              <span>{test.model} <span className="text-slate-600 ml-1">[{test.reqId}]</span></span>
                                              {canEditData && <button onClick={() => handleRemoveTest(test.orderId, test.testIndex)} className="text-rose-500 hover:text-rose-400"><X size={12}/></button>}
                                           </div>
                                        ))}
                                     </div>
                                     <div className="flex gap-2 text-[10px]">
                                        <select value={tso2SelectedUser} onChange={(e) => setTso2SelectedUser(e.target.value)} className="flex-1 bg-[#050b14] border border-amber-800 text-amber-400 rounded outline-none px-1">
                                           <option value="">- CHỌN_KTV -</option>
                                           {operatorStaff.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                        <button onClick={startSO2Batch} className="bg-amber-600/20 border border-amber-500 text-amber-400 px-2 py-1 rounded hover:bg-amber-600 hover:text-black transition">BẮT_ĐẦU_ĂN_MÒN</button>
                                     </div>
                                  </div>
                               )}

                               {running.length > 0 && (
                                  <div className={`p-3 rounded border mb-3 flex-1 flex flex-col ${isTimeUp ? 'bg-rose-950/20 border-rose-900/50' : 'bg-cyan-950/10 border-cyan-900/30'}`}>
                                     <div className="flex justify-between items-center mb-2 font-mono">
                                        <h4 className={`text-[9px] font-bold uppercase flex items-center gap-1 ${isTimeUp ? 'text-rose-500' : 'text-cyan-500'}`}><Activity size={12}/> HỆ_THỐNG_ĐANG_CHẠY ({running.length})</h4>
                                        <span className="text-[8px] bg-[#050b14] px-1.5 py-0.5 rounded border border-cyan-800 text-cyan-400">KTV: {activeBatch?.assignedUser}</span>
                                     </div>
                                     
                                     <div className={`bg-[#050b14] border rounded p-2 ${isTimeUp ? 'border-rose-900/50' : 'border-cyan-900/50'}`}>
                                        <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 font-mono">
                                           <span className={`text-[10px] font-black uppercase flex items-center gap-1 ${phase === 'Ăn mòn' ? 'text-amber-500' : 'text-cyan-400'}`}>
                                              {phase === 'Ăn mòn' ? <ThermometerSun size={12}/> : <Wind size={12}/>} PHA:{phase}
                                           </span>
                                           <div className="flex items-center gap-2">
                                              {isPaused && <span className="text-[8px] font-bold bg-rose-900/50 text-rose-300 px-1 rounded animate-pulse border border-rose-800">TẠM_DỪNG</span>}
                                              <span className={`text-[10px] font-black flex items-center gap-1 ${timeColor}`}><Timer size={12}/> T-{formatMs(elapsedMs)}</span>
                                           </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-[9px] font-mono text-slate-400">
                                           {phase === 'Ăn mòn' ? (
                                              <>
                                                 <div className="bg-slate-900/50 px-1.5 py-0.5 rounded flex justify-between"><span>NHIỆT_ĐỘ:</span><span className="text-cyan-400">25±2°C</span></div>
                                                 <div className="bg-slate-900/50 px-1.5 py-0.5 rounded flex justify-between"><span>ĐỘ_ẨM:</span><span className="text-cyan-400">93±%</span></div>
                                                 <div className="bg-slate-900/50 px-1.5 py-0.5 rounded flex justify-between col-span-2"><span>NỒNG_ĐỘ_SO2:</span><span className="text-cyan-400">25±5 uL/l</span></div>
                                              </>
                                           ) : (
                                              <>
                                                 <div className="bg-slate-900/50 px-1.5 py-0.5 rounded flex justify-between"><span>NHIỆT_ĐỘ:</span><span className="text-cyan-400">40°C</span></div>
                                                 <div className="bg-slate-900/50 px-1.5 py-0.5 rounded flex justify-between"><span>ĐỘ_ẨM:</span><span className="text-cyan-400">≤ 50%</span></div>
                                                 <div className="bg-slate-900/50 px-1.5 py-0.5 rounded flex justify-between"><span>LƯU_LƯỢNG_SO2:</span><span className="text-cyan-400">0</span></div>
                                              </>
                                           )}
                                        </div>
                                        <div className="mt-2 space-y-0.5 max-h-16 overflow-y-auto custom-scrollbar border-t border-slate-800 pt-2 font-mono text-[9px]">
                                           {running.map((test) => (
                                               <div key={`${test.orderId}-${test.testIndex}`} className="flex justify-between items-center text-slate-300">
                                                   <span className="truncate pr-1">&gt; {test.model}</span>
                                                   {canEditData && <button onClick={() => handleRemoveTest(test.orderId, test.testIndex)} className="text-rose-600 hover:text-rose-400"><X size={10}/></button>}
                                               </div>
                                           ))}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col gap-1.5 font-mono">
                                           {isSuperAdmin && (
                                               <button onClick={toggleSO2Pause} className={`w-full py-1 rounded text-[9px] font-bold flex justify-center items-center gap-1 transition ${isPaused ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-400 hover:bg-emerald-600 hover:text-black' : 'bg-rose-900/20 border border-rose-800 text-rose-500 hover:bg-rose-900'}`}>
                                                  {isPaused ? <><Play size={10}/> TIẾP_TỤC_CHẠY</> : <><Pause size={10}/> QUẢN_LÝ:_TẠM_DỪNG</>}
                                               </button>
                                           )}
                                           {phase === 'Ăn mòn' ? (
                                              <button onClick={switchSO2Phase} disabled={!isTimeUp || isPaused} className={`w-full py-1.5 rounded text-[10px] font-bold transition ${(!isTimeUp || isPaused) ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' : 'bg-amber-600/20 border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-black animate-pulse'}`}>
                                                 {(!isTimeUp || isPaused) ? 'ĐANG_ĂN_MÒN...' : 'CHUYỂN_SANG_SẤY_KHÔ'}
                                              </button>
                                           ) : (
                                              <button onClick={finishSO2Batch} disabled={!isTimeUp || isPaused} className={`w-full py-1.5 rounded text-[10px] font-bold transition ${(!isTimeUp || isPaused) ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' : 'bg-cyan-600/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black animate-pulse'}`}>
                                                 {(!isTimeUp || isPaused) ? 'ĐANG_SẤY_KHÔ...' : 'HOÀN_TẤT_QUY_TRÌNH'}
                                              </button>
                                           )}
                                        </div>
                                     </div>
                                  </div>
                               )}

                               <h4 className="text-[9px] font-bold text-cyan-800 mb-1 uppercase font-mono tracking-widest mt-auto pt-2 border-t border-cyan-900/30">LỊCH_SỬ_HỆ_THỐNG ({history.length})</h4>
                               <div className="max-h-20 overflow-y-auto custom-scrollbar">
                                   {history.map((test) => (
                                     <div key={`${test.orderId}-${test.testIndex}`} className="text-[9px] font-mono text-slate-500 flex justify-between items-center mb-0.5">
                                       <span className="truncate pr-1">- {test.model}</span><CheckCircle2 size={10} className="text-emerald-700" />
                                     </div>
                                   ))}
                               </div>
                            </div>
                          </div>
                        );
                     }
   
                     // Trạm máy thông thường
                     return (
                       <div key={eq.id} className="bg-[#0b1221] rounded-md border border-cyan-800 overflow-hidden flex flex-col h-full hover:border-cyan-500 transition-colors">
                         <div className="p-3 border-b bg-[#050b14] border-cyan-900/50 flex justify-between items-center">
                           <h3 className="font-bold text-sm text-cyan-400 font-mono tracking-wider">{eq.name}</h3>
                           <div className="flex gap-2">
                             {canEditData && <button onClick={() => setAssigningStation(isAssigning ? null : eq.id)} className="text-[9px] font-bold px-2 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 font-mono tracking-widest">{isAssigning ? 'HỦY' : 'THÊM_THIẾT_BỊ'}</button>}
                             {isSuperAdmin && <button onClick={() => handleDeleteStation(eq.id, eq.name)} className="px-1.5 py-1 bg-rose-900/30 text-rose-500 rounded border border-rose-900 hover:bg-rose-900"><Trash2 size={12}/></button>}
                           </div>
                         </div>

                         {isAssigning && (() => {
                           const compatibleOrders = orders.filter(o => isDeviceCompatibleWithStation(eq.id, o.type) && !(o.tests || []).some(t => t && t.equip === eq.id && (t.status === 'Đang chạy' || t.status === 'Chờ chạy')));
                           return (
                             <div className="p-3 bg-cyan-950/20 border-b border-cyan-900/50 flex flex-col gap-2 font-mono">
                               <select className="w-full text-[10px] bg-[#050b14] border border-cyan-800 text-cyan-400 rounded p-1.5 outline-none" value={selectedOrderIdToAssign} onChange={(e) => setSelectedOrderIdToAssign(e.target.value)}>
                                 <option value="">-- CHỌN MỤC TIÊU --</option>
                                 {compatibleOrders.length === 0 ? <option value="" disabled>KHÔNG_CÓ_TB_TƯƠNG_THÍCH</option> : compatibleOrders.map(o => <option key={o.id} value={o.id}>[{o.reqId}] {o.model} (SL: {o.sampleSize})</option>)}
                               </select>
                               <div className="flex gap-2">
                                 <select className="flex-1 text-[10px] bg-[#050b14] border border-cyan-800 text-cyan-400 rounded p-1.5 outline-none" value={selectedPersonnelToAssign} onChange={(e) => setSelectedPersonnelToAssign(e.target.value)}>
                                   <option value="">-- CHỌN_KTV --</option>
                                   {operatorStaff.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                 </select>
                                 <button onClick={() => handleAssignToStation(eq.id)} className="bg-cyan-600/20 border border-cyan-500 text-cyan-400 px-3 py-1 rounded text-[10px] hover:bg-cyan-600 hover:text-black transition disabled:opacity-50" disabled={!selectedOrderIdToAssign}>BẮT_ĐẦU</button>
                               </div>
                             </div>
                           );
                         })()}

                         <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                           <h4 className="text-[9px] font-bold text-cyan-700 mb-2 flex items-center gap-1 uppercase tracking-widest font-mono"><Activity size={10}/> HỆ_THỐNG_ĐANG_CHẠY ({running.length})</h4>
                           {running.map((test) => (
                             <div key={`${test.orderId}-${test.testIndex}`} className="bg-[#050b14] p-2 rounded border border-cyan-900/50 mb-2 flex justify-between items-center border-l-2 border-l-cyan-500">
                               <div className="flex-1 pr-2">
                                 <div className="text-[8px] text-slate-500 font-mono tracking-widest">{test.reqId}</div>
                                 <div className="text-xs font-semibold text-slate-200">{test.model}</div>
                                 <div className="text-[9px] text-cyan-600 mt-1 font-mono">KTV: {test.assignedUser || 'CHƯA_PHÂN_CÔNG'}</div>
                               </div>
                               <div className="flex items-center gap-1 shrink-0 font-mono">
                                 {canEditData && <button onClick={() => handleRemoveTest(test.orderId, test.testIndex)} className="text-[10px] bg-rose-950/30 text-rose-500 border border-rose-900 p-1.5 rounded hover:bg-rose-900 transition"><Trash2 size={12}/></button>}
                                 {canEditData && <button onClick={() => markTestAsDone(test.orderId, test.testIndex)} className="text-[9px] bg-emerald-950/30 text-emerald-400 border border-emerald-900 px-2 py-1.5 rounded hover:bg-emerald-900 transition">HOÀN_TẤT</button>}
                               </div>
                             </div>
                           ))}

                           <h4 className="text-[9px] font-bold text-slate-600 mb-1 flex items-center gap-1 uppercase tracking-widest border-t border-slate-800 pt-3 mt-3 font-mono"><History size={10}/> LỊCH_SỬ_HỆ_THỐNG ({history.length})</h4>
                           {history.map((test) => (
                             <div key={`${test.orderId}-${test.testIndex}`} className="text-[9px] font-mono text-slate-500 flex justify-between items-center mb-0.5">
                               <div><span className="text-slate-600 mr-1">[{test.reqId}]</span>{test.model}</div>
                               <CheckCircle2 size={10} className="text-emerald-800 shrink-0" />
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             );
          })()}

          {/* TAB 5: NHÂN SỰ VẬN HÀNH */}
          {activeTab === 'personnel' && (
            <div className="space-y-6 max-w-7xl mx-auto flex flex-col h-full print:block">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 print:hidden">
                <h2 className="text-xl font-bold text-cyan-50 md:hidden font-mono tracking-widest">NHÂN_SỰ</h2>
                <div className="flex gap-2 w-full md:w-auto flex-wrap font-mono">
                   {isSuperAdmin && (
                     <>
                       <button onClick={() => setShowAddPersonnel(!showAddPersonnel)} className="flex items-center gap-2 bg-cyan-900/30 text-cyan-400 px-4 py-2 rounded border border-cyan-700 hover:bg-cyan-800 text-[10px] tracking-widest">
                         {showAddPersonnel ? <X size={14}/> : <PlusCircle size={14}/>} {showAddPersonnel ? 'ĐÓNG' : 'THÊM_NHÂN_SỰ'}
                       </button>
                       <button onClick={() => { setShowAttendanceCalendar(true); setAttendanceMode('date'); }} className="flex items-center gap-2 bg-indigo-600/30 text-indigo-300 px-4 py-2 rounded border border-indigo-500 hover:bg-indigo-600 text-[10px] tracking-widest">
                         <CalendarCheck size={14} /> QUẢN_LÝ_CHẤM_CÔNG
                       </button>
                     </>
                   )}
                   <button onClick={() => setShowPrintModal(true)} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded border border-slate-600 hover:bg-slate-700 text-[10px] tracking-widest">
                     <Printer size={14} /> XUẤT_PDF_THÁNG
                   </button>
                   <button onClick={handleExportPDF} className="flex items-center gap-2 bg-cyan-800/40 text-cyan-300 px-4 py-2 rounded border border-cyan-600 hover:bg-cyan-700 text-[10px] tracking-widest">
                     <Download size={14} /> LƯU_DANH_SÁCH
                   </button>
                </div>
              </div>

              {showAddPersonnel && isSuperAdmin && (
                 <div className="bg-[#0b1221] p-4 lg:p-6 rounded-md border border-cyan-800 shadow-md mb-6 animate-in slide-in-from-top-4 font-mono print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                       <input type="text" placeholder="Tên nhân viên..." value={newPersonnel.name} onChange={(e) => setNewPersonnel({...newPersonnel, name: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none"/>
                       <input type="text" placeholder="Chức vụ (KTV, Partime)..." value={newPersonnel.role} onChange={(e) => setNewPersonnel({...newPersonnel, role: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none"/>
                       <select value={newPersonnel.shift} onChange={e => setNewPersonnel({...newPersonnel, shift: e.target.value})} className="bg-[#050b14] border border-cyan-900/50 p-2.5 rounded text-xs text-cyan-400 focus:border-cyan-400 outline-none">
                          <option value="Hành Chính">Hành Chính</option><option value="Ca Ngày">Ca Ngày</option><option value="Ca Đêm">Ca Đêm</option><option value="Part-time">Part-time</option>
                       </select>
                       <button onClick={handleAddPersonnel} className="bg-cyan-500 text-slate-900 py-2.5 rounded text-xs font-bold hover:bg-cyan-400 transition">THÊM_THỦ_CÔNG</button>
                    </div>

                    <div className="relative flex items-center py-2 mb-2">
                       <div className="flex-grow border-t border-slate-800"></div>
                       <span className="flex-shrink-0 mx-4 text-slate-600 text-[9px] font-bold uppercase tracking-[0.2em]">Hoặc Import Data</span>
                       <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-6 border border-dashed border-cyan-900 rounded bg-[#050b14] hover:border-cyan-500 transition relative">
                       <input type="file" accept=".csv" id="upload-personnel" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handlePersonnelFileUpload} disabled={isUploadingPersonnel}/>
                       {isUploadingPersonnel ? <Loader2 size={24} className="animate-spin text-cyan-600 mb-2" /> : <UploadCloud size={24} className="text-cyan-800 mb-2" />}
                       <p className="font-bold text-cyan-600 text-xs tracking-widest">{isUploadingPersonnel ? 'ĐANG_XỬ_LÝ...' : 'KÉO_THẢ_CSV_VÀO_ĐÂY'}</p>
                    </div>
                 </div>
              )}

              {/* MODAL LỊCH CHẤM CÔNG HÀNG LOẠT */}
              {showAttendanceCalendar && isSuperAdmin && (() => {
                  const year = attendanceViewDate.getFullYear(); const month = attendanceViewDate.getMonth();
                  const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDay = new Date(year, month, 1).getDay();
                  const startOffset = firstDay === 0 ? 6 : firstDay - 1; 
                  const calendarDays = [];
                  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
                  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(getLocalYYYYMMDD(new Date(year, month, i)));

                  return (
                 <div className="fixed inset-0 bg-[#050b14]/95 backdrop-blur-md z-50 flex flex-col w-[100vw] h-[100vh] overflow-hidden animate-in fade-in print:hidden">
                    <div className="bg-[#0b1221] flex justify-between items-center p-4 border-b border-cyan-900/50 shrink-0">
                        <div className="flex items-center gap-3">
                            <CalendarCheck size={24} className="text-cyan-500"/>
                            <h2 className="text-xl font-black text-cyan-50 tracking-widest font-mono">QUẢN_LÝ_CHẤM_CÔNG</h2>
                        </div>
                        <button onClick={() => { setShowAttendanceCalendar(false); setPinnedTooltip(null); }} className="px-4 py-1.5 bg-rose-900/30 border border-rose-800 text-rose-500 text-[10px] tracking-widest font-bold rounded hover:bg-rose-900 font-mono">ĐÓNG</button>
                    </div>

                    <div className="flex flex-1 overflow-hidden bg-[#050b14]">
                        {/* Cột trái */}
                        <div className="w-64 md:w-72 lg:w-80 bg-[#0b1221] border-r border-cyan-900/50 flex flex-col z-10 shrink-0 h-full font-mono">
                            <div className="flex bg-[#050b14] p-1 m-3 rounded border border-slate-800 shrink-0">
                                <button onClick={() => setAttendanceMode('date')} className={`flex-1 py-1.5 text-[9px] font-bold tracking-widest rounded transition-colors ${attendanceMode === 'date' ? 'bg-cyan-900/50 text-cyan-300' : 'text-slate-600 hover:text-slate-400'}`}>THEO_NGÀY</button>
                                <button onClick={() => { setAttendanceMode('person'); if (!selectedAttendanceStaffId && activePersonnel.length > 0) setSelectedAttendanceStaffId(activePersonnel[0].id); }} className={`flex-1 py-1.5 text-[9px] font-bold tracking-widest rounded transition-colors ${attendanceMode === 'person' ? 'bg-cyan-900/50 text-cyan-300' : 'text-slate-600 hover:text-slate-400'}`}>THEO_NGƯỜI</button>
                            </div>

                            {attendanceMode === 'date' ? (
                                <>
                                    <div className="p-3 bg-cyan-950/10 border-y border-cyan-900/30 text-center shrink-0">
                                        <input type="date" value={selectedAttendanceDate} onChange={(e) => setSelectedAttendanceDate(e.target.value)} className="w-full text-center bg-[#050b14] border border-cyan-800 text-cyan-400 rounded p-1.5 text-xs outline-none cursor-pointer"/>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                        {activePersonnel.map(p => {
                                            const mark = attendanceBatchData[p.id] || '';
                                            return (
                                                <div key={p.id} className="flex justify-between items-center p-2 border-b border-slate-800 gap-2">
                                                    <span className="font-semibold text-[10px] text-slate-300 truncate flex-1">{p.name}</span>
                                                    <div className="flex gap-1 shrink-0 items-center">
                                                        <button onClick={() => handleMarkStaff(p.id, 'V')} className={`w-6 h-6 rounded text-[10px] font-black flex items-center justify-center transition-all border ${mark === 'V' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-transparent border-slate-700 text-slate-600 hover:border-emerald-900 hover:text-emerald-700'}`}>V</button>
                                                        <button onClick={() => handleMarkStaff(p.id, 'X')} className={`w-6 h-6 rounded text-[10px] font-black flex items-center justify-center transition-all border ${mark === 'X' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-transparent border-slate-700 text-slate-600 hover:border-rose-900 hover:text-rose-700'}`}>X</button>
                                                        <button onClick={() => handleMarkStaff(p.id, mark.startsWith('P') ? '' : 'P-4')} className={`w-6 h-6 rounded text-[9px] font-black flex items-center justify-center transition-all border ${mark.startsWith('P') ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-transparent border-slate-700 text-slate-600 hover:border-amber-900 hover:text-amber-700'}`}>P</button>
                                                        {mark.startsWith('P') && (
                                                            <select value={mark.split('-')[1]} onChange={(e) => handleMarkStaff(p.id, `P-${e.target.value}`)} className="w-10 h-6 text-[9px] border border-amber-800 rounded bg-[#050b14] text-center text-amber-400 appearance-none px-0.5 outline-none">
                                                                {[1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>{h} GIỜ</option>)}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="p-3 bg-[#0b1221] border-t border-cyan-900/50 mt-auto shrink-0">
                                        <button onClick={() => saveAttendance(true)} className="w-full py-2 bg-cyan-600/20 border border-cyan-500 text-cyan-400 text-[10px] font-bold tracking-widest rounded hover:bg-cyan-600 hover:text-black transition">LƯU_DỮ_LIỆU</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 bg-cyan-950/10 border-y border-cyan-900/30 text-center shrink-0">
                                        <div className="text-xs text-cyan-400 bg-[#050b14] border border-cyan-800 rounded p-1.5 truncate">
                                            {activePersonnel.find(p => p.id === selectedAttendanceStaffId)?.name || 'CHƯA_CHỌN'}
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                        {activePersonnel.map(p => (
                                            <button key={p.id} onClick={() => { setSelectedAttendanceStaffId(p.id); setPersonBatchData({}); }} className={`w-full text-left flex justify-between items-center p-2.5 mb-1 border rounded transition-all ${selectedAttendanceStaffId === p.id ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300' : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                                                <span className="font-semibold text-[10px] truncate">{p.name}</span>
                                                {selectedAttendanceStaffId === p.id && <ChevronRight size={14} className="text-cyan-500"/>}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-[#0b1221] border-t border-cyan-900/50 mt-auto shrink-0">
                                        <button onClick={() => saveAttendance(false)} className="w-full py-2 bg-cyan-600/20 border border-cyan-500 text-cyan-400 text-[10px] font-bold tracking-widest rounded hover:bg-cyan-600 hover:text-black transition">LƯU_DỮ_LIỆU_NHÂN_SỰ</button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Cột phải: Lịch */}
                        <div className="flex-1 p-4 lg:p-6 flex flex-col bg-[#050b14] overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center mb-4 bg-[#0b1221] p-2 rounded border border-slate-800 shrink-0 font-mono">
                                <div className="flex gap-1">
                                    <button onClick={() => setAttendanceViewDate(new Date(year - 1, month, 1))} className="p-1.5 text-slate-500 hover:text-cyan-400 rounded"><ChevronsLeft size={16}/></button>
                                    <button onClick={() => setAttendanceViewDate(new Date(year, month - 1, 1))} className="p-1.5 text-slate-500 hover:text-cyan-400 rounded"><ChevronLeft size={16}/></button>
                                </div>
                                <h3 className="text-sm font-black text-slate-300 tracking-widest">T{month + 1} // {year}</h3>
                                <div className="flex gap-1">
                                    <button onClick={() => setAttendanceViewDate(new Date(year, month + 1, 1))} className="p-1.5 text-slate-500 hover:text-cyan-400 rounded"><ChevronRight size={16}/></button>
                                    <button onClick={() => setAttendanceViewDate(new Date(year + 1, month, 1))} className="p-1.5 text-slate-500 hover:text-cyan-400 rounded"><ChevronsRight size={16}/></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-2 mb-2 text-center shrink-0">
                                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (<div key={day} className="text-[10px] font-black text-slate-600 font-mono">{day}</div>))}
                            </div>
                            
                            <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-max font-mono">
                                {calendarDays.map((dateStr, idx) => {
                                    if (!dateStr) return <div key={`empty-${idx}`}></div>;
                                    const isTodayLocal = dateStr === getLocalYYYYMMDD(new Date());
                                    const dayNum = parseInt(dateStr.split('-')[2], 10);
                                    
                                    if (attendanceMode === 'date') {
                                        const isSelected = dateStr === selectedAttendanceDate;
                                        let hasWorking = false; let absentees = []; let partTimers = [];
                                        activePersonnel.forEach(p => {
                                            const st = p.timesheet?.[dateStr]?.status; const nt = p.timesheet?.[dateStr]?.note;
                                            if (st === 'Nghỉ phép' || st === 'Nghỉ' || st === 'Vắng mặt') absentees.push({ name: p.name, note: nt || 'NGHỈ' });
                                            else if (st === 'Đang làm' || st === 'Làm việc') hasWorking = true;
                                            else if (st === 'Part-time') { hasWorking = true; partTimers.push({ name: p.name, note: nt || 'LÀM THEO CA' }); }
                                        });

                                        let circleClass = "border-slate-800 bg-[#0b1221] text-slate-500";
                                        if (absentees.length > 0) circleClass = "bg-rose-950/50 border-rose-500 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]"; 
                                        else if (hasWorking) circleClass = "bg-emerald-950/50 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"; 

                                        if (isSelected) circleClass += " ring-2 ring-cyan-500 scale-110 z-10";

                                        const rowIndex = Math.floor(idx / 7); const colIndex = idx % 7; 
                                        const isPinned = pinnedTooltip === dateStr;
                                        const isTop = rowIndex <= 2;
                                        const tooltipStyle = { zIndex: 9999, ...(isTop ? { top: 'calc(100% + 8px)' } : { bottom: 'calc(100% + 8px)' }), ...(colIndex <= 1 ? { left: '0' } : colIndex >= 5 ? { right: '0' } : { left: '50%', transform: 'translateX(-50%)' }) };

                                        return (
                                            <div key={dateStr} className={`relative group flex justify-center py-1 h-full z-0 ${isPinned ? 'z-50' : 'hover:z-50 focus-within:z-50'}`}>
                                                <button onClick={() => { setSelectedAttendanceDate(dateStr); setPinnedTooltip((absentees.length>0||partTimers.length>0) && pinnedTooltip!==dateStr ? dateStr : null); }} className={`w-10 h-10 rounded flex flex-col items-center justify-center transition-all border ${circleClass}`}>
                                                    <span className="text-sm">{dayNum}</span>
                                                    {isTodayLocal && <span className="absolute bottom-1 w-4 h-0.5 bg-cyan-500"></span>}
                                                </button>
                                                
                                                {(absentees.length > 0 || partTimers.length > 0) && (
                                                    <div onClick={(e) => e.stopPropagation()} style={tooltipStyle} className={`absolute ${isPinned ? 'flex' : 'hidden group-hover:flex'} flex-col w-48 bg-[#0b1221] border border-cyan-900 text-white rounded shadow-2xl overflow-hidden animate-in fade-in`}>
                                                        {absentees.length > 0 && (
                                                            <>
                                                                <div className="bg-rose-950/80 text-rose-400 font-bold flex justify-between px-2 py-1.5 text-[9px] border-b border-rose-900">
                                                                    <span>VẮNG_MẶT ({absentees.length})</span>
                                                                    {isPinned ? <button onClick={() => setPinnedTooltip(null)} className="hover:text-white"><X size={12}/></button> : <span className="opacity-50">(GHIM)</span>}
                                                                </div>
                                                                <div className="p-1.5 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                                                    {absentees.map((a, i) => (<div key={i} className="flex justify-between border-b border-slate-800 pb-1 text-[9px]"><span className="text-rose-200">{a.name}</span><span className="text-slate-500">{a.note}</span></div>))}
                                                                </div>
                                                            </>
                                                        )}
                                                        {partTimers.length > 0 && (
                                                            <>
                                                                <div className="bg-amber-950/80 text-amber-400 font-bold flex justify-between px-2 py-1.5 text-[9px] border-b border-amber-900 border-t border-t-amber-900">
                                                                    <span>LÀM_THEO_CA ({partTimers.length})</span>
                                                                    {isPinned && absentees.length === 0 && <button onClick={() => setPinnedTooltip(null)} className="hover:text-white"><X size={12}/></button>}
                                                                </div>
                                                                <div className="p-1.5 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                                                    {partTimers.map((a, i) => (<div key={i} className="flex justify-between border-b border-slate-800 pb-1 text-[9px]"><span className="text-amber-200">{a.name}</span><span className="text-slate-500">{a.note}</span></div>))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        const staff = activePersonnel.find(p => p.id === selectedAttendanceStaffId);
                                        const mark = personBatchData[dateStr] !== undefined ? personBatchData[dateStr] : (() => {
                                                const st = staff?.timesheet?.[dateStr]?.status; const nt = staff?.timesheet?.[dateStr]?.note;
                                                if (st === 'Đang làm' || st === 'Làm việc') return 'V'; if (st === 'Nghỉ phép' || st === 'Nghỉ' || st === 'Vắng mặt') return 'X';
                                                if (st === 'Part-time') return `P-${nt?.match(/(\d+)/)?.[1] || '4'}`; return '';
                                            })();
                                        
                                        let circleClass = "border-slate-800 bg-[#0b1221] text-slate-500";
                                        if (mark === 'V') circleClass = "bg-emerald-950/50 border-emerald-500 text-emerald-400";
                                        if (mark === 'X') circleClass = "bg-rose-950/50 border-rose-500 text-rose-400";
                                        if (mark?.startsWith('P')) circleClass = "bg-amber-950/50 border-amber-500 text-amber-400";

                                        return (
                                            <div key={dateStr} className="relative flex justify-center py-1 h-full z-0 hover:z-10 focus-within:z-10">
                                                <button onClick={() => handleTogglePersonDay(dateStr)} className={`w-10 h-10 rounded flex flex-col items-center justify-center transition-all border ${circleClass}`}>
                                                    <span className="text-sm">{dayNum}</span>
                                                    {isTodayLocal && <span className={`absolute bottom-1 w-4 h-0.5 ${mark ? 'bg-white' : 'bg-cyan-500'}`}></span>}
                                                </button>
                                                {mark?.startsWith('P') && (
                                                    <div className="absolute top-full mt-1 z-50 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                                                        <select value={mark.split('-')[1]} onChange={(e) => setPersonBatchData(prev => ({ ...prev, [dateStr]: `P-${e.target.value}` }))} className="p-0.5 text-[9px] border border-amber-500 bg-[#050b14] text-amber-400 text-center outline-none">
                                                            {[1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>{h} GIỜ</option>)}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    </div>
                 </div>
              );})()}

              <div className="flex-1 overflow-y-auto pb-10 custom-scrollbar print:overflow-visible">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-4 print:text-black">
                   {activePersonnel.map((p) => {
                     const isEditing = editingPersonnelId === p.id;
                     
                     // ĐIỀU CHỈNH LOGIC CHỦ NHẬT (CHỈ ẢNH HƯỞNG HIỂN THỊ)
                     let displayStatus = p.status === 'Làm việc' ? 'Đang làm' : (p.status === 'Nghỉ' ? 'Nghỉ phép' : p.status);
                     if (isTodaySunday && p.timesheet?.[todayStr]?.status !== 'Đang làm' && p.timesheet?.[todayStr]?.status !== 'Part-time') {
                         displayStatus = 'Nghỉ CN (Hết giờ)';
                     } else if (isTodaySunday && p.timesheet?.[todayStr]?.status === 'Đang làm') {
                         displayStatus = 'Tăng ca CN';
                     }
                     
                     return (
                       <div key={p.id} className={`p-4 rounded border flex flex-col transition print:border-black print:bg-white print:text-black ${(displayStatus === 'Nghỉ phép' || displayStatus === 'Nghỉ CN (Hết giờ)') ? 'bg-rose-950/10 border-rose-900/30' : 'bg-[#0b1221] border-cyan-900/30 hover:border-cyan-700'}`}>
                         <div className="flex justify-between items-start mb-3">
                           <div className="flex gap-3 items-center w-full pr-2">
                             <div className={`p-2 rounded border ${(displayStatus === 'Nghỉ phép' || displayStatus === 'Nghỉ CN (Hết giờ)') ? 'bg-rose-950/30 border-rose-800 text-rose-500' : 'bg-cyan-950/30 border-cyan-800 text-cyan-500'} print:bg-transparent print:border-black print:text-black`}>
                               {(displayStatus === 'Nghỉ phép' || displayStatus === 'Nghỉ CN (Hết giờ)') ? <UserMinus size={16} /> : <UserCheck size={16} />}
                             </div>
                             
                             {isEditing ? (
                               <div className="flex-1 space-y-1 font-mono text-[10px]">
                                 <input type="text" value={editPersonnelData.name} onChange={(e)=>setEditPersonnelData({...editPersonnelData, name: e.target.value})} className="w-full bg-[#050b14] border border-cyan-800 text-cyan-300 p-1 rounded" />
                                 <input type="text" value={editPersonnelData.role} onChange={(e)=>setEditPersonnelData({...editPersonnelData, role: e.target.value})} className="w-full bg-[#050b14] border border-cyan-800 text-cyan-300 p-1 rounded" />
                               </div>
                             ) : (
                               <div className="flex-1">
                                 <h3 className="font-bold text-sm text-slate-200 print:text-black">{p.name}</h3>
                                 <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase print:text-black">{p.role}</p>
                               </div>
                             )}
                           </div>
                           
                           {canEditData && (
                             <div className="print:hidden">
                                {confirmDeletePersonnelId === p.id ? (
                                  <div className="flex flex-col gap-1 items-end shrink-0 bg-[#050b14] p-1 rounded border border-rose-900">
                                    <span className="text-[8px] text-rose-500 font-mono">XÓA?</span>
                                    <div className="flex gap-1">
                                      <button onClick={() => handleDeletePersonnel(p.id)} className="p-1 bg-rose-600 text-white rounded"><Check size={12}/></button>
                                      <button onClick={() => setConfirmDeletePersonnelId(null)} className="p-1 bg-slate-700 text-white rounded"><X size={12}/></button>
                                    </div>
                                  </div>
                                ) : isEditing ? (
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => handleSaveEditPersonnel(p.id)} className="p-1 bg-emerald-900/50 text-emerald-500 border border-emerald-800 rounded"><Check size={12}/></button>
                                    <button onClick={() => setEditingPersonnelId(null)} className="p-1 bg-slate-800 text-slate-400 border border-slate-700 rounded"><X size={12}/></button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 opacity-30 hover:opacity-100">
                                    <button onClick={() => { setEditingPersonnelId(p.id); setEditPersonnelData({name: p.name, role: p.role, shift: p.shift || 'Hành Chính'}); }} className="p-1 text-cyan-600 hover:bg-cyan-950/50 rounded"><Edit2 size={12}/></button>
                                    <button onClick={() => setConfirmDeletePersonnelId(p.id)} className="p-1 text-rose-600 hover:bg-rose-950/50 rounded"><Trash2 size={12}/></button>
                                  </div>
                                )}
                             </div>
                           )}
                         </div>
                         
                         <div className="mt-auto">
                           {!isEditing && canEditData && (
                             <div className="flex gap-2 mb-3 print:hidden font-mono tracking-widest">
                                <button onClick={() => changePersonnelStatus(p.id, 'Đang làm')} className={`flex-1 text-[9px] py-1.5 rounded font-bold border transition ${displayStatus === 'Đang làm' || displayStatus === 'Tăng ca CN' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-600' : 'bg-transparent text-slate-500 border-slate-800 hover:border-slate-600'}`}>
                                    {isTodaySunday ? 'ĐĂNG KÝ TĂNG CA' : 'ĐANG_LÀM'}
                                </button>
                                <button onClick={() => changePersonnelStatus(p.id, 'Nghỉ phép')} className={`flex-1 text-[9px] py-1.5 rounded font-bold border transition ${displayStatus === 'Nghỉ phép' || displayStatus === 'Nghỉ CN (Hết giờ)' ? 'bg-rose-900/30 text-rose-400 border-rose-600' : 'bg-transparent text-slate-500 border-slate-800 hover:border-slate-600'}`}>NGHỈ_PHÉP</button>
                                {isSuperAdmin && <button onClick={() => { if(window.confirm(`Cho nghỉ việc?`)) changePersonnelStatus(p.id, 'Đã nghỉ việc'); }} className="px-2 text-slate-600 hover:text-rose-500 rounded border border-slate-800 hover:border-rose-900"><UserX size={12}/></button>}
                             </div>
                           )}

                           <div className="bg-[#050b14] p-1.5 rounded border border-cyan-900/30 flex items-center gap-2 print:border-black print:bg-white">
                             <input id={`note-${p.id}`} type="text" placeholder="GHI_CHÚ_NHANH..." className="flex-1 text-[10px] bg-transparent text-cyan-200 placeholder-slate-600 focus:outline-none font-mono print:text-black print:placeholder-black" defaultValue={p.timesheet?.[todayStr]?.note || ''} onKeyDown={(e) => { if (e.key === 'Enter') updatePersonnelNote(p.id, e.target.value); }}/>
                             <button onClick={() => updatePersonnelNote(p.id, document.getElementById(`note-${p.id}`).value)} className="bg-slate-800 hover:bg-cyan-900 text-slate-400 hover:text-cyan-100 text-[8px] px-2 py-1 rounded font-mono tracking-widest transition print:hidden">LƯU_GHI_CHÚ</button>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
    </>
  );
}
