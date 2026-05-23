import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

import { 
  ClipboardList, 
  Settings2, 
  LayoutDashboard, 
  CheckCircle2, 
  Users,
  Sun,
  Moon,
  AlertTriangle,
  Calendar,
  Activity,
  Archive,
  Printer,
  Search,
  UploadCloud,
  Loader2,
  RefreshCw,
  XCircle,
  PlusCircle,
  Trash2,
  Edit2,
  Check,
  X,
  History,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Filter,
  Download,
  FileSpreadsheet,
  LogOut,
  KeyRound,
  ListFilter,
  ThermometerSun,
  Wind,
  Timer,
  Pause,
  Play,
  Layers,
  UserMinus,
  UserCheck,
  UserX,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarCheck
} from 'lucide-react';

// =========================================================================
// 🚀 CẤU HÌNH FIREBASE GỐC CỦA BẠN (ĐẢM BẢO CHẠY TỐT TRÊN NETLIFY)
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

// SỬ DỤNG ĐƯỜNG DẪN GỐC ĐỂ TRÁNH LỖI QUYỀN FIREBASE
const getCol = (colName) => collection(db, colName);
const getDocument = (colName, docId) => doc(db, colName, docId);

// =========================================================================
// 🚀 HÀM HỖ TRỢ & THỜI GIAN
// =========================================================================
const getLocalYYYYMMDD = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const getRoleWeight = (role) => {
  const r = String(role || '').toLowerCase();
  if (r.includes('trưởng phòng')) return 1;
  if (r.includes('phó phòng')) return 2;
  if (r.includes('quản lý') || r.includes('ktv trưởng')) return 3;
  if (r.includes('thư ký') || r.includes('hành chính') || r.includes('thủ kho') || r.includes('ktv')) return 4;
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

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { id: 'orders', icon: ClipboardList, label: 'Đơn KĐ' },
  { id: 'inventory', icon: Archive, label: 'Kho Hàng' },
  { id: 'equipment', icon: Settings2, label: 'Trạm Máy' },
  { id: 'personnel', icon: Users, label: 'Nhân sự' },
];

export default function App() {
  const [userRole, setUserRole] = useState(null); 
  const [adminPin, setAdminPin] = useState('');
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

  const [showFilters, setShowFilters] = useState(false);
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClient, setFilterClient] = useState('');

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMonth, setPrintMonth] = useState(new Date().getMonth() + 1);
  const [printYear, setPrintYear] = useState(new Date().getFullYear());
  const [isPrintingMonthly, setIsPrintingMonthly] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
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

  // STATE CHO TÍNH NĂNG CHẤM CÔNG HÀNG LOẠT
  const [showAttendanceCalendar, setShowAttendanceCalendar] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState('date'); // 'date' hoặc 'person'
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(getLocalYYYYMMDD(new Date()));
  const [selectedAttendanceStaffId, setSelectedAttendanceStaffId] = useState(null);
  const [attendanceViewDate, setAttendanceViewDate] = useState(new Date());
  
  const [attendanceBatchData, setAttendanceBatchData] = useState({}); // Dùng cho mode 'date'
  const [personBatchData, setPersonBatchData] = useState({}); // Dùng cho mode 'person'
  
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

  const getItemStatus = (item) => {
    if (!item.tests || !Array.isArray(item.tests) || item.tests.length === 0) return { text: 'Kho chờ', color: 'text-gray-500 bg-gray-100 border-gray-200' };
    const validTests = item.tests.filter(t => t);
    if (validTests.length === 0) return { text: 'Kho chờ', color: 'text-gray-500 bg-gray-100 border-gray-200' };

    const runningTests = validTests.filter(t => t.status === 'Đang chạy');
    if (runningTests.length > 0) {
       const stations = runningTests.map(t => t.equip).join(', ');
       return { text: `Đang chạy (${stations})`, color: 'text-blue-700 bg-blue-50 border-blue-200' };
    }
    const waitingTests = validTests.filter(t => t.status === 'Chờ chạy');
    if (waitingTests.length > 0) {
       return { text: `Chờ ghép chạy`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    const allDone = validTests.every(t => t.status === 'Xong');
    if (allDone) return { text: 'Hoàn thành', color: 'text-green-700 bg-green-50 border-green-200' };
    return { text: 'Đang xử lý', color: 'text-orange-700 bg-orange-50 border-orange-200' };
  };

  const uniqueClients = useMemo(() => {
    const clients = new Set(orders.map(o => o.client));
    return Array.from(clients).sort((a, b) => (a || '').localeCompare(b || '', 'vi'));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      let match = true;
      if (orderSearchTerm) {
         const term = orderSearchTerm.toLowerCase();
         if (!(o.model || '').toLowerCase().includes(term) && !(o.client || '').toLowerCase().includes(term) && !(o.reqId || '').toLowerCase().includes(term)) {
           match = false;
         }
      }
      if (filterClient && o.client !== filterClient) match = false;
      if (filterUrgency && o.urgency !== filterUrgency) match = false;
      if (filterType && categorizeDevice(o.type) !== filterType) match = false;
      if (filterStatus) {
         const status = getItemStatus(o).text;
         if (filterStatus === 'Kho chờ' && status !== 'Kho chờ') match = false;
         if (filterStatus === 'Đang chạy' && !status.includes('Đang chạy')) match = false;
         if (filterStatus === 'Hoàn thành' && status !== 'Hoàn thành') match = false;
      }
      return match;
    });
  }, [orders, orderSearchTerm, filterUrgency, filterType, filterStatus, filterClient]);

  // GỘP ĐƠN KĐ CHỈ THEO CLIENT (Khắc phục lỗi VS04 tách làm nhiều thẻ)
  const groupedOrdersArr = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(o => {
      const groupKey = String(o.client).trim().toUpperCase(); 
      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupId: groupKey,
          reqId: o.reqId, 
          client: o.client,
          deadline: o.deadline,
          urgency: o.urgency,
          items: [],
          totalQty: 0
        };
      }
      groups[groupKey].items.push(o);
      groups[groupKey].totalQty += Number(o.sampleSize || 1);

      if (o.urgency === 'Quá hạn') groups[groupKey].urgency = 'Quá hạn';
      else if (o.urgency === 'Gấp' && groups[groupKey].urgency !== 'Quá hạn') groups[groupKey].urgency = 'Gấp';
    });
    
    return Object.values(groups).map(group => {
      let totalTests = 0;
      let doneTests = 0;
      group.items.forEach(item => {
        if (item.tests && Array.isArray(item.tests)) {
          const valid = item.tests.filter(t => t);
          if (valid.length > 0) {
              totalTests += valid.length;
              doneTests += valid.filter(t => t.status === 'Xong').length;
          } else {
              totalTests += 1;
          }
        } else {
          totalTests += 1; 
        }
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
      case 'MR': 
      case 'TNA-N': 
      case 'TNA-T': 
      default: return true; 
    }
  };

  const handleDeleteAllDuplicates = async () => {
    if (userRole !== 'admin' || !user) return;
    if (!window.confirm("BẠN CÓ CHẮC CHẮN MƯỐN DỌN DẸP?\n\nHệ thống sẽ gộp số lượng các thiết bị giống hệt nhau (Khách hàng + Loại + Model) và xóa đi các dòng thừa.")) return;

    const keptSamples = new Map();
    const keptOrders = new Map();
    const deletePromises = [];
    const updatePromises = [];

    samplesInStock.forEach(sample => {
      const key = `${String(sample.client).trim().toLowerCase()}_${String(sample.type).trim().toLowerCase()}_${String(sample.model).trim().toLowerCase()}`;
      if (!keptSamples.has(key)) {
        keptSamples.set(key, { ...sample, qty: Number(sample.qty || 1) });
      } else {
        const existing = keptSamples.get(key);
        existing.qty += Number(sample.qty || 1);
        deletePromises.push(deleteDoc(getDocument('samplesInStock', sample.id)));
      }
    });

    keptSamples.forEach(sample => {
       const original = samplesInStock.find(s => s.id === sample.id);
       if (original && Number(original.qty) !== sample.qty) {
           updatePromises.push(updateDoc(getDocument('samplesInStock', sample.id), { qty: sample.qty }));
       }
    });

    orders.forEach(order => {
       const key = `${String(order.client).trim().toLowerCase()}_${String(order.type).trim().toLowerCase()}_${String(order.model).trim().toLowerCase()}`;
       if (!keptOrders.has(key)) {
          keptOrders.set(key, { ...order, sampleSize: Number(order.sampleSize || 1) });
       } else {
          const existing = keptOrders.get(key);
          existing.sampleSize += Number(order.sampleSize || 1);
          deletePromises.push(deleteDoc(getDocument('orders', order.id)));
       }
    });

    keptOrders.forEach(order => {
       const original = orders.find(o => o.id === order.id);
       if (original && Number(original.sampleSize) !== order.sampleSize) {
           updatePromises.push(updateDoc(getDocument('orders', order.id), { sampleSize: order.sampleSize }));
       }
    });

    if (deletePromises.length > 0 || updatePromises.length > 0) {
      try {
        await Promise.all([...deletePromises, ...updatePromises]);
        alert(`Thành công! Đã dọn dẹp và gộp xong các mã trùng. Cập nhật được ${deletePromises.length + updatePromises.length} bản ghi.`);
      } catch (err) {
        setErrorMessage("Lỗi khi gộp mã trùng: " + err.message);
      }
    } else {
        alert("Hiện tại dữ liệu đã sạch, không có bản ghi bị chia nhỏ!");
    }
  };

  const exportToCSV = () => {
    let csvContent = "Mã Đơn,Khách Hàng,Loại Thiết Bị,Model,Số Lượng,Hạn Chót,Mức Độ Gấp,Trạng Thái,Trạm Máy Đang Chạy,KTV Phụ Trách\n";
    orders.forEach(order => {
       const statusInfo = getItemStatus(order);
       const validTests = (order.tests || []).filter(t => t);
       const runningTest = validTests.find(t => t.status === 'Đang chạy') || {};
       const eqName = equipments.find(e => e.id === runningTest.equip)?.name || runningTest.equip || '';
       const ktv = runningTest.assignedUser || '';
       const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

       csvContent += `${escapeCsv(order.reqId)},${escapeCsv(order.client)},${escapeCsv(order.type)},${escapeCsv(order.model)},${order.sampleSize},${escapeCsv(order.deadline)},${escapeCsv(order.urgency)},${escapeCsv(statusInfo.text)},${escapeCsv(eqName)},${escapeCsv(ktv)}\n`;
    });
    const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BaoCao_KiemDinh_PTN_${getLocalYYYYMMDD(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        setIsLoading(false);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setIsLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const handleSnapshotError = (err) => { console.error("Firestore Snapshot Error:", err); };

    const unsubPersonnel = onSnapshot(getCol('personnel'), 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length === 0) seedInitialData('personnel'); 
        else setPersonnel(data);
      },
      handleSnapshotError
    );

    const unsubEquipments = onSnapshot(getCol('equipments'), 
      (snapshot) => {
         const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         const coreEquipments = [
           { id: 'TNL-K', name: 'Tunel Khói' }, { id: 'TNL-N', name: 'Tunel Nhiệt' }, { id: 'MR', name: 'Máy Rung' },
           { id: 'TNA-N', name: 'Tủ Nóng ẩm cỡ nhỏ' }, { id: 'TNA-T', name: 'Tủ Nóng ẩm cỡ trung' },
           { id: 'TSO2', name: 'Tủ SO2' }, { id: 'PAS', name: 'Phòng âm thanh + ánh sáng' }
         ];
         coreEquipments.forEach(core => {
             if (!data.some(eq => eq.id === core.id)) setDoc(getDocument('equipments', core.id), core);
         });
         const sortedData = data.sort((a, b) => {
             if (a.id === 'TSO2') return -1;
             if (b.id === 'TSO2') return 1;
             return (a.name || '').localeCompare(b.name || '', 'vi');
         });
         setEquipments(sortedData);
      },
      handleSnapshotError
    );

    const unsubSamples = onSnapshot(getCol('samplesInStock'), 
      (snapshot) => setSamplesInStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      handleSnapshotError
    );
    
    const unsubOrders = onSnapshot(getCol('orders'), 
      (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
      },
      handleSnapshotError
    );

    return () => { unsubPersonnel(); unsubSamples(); unsubEquipments(); unsubOrders(); };
  }, [user]);
  
  const seedInitialData = async (target = 'all') => {
    if (!user) return;
    try {
      if (target === 'all' || target === 'personnel') {
        const pData = [
          { id: 'NV1', name: 'Nguyễn Văn A', role: 'KTV Trưởng', shift: 'Hành Chính', status: 'Đang làm', timesheet: {} },
          { id: 'NV2', name: 'Trần Văn B', role: 'KTV', shift: 'Ca Ngày', status: 'Nghỉ phép', timesheet: {} },
        ];
        for (const item of pData) await setDoc(getDocument('personnel', item.id), item);
      }

      if (target === 'all' || target === 'equipments') {
        const eqData = [
          { id: 'TNL-K', name: 'Tunel Khói' }, { id: 'TNL-N', name: 'Tunel Nhiệt' }, { id: 'MR', name: 'Máy Rung' },
          { id: 'TNA-N', name: 'Tủ Nóng ẩm cỡ nhỏ' }, { id: 'TNA-T', name: 'Tủ Nóng ẩm cỡ trung' },
          { id: 'TSO2', name: 'Tủ SO2' }, { id: 'PAS', name: 'Phòng âm thanh + ánh sáng' }
        ];
        for (const item of eqData) await setDoc(getDocument('equipments', item.id), item);
      }
    } catch (error) { console.error("Lỗi nạp dữ liệu:", error); }
  };

  const handleFileUpload = (e) => {
    const fileInputTarget = e.target; 
    const file = fileInputTarget.files[0];
    if (!file) return;
    setIsUploading(true);
    setErrorMessage('');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!user) throw new Error("Hệ thống chưa kết nối dữ liệu.");
        let text = event.target.result;
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) throw new Error("File trống hoặc không hợp lệ.");
        
        const headerRow = rows[0];
        let separator = ',';
        if (headerRow.includes(';')) separator = ';';
        else if (headerRow.includes('\t')) separator = '\t';
        
        const uploadPromises = [];
        const batchTimestamp = Date.now();
        const clientReqIds = {}; 

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const cols = row.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
          const client = cols[0] || 'Chưa có thông tin';
          
          if (!clientReqIds[client]) {
             clientReqIds[client] = cols[6] || `${client.substring(0, 3).toUpperCase()}-KĐ-${batchTimestamp.toString().slice(-4)}`;
          }
          const finalReqId = clientReqIds[client];
          const type = cols[1] || 'Thiết bị';
          const model = cols[2] || `Model (${i})`;
          const qty = cols[3] || '1';
          const deadline = cols[4] || new Date().toLocaleDateString('vi-VN');
          const urgency = cols[5] || 'Bình thường';
          const timestamp = Date.now() + i;

          const newSample = { id: `K${timestamp}`, client, type, model, qty: parseInt(qty, 10) || 1, status: 'Kho chờ', date: new Date().toLocaleDateString('vi-VN') };
          uploadPromises.push(setDoc(getDocument('samplesInStock', newSample.id), newSample));

          const orderItemId = `O${timestamp}`;
          const newOrder = { id: orderItemId, reqId: finalReqId, client, type, model, sampleSize: parseInt(qty, 10) || 1, deadline, urgency, tests: [] };
          uploadPromises.push(setDoc(getDocument('orders', orderItemId), newOrder));
        }
        await Promise.all(uploadPromises);
      } catch (error) { setErrorMessage("Lỗi xử lý file: " + error.message); } 
      finally { setIsUploading(false); fileInputTarget.value = null; }
    };
    reader.readAsText(file);
  };

  const handlePersonnelFileUpload = (e) => {
    const fileInputTarget = e.target; 
    const file = fileInputTarget.files[0];
    if (!file) return;
    setIsUploadingPersonnel(true);
    setErrorMessage('');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!user) throw new Error("Hệ thống chưa kết nối dữ liệu.");
        let text = event.target.result;
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) throw new Error("File trống hoặc không hợp lệ (Cần dòng tiêu đề).");
        
        const headerRow = rows[0];
        let separator = ',';
        if (headerRow.includes(';')) separator = ';';
        else if (headerRow.includes('\t')) separator = '\t';
        
        const uploadPromises = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const cols = row.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
          const name = cols[0];
          const role = cols[1] || 'KTV';
          const shift = cols[2] || 'Hành Chính'; 
          if (!name) continue; 
          
          const isDuplicate = personnel.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase() && p.role.trim().toLowerCase() === role.trim().toLowerCase());
          if (isDuplicate) continue;
          
          const timestamp = Date.now() + i;
          const id = `NV${timestamp}`;
          uploadPromises.push(setDoc(getDocument('personnel', id), { id, name, role, shift, status: 'Đang làm', timesheet: {} }));
        }
        await Promise.all(uploadPromises);
        setShowAddPersonnel(false);
      } catch (error) { setErrorMessage("Lỗi xử lý file nhân sự: " + error.message); } 
      finally { setIsUploadingPersonnel(false); fileInputTarget.value = null; }
    };
    reader.readAsText(file);
  };

  const handleAddOrder = async () => {
    if (!newOrderData.client.trim() || !newOrderData.model.trim() || !user) return;
    const timestamp = Date.now();
    const reqId = `${newOrderData.client.substring(0, 3).toUpperCase()}-KĐ-${timestamp.toString().slice(-4)}`;
    const finalDeadline = newOrderData.deadline ? new Date(newOrderData.deadline).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN');
    
    const newOrder = { id: `O${timestamp}`, reqId, client: newOrderData.client.trim(), type: newOrderData.type, model: newOrderData.model.trim(), sampleSize: parseInt(newOrderData.sampleSize) || 1, deadline: finalDeadline, urgency: newOrderData.urgency, tests: [] };
    await setDoc(getDocument('orders', newOrder.id), newOrder);
    const newSample = { id: `K${timestamp}`, client: newOrder.client, type: newOrder.type, model: newOrder.model, qty: newOrder.sampleSize, status: 'Kho chờ', date: new Date().toLocaleDateString('vi-VN') };
    await setDoc(getDocument('samplesInStock', newSample.id), newSample);

    setShowAddOrder(false);
    setNewOrderData({ client: '', type: 'Tủ trung tâm', model: '', sampleSize: 1, deadline: '', urgency: 'Mới' });
  };

  const handleSaveEditOrder = async (id) => {
    if (!user) return;
    await updateDoc(getDocument('orders', id), { model: editOrderData.model, sampleSize: parseInt(editOrderData.sampleSize) || 1 });
    setEditingOrderId(null);
  };

  const handleDeleteOrder = async (id) => {
    if (!user) return;
    await deleteDoc(getDocument('orders', id));
    setConfirmDeleteOrderId(null);
  };

  const handleAssignToStation = async (stationId) => {
    if(!selectedOrderIdToAssign || !user) {
      setErrorMessage("Vui lòng chọn thiết bị để chạy máy!");
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    const assignedUser = selectedPersonnelToAssign || 'Chưa phân công';
    const targetOrder = orders.find(o => o.id === selectedOrderIdToAssign);
    if(!targetOrder) return;

    const initialStatus = stationId === 'TSO2' ? 'Chờ chạy' : 'Đang chạy';
    const newTest = { name: 'Kiểm định', status: initialStatus, equip: stationId, assignedUser: assignedUser, startTime: new Date().toISOString() };
    const updatedTests = [...(targetOrder.tests || []), newTest];

    try {
      await updateDoc(getDocument('orders', targetOrder.id), { tests: updatedTests });
      setAssigningStation(null);
      setSelectedOrderIdToAssign('');
      setSelectedPersonnelToAssign('');
    } catch (err) { setErrorMessage("Lỗi gán thiết bị: " + err.message); }
  };

  const getTestsForStation = (stationId) => {
    const waiting = []; const running = []; const history = [];
    orders.forEach(order => {
      if(!order.tests || !Array.isArray(order.tests)) return;
      order.tests.forEach((test, index) => {
        if (!test) return; 
        if (test.equip === stationId) {
          const testData = { ...test, orderId: order.id, reqId: order.reqId, model: order.model, sampleSize: order.sampleSize, testIndex: index, client: order.client };
          if (test.status === 'Chờ chạy') waiting.push(testData);
          else if (test.status === 'Đang chạy') running.push(testData);
          else if (test.status === 'Xong') history.push(testData);
        }
      });
    });
    return { waiting, running, history };
  };

  const markTestAsDone = async (orderId, testIndex) => {
    if(!user) return;
    const targetOrder = orders.find(o => o.id === orderId);
    if(!targetOrder) return;
    const updatedTests = [...targetOrder.tests];
    updatedTests[testIndex].status = 'Xong';
    updatedTests[testIndex].endTime = new Date().toISOString();
    try { await updateDoc(getDocument('orders', orderId), { tests: updatedTests }); } 
    catch (err) { setErrorMessage("Lỗi cập nhật: " + err.message); }
  };

  const changeGroupUrgency = async (groupId, newUrgency) => {
    if (!user || userRole !== 'admin') return;
    const group = groupedOrdersArr.find(g => g.groupId === groupId);
    if (!group) return;
    try {
      const promises = group.items.map(item => updateDoc(getDocument('orders', item.id), { urgency: newUrgency }));
      await Promise.all(promises);
    } catch (err) { setErrorMessage("Lỗi cập nhật trạng thái đơn: " + err.message); }
  };

  const handleRemoveTest = async (orderId, testIndex) => {
    if (userRole !== 'admin') return;
    if (!window.confirm("LƯU Ý: Gỡ thiết bị này ra khỏi trạm máy? Nó sẽ được trả về trạng thái Kho Chờ ban đầu.")) return;
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder || !Array.isArray(targetOrder.tests)) return;
    const updatedTests = [...targetOrder.tests];
    updatedTests.splice(testIndex, 1); 
    try { await updateDoc(getDocument('orders', orderId), { tests: updatedTests }); } 
    catch (err) { setErrorMessage("Lỗi khi gỡ thiết bị: " + err.message); }
  };

  const changePersonnelStatus = async (id, newStatus) => {
    if (!user) return;
    const targetPersonnel = personnel.find(p => p.id === id);
    const currentTimesheet = targetPersonnel?.timesheet || {};
    currentTimesheet[todayStr] = { ...currentTimesheet[todayStr], status: newStatus };
    await updateDoc(getDocument('personnel', id), { status: newStatus, timesheet: currentTimesheet });
  };

  const updatePersonnelNote = async (id, note) => {
    if (!user) return;
    const targetPersonnel = personnel.find(p => p.id === id);
    const currentTimesheet = targetPersonnel?.timesheet || {};
    currentTimesheet[todayStr] = { ...currentTimesheet[todayStr], note: note };
    await updateDoc(getDocument('personnel', id), { timesheet: currentTimesheet });
  };

  const handleAddPersonnel = async () => {
    if (!user || !newPersonnel.name) return;
    const id = 'NV' + Date.now();
    await setDoc(getDocument('personnel', id), { id, name: newPersonnel.name, role: newPersonnel.role, shift: newPersonnel.shift, status: 'Đang làm', timesheet: {} });
    setShowAddPersonnel(false);
    setNewPersonnel({ name: '', role: 'KTV', shift: 'Hành Chính' });
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
    if (!newStationName.trim() || !user || userRole !== 'admin') return;
    const id = 'TR' + Date.now();
    await setDoc(getDocument('equipments', id), { id, name: newStationName.trim() });
    setNewStationName('');
  };

  const handleDeleteStation = async (id, name) => {
    if (userRole !== 'admin') return;
    if (!window.confirm(`Bạn có chắc muốn xóa trạm máy "${name}" không? \nCảnh báo: Các đơn hàng đang chạy trong trạm này có thể bị mất trạng thái hiển thị!`)) return;
    await deleteDoc(getDocument('equipments', id));
  };

  const toggleShift = () => setCurrentShift(prev => prev === 'Ngày' ? 'Đêm' : 'Ngày');
  const handlePrint = () => window.print();

  const handleMonthlyPrint = () => {
    setIsPrintingMonthly(true);
    setTimeout(() => {
        window.print();
        setIsPrintingMonthly(false);
        setShowPrintModal(false);
    }, 300); 
  };

  const activeStaff = useMemo(() => personnel
    .filter(p => p.status === 'Đang làm' || p.status === 'Làm việc')
    .sort((a, b) => {
       const weightA = getRoleWeight(a.role);
       const weightB = getRoleWeight(b.role);
       if (weightA !== weightB) return weightA - weightB;
       return (a.name || '').localeCompare(b.name || '', 'vi');
    }), [personnel]);

  const activePersonnel = useMemo(() => personnel
    .filter(p => p.status !== 'Đã nghỉ việc')
    .sort((a, b) => {
       const weightA = getRoleWeight(a.role);
       const weightB = getRoleWeight(b.role);
       if (weightA !== weightB) return weightA - weightB;
       return (a.name || '').localeCompare(b.name || '', 'vi');
    }), [personnel]);

  const resignedPersonnel = useMemo(() => personnel.filter(p => p.status === 'Đã nghỉ việc'), [personnel]);

  let countHC = 0, countNgay = 0, countDem = 0;
  activeStaff.forEach(p => {
     const s = String(p.shift || 'Hành Chính').toLowerCase();
     if (s.includes('hành chính') || s === 'hc') countHC++;
     else if (s.includes('đêm')) countDem++;
     else countNgay++; 
  });

  const staffLocations = useMemo(() => {
    const locs = {};
    orders.forEach(o => {
      o.tests?.forEach(t => {
          if (!t) return; 
          if (t.status === 'Đang chạy' && t.assignedUser && t.assignedUser !== 'Chưa phân công') {
            if (!locs[t.assignedUser]) locs[t.assignedUser] = new Set();
            const eqName = equipments.find(e => e.id === t.equip)?.name || t.equip;
            locs[t.assignedUser].add(eqName);
          }
      });
    });
    return locs;
  }, [orders, equipments]);

  const dashboardStaff = useMemo(() => activeStaff.filter(p => {
     const s = String(p.shift || 'Hành Chính').toLowerCase();
     const isDayPerson = s.includes('hành chính') || s === 'hc' || s.includes('ngày') || s.includes('part-time') || s.includes('partime');
     
     if (currentShift === 'Ngày') return isDayPerson;
     else {
         const hasMachine = staffLocations[p.name] && staffLocations[p.name].size > 0;
         return !isDayPerson || hasMachine; 
     }
  }), [activeStaff, currentShift, staffLocations]);

  const overdueGroups = groupedOrdersArr.filter(g => g.urgency === 'Quá hạn');
  const urgentGroupsOnly = groupedOrdersArr.filter(g => g.urgency === 'Gấp');
  const runningGroups = groupedOrdersArr.filter(g => g.items.some(item => item.tests && item.tests.some(t => t && t.status === 'Đang chạy')));

  const daysInPrintMonth = new Date(printYear, printMonth, 0).getDate();
  const printDaysArray = Array.from({length: daysInPrintMonth}, (_, i) => {
     const m = String(printMonth).padStart(2, '0');
     return `${printYear}-${m}-${String(i + 1).padStart(2, '0')}`;
  });

  // --- HÀM QUẢN LÝ LỊCH CHẤM CÔNG HÀNG LOẠT (MỚI NÂNG CẤP) ---
  useEffect(() => {
      if (showAttendanceCalendar && attendanceMode === 'date') {
          const batch = {};
          activePersonnel.forEach(p => {
              const status = p.timesheet?.[selectedAttendanceDate]?.status;
              const note = p.timesheet?.[selectedAttendanceDate]?.note;
              if (status === 'Đang làm' || status === 'Làm việc') batch[p.id] = 'V';
              else if (status === 'Nghỉ phép' || status === 'Nghỉ' || status === 'Vắng mặt') batch[p.id] = 'X';
              else if (status === 'Part-time') {
                  const hm = note && note.match(/(\d+)/);
                  batch[p.id] = `P-${hm ? hm[1] : '4'}`; // Trích xuất số giờ
              }
              else batch[p.id] = ''; 
          });
          setAttendanceBatchData(batch);
      } else if (showAttendanceCalendar && attendanceMode === 'person') {
          setPersonBatchData({});
      }
  }, [showAttendanceCalendar, selectedAttendanceDate, attendanceMode, selectedAttendanceStaffId, activePersonnel]);

  const handleMarkStaff = (staffId, mark) => {
      setAttendanceBatchData(prev => {
          const isSameMark = prev[staffId] === mark;
          // Nếu bấm lại V hoặc X thì xóa. Nếu bấm Ca (P) thì kệ để có thể chọn select
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
          else if (st === 'Part-time') {
              const hm = nt && nt.match(/(\d+)/);
              currentMark = `P-${hm ? hm[1] : '4'}`;
          }
          else currentMark = '';
      }
      
      // LOGIC BẤM LẦN 3 SANG MÀU VÀNG
      let nextStatus = '';
      if (currentMark === '') nextStatus = 'V';         // Lần 1: Xanh
      else if (currentMark === 'V') nextStatus = 'X';   // Lần 2: Đỏ
      else if (currentMark === 'X') nextStatus = 'P-4'; // Lần 3: Vàng (Mặc định 4 tiếng)
      else if (currentMark.startsWith('P')) nextStatus = ''; // Lần 4: Xóa

      setPersonBatchData(prev => ({ ...prev, [dateStr]: nextStatus }));
  };

  const handleSaveBatchAttendance = async () => {
      if (!user) return;
      try {
          const promises = activePersonnel.map(p => {
              const mark = attendanceBatchData[p.id];
              if (mark === undefined) return Promise.resolve(); // Bỏ qua nếu không có tương tác
              
              let newStatus = '';
              let newNote = p.timesheet?.[selectedAttendanceDate]?.note || '';
              
              if (mark === 'V') newStatus = 'Đang làm';
              else if (mark === 'X') newStatus = 'Nghỉ phép';
              else if (mark.startsWith('P')) {
                  newStatus = 'Part-time';
                  newNote = `Làm ${mark.split('-')[1]} tiếng`;
              }
              
              const currentTimesheet = { ...(p.timesheet || {}) };
              if (newStatus === '') {
                  delete currentTimesheet[selectedAttendanceDate];
              } else {
                  currentTimesheet[selectedAttendanceDate] = {
                      ...(currentTimesheet[selectedAttendanceDate] || {}),
                      status: newStatus,
                      ...(mark.startsWith('P') && { note: newNote })
                  };
              }
              return updateDoc(getDocument('personnel', p.id), { timesheet: currentTimesheet });
          });
          
          await Promise.all(promises);
          alert("Đã lưu lịch chấm công thành công!");
          setShowAttendanceCalendar(false);
          setPinnedTooltip(null);
      } catch (error) {
          console.error(error);
          alert("Có lỗi xảy ra khi lưu chấm công!");
      }
  };

  const handleSavePersonAttendance = async () => {
      if (!user || !selectedAttendanceStaffId) return;
      try {
          const staff = activePersonnel.find(p => p.id === selectedAttendanceStaffId);
          const currentTimesheet = { ...(staff.timesheet || {}) };
          
          let hasChanges = false;
          Object.keys(personBatchData).forEach(dateStr => {
              const mark = personBatchData[dateStr];
              if (mark === 'V') {
                  currentTimesheet[dateStr] = { ...(currentTimesheet[dateStr] || {}), status: 'Đang làm' };
                  hasChanges = true;
              } else if (mark === 'X') {
                  currentTimesheet[dateStr] = { ...(currentTimesheet[dateStr] || {}), status: 'Nghỉ phép' };
                  hasChanges = true;
              } else if (mark.startsWith('P')) {
                  const hours = mark.split('-')[1] || '4';
                  currentTimesheet[dateStr] = { ...(currentTimesheet[dateStr] || {}), status: 'Part-time', note: `Làm ${hours} tiếng` };
                  hasChanges = true;
              } else if (mark === '') {
                  delete currentTimesheet[dateStr];
                  hasChanges = true;
              }
          });
          
          if (!hasChanges) {
              alert("Không có thay đổi nào để lưu!");
              return;
          }

          await updateDoc(getDocument('personnel', staff.id), { timesheet: currentTimesheet });
          alert(`Đã lưu toàn bộ các ngày cho nhân sự ${staff.name}!`);
          setPersonBatchData({});
      } catch (error) {
          console.error(error);
          alert("Có lỗi xảy ra khi lưu chấm công!");
      }
  };

  // =========================================================================
  // 🚀 MÀN HÌNH ĐĂNG NHẬP
  // =========================================================================
  if (!userRole) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
           <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
             <ShieldAlert size={40} className="text-blue-700" />
           </div>
           <h1 className="text-3xl font-black text-gray-800 mb-1 tracking-tight">PTN PCCC</h1>
           <p className="text-sm font-semibold text-gray-500 mb-8 uppercase tracking-widest">Hệ thống Điều phối</p>
           
           <button onClick={() => setUserRole('ktv')} className="w-full flex items-center justify-center gap-3 bg-blue-50 text-blue-700 border border-blue-200 font-bold py-3.5 rounded-xl mb-6 hover:bg-blue-100 transition shadow-sm">
              <Users size={20}/> Kỹ Thuật Viên (Vào thẳng)
           </button>
           
           <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">Dành cho Quản lý</span>
              <div className="flex-grow border-t border-gray-200"></div>
           </div>

           <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
             <div className="relative">
               <KeyRound size={18} className="absolute left-3 top-3.5 text-gray-400"/>
               <input type="password" placeholder="Nhập mã PIN..." value={adminPin} onChange={e => {setAdminPin(e.target.value); setShowLoginError(false);}} className="w-full border border-gray-300 pl-10 pr-4 py-3 rounded-lg mb-2 text-center text-lg tracking-[0.5em] focus:ring-2 focus:ring-gray-800 outline-none shadow-sm bg-white font-mono"/>
             </div>
             {showLoginError && <p className="text-red-500 text-xs font-bold mb-2 animate-bounce">Mã PIN không chính xác!</p>}
             <button onClick={() => { if (adminPin === '686868') setUserRole('admin'); else setShowLoginError(true); }} className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white font-bold py-3.5 rounded-lg hover:bg-gray-900 transition shadow-md">
                Đăng nhập Admin
             </button>
           </div>
           <p className="text-[10px] text-gray-400 mt-6 italic">Ghi chú: Mã PIN mẫu là 686868</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <RefreshCw size={40} className="text-blue-500 animate-spin mb-4" />
        <p className="text-gray-600 font-medium text-sm">Đang kết nối Máy chủ Lab...</p>
      </div>
    );
  }

  return (
    <>
    {isPrintingMonthly && <style dangerouslySetInnerHTML={{__html: `@page { size: landscape; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}} />}

    {/* BẢNG CHẤM CÔNG THÁNG (CHỈ HIỆN KHI IN) */}
    <div className={`hidden ${isPrintingMonthly ? 'print:block' : ''} bg-white w-full text-black font-sans`}>
        <div className="text-center mb-6">
            <h1 className="text-xl font-black">CÔNG TY / PHÒNG THÍ NGHIỆM PCCC</h1>
            <h2 className="text-2xl font-bold mt-2">BẢNG CHẤM CÔNG THÁNG {printMonth}/{printYear}</h2>
            <p className="text-sm mt-1 italic">Ngày xuất bảng: {new Date().toLocaleDateString('vi-VN')}</p>
        </div>

        <table className="w-full border-collapse border border-black text-[10px]">
            <thead>
                <tr className="bg-gray-100">
                    <th className="border border-black p-1 w-6">STT</th>
                    <th className="border border-black p-1 text-left min-w-[100px]">Họ và Tên</th>
                    <th className="border border-black p-1 min-w-[60px]">Chức vụ</th>
                    {printDaysArray.map((_, i) => <th key={i} className="border border-black p-1 w-5">{i + 1}</th>)}
                    <th className="border border-black p-1 w-10 text-xs">Tổng Công</th>
                    <th className="border border-black p-1 w-10 text-xs text-indigo-700">Tổng TC</th>
                    <th className="border border-black p-1 min-w-[80px]">Ghi chú trong tháng</th>
                </tr>
            </thead>
            <tbody>
                {activePersonnel.map((p, index) => {
                    let totalCong = 0, totalTC = 0; const notes = [];
                    const cells = printDaysArray.map(dateStr => {
                        const dayData = p.timesheet?.[dateStr];
                        const status = dayData?.status;
                        const isOvertime = dayData?.isOvertime;
                        let mark = '';
                        if (status === 'Đang làm' || status === 'Làm việc') { mark = isOvertime ? 'TC' : 'X'; totalCong += 1; if (isOvertime) totalTC += 1; } 
                        else if (status === 'Nghỉ phép' || status === 'Nghỉ') { mark = 'P'; } 
                        else if (status === 'Part-time') { mark = 'Ca'; totalCong += 1; }
                        else if (status === 'Vắng mặt' || status === 'Nghỉ không phép') { mark = 'V'; }
                        if (dayData?.note) notes.push(`Ngày ${dateStr.split('-')[2]}: ${dayData.note}`);
                        return <td key={dateStr} className={`border border-black p-1 text-center font-bold ${mark === 'TC' ? 'text-indigo-600' : (mark==='P' ? 'text-amber-600' : (mark==='V' ? 'text-red-600' : 'text-green-700'))}`}>{mark}</td>;
                    });
                    return (
                        <tr key={p.id}>
                            <td className="border border-black p-1 text-center">{index + 1}</td>
                            <td className="border border-black p-1 font-bold">{p.name}</td>
                            <td className="border border-black p-1 text-center text-[9px]">{p.role}</td>
                            {cells}
                            <td className="border border-black p-1 text-center font-black text-sm">{totalCong}</td>
                            <td className="border border-black p-1 text-center font-black text-sm text-indigo-600">{totalTC}</td>
                            <td className="border border-black p-1 text-[8px] truncate max-w-[120px]" title={notes.join(' | ')}>{notes.join('; ')}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        <div className="flex justify-around mt-10">
            <div className="text-center"><p className="font-bold text-sm mb-16">Người lập bảng</p><p className="text-xs">(Ký và ghi rõ họ tên)</p></div>
            <div className="text-center"><p className="font-bold text-sm mb-16">Quản lý / Giám đốc</p><p className="text-xs">(Ký và ghi rõ họ tên)</p></div>
        </div>
        <div className="mt-8 text-[9px] italic text-gray-600">* Ký hiệu: X (Đi làm/Hành chính) | TC (Tăng ca) | Ca (Làm part-time) | P (Nghỉ phép) | V (Vắng mặt)</div>
    </div>

    {/* GIAO DIỆN CHÍNH CỦA APP */}
    <div className={`flex h-screen w-full bg-gray-50 font-sans overflow-hidden ${isPrintingMonthly ? 'print:hidden' : ''}`}>
      
      {/* SIDEBAR PC */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 z-20 shadow-sm print:hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <div className="bg-blue-700 text-white p-2 rounded-lg"><ShieldAlert size={24} /></div>
          <div>
             <h1 className="text-xl font-black text-blue-900 tracking-tight leading-none">PTN PCCC</h1>
             <p className="text-[10px] text-blue-500 font-bold uppercase mt-1 tracking-wider">Trạm Chỉ Huy</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon; const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium'}`}>
                <Icon size={20} className={isActive ? 'text-blue-600' : 'text-gray-400'} />{item.label}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3">
           <div className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-lg shadow-sm">
             <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${userRole === 'admin' ? 'bg-indigo-600' : 'bg-emerald-500'}`}>{userRole === 'admin' ? 'AD' : 'KTV'}</div>
                <div className="text-xs font-bold text-gray-700">{userRole === 'admin' ? 'Quản lý' : 'Kỹ thuật viên'}</div>
             </div>
             <button onClick={() => {setUserRole(null); setAdminPin('');}} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><LogOut size={16}/></button>
           </div>
           <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-100"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>Đã kết nối Máy chủ</div>
        </div>
      </aside>

      {/* KHU VỰC NỘI DUNG CHÍNH */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative print:block print:h-auto print:overflow-visible print:bg-white print:w-full print:m-0 print:p-0">
        <header className="bg-blue-800 md:bg-white text-white md:text-gray-800 p-4 shadow-md md:shadow-sm md:border-b md:border-gray-200 z-10 flex justify-between items-center print:hidden">
          <div className="md:hidden flex flex-col">
            <h1 className="text-lg font-bold flex items-center gap-2">PTN PCCC<span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${userRole === 'admin' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-emerald-500 text-white border-emerald-600'}`}>{userRole === 'admin' ? 'ADMIN' : 'KTV'}</span></h1>
            <p className="text-[10px] text-blue-200 mt-0.5">Live Data - Đã kết nối</p>
          </div>
          <div className="hidden md:flex items-center gap-2"><h2 className="text-xl font-bold text-gray-800">{navItems.find(i => i.id === activeTab)?.label}</h2></div>
          <div className="flex md:hidden"><button onClick={() => {setUserRole(null); setAdminPin('');}} className="p-2 bg-blue-700 rounded-lg text-white"><LogOut size={16}/></button></div>
          <div className="hidden md:flex items-center gap-4">
             {userRole === 'admin' && (<button onClick={exportToCSV} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-bold text-sm transition"><FileSpreadsheet size={16}/> Xuất Báo Cáo</button>)}
             <div className="h-6 w-px bg-gray-200 mx-1"></div>
             <div className="text-right">
                <div className="text-sm font-bold text-gray-800">{currentTime.toLocaleTimeString('vi-VN')}</div>
                <div className="text-[10px] text-gray-500 uppercase font-semibold">{currentTime.toLocaleDateString('vi-VN')}</div>
             </div>
             <div className="h-8 w-px bg-gray-200"></div>
             <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                {currentShift === 'Ngày' ? <Sun size={16} className="text-amber-500"/> : <Moon size={16} className="text-indigo-500"/>}
                <span className="text-sm font-bold text-blue-800">Ca {currentShift}</span>
             </div>
          </div>
        </header>

        {errorMessage && (
          <div className="mx-4 mt-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded shadow-sm relative text-sm z-10 print:hidden">
            <button onClick={() => setErrorMessage('')} className="absolute top-1 right-1 p-1 text-red-500"><XCircle size={16}/></button>
            <p className="font-bold flex items-center gap-1"><AlertTriangle size={14}/> Lỗi Hệ Thống:</p><p className="mt-1 font-medium">{errorMessage}</p>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-6 print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          
          {/* TỔNG QUAN */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 lg:space-y-6 print:hidden max-w-7xl mx-auto">
              {/* ... (Giữ nguyên phần Tổng quan) ... */}
              {userRole === 'admin' && (
                <div className="md:hidden flex justify-between gap-2">
                   <button onClick={exportToCSV} className="flex-1 flex justify-center items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2.5 rounded-xl font-bold text-sm shadow-sm"><Download size={16}/> Xuất Excel</button>
                </div>
              )}

              <div className="md:hidden bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                 <div className="text-2xl font-black text-gray-800 tracking-tight flex justify-center items-center gap-2"><Clock size={24} className="text-blue-600"/>{currentTime.toLocaleTimeString('vi-VN')}</div>
                 <div className="text-sm font-semibold text-gray-500 mt-1 uppercase">{currentTime.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                 <div className="mt-3 flex flex-col items-center gap-1">
                    <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
                       {currentShift === 'Ngày' ? <Sun size={16} className="text-amber-500"/> : <Moon size={16} className="text-indigo-500"/>}
                       <span className="text-sm font-bold text-blue-800">CA LÀM VIỆC: {currentShift.toUpperCase()}</span>
                       <button onClick={toggleShift} className="ml-2 text-[10px] bg-white border px-2 py-0.5 rounded text-gray-600 hover:bg-gray-50">Đổi</button>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500">{currentShift === 'Ngày' ? '(08h30 - 17h30)' : '(18h30 - 02h30)'}</span>
                 </div>
              </div>

              <div className="hidden md:flex justify-end mb-2">
                 <button onClick={toggleShift} className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-sm font-bold hover:bg-gray-50 transition">Đổi sang Ca {currentShift === 'Ngày' ? 'Đêm' : 'Ngày'}</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                 <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div onClick={() => {setOrderModalFilter('Quá hạn'); setShowOrderModal(true);}} className="cursor-pointer p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 hover:shadow-md transition flex flex-col justify-center items-center text-center relative overflow-hidden h-full">
                       <AlertTriangle size={32} className="mb-2 animate-pulse" />
                       <span className="font-black text-4xl">{overdueGroups.length}</span>
                       <span className="text-xs font-bold mt-1">ĐƠN QUÁ HẠN</span>
                    </div>
                    <div onClick={() => {setOrderModalFilter('Gấp'); setShowOrderModal(true);}} className="cursor-pointer p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 hover:shadow-md transition flex flex-col justify-center items-center text-center h-full">
                       <span className="font-black text-4xl">{urgentGroupsOnly.length}</span>
                       <span className="text-xs font-bold mt-1 mb-2">ĐƠN GẤP</span>
                       {urgentGroupsOnly.length > 0 ? (<div className="text-[10px] bg-white px-2 py-1.5 rounded border border-amber-200 w-full truncate shadow-sm">VD: {urgentGroupsOnly[0].client} - {urgentGroupsOnly[0].reqId}</div>) : (<div className="text-[10px] opacity-60">Không có đơn gấp</div>)}
                    </div>
                    <div onClick={() => {setOrderModalFilter('Đang chạy'); setShowOrderModal(true);}} className="cursor-pointer p-4 rounded-xl border border-green-300 bg-green-50 text-green-700 hover:shadow-md transition flex flex-col justify-center items-center text-center h-full">
                       <Activity size={32} className="mb-2" />
                       <span className="font-black text-4xl">{runningGroups.length}</span>
                       <span className="text-xs font-bold mt-1">ĐƠN ĐANG CHẠY</span>
                    </div>
                 </div>

                 <div onClick={() => { setIsOrderDetailsExpanded(true); document.getElementById('details-section')?.scrollIntoView({behavior: 'smooth'}); }} className="cursor-pointer p-6 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:shadow-md transition flex flex-col justify-center items-center text-center h-full min-h-[160px]">
                    <ClipboardList size={36} className="mb-2 opacity-80"/>
                    <span className="font-black text-5xl">{groupedOrdersArr.length}</span>
                    <span className="text-sm font-bold mt-1">TỔNG ĐƠN HÀNG</span>
                    <span className="text-[10px] mt-2 bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200 font-semibold">Bấm để xem tất cả</span>
                 </div>
              </div>

              {/* MODAL QUẢN LÝ ĐƠN HÀNG (Dashboard) */}
              {showOrderModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
                      <h2 className="text-lg font-black text-gray-800 flex items-center gap-2"><ListFilter size={20} className="text-blue-600"/> Trạng thái Đơn</h2>
                      <button onClick={() => setShowOrderModal(false)} className="p-2 bg-gray-200 hover:bg-red-100 hover:text-red-600 rounded-full transition"><X size={20}/></button>
                    </div>
                    <div className="flex border-b border-gray-200 bg-white overflow-x-auto shrink-0">
                      <button onClick={() => setOrderModalFilter('Quá hạn')} className={`flex-1 py-3 px-2 text-sm font-bold whitespace-nowrap transition ${orderModalFilter === 'Quá hạn' ? 'border-b-2 border-red-500 text-red-600 bg-red-50' : 'text-gray-500 hover:bg-gray-50'}`}>Quá hạn ({overdueGroups.length})</button>
                      <button onClick={() => setOrderModalFilter('Gấp')} className={`flex-1 py-3 px-2 text-sm font-bold whitespace-nowrap transition ${orderModalFilter === 'Gấp' ? 'border-b-2 border-amber-500 text-amber-600 bg-amber-50' : 'text-gray-500 hover:bg-gray-50'}`}>Gấp ({urgentGroupsOnly.length})</button>
                      <button onClick={() => setOrderModalFilter('Đang chạy')} className={`flex-1 py-3 px-2 text-sm font-bold whitespace-nowrap transition ${orderModalFilter === 'Đang chạy' ? 'border-b-2 border-green-500 text-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-50'}`}>Đang chạy ({runningGroups.length})</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                       {(() => {
                          let displayGroups = [];
                          if (orderModalFilter === 'Quá hạn') displayGroups = overdueGroups;
                          else if (orderModalFilter === 'Gấp') displayGroups = urgentGroupsOnly;
                          else if (orderModalFilter === 'Đang chạy') displayGroups = runningGroups;
                          if (displayGroups.length === 0) return <div className="text-center text-gray-400 py-10 font-medium">Không có đơn hàng nào trong nhóm này.</div>;

                          return displayGroups.map(group => (
                             <div key={group.groupId} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-blue-300 transition">
                                <div>
                                   <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">MÃ: {group.reqId}</span>
                                      <span className="text-xs text-gray-500 font-medium"><Calendar size={12} className="inline mr-1 -mt-0.5"/>Hạn: {group.deadline}</span>
                                   </div>
                                   <div className="text-base font-black text-gray-800">{group.client}</div>
                                   <div className="text-xs text-gray-600 mt-1">Tổng SL: <span className="font-bold text-blue-600">{group.totalQty}</span> thiết bị &bull; Tiến độ: {group.progress}%</div>
                                </div>
                                {userRole === 'admin' ? (
                                  <div className="flex flex-col gap-1 items-end shrink-0">
                                     <label className="text-[10px] font-bold uppercase text-gray-400">Đổi trạng thái thành:</label>
                                     <select value={group.urgency} onChange={(e) => changeGroupUrgency(group.groupId, e.target.value)} className="text-sm font-bold border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-200 focus:outline-none min-w-[140px] cursor-pointer hover:border-blue-400">
                                        <option value="Gấp">Gấp</option><option value="Quá hạn">Quá hạn</option><option value="Bình thường">Bình thường</option><option value="Mới">Mới</option>
                                     </select>
                                  </div>
                                ) : (
                                  <div className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm font-bold text-gray-600 border border-gray-200 shrink-0">{group.urgency}</div>
                                )}
                             </div>
                          ));
                       })()}
                    </div>
                  </div>
                </div>
              )}

              <div id="details-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 pt-4">
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
                    <button onClick={() => setIsOrderDetailsExpanded(!isOrderDetailsExpanded)} className="w-full bg-gray-100 px-4 py-3 lg:py-4 border-b border-gray-200 flex justify-between items-center focus:outline-none transition hover:bg-gray-200">
                       <div className="flex items-center gap-2"><Archive size={18} className="text-gray-600"/><h3 className="font-bold text-sm lg:text-base text-gray-800">Chi tiết Từng Đơn Hàng ({groupedOrdersArr.length})</h3></div>
                       <div className="flex items-center gap-2"><span className="text-xs text-gray-500 font-medium">Bấm để {isOrderDetailsExpanded ? 'thu gọn' : 'xem'}</span>{isOrderDetailsExpanded ? <ChevronUp size={16} className="text-gray-600"/> : <ChevronDown size={16} className="text-gray-600"/>}</div>
                    </button>
                    {isOrderDetailsExpanded && (
                      <div className="p-3 lg:p-4 space-y-3 bg-white max-h-[600px] overflow-y-auto">
                         {groupedOrdersArr.length === 0 && <p className="text-xs italic text-gray-500 text-center py-2">Chưa có đơn hàng nào.</p>}
                         {groupedOrdersArr.map(group => {
                            const typeCounts = {};
                            group.items.forEach(item => { const cat = categorizeDevice(item.type); typeCounts[cat] = (typeCounts[cat] || 0) + (item.sampleSize || 1); });
                            return (
                               <div key={group.groupId} className="border border-gray-100 rounded-lg bg-gray-50 p-3 lg:p-4 transition hover:shadow-md">
                                  <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2 lg:mb-3">
                                     <div className="font-bold text-sm lg:text-base text-indigo-900">{group.client}</div>
                                     <div className="flex items-center gap-2">
                                        <div className="text-[10px] lg:text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 lg:py-1 rounded font-bold">{group.reqId}</div>
                                        {userRole === 'admin' ? (
                                           <select value={group.urgency} onChange={(e) => changeGroupUrgency(group.groupId, e.target.value)} className={`text-[10px] lg:text-xs font-bold px-2 py-0.5 lg:py-1 rounded border outline-none cursor-pointer shadow-sm ${group.urgency === 'Gấp' || group.urgency === 'Quá hạn' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                                              <option value="Mới">Mới</option><option value="Bình thường">Bình thường</option><option value="Gấp">Gấp</option><option value="Quá hạn">Quá hạn</option>
                                           </select>
                                        ) : (<div className={`text-[10px] lg:text-xs font-bold px-2 py-0.5 lg:py-1 rounded border ${group.urgency === 'Gấp' || group.urgency === 'Quá hạn' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{group.urgency}</div>)}
                                     </div>
                                  </div>
                                  <div className="text-xs lg:text-sm space-y-2">
                                     <div className="font-semibold text-gray-700">Tổng SL: <span className="text-blue-600 text-sm lg:text-base font-black">{group.totalQty}</span> thiết bị</div>
                                     <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 text-[10px] lg:text-xs text-gray-600">
                                        {Object.entries(typeCounts).map(([typeName, qty]) => (<div key={typeName} className="bg-white px-2 py-1.5 rounded border border-gray-100 flex justify-between shadow-sm items-center"><span className="truncate pr-2" title={typeName}>{typeName}</span><span className="font-bold text-gray-800 text-sm">{qty}</span></div>))}
                                     </div>
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                    )}
                 </div>

                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
                    <button onClick={() => setIsPersonnelExpanded(!isPersonnelExpanded)} className="w-full bg-gray-100 px-4 py-3 lg:py-4 border-b border-gray-200 flex flex-col items-start gap-1 focus:outline-none transition hover:bg-gray-200">
                       <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-2"><Users size={18} className="text-gray-600"/><h3 className="font-bold text-sm lg:text-base text-gray-800">Nhân sự đi làm: {activeStaff.length} người</h3></div>
                          <div className="flex items-center gap-1">{isPersonnelExpanded ? <ChevronUp size={16} className="text-gray-600"/> : <ChevronDown size={16} className="text-gray-600"/>}</div>
                       </div>
                       <div className="text-[11px] lg:text-xs font-semibold text-blue-700 text-left pl-6 lg:pl-7">Hành chính: {countHC} &bull; Ca Ngày: {countNgay} &bull; Ca Đêm: {countDem}</div>
                    </button>
                    {isPersonnelExpanded && (
                      <div className="p-3 lg:p-4 max-h-[600px] overflow-y-auto">
                         {dashboardStaff.length === 0 && <p className="text-xs italic text-gray-500 text-center">Không có ai trực ca này.</p>}
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-3">
                            {dashboardStaff.map(p => {
                               const locs = staffLocations[p.name];
                               const hasMachine = locs && locs.size > 0;
                               const locString = hasMachine ? Array.from(locs).join(', ') : '';
                               const s = String(p.shift || 'Hành Chính').toLowerCase();
                               const isDayPerson = s.includes('hành chính') || s === 'hc' || s.includes('ngày');
                               const isNightPerson = s.includes('đêm');
                               const isPartTime = s.includes('part-time') || s.includes('partime');
                               const todayData = p.timesheet?.[todayStr];
                               const isLeave = todayData?.status === 'Nghỉ phép' || todayData?.status === 'Nghỉ' || todayData?.status === 'Vắng mặt';
                               const isExplicitOvertime = todayData?.isOvertime === true;
                               const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
                               const isDayHours = currentMins >= 510 && currentMins <= 1050; // 08:30 - 17:30
                               const isNightHours = currentMins >= 1110 || currentMins <= 150; // 18:30 - 02:30
                               const isWorkingHours = (isDayPerson && isDayHours) || (isNightPerson && isNightHours);
                               const isCurrentlyWorking = isWorkingHours || isExplicitOvertime || hasMachine;
                               const isOvertimeBadge = isExplicitOvertime || (!isWorkingHours && hasMachine);

                               let shiftTimeStr = "";
                               if (isDayPerson) shiftTimeStr = " (08h30-17h30)";
                               else if (isNightPerson) shiftTimeStr = " (18h30-02h30)";

                               let statusBadge;
                               if (isLeave) { statusBadge = (<div className="text-[10px] lg:text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 lg:px-3 py-1 rounded shadow-sm mt-2">Nghỉ</div>); } 
                               else if (hasMachine) { statusBadge = (<div className={`text-[10px] lg:text-xs font-semibold px-2 lg:px-3 py-1 rounded truncate shadow-sm mt-2 text-blue-700 bg-blue-50 border border-blue-200`}>{locString}</div>); } 
                               else if (isCurrentlyWorking || isPartTime) { statusBadge = (<div className="text-[10px] lg:text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 lg:px-3 py-1 rounded flex items-center justify-center gap-1.5 shadow-sm mt-2"><span className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-emerald-500 animate-pulse"></span> Đang làm việc</div>); } 
                               else { statusBadge = (<div className="text-[10px] lg:text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 lg:px-3 py-1 rounded shadow-sm mt-2">Hết giờ làm</div>); }

                               return (
                                  <div key={p.id} className="flex items-center justify-between bg-blue-50/30 p-2 lg:p-3 rounded-lg border border-blue-50 transition hover:bg-blue-50">
                                     <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 p-2 rounded-full"><Briefcase size={16} className="text-blue-600"/></div>
                                        <div>
                                           <div className="text-xs lg:text-sm font-bold text-gray-800 flex items-center gap-2">{p.name}{isOvertimeBadge && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Tăng ca</span>}</div>
                                           <div className="text-[9px] lg:text-[11px] text-gray-500 uppercase mt-0.5">{p.role} &bull; {p.shift}{shiftTimeStr}</div>
                                        </div>
                                     </div>
                                     <div className="text-right max-w-[50%]">{statusBadge}</div>
                                  </div>
                               );
                            })}
                         </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          )}

          {/* ĐƠN KĐ */}
          {activeTab === 'orders' && (
            <div className="max-w-7xl mx-auto flex flex-col h-full print:block">
              <div className="flex flex-col md:flex-row gap-3 mb-4 print:hidden">
                 <div className="relative flex-1">
                    <input type="text" placeholder="Tìm Khách hàng, Model, Mã đơn..." value={orderSearchTerm} onChange={(e) => setOrderSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"/>
                    <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                 </div>
                 <div className="flex gap-2 flex-wrap md:flex-nowrap">
                    {userRole === 'admin' && (<button onClick={() => setShowAddOrder(!showAddOrder)} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border shadow-sm transition-colors bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100">{showAddOrder ? <X size={18}/> : <PlusCircle size={18}/>}<span className="hidden md:inline">{showAddOrder ? 'Đóng form' : 'Thêm Đơn'}</span></button>)}
                    <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border shadow-sm transition-colors ${showFilters || filterUrgency || filterType || filterStatus || filterClient ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}><Filter size={18}/> Bộ Lọc</button>
                    {userRole === 'admin' && (<button onClick={handlePrint} className="hidden md:flex items-center justify-center gap-2 bg-gray-800 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-900 transition shadow-sm"><Printer size={18} /> In Phiếu</button>)}
                 </div>
              </div>

              {showAddOrder && userRole === 'admin' && (
                 <div className="bg-white p-4 lg:p-6 rounded-xl border border-blue-200 shadow-md mb-6 animate-in slide-in-from-top-4 print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                        <input type="text" placeholder="Khách hàng..." value={newOrderData.client} onChange={e => setNewOrderData({...newOrderData, client: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm" />
                        <input type="text" placeholder="Model thiết bị..." value={newOrderData.model} onChange={e => setNewOrderData({...newOrderData, model: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm" />
                        <select value={newOrderData.type} onChange={e => setNewOrderData({...newOrderData, type: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm">
                            <option value="Tủ trung tâm">Tủ trung tâm</option><option value="Đầu báo khói">Đầu báo khói</option><option value="Đầu báo nhiệt">Đầu báo nhiệt</option><option value="Chuông báo cháy">Chuông báo cháy</option><option value="Đèn báo cháy">Đèn báo cháy</option><option value="Nút ấn báo cháy">Nút ấn báo cháy</option><option value="Còi đèn kết hợp">Còi đèn kết hợp</option>
                        </select>
                        <input type="number" placeholder="Số lượng" value={newOrderData.sampleSize} onChange={e => setNewOrderData({...newOrderData, sampleSize: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm" />
                        <input type="date" value={newOrderData.deadline} onChange={e => setNewOrderData({...newOrderData, deadline: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm" />
                        <select value={newOrderData.urgency} onChange={e => setNewOrderData({...newOrderData, urgency: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm">
                            <option value="Mới">Mới</option><option value="Bình thường">Bình thường</option><option value="Gấp">Gấp</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAddOrder(false)} className="px-4 py-2.5 rounded-lg text-sm font-bold bg-gray-100">Hủy</button>
                        <button onClick={handleAddOrder} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600">Lưu Đơn</button>
                    </div>
                 </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-4 print:space-y-6 print:overflow-visible pb-10">
                 {groupedOrdersArr.length === 0 && <p className="text-center text-gray-500 italic mt-10">Không tìm thấy đơn hàng.</p>}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 print:grid-cols-1 print:gap-4">
                   {groupedOrdersArr.map(group => {
                     const itemsByType = {};
                     group.items.forEach(item => { if(!itemsByType[item.type]) itemsByType[item.type] = []; itemsByType[item.type].push(item); });
                     let borderColor = group.urgency === 'Gấp' || group.urgency === 'Quá hạn' ? 'border-red-300 bg-red-50/10' : (group.urgency === 'Mới' ? 'border-emerald-300' : 'border-gray-200');

                     return (
                       <div key={group.groupId} className={`p-4 rounded-xl shadow-sm border bg-white ${borderColor} flex flex-col`}>
                         <div className="flex justify-between items-start border-b border-gray-200 pb-3 mb-3">
                           <div className="flex-1">
                             <div className="flex flex-wrap items-center gap-2 mb-1"><span className="text-xs font-black text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">MÃ: {group.reqId}</span></div>
                             <h3 className="font-bold text-gray-900 text-sm">{group.client}</h3>
                           </div>
                           <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                             <span className="text-[10px] font-bold text-gray-500"><Calendar size={10} className="inline"/> {group.deadline}</span>
                             <span className="text-xs font-bold text-blue-600">{group.progress}%</span>
                           </div>
                         </div>
                         <div className="space-y-3 flex-1 overflow-y-auto">
                           {Object.entries(itemsByType).map(([type, items]) => (
                             <div key={type} className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                               <div className="bg-gray-200/50 px-3 py-1.5 text-[11px] font-bold text-gray-700 uppercase border-b border-gray-100"><Layers size={12} className="inline mr-1"/>{type}</div>
                               <div className="p-2 space-y-2">
                                 {items.map(item => {
                                   const statusInfo = getItemStatus(item);
                                   return (
                                     <div key={item.id} className="flex flex-col gap-2 border-b border-gray-100 last:border-0 pb-3 last:pb-0 pt-1">
                                       <div className="flex justify-between items-start">
                                         <div className="flex-1 pr-2">
                                            <span className="text-xs font-semibold text-gray-800">{item.model}</span>
                                            <div className="text-[10px] text-gray-500">SL: <b>{item.sampleSize}</b></div>
                                         </div>
                                         <div className="flex flex-col items-end gap-1.5">
                                            <span className={`text-[9px] font-bold px-2 py-1 rounded border ${statusInfo.color}`}>{statusInfo.text}</span>
                                            {userRole === 'admin' && (
                                              <div className="flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
                                                 {confirmDeleteOrderId === item.id ? (
                                                     <div className="flex items-center gap-1 bg-red-50 p-0.5 rounded"><button onClick={() => handleDeleteOrder(item.id)} className="bg-red-500 text-white p-1 rounded"><Check size={10}/></button><button onClick={() => setConfirmDeleteOrderId(null)} className="bg-gray-300 p-1 rounded"><X size={10}/></button></div>
                                                 ) : (<button onClick={() => setConfirmDeleteOrderId(item.id)} className="text-red-500 p-1 rounded"><Trash2 size={12}/></button>)}
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

          {/* ================================================================ */}
          {/* NHÂN SỰ MỚI (TỐI GIẢN + LỊCH FULL MÀN HÌNH + KÉO THẢ CSV + CHẤM THEO NGƯỜI VỚI V/X/CA) */}
          {/* ================================================================ */}
          {activeTab === 'personnel' && (
            <div className="space-y-4 lg:space-y-6 max-w-7xl mx-auto flex flex-col h-full print:block">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 print:hidden">
                <h2 className="text-xl font-bold text-gray-800 md:hidden">Quản lý Nhân Sự</h2>
                <div className="flex gap-2 w-full md:w-auto flex-wrap">
                   {userRole === 'admin' && (
                     <>
                       <button onClick={() => setShowAddPersonnel(!showAddPersonnel)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl font-bold hover:bg-blue-100 transition border border-blue-200">
                         {showAddPersonnel ? <X size={18}/> : <PlusCircle size={18}/>}
                         {showAddPersonnel ? 'Đóng Form' : 'Thêm Nhân Sự Mới'}
                       </button>
                       <button onClick={() => setShowPrintModal(true)} className="flex items-center justify-center gap-2 bg-gray-800 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-900 transition shadow-sm">
                         <Printer size={18} /> <span className="hidden md:inline">In Bảng Chấm Công</span>
                       </button>
                       <button onClick={() => {
                           setShowAttendanceCalendar(true);
                           setAttendanceMode('date');
                       }} className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm">
                         <CalendarCheck size={18} /> <span className="hidden md:inline">Lịch chấm công</span>
                       </button>
                     </>
                   )}
                </div>
              </div>

              {/* FORM THÊM MỚI NHÂN SỰ CÓ KÉO THẢ CSV */}
              {showAddPersonnel && userRole === 'admin' && (
                 <div className="bg-white p-4 lg:p-6 rounded-xl border border-blue-200 shadow-md mb-6 animate-in slide-in-from-top-4 print:hidden">
                    <h3 className="text-base font-bold text-blue-800 mb-3 border-b border-blue-50 pb-2">Nhập Thông Điệp Nhân Sự</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4">
                       <input type="text" placeholder="Họ và tên..." value={newPersonnel.name} onChange={(e) => setNewPersonnel({...newPersonnel, name: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"/>
                       <input type="text" placeholder="Chức vụ (VD: KTV, Partime)..." value={newPersonnel.role} onChange={(e) => setNewPersonnel({...newPersonnel, role: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"/>
                       <select value={newPersonnel.shift} onChange={e => setNewPersonnel({...newPersonnel, shift: e.target.value})} className="border border-gray-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none">
                          <option value="Hành Chính">Hành Chính</option><option value="Ca Ngày">Ca Ngày</option><option value="Ca Đêm">Ca Đêm</option><option value="Part-time">Part-time</option>
                       </select>
                       <button onClick={handleAddPersonnel} className="bg-blue-600 text-white py-2.5 rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition">Lưu thủ công</button>
                    </div>

                    <div className="relative flex items-center py-2">
                       <div className="flex-grow border-t border-gray-200"></div>
                       <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">Hoặc nhập file Excel</span>
                       <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <div className="mt-2 flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50 hover:bg-emerald-100/50 transition relative">
                       <input type="file" accept=".csv" id="upload-personnel" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handlePersonnelFileUpload} disabled={isUploadingPersonnel}/>
                       {isUploadingPersonnel ? (
                          <Loader2 size={32} className="animate-spin text-emerald-600 mb-2" />
                       ) : (
                          <UploadCloud size={32} className="text-emerald-500 mb-2" />
                       )}
                       <p className="font-bold text-emerald-800 text-sm">{isUploadingPersonnel ? 'Đang tải lên...' : 'Bấm hoặc Kéo thả file CSV vào đây'}</p>
                       <p className="text-xs text-emerald-600/70 mt-1 font-medium">Cột 1: Họ Tên | Cột 2: Chức Danh | Cột 3: Ca làm việc</p>
                    </div>
                 </div>
              )}

              {/* MODAL LỊCH CHẤM CÔNG HÀNG LOẠT */}
              {showAttendanceCalendar && userRole === 'admin' && (() => {
                  const year = attendanceViewDate.getFullYear();
                  const month = attendanceViewDate.getMonth();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const firstDay = new Date(year, month, 1).getDay();
                  const startOffset = firstDay === 0 ? 6 : firstDay - 1; 
                  
                  const calendarDays = [];
                  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
                  for (let i = 1; i <= daysInMonth; i++) {
                     const d = new Date(year, month, i);
                     calendarDays.push(getLocalYYYYMMDD(d));
                  }

                  return (
                 <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col w-[100vw] h-[100vh] overflow-hidden animate-in fade-in duration-200 print:hidden">
                    <div className="bg-white flex justify-between items-center p-4 border-b shadow-sm shrink-0">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-black text-indigo-700 flex items-center gap-2"><CalendarCheck size={28}/> TRUNG TÂM CHẤM CÔNG</h2>
                        </div>
                        <button onClick={() => { setShowAttendanceCalendar(false); setPinnedTooltip(null); }} className="px-6 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition">Đóng Lịch</button>
                    </div>

                    <div className="flex flex-1 overflow-hidden bg-gray-100">
                        {/* Cột trái: Tùy chọn Chế độ và Danh sách */}
                        <div className="w-64 md:w-72 lg:w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg z-10 shrink-0 h-full">
                            
                            {/* Toggle Switch Chế độ */}
                            <div className="flex bg-gray-100 p-1 m-3 rounded-lg border border-gray-200 shrink-0">
                                <button onClick={() => setAttendanceMode('date')} className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-colors ${attendanceMode === 'date' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Theo Ngày</button>
                                <button onClick={() => {
                                    setAttendanceMode('person');
                                    if (!selectedAttendanceStaffId && activePersonnel.length > 0) setSelectedAttendanceStaffId(activePersonnel[0].id);
                                }} className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-colors ${attendanceMode === 'person' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Theo Người</button>
                            </div>

                            {attendanceMode === 'date' ? (
                                <>
                                    <div className="p-3 bg-indigo-50 border-y border-indigo-100 text-center shrink-0">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Ngày đang chọn</p>
                                        <input 
                                            type="date" 
                                            value={selectedAttendanceDate}
                                            onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                                            className="w-full text-center bg-white border border-indigo-200 rounded p-1.5 text-sm font-black text-indigo-900 focus:ring-2 focus:ring-indigo-400 outline-none cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2">
                                        {activePersonnel.map(p => {
                                            const mark = attendanceBatchData[p.id] || '';
                                            return (
                                                <div key={p.id} className="flex justify-between items-center p-2 hover:bg-gray-50 border-b border-gray-100 rounded gap-2">
                                                    <span className="font-semibold text-xs text-gray-800 truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                                                    <div className="flex gap-1 shrink-0 items-center">
                                                        <button onClick={() => handleMarkStaff(p.id, 'V')} className={`w-7 h-7 rounded text-xs font-black flex items-center justify-center transition-all ${mark === 'V' ? 'bg-green-500 text-white shadow-inner scale-110' : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'}`}>V</button>
                                                        <button onClick={() => handleMarkStaff(p.id, 'X')} className={`w-7 h-7 rounded text-xs font-black flex items-center justify-center transition-all ${mark === 'X' ? 'bg-red-500 text-white shadow-inner scale-110' : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'}`}>X</button>
                                                        <button onClick={() => handleMarkStaff(p.id, mark.startsWith('P') ? '' : 'P-4')} className={`w-7 h-7 rounded text-xs font-black flex items-center justify-center transition-all ${mark.startsWith('P') ? 'bg-yellow-400 text-black shadow-inner scale-110' : 'bg-gray-100 text-gray-400 hover:bg-yellow-100 hover:text-yellow-600'}`} title="Theo ca">Ca</button>
                                                        
                                                        {mark.startsWith('P') && (
                                                            <select 
                                                                value={mark.split('-')[1]} 
                                                                onChange={(e) => handleMarkStaff(p.id, `P-${e.target.value}`)}
                                                                className="w-10 h-7 text-xs border border-yellow-400 rounded outline-none bg-yellow-50 text-center font-bold text-yellow-800 appearance-none px-1"
                                                            >
                                                                {[1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>{h}h</option>)}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="p-3 bg-white border-t border-gray-200 shadow-[0_-5px_15px_rgba(0,0,0,0.03)] mt-auto shrink-0">
                                        <button onClick={handleSaveBatchAttendance} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-black rounded-lg hover:bg-indigo-700 shadow-md transition transform active:scale-95">LƯU LẠI (NGÀY {selectedAttendanceDate.split('-')[2]})</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 bg-indigo-50 border-y border-indigo-100 text-center shrink-0">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Nhân sự đang chọn</p>
                                        <div className="text-sm font-black text-indigo-900 bg-white border border-indigo-200 rounded p-1.5 truncate">
                                            {activePersonnel.find(p => p.id === selectedAttendanceStaffId)?.name || 'Chưa chọn'}
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2">
                                        {activePersonnel.map(p => (
                                            <button 
                                                key={p.id} 
                                                onClick={() => { setSelectedAttendanceStaffId(p.id); setPersonBatchData({}); }}
                                                className={`w-full text-left flex justify-between items-center p-3 mb-1 border rounded-lg transition-all ${selectedAttendanceStaffId === p.id ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'}`}
                                            >
                                                <span className="font-semibold text-xs truncate flex-1">{p.name}</span>
                                                {selectedAttendanceStaffId === p.id && <ChevronRight size={16} />}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-white border-t border-gray-200 shadow-[0_-5px_15px_rgba(0,0,0,0.03)] mt-auto shrink-0">
                                        <button onClick={handleSavePersonAttendance} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-black rounded-lg hover:bg-indigo-700 shadow-md transition transform active:scale-95">LƯU TOÀN BỘ CHO NGƯỜI NÀY</button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Cột phải: Bảng lịch lớn */}
                        <div className="flex-1 p-4 lg:p-6 flex flex-col bg-gray-50 overflow-y-auto">
                            <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-xl shadow-sm border border-gray-200 shrink-0">
                                <div className="flex gap-2">
                                    <button onClick={() => setAttendanceViewDate(new Date(year - 1, month, 1))} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"><ChevronsLeft size={20}/></button>
                                    <button onClick={() => setAttendanceViewDate(new Date(year, month - 1, 1))} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"><ChevronLeft size={20}/></button>
                                </div>
                                <h3 className="text-lg lg:text-xl font-black text-gray-800 tracking-wide uppercase">Tháng {month + 1} - Năm {year}</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setAttendanceViewDate(new Date(year, month + 1, 1))} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"><ChevronRight size={20}/></button>
                                    <button onClick={() => setAttendanceViewDate(new Date(year + 1, month, 1))} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"><ChevronsRight size={20}/></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-2 mb-2 text-center shrink-0">
                                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                                    <div key={day} className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest">{day}</div>
                                ))}
                            </div>
                            
                            <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-max">
                                {calendarDays.map((dateStr, idx) => {
                                    if (!dateStr) return <div key={`empty-${idx}`} className="bg-transparent"></div>;
                                    
                                    const isTodayLocal = dateStr === getLocalYYYYMMDD(new Date());
                                    const dayNum = parseInt(dateStr.split('-')[2], 10);
                                    
                                    if (attendanceMode === 'date') {
                                        // ------------------ HIỂN THỊ THEO NGÀY ------------------
                                        const isSelected = dateStr === selectedAttendanceDate;
                                        let hasWorking = false;
                                        let absentees = [];
                                        let partTimers = [];

                                        activePersonnel.forEach(p => {
                                            const st = p.timesheet?.[dateStr]?.status;
                                            const nt = p.timesheet?.[dateStr]?.note;
                                            if (st === 'Nghỉ phép' || st === 'Nghỉ' || st === 'Vắng mặt') {
                                                absentees.push({ name: p.name, note: nt || st });
                                            } else if (st === 'Đang làm' || st === 'Làm việc') {
                                                hasWorking = true;
                                            } else if (st === 'Part-time') {
                                                hasWorking = true;
                                                partTimers.push({ name: p.name, note: nt || 'Làm theo ca' });
                                            }
                                        });

                                        let circleClass = "border-gray-200 bg-white text-gray-600 hover:bg-gray-50";
                                        if (absentees.length > 0) {
                                            circleClass = "bg-red-500 text-white font-bold shadow-md shadow-red-200"; 
                                        } else if (hasWorking) {
                                            circleClass = "bg-green-500 text-white font-bold shadow-md shadow-green-200"; 
                                        }

                                        if (isSelected) circleClass += " ring-4 ring-indigo-300 scale-110 z-10";

                                        // Tính toán vị trí tooltip chống tràn
                                        const rowIndex = Math.floor(idx / 7); 
                                        const colIndex = idx % 7; 
                                        const isPinned = pinnedTooltip === dateStr;
                                        const isTop = rowIndex <= 2;
                                        const verticalAnimation = isTop ? "slide-in-from-top-2" : "slide-in-from-bottom-2";
                                        
                                        const tooltipStyle = {
                                            zIndex: 9999,
                                            ...(isTop ? { top: 'calc(100% + 8px)' } : { bottom: 'calc(100% + 8px)' }),
                                            ...(colIndex <= 1 ? { left: '0' } : colIndex >= 5 ? { right: '0' } : { left: '50%', transform: 'translateX(-50%)' })
                                        };

                                        return (
                                            <div key={dateStr} className={`relative group flex justify-center py-1 h-full z-0 ${isPinned ? 'z-50' : 'hover:z-50 focus-within:z-50'}`}>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedAttendanceDate(dateStr);
                                                        if (absentees.length > 0 || partTimers.length > 0) {
                                                            setPinnedTooltip(prev => prev === dateStr ? null : dateStr);
                                                        } else {
                                                            setPinnedTooltip(null);
                                                        }
                                                    }}
                                                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center transition-all border-2 ${circleClass}`}
                                                >
                                                    <span className="text-sm sm:text-base">{dayNum}</span>
                                                    {isTodayLocal && <span className="absolute bottom-[-6px] w-4 h-1 rounded-full bg-blue-600"></span>}
                                                </button>
                                                
                                                {/* Tooltip hiển thị người vắng mặt hoặc part-time */}
                                                {(absentees.length > 0 || partTimers.length > 0) && (
                                                    <div 
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={tooltipStyle}
                                                        className={`absolute ${isPinned ? 'flex' : 'hidden group-hover:flex'} flex-col w-56 sm:w-64 bg-gray-900 text-white text-xs rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in ${verticalAnimation}`}
                                                    >
                                                        {absentees.length > 0 && (
                                                            <>
                                                                <div className="bg-red-600 font-bold flex justify-between items-center px-3 py-2 uppercase tracking-wider">
                                                                    <span>Vắng mặt ({absentees.length})</span>
                                                                    {isPinned ? (
                                                                        <button onClick={() => setPinnedTooltip(null)} className="bg-red-700 hover:bg-red-800 rounded p-1 transition shadow-sm"><X size={14} className="text-white"/></button>
                                                                    ) : (<span className="text-[9px] opacity-80 normal-case">(Bấm để ghim)</span>)}
                                                                </div>
                                                                <div className="p-2 space-y-1.5 max-h-40 overflow-y-auto pointer-events-auto">
                                                                    {absentees.map((a, i) => (
                                                                        <div key={`ab-${i}`} className="flex flex-col border-b border-gray-700 pb-1.5 last:border-0 last:pb-0 pt-0.5">
                                                                            <span className="font-bold text-red-300 text-[11px]">{a.name}</span>
                                                                            <span className="text-[10px] text-gray-400 leading-tight">{a.note}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                        {partTimers.length > 0 && (
                                                            <>
                                                                <div className="bg-yellow-500 text-yellow-900 font-bold flex justify-between items-center px-3 py-1.5 uppercase tracking-wider">
                                                                    <span>Làm theo ca ({partTimers.length})</span>
                                                                    {isPinned && absentees.length === 0 && (
                                                                        <button onClick={() => setPinnedTooltip(null)} className="bg-yellow-600 hover:bg-yellow-700 rounded p-1 transition shadow-sm"><X size={14} className="text-white"/></button>
                                                                    )}
                                                                </div>
                                                                <div className="p-2 space-y-1.5 max-h-40 overflow-y-auto pointer-events-auto bg-gray-800">
                                                                    {partTimers.map((a, i) => (
                                                                        <div key={`pt-${i}`} className="flex flex-col border-b border-gray-700 pb-1.5 last:border-0 last:pb-0 pt-0.5">
                                                                            <span className="font-bold text-yellow-400 text-[11px]">{a.name}</span>
                                                                            <span className="text-[10px] text-gray-400 leading-tight">{a.note}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        // ------------------ HIỂN THỊ THEO NGƯỜI ------------------
                                        const staff = activePersonnel.find(p => p.id === selectedAttendanceStaffId);
                                        const mark = personBatchData[dateStr] !== undefined 
                                            ? personBatchData[dateStr] 
                                            : (() => {
                                                const st = staff?.timesheet?.[dateStr]?.status;
                                                const nt = staff?.timesheet?.[dateStr]?.note;
                                                if (st === 'Đang làm' || st === 'Làm việc') return 'V';
                                                if (st === 'Nghỉ phép' || st === 'Nghỉ' || st === 'Vắng mặt') return 'X';
                                                if (st === 'Part-time') {
                                                    const hm = nt && nt.match(/(\d+)/);
                                                    return `P-${hm ? hm[1] : '4'}`;
                                                }
                                                return '';
                                            })();
                                        
                                        let circleClass = "border-gray-200 bg-white text-gray-600 hover:bg-gray-50";
                                        if (mark === 'V') circleClass = "bg-green-500 text-white font-bold shadow-md shadow-green-200 scale-105";
                                        if (mark === 'X') circleClass = "bg-red-500 text-white font-bold shadow-md shadow-red-200 scale-105";
                                        if (mark?.startsWith('P')) circleClass = "bg-yellow-400 text-black font-bold shadow-md shadow-yellow-200 scale-105";

                                        return (
                                            <div key={dateStr} className="relative flex justify-center py-1 h-full z-0 hover:z-10 focus-within:z-10">
                                                <button 
                                                    onClick={() => handleTogglePersonDay(dateStr)}
                                                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center transition-all border-2 ${circleClass}`}
                                                    title={`Bấm để chuyển trạng thái`}
                                                >
                                                    <span className="text-sm sm:text-base">{dayNum}</span>
                                                    {isTodayLocal && <span className={`absolute bottom-[-6px] w-4 h-1 rounded-full ${mark ? 'bg-white' : 'bg-blue-600'}`}></span>}
                                                </button>
                                                
                                                {/* Dropdown chọn giờ nếu là Part-time */}
                                                {mark?.startsWith('P') && (
                                                    <div className="absolute top-full mt-1 z-50 animate-in fade-in zoom-in" onClick={(e) => e.stopPropagation()}>
                                                        <select 
                                                            value={mark.split('-')[1]}
                                                            onChange={(e) => setPersonBatchData(prev => ({ ...prev, [dateStr]: `P-${e.target.value}` }))}
                                                            className="p-1 text-xs rounded shadow-lg border-2 border-yellow-400 bg-yellow-50 text-center font-bold cursor-pointer outline-none text-yellow-900"
                                                        >
                                                            {[1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>{h} tiếng</option>)}
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

              {/* DANH SÁCH THẺ NHÂN SỰ TỐI GIẢN */}
              <div className="flex-1 overflow-y-auto pb-10 print:overflow-visible">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-4">
                   {activePersonnel.map((p) => {
                     const isEditing = editingPersonnelId === p.id;
                     const displayStatus = p.status === 'Làm việc' ? 'Đang làm' : (p.status === 'Nghỉ' ? 'Nghỉ phép' : p.status);
                     
                     return (
                       <div key={p.id} className={`p-4 rounded-2xl shadow-sm border flex flex-col transition hover:shadow-md ${displayStatus === 'Nghỉ phép' ? 'bg-orange-50/20 border-orange-200' : 'bg-white border-gray-200'}`}>
                         <div className="flex justify-between items-start mb-3">
                           <div className="flex gap-3 items-center w-full pr-2">
                             <div className={`p-2.5 rounded-full shrink-0 ${displayStatus === 'Nghỉ phép' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                               {displayStatus === 'Nghỉ phép' ? <UserMinus size={20} /> : <UserCheck size={20} />}
                             </div>
                             
                             {isEditing ? (
                               <div className="flex-1 space-y-1">
                                 <input type="text" value={editPersonnelData.name} onChange={(e)=>setEditPersonnelData({...editPersonnelData, name: e.target.value})} className="w-full text-sm border p-1 rounded font-bold" />
                                 <input type="text" value={editPersonnelData.role} onChange={(e)=>setEditPersonnelData({...editPersonnelData, role: e.target.value})} className="w-full text-xs border p-1 rounded" />
                               </div>
                             ) : (
                               <div className="flex-1">
                                 <h3 className="font-bold text-base text-gray-800">{p.name}</h3>
                                 <p className="text-xs text-gray-500">{p.role}</p>
                               </div>
                             )}
                           </div>
                           
                           {userRole === 'admin' && (
                             <div>
                                {confirmDeletePersonnelId === p.id ? (
                                  <div className="flex flex-col gap-1 items-end shrink-0 bg-white p-1 rounded-xl shadow-sm border border-red-100">
                                    <span className="text-[10px] text-red-500 font-bold whitespace-nowrap px-1">Xóa luôn?</span>
                                    <div className="flex gap-1">
                                      <button onClick={() => handleDeletePersonnel(p.id)} className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700"><Check size={14}/></button>
                                      <button onClick={() => setConfirmDeletePersonnelId(null)} className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"><X size={14}/></button>
                                    </div>
                                  </div>
                                ) : isEditing ? (
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => handleSaveEditPersonnel(p.id)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check size={14}/></button>
                                    <button onClick={() => setEditingPersonnelId(null)} className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><X size={14}/></button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 opacity-50 hover:opacity-100">
                                    <button onClick={() => { setEditingPersonnelId(p.id); setEditPersonnelData({name: p.name, role: p.role, shift: p.shift || 'Hành Chính'}); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit2 size={14}/></button>
                                    <button onClick={() => setConfirmDeletePersonnelId(p.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14}/></button>
                                  </div>
                                )}
                             </div>
                           )}
                         </div>
                         
                         <div className="mt-auto">
                           {!isEditing && userRole === 'admin' && (
                             <div className="flex gap-2 mb-3">
                                <button onClick={() => changePersonnelStatus(p.id, 'Đang làm')} className={`flex-1 text-xs py-1.5 rounded font-bold border shadow-sm ${displayStatus === 'Đang làm' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-500'}`}>Đang làm</button>
                                <button onClick={() => changePersonnelStatus(p.id, 'Nghỉ phép')} className={`flex-1 text-xs py-1.5 rounded font-bold border shadow-sm ${displayStatus === 'Nghỉ phép' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-gray-500'}`}>Nghỉ</button>
                                <button onClick={() => { if(window.confirm(`Cho nghỉ việc?`)) changePersonnelStatus(p.id, 'Đã nghỉ việc'); }} className="px-2 text-gray-400 hover:text-red-600 rounded border bg-white"><UserX size={14}/></button>
                             </div>
                           )}

                           <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 flex items-center gap-2">
                             <input
                               id={`note-${p.id}`}
                               type="text"
                               placeholder="Ghi chú nhanh (Nửa buổi...)"
                               className="flex-1 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                               defaultValue={p.timesheet?.[todayStr]?.note || ''}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') updatePersonnelNote(p.id, e.target.value);
                               }}
                             />
                             <button onClick={() => updatePersonnelNote(p.id, document.getElementById(`note-${p.id}`).value)} className="bg-gray-200 hover:bg-blue-100 hover:text-blue-700 text-gray-600 text-[10px] px-2 py-1 rounded font-bold transition">Lưu Note</button>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                 </div>

                 {/* Nhân sự đã nghỉ việc */}
                 {resignedPersonnel.length > 0 && userRole === 'admin' && (
                   <div className="mt-8 pt-4 border-t border-gray-200">
                     <h3 className="text-sm font-bold text-gray-500 mb-3"><UserX size={14} className="inline"/> Đã nghỉ việc ({resignedPersonnel.length})</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                       {resignedPersonnel.map(p => (
                         <div key={p.id} className="p-3 rounded-lg border bg-gray-50 flex justify-between items-center opacity-70 hover:opacity-100">
                           <div>
                             <h4 className="font-bold text-xs line-through text-gray-500">{p.name}</h4>
                           </div>
                           {confirmDeletePersonnelId === p.id ? (
                             <div className="flex gap-1">
                                <button onClick={() => handleDeletePersonnel(p.id)} className="text-[10px] bg-red-600 text-white px-2 py-1 rounded">Xóa</button>
                                <button onClick={() => setConfirmDeletePersonnelId(null)} className="text-[10px] bg-gray-300 text-gray-800 px-2 py-1 rounded">Hủy</button>
                             </div>
                           ) : (
                             <div className="flex gap-1">
                                <button onClick={() => changePersonnelStatus(p.id, 'Đang làm')} className="text-[10px] bg-white border px-2 py-1 rounded hover:bg-blue-50">Phục hồi</button>
                                <button onClick={() => setConfirmDeletePersonnelId(p.id)} className="text-[10px] bg-white border text-red-500 px-2 py-1 rounded hover:bg-red-50">Xóa</button>
                             </div>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* CÁC TAB CÒN LẠI GIỮ NGUYÊN (KHO, TRẠM...) */}
          {activeTab === 'inventory' && (
             <div className="space-y-4 lg:space-y-6 print:block max-w-7xl mx-auto h-full flex flex-col">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 print:hidden">
                 <h2 className="text-xl font-bold text-gray-800 md:hidden">Kho Thiết Bị</h2>
                 <div className="w-full md:w-1/2 lg:w-1/3 relative flex gap-2">
                   <div className="relative flex-1">
                     <input type="text" placeholder="Tìm kiếm model, khách hàng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition shadow-sm"/>
                     <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                   </div>
                 </div>
                 {userRole === 'admin' && (
                   <div className="flex gap-2 w-full md:w-auto overflow-x-auto shrink-0">
                     {Object.values(duplicateCounts).some(count => count > 1) && (
                       <button onClick={handleDeleteAllDuplicates} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition shrink-0"><Trash2 size={18}/> Xóa mã trùng</button>
                     )}
                     <label htmlFor="upload-data" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition whitespace-nowrap">
                       {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                       {isUploading ? 'Đang đọc...' : 'Tải Excel'}
                     </label>
                     <input type="file" accept=".csv" id="upload-data" className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                   </div>
                 )}
               </div>
               {/* Khung chứa các mẫu thiết bị trong kho */}
               <div className="flex-1 overflow-y-auto pb-10 print:overflow-visible">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 print:grid-cols-2 print:gap-4">
                   {samplesInStock.filter(s => (s.model||'').toLowerCase().includes(searchTerm.toLowerCase()) || (s.client||'').toLowerCase().includes(searchTerm.toLowerCase())).map((sample) => {
                     const isDuplicate = checkIsDuplicate(sample.client, sample.type, sample.model);
                     const isEditing = editingSampleId === sample.id;
                     return (
                       <div key={sample.id} className={`p-3 md:p-4 rounded-xl shadow-sm border transition hover:shadow-md print:shadow-none print:break-inside-avoid print:border-gray-400 ${isDuplicate ? 'bg-red-50 border-red-300 print:bg-white' : 'bg-white border-gray-100'}`}>
                         <div className="flex justify-between items-start h-full">
                           {isEditing ? (
                              <div className="flex-1 space-y-2 pr-2">
                                 <input type="text" placeholder="Khách hàng" value={editSampleData.client} onChange={e => setEditSampleData({...editSampleData, client: e.target.value})} className="w-full text-xs border p-1.5 rounded focus:ring-1" />
                                 <input type="text" placeholder="Loại TB" value={editSampleData.type} onChange={e => setEditSampleData({...editSampleData, type: e.target.value})} className="w-full text-xs border p-1.5 rounded focus:ring-1" />
                                 <input type="text" placeholder="Model" value={editSampleData.model} onChange={e => setEditSampleData({...editSampleData, model: e.target.value})} className="w-full text-sm font-bold border p-1.5 rounded focus:ring-1" />
                                 <input type="number" placeholder="Số lượng" value={editSampleData.qty} onChange={e => setEditSampleData({...editSampleData, qty: e.target.value})} className="w-1/3 text-xs border p-1.5 rounded focus:ring-1" />
                              </div>
                           ) : (
                             <div className="flex-1 flex flex-col h-full justify-between pr-2">
                               <div>
                                  <div className="flex items-start gap-2 mb-1"><h3 className={`font-bold text-sm leading-tight print:text-black ${isDuplicate ? 'text-red-800' : 'text-gray-800'}`}>{sample.model}</h3></div>
                                  <p className="text-[11px] text-gray-600 font-semibold mb-1 print:text-black">{sample.client}</p>
                                  <p className="text-[10px] text-gray-400 print:text-black">{sample.type}</p>
                               </div>
                               <div className="mt-3 flex items-center justify-between">
                                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded print:bg-white print:border print:border-gray-400 print:text-black">SL: {sample.qty}</span>
                                  {isDuplicate && <span className="text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm print:hidden"><AlertTriangle size={10}/> TRÙNG</span>}
                               </div>
                             </div>
                           )}
                           {userRole === 'admin' && (
                             <div className="print:hidden">
                               {confirmDeleteSampleId === sample.id ? (
                                 <div className="flex flex-col gap-1 items-end shrink-0 bg-white p-1 rounded shadow-sm border border-red-100">
                                   <span className="text-[9px] text-red-500 font-bold whitespace-nowrap">Xóa chắc chưa?</span>
                                   <div className="flex gap-1">
                                     <button onClick={() => handleDeleteSample(sample.id)} className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition"><Check size={12}/></button>
                                     <button onClick={() => setConfirmDeleteSampleId(null)} className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"><X size={12}/></button>
                                   </div>
                                 </div>
                               ) : isEditing ? (
                                 <div className="flex flex-col gap-1.5 items-end shrink-0">
                                   <button onClick={() => handleSaveEditSample(sample.id)} className="p-2 bg-green-100 text-green-700 rounded-lg shadow-sm hover:bg-green-200 transition"><Check size={14}/></button>
                                   <button onClick={() => setEditingSampleId(null)} className="p-2 bg-gray-100 text-gray-700 rounded-lg shadow-sm hover:bg-gray-200 transition"><X size={14}/></button>
                                 </div>
                               ) : (
                                 <div className="flex flex-col gap-1.5 items-end shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                                   <button onClick={() => { setEditingSampleId(sample.id); setEditSampleData({client: sample.client, type: sample.type, model: sample.model, qty: sample.qty}); }} className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 rounded-lg hover:bg-blue-50 transition"><Edit2 size={14}/></button>
                                   <button onClick={() => setConfirmDeleteSampleId(sample.id)} className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 rounded-lg hover:bg-red-50 transition" title="Xóa thiết bị"><Trash2 size={14}/></button>
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

          {activeTab === 'equipment' && (() => {
             // ... Logic lấy dữ liệu eqStats, tổng số máy đang chạy ...
            const eqStats = equipments.map(eq => {
               const { running, waiting } = getTestsForStation(eq.id);
               return { ...eq, runningCount: running.length, waitingCount: waiting.length };
            });
            const totalRunning = eqStats.reduce((sum, eq) => sum + eq.runningCount, 0);
            const totalWaiting = eqStats.reduce((sum, eq) => sum + eq.waitingCount, 0);

             return (
               <div className="space-y-4 lg:space-y-6 print:hidden max-w-7xl mx-auto">
                 {userRole === 'admin' && (
                    <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4 flex flex-col sm:flex-row gap-3 items-center print:hidden">
                       <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                          <Settings2 size={20} className="text-blue-500" />
                          <input type="text" placeholder="Nhập tên Trạm máy / Phòng ban mới..." value={newStationName} onChange={e => setNewStationName(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" onKeyDown={e => e.key === 'Enter' && handleAddStation()}/>
                       </div>
                       <button onClick={handleAddStation} className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition whitespace-nowrap">+ Thêm Trạm Máy</button>
                    </div>
                 )}
   
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                    <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                       <h3 className="font-bold text-sm lg:text-base text-gray-800 flex items-center gap-2"><Activity size={18} className="text-blue-600"/> TỔNG QUAN HOẠT ĐỘNG</h3>
                       <div className="flex gap-3 text-xs font-bold">
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Đang chạy: {totalRunning}</span>
                          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">Chờ ghép: {totalWaiting}</span>
                       </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                       {eqStats.map(eq => (
                          <div key={'stat-'+eq.id} className={`p-3 rounded-lg border flex flex-col items-center text-center transition ${eq.runningCount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100'}`}>
                             <span className="text-[10px] lg:text-xs font-bold text-gray-600 line-clamp-2 h-8 flex items-center">{eq.name}</span>
                             <span className={`text-xl lg:text-2xl font-black mt-1 ${eq.runningCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{eq.runningCount}</span>
                             {eq.waitingCount > 0 && <span className="text-[9px] mt-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Chờ: {eq.waitingCount}</span>}
                          </div>
                       ))}
                    </div>
                 </div>

                 {/* Dàn thẻ các trạm máy con */}
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                   {equipments.map(eq => {
                     const { running, waiting, history } = getTestsForStation(eq.id);
                     const isAssigning = assigningStation === eq.id;
   
                     if (eq.id === 'TSO2') {
                        const activeBatch = running.length > 0 ? running[0] : null; 
                        const phase = activeBatch?.phase || ''; 
                        const isPaused = activeBatch?.isPaused || false;
                        
                        let elapsedMs = 0; let isTimeUp = false; let timeColor = 'text-green-600';
   
                        if (activeBatch) {
                           elapsedMs = getElapsedMs(activeBatch, currentTime);
                           if (phase === 'Ăn mòn' && elapsedMs >= CORROSION_TIME_MS) { isTimeUp = true; timeColor = 'text-red-600 animate-pulse'; } 
                           else if (phase === 'Sấy khô' && elapsedMs >= DRYING_TIME_MS) { isTimeUp = true; timeColor = 'text-red-600 animate-pulse'; }
                        }

                        const toggleSO2Pause = async () => {
                            if (userRole !== 'admin') return;
                            const now = new Date();
                            const updatesByOrder = {};
                            running.forEach(t => {
                                if (!updatesByOrder[t.orderId]) {
                                    const targetOrder = orders.find(o => o.id === t.orderId);
                                    updatesByOrder[t.orderId] = [...targetOrder.tests];
                                }
                                const currentTest = updatesByOrder[t.orderId][t.testIndex];
                                let newAccumulated = currentTest.accumulatedTimeMs || 0;
                                let newIsPaused = !currentTest.isPaused;
                                let newLastResumeTime = currentTest.lastResumeTime || currentTest.phaseStartTime;
                                if (newIsPaused) {
                                    if (newLastResumeTime) newAccumulated += (now.getTime() - new Date(newLastResumeTime).getTime());
                                } else {
                                    newLastResumeTime = now.toISOString();
                                }
                                updatesByOrder[t.orderId][t.testIndex] = { ...currentTest, isPaused: newIsPaused, accumulatedTimeMs: newAccumulated, lastResumeTime: newIsPaused ? null : newLastResumeTime };
                            });
                            const promises = Object.keys(updatesByOrder).map(orderId => updateDoc(getDocument('orders', orderId), { tests: updatesByOrder[orderId] }));
                            await Promise.all(promises);
                        };

                        const finishSO2Batch = async () => {
                            if (!window.confirm("Hoàn tất và đưa toàn bộ lô mẫu SO2 vào Lịch sử?")) return;
                            const now = new Date().toISOString();
                            const updatesByOrder = {};
                            running.forEach(t => {
                                if (!updatesByOrder[t.orderId]) {
                                    const targetOrder = orders.find(o => o.id === t.orderId);
                                    updatesByOrder[t.orderId] = [...targetOrder.tests];
                                }
                                updatesByOrder[t.orderId][t.testIndex] = { ...updatesByOrder[t.orderId][t.testIndex], status: 'Xong', endTime: now, isPaused: false };
                            });
                            const promises = Object.keys(updatesByOrder).map(orderId => updateDoc(getDocument('orders', orderId), { tests: updatesByOrder[orderId] }));
                            await Promise.all(promises);
                        };

                        const startSO2Batch = async () => {
                            if (!tso2SelectedUser) { alert("Vui lòng chọn KTV đứng máy!"); return; }
                            const now = new Date().toISOString();
                            const updatesByOrder = {};
                            waiting.forEach(t => {
                                if (!updatesByOrder[t.orderId]) {
                                    const targetOrder = orders.find(o => o.id === t.orderId);
                                    updatesByOrder[t.orderId] = [...targetOrder.tests];
                                }
                                updatesByOrder[t.orderId][t.testIndex] = { ...updatesByOrder[t.orderId][t.testIndex], status: 'Đang chạy', phase: 'Ăn mòn', assignedUser: tso2SelectedUser, phaseStartTime: now, lastResumeTime: null, accumulatedTimeMs: 0, isPaused: false };
                            });
                            const promises = Object.keys(updatesByOrder).map(orderId => updateDoc(getDocument('orders', orderId), { tests: updatesByOrder[orderId] }));
                            await Promise.all(promises);
                            setTso2SelectedUser('');
                        };

                        const switchSO2Phase = async () => {
                            if (!window.confirm("Chuyển toàn bộ lô sang Sấy khô (16h)?")) return;
                            const now = new Date().toISOString();
                            const updatesByOrder = {};
                            running.forEach(t => {
                                if (!updatesByOrder[t.orderId]) {
                                    const targetOrder = orders.find(o => o.id === t.orderId);
                                    updatesByOrder[t.orderId] = [...targetOrder.tests];
                                }
                                updatesByOrder[t.orderId][t.testIndex] = { ...updatesByOrder[t.orderId][t.testIndex], phase: 'Sấy khô', phaseStartTime: now, lastResumeTime: null, accumulatedTimeMs: 0, isPaused: false };
                            });
                            const promises = Object.keys(updatesByOrder).map(orderId => updateDoc(getDocument('orders', orderId), { tests: updatesByOrder[orderId] }));
                            await Promise.all(promises);
                        };

                        return (
                          <div key={eq.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden flex flex-col h-full relative transition-colors ${isTimeUp ? 'border-red-500 animate-[pulse_2s_ease-in-out_infinite]' : 'border-indigo-200'}`}>
                            <div className={`absolute top-0 right-0 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg z-10 shadow-sm ${isTimeUp ? 'bg-red-600' : 'bg-indigo-600'}`}>
                               {isTimeUp ? 'CẦN CHUYỂN PHA' : 'CHU TRÌNH ĐẶC BIỆT'}
                            </div>
                            <div className={`p-3 lg:p-4 border-b flex justify-between items-center ${isTimeUp ? 'bg-red-50' : 'bg-indigo-50'}`}>
                              <h3 className={`font-bold text-sm lg:text-base flex items-center gap-2 ${isTimeUp ? 'text-red-900' : 'text-indigo-900'}`}>{eq.name}</h3>
                              <button onClick={() => setAssigningStation(isAssigning ? null : eq.id)} className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm border transition ${isAssigning ? 'bg-gray-100' : 'bg-white'}`} disabled={running.length > 0}>{isAssigning ? 'Hủy' : '+ Thêm vào Lô'}</button>
                            </div>

                            {isAssigning && (() => {
                              const compatibleOrders = orders.filter(o => 
                                isDeviceCompatibleWithStation(eq.id, o.type) && 
                                !(o.tests || []).some(t => t && t.equip === eq.id && (t.status === 'Đang chạy' || t.status === 'Chờ chạy'))
                              );
                              return (
                                <div className="p-3 bg-indigo-50/50 border-b border-indigo-100 flex flex-col gap-2">
                                  <select 
                                    className="w-full text-sm border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm bg-white"
                                    value={selectedOrderIdToAssign}
                                    onChange={(e) => setSelectedOrderIdToAssign(e.target.value)}
                                  >
                                    <option value="">-- Chọn Thiết bị cần ghép lô --</option>
                                    {compatibleOrders.length === 0 ? (
                                      <option value="" disabled>Không có thiết bị tương thích</option>
                                    ) : (
                                      compatibleOrders.map(o => <option key={o.id} value={o.id}>[{o.reqId}] {o.model} ({o.type})</option>)
                                    )}
                                  </select>
                                  <button 
                                    onClick={async () => {
                                       if(!selectedOrderIdToAssign || !user) return;
                                       const targetOrder = orders.find(o => o.id === selectedOrderIdToAssign);
                                       if(!targetOrder) return;
                                       const newTest = { name: 'Kiểm định', status: 'Chờ chạy', equip: eq.id };
                                       const updatedTests = [...(targetOrder.tests || []), newTest];
                                       try {
                                           await updateDoc(getDocument('orders', targetOrder.id), { tests: updatedTests });
                                           setAssigningStation(null);
                                           setSelectedOrderIdToAssign('');
                                       } catch (e) {
                                           setErrorMessage("Lỗi gán: " + e.message);
                                       }
                                    }} 
                                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition w-full disabled:opacity-50"
                                    disabled={!selectedOrderIdToAssign}
                                  >Đưa vào Chờ ghép chạy</button>
                                </div>
                              );
                            })()}

                            <div className="flex-1 overflow-y-auto flex flex-col p-3">
                               {waiting.length > 0 && running.length === 0 && (
                                  <div className="p-3 bg-amber-50/50 border-b border-amber-100 mb-3 rounded-lg">
                                     <h4 className="text-[10px] font-bold text-amber-800 mb-2 uppercase flex items-center gap-1"><Layers size={14}/> Danh sách chờ ghép chạy ({waiting.length})</h4>
                                     <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
                                        {waiting.map((test) => (
                                           <div key={`${test.orderId}-${test.testIndex}`} className="bg-white border border-amber-200 px-2 py-1.5 rounded text-xs text-gray-800 font-medium flex justify-between items-center">
                                              <div className="flex flex-col">
                                                 <span>{test.model}</span>
                                                 <span className="text-gray-400 text-[10px]">{test.reqId}</span>
                                              </div>
                                              {userRole === 'admin' && (
                                                 <button onClick={() => handleRemoveTest(test.orderId, test.testIndex)} className="text-red-500 hover:bg-red-100 hover:text-red-700 p-1.5 rounded transition" title="Gỡ thiết bị khỏi trạm">
                                                    <X size={14}/>
                                                 </button>
                                              )}
                                           </div>
                                        ))}
                                     </div>
                                     <div className="flex gap-2">
                                        <select value={tso2SelectedUser} onChange={(e) => setTso2SelectedUser(e.target.value)} className="flex-1 text-xs border-amber-200 rounded p-2 outline-none">
                                           <option value="">- Chọn KTV -</option>
                                           {personnel.filter(p => p.status === 'Đang làm' || p.status === 'Làm việc').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                        <button onClick={startSO2Batch} className="bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-amber-600 transition shadow-sm">Bắt đầu Ăn mòn</button>
                                     </div>
                                  </div>
                               )}

                               {running.length > 0 && (
                                  <div className={`p-3 rounded-lg mb-3 flex-1 flex flex-col ${isTimeUp ? 'bg-red-50/50' : 'bg-blue-50'}`}>
                                     <div className="flex justify-between items-center mb-2">
                                        <h4 className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isTimeUp ? 'text-red-800' : 'text-blue-800'}`}><Activity size={14}/> Đang chạy lô ({running.length} mẫu)</h4>
                                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-600 font-bold">KTV: {activeBatch?.assignedUser}</span>
                                     </div>
                                     
                                     <div className={`bg-white border-2 rounded-xl p-3 shadow-sm ${isTimeUp ? 'border-red-300' : 'border-blue-200'}`}>
                                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                                           <span className={`text-xs font-black uppercase flex items-center gap-1 ${phase === 'Ăn mòn' ? 'text-amber-600' : 'text-blue-600'}`}>
                                              {phase === 'Ăn mòn' ? <ThermometerSun size={14}/> : <Wind size={14}/>} {phase}
                                           </span>
                                           <div className="flex items-center gap-2">
                                              {isPaused && <span className="text-[9px] font-bold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded animate-pulse">TẠM DỪNG</span>}
                                              <span className={`text-xs font-black flex items-center gap-1 ${timeColor}`}>
                                                 <Timer size={14}/> {formatMs(elapsedMs)}
                                              </span>
                                           </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-gray-600">
                                           {phase === 'Ăn mòn' ? (
                                              <>
                                                 <div className="bg-gray-50 px-2 py-1 rounded flex justify-between"><span>Nhiệt độ:</span><span className="font-bold text-gray-800">25±2°C</span></div>
                                                 <div className="bg-gray-50 px-2 py-1 rounded flex justify-between"><span>Độ ẩm:</span><span className="font-bold text-gray-800">93±%</span></div>
                                                 <div className="bg-gray-50 px-2 py-1 rounded flex justify-between col-span-2"><span>Nồng độ SO2:</span><span className="font-bold text-gray-800">25±5 uL/l</span></div>
                                              </>
                                           ) : (
                                              <>
                                                 <div className="bg-gray-50 px-2 py-1 rounded flex justify-between"><span>Nhiệt độ:</span><span className="font-bold text-gray-800">40°C</span></div>
                                                 <div className="bg-gray-50 px-2 py-1 rounded flex justify-between"><span>Độ ẩm:</span><span className="font-bold text-gray-800">≤ 50%</span></div>
                                                 <div className="bg-gray-50 px-2 py-1 rounded flex justify-between"><span>SO2 Flow:</span><span className="font-bold text-gray-800">0</span></div>
                                                 <div className="bg-gray-50 px-2 py-1 rounded flex justify-between"><span>SO2 Conc:</span><span className="font-bold text-gray-800">0</span></div>
                                              </>
                                           )}
                                        </div>
                                        <div className="mt-2 space-y-1 max-h-20 overflow-y-auto border-t border-gray-100 pt-2">
                                           {running.map((test) => (
                                               <div key={`${test.orderId}-${test.testIndex}`} className="flex justify-between items-center text-[10px] bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                   <span className="font-semibold text-gray-700 truncate pr-2">{test.model} ({test.reqId})</span>
                                                   {userRole === 'admin' && (
                                                       <button onClick={() => handleRemoveTest(test.orderId, test.testIndex)} className="text-red-500 hover:text-red-700 hover:bg-red-100 p-0.5 rounded transition" title="Gỡ thiết bị khỏi lô">
                                                           <X size={12}/>
                                                       </button>
                                                   )}
                                               </div>
                                           ))}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                                           {userRole === 'admin' && (
                                               <button onClick={toggleSO2Pause} className={`w-full py-1.5 rounded-lg text-xs font-bold flex justify-center items-center gap-1 shadow-sm transition ${isPaused ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300'}`}>
                                                  {isPaused ? <><Play size={14}/> Tiếp tục đếm giờ</> : <><Pause size={14}/> Quản lý: Tạm dừng máy</>}
                                               </button>
                                           )}
                                           {phase === 'Ăn mòn' ? (
                                              <button onClick={switchSO2Phase} disabled={!isTimeUp || isPaused} className={`w-full py-2.5 rounded-lg text-xs font-bold text-white shadow-sm transition ${(!isTimeUp || isPaused) ? 'bg-gray-300 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 animate-bounce'}`}>
                                                 {(!isTimeUp || isPaused) ? 'Đang trong quá trình Ăn mòn...' : 'Chuyển sang Sấy khô (16 giờ)'}
                                              </button>
                                           ) : (
                                              <button onClick={finishSO2Batch} disabled={!isTimeUp || isPaused} className={`w-full py-2.5 rounded-lg text-xs font-bold text-white shadow-sm transition ${(!isTimeUp || isPaused) ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 animate-bounce'}`}>
                                                 {(!isTimeUp || isPaused) ? 'Đang Sấy khô...' : 'Kết thúc hoàn toàn bài test SO2'}
                                              </button>
                                           )}
                                        </div>
                                     </div>
                                  </div>
                               )}

                               <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase border-t pt-3 mt-auto">Lịch sử đã chạy ({history.length})</h4>
                               {history.length === 0 && <p className="text-[11px] text-gray-400 italic text-center py-1">Chưa có lịch sử.</p>}
                               {history.map((test) => (
                                 <div key={`${test.orderId}-${test.testIndex}`} className="bg-gray-50 p-2 rounded-lg border border-gray-100 mb-1 flex justify-between items-center">
                                   <span className="text-[11px] font-medium text-gray-600">{test.model}</span>
                                   <CheckCircle2 size={14} className="text-green-500" />
                                 </div>
                               ))}
                            </div>
                          </div>
                        );
                     }
   
                     // Trạm máy thông thường
                     return (
                       <div key={eq.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full hover:shadow-md transition">
                         <div className="p-3 lg:p-4 border-b bg-blue-50 flex justify-between items-center">
                           <h3 className="font-bold text-sm lg:text-base text-blue-900">{eq.name}</h3>
                           <div className="flex gap-2">
                             <button onClick={() => setAssigningStation(isAssigning ? null : eq.id)} className="text-xs font-bold px-3 py-1.5 bg-white rounded-lg border shadow-sm">{isAssigning ? 'Hủy' : '+ Thêm TB'}</button>
                             {userRole === 'admin' && <button onClick={() => handleDeleteStation(eq.id, eq.name)} className="p-1.5 bg-white text-red-500 rounded-lg border shadow-sm"><Trash2 size={14}/></button>}
                           </div>
                         </div>

                         {isAssigning && (() => {
                           const compatibleOrders = orders.filter(o => 
                             isDeviceCompatibleWithStation(eq.id, o.type) && 
                             !(o.tests || []).some(t => t && t.equip === eq.id && (t.status === 'Đang chạy' || t.status === 'Chờ chạy'))
                           );
                           return (
                             <div className="p-3 lg:p-4 bg-blue-50/40 border-b border-blue-100 flex flex-col gap-3">
                               <select 
                                 className="w-full text-sm border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm bg-white"
                                 value={selectedOrderIdToAssign}
                                 onChange={(e) => setSelectedOrderIdToAssign(e.target.value)}
                               >
                                 <option value="">-- Chọn Thiết bị cần chạy --</option>
                                 {compatibleOrders.length === 0 ? (
                                   <option value="" disabled>Không có thiết bị tương thích</option>
                                 ) : (
                                   compatibleOrders.map(o => <option key={o.id} value={o.id}>[{o.reqId}] {o.model} ({o.type})</option>)
                                 )}
                               </select>
                               
                               <div className="flex gap-2">
                                 <select 
                                   className="flex-1 text-sm border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm bg-white"
                                   value={selectedPersonnelToAssign}
                                   onChange={(e) => setSelectedPersonnelToAssign(e.target.value)}
                                 >
                                   <option value="">-- Chọn KTV chạy máy --</option>
                                   {personnel.filter(p => p.status === 'Đang làm' || p.status === 'Làm việc').map(p => (
                                      <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                                   ))}
                                 </select>
                                 <button 
                                   onClick={() => handleAssignToStation(eq.id)} 
                                   className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                   disabled={!selectedOrderIdToAssign || compatibleOrders.length === 0}
                                 >Bắt đầu</button>
                               </div>
                             </div>
                           );
                         })()}

                         <div className="p-3 lg:p-4 flex-1 overflow-y-auto">
                           <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1 uppercase tracking-wide"><Activity size={14}/> Đang chạy ({running.length})</h4>
                           {running.length === 0 && <p className="text-[11px] text-gray-400 italic bg-gray-50 p-2 rounded text-center mb-4">Trạm đang trống.</p>}
                           {running.map((test) => (
                             <div key={`${test.orderId}-${test.testIndex}`} className="bg-white p-3 rounded-lg border border-blue-200 mb-2 shadow-sm flex justify-between items-center border-l-4 border-l-blue-500">
                               <div className="flex-1 pr-2">
                                 <div className="text-[10px] text-gray-500 font-bold mb-0.5">{test.reqId}</div>
                                 <div className="text-sm font-semibold text-gray-800 leading-tight">{test.model}</div>
                                 <div className="text-[10px] font-medium text-indigo-600 mt-1 flex items-center gap-1">
                                    <Briefcase size={10}/> {test.assignedUser || 'Chưa phân công'}
                                 </div>
                               </div>
                               <div className="flex items-center gap-1.5 shrink-0">
                                 {userRole === 'admin' && (
                                    <button onClick={() => handleRemoveTest(test.orderId, test.testIndex)} className="text-xs bg-red-50 text-red-600 border border-red-200 p-2 rounded-lg font-bold hover:bg-red-100 transition" title="Gỡ khỏi trạm">
                                       <Trash2 size={14}/>
                                    </button>
                                 )}
                                 <button onClick={() => markTestAsDone(test.orderId, test.testIndex)} className="text-xs bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg font-bold hover:bg-green-100 transition">Xong</button>
                               </div>
                             </div>
                           ))}

                           <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1 uppercase tracking-wide border-t pt-4 mt-4"><History size={14}/> Lịch sử ({history.length})</h4>
                           {history.length === 0 && <p className="text-[11px] text-gray-400 italic text-center py-1">Chưa có lịch sử.</p>}
                           {history.map((test) => (
                             <div key={`${test.orderId}-${test.testIndex}`} className="bg-gray-50 p-2 lg:p-3 rounded-lg border border-gray-100 mb-2 flex justify-between items-center">
                               <div>
                                 <div className="text-[9px] text-gray-400 line-through">{test.reqId}</div>
                                 <div className="text-xs font-medium text-gray-600">{test.model}</div>
                                 <div className="text-[8px] text-gray-400 mt-0.5">👤 {test.assignedUser}</div>
                               </div>
                               <CheckCircle2 size={16} className="text-green-500 shrink-0" />
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

        </main>
      </div>

      {/* BOTTOM NAV MOBILE */}
      <nav className="md:hidden bg-white border-t border-gray-200 fixed bottom-0 w-full flex justify-between px-2 py-2 pb-safe z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {navItems.map(item => {
           const Icon = item.icon;
           const isActive = activeTab === item.id;
           return (
             <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 w-1/5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
               <Icon size={isActive ? 22 : 20} className={isActive ? 'animate-bounce' : ''} />
               <span className="text-[9px] font-bold">{item.label}</span>
             </button>
           )
        })}
      </nav>
    </div>
    </>
  );
}
