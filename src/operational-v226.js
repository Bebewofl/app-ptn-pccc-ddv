(() => {
'use strict';

const CATEGORIES = Object.freeze([
  {key:'people', label:'Con người & năng lực'},
  {key:'equipment', label:'Trạm máy / Thiết bị'},
  {key:'sample', label:'Mẫu thử nghiệm / Khách hàng'},
  {key:'technical', label:'Kỹ thuật & Thử nghiệm'},
  {key:'other', label:'Khác'}
]);

const GROUP_LABELS = Object.freeze({
  '3TR':'Nhóm 3T-R',
  'KN':'Nhóm K-N',
  'ATAS':'Nhóm ATAS',
  'RND':'R&D',
  'RD':'R&D'
});

function categoryDef(key){return CATEGORIES.find(x=>x.key===key)||CATEGORIES[4]}
function categoryLabel(c){return String(c?.category||categoryDef(c?.categoryKey).label||'Khác')}
function groupLabel(code){return GROUP_LABELS[code]||String(code||'Chưa xác định')}
function val(id){return String(document.getElementById(id)?.value||'').trim()}
function reporterName(c){return c?.reportedByName||c?.reportedBy||c?.reportedByEmail||'Chưa xác định'}
function fieldRow(label,value){
  if(!value)return '';
  return `<div class="op-detail-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

function allowedGroupOptions(){
  const groups=(R().groups||[]).filter(g=>['3TR','KN','ATAS'].includes(g));
  const allowed=(['head','bod','coord','testeng'].includes(R().type)||groups.length===0)?['3TR','KN','ATAS']:groups;
  return allowed.map(g=>`<option value="${g}">${escapeHtml(groupLabel(g))}</option>`).join('');
}

function renderOperationalFields(){
  const host=document.getElementById('cOperationalFields');
  if(!host)return;
  const key=val('cCategoryKey')||'technical';
  if(key==='people'){
    host.innerHTML=`<div class="op-subform">
      <div class="formgrid">
        <div class="field"><label>Nhóm / vị trí liên quan</label><input id="cPeopleScope" placeholder="Ví dụ: Nhóm K-N, KTV, Trưởng nhóm..."></div>
        <div class="field"><label>Nội dung năng lực / quy trình</label><input id="cCompetencyIssue" placeholder="Thao tác, đào tạo, bàn giao, phân công..."></div>
      </div>
      <div class="field"><label>Việc cần xử lý / khắc phục</label><textarea id="cCorrectiveNeed" placeholder="Nêu ngắn gọn nội dung cần xử lý"></textarea></div>
    </div>`;
    return;
  }
  if(key==='equipment'){
    host.innerHTML=`<div class="op-subform">
      <div class="formgrid">
        <div class="field"><label>Trạm máy / Thiết bị</label><input id="cEquipmentName" placeholder="Ví dụ: Tunnel Khói-Nhiệt, máy đo âm thanh..."></div>
        <div class="field"><label>Mã thiết bị (nếu có)</label><input id="cEquipmentCode" placeholder="Mã / số hiệu thiết bị"></div>
      </div>
      <div class="field"><label>Tình trạng / hiện tượng</label><textarea id="cObservedCondition" placeholder="Lỗi, bất thường, điều kiện vận hành..."></textarea></div>
    </div>`;
    return;
  }
  if(key==='sample'){
    host.innerHTML=`<div class="op-subform">
      <div class="formgrid">
        <div class="field"><label>Mã đơn / YCTN</label><input id="cOrderCode" placeholder="Mã đơn hoặc YCTN"></div>
        <div class="field"><label>Tên mẫu thử</label><input id="cSampleName" placeholder="Tên / loại mẫu"></div>
        <div class="field"><label>Số lượng / tình trạng mẫu</label><input id="cSampleQuantity" placeholder="Thiếu số lượng, vỡ, biến dạng..."></div>
        <div class="field"><label>Nội dung cần khách hàng bổ sung</label><input id="cCustomerNeed" placeholder="Phụ kiện, catalog/manual, tính năng..."></div>
      </div>
    </div>`;
    return;
  }
  if(key==='technical'){
    host.innerHTML=`<div class="op-subform">
      <div class="formgrid">
        <div class="field"><label>Bài thử / hạng mục thử</label><input id="cTestItem" placeholder="Tên bài thử / phép thử"></div>
        <div class="field"><label>Tiêu chuẩn / phương pháp (nếu cần)</label><input id="cStandardMethod" placeholder="TCVN / ISO / phương pháp nội bộ..."></div>
      </div>
      <div class="field"><label>Hiện tượng / kết quả bất thường</label><textarea id="cAbnormalResult" placeholder="Kết quả ngoài khoảng, chức năng không hoạt động..."></textarea></div>
    </div>`;
    return;
  }
  host.innerHTML=`<div class="op-subform op-other">
    <div class="field"><label>Nội dung khác <b>*</b></label><textarea id="cOtherDetail" placeholder="Bắt buộc ghi rõ vấn đề không thuộc các phân loại đã nêu"></textarea></div>
  </div>`;
}

window.renderOperationalFields=renderOperationalFields;

window.openCreateCase=function(){
  document.getElementById('drawerSmall').textContent='BÁO CÁO VẤN ĐỀ / VƯỚNG MẮC';
  document.getElementById('drawerTitle').textContent='Tạo bản ghi xử lý';
  const defaultGroup=(R().groups&&R().groups[0])||'3TR';
  document.getElementById('drawerBody').innerHTML=`
    <div class="op-form-note">Mỗi vấn đề phải xác định rõ <b>nhóm báo cáo</b>, <b>phân loại</b>, mức độ và nội dung cần xử lý.</div>
    <div class="field"><label>Tiêu đề vấn đề</label><input id="cTitle" placeholder="Mô tả ngắn, rõ vấn đề"></div>
    <div class="formgrid">
      <div class="field"><label>Nhóm báo cáo</label><select id="cGroup">${allowedGroupOptions()}</select></div>
      <div class="field"><label>Phân loại chính</label><select id="cCategoryKey" onchange="renderOperationalFields()">
        ${CATEGORIES.map(x=>`<option value="${x.key}" ${x.key==='technical'?'selected':''}>${escapeHtml(x.label)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Mức độ</label><select id="cSeverity"><option>Trung bình</option><option>Cao</option><option>Thấp</option></select></div>
      <div class="field"><label>Hạn cần phản hồi</label><input id="cDeadline" placeholder="Ví dụ: 11/09/2026 15:00"></div>
    </div>
    <div id="cOperationalFields"></div>
    <div class="field"><label>Mô tả / nội dung báo cáo</label><textarea id="cSummary" placeholder="Nêu tình trạng, việc đã kiểm tra và nội dung đang cần xử lý..."></textarea></div>
  `;
  HUB_INTERDEPT.appendCreateAttachments();
  const group=document.getElementById('cGroup');
  if(group&&[...group.options].some(o=>o.value===defaultGroup))group.value=defaultGroup;
  renderOperationalFields();
  document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="createCase()">Tạo bản ghi</button>';
  openDrawer();
};

window.createCase=async function(){
  const title=val('cTitle');
  if(!title){alert('Cần nhập tiêu đề.');return}
  const categoryKey=val('cCategoryKey')||'other';
  const category=categoryDef(categoryKey).label;
  const otherDetail=val('cOtherDetail');
  if(categoryKey==='other'&&!otherDetail){alert('Phân loại Khác: cần ghi rõ nội dung vấn đề.');return}
  try{
    const attachmentData=await HUB_INTERDEPT.prepareCreateAttachments();
    const code=await getNextCaseCode();
    const c={
      title,
      category,
      categoryKey,
      categoryDetail:categoryKey==='other'?otherDetail:'',
      severity:val('cSeverity')||'Trung bình',
      sourceGroup:val('cGroup')||((R().groups||[])[0]||'3TR'),
      sourceSpace:'ptn',
      sourceUnitCode:'PTN',
      reportedBy:currentUser?.displayName||currentAccess?.name||R().label,
      reportedByName:currentUser?.displayName||currentAccess?.name||'',
      reportedByRole:R().label,
      reportedByEmail:emailKey(currentUser.email),
      createdByUid:currentUser.uid,
      status:R().type==='ktv'?'Mới':'Đã tiếp nhận',
      currentDesk:R().type==='ktv'?'Trưởng nhóm':'PTN',
      currentSpace:'ptn',
      currentUnitCode:'PTN',
      schemaVersion:'2.2.6',
      deadline:val('cDeadline')||'Chưa đặt',
      summary:val('cSummary')||'Chưa có mô tả.',
      peopleScope:val('cPeopleScope'),
      competencyIssue:val('cCompetencyIssue'),
      correctiveNeed:val('cCorrectiveNeed'),
      equipmentName:val('cEquipmentName'),
      equipmentCode:val('cEquipmentCode'),
      observedCondition:val('cObservedCondition'),
      orderCode:val('cOrderCode'),
      sampleName:val('cSampleName'),
      sampleQuantity:val('cSampleQuantity'),
      customerNeed:val('cCustomerNeed'),
      testItem:val('cTestItem'),
      standardMethod:val('cStandardMethod'),
      abnormalResult:val('cAbnormalResult'),
      otherDetail,
      confidential:'',
      createdAt:FV.serverTimestamp(),
      updatedAt:FV.serverTimestamp(),
      updatedByEmail:emailKey(currentUser.email)
    };
    await db.collection('hub_cases').doc(code).set(c);
    try{await writeCaseEvent(code,'Tạo bản ghi',`${groupLabel(c.sourceGroup)} • ${category}`)}catch(e){alert('VM '+code+' đã tạo nhưng chưa lưu được audit. Vui lòng báo quản trị viên.')}
    try{await HUB_INTERDEPT.saveCreateAttachments(code,attachmentData)}catch(e){alert('VM '+code+' đã tạo nhưng tệp đính kèm chưa lưu được: '+e.message)}
    closeDrawer();
    return code;
  }catch(e){alert('Không tạo được bản ghi: '+e.message)}
};

function operationalDetail(c){
  const common=[
    fieldRow('Nhóm / vị trí liên quan',c.peopleScope),
    fieldRow('Năng lực / quy trình',c.competencyIssue),
    fieldRow('Việc cần xử lý',c.correctiveNeed),
    fieldRow('Trạm máy / Thiết bị',c.equipmentName),
    fieldRow('Mã thiết bị',c.equipmentCode),
    fieldRow('Tình trạng / hiện tượng',c.observedCondition),
    fieldRow('Mã đơn / YCTN',c.orderCode),
    fieldRow('Tên mẫu thử',c.sampleName),
    fieldRow('Số lượng / tình trạng mẫu',c.sampleQuantity),
    fieldRow('Nội dung cần KH bổ sung',c.customerNeed),
    fieldRow('Bài thử / hạng mục',c.testItem),
    fieldRow('Tiêu chuẩn / phương pháp',c.standardMethod),
    fieldRow('Kết quả / hiện tượng bất thường',c.abnormalResult),
    fieldRow('Nội dung khác',c.otherDetail||c.categoryDetail)
  ].filter(Boolean).join('');
  return common?`<div class="section"><h4>Chi tiết nghiệp vụ</h4><div class="op-detail-grid">${common}</div></div>`:'';
}

window.openCaseDetail=function(id){
  const c=hubCases.find(x=>x.id===id);if(!c)return;
  document.getElementById('drawerSmall').textContent='VẤN ĐỀ / VƯỚNG MẮC';
  document.getElementById('drawerTitle').textContent=c.id+' — '+c.title;
  const canControl=R().type==='head';
  const isLead=R().type==='lead'&&(R().groups||[]).includes(c.sourceGroup);
  const receiver=['rnd','office','quality','bod'].includes(R().type);
  const follower=isSourceGroupFollower(c);
  document.getElementById('drawerBody').innerHTML=`
    ${follower?'<div class="follow-note"><b>Vấn đề của '+escapeHtml(groupLabel(c.sourceGroup))+'.</b> Bạn vẫn theo dõi được trạng thái khi chuyển sang đơn vị khác.</div>':''}
    <div class="op-facts">
      <div><span>Nhóm báo cáo</span><b>${escapeHtml(groupLabel(c.sourceGroup))}</b></div>
      <div><span>Người báo cáo</span><b>${escapeHtml(reporterName(c))}</b></div>
      <div><span>Phân loại</span><b>${escapeHtml(categoryLabel(c))}</b></div>
      <div><span>Mức độ</span>${badge(escapeHtml(c.severity),c.severity==='Cao'?'red':c.severity==='Trung bình'?'orange':'')}</div>
      <div><span>Nơi xử lý</span><b>${escapeHtml(c.currentDesk||'—')}</b></div>
      <div><span>Trạng thái</span>${badge(escapeHtml(c.status),statusBadgeClass(c.status))}</div>
      <div><span>Hạn phản hồi</span><b>${escapeHtml(c.deadline||'Chưa đặt')}</b></div>
    </div>
    ${operationalDetail(c)}
    <div class="section"><h4>Nội dung báo cáo</h4><div class="summary-visible">${escapeHtml(c.summary||'')}</div></div>
    <div class="section"><h4>Lịch sử / Audit trail</h4><div class="auditline" id="caseAuditBox"><div>Đang tải lịch sử...</div></div></div>
    <div class="section"><h4>Xử lý nội bộ theo quyền</h4><div id="privateHandlingBox" class="private-zone"><div>Đang kiểm tra quyền...</div></div></div>
  `;
  let actions=`<button class="btn" onclick="pinCase('${c.id}')">📌 Ghim</button>`;
  if(isLead&&['Mới','Đã tiếp nhận'].includes(c.status))actions+=`<button class="btn primary" onclick="caseAction('${c.id}','Gửi Trưởng phòng')">Gửi Trưởng phòng</button>`;
  if(canControl){
    actions+=`<button class="btn" onclick="routeCase('${c.id}')">Chuyển xử lý</button>`;
    actions+=`<button class="btn primary" onclick="caseAction('${c.id}','Đã xử lý')">Đã xử lý</button>`;
    actions+=`<button class="btn" onclick="caseAction('${c.id}','Đóng')">Đóng</button>`;
  }
  if(receiver)actions+=`<button class="btn primary" onclick="caseAction('${c.id}','Đã tiếp nhận')">Xác nhận tiếp nhận</button>`;
  document.getElementById('drawerFoot').innerHTML=actions;
  openDrawer();
  loadCaseEvents(id);
  loadPrivateHandling(id);
  HUB_INTERDEPT.injectPanel(id);
  HUB_CHAT.selectCase(id);
};

window.openOperationalGuide=function(){
  document.getElementById('drawerSmall').textContent='PHÂN LOẠI VẤN ĐỀ';
  document.getElementById('drawerTitle').textContent='5 nhóm phân loại chính';
  document.getElementById('drawerBody').innerHTML=`<div class="op-guide">
    <div><b>Con người & năng lực</b><span>Quy trình, thao tác, năng lực, đào tạo, bàn giao, phân công.</span></div>
    <div><b>Trạm máy / Thiết bị</b><span>Trạm thử, thiết bị đo, lỗi máy, tình trạng vận hành, hiệu chuẩn/kiểm tra.</span></div>
    <div><b>Mẫu thử nghiệm / Khách hàng</b><span>Thiếu mẫu, phụ kiện, catalog/manual, mẫu vỡ/biến dạng, cần KH bổ sung.</span></div>
    <div><b>Kỹ thuật & Thử nghiệm</b><span>Bài thử, kết quả ngoài khoảng, chức năng không hoạt động, phương pháp cần làm rõ.</span></div>
    <div><b>Khác</b><span>Dùng khi không thuộc 4 nhóm trên; bắt buộc ghi rõ nội dung.</span></div>
  </div>`;
  document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Đóng</button>';
  openDrawer();
};

window.renderDesk=function(){
  const needs=casesNeedMyAction();
  const waiting=casesWaiting();
  const opened=openCases();
  const highs=highCases();
  const pins=pinCases();
  const rows=needs.slice(0,10).map(c=>`<tr onclick="openCaseDetail('${c.id}')" style="cursor:pointer">
    <td>${badge(c.severity,c.severity==='Cao'?'red':c.severity==='Trung bình'?'orange':'')}</td>
    <td><b>${escapeHtml(c.id)} — ${escapeHtml(c.title)}</b></td>
    <td>${escapeHtml(groupLabel(c.sourceGroup))}</td>
    <td>${escapeHtml(categoryLabel(c))}</td>
    <td>${escapeHtml(c.currentDesk||'—')}</td>
    <td>${badge(escapeHtml(c.status),statusBadgeClass(c.status))}</td>
  </tr>`).join('');
  return head('Bàn làm việc của tôi','Việc cần xử lý và trạng thái theo quyền.',
    `<button class="btn" onclick="nav('commonRoom')">Phòng chung PTN</button><button class="btn" onclick="openReminder()">⏰ Hẹn nhắc</button>`)+`
    <div class="cards op-metrics">
      <div class="card metric"><div class="lab">Cần tôi xử lý</div><div class="num" style="color:#2858c7">${needs.length}</div></div>
      <div class="card metric"><div class="lab">Đang chờ</div><div class="num" style="color:#b54708">${waiting.length}</div></div>
      <div class="card metric"><div class="lab">Đang mở</div><div class="num" style="color:#b42318">${opened.length}</div></div>
      <div class="card metric"><div class="lab">Mức cao</div><div class="num" style="color:#067647">${highs.length}</div></div>
    </div>
    <div class="grid2"><div>
      <div class="panel"><div class="ph"><h3>VIỆC / VẤN ĐỀ CẦN XỬ LÝ</h3><span class="badge green">Dữ liệu thật</span></div>
        <div class="tablewrap"><table class="op-case-table"><thead><tr><th>Mức</th><th>Vấn đề</th><th>Nhóm báo</th><th>Phân loại</th><th>Nơi xử lý</th><th>Trạng thái</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6">Hiện không có nội dung cần xử lý.</td></tr>'}</tbody></table></div>
      </div>
    </div><div>
      <div class="panel"><div class="ph"><h3>PHÒNG CHUNG PTN</h3><button class="btn" onclick="nav('commonRoom')">Mở</button></div><div class="op-side-line">Quản lý chung PTN</div></div>
      <div class="panel"><div class="ph"><h3>CÁC BỘ PHẬN PTN</h3><button class="btn" onclick="nav('groups')">Xem</button></div><div class="op-side-line">3T-R · K-N · ATAS · Điều phối · Kỹ sư thử nghiệm</div></div>
      <div class="panel"><div class="ph"><h3>ĐÃ GHIM</h3><button class="btn" onclick="nav('pinned')">Xem tất cả</button></div><div class="list">
        ${pins.length?pins.slice(0,4).map(c=>`<div class="item"><div class="title">${escapeHtml(c.id)} — ${escapeHtml(c.title)}</div><div class="meta">${escapeHtml(groupLabel(c.sourceGroup))} · ${escapeHtml(c.status)}</div></div>`).join(''):'<div class="op-side-line">Chưa có nội dung ghim.</div>'}
      </div></div>
    </div></div>`;
};

window.renderPTN=function(){
  if(!canSpace('ptn'))return denied();
  const list=visibleCases();
  const openCount=list.filter(x=>!['Đã xử lý','Đóng'].includes(x.status)).length;
  const waitCount=list.filter(x=>String(x.status||'').startsWith('Chờ')).length;
  const actionButtons=[
    R().type==='head'?'<button class="btn" onclick="openAccessManager()">Quản lý quyền</button>':'',
    R().type==='head'?'<button class="btn" onclick="exportHubCases()">Xuất backup</button>':'',
    '<button class="btn" onclick="openOperationalGuide()">Phân loại</button>',
    '<button class="btn primary" onclick="openCreateCase()">+ Báo cáo vấn đề</button>'
  ].filter(Boolean).join(' ');
  return head('Không gian Phòng Thử nghiệm','Vấn đề, vướng mắc và trạng thái xử lý của PTN.',actionButtons)+`
    <div class="op-ruleline"><b>Nguyên tắc:</b> VM luôn giữ nhóm báo cáo, phân loại, nơi xử lý và lịch sử.</div>
    <div class="cards op-metrics">
      <div class="card metric"><div class="lab">Đang mở</div><div class="num" style="color:#b42318">${openCount}</div></div>
      <div class="card metric"><div class="lab">Đang chờ</div><div class="num" style="color:#b54708">${waitCount}</div></div>
      <div class="card metric"><div class="lab">Bộ phận PTN</div><div class="num">05</div></div>
      <div class="card metric"><div class="lab">Audit trail</div><div class="num op-audit-on">Bật</div></div>
    </div>
    ${renderCaseBoard()}`;
};

document.body.classList.add('operational-v226');
window.HUB_OPERATIONAL_V226=Object.freeze({version:'2.2.6',categories:CATEGORIES,groupLabel,categoryLabel});
})();
