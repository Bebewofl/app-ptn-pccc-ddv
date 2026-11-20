"""Exercise the Spark candidate through its normal Google sign-in emulation."""
from pathlib import Path
import json, os, time, uuid, urllib.request
from playwright.sync_api import sync_playwright, expect
assert os.getenv('FIREBASE_DATABASE_EMULATOR_HOST')=='127.0.0.1:9007'
OUT=Path('pilot-evidence')
OUT.mkdir(exist_ok=True)
ROOT='http://127.0.0.1:9007/hubLite/'
NS='?ns=demo-hub-spark-default-rtdb'
base='http://127.0.0.1:5017/'
def admin(path, method='GET', value=None):
    req=urllib.request.Request(ROOT+path+'.json'+NS, data=None if value is None else json.dumps(value).encode(), method=method, headers={'Authorization':'Bearer owner','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=15) as r: return json.load(r)
def sign_in(page,roles):
    page.goto(base)
    with page.expect_popup() as popup:
        page.get_by_role('button',name='Đăng nhập bằng Google').click()
    dialog=popup.value
    dialog.get_by_text('Add new account',exact=True).click()
    dialog.locator('#email-input').fill('pilot-'+uuid.uuid4().hex+'@example.test')
    dialog.locator('#display-name-input').fill('Người nghiệm thu tổng hợp')
    dialog.locator('#sign-in').click()
    expect(page.locator('#message')).to_contain_text('UID',timeout=20000)
    uid=page.evaluate('firebase.auth().currentUser.uid')
    admin('grants/'+uid,'PUT',{'pilot-'+r:True for r in roles})
    page.reload()
    expect(page.locator('#workspace')).to_be_visible(timeout=20000)
def role(page,name,text):
    page.locator('#pilotRole').select_option('pilot-'+name)
    expect(page.locator('#identity')).to_contain_text(text)
def run(play):
    chrome=play.chromium.launch()
    desk=chrome.new_context(viewport={'width':1365,'height':900},locale='vi-VN')
    page=desk.new_page();sign_in(page,['ptn','pkt']);role(page,'ptn','Thử nghiệm')
    page.get_by_role('button',name='+ Báo cáo vấn đề').click()
    page.locator('#rTitle').fill('Trạm thử cần xác minh trước khi vận hành')
    page.locator('#rBody').fill('Tình huống giả lập. PTN đề nghị PKT kiểm tra thiết bị và ghi kết quả.')
    page.locator('#rTarget').select_option('unit:pilot-pkt');page.get_by_role('button',name='Gửi báo cáo').click()
    expect(page.locator('#modalTitle')).to_have_text('Trạm thử cần xác minh trước khi vận hành')
    link=page.url
    page.locator('#closeModal').click()
    page.get_by_role('button',name='Tổng quan',exact=True).click();expect(page.locator('.metric')).to_have_count(7)
    page.screenshot(path=str(OUT/'HUB_Spark_desktop.png'))
    print('SPARK_BROWSER_PASS desktop Google, three fields, department routing and dashboard',flush=True)
    phone=chrome.new_context(**play.devices['Pixel 7'],locale='vi-VN')
    mobile=phone.new_page();sign_in(mobile,['pkt']);mobile.goto(link)
    expect(mobile.locator('#modalTitle')).to_have_text('Trạm thử cần xác minh trước khi vận hành')
    mobile.get_by_role('button',name='Tiếp nhận',exact=True).click()
    expect(mobile.locator('#modalBody')).to_contain_text('Đang xử lý')
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mobile.screenshot(path=str(OUT/'HUB_Spark_mobile.png'))
    print('SPARK_BROWSER_PASS Android-size Chrome, independent identity, case link and accept',flush=True)
    page.reload();expect(page.locator('#workspace')).to_be_visible()
    role(page,'pkt','Kỹ thuật');page.get_by_role('button',name='Việc cần tôi xử lý').click()
    expect(page.locator('#list')).to_contain_text('Trạm thử cần xác minh')
    print('SPARK_BROWSER_PASS authorized role switch and durable data',flush=True)
    wk=play.webkit.launch();ios=wk.new_context(**play.devices['iPhone 13'],locale='vi-VN')
    iphone=ios.new_page();sign_in(iphone,['ptn']);iphone.get_by_role('button',name='+ Báo cáo vấn đề').click()
    expect(iphone.locator('#rTitle')).to_be_visible()
    assert iphone.evaluate('document.documentElement.scrollWidth<=innerWidth')
    iphone.screenshot(path=str(OUT/'HUB_Spark_iPhone.png'))
    print('SPARK_BROWSER_PASS iPhone-size WebKit report form',flush=True)
    wk.close();chrome.close()
with sync_playwright() as play:run(play)
