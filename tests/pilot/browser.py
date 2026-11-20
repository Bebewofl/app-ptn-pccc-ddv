"""End-to-end checks against the isolated, persistent-for-this-run Firebase emulators."""
import os
import re
import time
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv("HUB_TEST_URL", "http://127.0.0.1:5017")
if BASE not in {"http://127.0.0.1:5017", "http://127.0.0.1:5018"}:
    raise SystemExit("Demo emulators only")
OUT = Path(os.getenv("HUB_EVIDENCE", "pilot-evidence"))
OUT.mkdir(parents=True, exist_ok=True)
results = []
def passed(name):
    results.append(name)
    print("PASS", name, flush=True)

def login(ctx, role, link=BASE):
    page = ctx.new_page()
    page.goto(link)
    page.locator("#demoAccount").select_option(role)
    page.get_by_role("button", name="Đăng nhập thử nghiệm").click()
    expect(page.locator("#workspace")).to_be_visible(timeout=25000)
    return page

def act(p, label, note=None, target=None):
    p.get_by_role("button", name=label, exact=True).click()
    if note is not None:
        p.locator("#aNote").fill(note)
        if target:
            p.locator("#aTarget").select_option(target)
        p.get_by_role("button", name="Xác nhận", exact=True).click()
    expect(p.locator("#modalBody").get_by_role("heading",name="Lịch sử và kết luận")).to_be_visible(timeout=20000)

def main(play):
    browser=play.chromium.launch(executable_path=os.getenv("HUB_CHROMIUM") or None, args=["--no-sandbox"])
    desk=browser.new_context(viewport={"width":1365,"height":900},locale="vi-VN",timezone_id="Asia/Ho_Chi_Minh")
    phone=browser.new_context(**play.devices["Pixel 7"], locale="vi-VN",timezone_id="Asia/Ho_Chi_Minh")
    err=[]
    desk.on("page",lambda p:p.on("pageerror",lambda e:err.append(str(e))))
    p=login(desk,"ptn")
    expect(p.locator("#heading")).to_have_text("Việc cần tôi xử lý")
    passed("D01 · Đăng nhập và màn hình cá nhân")
    p.get_by_role("button",name="+ Báo cáo vấn đề").click()
    title="Kiểm tra trạm thiết bị · "+uuid.uuid4().hex[:6]
    start=time.monotonic()
    p.locator("#rTitle").fill(title);p.locator("#rBody").fill("Phiếu giả lập thực nghiệm phối hợp PTN và PKT.")
    p.locator("#rTarget").select_option("unit:demo-pkt")
    p.get_by_role("button",name="Gửi báo cáo").click()
    expect(p.locator("#modalTitle")).to_have_text(title,timeout=20000)
    elapsed=time.monotonic()-start
    url=p.url;code=re.search(r"VM3-[A-Z0-9]{16}",url).group(0)
    assert elapsed<60
    print("AUTOMATED_REPORT_SECONDS",round(elapsed,2),flush=True)
    passed("D02 · Báo cáo ba trường tới bộ phận")
    pkt=login(phone,"pkt",url)
    expect(pkt.locator("#modalTitle")).to_have_text(title)
    assert pkt.evaluate("document.documentElement.scrollWidth <= innerWidth")
    pkt.screenshot(path=str(OUT/"HUB_mobile.png"))
    passed("D03 · Liên kết hồ sơ trên Chromium kích thước Android")
    act(pkt,"Tiếp nhận")
    act(pkt,"Phản hồi","PKT đã kiểm tra thông tin.")
    act(pkt,"Ghi nhận kết quả","Đã lập biên bản kiểm tra trạm giả lập.")
    p.reload();expect(p.locator("#modalTitle")).to_have_text(title)
    act(p,"Xác nhận và đóng","PTN xác nhận kết quả, kết thúc phối hợp.")
    expect(p.locator("#modalBody")).to_contain_text("PTN xác nhận kết quả")
    passed("D04 · Hai phiên độc lập tiếp nhận, phản hồi, ghi kết quả và xác nhận")
    p.locator("#closeModal").click();p.get_by_role("button",name="Lịch sử và kết luận",exact=True).click()
    p.locator("#search").fill(code);expect(p.locator(".item")).to_have_count(1)
    p.locator("#list button").click();expect(p.locator("#modalBody .event").last).to_contain_text("Xác nhận và đóng")
    p.locator("#closeModal").click();p.get_by_role("button",name="Tổng quan",exact=True).click()
    p.locator(".metric").filter(has_text="Đã hoàn thành").click()
    expect(p.locator("#list")).to_contain_text(title);p.screenshot(path=str(OUT/"HUB_desktop.png"))
    passed("D05 · Tổng quan lọc được và tra cứu kết luận")
    p.locator("#signOut").click();expect(p.locator("#login")).to_be_visible()
    outsider=login(desk,"qlcl",url);expect(outsider.locator("#modalBody")).to_contain_text("ngoài phạm vi")
    passed("D06 · Đăng xuất, đổi vai và kiểm tra liên kết")
    outsider.locator("#closeModal").click();outer_url=outsider.locator("#portal").get_attribute("href")
    assert outer_url=="https://ptn-hfi-portal.firebaseapp.com/"
    with outsider.expect_request(lambda q:q.url.startswith(outer_url)):
        outsider.route(outer_url+"**",lambda route:route.fulfill(status=200,body="Portal boundary"))
        outsider.locator("#portal").click()
    passed("D07 · Điều hướng ra đúng URL Cổng (đích được cô lập trong bài kiểm thử)")
    q=login(browser.new_context(),"ptn")
    q.get_by_role("button",name="+ Báo cáo vấn đề").click()
    q.locator("#rTitle").fill("Thử gửi sau mất mạng");q.locator("#rBody").fill("Chỉ dùng dữ liệu giả lập.")
    q.locator("#rTarget").select_option("demo-pkt")
    q.context.set_offline(True);q.get_by_role("button",name="Gửi báo cáo").click()
    expect(q.locator("#modalMsg")).to_contain_text("Mất kết nối");q.context.set_offline(False)
    q.get_by_role("button",name="Gửi báo cáo").click();expect(q.locator("#modalTitle")).to_have_text("Thử gửi sau mất mạng")
    passed("C03 · Mất mạng, giữ biểu mẫu và gửi lại")
    q.locator("summary",has_text="Tệp đính kèm").click()
    q.locator("#files").set_input_files({"name":"mau.png","mimeType":"image/png","buffer": __import__('base64').b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8h8AAAAASUVORK5CYII=")})
    q.get_by_role("button",name="Lưu tệp").click();expect(q.locator("#modalMsg")).to_contain_text("Đã lưu tệp")
    q.locator("summary",has_text="Tệp đính kèm").click()
    q.get_by_role("button",name="Xem tệp").click();expect(q.locator("img.preview")).to_be_visible();assert q.locator("img.preview").evaluate("i=>i.naturalWidth")>0
    passed("D08 · Tải ảnh, xem trước và đọc lịch sử tệp")
    a=login(browser.new_context(),"accounts");a.get_by_role("button",name="Quản trị tài khoản").click()
    a.locator("#editAccount").select_option("demo-ptn");expect(a.locator("#name")).to_have_value("Trưởng phòng Thử nghiệm")
    expect(a.locator("#modalBody")).to_contain_text("Lịch sử thay đổi quyền")
    passed("D09 · Giao diện quản trị theo vai trò")
    assert not err,err
    browser.close()
    if os.getenv("HUB_WEBKIT")=="1":
        wk=play.webkit.launch();ctx=wk.new_context(**play.devices["iPhone 13"],locale="vi-VN")
        app=login(ctx,"ptn");app.get_by_role("button",name="+ Báo cáo vấn đề").click()
        expect(app.locator("#rTitle")).to_be_visible();assert app.evaluate("document.documentElement.scrollWidth <= innerWidth")
        app.screenshot(path=str(OUT/"HUB_iPhone_WebKit.png"));wk.close()
        passed("D10 · WebKit kích thước iPhone, biểu mẫu báo cáo")
    print("BROWSER_TOTAL",len(results),flush=True)

with sync_playwright() as play:
    main(play)
